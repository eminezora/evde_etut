// Shared CLI helpers for the curriculum scripts.
import { existsSync } from "node:fs";
import { GRADES, gradePaths } from "../src/lib/curriculum/curriculum-config.ts";
import { buildMiddleSchool } from "../src/lib/curriculum/validate-outcomes.ts";

/** "--grade 6", "--grade=6,7" or bare "6" -> [6]; nothing -> every configured grade. */
export function parseGrades(argv = process.argv.slice(2)): number[] {
  const picked: number[] = [];
  for (let i = 0; i < argv.length; i++) {
    let v: string | undefined;
    if (argv[i] === "--grade") v = argv[++i];
    else if (argv[i].startsWith("--grade=")) v = argv[i].slice(8);
    else if (/^\d+(,\d+)*$/.test(argv[i])) v = argv[i];
    if (v) picked.push(...v.split(",").map(Number));
  }
  for (const g of picked) if (!GRADES.includes(g)) throw new Error(`Grade ${g} is not configured (configured: ${GRADES.join(", ")})`);
  return picked.length ? [...new Set(picked)] : GRADES;
}

export async function combineIfComplete() {
  if (!GRADES.every((g) => existsSync(gradePaths(g).summary))) {
    console.log(`\n(all-middle-school.json için tüm sınıfların (${GRADES.join(", ")}) verisi gerekli; birleştirme atlandı)`);
    return;
  }
  const s = await buildMiddleSchool();
  const rows = Object.entries<any>(s.perGrade).map(([g, x]) =>
    `${g}. sınıf  ders ${x.subjects}  tema/ünite ${x.unitsOrThemes}  çıktı ${x.outcomes}  VERIFIED ${x.verified}  REVIEW ${x.reviewRequired}  duplicate ${x.duplicates}  hata ${x.errors}` +
    (x.missingSubjects.length ? `  (kaynakta yok: ${x.missingSubjects.join(", ")})` : ""),
  );
  console.log(
    [
      "",
      "ORTAOKUL (5–8) MÜFREDAT VERİ SETİ",
      ...rows,
      `TOPLAM   ders ${s.subjects}  tema/ünite ${s.totalUnitsOrThemes}  çıktı ${s.totalOutcomes}  VERIFIED ${s.verified}  REVIEW ${s.reviewRequired}  duplicate ${s.duplicates}  hata ${s.errors}`,
    ].join("\n"),
  );
}
