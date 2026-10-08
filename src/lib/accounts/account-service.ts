// Minimal account and classroom management: sign-up (students freely, teachers with the
// TEACHER_SIGNUP_CODE invite code), classroom creation with a join code, joining by code.

import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";

type Status = 400 | 403 | 404 | 409;
const fail = (status: Status, code: string, message: string) => ({ ok: false as const, status, code, message });

const registerSchema = z.object({
  role: z.enum(["TEACHER", "STUDENT"], { error: "Rol seçilmelidir." }),
  name: z.string().trim().min(2, "Ad en az 2 karakter olmalıdır.").max(80, "Ad en fazla 80 karakter olabilir."),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girilmelidir.").max(200),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır.").max(200, "Şifre en fazla 200 karakter olabilir."),
  teacherCode: z.string().optional(),
});

function codeMatches(given: string | undefined, expected: string) {
  const normGiven = (given ?? "").trim().replace(/^["']|["']$/g, "");
  const normExpected = expected.trim().replace(/^["']|["']$/g, "");
  const a = Buffer.from(normGiven);
  const b = Buffer.from(normExpected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shared check of the teacher invite code (TEACHER_SIGNUP_CODE); also used by Google sign-up. */
export function checkTeacherCode(teacherCode: string | undefined, env: NodeJS.ProcessEnv = process.env) {
  const expected = env.TEACHER_SIGNUP_CODE?.trim().replace(/^["']|["']$/g, "").trim();
  if (!expected) return fail(403, "TEACHER_SIGNUP_DISABLED", "Öğretmen kaydı şu anda kapalı.");
  if (!codeMatches(teacherCode, expected)) return fail(403, "BAD_TEACHER_CODE", "Öğretmen davet kodu hatalı.");
  return null;
}

// Hash of a random throw-away string, compared when the account does not exist (timing equalisation).
const DUMMY_HASH = "$2b$10$pSaE7G29TCsMLWauoydWYewmu7MKWhQJZcQeMSGv4wAVqU8he3D9.";

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

/** E-mail + password sign-in. Accounts without a local password (Google-only) or disabled accounts can't sign in this way. */
export async function authenticate(input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true, sessionVersion: true, passwordHash: true, isActive: true, disabledAt: true },
  });
  // Always run one bcrypt comparison so response time does not reveal whether the e-mail exists.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user || !user.passwordHash || !ok) return null;
  if (!user.isActive || user.disabledAt !== null) return null;
  return { id: user.id, role: user.role, sessionVersion: user.sessionVersion ?? 0 };
}

// Teacher invite code generator: OGRT-8H2K-X7P4
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateTeacherInviteCode(): string {
  const bytes = randomBytes(8);
  const part1 = Array.from(bytes.subarray(0, 4)).map((b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
  const part2 = Array.from(bytes.subarray(4, 8)).map((b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
  return `OGRT-${part1}-${part2}`;
}

export async function registerUser(input: unknown, env: NodeJS.ProcessEnv = process.env, db: PrismaClient = defaultPrisma) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const { role, name, email, password, teacherCode } = parsed.data;

  let dbInviteId: string | null = null;
  if (role === "TEACHER") {
    const rawCode = (teacherCode ?? "").trim();
    if (!rawCode) return fail(403, "BAD_TEACHER_CODE", "Öğretmen davet kodu girilmelidir.");

    const dbInvite = await db.teacherInviteCode.findUnique({
      where: { code: rawCode.toUpperCase() },
    });

    if (dbInvite) {
      if (!dbInvite.isActive) {
        return fail(403, "INVITE_CODE_INACTIVE", "Bu öğretmen davet kodu pasif duruma getirilmiştir.");
      }
      if (dbInvite.expiresAt && dbInvite.expiresAt < new Date()) {
        return fail(403, "INVITE_CODE_EXPIRED", "Bu öğretmen davet kodunun geçerlilik süresi dolmuştur.");
      }
      if (dbInvite.usedCount >= dbInvite.maxUses) {
        return fail(403, "INVITE_CODE_EXHAUSTED", "Bu öğretmen davet kodunun kullanım limiti dolmuştur.");
      }
      dbInviteId = dbInvite.id;
    } else {
      // Fallback to legacy environment variable TEACHER_SIGNUP_CODE for backwards compatibility
      const bad = checkTeacherCode(teacherCode, env);
      if (bad) return bad;
    }
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    if (dbInviteId) {
      // Atomic transaction: verify limit not exceeded simultaneously and record usage
      const result = await db.$transaction(async (tx) => {
        const invite = await tx.teacherInviteCode.findUnique({ where: { id: dbInviteId! } });
        if (!invite || !invite.isActive || (invite.expiresAt && invite.expiresAt < new Date()) || invite.usedCount >= invite.maxUses) {
          throw new Error("INVITE_CODE_EXHAUSTED");
        }
        await tx.teacherInviteCode.update({
          where: { id: dbInviteId! },
          data: { usedCount: { increment: 1 } },
        });
        const user = await tx.user.create({
          data: { role, name, email, passwordHash },
          select: { id: true, role: true, sessionVersion: true },
        });
        await tx.teacherInviteUsage.create({
          data: {
            inviteCodeId: dbInviteId!,
            teacherId: user.id,
          },
        });
        return user;
      });
      return { ok: true as const, data: result };
    }

    const user = await db.user.create({
      data: { role, name, email, passwordHash },
      select: { id: true, role: true, sessionVersion: true },
    });
    return { ok: true as const, data: user };
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "INVITE_CODE_EXHAUSTED") {
      return fail(403, "INVITE_CODE_EXHAUSTED", "Bu öğretmen davet kodunun kullanım limiti dolmuştur.");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(409, "EMAIL_TAKEN", "Bu e-posta adresiyle kayıtlı bir hesap var.");
    }
    throw e;
  }
}

// Join codes: 8 characters without look-alikes (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newJoinCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const normalizeJoinCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const classroomSchema = z.object({
  name: z.string().trim().min(1, "Sınıf adı girilmelidir.").max(40, "Sınıf adı en fazla 40 karakter olabilir."),
  grade: z.coerce.number().int().min(5, "Sınıf düzeyi 5–8 arasında olmalıdır.").max(8, "Sınıf düzeyi 5–8 arasında olmalıdır."),
  description: z.string().trim().max(300, "Açıklama çok uzun.").optional(),
});

export async function createClassroom(teacherId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = classroomSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const teacher = await db.user.findFirst({ where: { id: teacherId, role: "TEACHER" } });
  if (!teacher) return fail(403, "FORBIDDEN", "Sınıf yalnızca öğretmenler tarafından oluşturulabilir.");
  for (let i = 0; i < 5; i++) {
    try {
      const c = await db.classroom.create({ data: { teacherId, ...parsed.data, joinCode: newJoinCode() } });
      return { ok: true as const, data: c };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; // code collision → retry
    }
  }
  return fail(409, "CODE_COLLISION", "Katılma kodu oluşturulamadı, tekrar deneyin.");
}

export async function joinClassroom(studentId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = z.object({ code: z.string().trim().min(1, "Katılma kodu girilmelidir.").max(40, "Katılma kodu çok uzun.") }).safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const student = await db.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
  if (!student) return fail(403, "FORBIDDEN", "Sınıfa yalnızca öğrenciler katılabilir.");
  const classroom = await db.classroom.findUnique({
    where: { joinCode: normalizeJoinCode(parsed.data.code) },
    select: { id: true, name: true, grade: true, archivedAt: true },
  });
  if (!classroom) return fail(404, "NOT_FOUND", "Bu koda ait bir sınıf bulunamadı. Kodu öğretmeninden kontrol edip tekrar dene.");
  if (classroom.archivedAt !== null) {
    return fail(400, "CLASSROOM_ARCHIVED", "Bu sınıf arşivlenmiştir ve yeni öğrenci kabul etmemektedir.");
  }
  await db.classroomMember.upsert({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId } },
    create: { classroomId: classroom.id, studentId },
    update: {},
  });
  return { ok: true as const, data: classroom };
}

export const listTeacherClassrooms = (
  teacherId: string,
  options?: { includeArchived?: boolean; onlyArchived?: boolean },
  db: PrismaClient = defaultPrisma
) => {
  const where: Prisma.ClassroomWhereInput = { teacherId };
  if (options?.onlyArchived) {
    where.archivedAt = { not: null };
  } else if (!options?.includeArchived) {
    where.archivedAt = null;
  }

  return db.classroom.findMany({
    where,
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      grade: true,
      joinCode: true,
      description: true,
      archivedAt: true,
      createdAt: true,
      _count: { select: { members: true, assignments: true } },
    },
  });
};

export const listStudentClassrooms = (studentId: string, db: PrismaClient = defaultPrisma) =>
  db.classroom.findMany({
    where: { members: { some: { studentId } }, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, grade: true, description: true, teacher: { select: { name: true } } },
  });

