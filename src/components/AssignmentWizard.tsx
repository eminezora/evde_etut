"use client";

// Teacher assignment wizard: Classroom -> Subject -> Theme/Unit -> MEB outcomes -> details.
// Every option list is fetched on demand from the curriculum API for the chosen classroom;
// the grade always comes from the classroom on the server. The same Zod schema the server
// uses gives immediate feedback here, but the server re-validates everything.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createAssignmentSchema, fieldErrors } from "@/lib/assignments/assignment-schema.ts";
import { turkeyDeadlineToIso, turkeyToday } from "@/lib/assignments/deadline.ts";

interface Classroom {
  id: string;
  name: string;
  grade: number;
}
interface Unit {
  unitOrTheme: string;
  unitOrThemeCode: string | null;
}
interface Outcome {
  id: string;
  outcomeCode: string;
  outcomeText: string;
  sourceUrl: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const STEPS = ["Sınıf", "Ders", "Tema / Ünite", "Öğrenme Çıktısı", "Detaylar"];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Veri alınamadı.");
  return body as T;
}

export function AssignmentWizard({ classrooms }: { classrooms: Classroom[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [classroomId, setClassroomId] = useState("");
  const [subject, setSubject] = useState("");
  const [unitOrTheme, setUnitOrTheme] = useState("");
  const [selected, setSelected] = useState<Map<string, Outcome>>(new Map());
  const [topic, setTopic] = useState("");
  const [minimumScore, setMinimumScore] = useState("70");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineHour, setDeadlineHour] = useState("17");
  const [deadlineMinute, setDeadlineMinute] = useState("00");
  const [questionCount, setQuestionCount] = useState("7");

  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const classroom = classrooms.find((c) => c.id === classroomId);

  // Each list is fetched only when its parent selection changes.
  useEffect(() => {
    if (!classroomId) return;
    let live = true;
    getJson<{ subjects: string[] }>(`/api/curriculum/subjects?classroomId=${encodeURIComponent(classroomId)}`)
      .then((d) => live && setSubjects(d.subjects))
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [classroomId]);

  useEffect(() => {
    if (!classroomId || !subject) return;
    let live = true;
    const q = new URLSearchParams({ classroomId, subject });
    getJson<{ units: Unit[] }>(`/api/curriculum/units?${q}`)
      .then((d) => live && setUnits(d.units))
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [classroomId, subject]);

  useEffect(() => {
    if (!classroomId || !subject || !unitOrTheme) return;
    let live = true;
    const q = new URLSearchParams({ classroomId, subject, unitOrTheme });
    getJson<{ outcomes: Outcome[] }>(`/api/curriculum/outcomes?${q}`)
      .then((d) => live && setOutcomes(d.outcomes))
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [classroomId, subject, unitOrTheme]);

  // Changing a parent selection resets everything below it.
  const pickClassroom = (id: string) => {
    setClassroomId(id);
    setSubject("");
    setSubjects(null);
    setUnitOrTheme("");
    setUnits(null);
    setOutcomes(null);
    setSelected(new Map());
  };
  const pickSubject = (s: string) => {
    setSubject(s);
    setUnitOrTheme("");
    setUnits(null);
    setOutcomes(null);
    setSelected(new Map());
  };
  const pickUnit = (u: string) => {
    setUnitOrTheme(u);
    setOutcomes(null);
    setSelected(new Map());
  };
  const toggleOutcome = (o: Outcome) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(o.id)) next.delete(o.id);
      else next.set(o.id, o);
      return next;
    });

  const canNext = [Boolean(classroomId), Boolean(subject), Boolean(unitOrTheme), selected.size > 0, true][step];
  const selectedList = useMemo(() => [...selected.values()], [selected]);

  async function save() {
    const input = {
      classroomId,
      subject,
      unitOrTheme,
      topic,
      outcomeIds: [...selected.keys()],
      minimumScore,
      deadline: turkeyDeadlineToIso(deadlineDate, deadlineHour, deadlineMinute),
      questionCount,
      status: "DRAFT" as const,
    };
    const check = createAssignmentSchema.safeParse(input);
    if (!check.success) {
      setErrors(fieldErrors(check.error));
      return;
    }
    setSaving(true);
    setErrors({});
    const res = await fetch("/api/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setErrors(body?.errors ?? { _form: ["Görev kaydedilemedi."] });
      return;
    }
    router.push(`/ogretmen/gorevler/${body.id}?tab=hazirlik`);
    router.refresh();
  }

  const errorList = (key: string) => errors[key]?.map((m) => <p key={m} className="error" role="alert">{m}</p>);

  return (
    <div className="card" style={{ padding: "28px 24px" }}>
      {/* Wizard Steps Navigation */}
      <ol className="steps" aria-label="Görev oluşturma adımları">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "active" : ""}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {loadError && <p className="error" role="alert">{loadError}</p>}

      {step === 0 && (
        <section>
          <h2>Adım 1 – Hedef Sınıfı Seçin</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Görevin atanacağı sınıfı belirleyin. Müfredat çıktısı bu sınıfın düzeyine göre otomatik filtrelenecektir.
          </p>
          {classrooms.length === 0 ? (
            <p className="muted">Size ait sınıf bulunamadı.</p>
          ) : (
            <div className="card-grid" role="radiogroup">
              {classrooms.map((c) => (
                <label
                  key={c.id}
                  className={`task-card ${c.id === classroomId ? "selected" : ""}`}
                  style={{
                    cursor: "pointer",
                    borderColor: c.id === classroomId ? "var(--accent)" : "var(--border)",
                    background: c.id === classroomId ? "var(--accent-light)" : "var(--surface)",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="badge" style={{ background: c.id === classroomId ? "var(--accent)" : "var(--surface-subtle)", color: c.id === classroomId ? "#fff" : "var(--text)" }}>
                      {c.grade}. Sınıf
                    </span>
                    <input
                      type="radio"
                      name="classroom"
                      checked={c.id === classroomId}
                      onChange={() => pickClassroom(c.id)}
                      style={{ margin: 0 }}
                    />
                  </div>
                  <strong style={{ fontSize: "1.2rem", marginTop: 8 }}>{c.name} Şubesi</strong>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    T.C. MEB {c.grade}. sınıf öğretim programı
                  </span>
                </label>
              ))}
            </div>
          )}
          {classroom && (
            <div className="info" style={{ marginTop: 16 }}>
              ✓ <strong>{classroom.name}</strong> ({classroom.grade}. sınıf) seçildi.
            </div>
          )}
        </section>
      )}

      {step === 1 && (
        <section>
          <h2>Adım 2 – Ders Seçin</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            {classroom?.grade}. sınıf MEB müfredatında yer alan dersler:
          </p>
          {!subjects ? (
            <p className="muted">Müfredat dersleri yükleniyor…</p>
          ) : subjects.length === 0 ? (
            <p className="muted">Bu sınıf düzeyi için ders verisi bulunamadı.</p>
          ) : (
            <div className="card-grid" role="radiogroup">
              {subjects.map((s) => (
                <label
                  key={s}
                  className={`task-card ${s === subject ? "selected" : ""}`}
                  style={{
                    cursor: "pointer",
                    borderColor: s === subject ? "var(--accent)" : "var(--border)",
                    background: s === subject ? "var(--accent-light)" : "var(--surface)",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="badge">Ders</span>
                    <input
                      type="radio"
                      name="subject"
                      checked={s === subject}
                      onChange={() => pickSubject(s)}
                      style={{ margin: 0 }}
                    />
                  </div>
                  <strong style={{ fontSize: "1.15rem", marginTop: 8 }}>{s}</strong>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>Resmi Öğretim Programı</span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>Adım 3 – Tema / Ünite Seçin</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            {classroom?.grade}. sınıf {subject} dersi üniteleri:
          </p>
          {!units ? (
            <p className="muted">Üniteler yükleniyor…</p>
          ) : (
            <div className="option-list" role="radiogroup">
              {units.map((u) => (
                <label
                  key={u.unitOrTheme}
                  className={`option ${u.unitOrTheme === unitOrTheme ? "selected" : ""}`}
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="unit"
                    checked={u.unitOrTheme === unitOrTheme}
                    onChange={() => pickUnit(u.unitOrTheme)}
                  />
                  <div>
                    <strong style={{ display: "block" }}>{u.unitOrTheme}</strong>
                    {u.unitOrThemeCode && (
                      <span className="muted" style={{ fontSize: "0.85rem" }}>Kod: {u.unitOrThemeCode}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section>
          <h2>Adım 4 – MEB Öğrenme Çıktısı (Kazanım)</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Öğrencilerin derse gelmeden önce hazır olması gereken kazanımı veya kazanımları seçin:
          </p>
          {!outcomes ? (
            <p className="muted">Kazanımlar yükleniyor…</p>
          ) : (
            <div className="option-list">
              {outcomes.map((o) => (
                <label
                  key={o.id}
                  className={`option ${selected.has(o.id) ? "selected" : ""}`}
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOutcome(o)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                      <span className="code" style={{ display: "inline" }}>{o.outcomeCode}</span>
                      <span className="badge PUBLISHED" style={{ fontSize: "0.75rem" }}>Doğrulanmış MEB Çıktısı</span>
                    </div>
                    <div style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>{o.outcomeText}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {selectedList.length > 0 && (
            <div className="info" style={{ marginTop: 18 }}>
              <strong>Seçilen Kazanımlar ({selectedList.length}):</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {selectedList.map((o) => (
                  <li key={o.id}>
                    <strong>{o.outcomeCode}</strong>: {o.outcomeText}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {errorList("outcomeIds")}
        </section>
      )}

      {step === 4 && (
        <section>
          <h2>Adım 5 – Görev Detayları & Ayarlar</h2>
          <div className="card" style={{ background: "var(--surface-subtle)", padding: "16px 20px", marginBottom: 20 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="badge" style={{ background: "var(--accent)", color: "#fff" }}>{classroom?.name} ({classroom?.grade}. sınıf)</span>
              <span className="badge">{subject}</span>
              <span className="badge">{unitOrTheme}</span>
              <span className="badge PUBLISHED">{selected.size} MEB Çıktısı</span>
            </div>
          </div>

          <label htmlFor="topic">Görev Başlığı / Konu</label>
          <input
            id="topic"
            type="text"
            placeholder="Örn. Güneş ve Ay: Temel Hareketler ve Özellikler"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={200}
            required
          />
          {errorList("topic")}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div>
              <label htmlFor="minimumScore">Derse Hazır Olma Eşiği (%)</label>
              <input
                id="minimumScore"
                type="number"
                min={0}
                max={100}
                step={1}
                value={minimumScore}
                onChange={(e) => setMinimumScore(e.target.value)}
              />
              <span className="muted" style={{ fontSize: "0.82rem" }}>Öğrencinin &ldquo;Derse Hazırım&rdquo; sayılması için gereken puan (varsayılan %70).</span>
              {errorList("minimumScore")}
            </div>

            <div>
              <label htmlFor="questionCount">Ön Bilgi Soru Sayısı</label>
              <input
                id="questionCount"
                type="number"
                min={5}
                max={10}
                step={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
              />
              <span className="muted" style={{ fontSize: "0.82rem" }}>5–10 soru arası formatif kontrol sorusu.</span>
              {errorList("questionCount")}
            </div>

            <fieldset className="deadline-picker">
              <legend>Son Teslim Tarihi</legend>
              <div className="deadline-row">
                <div>
                  <label htmlFor="deadline" className="sub-label">Gün</label>
                  <input
                    id="deadline"
                    type="date"
                    min={turkeyToday()}
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
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
                  <select id="deadline-hour" value={deadlineHour} onChange={(e) => setDeadlineHour(e.target.value)}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="deadline-minute" className="sub-label">Dakika</label>
                  <select id="deadline-minute" value={deadlineMinute} onChange={(e) => setDeadlineMinute(e.target.value)}>
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                Türkiye saati. Öğrencilerin derse gelmeden önceki son saati.
              </span>
              {errorList("deadline")}
            </fieldset>
          </div>

          {errorList("outcomeIds")}
          {errorList("classroomId")}
          {errorList("subject")}
          {errorList("unitOrTheme")}
          {errorList("_form")}

          <div className="info" style={{ marginTop: 20 }}>
            ℹ️ <strong>Taslak Kaydı:</strong> Görev taslak olarak kaydedildikten sonra, doğrudan hazırlık içeriği düzenleyicisine yönlendirileceksiniz. Orada EVREN yapay zekâsıyla özet ve soruları tek tıkla üretebilir ve onaylayıp yayınlayabilirsiniz.
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="primary"
              onClick={save}
              disabled={saving || selected.size === 0}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {saving ? "Kaydediliyor…" : "Taslak Olarak Kaydet ve İçeriğe Geç →"}
            </button>
          </div>
        </section>
      )}

      {/* Navigation Footer */}
      <div className="row" style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          ← Geri
        </button>

        {step < STEPS.length - 1 && (
          <button
            type="button"
            className="primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
          >
            İleri →
          </button>
        )}
      </div>
    </div>
  );
}
