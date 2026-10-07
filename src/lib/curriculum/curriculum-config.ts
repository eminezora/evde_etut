// Grade/subject configuration and shared types for the MEB (tymm.meb.gov.tr) curriculum pipeline.
// The only data source is tymm.meb.gov.tr. Program URLs are not hard-coded: each subject is found
// by its course name in the site's own course list, then the "<grade>.Sınıf" card on the course page
// gives the program page (the number at the end of that URL is NOT the grade).

export const BASE_URL = "https://tymm.meb.gov.tr";
export const COURSE_LIST_URL = `${BASE_URL}/Ders/GetProgramList`;
export const COURSE_LIST_KADEME = "temel-egitim";

export const ROOT = new URL("../../../", import.meta.url).pathname;
export const CURRICULUM_DIR = `${ROOT}data/curriculum`;

export const gradePaths = (grade: number) => ({
  rawDir: `${CURRICULUM_DIR}/raw/grade-${grade}`,
  htmlCacheDir: `${CURRICULUM_DIR}/raw/grade-${grade}/html`,
  normalizedDir: `${CURRICULUM_DIR}/normalized/grade-${grade}`,
  validationReport: `${CURRICULUM_DIR}/grade-${grade}-validation-report.json`,
  summary: `${CURRICULUM_DIR}/grade-${grade}-summary.json`,
});

export interface SubjectConfig {
  key: string; // file name (english, science, ...)
  subject: string; // Turkish display name used in records
  courseName: string; // course name exactly as printed on the MEB pages / course list
  codePrefix: RegExp; // expected outcome-code prefix for this subject
  codeShape: (grade: number) => RegExp; // expected full shape of a canonical code for a grade
}

export const SUBJECTS: Record<string, SubjectConfig> = {
  english: {
    key: "english",
    subject: "İngilizce",
    courseName: "İngilizce Dersi",
    codePrefix: /^ENG\./,
    codeShape: (g) => new RegExp(`^ENG\\.${g}\\.\\d+\\.[A-Z]\\d+$`),
  },
  science: {
    key: "science",
    subject: "Fen Bilimleri",
    courseName: "Fen Bilimleri Dersi",
    codePrefix: /^FB\./,
    codeShape: (g) => new RegExp(`^FB\\.${g}\\.\\d+\\.\\d+$`),
  },
  mathematics: {
    key: "mathematics",
    subject: "Matematik",
    courseName: "Ortaokul Matematik Dersi",
    codePrefix: /^MAT\./,
    codeShape: (g) => new RegExp(`^MAT\\.${g}\\.\\d+\\.\\d+$`),
  },
  turkish: {
    key: "turkish",
    subject: "Türkçe",
    courseName: "Ortaokul Türkçe Dersi",
    codePrefix: /^T\.[A-ZÇĞİÖŞÜ]\./,
    codeShape: (g) => new RegExp(`^T\\.[DOKY]\\.${g}\\.\\d+$`),
  },
  "social-studies": {
    key: "social-studies",
    subject: "Sosyal Bilgiler",
    courseName: "Sosyal Bilgiler Dersi",
    codePrefix: /^SB\./,
    codeShape: (g) => new RegExp(`^SB\\.${g}\\.\\d+\\.\\d+$`),
  },
  "revolution-history": {
    key: "revolution-history",
    subject: "T.C. İnkılap Tarihi ve Atatürkçülük",
    courseName: "T.C. İnkılap Tarihi ve Atatürkçülük Dersi",
    codePrefix: /^İTA\./,
    codeShape: (g) => new RegExp(`^İTA\\.${g}\\.\\d+\\.\\d+$`),
  },
  "religious-culture": {
    key: "religious-culture",
    subject: "Din Kültürü ve Ahlak Bilgisi",
    courseName: "Din Kültürü ve Ahlak Bilgisi Dersi",
    codePrefix: /^DKAB\./,
    codeShape: (g) => new RegExp(`^DKAB\\.${g}\\.\\d+\\.\\d+$`),
  },
};

export const GRADE_SUBJECTS: Record<number, string[]> = {
  5: ["english", "science", "mathematics", "turkish", "social-studies"],
  6: ["turkish", "mathematics", "science", "english", "social-studies", "religious-culture"],
  7: ["turkish", "mathematics", "science", "english", "social-studies", "religious-culture"],
  8: ["turkish", "mathematics", "science", "english", "revolution-history", "religious-culture"],
};

export const GRADES = Object.keys(GRADE_SUBJECTS).map(Number);
export const subjectsForGrade = (grade: number) => GRADE_SUBJECTS[grade].map((k) => SUBJECTS[k]);

// ---------- record types ----------

export type ReviewStatus = "VERIFIED" | "REVIEW_REQUIRED";

export interface OutcomeRecord {
  subject: string;
  grade: number | null;
  unitOrTheme: string | null;
  unitOrThemeCode: string | null;
  unitOrThemeSubtitle: string | null;
  outcomeCode: string | null;
  outcomeCodeAsPrinted: string | null; // verbatim spelling on the MEB page
  outcomeText: string | null;
  outcomeGroup: string | null; // sub-heading inside the outcomes block (e.g. Türkçe "Okuma"), as printed
  processComponents: string[];
  learningArea: string | null;
  skills: string[];
  conceptualSkills: string[];
  dispositions: string[];
  socialEmotionalSkills: string[];
  values: string[];
  literacySkills: string[];
  interdisciplinaryRelations: string[];
  interSkillRelations: string[];
  lessonHours: number | null;
  sourceUrl: string;
  sourceTitle: string;
  sourceFetchedAt: string | null;
  reviewStatus: ReviewStatus;
  reviewReasons: string[];
  parsingNotes: string[];
}
