// Read access to the MEB curriculum tables. Components and route handlers use these functions
// instead of querying Prisma directly. Only VERIFIED outcomes are returned unless a caller
// explicitly opts in with { includeUnverified: true } (never used by the teacher flow).

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";

export const SELECTABLE_STATUS = "VERIFIED";

export interface CurriculumQueryOptions {
  includeUnverified?: boolean;
  db?: PrismaClient;
}

export interface OutcomeSummary {
  id: string;
  subject: string;
  grade: number;
  outcomeCode: string;
  outcomeText: string;
  unitOrTheme: string | null;
  processComponents: string[];
  sourceUrl: string;
  sourceTitle: string | null;
  reviewStatus: string;
}

const statusFilter = (o: CurriculumQueryOptions) => (o.includeUnverified ? {} : { reviewStatus: SELECTABLE_STATUS });

const outcomeSelect = {
  id: true,
  subject: true,
  grade: true,
  outcomeCode: true,
  outcomeText: true,
  unitOrTheme: true,
  processComponents: true,
  sourceUrl: true,
  sourceTitle: true,
  reviewStatus: true,
} as const;

type SelectedOutcome = { processComponents: unknown } & Omit<OutcomeSummary, "processComponents">;

const toSummary = (o: SelectedOutcome): OutcomeSummary => ({
  ...o,
  processComponents: Array.isArray(o.processComponents) ? (o.processComponents as string[]) : [],
});

export async function getAvailableGrades(opts: CurriculumQueryOptions = {}): Promise<number[]> {
  const db = opts.db ?? defaultPrisma;
  const rows = await db.curriculumOutcome.findMany({ where: statusFilter(opts), distinct: ["grade"], select: { grade: true }, orderBy: { grade: "asc" } });
  return rows.map((r) => r.grade);
}

export async function getSubjectsByGrade(grade: number, opts: CurriculumQueryOptions = {}): Promise<string[]> {
  const db = opts.db ?? defaultPrisma;
  const rows = await db.curriculumOutcome.findMany({
    where: { grade, ...statusFilter(opts) },
    distinct: ["subject"],
    select: { subject: true },
    orderBy: { subject: "asc" },
  });
  return rows.map((r) => r.subject).sort((a, b) => a.localeCompare(b, "tr"));
}

/** Themes/units (in MEB page order) that contain at least one selectable outcome. */
export async function getUnitsByGradeAndSubject(grade: number, subject: string, opts: CurriculumQueryOptions = {}) {
  const db = opts.db ?? defaultPrisma;
  const rows = await db.curriculumOutcomeUnit.findMany({
    where: { grade, subject, outcome: statusFilter(opts) },
    distinct: ["unitOrTheme"],
    select: { unitOrTheme: true, unitOrThemeCode: true, unitOrder: true },
    orderBy: [{ unitOrder: "asc" }, { unitOrTheme: "asc" }],
  });
  return rows.map((r) => ({ unitOrTheme: r.unitOrTheme, unitOrThemeCode: r.unitOrThemeCode }));
}

/** Outcomes listed under a theme/unit, in MEB page order. */
export async function getOutcomes(
  { grade, subject, unitOrTheme }: { grade: number; subject: string; unitOrTheme: string },
  opts: CurriculumQueryOptions = {},
): Promise<OutcomeSummary[]> {
  const db = opts.db ?? defaultPrisma;
  const links = await db.curriculumOutcomeUnit.findMany({
    where: { grade, subject, unitOrTheme, outcome: statusFilter(opts) },
    orderBy: { outcomeOrder: "asc" },
    select: { outcome: { select: outcomeSelect } },
  });
  return links.map((l) => toSummary(l.outcome));
}

export async function getOutcomeById(id: string, opts: CurriculumQueryOptions = {}): Promise<OutcomeSummary | null> {
  const db = opts.db ?? defaultPrisma;
  const o = await db.curriculumOutcome.findFirst({ where: { id, ...statusFilter(opts) }, select: outcomeSelect });
  return o ? toSummary(o) : null;
}

export async function getOutcomesByIds(ids: string[], opts: CurriculumQueryOptions = {}): Promise<OutcomeSummary[]> {
  const db = opts.db ?? defaultPrisma;
  if (!ids.length) return [];
  const rows = await db.curriculumOutcome.findMany({ where: { id: { in: ids }, ...statusFilter(opts) }, select: outcomeSelect });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map(toSummary).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** True when the outcome is listed under the given theme/unit (Türkçe outcomes can be under several). */
export async function isOutcomeInUnit(outcomeId: string, unitOrTheme: string, db: PrismaClient = defaultPrisma) {
  return (await db.curriculumOutcomeUnit.count({ where: { outcomeId, unitOrTheme } })) > 0;
}
