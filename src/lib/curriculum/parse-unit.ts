// Parsing of a single theme/unit page ("/<course>/unite/<id>") and shared text helpers.
// Nothing here invents curriculum content: every outcome/process component comes verbatim
// from the fetched HTML; irregular spellings are recorded, not silently fixed.

import * as cheerio from "cheerio";
import type { AnyNode, Element, Text } from "domhandler";

// ---------- text helpers ----------

// NFC: some MEB pages use decomposed letters (e.g. "c" + U+0327 instead of "ç").
export const clean = (s: string) =>
  s
    .normalize("NFC")
    .replace(/ /g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();

// Outcome line: code + text. Accepts the canonical forms (ENG.5.2.L1, FB.5.1.1, MAT.5.1.1,
// T.D.5.3, SB.5.1.1, for any grade) and the irregular spellings that occur on the MEB pages:
//   "ENG5.7.L1."  (no dot after prefix), "ENG.5.8.R 4." (space inside), "SB.5.5.1.Metin" (no space before text)
const OUTCOME_LINE_RE =
  /^([A-ZÇĞİÖŞÜ]{1,4}(?:\.[A-ZÇĞİÖŞÜ])?)(\.?)(\d+)((?:\.\s?[A-Z]{0,2}\s?\d+)+)\.?(\s*)(\S[\s\S]*)$/;

export interface ParsedCode {
  code: string; // canonical form (dots between segments, no spaces)
  printed: string; // exactly as printed on the page, without the trailing dot
  text: string;
  irregular: string[]; // spelling deviations that change the code itself -> REVIEW_REQUIRED
  notes: string[]; // cosmetic deviations (e.g. missing space before the text)
}

export function parseOutcomeLine(line: string): ParsedCode | null {
  const m = line.match(OUTCOME_LINE_RE);
  if (!m) return null;
  const [, prefix, dot, grade, rest, space, text] = m;
  const printed = `${prefix}${dot}${grade}${rest}`;
  const code = `${prefix}.${grade}${rest.replace(/\s+/g, "")}`;
  const irregular: string[] = [];
  const notes: string[] = [];
  if (!dot) irregular.push(`Kod sayfada "${printed}" olarak yazılmış (önekten sonra nokta yok); "${code}" olarak normalize edildi`);
  if (/\s/.test(rest)) irregular.push(`Kod sayfada "${printed}" olarak yazılmış (kod içinde boşluk var); "${code}" olarak normalize edildi`);
  if (!space) notes.push(`Sayfada kod ile metin arasında boşluk yok: "${line.slice(0, printed.length + 12)}"`);
  return { code, printed, text, irregular, notes };
}

const COMPONENT_RE = /^([a-zçğıöşü])\)\s*([\s\S]*)$/;

/** Grade segment of an outcome code: the first purely numeric segment after the prefix. */
export function gradeFromCode(code: string): number | null {
  const m = code.match(/^[A-ZÇĞİÖŞÜ]{1,4}(?:\.[A-ZÇĞİÖŞÜ])?\.(\d+)\./);
  return m ? Number(m[1]) : null;
}

/**
 * Split a block of HTML into text segments at <p>/<br>/<li>/heading boundaries.
 * `bold` = every non-space character of the segment is inside <strong>/<b>.
 */
export function segments($: cheerio.CheerioAPI, el: AnyNode) {
  const out: { text: string; bold: boolean }[] = [];
  let buf = "";
  let boldChars = 0;
  let allChars = 0;
  const flush = () => {
    const text = clean(buf);
    if (text) out.push({ text, bold: boldChars > 0 && boldChars === allChars });
    buf = "";
    boldChars = 0;
    allChars = 0;
  };
  const BLOCK = new Set(["p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table"]);
  const walk = (node: AnyNode, bold: boolean) => {
    if (node.type === "text") {
      const t = (node as Text).data;
      buf += t;
      const n = t.replace(/[\s ]/g, "").length;
      allChars += n;
      if (bold) boldChars += n;
      return;
    }
    if (node.type !== "tag") return;
    const name = (node as Element).name;
    if (name === "br") return flush();
    const isBlock = BLOCK.has(name);
    if (isBlock) flush();
    const b = bold || name === "strong" || name === "b";
    for (const c of (node as Element).children) walk(c, b);
    if (isBlock) flush();
  };
  for (const c of "children" in el ? el.children : []) walk(c, false);
  flush();
  return out;
}

/** Split a field such as "D1. Adalet, D3. Çalışkanlık" into items, one per code. */
export function splitCodedList(text: string): string[] {
  const t = clean(text).replace(/,\s*$/, "");
  if (!t || t === "_" || t === "-") return [];
  const CODE = String.raw`[A-ZÇĞİÖŞÜ]{1,5}\d+(?:\.\d+)*\.?`;
  if (!new RegExp(`^${CODE}\\s`).test(t)) {
    // No leading code: plain comma-separated list (e.g. interdisciplinary relations).
    return t.split(/\s*,\s*/).map(clean).filter(Boolean);
  }
  // Split only before a code that follows a comma or whitespace (not one inside parentheses).
  return t
    .split(new RegExp(`(?:,\\s*|\\s+)(?=${CODE}\\s)`))
    .map((s) => clean(s).replace(/,$/, ""))
    .filter(Boolean);
}

export interface ParsedOutcome {
  code: string | null;
  codeAsPrinted: string | null;
  text: string;
  group: string | null;
  components: string[];
  issues: string[]; // problems that make the record REVIEW_REQUIRED
  notes: string[]; // harmless parsing notes (e.g. a wrapped line was joined)
}

export interface ParsedUnitPage {
  meta: string[]; // e.g. ["Fen Bilimleri Dersi", "5.Sınıf"]
  title: string;
  subtitle: string | null;
  intro: string | null;
  fields: Record<string, { text: string; segments: { text: string; bold: boolean }[] }>;
  outcomes: ParsedOutcome[];
  outcomeIssues: string[];
}

export const FIELD_OUTCOMES = "Öğrenme Çıktıları ve Süreç Bileşenleri";

export function parseUnitPage(html: string): ParsedUnitPage {
  const $ = cheerio.load(html);
  const meta = $(".unite-detail__meta .unite-detail__meta-item")
    .map((_, e) => clean($(e).text()))
    .get();
  const title = clean($("h1.unite-detail__title").first().text());
  const subtitle = clean($(".unite-detail__subtitle").first().text()) || null;
  const intro = clean($(".unite-detail__intro").first().text()) || null;

  const fields: ParsedUnitPage["fields"] = {};
  let outcomesEl: AnyNode | null = null;
  $(".unite-detail__fields .row").each((_, row) => {
    const t = $(row).children(".title");
    const c = $(row).children(".content");
    if (!t.length || !c.length) return;
    const name = clean(t.text());
    if (!name || fields[name]) return;
    fields[name] = { text: clean(c.text()), segments: segments($, c[0]) };
    if (name === FIELD_OUTCOMES) outcomesEl = c[0];
  });

  const outcomes: ParsedOutcome[] = [];
  const outcomeIssues: string[] = [];
  if (!outcomesEl) {
    outcomeIssues.push(`"${FIELD_OUTCOMES}" alanı sayfada bulunamadı`);
  } else {
    let group: string | null = null;
    let cur: ParsedOutcome | null = null;
    let pendingLabel: string | null = null;
    // Some pages put several items on one line without a break ("... level. c) Students ...",
    // "... level. ENG.5.6.W4. Students ..."). Split before an inline component label or outcome code.
    // Also "...words.e) Students" (label glued to the previous sentence's full stop).
    const INLINE_SPLIT = /\s+(?=[a-zçğıöşü]\)\s*[A-ZÇĞİÖŞÜ])|(?<=[.!?;])(?=[a-zçğıöşü]\)\s*[A-ZÇĞİÖŞÜ])|\s+(?=[A-ZÇĞİÖŞÜ]{1,4}(?:\.[A-ZÇĞİÖŞÜ])?\.?\d+(?:\.\s?[A-Z]{0,2}\s?\d+)+\.?\s*[A-ZÇĞİÖŞÜ])/;
    const segs: { text: string; bold: boolean; split: boolean }[] = [];
    for (const seg of segments($, outcomesEl)) {
      const parts = seg.text.split(INLINE_SPLIT).filter(Boolean);
      for (const t of parts) segs.push({ text: t, bold: seg.bold, split: parts.length > 1 });
    }
    for (const seg of segs) {
      const om = parseOutcomeLine(seg.text);
      const cm = seg.text.match(COMPONENT_RE);
      if (om) {
        cur = { code: om.code, codeAsPrinted: om.printed, text: om.text, group, components: [], issues: om.irregular, notes: om.notes };
        if (seg.split) cur.notes.push("Sayfada önceki öğe ile aynı satırda yazılmış; ayrıldı");
        outcomes.push(cur);
        pendingLabel = null;
      } else if (cm && cur) {
        if (seg.split) cur.notes.push(`"${cm[1]})" bileşeni sayfada önceki öğe ile aynı satırda yazılmış; ayrıldı`);
        if (cm[2]) cur.components.push(`${cm[1]}) ${cm[2]}`);
        else pendingLabel = cm[1]; // "a)" alone on its line; text follows in next segment
      } else if (pendingLabel && cur) {
        cur.components.push(`${pendingLabel}) ${seg.text}`);
        pendingLabel = null;
      } else if (seg.bold && /^[A-ZÇĞİÖŞÜ]/.test(seg.text) && seg.text.length <= 40) {
        // A short, fully bold, capitalised line without a code is a sub-heading (e.g. Türkçe "Okuma").
        group = seg.text;
        cur = null;
      } else if (cur && /^[A-ZÇĞİÖŞÜ]{1,4}\.?\s?\d/.test(seg.text)) {
        // Looks like a code we could not parse: never glue it onto the previous outcome.
        outcomeIssues.push(`Kod benzeri ama ayrıştırılamayan satır: "${seg.text.slice(0, 120)}"`);
        cur = null;
      } else if (cur) {
        // Continuation of the previous line (outcome text or last process component).
        if (cur.components.length) {
          cur.components[cur.components.length - 1] += ` ${seg.text}`;
        } else {
          cur.text = `${cur.text} ${seg.text}`;
        }
        cur.notes.push(`Satır devamı birleştirildi: "${seg.text.slice(0, 60)}"`);
      } else {
        outcomeIssues.push(`Kod içermeyen, sınıflandırılamayan satır: "${seg.text.slice(0, 120)}"`);
      }
    }
    if (pendingLabel && cur) cur.issues.push(`Süreç bileşeni "${pendingLabel})" metni eksik`);
    const TR = "abcçdefgğhıijklmnoöprsştuüvyz";
    const EN = "abcdefghijklmnopqrstuvwxyz";
    for (const o of outcomes) {
      const labels = o.components.map((c) => c[0]).join("");
      if (labels && !TR.startsWith(labels) && !EN.startsWith(labels))
        o.issues.push(`Süreç bileşeni harf sırası beklenen gibi değil: "${labels}"`);
    }
  }
  return { meta, title, subtitle, intro, fields, outcomes, outcomeIssues };
}
