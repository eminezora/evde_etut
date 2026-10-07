"use client";

// Deadline picker: calendar day + hour + minute in Türkiye time (UTC+03:00). Reports the ISO instant.
import { useState } from "react";
import { isoToTurkeyParts, turkeyDeadlineToIso, turkeyToday } from "@/lib/assignments/deadline.ts";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function DeadlinePicker({ initialIso, onChange, error }: { initialIso?: string; onChange: (iso: string) => void; error?: React.ReactNode }) {
  const start = initialIso ? isoToTurkeyParts(initialIso) : { date: "", hour: "17", minute: "00" };
  const [date, setDate] = useState(start.date);
  const [hour, setHour] = useState(start.hour);
  const [minute, setMinute] = useState(start.minute);
  // Keep an existing off-grid minute (e.g. 07) selectable.
  const minutes = MINUTES.includes(start.minute) ? MINUTES : [...MINUTES, start.minute].sort();
  const update = (d: string, h: string, m: string) => {
    setDate(d);
    setHour(h);
    setMinute(m);
    onChange(turkeyDeadlineToIso(d, h, m));
  };

  return (
    <fieldset className="deadline-picker">
      <legend>Son Teslim Tarihi</legend>
      <div className="deadline-row">
        <div>
          <label htmlFor="deadline" className="sub-label">Gün</label>
          <input
            id="deadline"
            type="date"
            min={turkeyToday()}
            value={date}
            onChange={(e) => update(e.target.value, hour, minute)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                /* picker not available: the input still accepts typing */
              }
            }}
            required
          />
        </div>
        <div>
          <label htmlFor="deadline-hour" className="sub-label">Saat</label>
          <select id="deadline-hour" value={hour} onChange={(e) => update(date, e.target.value, minute)}>
            {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deadline-minute" className="sub-label">Dakika</label>
          <select id="deadline-minute" value={minute} onChange={(e) => update(date, hour, e.target.value)}>
            {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <span className="muted" style={{ fontSize: "0.82rem" }}>Türkiye saati. Öğrencilerin derse gelmeden önceki son saati.</span>
      {error}
    </fieldset>
  );
}
