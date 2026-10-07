import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authenticate, registerUser } from "../src/lib/accounts/account-service.ts";
import {
  RESET_MAX_PER_WINDOW,
  RESET_TOKEN_TTL_MS,
  changePassword,
  hashResetToken,
  isResetTokenValid,
  requestPasswordReset,
  resetPassword,
} from "../src/lib/accounts/password-service.ts";
import { getStudentProfile, getTeacherProfile, updateProfileName } from "../src/lib/accounts/profile-service.ts";
import { completeGoogleSignup, identityFromClaims, resolveGoogleLogin, type GoogleIdentity } from "../src/lib/auth/google.ts";
import { createSessionToken, readFlowToken, readSessionToken, signFlowToken } from "../src/lib/auth/session.ts";
import { getMailProvider, memoryOutbox, passwordResetEmail } from "../src/lib/mail/mail-service.ts";
import { rateLimit } from "../src/lib/http/rate-limit.ts";
import { db, makeStudent, makeTeacher } from "./helpers.ts";

afterAll(() => db.$disconnect());
beforeEach(() => {
  memoryOutbox.length = 0;
});

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const mailer = getMailProvider(env({ NODE_ENV: "test", MAIL_PROVIDER: "memory" }))!;
const baseUrl = "https://evde-etut.test";
let n = 0;
async function localUser(role: "STUDENT" | "TEACHER" = "STUDENT", password = "eski-sifre-123") {
  n++;
  const email = `acc${n}-${Date.now()}@okul.test`;
  const r = await registerUser({ role, name: "Ayşe Kaya", email, password, teacherCode: "KOD-123" }, env({ TEACHER_SIGNUP_CODE: "KOD-123" }), db);
  if (!r.ok) throw new Error(r.message);
  return { id: r.data.id, email, password };
}
const tokenFromMail = () => new URL(memoryOutbox.at(-1)!.text.match(/https:\S+/)![0]).searchParams.get("token")!;

describe("password reset", () => {
  it("e-mails a single-use link and stores only the token hash", async () => {
    const u = await localUser();
    const r = await requestPasswordReset(u.email.toUpperCase(), { db, mailer, baseUrl });
    expect(r.sent).toBe(true);
    const mail = memoryOutbox.at(-1)!;
    expect(mail.to).toBe(u.email);
    expect(mail.subject).toBe("Evde Etüt – Şifre Sıfırlama");
    expect(mail.text).toContain("30 dakika");
    expect(mail.html).toContain("Şifremi Sıfırla");
    expect(mail.text).toContain("görmezden gelebilirsiniz");
    const token = tokenFromMail();
    expect(mail.text).toContain(`${baseUrl}/sifre-sifirla?token=`);
    const row = await db.passwordResetToken.findFirst({ where: { userId: u.id } });
    expect(row!.tokenHash).toBe(hashResetToken(token));
    expect(row!.tokenHash).not.toContain(token);
    expect(row!.expiresAt.getTime() - row!.createdAt.getTime()).toBe(RESET_TOKEN_TTL_MS);

    expect(await isResetTokenValid(token, db)).toBe(true);
    const done = await resetPassword({ token, password: "yeni-sifre-456", passwordConfirm: "yeni-sifre-456" }, db);
    expect(done.ok).toBe(true);
    expect(await authenticate({ email: u.email, password: "yeni-sifre-456" }, db)).not.toBeNull();
    expect(await authenticate({ email: u.email, password: u.password }, db)).toBeNull();
    // Used token can't be used again.
    const again = await resetPassword({ token, password: "baska-sifre-789", passwordConfirm: "baska-sifre-789" }, db);
    expect(!again.ok && again.code).toBe("INVALID_TOKEN");
    expect(await isResetTokenValid(token, db)).toBe(false);
  });

  it("rejects expired tokens, mismatched passwords and short passwords", async () => {
    const u = await localUser();
    const past = new Date(Date.now() - RESET_TOKEN_TTL_MS - 60_000);
    await requestPasswordReset(u.email, { db, mailer, baseUrl, now: past });
    const token = tokenFromMail();
    const expired = await resetPassword({ token, password: "yeni-sifre-456", passwordConfirm: "yeni-sifre-456" }, db);
    expect(!expired.ok && expired.code).toBe("INVALID_TOKEN");

    await requestPasswordReset(u.email, { db, mailer, baseUrl });
    const fresh = tokenFromMail();
    const mismatch = await resetPassword({ token: fresh, password: "yeni-sifre-456", passwordConfirm: "farkli-sifre-1" }, db);
    expect(!mismatch.ok && mismatch.message).toBe("Şifreler birbiriyle aynı değil.");
    const short = await resetPassword({ token: fresh, password: "kisa", passwordConfirm: "kisa" }, db);
    expect(short.ok).toBe(false);
    expect(await isResetTokenValid(fresh, db)).toBe(true); // failed validation does not consume it
  });

  it("does not reveal whether an account exists and limits repeated requests", async () => {
    const unknown = await requestPasswordReset("kimse-yok@okul.test", { db, mailer, baseUrl });
    expect(unknown.sent).toBe(false);
    expect(memoryOutbox).toHaveLength(0);

    const u = await localUser();
    for (let i = 0; i < RESET_MAX_PER_WINDOW; i++) expect((await requestPasswordReset(u.email, { db, mailer, baseUrl })).sent).toBe(true);
    const limited = await requestPasswordReset(u.email, { db, mailer, baseUrl });
    expect(limited).toMatchObject({ sent: false, reason: "RATE_LIMITED" });
    expect(memoryOutbox).toHaveLength(RESET_MAX_PER_WINDOW);
  });

  it("signs out existing sessions after a reset (session version)", async () => {
    const u = await localUser();
    const before = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    await requestPasswordReset(u.email, { db, mailer, baseUrl });
    await resetPassword({ token: tokenFromMail(), password: "yeni-sifre-456", passwordConfirm: "yeni-sifre-456" }, db);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    const oldToken = await createSessionToken({ userId: u.id, role: "STUDENT", sessionVersion: before.sessionVersion });
    expect((await readSessionToken(oldToken))!.sessionVersion).not.toBe(after.sessionVersion); // getCurrentUser rejects it
  });

  it("escapes names in the e-mail HTML", () => {
    const m = passwordResetEmail("a@b.test", "<script>x</script>", "https://x.test/sifre-sifirla?token=abc");
    expect(m.html).not.toContain("<script>x</script>");
  });

  it("only uses the memory mailer outside production and never without configuration", () => {
    expect(getMailProvider(env({ NODE_ENV: "production", MAIL_PROVIDER: "memory" }))).toBeNull();
    expect(getMailProvider(env({ NODE_ENV: "production" }))).toBeNull();
    expect(getMailProvider(env({ NODE_ENV: "production", RESEND_API_KEY: "re_test", MAIL_FROM: "Evde Etüt <a@b.test>" }))?.name).toBe("resend");
  });

  it("sends through Resend without leaking the key in errors", async () => {
    const calls: RequestInit[] = [];
    const ok = getMailProvider(env({ RESEND_API_KEY: "re_secret_value", MAIL_FROM: "x@y.test" }), (async (_u: string, init: RequestInit) => {
      calls.push(init);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch)!;
    await ok.send({ to: "a@b.test", subject: "s", html: "h", text: "t" });
    expect((calls[0].headers as Record<string, string>).Authorization).toBe("Bearer re_secret_value");
    const bad = getMailProvider(env({ RESEND_API_KEY: "re_secret_value", MAIL_FROM: "x@y.test" }), (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch)!;
    await expect(bad.send({ to: "a@b.test", subject: "s", html: "h", text: "t" })).rejects.toThrow(/HTTP 403/);
    await bad.send({ to: "a@b.test", subject: "s", html: "h", text: "t" }).catch((e: Error) => expect(e.message).not.toContain("re_secret"));
  });
});

describe("profile", () => {
  it("changes the password only with the correct current password", async () => {
    const u = await localUser();
    const wrong = await changePassword(u.id, { currentPassword: "yanlis-sifre", password: "yeni-sifre-456", passwordConfirm: "yeni-sifre-456" }, db);
    expect(!wrong.ok && wrong.code).toBe("BAD_PASSWORD");
    const missing = await changePassword(u.id, { password: "yeni-sifre-456", passwordConfirm: "yeni-sifre-456" }, db);
    expect(missing.ok).toBe(false);
    const ok = await changePassword(u.id, { currentPassword: u.password, password: "yeni-sifre-456", passwordConfirm: "yeni-sifre-456" }, db);
    expect(ok.ok && ok.data.created).toBe(false);
    expect(await authenticate({ email: u.email, password: "yeni-sifre-456" }, db)).not.toBeNull();
  });

  it("lets a Google-only account create a password", async () => {
    const user = await db.user.create({ data: { email: `g-${Date.now()}@gmail.com`, name: "Google Kullanıcı", role: "STUDENT", googleSub: `sub-${Date.now()}`, passwordHash: null } });
    expect(await authenticate({ email: user.email, password: "herhangi-bir-sifre" }, db)).toBeNull(); // no password yet
    const r = await changePassword(user.id, { password: "ilk-parola-123", passwordConfirm: "ilk-parola-123" }, db);
    expect(r.ok && r.data.created).toBe(true);
    expect(await authenticate({ email: user.email, password: "ilk-parola-123" }, db)).not.toBeNull();
  });

  it("updates the name with validation", async () => {
    const u = await localUser();
    expect((await updateProfileName(u.id, { name: "A" }, db)).ok).toBe(false);
    const r = await updateProfileName(u.id, { name: "  Ayşe Yılmaz  " }, db);
    expect(r.ok && r.data.name).toBe("Ayşe Yılmaz");
  });

  it("shows teacher and student summaries scoped to the user", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "6/A", grade: 6 }, { name: "6/B", grade: 6 }]);
    const s1 = await makeStudent([rooms[0].id, rooms[1].id]);
    await makeStudent([rooms[0].id]);
    const tp = await getTeacherProfile(teacher.id, db);
    expect(tp!.stats).toMatchObject({ classrooms: 2, students: 2, activeAssignments: 0 });
    expect(tp!.user.hasPassword).toBe(true);
    const sp = await getStudentProfile(s1.id, db);
    expect(sp!.classrooms.map((c) => c.name).sort()).toEqual(["6/A", "6/B"]);
    expect(sp!.stats).toMatchObject({ total: 0, completed: 0, ready: 0, pending: 0 });
    // Role mismatch: a student id is not a teacher profile.
    expect(await getTeacherProfile(s1.id, db)).toBeNull();
  });

  it("accepts any valid e-mail domain for normal sign-up (not only Gmail)", async () => {
    for (const email of [`x-${Date.now()}@okul.k12.tr`, `y-${Date.now()}@outlook.com`, `z-${Date.now()}@yandex.com`]) {
      const r = await registerUser({ role: "STUDENT", name: "Deneme Öğrenci", email, password: "guvenli-sifre-1" }, env({}), db);
      expect(r.ok).toBe(true);
    }
  });
});

describe("Google sign-in", () => {
  const identity = (over: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
    sub: `google-${Date.now()}-${Math.random()}`,
    email: `g${Date.now()}${Math.random().toString(36).slice(2, 6)}@gmail.com`,
    emailVerified: true,
    name: "Google Öğrenci",
    picture: null,
    ...over,
  });

  it("verifies the nonce and normalises the e-mail", () => {
    expect(() => identityFromClaims({ sub: "1", email: "A@B.com", nonce: "x" }, "y")).toThrow(/nonce/);
    expect(identityFromClaims({ sub: "1", email: "A@B.com", email_verified: true, nonce: "x" }, "x")).toMatchObject({ email: "a@b.com", emailVerified: true });
  });

  it("first sign-in asks for a role; a student gets no classroom and no password", async () => {
    const id = identity();
    expect((await resolveGoogleLogin(id, db)).kind).toBe("signup");
    expect((await completeGoogleSignup(id, {}, env({}), db)).ok).toBe(false); // role required
    const r = await completeGoogleSignup(id, { role: "STUDENT" }, env({}), db);
    expect(r.ok && r.data.role).toBe("STUDENT");
    const user = await db.user.findUniqueOrThrow({ where: { email: id.email }, include: { memberships: true } });
    expect(user.passwordHash).toBeNull();
    expect(user.memberships).toHaveLength(0);
    // Second sign-in logs in, no duplicate.
    const again = await resolveGoogleLogin(id, db);
    expect(again.kind === "login" && again.user.id).toBe(user.id);
    expect((await completeGoogleSignup(id, { role: "STUDENT" }, env({}), db)).ok).toBe(true);
    expect(await db.user.count({ where: { email: id.email } })).toBe(1);
  });

  it("a Google account alone never grants teacher rights", async () => {
    const id = identity();
    const closed = await completeGoogleSignup(id, { role: "TEACHER" }, env({}), db);
    expect(!closed.ok && closed.message).toBe("Öğretmen kaydı şu anda kapalı.");
    const wrong = await completeGoogleSignup(id, { role: "TEACHER", teacherCode: "yanlis" }, env({ TEACHER_SIGNUP_CODE: "DOGRU-KOD" }), db);
    expect(!wrong.ok && wrong.message).toBe("Öğretmen davet kodu hatalı.");
    const ok = await completeGoogleSignup(id, { role: "TEACHER", teacherCode: "DOGRU-KOD" }, env({ TEACHER_SIGNUP_CODE: "DOGRU-KOD" }), db);
    expect(ok.ok && ok.data.role).toBe("TEACHER");
  });

  it("links an existing e-mail account only for a verified Google e-mail, without duplicates", async () => {
    const u = await localUser();
    const unverified = await resolveGoogleLogin(identity({ email: u.email, emailVerified: false }), db);
    expect(unverified.kind).toBe("error");
    const id = identity({ email: u.email });
    const linked = await resolveGoogleLogin(id, db);
    expect(linked.kind === "login" && linked.linked && linked.user.id).toBe(u.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).googleSub).toBe(id.sub);
    // The password keeps working.
    expect(await authenticate({ email: u.email, password: u.password }, db)).not.toBeNull();
    // Another Google account with the same e-mail is refused.
    const other = await resolveGoogleLogin(identity({ email: u.email }), db);
    expect(other.kind).toBe("error");
    expect(await db.user.count({ where: { email: u.email } })).toBe(1);
  });

  it("keeps signed flow tokens separate from sessions", async () => {
    const flow = await signFlowToken("google-signup", { sub: "1", email: "a@b.test" }, 60);
    expect(await readSessionToken(flow)).toBeNull();
    expect(await readFlowToken("google-oauth", flow)).toBeNull();
    expect(await readFlowToken("google-signup", flow)).toMatchObject({ email: "a@b.test" });
    const session = await createSessionToken({ userId: "u", role: "STUDENT", sessionVersion: 0 });
    expect(await readFlowToken("google-signup", session)).toBeNull();
  });
});

describe("rate limit", () => {
  it("blocks after the limit within the window and resets afterwards", () => {
    const key = `t-${Math.random()}`;
    expect([1, 2, 3].map(() => rateLimit(key, 2, 1000, 0))).toEqual([true, true, false]);
    expect(rateLimit(key, 2, 1000, 2000)).toBe(true);
  });
});

