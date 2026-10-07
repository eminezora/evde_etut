import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import type { OutcomeRecord } from "../src/lib/curriculum/curriculum-config.ts";
import { seedCurriculum } from "../src/lib/curriculum/seed-curriculum.ts";
import { newJoinCode } from "../src/lib/accounts/account-service.ts";

export const db = new PrismaClient();

export const dataset: OutcomeRecord[] = JSON.parse(
  readFileSync(new URL("../data/curriculum/normalized/all-middle-school.json", import.meta.url), "utf8"),
).outcomes;

let seeded = false;
export async function ensureCurriculum() {
  if (!seeded) {
    await seedCurriculum(db, dataset);
    seeded = true;
  }
}

let n = 0;
export async function makeTeacher(classrooms: { name: string; grade: number }[]) {
  n++;
  const teacher = await db.user.create({
    data: { email: `t${n}-${Date.now()}@okul.test`, name: `Test ${n}`, role: "TEACHER", passwordHash: "x" },
  });
  const rooms = [];
  for (const c of classrooms) rooms.push(await db.classroom.create({ data: { teacherId: teacher.id, joinCode: newJoinCode(), ...c } }));
  return { teacher, rooms };
}

export const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** VERIFIED outcomes of one theme/unit, in page order. */
export async function verifiedOutcomesOfFirstUnit(grade: number, subject: string) {
  const unit = await db.curriculumOutcomeUnit.findFirst({ where: { grade, subject }, orderBy: { unitOrder: "asc" } });
  const links = await db.curriculumOutcomeUnit.findMany({
    where: { grade, subject, unitOrTheme: unit!.unitOrTheme, outcome: { reviewStatus: "VERIFIED" } },
    orderBy: { outcomeOrder: "asc" },
    include: { outcome: true },
  });
  return { unitOrTheme: unit!.unitOrTheme, outcomes: links.map((l) => l.outcome) };
}

export async function makeStudent(classroomIds: string[]) {
  n++;
  const student = await db.user.create({
    data: { email: `s${n}-${Date.now()}@okul.test`, name: `Öğrenci ${n}`, role: "STUDENT", passwordHash: "x" },
  });
  for (const classroomId of classroomIds) await db.classroomMember.create({ data: { classroomId, studentId: student.id } });
  return student;
}
