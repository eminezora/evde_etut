// Read-only verification of the curriculum tables against data/curriculum/normalized/all-middle-school.json.
// Writes nothing to the database. Use it before and after `npm run curriculum` on any database:
//
//   npm run curriculum:report                 # the database in DATABASE_URL / .env
//   npm run curriculum:report -- --json out.json
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { CURRICULUM_DIR, type OutcomeRecord } from "../src/lib/curriculum/curriculum-config.ts";
import { groupDataset } from "../src/lib/curriculum/seed-curriculum.ts";

const dataset: { outcomes: OutcomeRecord[] } = JSON.parse(await readFile(`${CURRICULUM_DIR}/normalized/all-middle-school.json`, "utf8"));
const { groups, skipped } = groupDataset(dataset.outcomes);
const unparseable = dataset.outcomes
  .filter((r) => !r.outcomeCode || !r.outcomeText || r.grade == null || !r.unitOrTheme || !r.sourceUrl)
  .map((r) => ({ grade: r.grade, subject: r.subject, unitOrTheme: r.unitOrTheme, outcomeCode: r.outcomeCode, sourceUrl: r.sourceUrl }));

const key = (subject: string, grade: number, code: string) => `${subject}|${grade}|${code}`;
const prisma = new PrismaClient();
try {
  const rows = await prisma.curriculumOutcome.findMany({
    select: { grade: true, subject: true, outcomeCode: true, sourceUrl: true, reviewStatus: true, units: { select: { unitOrTheme: true } } },
  });
  const inDb = new Map(rows.map((r) => [key(r.subject, r.grade, r.outcomeCode), r]));

  const perGrade: Record<number, { outcomes: number; selectable: number; subjects: Record<string, { outcomes: number; selectable: number; units: number }> }> = {};
  for (const r of rows) {
    const g = (perGrade[r.grade] ??= { outcomes: 0, selectable: 0, subjects: {} });
    const s = (g.subjects[r.subject] ??= { outcomes: 0, selectable: 0, units: 0 });
    g.outcomes++;
    s.outcomes++;
    if (r.reviewStatus === "VERIFIED") {
      g.selectable++;
      s.selectable++;
    }
  }
  const unitRows = await prisma.curriculumOutcomeUnit.findMany({ distinct: ["grade", "subject", "unitOrTheme"], select: { grade: true, subject: true } });
  for (const u of unitRows) {
    const s = perGrade[u.grade]?.subjects[u.subject];
    if (s) s.units++;
  }

  const missingInDb = [...groups.entries()].filter(([k]) => !inDb.has(k)).map(([, g]) => `${g.primary.grade}. sınıf ${g.primary.subject} ${g.primary.outcomeCode}`);
  // Outcome linked to a theme/unit the dataset does not list it under (wrong subject/unit placement).
  const misplaced: string[] = [];
  for (const [k, g] of groups) {
    const r = inDb.get(k);
    if (!r) continue;
    const expected = new Set(g.units.map((u) => u.unitOrTheme));
    for (const u of r.units) if (!expected.has(u.unitOrTheme)) misplaced.push(`${r.grade}. sınıf ${r.subject} ${r.outcomeCode} → ${u.unitOrTheme}`);
  }
  const dbKeys = rows.map((r) => key(r.subject, r.grade, r.outcomeCode));
  const report = {
    generatedAt: new Date().toISOString(),
    perGrade,
    totals: {
      dbOutcomes: rows.length,
      datasetOutcomes: groups.size,
      duplicatesInDb: dbKeys.length - new Set(dbKeys).size,
      withoutSourceUrl: rows.filter((r) => !r.sourceUrl?.startsWith("https://tymm.meb.gov.tr/")).length,
      notInDataset: rows.filter((r) => r.reviewStatus === "NOT_IN_DATASET").length,
      missingInDb: missingInDb.length,
      misplacedUnitLinks: misplaced.length,
      outcomesWithoutUnit: rows.filter((r) => r.units.length === 0).length,
      unparseableDatasetRecords: skipped,
    },
    missingInDb: missingInDb.slice(0, 200),
    misplacedUnitLinks: misplaced.slice(0, 200),
    unparseableDatasetRecords: unparseable,
  };

  console.log("MÜFREDAT DOĞRULAMA RAPORU (salt okunur)");
  for (const [grade, g] of Object.entries(perGrade)) {
    console.log(`\n${grade}. sınıf: ${g.outcomes} çıktı (${g.selectable} seçilebilir)`);
    for (const [subject, s] of Object.entries(g.subjects)) console.log(`  ${subject.padEnd(38)} ${String(s.outcomes).padStart(4)} çıktı · ${s.selectable} seçilebilir · ${s.units} tema/ünite`);
  }
  console.log("\nÖzet:", JSON.stringify(report.totals, null, 2));
  const noUnit = report.totals.outcomesWithoutUnit;
  if (noUnit) console.log(`\n${noUnit} çıktının tema/ünite bağlantısı yok; öğretmen bunları seçemez.\n→ Düzeltmek için: npm run curriculum`);
  if (missingInDb.length) console.log(`\nVeritabanında eksik (ilk 20): ${missingInDb.slice(0, 20).join(", ")}\n→ Eksikleri eklemek için: npm run curriculum`);
  const out = process.argv.indexOf("--json");
  if (out > -1 && process.argv[out + 1]) await writeFile(process.argv[out + 1], JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
