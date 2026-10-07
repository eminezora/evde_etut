// Teacher analytics and "Yarınki Derse Hazırlık Raporu" for one assignment.
// A fixed number of queries per report (no N+1): answer statistics use groupBy, and all rates are
// computed from real database rows. Question/outcome statistics use each student's LATEST
// submitted attempt; answers still awaiting teacher review are left out.

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";

// ---------------------------------------------------------------------------------------------
// Derived per-student state
// ---------------------------------------------------------------------------------------------

import { REPORT_STATUS_LABELS, type ReportStatus } from "./report-labels.ts";

export { REPORT_STATUS_LABELS, type ReportStatus };

export function reportStatus(
  sa: { status: string; latestScore: number | null; summaryOpenedAt: Date | null } | null,
  deadline: Date,
  now = new Date(),
): ReportStatus {
  if (sa?.status === "READY_FOR_CLASS") return "READY";
  if (sa?.status === "PENDING_TEACHER_REVIEW") return "PENDING_REVIEW";
  // A finished attempt below the threshold stays "needs review" even after the deadline.
  if (sa?.status === "NEEDS_REVIEW" || (sa?.status === "EXPIRED" && sa.latestScore !== null)) return "NEEDS_REVIEW";
  if (sa?.status === "EXPIRED" || deadline.getTime() <= now.getTime()) return "EXPIRED";
  if (!sa || sa.status === "NOT_STARTED") return "NOT_STARTED";
  return "IN_PROGRESS";
}

/** Questions/outcomes below this rate count as "struggled" (lists and recommendation). */
export const STRUGGLE_BELOW = 80;

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
const avg1 = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

// ---------------------------------------------------------------------------------------------
// Deterministic lesson recommendation (no AI)
// ---------------------------------------------------------------------------------------------

export function lessonRecommendation(readinessRate: number | null, weakestOutcome: { code: string; text: string; successRate: number | null } | null) {
  if (readinessRate === null) return null;
  const base =
    readinessRate >= 80
      ? "Sınıf genel olarak derse hazır. Derse kısa bir hatırlatmayla başlayabilirsiniz."
      : readinessRate >= 60
        ? "Sınıfın önemli bir bölümü hazır, ancak bazı temel kavramları kısa süre tekrar etmek faydalı olabilir."
        : "Sınıfın hazır bulunuşluğu düşük. Yeni konuya geçmeden önce temel kavramları tekrar etmeniz önerilir.";
  const focus =
    weakestOutcome && weakestOutcome.successRate !== null && weakestOutcome.successRate < STRUGGLE_BELOW
      ? `Özellikle ${weakestOutcome.code} (“${weakestOutcome.text}”) alanında zorlanma görülüyor (başarı %${weakestOutcome.successRate}).`
      : null;
  return { level: readinessRate >= 80 ? "high" : readinessRate >= 60 ? "medium" : "low", text: base, focus } as const;
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const SCORE_BUCKETS = [
  { label: "0–19", min: 0, max: 19 },
  { label: "20–39", min: 20, max: 39 },
  { label: "40–59", min: 40, max: 59 },
  { label: "60–79", min: 60, max: 79 },
  { label: "80–100", min: 80, max: 100 },
];

/** Returns null unless the assignment exists AND belongs to this teacher. */
export async function getAssignmentReport(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma, now = new Date()) {
  // 1. Assignment (ownership enforced in the query) + current classroom members.
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    select: {
      id: true,
      topic: true,
      subject: true,
      grade: true,
      unitOrTheme: true,
      minimumScore: true,
      deadline: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      classroomId: true,
      classroom: { select: { name: true, members: { select: { studentId: true, student: { select: { name: true } } } } } },
    },
  });
  if (!a) return null;

  // 2. Every student's progress row for this assignment.
  const sas = await db.studentAssignment.findMany({
    where: { assignmentId },
    select: {
      id: true,
      studentId: true,
      status: true,
      summaryOpenedAt: true,
      summaryConfirmedAt: true,
      startedAt: true,
      attemptCount: true,
      latestScore: true,
      bestScore: true,
      completedAt: true,
      attempts: { orderBy: { attemptNumber: "desc" }, take: 1, select: { earnedPoints: true, totalPoints: true } },
    },
  });
  const saByStudent = new Map(sas.map((s) => [s.studentId, s]));

  const students = a.classroom.members
    .map((m) => {
      const sa = saByStudent.get(m.studentId) ?? null;
      return {
        studentId: m.studentId,
        name: m.student.name,
        status: reportStatus(sa, a.deadline, now),
        summaryOpenedAt: sa?.summaryOpenedAt ?? null,
        summaryConfirmedAt: sa?.summaryConfirmedAt ?? null,
        startedAt: sa?.startedAt ?? null,
        detailedStatus: sa?.status ?? "NOT_STARTED",
        latestPoints: sa?.attempts[0] && sa.attempts[0].totalPoints ? { earned: sa.attempts[0].earnedPoints ?? 0, total: sa.attempts[0].totalPoints } : null,
        attemptCount: sa?.attemptCount ?? 0,
        latestScore: sa?.latestScore ?? null,
        bestScore: sa?.bestScore ?? null,
        completedAt: sa?.completedAt ?? null,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name, "tr"));
  const count = (f: (s: (typeof students)[number]) => boolean) => students.filter(f).length;

  const assigned = students.length;
  const ready = count((s) => s.status === "READY");
  const needsReview = count((s) => s.status === "NEEDS_REVIEW");
  const pending = count((s) => s.status === "PENDING_REVIEW");
  // "Completed" = has a final result (READY or NEEDS_REVIEW); awaiting review is counted separately.
  const completed = ready + needsReview;
  const totals = {
    assigned,
    started: count((s) => s.summaryOpenedAt !== null),
    summaryConfirmed: count((s) => s.summaryConfirmedAt !== null),
    assessmentStarted: count((s) => s.attemptCount > 0),
    completed,
    ready,
    needsReview,
    pending,
    notStarted: count((s) => s.status === "NOT_STARTED"),
    inProgress: count((s) => s.status === "IN_PROGRESS"),
    expired: count((s) => s.status === "EXPIRED"),
    notCompleted: assigned - completed - pending,
    // Two different denominators – shown separately in the UI.
    readinessRate: pct(ready, assigned),
    readinessAmongCompleted: pct(ready, completed),
    // latestScore/bestScore are only set when an attempt is finalized, so attempts awaiting
    // teacher review never enter these averages.
    averageLatestScore: avg1(students.filter((s) => s.latestScore !== null && s.status !== "PENDING_REVIEW").map((s) => s.latestScore!)),
    averageBestScore: avg1(students.filter((s) => s.bestScore !== null).map((s) => s.bestScore!)),
    averageAttempts: avg1(students.filter((s) => s.attemptCount > 0).map((s) => s.attemptCount)),
  };

  const scoreDistribution = SCORE_BUCKETS.map((b) => ({
    label: b.label,
    count: students.filter((s) => s.latestScore !== null && s.status !== "PENDING_REVIEW" && s.latestScore >= b.min && s.latestScore <= b.max).length,
  }));
  const statusDistribution = (Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((k) => ({ status: k, label: REPORT_STATUS_LABELS[k], count: count((s) => s.status === k) }));

  // 3. Latest submitted attempt per student (one query, reduced in memory).
  const attempts = await db.attempt.findMany({
    where: { studentAssignment: { assignmentId }, status: { in: ["COMPLETED", "PENDING_TEACHER_REVIEW"] } },
    select: { id: true, studentAssignmentId: true, attemptNumber: true },
  });
  const latestBySa = new Map<string, { id: string; attemptNumber: number }>();
  for (const t of attempts) {
    const cur = latestBySa.get(t.studentAssignmentId);
    if (!cur || t.attemptNumber > cur.attemptNumber) latestBySa.set(t.studentAssignmentId, t);
  }
  const latestIds = [...latestBySa.values()].map((t) => t.id);

  // 4–5. Answer statistics per question (groupBy, scored answers only) + questions with outcomes.
  const scored = { attemptId: { in: latestIds }, reviewStatus: { in: ["AUTO_SCORED", "REVIEWED", "UNANSWERED"] } };
  const [allStats, correctStats, questions] = await Promise.all([
    latestIds.length ? db.answer.groupBy({ by: ["questionId"], where: scored, _count: { _all: true }, _sum: { awardedPoints: true } }) : Promise.resolve([]),
    latestIds.length ? db.answer.groupBy({ by: ["questionId"], where: { ...scored, isCorrect: true }, _count: { _all: true } }) : Promise.resolve([]),
    db.question.findMany({
      where: { assignmentId },
      orderBy: { orderNum: "asc" },
      select: { id: true, type: true, questionText: true, points: true, outcomes: { select: { outcome: { select: { outcomeCode: true, outcomeText: true } } } } },
    }),
  ]);
  const totalBy = new Map(allStats.map((s) => [s.questionId, { n: s._count._all, sum: s._sum.awardedPoints ?? 0 }]));
  const correctBy = new Map(correctStats.map((s) => [s.questionId, s._count._all]));

  const questionStats = questions.map((q, i) => {
    const t = totalBy.get(q.id) ?? { n: 0, sum: 0 };
    const correct = correctBy.get(q.id) ?? 0;
    return {
      number: i + 1,
      questionId: q.id,
      type: q.type,
      text: q.questionText,
      points: q.points,
      answered: t.n,
      correct,
      incorrect: t.n - correct,
      correctRate: pct(correct, t.n),
      averagePoints: t.n ? Math.round((t.sum / t.n) * 10) / 10 : null,
      outcomeCodes: q.outcomes.map((o) => o.outcome.outcomeCode),
    };
  });

  // Outcome success = points earned / points possible over the answers of its linked questions.
  const outcomeMap = new Map<string, { code: string; text: string; questions: number; earned: number; possible: number; correct: number; answers: number }>();
  for (const q of questions) {
    const t = totalBy.get(q.id) ?? { n: 0, sum: 0 };
    for (const { outcome } of q.outcomes) {
      const o = outcomeMap.get(outcome.outcomeCode) ?? { code: outcome.outcomeCode, text: outcome.outcomeText, questions: 0, earned: 0, possible: 0, correct: 0, answers: 0 };
      o.questions += 1;
      o.earned += t.sum;
      o.possible += t.n * q.points;
      o.correct += correctBy.get(q.id) ?? 0;
      o.answers += t.n;
      outcomeMap.set(o.code, o);
    }
  }
  const outcomeStats = [...outcomeMap.values()]
    .map((o) => ({ code: o.code, text: o.text, questionCount: o.questions, answers: o.answers, successRate: pct(o.earned, o.possible), correctRate: pct(o.correct, o.answers) }))
    .sort((x, y) => x.code.localeCompare(y.code, "tr", { numeric: true }));

  const answeredQuestions = questionStats.filter((q) => q.correctRate !== null);
  // Ties: lower average points first.
  const pointsRatio = (q: (typeof questionStats)[number]) => (q.averagePoints ?? 0) / q.points;
  const hardestQuestions = answeredQuestions
    .filter((q) => q.correctRate! < STRUGGLE_BELOW)
    .sort((x, y) => x.correctRate! - y.correctRate! || pointsRatio(x) - pointsRatio(y) || x.number - y.number)
    .slice(0, 3);
  const measuredOutcomes = outcomeStats.filter((o) => o.successRate !== null);
  const weakestOutcomes = [...measuredOutcomes].sort((x, y) => x.successRate! - y.successRate!).filter((o) => o.successRate! < STRUGGLE_BELOW).slice(0, 3);
  const weakest = weakestOutcomes[0] ?? null;

  const hasData = completed + pending > 0;
  const trend = await readinessTrend(db, a.classroomId, a.subject, assigned, now);

  return {
    assignment: {
      id: a.id,
      topic: a.topic,
      subject: a.subject,
      grade: a.grade,
      unitOrTheme: a.unitOrTheme,
      classroom: a.classroom.name,
      minimumScore: a.minimumScore,
      deadline: a.deadline,
      status: a.status,
    },
    hasData,
    totals,
    students,
    statusDistribution,
    scoreDistribution,
    questionStats,
    hardestQuestions,
    outcomeStats,
    weakestOutcomes,
    recommendation: hasData ? lessonRecommendation(totals.readinessRate, weakest) : null,
    briefing: {
      hardestOutcome: weakest,
      hardestQuestion: hardestQuestions[0] ?? null,
    },
    trend,
  };
}

/**
 * Readiness rate of the published assignments of the same classroom + subject, oldest first.
 * Uses the current class size as the denominator for every assignment. Two queries in total.
 */
async function readinessTrend(db: PrismaClient, classroomId: string, subject: string, classSize: number, now: Date) {
  const list = await db.assignment.findMany({
    where: { classroomId, subject, status: "PUBLISHED", archivedAt: null },
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, topic: true, publishedAt: true, deadline: true },
  });
  if (list.length < 2 || classSize === 0) return [];
  const ready = await db.studentAssignment.groupBy({
    by: ["assignmentId"],
    where: { assignmentId: { in: list.map((x) => x.id) }, status: "READY_FOR_CLASS" },
    _count: { _all: true },
  });
  const readyBy = new Map(ready.map((r) => [r.assignmentId, r._count._all]));
  return list.map((x, i) => ({
    assignmentId: x.id,
    label: `Görev ${i + 1}`,
    topic: x.topic,
    date: x.publishedAt ?? x.deadline,
    readinessRate: pct(readyBy.get(x.id) ?? 0, classSize) ?? 0,
    open: x.deadline.getTime() > now.getTime(),
  }));
}

export type AssignmentReport = NonNullable<Awaited<ReturnType<typeof getAssignmentReport>>>;

// ---------------------------------------------------------------------------------------------
// CSV export (no e-mail, password or token columns)
// ---------------------------------------------------------------------------------------------

function csvCell(v: string | number | null) {
  let s = v === null ? "" : String(v);
  // Neutralise spreadsheet formula injection from user-entered names.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report: AssignmentReport) {
  const header = ["Öğrenci", "Durum", "Deneme sayısı", "Son puan", "En iyi puan", "Özeti onayladı", "Tamamlanma zamanı"];
  const rows = report.students.map((s) => [
    s.name,
    REPORT_STATUS_LABELS[s.status],
    s.attemptCount,
    s.latestScore,
    s.bestScore,
    s.summaryConfirmedAt ? "Evet" : "Hayır",
    s.completedAt ? s.completedAt.toISOString() : null,
  ]);
  // BOM so spreadsheet apps read the Turkish characters as UTF-8.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
