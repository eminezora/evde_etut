// Imports the validated normalized MEB dataset into CurriculumOutcome / CurriculumOutcomeUnit.
// Idempotent: keyed by subject + grade + outcomeCode, re-running updates fields in place and
// never creates duplicates. Nothing is deleted: outcomes that disappeared from the dataset are
// only marked NOT_IN_DATASET (they may still be referenced by assignments).

import type { Prisma, PrismaClient } from "@prisma/client";
import type { OutcomeRecord } from "./curriculum-config.ts";

export interface SeedStats {
  datasetRecords: number;
  skippedRecords: number;
  outcomes: number;
  created: number;
  updated: number;
  unitLinks: number;
  removedUnitLinks: number;
  markedNotInDataset: number;
  byGrade: Record<number, number>;
  byStatus: Record<string, number>;
}

const keyOf = (subject: string, grade: number, code: string) => `${subject}|${grade}|${code}`;
const CHUNK = 100;
// Theme links are written in small batches: one large batch can exceed a hosted database's
// transaction time limit and stop the import half way (outcomes saved, themes missing).
const LINK_CHUNK = 20;

interface GroupedOutcome {
  primary: OutcomeRecord;
  reviewStatus: "VERIFIED" | "REVIEW_REQUIRED";
  reviewReasons: string[];
  units: { unitOrTheme: string; unitOrThemeCode: string | null; sourceUrl: string; unitOrder: number; outcomeOrder: number }[];
}

/** Collapse dataset records (one per theme occurrence) into one outcome with its list of themes. */
export function groupDataset(records: OutcomeRecord[]) {
  const groups = new Map<string, GroupedOutcome>();
  const unitOrder = new Map<string, number>(); // grade|subject|unit -> order of first appearance
  const outcomeCounter = new Map<string, number>(); // grade|subject|unit -> next outcome position
  let skipped = 0;

  for (const r of records) {
    if (!r.outcomeCode || !r.outcomeText || r.grade == null || !r.unitOrTheme || !r.sourceUrl) {
      skipped++;
      continue;
    }
    const subjectKey = `${r.grade}|${r.subject}`;
    const unitKey = `${subjectKey}|${r.unitOrTheme}`;
    if (!unitOrder.has(unitKey)) {
      const sameSubject = [...unitOrder.keys()].filter((k) => k.startsWith(`${subjectKey}|`)).length;
      unitOrder.set(unitKey, sameSubject);
    }
    const position = outcomeCounter.get(unitKey) ?? 0;
    outcomeCounter.set(unitKey, position + 1);

    const key = keyOf(r.subject, r.grade, r.outcomeCode);
    let g = groups.get(key);
    if (!g) {
      g = { primary: r, reviewStatus: "VERIFIED", reviewReasons: [], units: [] };
      groups.set(key, g);
    }
    // Conservative: one REVIEW_REQUIRED occurrence makes the whole outcome REVIEW_REQUIRED.
    if (r.reviewStatus !== "VERIFIED") g.reviewStatus = "REVIEW_REQUIRED";
    for (const reason of r.reviewReasons) if (!g.reviewReasons.includes(reason)) g.reviewReasons.push(reason);
    if (!g.units.some((u) => u.unitOrTheme === r.unitOrTheme)) {
      g.units.push({
        unitOrTheme: r.unitOrTheme,
        unitOrThemeCode: r.unitOrThemeCode,
        sourceUrl: r.sourceUrl,
        unitOrder: unitOrder.get(unitKey)!,
        outcomeOrder: position,
      });
    }
  }
  return { groups, skipped };
}

function outcomeData(g: GroupedOutcome) {
  const r = g.primary;
  return {
    subject: r.subject,
    grade: r.grade!,
    unitOrTheme: r.unitOrTheme,
    unitOrThemeCode: r.unitOrThemeCode,
    outcomeCode: r.outcomeCode!,
    outcomeCodeAsPrinted: r.outcomeCodeAsPrinted,
    outcomeText: r.outcomeText!,
    outcomeGroup: r.outcomeGroup,
    processComponents: r.processComponents,
    learningArea: r.learningArea,
    skills: r.skills,
    conceptualSkills: r.conceptualSkills,
    values: r.values,
    literacySkills: r.literacySkills,
    sourceUrl: r.sourceUrl,
    sourceTitle: r.sourceTitle,
    sourceFetchedAt: r.sourceFetchedAt ? new Date(r.sourceFetchedAt) : null,
    reviewStatus: g.reviewStatus,
    reviewReasons: g.reviewReasons,
  } satisfies Prisma.CurriculumOutcomeCreateInput;
}

export async function seedCurriculum(
  prisma: PrismaClient,
  records: OutcomeRecord[],
  onProgress?: (phase: "outcomes" | "units", done: number, total: number) => void,
): Promise<SeedStats> {
  const { groups, skipped } = groupDataset(records);
  const existing = await prisma.curriculumOutcome.findMany({ select: { id: true, subject: true, grade: true, outcomeCode: true } });
  const existingKeys = new Set(existing.map((e) => keyOf(e.subject, e.grade, e.outcomeCode)));

  const entries = [...groups.entries()];
  const idByKey = new Map<string, string>();
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const rows = await prisma.$transaction(
      chunk.map(([, g]) => {
        const data = outcomeData(g);
        return prisma.curriculumOutcome.upsert({
          where: { subject_grade_outcomeCode: { subject: data.subject, grade: data.grade, outcomeCode: data.outcomeCode } },
          create: data,
          update: data,
          select: { id: true, subject: true, grade: true, outcomeCode: true },
        });
      }),
    );
    for (const row of rows) idByKey.set(keyOf(row.subject, row.grade, row.outcomeCode), row.id);
    onProgress?.("outcomes", Math.min(i + CHUNK, entries.length), entries.length);
  }

  // Theme/unit links: upsert the current ones, drop links the dataset no longer has.
  let unitLinks = 0;
  let removedUnitLinks = 0;
  for (let i = 0; i < entries.length; i += LINK_CHUNK) {
    const chunk = entries.slice(i, i + LINK_CHUNK);
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const [key, g] of chunk) {
      const outcomeId = idByKey.get(key)!;
      for (const u of g.units) {
        const data = { grade: g.primary.grade!, subject: g.primary.subject, ...u };
        ops.push(
          prisma.curriculumOutcomeUnit.upsert({
            where: { outcomeId_unitOrTheme: { outcomeId, unitOrTheme: u.unitOrTheme } },
            create: { outcomeId, ...data },
            update: data,
          }),
        );
        unitLinks++;
      }
      ops.push(prisma.curriculumOutcomeUnit.deleteMany({ where: { outcomeId, unitOrTheme: { notIn: g.units.map((u) => u.unitOrTheme) } } }));
    }
    const results = await prisma.$transaction(ops);
    for (const res of results) if (res && typeof res === "object" && "count" in res) removedUnitLinks += (res as { count: number }).count;
    onProgress?.("units", Math.min(i + LINK_CHUNK, entries.length), entries.length);
  }

  // Outcomes in the DB that are not in the dataset any more: hide them, never delete.
  const stale = existing.filter((e) => !groups.has(keyOf(e.subject, e.grade, e.outcomeCode))).map((e) => e.id);
  const marked = stale.length
    ? (await prisma.curriculumOutcome.updateMany({ where: { id: { in: stale } }, data: { reviewStatus: "NOT_IN_DATASET" } })).count
    : 0;

  const byGrade: Record<number, number> = {};
  const byStatus: Record<string, number> = {};
  for (const g of groups.values()) {
    byGrade[g.primary.grade!] = (byGrade[g.primary.grade!] ?? 0) + 1;
    byStatus[g.reviewStatus] = (byStatus[g.reviewStatus] ?? 0) + 1;
  }
  const created = [...groups.keys()].filter((k) => !existingKeys.has(k)).length;
  return {
    datasetRecords: records.length,
    skippedRecords: skipped,
    outcomes: groups.size,
    created,
    updated: groups.size - created,
    unitLinks,
    removedUnitLinks,
    markedNotInDataset: marked,
    byGrade,
    byStatus,
  };
}
