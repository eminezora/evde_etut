// Demo data for presentations and user tests – NOT part of deployment.
//
//   DEMO_PASSWORD=… npm run demo                      # local SQLite database
//   DEMO_PASSWORD=… npm run demo -- --allow-remote    # any other database (deliberate opt-in)
//
// Creates (or resets) one teacher, the 5th-grade classroom "5/A" with join code DEMO5A, five
// students, one published and one draft assignment linked to real MEB outcomes, and student
// progress produced through the app's own services (so every status is a real, valid state):
//   ogrenci@demo.local  → not started (for the live demo)   ogrenci2 → READY_FOR_CLASS
//   ogrenci3            → NEEDS_REVIEW                       ogrenci4 → waiting for teacher review
//   ogrenci5            → reading the summary
// All demo accounts use the password in DEMO_PASSWORD (min. 12 chars); none is stored in the repo.
// Re-running resets the demo classroom's assignments and progress.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Local convenience: read .env files for values not already set in the shell (shell values win).
for (const file of [".env.production.local", ".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present
  }
}

const password = process.env.DEMO_PASSWORD ?? "";
if (password.length < 12) {
  console.error("DEMO_PASSWORD (en az 12 karakter) tanımlanmalı. Demo hesaplar bu şifreyle oluşturulur.");
  process.exit(1);
}
const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:") && !process.argv.includes("--allow-remote")) {
  console.error("Demo verisi yalnızca yerel SQLite veritabanına otomatik yazılır. Başka bir veritabanı için bilerek --allow-remote ekleyin.");
  process.exit(1);
}

// Services are imported after the environment is loaded (they create the shared Prisma client).
const { createAssignment } = await import("../src/lib/assignments/assignment-service.ts");
const { addQuestion, approveAndPublish, saveStudyContent } = await import("../src/lib/content/content-service.ts");
const { confirmSummary, openSummary, startAttempt, submitAttempt } = await import("../src/lib/assessment/student-assessment-service.ts");
const { listPendingReviews, reviewAnswer } = await import("../src/lib/assessment/review-service.ts");

export const DEMO = {
  teacher: { email: "ogretmen@demo.local", name: "Ayşe Öğretmen" },
  classroom: { name: "5/A", grade: 5, joinCode: "DEMO5A" },
  students: [
    { email: "ogrenci@demo.local", name: "Demo Öğrenci" },
    { email: "ogrenci2@demo.local", name: "Elif Yılmaz" },
    { email: "ogrenci3@demo.local", name: "Mert Kaya" },
    { email: "ogrenci4@demo.local", name: "Zeynep Demir" },
    { email: "ogrenci5@demo.local", name: "Can Öztürk" },
  ],
};

const SUBJECT = "Fen Bilimleri";
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const prisma = new PrismaClient();

async function outcome(code: string) {
  const o = await prisma.curriculumOutcome.findFirst({ where: { grade: 5, subject: SUBJECT, outcomeCode: code, reviewStatus: "VERIFIED" }, include: { units: true } });
  if (!o) throw new Error(`${code} bulunamadı – önce "npm run curriculum" çalıştırın.`);
  return o;
}

const ok = <T,>(r: { ok: true; data: T } | { ok: false }, what: string): T => {
  if (!r.ok) throw new Error(`${what} başarısız: ${JSON.stringify(r)}`);
  return r.data;
};

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const teacher = await prisma.user.upsert({
    where: { email: DEMO.teacher.email },
    create: { ...DEMO.teacher, role: "TEACHER", passwordHash },
    update: { name: DEMO.teacher.name, role: "TEACHER", passwordHash },
  });

  // Classroom with the fixed demo join code.
  const existing = await prisma.classroom.findUnique({ where: { joinCode: DEMO.classroom.joinCode } });
  if (existing && existing.teacherId !== teacher.id) throw new Error("DEMO5A kodu başka bir öğretmene ait bir sınıfta kullanılıyor.");
  const classroom = existing
    ? await prisma.classroom.update({ where: { id: existing.id }, data: { name: DEMO.classroom.name, grade: DEMO.classroom.grade } })
    : await prisma.classroom.create({ data: { teacherId: teacher.id, ...DEMO.classroom } });

  // Reset the demo classroom's assignments (answers first: Answer → Question is RESTRICT).
  const old = await prisma.assignment.findMany({ where: { classroomId: classroom.id }, select: { id: true } });
  if (old.length) {
    const ids = old.map((a) => a.id);
    await prisma.answer.deleteMany({ where: { question: { assignmentId: { in: ids } } } });
    await prisma.assignment.deleteMany({ where: { id: { in: ids } } });
  }

  const students = [];
  for (const s of DEMO.students) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: { ...s, role: "STUDENT", passwordHash },
      update: { name: s.name, role: "STUDENT", passwordHash },
    });
    await prisma.classroomMember.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId: user.id } },
      create: { classroomId: classroom.id, studentId: user.id },
      update: {},
    });
    students.push(user);
  }

  // ---- Published assignment: Unit 1, real outcomes FB.5.1.1 + FB.5.1.2 --------------------
  const sun = await outcome("FB.5.1.1");
  const moon = await outcome("FB.5.1.2");
  const unit1 = sun.units[0].unitOrTheme;
  const published = ok(
    await createAssignment(
      teacher.id,
      { classroomId: classroom.id, subject: SUBJECT, unitOrTheme: unit1, topic: "Güneş ve Ay", outcomeIds: [sun.id, moon.id], minimumScore: 70, deadline: days(7), questionCount: 6 },
      prisma,
    ),
    "Yayınlanacak görev",
  );
  ok(
    await saveStudyContent(
      teacher.id,
      published.id,
      {
        introduction: "Gökyüzünde en çok dikkatimizi çeken iki komşumuz Güneş ve Ay'dır. Bu çalışmada derste konuşacağımız temel bilgileri kısaca hatırlayacağız.",
        keyConcepts: [
          { term: "Güneş", explanation: "Kendi ışığını ve ısısını üreten, gazlardan oluşan bir yıldızdır." },
          { term: "Ay", explanation: "Dünya'nın doğal uydusudur; kendi ışığı yoktur, Güneş'ten aldığı ışığı yansıtır." },
          { term: "Dönme hareketi", explanation: "Bir gök cisminin kendi ekseni etrafında dönmesidir. Güneş de Ay da döner." },
          { term: "Dolanma hareketi", explanation: "Bir gök cisminin başka bir gök cisminin etrafında dolaşmasıdır. Ay, Dünya'nın etrafında dolanır." },
        ],
        summary:
          "Güneş, Dünya'ya en yakın yıldızdır. Işık ve ısı kaynağıdır; katı bir yüzeyi yoktur, gazlardan oluşur ve kendi ekseni etrafında döner.\n\nAy, Dünya'nın doğal uydusudur. Kendi ışığını üretmez; geceleri gördüğümüz parlaklık Güneş ışığının Ay yüzeyinden yansımasıdır. Ay'ın yüzeyinde kraterler bulunur.\n\nAy hem kendi ekseni etrafında döner hem de Dünya'nın etrafında dolanır. Bu iki hareketin süresi yaklaşık olarak aynı olduğu için Dünya'dan Ay'ın hep aynı yüzünü görürüz.",
        simpleExample: "Karanlık bir odada bir topa fenerle ışık tuttuğunuzda top parlar ama ışığı kendisi üretmez. Ay da Güneş'in ışığını bu şekilde yansıtır.",
        mustKnow: [
          "Güneş kendi ışığını üreten bir yıldızdır.",
          "Ay, Dünya'nın doğal uydusudur ve Güneş'in ışığını yansıtır.",
          "Dönme: kendi ekseni etrafında; dolanma: başka bir cismin etrafında hareket.",
          "Dünya'dan Ay'ın hep aynı yüzü görülür.",
        ],
      },
      prisma,
    ),
    "Hazırlık içeriği",
  );
  const S = sun.outcomeCode;
  const M = moon.outcomeCode;
  const questions = [
    { type: "MULTIPLE_CHOICE", questionText: "Güneş için aşağıdakilerden hangisi doğrudur?", options: ["Kendi ışığını üreten bir yıldızdır.", "Dünya'nın uydusudur.", "Işığını Ay'dan alır.", "Katı kayalardan oluşan bir gezegendir."], correctAnswer: "Kendi ışığını üreten bir yıldızdır.", explanation: "Güneş bir yıldızdır; ışığını ve ısısını kendisi üretir.", points: 10, curriculumOutcomeCodes: [S] },
    { type: "TRUE_FALSE", questionText: "Ay, kendi ışığını üretir.", correctAnswer: false, explanation: "Ay, Güneş'ten aldığı ışığı yansıtır.", points: 10, curriculumOutcomeCodes: [M] },
    { type: "FILL_IN_THE_BLANK", questionText: "Ay, Dünya'nın doğal ____.", correctAnswer: "uydusudur", acceptableAnswers: ["uydusu", "uydu"], points: 10, curriculumOutcomeCodes: [M] },
    { type: "MATCHING", questionText: "Gök cisimlerini açıklamalarıyla eşleştir.", pairs: [{ left: "Güneş", right: "Işık ve ısı kaynağı olan yıldız" }, { left: "Ay", right: "Dünya'nın doğal uydusu" }, { left: "Dünya", right: "Güneş'in etrafında dolanan gezegen" }], points: 10, curriculumOutcomeCodes: [S, M] },
    { type: "ORDERING", questionText: "Ay'ı görmemizi sağlayan ışığın yolunu sırala.", items: ["Işık Ay'ın yüzeyine ulaşır.", "Yansıyan ışık Dünya'ya gelir.", "Güneş ışık yayar.", "Ay ışığı yansıtır."], correctOrder: [2, 0, 3, 1], points: 10, curriculumOutcomeCodes: [S, M] },
    { type: "SHORT_ANSWER", questionText: "Dünya'dan bakıldığında Ay'ın hep aynı yüzünün görülmesinin nedenini kendi cümlelerinle açıkla.", sampleAnswer: "Ay'ın kendi ekseni etrafındaki dönme süresi ile Dünya etrafındaki dolanma süresi yaklaşık aynıdır.", points: 10, curriculumOutcomeCodes: [M] },
  ];
  for (const q of questions) ok(await addQuestion(teacher.id, published.id, q, prisma), "Soru");
  ok(await approveAndPublish(teacher.id, published.id, prisma), "Onayla ve Yayınla");

  // ---- Student progress through the real services ------------------------------------------
  const stored = await prisma.question.findMany({ where: { assignmentId: published.id }, orderBy: { orderNum: "asc" } });
  const answer = (type: string, correct: boolean) => {
    const q = stored.find((x) => x.type === type)!;
    const d = q.data as Record<string, never>;
    const a: Record<string, unknown> =
      type === "MULTIPLE_CHOICE" ? { selectedIndex: correct ? (d.options as string[]).indexOf(d.correctAnswer) : 1 }
      : type === "TRUE_FALSE" ? { value: correct ? d.correctAnswer : !d.correctAnswer }
      : type === "FILL_IN_THE_BLANK" ? { text: correct ? "uydusudur" : "gezegeni" }
      : type === "MATCHING" ? { matches: (d.pairs as { right: string }[]).map((p, i, all) => (correct ? p.right : all[(i + 1) % all.length].right)) }
      : type === "ORDERING" ? { order: correct ? d.correctOrder : (d.items as string[]).map((_, i) => i) }
      : { text: correct ? "Ay kendi etrafında dönerken Dünya'nın etrafında da aynı sürede dolanıyor." : "Bilmiyorum." };
    return { questionId: q.id, answer: a };
  };
  const all = (correctTypes: string[]) => stored.map((q) => answer(q.type, correctTypes.includes(q.type)));
  const TYPES = stored.map((q) => q.type);

  async function complete(studentId: string, answers: ReturnType<typeof all>) {
    ok(await openSummary(studentId, published.id, prisma), "Özet");
    ok(await confirmSummary(studentId, published.id, { confirmed: true }, prisma), "Onay");
    const attempt = ok(await startAttempt(studentId, published.id, prisma), "Deneme");
    return ok(await submitAttempt(studentId, attempt.id, { answers }, prisma), "Gönderim");
  }
  async function grade(studentName: string, points: number, feedback: string) {
    const item = (await listPendingReviews(teacher.id, prisma)).find((x) => x.student === studentName && x.assignment.id === published.id);
    if (item) ok(await reviewAnswer(teacher.id, item.answerId, { awardedPoints: points, feedback }, prisma), "Öğretmen puanı");
  }

  const [, elif, mert, zeynep, can] = students;
  await complete(elif.id, all(TYPES));
  await grade(elif.name, 9, "Çok güzel açıklama.");
  await complete(mert.id, all(["MULTIPLE_CHOICE", "TRUE_FALSE"]));
  await grade(mert.name, 3, "Dönme ve dolanma sürelerini tekrar oku.");
  await complete(zeynep.id, all(TYPES)); // open answer left for the teacher to grade in the demo
  ok(await openSummary(can.id, published.id, prisma), "Özet"); // reading only

  // ---- Draft assignment for the live AI demo (Unit 2, FB.5.2.1) ----------------------------
  const force = await outcome("FB.5.2.1");
  ok(
    await createAssignment(
      teacher.id,
      { classroomId: classroom.id, subject: SUBJECT, unitOrTheme: force.units[0].unitOrTheme, topic: "Kuvvet ve ölçülmesi", outcomeIds: [force.id], minimumScore: 70, deadline: days(10), questionCount: 6 },
      prisma,
    ),
    "Taslak görev",
  );

  const states = await prisma.studentAssignment.findMany({ where: { assignmentId: published.id }, include: { student: { select: { name: true } } } });
  console.log(`Demo hazır: ${DEMO.teacher.email} · sınıf ${DEMO.classroom.name} (katılma kodu ${DEMO.classroom.joinCode}) · ${students.length} öğrenci (şifre: DEMO_PASSWORD).`);
  for (const s of states) console.log(`  ${s.student.name}: ${s.status}${s.latestScore !== null ? ` (%${s.latestScore})` : ""}`);
} finally {
  await prisma.$disconnect();
}
