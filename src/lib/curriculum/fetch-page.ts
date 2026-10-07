// Polite, cached page fetcher. One instance per grade: pages are cached under
// data/curriculum/raw/grade-<n>/html and every download is recorded in fetch-log.json.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { BASE_URL } from "./curriculum-config.ts";

const DELAY_MS = 1500;
const MAX_RETRIES = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; curriculum-fetch/1.0; low-rate, cached)";

export interface FetchLogEntry {
  url: string;
  cacheFile: string;
  status: number;
  fetchedAt: string;
  bytes: number;
  sha256: string;
}

export interface VisitedEntry {
  url: string;
  fromCache: boolean;
  ok: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Shared across all fetchers so the delay holds even when several grades run in one process.
let lastNetworkAt = 0;

export const cacheName = (url: string) => {
  const u = new URL(url);
  const name = (u.pathname + (u.search ? `_${u.search.slice(1)}` : "")).replace(/^\/+/, "").replace(/[^a-zA-Z0-9-]+/g, "_");
  return `${name}.html`;
};

export class PageFetcher {
  fetchLog: Record<string, FetchLogEntry> = {};
  visited: VisitedEntry[] = [];
  private logFile: string;

  constructor(
    private rawDir: string,
    private refresh = false,
  ) {
    this.logFile = `${rawDir}/fetch-log.json`;
  }

  async init() {
    await mkdir(`${this.rawDir}/html`, { recursive: true });
    if (existsSync(this.logFile)) this.fetchLog = JSON.parse(await readFile(this.logFile, "utf8"));
  }

  async save() {
    await writeFile(this.logFile, JSON.stringify(this.fetchLog, null, 2));
  }

  async get(url: string): Promise<{ html: string; fetchedAt: string } | null> {
    if (!url.startsWith(`${BASE_URL}/`)) throw new Error(`Refusing non-MEB URL: ${url}`);
    const file = `${this.rawDir}/html/${cacheName(url)}`;
    if (!this.refresh && existsSync(file) && this.fetchLog[url]) {
      this.visited.push({ url, fromCache: true, ok: true });
      return { html: await readFile(file, "utf8"), fetchedAt: this.fetchLog[url].fetchedAt };
    }
    let lastErr = "";
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const wait = lastNetworkAt + DELAY_MS * attempt - Date.now();
      if (wait > 0) await sleep(wait);
      lastNetworkAt = Date.now();
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "tr" } });
        const html = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fetchedAt = new Date().toISOString();
        await writeFile(file, html);
        this.fetchLog[url] = {
          url,
          cacheFile: `html/${cacheName(url)}`,
          status: res.status,
          fetchedAt,
          bytes: Buffer.byteLength(html),
          sha256: createHash("sha256").update(html).digest("hex"),
        };
        this.visited.push({ url, fromCache: false, ok: true });
        console.log(`  fetched ${url}`);
        return { html, fetchedAt };
      } catch (e) {
        lastErr = (e as Error).message;
        console.warn(`  attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${lastErr}`);
      }
    }
    this.visited.push({ url, fromCache: false, ok: false, error: lastErr });
    return null;
  }
}
