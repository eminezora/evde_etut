// Builds the raw + normalized dataset for one grade:
//   course list (JSON) -> course page -> "<grade>.Sınıf" program page -> every theme/unit page.
// Only links actually present on MEB pages are followed; no URL is guessed.

import { mkdir, writeFile } from "node:fs/promises";
import {
  BASE_URL,
  COURSE_LIST_KADEME,
  COURSE_LIST_URL,
  type OutcomeRecord,
  type SubjectConfig,
  gradePaths,
  subjectsForGrade,
} from "./curriculum-config.ts";
import { PageFetcher } from "./fetch-page.ts";
import { parseCourseList, parseCoursePage, parseProgramPage } from "./parse-program.ts";
import { FIELD_OUTCOMES, gradeFromCode, parseUnitPage, splitCodedList } from "./parse-unit.ts";

// "1. Ünite: X" / "1.Tema: X" / "2. Öğrenme Alanı: X" -> { code: "1", kind, name }
function splitTitle(title: string) {
  const m = title.match(/^(\d+)\.\s*(Ünite|Tema|Öğrenme Alanı|Bölüm)\s*:\s*(.+)$/);
  return m ? { code: m[1], kind: m[2], name: m[3] } : { code: null, kind: null, name: title };
}

/** All courses of the basic-education level, read page by page from the site's own course list. */
async function loadCourseList(fetcher: PageFetcher) {
  const courses: { id: number; dersAdi: string; url: string; listUrl: string }[] = [];
  const problems: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const listUrl = `${COURSE_LIST_URL}?page=${page}&kademe=${COURSE_LIST_KADEME}`;
    const res = await fetcher.get(listUrl);
    if (!res) {
      problems.push(`Ders listesi sayfası indirilemedi: ${listUrl}`);
      break;
    }
    const list = parseCourseList(res.html);
    courses.push(...list.items.map((i) => ({ id: i.id, dersAdi: i.dersAdi, url: i.url, listUrl })));
    if (!list.hasMore) break;
  }
  return { courses, problems };
}

async function buildSubject(grade: number, cfg: SubjectConfig, fetcher: PageFetcher, courses: Awaited<ReturnType<typeof loadCourseList>>["courses"]) {
  const subjectRaw: any = {
    subject: cfg.subject,
    courseName: cfg.courseName,
    sourceStatus: "FOUND",
    course: null,
    programUrl: null,
    mainPage: null,
    units: [],
    problems: [],
  };
  const records: OutcomeRecord[] = [];

  // 1) course list -> course page
  const course = courses.find((c) => c.dersAdi === cfg.courseName);
  if (!course) {
    subjectRaw.sourceStatus = "NOT_FOUND_ON_SOURCE";
    subjectRaw.problems.push(`"${cfg.courseName}" tymm.meb.gov.tr ders listesinde (${COURSE_LIST_KADEME}, ${courses.length} ders) bulunamadı`);
    return { subjectRaw, records };
  }
  const courseUrl = `${BASE_URL}/ogretim-programlari/ders/${course.url}`;
  subjectRaw.course = { id: course.id, name: course.dersAdi, url: courseUrl, foundIn: course.listUrl };
  const coursePage = await fetcher.get(courseUrl);
  if (!coursePage) {
    subjectRaw.sourceStatus = "UNREACHABLE";
    subjectRaw.problems.push(`Ders sayfası indirilemedi: ${courseUrl}`);
    return { subjectRaw, records };
  }
  const cp = parseCoursePage(coursePage.html);
  subjectRaw.course.heading = cp.heading;
  subjectRaw.course.gradeCards = cp.grades;
  if (cp.heading !== cfg.courseName) subjectRaw.problems.push(`Ders sayfası başlığı beklenen değil: "${cp.heading}"`);

  // 2) "<grade>.Sınıf" card -> program page
  const card = cp.grades.filter((g) => g.grade === grade);
  if (card.length !== 1) {
    subjectRaw.sourceStatus = card.length ? "AMBIGUOUS" : "GRADE_NOT_FOUND_ON_SOURCE";
    subjectRaw.problems.push(`Ders sayfasında "${grade}.Sınıf" kartı ${card.length ? "birden fazla" : "yok"}: ${cp.grades.map((g) => g.label).join(", ")}`);
    return { subjectRaw, records };
  }
  const programUrl = card[0].url;
  subjectRaw.programUrl = programUrl;
  const main = await fetcher.get(programUrl);
  if (!main) {
    subjectRaw.sourceStatus = "UNREACHABLE";
    subjectRaw.problems.push(`Program sayfası indirilemedi: ${programUrl}`);
    return { subjectRaw, records };
  }

  const mp = parseProgramPage(main.html);
  // Grade is taken from the page heading ("... Dersi 6.Sınıf"), not from the URL's number.
  const headingGrade = mp.heading.match(/(\d+)\s*\.\s*Sınıf/)?.[1];
  const mainGradeOk = headingGrade === String(grade) && mp.heading.startsWith(cfg.courseName);
  subjectRaw.mainPage = {
    url: programUrl,
    heading: mp.heading,
    headingGrade: headingGrade ? Number(headingGrade) : null,
    gradeVerified: mainGradeOk,
    fetchedAt: main.fetchedAt,
    links: mp.links,
  };
  if (!mainGradeOk) subjectRaw.problems.push(`Program sayfası başlığı ${grade}. sınıfı doğrulamıyor: "${mp.heading}"`);
  if (mp.links.length === 0) subjectRaw.problems.push("Program sayfasında tema/ünite bağlantısı bulunamadı");

  // 3) every theme/unit page linked from the program page
  for (const link of mp.links) {
    const page = await fetcher.get(link.url);
    if (!page) {
      subjectRaw.units.push({ ...link, reachable: false });
      subjectRaw.problems.push(`Alt sayfaya ulaşılamadı: ${link.url}`);
      continue;
    }
    const u = parseUnitPage(page.html);
    const t = splitTitle(u.title);
    const unitProblems: string[] = [];
    const unitGradeOk = u.meta.includes(`${grade}.Sınıf`) && mainGradeOk;
    if (!u.meta.includes(`${grade}.Sınıf`)) unitProblems.push(`Sayfa sınıf bilgisi ${grade}.Sınıf değil: ${JSON.stringify(u.meta)}`);
    if (!u.meta.includes(cfg.courseName)) unitProblems.push(`Sayfa ders adı beklenen değil: ${JSON.stringify(u.meta)}`);
    if (u.title !== link.title) unitProblems.push(`Başlık uyuşmazlığı: liste "${link.title}" / sayfa "${u.title}"`);
    if (!u.title) unitProblems.push("Tema/ünite adı okunamadı");
    unitProblems.push(...u.outcomeIssues);
    if (u.outcomes.length === 0) unitProblems.push("Sayfada öğrenme çıktısı bulunamadı");

    subjectRaw.units.push({
      ...link,
      reachable: true,
      fetchedAt: page.fetchedAt,
      cacheFile: fetcher.fetchLog[link.url]?.cacheFile ?? null,
      meta: u.meta,
      pageTitle: u.title,
      subtitle: u.subtitle,
      intro: u.intro,
      fields: Object.fromEntries(Object.entries(u.fields).map(([k, v]) => [k, v.text])),
      outcomesBlockSegments: u.fields[FIELD_OUTCOMES]?.segments ?? [],
      parsedOutcomes: u.outcomes,
      problems: unitProblems,
    });

    const f = (name: string) => (u.fields[name] ? splitCodedList(u.fields[name].text) : []);
    const hours = u.fields["Ders Saati"]?.text;
    for (const o of u.outcomes) {
      const reasons = [...unitProblems, ...o.issues];
      const codeGrade = o.code ? gradeFromCode(o.code) : null;
      if (!o.code) reasons.push("Öğrenme çıktısı kodu okunamadı");
      else {
        if (codeGrade !== grade) reasons.push(`Kodun sınıf bölümü ${grade} değil (${o.code})`);
        if (!cfg.codePrefix.test(o.code)) reasons.push(`Kod öneki ders ile uyumsuz (${o.code})`);
        else if (!cfg.codeShape(grade).test(o.code))
          reasons.push(`Kod, dersin diğer kodlarının yapısına uymuyor; sayfada "${o.codeAsPrinted}" olarak yazılmış, değiştirilmedi`);
      }
      if (!o.text) reasons.push("Öğrenme çıktısı metni boş");
      const gradeVerified = unitGradeOk && codeGrade === grade;
      records.push({
        subject: cfg.subject,
        grade: gradeVerified ? grade : null,
        unitOrTheme: u.title || null,
        unitOrThemeCode: t.code,
        unitOrThemeSubtitle: u.subtitle,
        outcomeCode: o.code,
        outcomeCodeAsPrinted: o.codeAsPrinted,
        outcomeText: o.text || null,
        outcomeGroup: o.group,
        processComponents: o.components,
        learningArea: t.kind === "Öğrenme Alanı" ? t.name : null,
        skills: f("Alan Becerileri"),
        conceptualSkills: f("Kavramsal Beceriler"),
        dispositions: f("Eğilimler"),
        socialEmotionalSkills: f("Sosyal-Duygusal Öğrenme Becerileri"),
        values: f("Değerler"),
        literacySkills: f("Okuryazarlık Becerileri"),
        interdisciplinaryRelations: f("Disiplinler Arası İlişkiler"),
        interSkillRelations: f("Beceriler Arası İlişkiler"),
        lessonHours: hours && /^\d+$/.test(hours) ? Number(hours) : null,
        sourceUrl: link.url,
        sourceTitle: `${cfg.courseName} ${grade}.Sınıf – ${u.title}`,
        sourceFetchedAt: page.fetchedAt,
        reviewStatus: reasons.length ? "REVIEW_REQUIRED" : "VERIFIED",
        reviewReasons: reasons,
        parsingNotes: o.notes,
      });
    }
  }

  // Same code with different text in another theme/unit: keep every record, flag for review.
  const textsByCode = new Map<string, Set<string | null>>();
  for (const r of records) if (r.outcomeCode) textsByCode.set(r.outcomeCode, (textsByCode.get(r.outcomeCode) ?? new Set()).add(r.outcomeText));
  for (const r of records) {
    const texts = r.outcomeCode ? textsByCode.get(r.outcomeCode)! : new Set();
    if (texts.size > 1) {
      r.reviewReasons.push(`Aynı kod (${r.outcomeCode}) başka tema/ünitede farklı metinle geçiyor (${texts.size} farklı metin)`);
      r.reviewStatus = "REVIEW_REQUIRED";
    }
  }
  return { subjectRaw, records };
}

export async function buildGrade(grade: number, { refresh = false } = {}) {
  const paths = gradePaths(grade);
  const fetcher = new PageFetcher(paths.rawDir, refresh);
  await fetcher.init();
  await mkdir(paths.normalizedDir, { recursive: true });

  const { courses, problems: listProblems } = await loadCourseList(fetcher);
  const all: OutcomeRecord[] = [];
  const rawIndex: unknown[] = [];
  const subjects = subjectsForGrade(grade);

  for (const cfg of subjects) {
    console.log(`\n${grade}. sınıf – ${cfg.subject}`);
    const { subjectRaw, records } = await buildSubject(grade, cfg, fetcher, courses);
    await writeFile(`${paths.rawDir}/${cfg.key}.raw.json`, JSON.stringify(subjectRaw, null, 2));
    await writeFile(
      `${paths.normalizedDir}/${cfg.key}.json`,
      JSON.stringify(
        { subject: cfg.subject, grade, programUrl: subjectRaw.programUrl, sourceStatus: subjectRaw.sourceStatus, outcomes: records },
        null,
        2,
      ),
    );
    rawIndex.push({
      subject: cfg.subject,
      file: `${cfg.key}.raw.json`,
      sourceStatus: subjectRaw.sourceStatus,
      programUrl: subjectRaw.programUrl,
      units: subjectRaw.units.length,
      problems: subjectRaw.problems,
    });
    all.push(...records);
    console.log(`  ${subjectRaw.sourceStatus}: ${subjectRaw.units.length} tema/ünite, ${records.length} öğrenme çıktısı`);
    for (const p of subjectRaw.problems) console.log(`  ! ${p}`);
  }

  await fetcher.save();
  await writeFile(
    `${paths.rawDir}/index.json`,
    JSON.stringify(
      {
        grade,
        source: BASE_URL,
        generatedAt: new Date().toISOString(),
        courseList: { kademe: COURSE_LIST_KADEME, courses: courses.length, problems: listProblems },
        subjects: rawIndex,
        visited: fetcher.visited,
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${paths.normalizedDir}/grade-${grade}.json`,
    JSON.stringify(
      {
        grade,
        source: BASE_URL,
        generatedAt: new Date().toISOString(),
        subjects: subjects.map((s) => ({ key: s.key, subject: s.subject, programUrl: (rawIndex.find((r: any) => r.subject === s.subject) as any)?.programUrl ?? null })),
        outcomes: all,
      },
      null,
      2,
    ),
  );
}
