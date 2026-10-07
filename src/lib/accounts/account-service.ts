// Minimal account and classroom management: sign-up (students freely, teachers with the
// TEACHER_SIGNUP_CODE invite code), classroom creation with a join code, joining by code.

import { randomInt, timingSafeEqual } from "node:crypto";
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
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function registerUser(input: unknown, env: NodeJS.ProcessEnv = process.env, db: PrismaClient = defaultPrisma) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const { role, name, email, password, teacherCode } = parsed.data;
  if (role === "TEACHER") {
    const expected = env.TEACHER_SIGNUP_CODE?.trim();
    if (!expected) return fail(403, "TEACHER_SIGNUP_DISABLED", "Öğretmen kaydı şu anda kapalı.");
    if (!codeMatches(teacherCode?.trim(), expected)) return fail(403, "BAD_TEACHER_CODE", "Öğretmen davet kodu hatalı.");
  }
  try {
    const user = await db.user.create({
      data: { role, name, email, passwordHash: await bcrypt.hash(password, 10) },
      select: { id: true, role: true },
    });
    return { ok: true as const, data: user };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail(409, "EMAIL_TAKEN", "Bu e-posta adresiyle kayıtlı bir hesap var.");
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
  const parsed = z.object({ code: z.string().min(1, "Katılma kodu girilmelidir.").max(40) }).safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const student = await db.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
  if (!student) return fail(403, "FORBIDDEN", "Sınıfa yalnızca öğrenciler katılabilir.");
  const classroom = await db.classroom.findUnique({ where: { joinCode: normalizeJoinCode(parsed.data.code) }, select: { id: true, name: true, grade: true } });
  if (!classroom) return fail(404, "NOT_FOUND", "Bu koda ait bir sınıf bulunamadı.");
  await db.classroomMember.upsert({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId } },
    create: { classroomId: classroom.id, studentId },
    update: {},
  });
  return { ok: true as const, data: classroom };
}

export const listTeacherClassrooms = (teacherId: string, db: PrismaClient = defaultPrisma) =>
  db.classroom.findMany({
    where: { teacherId },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: { id: true, name: true, grade: true, joinCode: true, _count: { select: { members: true, assignments: true } } },
  });

export const listStudentClassrooms = (studentId: string, db: PrismaClient = defaultPrisma) =>
  db.classroom.findMany({
    where: { members: { some: { studentId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, grade: true, teacher: { select: { name: true } } },
  });
