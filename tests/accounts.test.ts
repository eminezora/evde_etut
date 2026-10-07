import bcrypt from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { createClassroom, joinClassroom, newJoinCode, normalizeJoinCode, registerUser } from "../src/lib/accounts/account-service.ts";
import { db, makeStudent, makeTeacher } from "./helpers.ts";

afterAll(() => db.$disconnect());

const env = { NODE_ENV: "test", TEACHER_SIGNUP_CODE: "davet-kodu-123" } as NodeJS.ProcessEnv;
const email = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}@okul.test`;

describe("registration", () => {
  it("lets students register freely and hashes the password", async () => {
    const e = email("ogr");
    const r = await registerUser({ role: "STUDENT", name: "Ali", email: e.toUpperCase(), password: "gizli-sifre-1" }, env, db);
    expect(r.ok && r.data.role).toBe("STUDENT");
    const user = await db.user.findUniqueOrThrow({ where: { email: e } }); // e-mail normalised to lower case
    expect(user.passwordHash).not.toContain("gizli");
    expect(await bcrypt.compare("gizli-sifre-1", user.passwordHash)).toBe(true);
    const dup = await registerUser({ role: "STUDENT", name: "Ali", email: e, password: "gizli-sifre-1" }, env, db);
    expect(!dup.ok && dup.status).toBe(409);
  });

  it("requires the teacher invite code; teacher sign-up is closed without it", async () => {
    const base = { role: "TEACHER", name: "Ayşe", password: "gizli-sifre-1" };
    expect((await registerUser({ ...base, email: email("t1"), teacherCode: "yanlis" }, env, db)).ok).toBe(false);
    expect((await registerUser({ ...base, email: email("t2") }, env, db)).ok).toBe(false);
    const closed = await registerUser({ ...base, email: email("t3"), teacherCode: "davet-kodu-123" }, { NODE_ENV: "test" } as NodeJS.ProcessEnv, db);
    expect(!closed.ok && closed.code).toBe("TEACHER_SIGNUP_DISABLED");
    const ok = await registerUser({ ...base, email: email("t4"), teacherCode: "davet-kodu-123" }, env, db);
    expect(ok.ok && ok.data.role).toBe("TEACHER");
    // Role cannot be escalated through extra fields.
    expect((await registerUser({ ...base, role: "ADMIN", email: email("t5") }, env, db)).ok).toBe(false);
    expect((await registerUser({ role: "STUDENT", name: "x", email: email("s"), password: "short" }, env, db)).ok).toBe(false);
  });
});

describe("classrooms", () => {
  it("teacher creates a classroom with a unique join code; students join with it", async () => {
    const { teacher } = await makeTeacher([]);
    const created = await createClassroom(teacher.id, { name: "6/C", grade: 6 }, db);
    if (!created.ok) throw new Error(created.message);
    expect(created.data.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await createClassroom(teacher.id, { name: "9/A", grade: 9 }, db)).ok).toBe(false);

    const student = await makeStudent([]);
    const lower = created.data.joinCode.toLowerCase().replace(/(.{4})/, "$1-");
    const joined = await joinClassroom(student.id, { code: lower }, db);
    expect(joined.ok && joined.data.id).toBe(created.data.id);
    expect((await joinClassroom(student.id, { code: created.data.joinCode }, db)).ok).toBe(true); // idempotent
    expect(await db.classroomMember.count({ where: { classroomId: created.data.id } })).toBe(1);
    expect((await joinClassroom(student.id, { code: "YOKBOYLE" }, db)).ok).toBe(false);
  });

  it("only teachers create classrooms and only students join", async () => {
    const student = await makeStudent([]);
    expect((await createClassroom(student.id, { name: "x", grade: 5 }, db)).ok).toBe(false);
    const { teacher, rooms } = await makeTeacher([{ name: "5/Z", grade: 5 }]);
    expect((await joinClassroom(teacher.id, { code: rooms[0].joinCode }, db)).ok).toBe(false);
  });

  it("generates codes without look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(newJoinCode()).not.toMatch(/[01OIL]/);
    expect(normalizeJoinCode(" ab-cd 12 ")).toBe("ABCD12");
  });
});
