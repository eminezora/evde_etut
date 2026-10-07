// Shared fixtures for assessment/analytics tests: a published assignment with an enrolled student.
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";
import { addQuestion, approveAndPublish, saveStudyContent } from "../src/lib/content/content-service.ts";
import { confirmSummary, openSummary, startAttempt, submitAttempt } from "../src/lib/assessment/student-assessment-service.ts";
import { db, inDays, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

const content = {
  introduction: "Giriş",
  keyConcepts: [{ term: "Güneş", explanation: "Bir yıldız" }],
  summary: "Özet",
  simpleExample: "Örnek",
  mustKnow: ["a", "b", "c"],
};

// Question set: index → [type, payload]; MC(10) + TF(10) + FILL(10) + MATCH(10) + ORDER(10) = 50 pts objective.
export const objective = (code: string) => [
  { type: "MULTIPLE_CHOICE", questionText: "Güneş nedir?", options: ["Gezegen", "Yıldız", "Uydu", "Kuyruklu yıldız"], correctAnswer: "Yıldız", explanation: "Güneş bir yıldızdır.", points: 10, curriculumOutcomeCodes: [code] },
  { type: "TRUE_FALSE", questionText: "Güneş ısı verir.", correctAnswer: true, points: 10, curriculumOutcomeCodes: [code] },
  { type: "FILL_IN_THE_BLANK", questionText: "Güneş bir ____ dır.", correctAnswer: "Yıldız", acceptableAnswers: ["yildiz"], points: 10, curriculumOutcomeCodes: [code] },
  { type: "MATCHING", questionText: "Eşleştir", pairs: [{ left: "Güneş", right: "Yıldız" }, { left: "Ay", right: "Uydu" }], points: 10, curriculumOutcomeCodes: [code] },
  { type: "ORDERING", questionText: "Sırala", items: ["İki", "Üç", "Bir"], correctOrder: [2, 0, 1], points: 10, curriculumOutcomeCodes: [code] },
];
export const openQuestion = (code: string) => ({ type: "SHORT_ANSWER", questionText: "Güneş'i bir cümleyle anlat.", sampleAnswer: "Işık ve ısı veren yıldız.", points: 50, curriculumOutcomeCodes: [code] });

/** Published assignment with an enrolled student. */
export async function published({ withOpen = false, minimumScore = 70, deadlineDays = 7, maxAttempts = 3 } = {}) {
  const { teacher, rooms } = await makeTeacher([{ name: "5/A", grade: 5 }]);
  const student = await makeStudent([rooms[0].id]);
  const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(5, "Fen Bilimleri");
  const res = await createAssignment(teacher.id, { classroomId: rooms[0].id, subject: "Fen Bilimleri", unitOrTheme, topic: "Güneş", outcomeIds: [outcomes[0].id], minimumScore, deadline: inDays(7) }, db);
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  const id = res.data.id;
  await saveStudyContent(teacher.id, id, content, db);
  for (const q of objective(outcomes[0].outcomeCode)) await addQuestion(teacher.id, id, q, db);
  if (withOpen) await addQuestion(teacher.id, id, openQuestion(outcomes[0].outcomeCode), db);
  const pub = await approveAndPublish(teacher.id, id, db);
  if (!pub.ok) throw new Error(JSON.stringify(pub));
  await db.assignment.update({ where: { id }, data: { maxAttempts, deadline: inDays(deadlineDays) } });
  const questions = await db.question.findMany({ where: { assignmentId: id }, orderBy: { orderNum: "asc" } });
  return { teacher, student, classroom: rooms[0], assignmentId: id, questions, outcome: outcomes[0] };
}

/** Correct student-facing answers for the objective set, computed from the stored (shown) data. */
export function correctAnswers(questions: { id: string; type: string; data: unknown }[]) {
  return questions.map((q) => {
    const d = q.data as Record<string, never>;
    switch (q.type) {
      case "MULTIPLE_CHOICE":
        return { questionId: q.id, answer: { selectedIndex: (d.options as string[]).indexOf(d.correctAnswer) } };
      case "TRUE_FALSE":
        return { questionId: q.id, answer: { value: d.correctAnswer } };
      case "FILL_IN_THE_BLANK":
        return { questionId: q.id, answer: { text: "  yıldız " } };
      case "MATCHING":
        return { questionId: q.id, answer: { matches: (d.pairs as { right: string }[]).map((p) => p.right) } };
      case "ORDERING":
        return { questionId: q.id, answer: { order: d.correctOrder } };
      default:
        return { questionId: q.id, answer: { text: "Işık veren bir yıldızdır." } };
    }
  });
}

export async function readAndConfirm(studentId: string, assignmentId: string) {
  await openSummary(studentId, assignmentId, db);
  const c = await confirmSummary(studentId, assignmentId, { confirmed: true }, db);
  if (!c.ok) throw new Error(c.message);
}

/** Read, confirm, start and submit one attempt with the given answers. */
export async function completeAttempt(studentId: string, assignmentId: string, answers: { questionId: string; answer: unknown }[]) {
  await readAndConfirm(studentId, assignmentId);
  const att = await startAttempt(studentId, assignmentId, db);
  if (!att.ok) throw new Error(att.message);
  const res = await submitAttempt(studentId, att.data.id, { answers }, db);
  if (!res.ok) throw new Error(res.message);
  return res.data;
}
