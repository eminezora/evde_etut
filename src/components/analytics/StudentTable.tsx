"use client";

// Student table with status filters and name search (data already loaded server-side).
import Link from "next/link";
import { useMemo, useState } from "react";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/analytics/report-labels.ts";

type Status = ReportStatus;
export interface StudentRow {
  studentId: string;
  name: string;
  status: Status;
  statusLabel: string;
  summaryOpened: string | null;
  summaryConfirmed: string | null;
  attemptCount: number;
  latestScore: number | null;
  bestScore: number | null;
  completedAt: string | null;
}

const ORDER: Status[] = ["READY", "NEEDS_REVIEW", "PENDING_REVIEW", "NOT_STARTED", "IN_PROGRESS", "EXPIRED"];
const FILTERS: { key: "ALL" | Status; label: string }[] = [{ key: "ALL", label: "Tümü" }, ...ORDER.map((k) => ({ key: k, label: REPORT_STATUS_LABELS[k] }))];

const ICON: Record<Status, string> = { READY: "✓", NEEDS_REVIEW: "↻", PENDING_REVIEW: "⏳", IN_PROGRESS: "…", NOT_STARTED: "○", EXPIRED: "✕" };

export function StudentTable({ assignmentId, rows }: { assignmentId: string; rows: StudentRow[] }) {
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((r) => (filter === "ALL" || r.status === filter) && (!needle || r.name.toLocaleLowerCase("tr-TR").includes(needle)));
  }, [rows, filter, q]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, f.key === "ALL" ? rows.length : rows.filter((r) => r.status === f.key).length])), [rows]);

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 10 }}>
        <div className="filter-chips" role="group" aria-label="Duruma göre filtrele">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} className={filter === f.key ? "chip active" : "chip"} onClick={() => setFilter(f.key)}>
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>
        <label htmlFor="student-search" className="sr-only">Öğrenci ara</label>
        <input id="student-search" type="search" placeholder="Öğrenci ara…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Öğrenci</th><th>Özeti Açtı</th><th>Özeti Onayladı</th><th>Deneme</th><th>Son Puan</th><th>En İyi Puan</th><th>Durum</th><th>Tamamlama</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.studentId}>
                <td><Link href={`/ogretmen/gorevler/${assignmentId}/ogrenci/${r.studentId}`}>{r.name}</Link></td>
                <td>{r.summaryOpened ?? "—"}</td>
                <td>{r.summaryConfirmed ?? "—"}</td>
                <td>{r.attemptCount}</td>
                <td>{r.latestScore === null ? "—" : `%${r.latestScore}`}</td>
                <td>{r.bestScore === null ? "—" : `%${r.bestScore}`}</td>
                <td><span aria-hidden="true">{ICON[r.status]} </span>{r.statusLabel}</td>
                <td>{r.completedAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="muted">Bu filtreye uyan öğrenci yok.</p>}
    </>
  );
}
