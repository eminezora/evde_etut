import bcrypt from "bcryptjs";
import { afterAll, describe, expect, it } from "vitest";
import { authenticate, registerUser } from "../src/lib/accounts/account-service.ts";
import {
  createTeacherInvite,
  setTeacherInviteStatus,
} from "../src/lib/admin/invite-code-service.ts";
import { recordAuditLog, listAuditLogs } from "../src/lib/admin/audit-service.ts";
import { db } from "./helpers.ts";

afterAll(() => db.$disconnect());

const email = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}@okul.test`;

describe("admin & teacher invite codes", () => {
  it("generates a cryptographically formatted code (OGRT-XXXX-XXXX)", async () => {
    const admin = await db.user.create({
      data: { email: email("adm1"), name: "Admin 1", role: "ADMIN", passwordHash: "x" },
    });

    const res = await createTeacherInvite(admin.id, { maxUses: 3 }, db);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.code).toMatch(/^OGRT-[23456789A-Z]{4}-[23456789A-Z]{4}$/);
      expect(res.data.maxUses).toBe(3);
      expect(res.data.usedCount).toBe(0);
      expect(res.data.isActive).toBe(true);
    }
  });

  it("single-use invite code: first registration succeeds, second fails with exhausted", async () => {
    const admin = await db.user.create({
      data: { email: email("adm2"), name: "Admin 2", role: "ADMIN", passwordHash: "x" },
    });

    const created = await createTeacherInvite(admin.id, { maxUses: 1 }, db);
    if (!created.ok) throw new Error("Could not create code");
    const code = created.data.code;

    // 1st teacher registration with code -> OK
    const t1Email = email("teacher-first");
    const reg1 = await registerUser(
      { role: "TEACHER", name: "Hasan", email: t1Email, password: "password123", teacherCode: code },
      {} as NodeJS.ProcessEnv,
      db
    );
    expect(reg1.ok).toBe(true);

    // Verify usage record in DB
    const usages = await db.teacherInviteUsage.findMany({ where: { inviteCodeId: created.data.id } });
    expect(usages.length).toBe(1);

    // 2nd teacher registration with same code -> FAILS with exhausted
    const t2Email = email("teacher-second");
    const reg2 = await registerUser(
      { role: "TEACHER", name: "Zeynep", email: t2Email, password: "password123", teacherCode: code },
      {} as NodeJS.ProcessEnv,
      db
    );
    expect(reg2.ok).toBe(false);
    if (!reg2.ok) {
      expect(reg2.code).toBe("INVITE_CODE_EXHAUSTED");
    }
  });

  it("blocks registration when invite code is deactivated (isActive = false)", async () => {
    const admin = await db.user.create({
      data: { email: email("adm3"), name: "Admin 3", role: "ADMIN", passwordHash: "x" },
    });

    const created = await createTeacherInvite(admin.id, { maxUses: 5 }, db);
    if (!created.ok) throw new Error("Could not create code");

    // Deactivate code
    await setTeacherInviteStatus(admin.id, created.data.id, false, db);

    const reg = await registerUser(
      { role: "TEACHER", name: "Burak", email: email("teacher-inact"), password: "password123", teacherCode: created.data.code },
      {} as NodeJS.ProcessEnv,
      db
    );
    expect(reg.ok).toBe(false);
    if (!reg.ok) {
      expect(reg.code).toBe("INVITE_CODE_INACTIVE");
    }
  });

  it("blocks registration when invite code has expired", async () => {
    const admin = await db.user.create({
      data: { email: email("adm4"), name: "Admin 4", role: "ADMIN", passwordHash: "x" },
    });

    // Code that expired yesterday
    const yesterday = new Date(Date.now() - 86_400_000);
    const created = await createTeacherInvite(admin.id, { maxUses: 5, expiresAt: yesterday }, db);
    if (!created.ok) throw new Error("Could not create code");

    const reg = await registerUser(
      { role: "TEACHER", name: "Canan", email: email("teacher-exp"), password: "password123", teacherCode: created.data.code },
      {} as NodeJS.ProcessEnv,
      db
    );
    expect(reg.ok).toBe(false);
    if (!reg.ok) {
      expect(reg.code).toBe("INVITE_CODE_EXPIRED");
    }
  });

  it("disabled user cannot authenticate, enabled user can", async () => {
    const testEmail = email("user-toggle");
    const password = "mySecretPassword123";
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: { email: testEmail, name: "Ahmet", role: "STUDENT", passwordHash, isActive: true },
    });

    // Active -> authentication succeeds
    const auth1 = await authenticate({ email: testEmail, password }, db);
    expect(auth1).not.toBeNull();

    // Disable user
    await db.user.update({
      where: { id: user.id },
      data: { isActive: false, disabledAt: new Date() },
    });

    // Disabled -> authentication fails
    const auth2 = await authenticate({ email: testEmail, password }, db);
    expect(auth2).toBeNull();

    // Re-enable user
    await db.user.update({
      where: { id: user.id },
      data: { isActive: true, disabledAt: null },
    });

    // Active again -> succeeds
    const auth3 = await authenticate({ email: testEmail, password }, db);
    expect(auth3).not.toBeNull();
  });

  it("records and lists audit logs properly", async () => {
    const admin = await db.user.create({
      data: { email: email("adm5"), name: "Audit Admin", role: "ADMIN", passwordHash: "x" },
    });

    await recordAuditLog({
      adminId: admin.id,
      action: "TEST_ACTION",
      entityType: "Classroom",
      entityId: "test-c1",
      metadata: { note: "Unit test" },
    }, db);

    const logs = await listAuditLogs(10, db);
    const match = logs.find((l) => l.action === "TEST_ACTION" && l.entityId === "test-c1");
    expect(match).toBeDefined();
    expect(match?.admin?.name).toBe("Audit Admin");
  });
});
