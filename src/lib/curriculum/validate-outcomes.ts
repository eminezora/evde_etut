// Validates one grade's normalized dataset against its raw MEB page data and writes
//   data/curriculum/grade-<n>-validation-report.json
//   data/curriculum/grade-<n>-summary.json
// plus the combined middle-school dataset and summary (buildMiddleSchool).

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BASE_URL, CURRICULUM_DIR, GRADES, type OutcomeRecord, gradePaths, subjectsForGrade } from "./curriculum-config.ts";
import { FIELD_OUTCOMES, gradeFromCode } from "./parse-unit.ts";

type Check = { id: number; name: string; passed: boolean; count: number; details: unknown[] };

/** A linked unit page that the source itself left empty: no title and no fields at all. */
const isEmptySourcePage = (u: any) => u.reachable && !u.pageTitle && Object.keys(u.fields ?? {}).length === 0;

const readJson = async (p: string) => JSON.parse(await readFile(p, "utf8"));

export async function validateGrade(GRADE: number, { quiet = false } = {}) {
  const { rawDir: RAW_DIR, normalizedDir: NORMALIZED_DIR, validationReport, summary: summaryFile } = gradePaths(GRADE);
  const SUBJECTS = subjectsForGrade(GRADE);
  const fetchLog = existsSync(`${RAW_DIR}/fetch-log.json`) ? await readJson(`${RAW_DIR}/fetch-log.json`) : {};
  const combined = await readJson(`${NORMALIZED_DIR}/grade-${GRADE}.json`);
  const all: OutcomeRecord[] = combined.outcomes;
  const ref = (r: OutcomeRecord) => ({ subject: r.subject, unitOrTheme: r.unitOrTheme, outcomeCode: r.outcomeCode, sourceUrl: r.sourceUrl });

  const raws: Record<string, any> = {};
  const perSubject: Record<string, { file: string; records: OutcomeRecord[] }> = {};
  for (const s of SUBJECTS) {
    raws[s.subject] = await readJson(`${RAW_DIR}/${s.key}.raw.json`);
    perSubject[s.subject] = { file: `${s.key}.json`, records: (await readJson(`${NORMALIZED_DIR}/${s.key}.json`)).outcomes };
  }

  const checks: Check[] = [];
  const add = (id: number, name: string, details: unknown[]) =>
    checks.push({ id, name, passed: details.length === 0, count: details.length, details });

  // 1-2
  add(1, "outcomeCode boş mu?", all.filter((r) => !r.outcomeCode?.trim()).map(ref));
  add(2, "outcomeText boş mu?", all.filter((r) => !r.outcomeText?.trim()).map(ref));

  // 3 subject: the record sits in its subject file, its code prefix matches and the source page names that course
  const subjErr: unknown[] = [];
  for (const s of SUBJECTS) {
    const unitsByUrl = new Map<string, any>(raws[s.subject].units.map((u: any) => [u.url, u]));
    for (const r of perSubject[s.subject].records) {
      const u = unitsByUrl.get(r.sourceUrl);
      if (r.subject !== s.subject) subjErr.push({ ...ref(r), problem: `subject "${r.subject}" ≠ "${s.subject}"` });
      else if (!u?.meta?.includes(s.courseName)) subjErr.push({ ...ref(r), problem: `kaynak sayfa "${s.courseName}" dersine ait görünmüyor` });
    }
  }
  if (perSubject && all.length !== SUBJECTS.reduce((n, s) => n + perSubject[s.subject].records.length, 0))
    subjErr.push({ problem: `grade-${GRADE}.json kayıt sayısı ders dosyalarının toplamı ile uyuşmuyor` });
  add(3, "subject doğru mu?", subjErr);

  // 4 grade: record grade, program + unit page headings say "<grade>.Sınıf", code grade segment
  const gradeErr: unknown[] = [];
  for (const s of SUBJECTS) {
    const raw = raws[s.subject];
    if (raw.mainPage && !raw.mainPage.gradeVerified)
      gradeErr.push({ subject: s.subject, url: raw.programUrl, problem: `program sayfası başlığı: "${raw.mainPage?.heading}"` });
    for (const u of raw.units)
      if (u.reachable && !u.meta?.includes(`${GRADE}.Sınıf`)) gradeErr.push({ subject: s.subject, url: u.url, problem: `sayfa meta: ${JSON.stringify(u.meta)}` });
  }
  for (const r of all) {
    if (r.grade !== GRADE) gradeErr.push({ ...ref(r), problem: `grade=${r.grade}` });
    else if (r.outcomeCode && gradeFromCode(r.outcomeCode) !== GRADE) gradeErr.push({ ...ref(r), problem: `koddaki sınıf bölümü ${GRADE} değil` });
  }
  add(4, `grade gerçekten ${GRADE} mi?`, gradeErr);

  // 5
  add(5, "sourceUrl https://tymm.meb.gov.tr/ ile mi başlıyor?", all.filter((r) => !r.sourceUrl?.startsWith(`${BASE_URL}/`)).map(ref));

  // 6 + 10 duplicates
  const groups = new Map<string, OutcomeRecord[]>();
  for (const r of all) {
    if (!r.outcomeCode) continue;
    const k = `${r.subject}|${r.grade}|${r.outcomeCode}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const duplicates = dupGroups.map((g) => {
    const texts = [...new Set(g.map((r) => r.outcomeText))];
    const comps = [...new Set(g.map((r) => JSON.stringify(r.processComponents)))];
    return {
      subject: g[0].subject,
      grade: g[0].grade,
      outcomeCode: g[0].outcomeCode,
      occurrences: g.length,
      sameText: texts.length === 1,
      sameProcessComponents: comps.length === 1,
      texts,
      unitsOrThemes: g.map((r) => r.unitOrTheme),
      sourceUrls: g.map((r) => r.sourceUrl),
    };
  });
  // Duplicates are reported, never removed. Check 6 is informational: it lists every repeated key.
  checks.push({
    id: 6,
    name: "duplicate outcome var mı? (subject + grade + outcomeCode)",
    passed: duplicates.length === 0,
    count: duplicates.length,
    details: duplicates.map((d) => ({ ...d, texts: undefined })),
  });

  // 7
  const review = all.filter((r) => r.reviewStatus === "REVIEW_REQUIRED").map((r) => ({ ...ref(r), reasons: r.reviewReasons }));
  add(7, "REVIEW_REQUIRED kayıt var mı?", review);

  // 8 every theme/unit link on every program page visited and parsed
  const linkErr: unknown[] = [];
  for (const s of SUBJECTS) {
    const raw = raws[s.subject];
    const links: any[] = raw.mainPage?.links ?? [];
    if (raw.sourceStatus === "UNREACHABLE" || raw.sourceStatus === "AMBIGUOUS")
      linkErr.push({ subject: s.subject, url: raw.programUrl ?? raw.course?.url, problem: raw.problems.join("; ") });
    for (const l of links) {
      const u = raw.units.find((x: any) => x.url === l.url);
      if (!u || !u.reachable) linkErr.push({ subject: s.subject, url: l.url, problem: "ziyaret edilemedi" });
      else if (!fetchLog[l.url]) linkErr.push({ subject: s.subject, url: l.url, problem: "fetch-log kaydı yok" });
      else if (!u.parsedOutcomes?.length && !isEmptySourcePage(u))
        linkErr.push({ subject: s.subject, url: l.url, problem: "sayfada içerik var ama öğrenme çıktısı ayrıştırılamadı" });
    }
    if (raw.units.length !== links.length) linkErr.push({ subject: s.subject, problem: "ünite sayısı bağlantı sayısıyla uyuşmuyor" });
  }
  add(8, "tema/ünite bağlantılarının tamamı ziyaret edilip ayrıştırıldı mı? (ulaşılamayan alt sayfa)", linkErr);

  // 9 each outcome's source page is recorded (fetch log + cached HTML) and the outcome is on that page
  const srcErr: unknown[] = [];
  for (const s of SUBJECTS) {
    const unitsByUrl = new Map<string, any>(raws[s.subject].units.map((u: any) => [u.url, u]));
    for (const r of perSubject[s.subject].records) {
      const log = fetchLog[r.sourceUrl];
      const u = unitsByUrl.get(r.sourceUrl);
      if (!r.sourceUrl || !r.sourceTitle || !r.sourceFetchedAt) srcErr.push({ ...ref(r), problem: "sourceUrl/sourceTitle/sourceFetchedAt eksik" });
      else if (!log || !existsSync(`${RAW_DIR}/${log.cacheFile}`)) srcErr.push({ ...ref(r), problem: "kaynak sayfanın ham HTML kaydı yok" });
      else if (!u?.parsedOutcomes?.some((o: any) => o.code === r.outcomeCode && o.text === r.outcomeText))
        srcErr.push({ ...ref(r), problem: "kayıt, kaynak sayfanın ham çıktısında bulunamadı" });
    }
  }
  add(9, "her öğrenme çıktısının kaynak sayfası kayıtlı mı?", srcErr);

  // 11 anti-fabrication: every outcome text / process component occurs verbatim (whitespace-insensitive)
  // in the page's FIELD_OUTCOMES field, and the page has as many code
  // tokens as parsed outcomes.
  const squash = (t: string) => t.replace(/[\s\u00a0]+/g, "");
  const verbatimErr: unknown[] = [];
  for (const s of SUBJECTS) {
    const unitsByUrl = new Map<string, any>(raws[s.subject].units.map((u: any) => [u.url, u]));
    for (const r of perSubject[s.subject].records) {
      const field = squash(unitsByUrl.get(r.sourceUrl)?.fields?.[FIELD_OUTCOMES] ?? "");
      if (r.outcomeCodeAsPrinted && !field.includes(squash(r.outcomeCodeAsPrinted)))
        verbatimErr.push({ ...ref(r), problem: "kod sayfa metninde yok" });
      if (r.outcomeText && !field.includes(squash(r.outcomeText))) verbatimErr.push({ ...ref(r), problem: "metin sayfada birebir yok" });
      for (const c of r.processComponents)
        if (!field.includes(squash(c.slice(2)))) verbatimErr.push({ ...ref(r), problem: `bileşen sayfada birebir yok: ${c.slice(0, 60)}` });
    }
    for (const u of raws[s.subject].units) {
      // Count independently of the cheerio parser: cut the field out of the cached raw HTML
      // with a plain string search and replace every tag with a space.
      const log = fetchLog[u.url];
      if (!log || !existsSync(`${RAW_DIR}/${log.cacheFile}`)) continue;
      const html = (await readFile(`${RAW_DIR}/${log.cacheFile}`, "utf8")).normalize("NFC");
      const start = html.indexOf('content">', html.indexOf(FIELD_OUTCOMES, html.indexOf("unite-detail__fields")));
      const block = html.slice(start, html.indexOf("</div>", start)).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      const tokens = block.match(new RegExp(`(?<![\\w.])[A-ZÇĞİÖŞÜ]{1,4}(?:\\.[A-ZÇĞİÖŞÜ])?\\.?${GRADE}\\.\\s?[A-Z]{0,2}\\s?\\d+`, "g")) ?? [];
      if (tokens.length !== u.parsedOutcomes.length)
        verbatimErr.push({ subject: s.subject, url: u.url, problem: `ham HTML'de ${tokens.length} kod, ayrıştırılan ${u.parsedOutcomes.length}` });
    }
  }
  add(11, "öğrenme çıktıları ve bileşenler kaynak sayfada birebir geçiyor mu? (uydurma kontrolü)", verbatimErr);

  // 10
  add(
    10,
    "aynı outcomeCode farklı metinlerle tekrar ediyor mu?",
    duplicates.filter((d) => !d.sameText).map((d) => ({ subject: d.subject, outcomeCode: d.outcomeCode, texts: d.texts, sourceUrls: d.sourceUrls })),
  );

  // 12 every configured subject exists on tymm.meb.gov.tr for this grade (informational: nothing is invented for missing ones)
  add(
    12,
    "ders bu sınıf için kaynakta bulunuyor mu?",
    SUBJECTS.filter((s) => !["FOUND", "UNREACHABLE", "AMBIGUOUS"].includes(raws[s.subject].sourceStatus)).map((s) => ({
      subject: s.subject,
      sourceStatus: raws[s.subject].sourceStatus,
      problems: raws[s.subject].problems,
    })),
  );
  const missingSubjects = checks.find((c) => c.id === 12)!.details.map((d: any) => d.subject);

  // 13 theme/unit links whose page exists but is empty on the source (no title, no fields)
  add(
    13,
    "eksik tema/ünite: MEB'de bağlantısı olan ama içeriği boş sayfa var mı?",
    SUBJECTS.flatMap((s) =>
      raws[s.subject].units.filter((u: any) => u.reachable && isEmptySourcePage(u)).map((u: any) => ({ subject: s.subject, url: u.url, listTitle: u.title, meta: u.meta })),
    ),
  );

  // 14 outcome codes mentioned elsewhere on a unit page (e.g. "Öğrenme-Öğretme Uygulamaları") but missing
  // from its outcomes list. Informational: such outcomes are NOT created, since their text is not on the page.
  const strayCodes: unknown[] = [];
  const CODE_RE = new RegExp(`(?<![\\w.])([A-ZÇĞİÖŞÜ]{1,4}(?:\\.[A-ZÇĞİÖŞÜ])?)\\.?(${GRADE})((?:\\.\\s?[A-Z]{0,2}\\s?\\d+)+)`, "g");
  for (const s of SUBJECTS) {
    for (const u of raws[s.subject].units) {
      const log = fetchLog[u.url];
      if (!u.reachable || !log || !existsSync(`${RAW_DIR}/${log.cacheFile}`)) continue;
      const html = (await readFile(`${RAW_DIR}/${log.cacheFile}`, "utf8")).normalize("NFC");
      const start = html.indexOf("unite-detail__fields");
      const end = html.indexOf("<footer", start);
      if (start < 0) continue;
      const text = html.slice(start, end > 0 ? end : undefined).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      const known = new Set(u.parsedOutcomes.map((o: any) => o.code));
      const missing = new Set<string>();
      for (const m of text.matchAll(CODE_RE)) {
        const code = `${m[1]}.${m[2]}${m[3].replace(/\s+/g, "")}`;
        if (s.codeShape(GRADE).test(code) && !known.has(code)) missing.add(code);
      }
      if (missing.size) strayCodes.push({ subject: s.subject, url: u.url, unitOrTheme: u.pageTitle, codes: [...missing] });
    }
  }
  add(14, "sayfanın başka bölümünde geçip öğrenme çıktısı listesinde olmayan kod var mı?", strayCodes);

  // 15 codes printed on the page with a prefix that does not match the subject (source typo; record kept verbatim, REVIEW_REQUIRED)
  add(
    15,
    "öğrenme çıktısı kodu dersin önekiyle uyumsuz mu? (kaynaktaki yazım)",
    SUBJECTS.flatMap((s) => perSubject[s.subject].records.filter((r) => r.outcomeCode && !s.codePrefix.test(r.outcomeCode)).map(ref)),
  );

  const errorCheckIds = [1, 2, 3, 4, 5, 8, 9, 11];
  const errors = checks.filter((c) => errorCheckIds.includes(c.id)).reduce((n, c) => n + c.count, 0);

  const subjects: Record<string, any> = {};
  for (const s of SUBJECTS) {
    const recs = perSubject[s.subject].records;
    subjects[s.subject] = {
      sourceStatus: raws[s.subject].sourceStatus,
      programUrl: raws[s.subject].programUrl,
      unitsOrThemes: raws[s.subject].units.filter((u: any) => u.reachable && !isEmptySourcePage(u)).length,
      emptySourcePages: raws[s.subject].units.filter((u: any) => u.reachable && isEmptySourcePage(u)).length,
      outcomes: recs.length,
      uniqueOutcomeCodes: new Set(recs.map((r) => r.outcomeCode)).size,
      verified: recs.filter((r) => r.reviewStatus === "VERIFIED").length,
      reviewRequired: recs.filter((r) => r.reviewStatus === "REVIEW_REQUIRED").length,
    };
  }
  const summary = {
    grade: GRADE,
    generatedAt: new Date().toISOString(),
    subjectCount: SUBJECTS.length - missingSubjects.length,
    missingSubjects,
    subjects,
    totalUnitsOrThemes: Object.values(subjects).reduce((n: number, x: any) => n + x.unitsOrThemes, 0),
    totalOutcomes: all.length,
    verified: all.filter((r) => r.reviewStatus === "VERIFIED").length,
    totalUniqueOutcomeCodes: groups.size,
    duplicates: duplicates.length,
    duplicateExtraRecords: duplicates.reduce((n, d) => n + d.occurrences - 1, 0),
    duplicatesWithDifferentText: duplicates.filter((d) => !d.sameText).length,
    reviewRequired: review.length,
    errors,
  };

  await writeFile(
    validationReport,
    JSON.stringify(
      {
        grade: GRADE,
        generatedAt: summary.generatedAt,
        notes: [
          "duplicates: subject+grade+outcomeCode birden fazla kayıtta geçen kod sayısı. Kayıtlar silinmedi.",
          "errors: 1,2,3,4,5,8,9,11 numaralı kontrollerde bulunan sorun sayısı (veri/aktarım hatası).",
          "12: yapılandırılmış ama bu sınıf için tymm.meb.gov.tr'de bulunmayan dersler; bunlar için kayıt üretilmedi.",
          "13: MEB program sayfasında bağlantısı olan ama içeriği boş sayfalar (tema/ünite sayısına dahil edilmedi).",
          "14: sayfanın başka bölümünde anılan ama öğrenme çıktısı listesinde olmayan kodlar; metni olmadığı için kayıt üretilmedi.",
          "15: sayfada dersin önekinden farklı yazılmış kodlar (ör. İTA yerine TA); kod değiştirilmeden REVIEW_REQUIRED işaretlendi.",
          "6, 7 ve 10 kaynakta (MEB sayfasında) bulunan durumlardır; ilgili kayıtlar silinmedi, 10'dakiler REVIEW_REQUIRED işaretlendi.",
        ],
        passed: errors === 0,
        checks: checks.sort((a, b) => a.id - b.id),
        duplicates,
      },
      null,
      2,
    ),
  );
  await writeFile(summaryFile, JSON.stringify(summary, null, 2));

  // ---- terminal report ----
  const index = existsSync(`${RAW_DIR}/index.json`) ? await readJson(`${RAW_DIR}/index.json`) : { visited: [] };
  const lines = ["", `${GRADE}. SINIF MEB MÜFREDAT AKTARIMI TAMAMLANDI`, ""];
  for (const s of SUBJECTS) {
    const x = subjects[s.subject];
    if (missingSubjects.includes(s.subject)) lines.push(`${s.subject}: KAYNAKTA YOK (${x.sourceStatus})`, "");
    else lines.push(`${s.subject}:`, `* Tema/Ünite: ${x.unitsOrThemes}`, `* Öğrenme çıktısı: ${x.outcomes} (VERIFIED ${x.verified}, REVIEW ${x.reviewRequired})`, "");
  }
  lines.push(
    `Toplam öğrenme çıktısı: ${summary.totalOutcomes} (benzersiz kod: ${summary.totalUniqueOutcomeCodes})`,
    `Duplicate: ${summary.duplicates} kod (${summary.duplicateExtraRecords} fazladan kayıt, farklı metinli: ${summary.duplicatesWithDifferentText})`,
    `Review Required: ${summary.reviewRequired}`,
    `Hata: ${summary.errors}`,
    "",
    "Kontroller:",
    ...checks.map((c) => `  [${c.passed ? "OK" : [6, 7, 10, 12, 13, 14, 15].includes(c.id) ? "!!" : "XX"}] ${c.id}. ${c.name} (${c.count})`),
  );
  const urls = [...new Set<string>((index.visited ?? []).map((v: any) => v.url))];
  lines.push("", `Ziyaret edilen MEB URL'leri (${urls.length}):`, ...urls.map((u) => `  ${u}`));
  if (!quiet) console.log(lines.join("\n"));
  return summary;
}


/** Combine every grade's normalized dataset into all-middle-school.json + curriculum-summary.json. */
export async function buildMiddleSchool(grades: number[] = GRADES) {
  const outcomes: OutcomeRecord[] = [];
  const perGrade: Record<string, unknown> = {};
  const subjectNames = new Set<string>();
  const missing: { grade: number; subject: string }[] = [];
  let totalUnits = 0;
  let duplicates = 0;
  let errors = 0;
  for (const g of grades) {
    const { normalizedDir, summary: summaryFile } = gradePaths(g);
    if (!existsSync(`${normalizedDir}/grade-${g}.json`) || !existsSync(summaryFile)) {
      throw new Error(`grade ${g} dataset/summary missing – run the fetch for grade ${g} first`);
    }
    const data = await readJson(`${normalizedDir}/grade-${g}.json`);
    const summary = await readJson(summaryFile);
    outcomes.push(...data.outcomes);
    for (const [name, x] of Object.entries<any>(summary.subjects)) if (x.sourceStatus === "FOUND") subjectNames.add(name);
    for (const m of summary.missingSubjects) missing.push({ grade: g, subject: m });
    totalUnits += summary.totalUnitsOrThemes;
    duplicates += summary.duplicates;
    errors += summary.errors;
    perGrade[g] = {
      subjects: summary.subjectCount,
      missingSubjects: summary.missingSubjects,
      unitsOrThemes: summary.totalUnitsOrThemes,
      outcomes: summary.totalOutcomes,
      verified: summary.verified,
      reviewRequired: summary.reviewRequired,
      duplicates: summary.duplicates,
      errors: summary.errors,
    };
  }
  const generatedAt = new Date().toISOString();
  await writeFile(
    `${CURRICULUM_DIR}/normalized/all-middle-school.json`,
    JSON.stringify({ grades, source: BASE_URL, generatedAt, outcomes }, null, 2),
  );
  const summary = {
    grades,
    generatedAt,
    subjects: subjectNames.size,
    subjectNames: [...subjectNames],
    missingSubjects: missing,
    totalUnitsOrThemes: totalUnits,
    totalOutcomes: outcomes.length,
    verified: outcomes.filter((r) => r.reviewStatus === "VERIFIED").length,
    reviewRequired: outcomes.filter((r) => r.reviewStatus === "REVIEW_REQUIRED").length,
    duplicates,
    errors,
    perGrade,
  };
  await writeFile(`${CURRICULUM_DIR}/curriculum-summary.json`, JSON.stringify(summary, null, 2));
  return summary;
}
