// Live EVREN LLM test – real API, no mocks. Runs only with `npm run test:evren` (EVREN_LIVE=1),
// using the EVREN_* settings from .env.local / .env. Spends a few API credits. The API key is
// never printed.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getContentProvider } from "../src/lib/ai/index.ts";
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";
import { approveAndPublish, generateStudyContent, getStudentAssignment, publishAssignment } from "../src/lib/content/content-service.ts";
import { db, ensureCurriculum, inDays, makeStudent, makeTeacher } from "./helpers.ts";

const LIVE = process.env.EVREN_LIVE === "1";
if (LIVE) {
  // .env.local wins over .env; empty values (e.g. placeholders loaded by Prisma) are filled in.
  for (const f of [".env.local", ".env"]) {
    let vars: Record<string, string | undefined> = {};
    try {
      vars = parseEnv(readFileSync(f, "utf8"));
    } catch {
      continue;
    }
    for (const [k, v] of Object.entries(vars)) if (!process.env[k] && v) process.env[k] = v;
  }
}

describe.skipIf(!LIVE)("EVREN LLM (live)", () => {
  beforeAll(ensureCurriculum);
  afterAll(() => db.$disconnect());

  it("generates a MEB-grounded draft with the configured model, and it stays unpublished until approved", async () => {
    const provider = getContentProvider(process.env);
    expect(provider?.name).toBe("evren");
    console.log(`[evren] model: ${provider!.model}`);

    const { teacher, rooms } = await makeTeacher([{ name: "5/E", grade: 5 }]);
    const student = await makeStudent([rooms[0].id]);
    const outcomes = await db.curriculumOutcome.findMany({ where: { grade: 5, subject: "Fen Bilimleri", outcomeCode: { in: ["FB.5.1.1", "FB.5.1.2"] }, reviewStatus: "VERIFIED" }, include: { units: true } });
    const created = await createAssignment(
      teacher.id,
      { classroomId: rooms[0].id, subject: "Fen Bilimleri", unitOrTheme: outcomes[0].units[0].unitOrTheme, topic: "Güneş ve Ay", outcomeIds: outcomes.map((o) => o.id), minimumScore: 70, deadline: inDays(5), questionCount: 6 },
      db,
    );
    if (!created.ok) throw new Error(JSON.stringify(created.errors));
    const id = created.data.id;

    const started = Date.now();
    const res = await generateStudyContent(teacher.id, id, { scope: "ALL" }, { db, provider, timeoutMs: 240_000 });
    const log = await db.contentGenerationLog.findFirst({ where: { assignmentId: id }, orderBy: { startedAt: "desc" } });
    console.log(`[evren] ${log?.status} in ${Math.round((Date.now() - started) / 1000)} s, tokens in/out: ${log?.inputTokens}/${log?.outputTokens}${log?.errorMessage ? `, issues: ${log.errorMessage}` : ""}`);
    expect(res.ok).toBe(true);

    const content = await db.studyContent.findUniqueOrThrow({ where: { assignmentId: id } });
    expect(content).toMatchObject({ status: "AI_GENERATED_DRAFT", generatedBy: "AI", aiModel: provider!.model });
    const questions = await db.question.findMany({ where: { assignmentId: id }, orderBy: { orderNum: "asc" }, include: { outcomes: { include: { outcome: true } } } });
    expect(questions).toHaveLength(6);
    const allowed = new Set(["FB.5.1.1", "FB.5.1.2"]);
    for (const q of questions) {
      expect(q.outcomes.length).toBeGreaterThan(0);
      for (const o of q.outcomes) expect(allowed.has(o.outcome.outcomeCode)).toBe(true);
    }

    // Draft: not publishable without approval, invisible to the student.
    expect((await publishAssignment(teacher.id, id, db)).ok).toBe(false);
    expect(await getStudentAssignment(student.id, id, db)).toBeNull();
    expect((await approveAndPublish(teacher.id, id, db)).ok).toBe(true);
    expect(await getStudentAssignment(student.id, id, db)).not.toBeNull();

    // Printed for human review of grounding and tone.
    const concepts = (content.keyConcepts as { term: string }[]).map((k) => k.term).join(", ");
    console.log(`[evren] giriş: ${content.introduction}\n[evren] kavramlar: ${concepts}\n[evren] özet: ${content.summary.slice(0, 600)}\n[evren] bilmen yeterli: ${(content.mustKnow as string[]).join(" | ")}`);
    for (const q of questions) console.log(`[evren] ${q.orderNum}. ${q.type} [${q.outcomes.map((o) => o.outcome.outcomeCode).join(",")}] ${q.questionText}`);
  }, 300_000);
});
