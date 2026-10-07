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
  /** Exact workflow state (e.g. "Özet Okunuyor") shown under the report status. */
  detailedStatus: string;
  summaryOpened: string | null;
  summaryConfirmed: string | null;
  startedAt: string | null;
  attemptCount: number;
  latestPoints: string | null;
  latestScore: number | null;
  bestScore: number | null;
  completedAt: string | null;
}

const FILTERS: { key: "ALL" | Status; label: string }[] = [
  { key: "ALL", label: "Tümü" },
  { key: "READY", label: REPORT_STATUS_LABELS.READY },
  { key: "NEEDS_REVIEW", label: REPORT_STATUS_LABELS.NEEDS_REVIEW },
  { key: "NOT_STARTED", label: REPORT_STATUS_LABELS.NOT_STARTED },
  { key: "IN_PROGRESS", label: "Devam Ediyor" },
  { key: "PENDING_REVIEW", label: REPORT_STATUS_LABELS.PENDING_REVIEW },
  { key: "EXPIRED", label: REPORT_STATUS_LABELS.EXPIRED },
];

const ICON: Record<Status, string> = { READY: "✓", NEEDS_REVIEW: "↻", PENDING_REVIEW: "⏳", IN_PROGRESS: "…", NOT_STARTED: "○", EXPIRED: "✕" };

function outcomeLabel(r: StudentRow) {
  if (r.status === "READY") return "Derse Hazır";
  if (r.status === "NEEDS_REVIEW") return "Tekrar Gerekli";
  return "—";
}

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
        <input id="student-search" type="search" placeholder="Öğrenci adına göre ara…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Durum</th>
              <th>Başlama</th>
              <th>Tamamlama</th>
              <th>Deneme</th>
              <th>Puan</th>
              <th>Başarı</th>
              <th>Sonuç</th>
              <th>Değerlendirme</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.studentId}>
                <td><Link href={`/ogretmen/ogrenciler/${r.studentId}`} title="Öğrencinin geçmiş performansı">{r.name}</Link></td>
                <td>
                  <span aria-hidden="true">{ICON[r.status]} </span>{r.statusLabel}
                  {r.detailedStatus !== r.statusLabel && <div className="muted" style={{ fontSize: "0.78rem" }}>{r.detailedStatus}</div>}
                </td>
                <td>{r.startedAt ?? r.summaryOpened ?? "—"}</td>
                <td>{r.completedAt ?? "—"}</td>
                <td>{r.attemptCount}</td>
                <td>{r.latestPoints ?? "—"}</td>
                <td>{r.latestScore === null ? "—" : `%${r.latestScore}`}</td>
                <td>{outcomeLabel(r)}</td>
                <td>{r.status === "PENDING_REVIEW" ? <span className="badge" style={{ background: "var(--info-bg)", color: "var(--info-text)" }}>Bekliyor</span> : "—"}</td>
                <td className="no-print">
                  {r.attemptCount > 0 ? (
                    <Link href={`/ogretmen/gorevler/${assignmentId}/ogrenci/${r.studentId}`} className="button" style={{ minHeight: 30, padding: "3px 10px", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      Cevapları Gör
                    </Link>
                  ) : (
                    <span className="muted" style={{ fontSize: "0.82rem" }}>Cevap yok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="muted">Bu filtreye uyan öğrenci yok.</p>}
    </>
  );
}
