// Parsing of the course list (JSON), a course page (grade cards) and a program page
// (theme/unit links for one grade).

import * as cheerio from "cheerio";
import { BASE_URL } from "./curriculum-config.ts";
import { clean } from "./parse-unit.ts";

export interface CourseListPage {
  items: { id: number; dersAdi: string; url: string }[];
  hasMore: boolean;
}

export const parseCourseList = (json: string): CourseListPage => {
  const j = JSON.parse(json);
  return { items: j.items ?? [], hasMore: Boolean(j.hasMore) };
};

export interface ParsedCoursePage {
  heading: string;
  grades: { label: string; grade: number | null; url: string }[];
}

/** Course page "/ogretim-programlari/ders/<slug>": one card per grade ("6.Sınıf" -> program URL). */
export function parseCoursePage(html: string): ParsedCoursePage {
  const $ = cheerio.load(html);
  const heading = clean($("h1.sinif-page-header__title").first().text());
  const grades: ParsedCoursePage["grades"] = [];
  $("a.sinif-card__link").each((_, a) => {
    const label = clean($(a).find(".sinif-card__title").text());
    const m = label.match(/^(\d+)\s*\.\s*Sınıf$/);
    grades.push({ label, grade: m ? Number(m[1]) : null, url: new URL($(a).attr("href") ?? "", BASE_URL).toString() });
  });
  return { heading, grades };
}

export interface ParsedProgramPage {
  heading: string;
  links: { href: string; url: string; title: string }[];
}

export function parseProgramPage(html: string): ParsedProgramPage {
  const $ = cheerio.load(html);
  const heading = clean($("h1.unite-page-header__title").first().text());
  const links: ParsedProgramPage["links"] = [];
  $(".unite-list a.unite-list-item__link").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    links.push({
      href,
      url: new URL(href, BASE_URL).toString(),
      title: clean($(a).find(".unite-list-item__title").text()),
    });
  });
  return { heading, links };
}

