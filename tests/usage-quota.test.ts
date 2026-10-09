import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { istanbulParts, periodBounds, resetHint } from "../src/lib/usage/period.ts";
import {
  adminUsageReport,
  commitUsage,
  getQuotaStatus,
  getUsageSummary,
  limitReachedMessage,
  listUsageHistory,
  refundStaleReservations,
  refundUsage,
  reserveUsage,
  setOverride,
  upsertPolicy,
} from "../src/lib/usage/usage-quota-service.ts";
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";
import { generateStudyContent, startStudyContentGeneration } from "../src/lib/content/content-service.ts";
import { chatWithAssistantDetailed } from "../src/lib/assistant/assistant-service.ts";
import { ProviderError, type ContentGenerationProvider } from "../src/lib/ai/content-generation-provider.ts";
import { MockContentProvider } from "../src/lib/ai/providers/mock-provider.ts";
import { db, ensureCurriculum, inDays, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

const opts = (now?: Date) => ({ db, ...(now ? { now } : {}) });
let n = 0;
const cid = () => `test-${Date.now()}-${++n}`;

async function draftFor(teacherId: string, classroomId: string) {
  const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(6, "Fen Bilimleri");
  const r = await createAssignment(teacherId, { classroomId, subject: "Fen Bilimleri", unitOrTheme, topic: "Kota", outcomeIds: [outcomes[0].id], minimumScore: 70, deadline: inDays(3), questionCount: 5 }, db);
  if (!r.ok) throw new Error("draft");
  return r.data.id;
}

describe("Europe/Istanbul periods", () => {
  it("starts the day at 00:00 Istanbul time, not UTC", () => {
    // 23:59 in Istanbul on 8 Oct = 20:59 UTC → still 8 Oct.
    const late = new Date("2026-10-08T20:59:00Z");
    expect(istanbulParts(late)).toMatchObject({ year: 2026, month: 10, day: 8, hour: 23 });
    expect(periodBounds("DAILY", late)).toEqual({ start: new Date("2026-10-07T21:00:00Z"), end: new Date("2026-10-08T21:00:00Z") });
    // 00:30 Istanbul on 9 Oct = 21:30 UTC on 8 Oct → already the next day.
    expect(periodBounds("DAILY", new Date("2026-10-08T21:30:00Z")).start).toEqual(new Date("2026-10-08T21:00:00Z"));
  });

  it("starts weeks on Monday and months on the 1st (Istanbul)", () => {
    // Thursday 8 Oct 2026 → week Mon 5 Oct 00:00 TR … Mon 12 Oct 00:00 TR.
    expect(periodBounds("WEEKLY", new Date("2026-10-08T10:00:00Z"))).toEqual({ start: new Date("2026-10-04T21:00:00Z"), end: new Date("2026-10-11T21:00:00Z") });
    // Sunday 23:30 TR still belongs to the same week.
    expect(periodBounds("WEEKLY", new Date("2026-10-11T20:30:00Z")).start).toEqual(new Date("2026-10-04T21:00:00Z"));
    expect(periodBounds("MONTHLY", new Date("2026-10-31T20:59:00Z"))).toEqual({ start: new Date("2026-09-30T21:00:00Z"), end: new Date("2026-10-31T21:00:00Z") });
    expect(periodBounds("MONTHLY", new Date("2026-12-15T10:00:00Z")).end).toEqual(new Date("2026-12-31T21:00:00Z"));
    expect(resetHint("DAILY", periodBounds("DAILY", new Date("2026-10-08T10:00:00Z")).end, new Date("2026-10-08T10:00:00Z"))).toBe("Yarın 00:00'da yenilenir");
  });
});

describe("usage quotas", () => {
  it("applies the role default (teacher: 10 AI drafts per day) and blocks the 11th", async () => {
    const { teacher } = await makeTeacher([]);
    const user = { id: teacher.id, role: "TEACHER" };
    const status = await getQuotaStatus(db, user, "AI_CONTENT_GENERATION");
    expect(status).toMatchObject({ source: "ROLE", periodType: "DAILY", limit: 10, used: 0, remaining: 10 });
    for (let i = 0; i < 10; i++) expect((await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts())).ok).toBe(true);
    const blocked = await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts());
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
      expect(blocked.code).toBe("USAGE_LIMIT_REACHED");
      expect(blocked.message).toBe("Bugünkü yapay zekâ kullanım hakkınızı tamamladınız. Yeni kullanım hakkınız yarın yenilenecek.");
    }
    // Next Istanbul day: a fresh quota (no cron).
    const tomorrow = new Date(periodBounds("DAILY").end.getTime() + 60_000);
    expect((await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts(tomorrow))).ok).toBe(true);
  });

  it("students only have the DersBot quota (20 messages per day)", async () => {
    const s = await makeStudent([]);
    const summary = await getUsageSummary({ id: s.id, role: "STUDENT" }, db);
    expect(summary.map((q) => q.feature)).toEqual(["AI_ASSISTANT_MESSAGE"]);
    expect(summary[0]).toMatchObject({ limit: 20, periodType: "DAILY" });
    const teacher = await getUsageSummary({ id: s.id, role: "TEACHER" }, db);
    expect(teacher.map((q) => q.feature).sort()).toEqual(["AI_ASSISTANT_MESSAGE", "AI_CONTENT_GENERATION"]);
  });

  it("supports weekly and monthly limits with the reset date in the message", async () => {
    const { teacher } = await makeTeacher([]);
    const user = { id: teacher.id, role: "TEACHER" };
    const now = new Date("2026-10-08T10:00:00Z");
    await setOverride({ userId: teacher.id, feature: "AI_CONTENT_GENERATION", periodType: "WEEKLY", limit: 2, unlimited: false, validUntil: null }, db);
    expect((await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts(now))).ok).toBe(true);
    expect((await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts(new Date("2026-10-10T10:00:00Z")))).ok).toBe(true);
    const weekly = await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts(new Date("2026-10-11T20:00:00Z")));
    expect(!weekly.ok && weekly.message).toBe("Haftalık kullanım hakkınızı tamamladınız. Kotanız 12 Ekim 2026 Pazartesi tarihinde yenilenecek.");
    expect((await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts(new Date("2026-10-11T21:00:00Z")))).ok).toBe(true); // Monday 00:00 TR

    await setOverride({ userId: teacher.id, feature: "AI_ASSISTANT_MESSAGE", periodType: "MONTHLY", limit: 1, unlimited: false, validUntil: null }, db);
    expect((await reserveUsage(user, "AI_ASSISTANT_MESSAGE", cid(), opts(now))).ok).toBe(true);
    const monthly = await reserveUsage(user, "AI_ASSISTANT_MESSAGE", cid(), opts(now));
    expect(!monthly.ok && monthly.message).toBe("Aylık DersBot kullanım hakkınızı tamamladınız. Kotanız 1 Kasım 2026 Pazar tarihinde yenilenecek.");
    expect(limitReachedMessage("AI_ASSISTANT_MESSAGE", "DAILY", new Date())).toBe("Bugünkü DersBot kullanım hakkınızı tamamladınız. Yeni hakkınız yarın yenilenecek.");
  });

  it("user override wins over the role default, expires, and can be unlimited", async () => {
    const { teacher } = await makeTeacher([]);
    const user = { id: teacher.id, role: "TEACHER" };
    await setOverride({ userId: teacher.id, feature: "AI_CONTENT_GENERATION", periodType: "DAILY", limit: 20, unlimited: false, validUntil: inDaysDate(2) }, db);
    expect(await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).toMatchObject({ source: "OVERRIDE", limit: 20 });
    // After validUntil the role default applies again.
    expect(await getQuotaStatus(db, user, "AI_CONTENT_GENERATION", inDaysDate(3))).toMatchObject({ source: "ROLE", limit: 10 });

    await setOverride({ userId: teacher.id, feature: "AI_CONTENT_GENERATION", periodType: "DAILY", limit: 0, unlimited: true, validUntil: null }, db);
    for (let i = 0; i < 15; i++) expect((await reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts())).ok).toBe(true);
    expect((await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).remaining).toBeNull();
  });

  it("admins are unlimited by default; inactive policies do not limit", async () => {
    const admin = await db.user.create({ data: { email: `admin-${Date.now()}@okul.test`, name: "Yönetici", role: "ADMIN", passwordHash: "x" } });
    expect(await getQuotaStatus(db, { id: admin.id, role: "ADMIN" }, "AI_CONTENT_GENERATION")).toMatchObject({ unlimited: true });
    await upsertPolicy({ role: "STUDENT", feature: "AI_ASSISTANT_MESSAGE", periodType: "DAILY", limit: 20, unlimited: false, isActive: false }, db);
    const s = await makeStudent([]);
    expect(await getQuotaStatus(db, { id: s.id, role: "STUDENT" }, "AI_ASSISTANT_MESSAGE")).toMatchObject({ unlimited: true, source: "NONE" });
    await upsertPolicy({ role: "STUDENT", feature: "AI_ASSISTANT_MESSAGE", periodType: "DAILY", limit: 20, unlimited: false, isActive: true }, db);
    expect(await getQuotaStatus(db, { id: s.id, role: "STUDENT" }, "AI_ASSISTANT_MESSAGE")).toMatchObject({ limit: 20, source: "ROLE" });
  });

  it("never lets parallel requests exceed the limit", async () => {
    const { teacher } = await makeTeacher([]);
    await setOverride({ userId: teacher.id, feature: "AI_CONTENT_GENERATION", periodType: "DAILY", limit: 3, unlimited: false, validUntil: null }, db);
    const user = { id: teacher.id, role: "TEACHER" };
    const results = await Promise.all(Array.from({ length: 8 }, () => reserveUsage(user, "AI_CONTENT_GENERATION", cid(), opts())));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).used).toBe(3);
  });

  it("is idempotent per correlation id and refunds exactly once", async () => {
    const s = await makeStudent([]);
    const user = { id: s.id, role: "STUDENT" };
    const id = cid();
    const first = await reserveUsage(user, "AI_ASSISTANT_MESSAGE", id, opts());
    const again = await reserveUsage(user, "AI_ASSISTANT_MESSAGE", id, opts());
    expect(first.ok && again.ok && again.alreadyCounted).toBe(true);
    expect((await getQuotaStatus(db, user, "AI_ASSISTANT_MESSAGE")).used).toBe(1);
    // Parallel duplicates of one message also count once.
    const dupId = cid();
    await Promise.all([1, 2, 3].map(() => reserveUsage(user, "AI_ASSISTANT_MESSAGE", dupId, opts())));
    expect((await getQuotaStatus(db, user, "AI_ASSISTANT_MESSAGE")).used).toBe(2);

    expect(await refundUsage(s.id, "AI_ASSISTANT_MESSAGE", id, db)).toBe(true);
    expect(await refundUsage(s.id, "AI_ASSISTANT_MESSAGE", id, db)).toBe(false);
    expect(await commitUsage(s.id, "AI_ASSISTANT_MESSAGE", id, db)).toBe(false); // refunded stays refunded
    expect((await getQuotaStatus(db, user, "AI_ASSISTANT_MESSAGE")).used).toBe(1);
    expect(await commitUsage(s.id, "AI_ASSISTANT_MESSAGE", dupId, db)).toBe(true);
    const history = await listUsageHistory(s.id, db);
    expect(history.map((h) => h.status).sort()).toEqual(["COMMITTED", "REFUNDED"]);
    expect(history.find((h) => h.status === "COMMITTED")!.remainingAfter).toBe(18);
  });

  it("refunds reservations of jobs that never finished", async () => {
    const s = await makeStudent([]);
    const user = { id: s.id, role: "STUDENT" };
    const past = new Date(Date.now() - 30 * 60_000);
    await reserveUsage(user, "AI_ASSISTANT_MESSAGE", cid(), opts(past));
    expect((await getQuotaStatus(db, user, "AI_ASSISTANT_MESSAGE", past)).used).toBe(1);
    expect(await refundStaleReservations(10 * 60_000, db)).toBeGreaterThanOrEqual(1);
    expect((await getQuotaStatus(db, user, "AI_ASSISTANT_MESSAGE", past)).used).toBe(0);
  });

  it("lets the admin report list every user and filter full quotas", async () => {
    const { teacher } = await makeTeacher([]);
    await setOverride({ userId: teacher.id, feature: "AI_CONTENT_GENERATION", periodType: "DAILY", limit: 1, unlimited: false, validUntil: null }, db);
    await reserveUsage({ id: teacher.id, role: "TEACHER" }, "AI_CONTENT_GENERATION", cid(), opts());
    const all = await adminUsageReport({ role: "TEACHER", search: teacher.email }, db);
    expect(all.map((r) => r.feature).sort()).toEqual(["AI_ASSISTANT_MESSAGE", "AI_CONTENT_GENERATION"]);
    const full = await adminUsageReport({ onlyFull: true, search: teacher.email }, db);
    expect(full).toHaveLength(1);
    expect(full[0]).toMatchObject({ feature: "AI_CONTENT_GENERATION", remaining: 0, source: "OVERRIDE" });
  });
});

describe("AI draft generation and quotas", () => {
  async function setup(limit = 2) {
    const { teacher, rooms } = await makeTeacher([{ name: "6/K", grade: 6 }]);
    await setOverride({ userId: teacher.id, feature: "AI_CONTENT_GENERATION", periodType: "DAILY", limit, unlimited: false, validUntil: null }, db);
    return { teacher, classroomId: rooms[0].id, user: { id: teacher.id, role: "TEACHER" } };
  }

  it("a successful draft uses one unit; failures and timeouts give it back", async () => {
    const { teacher, classroomId, user } = await setup(2);
    const ok = await generateStudyContent(teacher.id, await draftFor(teacher.id, classroomId), { scope: "ALL", questionCount: 5 }, { db, provider: new MockContentProvider() });
    expect(ok.ok).toBe(true);
    expect((await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).used).toBe(1);

    const timeout: ContentGenerationProvider = { name: "t", model: "m", async generatePreparationContent() { throw new ProviderError("TIMEOUT", "zaman aşımı"); } };
    const t = await generateStudyContent(teacher.id, await draftFor(teacher.id, classroomId), {}, { db, provider: timeout });
    expect(!t.ok && t.code).toBe("TIMEOUT");
    const failing: ContentGenerationProvider = { name: "f", model: "m", async generatePreparationContent() { throw new ProviderError("FAILED", "bağlantı"); } };
    const f = await generateStudyContent(teacher.id, await draftFor(teacher.id, classroomId), {}, { db, provider: failing });
    expect(f.ok).toBe(false);
    const invalid: ContentGenerationProvider = { name: "i", model: "m", async generatePreparationContent() { return { raw: { bozuk: true } }; } };
    expect((await generateStudyContent(teacher.id, await draftFor(teacher.id, classroomId), {}, { db, provider: invalid })).ok).toBe(false);
    expect((await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).used).toBe(1);
  });

  it("blocks generation with USAGE_LIMIT_REACHED before EVREN is called", async () => {
    const { teacher, classroomId } = await setup(1);
    await generateStudyContent(teacher.id, await draftFor(teacher.id, classroomId), {}, { db, provider: new MockContentProvider() });
    let calls = 0;
    const counting: ContentGenerationProvider = { name: "c", model: "m", async generatePreparationContent(input) { calls++; return new MockContentProvider().generatePreparationContent(input); } };
    const id = await draftFor(teacher.id, classroomId);
    const r = await startStudyContentGeneration(teacher.id, id, {}, { db, provider: counting });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.code).toBe("USAGE_LIMIT_REACHED");
      expect(r.errors._form[0]).toMatch(/yapay zekâ kullanım hakkınızı tamamladınız/);
    }
    expect(calls).toBe(0);
    // No dangling RUNNING job that would block a later attempt.
    expect(await db.contentGenerationLog.count({ where: { assignmentId: id, status: "RUNNING" } })).toBe(0);
  });

  it("a duplicate request for the same assignment does not use a second unit", async () => {
    const { teacher, classroomId, user } = await setup(5);
    const id = await draftFor(teacher.id, classroomId);
    const first = await startStudyContentGeneration(teacher.id, id, {}, { db, provider: new MockContentProvider() });
    const dup = await startStudyContentGeneration(teacher.id, id, {}, { db, provider: new MockContentProvider() });
    expect(first.ok).toBe(true);
    expect(!dup.ok && dup.code).toBe("IN_PROGRESS");
    expect((await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).used).toBe(1);
    if (first.ok) await first.data.run();
    expect((await getQuotaStatus(db, user, "AI_CONTENT_GENERATION")).used).toBe(1);
  });
});

describe("DersBot chat and quotas", () => {
  const env = { AI_PROVIDER: "evren", EVREN_LLM_BASE_URL: "https://llm.test/v1", EVREN_LLM_API_KEY: "k" } as unknown as NodeJS.ProcessEnv;

  it("reports whether EVREN answered (only then is the message counted)", async () => {
    const okFetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "Merhaba!" } }] }), { status: 200 })) as unknown as typeof fetch;
    const downFetch = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    expect(await chatWithAssistantDetailed("Görev nasıl oluşturulur?", { role: "TEACHER" }, { env, fetchImpl: okFetch })).toMatchObject({ source: "ai", text: "Merhaba!" });
    expect((await chatWithAssistantDetailed("Görev nasıl oluşturulur?", { role: "TEACHER" }, { env, fetchImpl: downFetch })).source).toBe("fallback");
    let called = false;
    const spy = (async () => ((called = true), new Response("{}"))) as unknown as typeof fetch;
    expect((await chatWithAssistantDetailed("Merhaba", { role: "GUEST" }, { env, allowAi: false, fetchImpl: spy })).source).toBe("fallback");
    expect(called).toBe(false);
  });

  it("enforces the student's daily DersBot quota", async () => {
    const s = await makeStudent([]);
    await setOverride({ userId: s.id, feature: "AI_ASSISTANT_MESSAGE", periodType: "DAILY", limit: 2, unlimited: false, validUntil: null }, db);
    const user = { id: s.id, role: "STUDENT" };
    for (let i = 0; i < 2; i++) {
      const id = cid();
      expect((await reserveUsage(user, "AI_ASSISTANT_MESSAGE", id, opts())).ok).toBe(true);
      await commitUsage(s.id, "AI_ASSISTANT_MESSAGE", id, db);
    }
    const blocked = await reserveUsage(user, "AI_ASSISTANT_MESSAGE", cid(), opts());
    expect(!blocked.ok && blocked.message).toBe("Bugünkü DersBot kullanım hakkınızı tamamladınız. Yeni hakkınız yarın yenilenecek.");
    // Another user's quota is untouched (each user only has their own counter).
    const other = await makeStudent([]);
    expect((await getQuotaStatus(db, { id: other.id, role: "STUDENT" }, "AI_ASSISTANT_MESSAGE")).used).toBe(0);
  });
});

function inDaysDate(d: number) {
  return new Date(Date.now() + d * 86_400_000);
}
