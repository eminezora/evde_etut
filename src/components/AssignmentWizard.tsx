"use client";

// Teacher assignment wizard: Vertical stepper + workspace approach
// Sol: Sınıf, Ders, Tema/Ünite, MEB Öğrenme Çıktıları, Ayarlar, İçerik, Yayınla
// Sağ: Aktif adımın geniş, ferah ve okunabilir editoryal çalışma alanı.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createAssignmentSchema, fieldErrors } from "@/lib/assignments/assignment-schema.ts";
import { DeadlinePicker } from "./DeadlinePicker.tsx";

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

const WIZARD_STEPS = [
  { id: 0, title: "Sınıf", subtitle: "Hedef şube seçimi" },
  { id: 1, title: "Ders", subtitle: "MEB öğretim alanı" },
  { id: 2, title: "Tema / Ünite", subtitle: "Müfredat ünitesi" },
  { id: 3, title: "MEB Çıktıları", subtitle: "Kazanım eşleştirmesi" },
  { id: 4, title: "Ayarlar", subtitle: "Başlık, eşik ve süre" },
  { id: 5, title: "İçerik", subtitle: "AI / Manuel ders notu" },
  { id: 6, title: "Yayınla", subtitle: "Öğrenci erişimi" },
];

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
  const [deadline, setDeadline] = useState("");
  const [questionCount, setQuestionCount] = useState("7");

  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const classroom = classrooms.find((c) => c.id === classroomId);

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

  const pickClassroom = (id: string) => {
    setClassroomId(id);
    setSubject("");
    setSubjects(null);
    setUnitOrTheme("");
    setUnits(null);
    setSelected(new Map());
    setOutcomes(null);
    setStep(1);
  };

  const pickSubject = (s: string) => {
    setSubject(s);
    setUnitOrTheme("");
    setUnits(null);
    setSelected(new Map());
    setOutcomes(null);
    setStep(2);
  };

  const pickUnit = (u: string) => {
    setUnitOrTheme(u);
    setSelected(new Map());
    setOutcomes(null);
    setStep(3);
  };

  const toggleOutcome = (o: Outcome) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(o.id)) next.delete(o.id);
      else next.set(o.id, o);
      return next;
    });
  };

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(classroomId);
    if (step === 1) return Boolean(subject);
    if (step === 2) return Boolean(unitOrTheme);
    if (step === 3) return selected.size > 0;
    return true;
  }, [step, classroomId, subject, unitOrTheme, selected]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const payload = {
      classroomId,
      subject,
      unitOrTheme,
      topic,
      outcomeIds: selectedList.map((o) => o.id),
      minimumScore: Number(minimumScore),
      deadline: deadline ? new Date(deadline) : new Date(NaN),
      questionCount: Number(questionCount),
    };

    const parsed = createAssignmentSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setSaving(false);
      return;
    }

    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setErrors((body?.errors as Record<string, string[]>) ?? { _form: [body?.error ?? "Kayıt başarısız."] });
      return;
    }
    router.push(`/ogretmen/gorevler/${body.data.id}/duzenle`);
    router.refresh();
  };

  const errorList = (key: string) =>
    errors[key]?.length ? (
      <div className="error" role="alert" style={{ marginTop: 6 }}>
        {errors[key].map((m, i) => (
          <p key={i} style={{ margin: "2px 0" }}>{m}</p>
        ))}
      </div>
    ) : null;

  return (
    <div className="editorial-stepper-container">
      {/* Sol Sütun: Vertical Stepper Rail */}
      <aside className="stepper-rail">
        <span className="kicker" style={{ fontSize: "0.72rem" }}>GÖREV PLANLAYICI</span>
        <h3 style={{ fontSize: "1.05rem", margin: "2px 0 16px" }}>Hazırlık Adımları</h3>

        <ul className="vertical-steps">
          {WIZARD_STEPS.map((s, idx) => {
            const isActive = step === idx;
            const isDone = step > idx;
            return (
              <li
                key={s.id}
                className={`vertical-step-item ${isActive ? "active" : isDone ? "done" : ""}`}
                style={{ cursor: isDone ? "pointer" : "default" }}
                onClick={() => isDone && setStep(idx)}
              >
                <span className="step-num">{isDone ? "✓" : `0${idx + 1}`}</span>
                <div>
                  <div style={{ fontWeight: isActive ? 700 : 500 }}>{s.title}</div>
                  <div style={{ fontSize: "0.76rem", opacity: 0.8 }}>{s.subtitle}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {classroom && (
          <div style={{ marginTop: 24, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)" }}>
            <span className="kicker" style={{ margin: 0, fontSize: "0.7rem" }}>SEÇİLEN ŞUBE</span>
            <strong style={{ display: "block", fontSize: "0.92rem", marginTop: 2 }}>{classroom.name}</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{classroom.grade}. sınıf düzeyi</span>
          </div>
        )}
      </aside>

      {/* Sağ Sütun: Aktif Adım Workspace */}
      <main style={{ minWidth: 0, padding: 0 }}>
        <div className="editorial-panel" style={{ padding: "28px" }}>
          {loadError && <p className="error" role="alert">{loadError}</p>}

          {/* Adım 0: Sınıf Seçimi */}
          {step === 0 && (
            <section>
              <span className="kicker">ADIM 01</span>
              <h2 style={{ fontSize: "1.35rem", margin: "2px 0 6px" }}>Sınıf / Şube Seçin</h2>
              <p className="muted" style={{ marginBottom: 20 }}>
                Görevin atanacağı sınıfı belirleyin. Müfredat kazanımları bu sınıf düzeyine göre filtrelenecektir.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {classrooms.map((c) => (
                  <label
                    key={c.id}
                    className={`option ${c.id === classroomId ? "selected" : ""}`}
                    style={{ flexDirection: "column", gap: 6, padding: "16px" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span className="badge">{c.grade}. sınıf</span>
                      <input
                        type="radio"
                        name="classroom"
                        checked={c.id === classroomId}
                        onChange={() => pickClassroom(c.id)}
                      />
                    </div>
                    <strong style={{ fontSize: "1.15rem", marginTop: 4 }}>{c.name}</strong>
                    <span className="muted" style={{ fontSize: "0.82rem" }}>MEB Müfredat Alanı</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Adım 1: Ders Seçimi */}
          {step === 1 && (
            <section>
              <span className="kicker">ADIM 02</span>
              <h2 style={{ fontSize: "1.35rem", margin: "2px 0 6px" }}>Ders Seçin</h2>
              <p className="muted" style={{ marginBottom: 20 }}>
                {classroom?.grade}. sınıf kademesinde görev hazırlayacağınız branşı seçin:
              </p>

              {!subjects ? (
                <p className="muted">Ders programı yükleniyor…</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {subjects.map((s) => (
                    <label
                      key={s}
                      className={`option ${s === subject ? "selected" : ""}`}
                      style={{ flexDirection: "column", gap: 6, padding: "16px" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                        <span className="badge PUBLISHED">MEB</span>
                        <input
                          type="radio"
                          name="subject"
                          checked={s === subject}
                          onChange={() => pickSubject(s)}
                        />
                      </div>
                      <strong style={{ fontSize: "1.15rem", marginTop: 4 }}>{s}</strong>
                      <span className="muted" style={{ fontSize: "0.82rem" }}>Resmi Öğretim Programı</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Adım 2: Tema / Ünite Seçimi */}
          {step === 2 && (
            <section>
              <span className="kicker">ADIM 03</span>
              <h2 style={{ fontSize: "1.35rem", margin: "2px 0 6px" }}>Tema / Ünite Seçin</h2>
              <p className="muted" style={{ marginBottom: 20 }}>
                {classroom?.grade}. sınıf {subject} dersi resmi öğretim üniteleri:
              </p>

              {!units ? (
                <p className="muted">Üniteler yükleniyor…</p>
              ) : (
                <div className="option-list" role="radiogroup">
                  {units.map((u) => (
                    <label
                      key={u.unitOrTheme}
                      className={`option ${u.unitOrTheme === unitOrTheme ? "selected" : ""}`}
                      style={{ padding: "14px 18px" }}
                    >
                      <input
                        type="radio"
                        name="unit"
                        checked={u.unitOrTheme === unitOrTheme}
                        onChange={() => pickUnit(u.unitOrTheme)}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: "block", fontSize: "1rem" }}>{u.unitOrTheme}</strong>
                        {u.unitOrThemeCode && (
                          <span className="muted" style={{ fontSize: "0.82rem" }}>Ünite Kodu: {u.unitOrThemeCode}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Adım 3: MEB Öğrenme Çıktısı (Kazanım) Seçimi */}
          {step === 3 && (
            <section>
              <span className="kicker">ADIM 04</span>
              <h2 style={{ fontSize: "1.35rem", margin: "2px 0 6px" }}>MEB Öğrenme Çıktıları</h2>
              <p className="muted" style={{ marginBottom: 20 }}>
                Öğrencilerin derse gelmeden önce ön hazırlık yapacağı kazanımları işaretleyin (birden fazla seçilebilir):
              </p>

              {!outcomes ? (
                <p className="muted">Kazanımlar yükleniyor…</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {outcomes.map((o) => (
                    <label
                      key={o.id}
                      className={`option ${selected.has(o.id) ? "selected" : ""}`}
                      style={{ padding: "14px 18px", alignItems: "flex-start" }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggleOutcome(o)}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span className="code" style={{ fontWeight: 700 }}>{o.outcomeCode}</span>
                          <span className="badge PUBLISHED" style={{ fontSize: "0.72rem" }}>Doğrulanmış Çıktı</span>
                        </div>
                        <div style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "var(--text)" }}>
                          {o.outcomeText}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedList.length > 0 && (
                <div style={{ marginTop: 20, padding: "14px 16px", backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)" }}>
                  <strong style={{ display: "block", fontSize: "0.9rem", marginBottom: 6 }}>
                    Seçilen MEB Öğrenme Çıktıları ({selectedList.length}):
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.88rem", display: "grid", gap: 4 }}>
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

          {/* Adım 4: Ayarlar & Detaylar */}
          {step === 4 && (
            <section>
              <span className="kicker">ADIM 05</span>
              <h2 style={{ fontSize: "1.35rem", margin: "2px 0 6px" }}>Görev Başlığı ve Başarı Eşiği</h2>
              <div style={{ padding: "12px 16px", background: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", marginBottom: 20 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="badge">{classroom?.name} ({classroom?.grade}. sınıf)</span>
                  <span className="badge">{subject}</span>
                  <span className="badge">{unitOrTheme}</span>
                  <span className="badge PUBLISHED">{selected.size} MEB Çıktısı</span>
                </div>
              </div>

              <label htmlFor="topic">Görev Başlığı / Konu</label>
              <input
                id="topic"
                type="text"
                placeholder="Örn. Hücrenin Temel Kısımları ve Canlılık Faaliyetleri"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
                required
              />
              {errorList("topic")}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
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
                  <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginTop: 4 }}>
                    Öğrencinin &ldquo;Derse Hazırım&rdquo; sayılması için gereken puan (varsayılan %70).
                  </span>
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
                  <span className="muted" style={{ fontSize: "0.8rem", display: "block", marginTop: 4 }}>
                    5–10 soru arası formatif kontrol sorusu.
                  </span>
                  {errorList("questionCount")}
                </div>

                <DeadlinePicker onChange={setDeadline} error={errorList("deadline")} />
              </div>

              {errorList("outcomeIds")}
              {errorList("classroomId")}
              {errorList("subject")}
              {errorList("unitOrTheme")}
              {errorList("_form")}

              <div style={{ marginTop: 20, padding: "12px 16px", backgroundColor: "var(--accent-light)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-xs)" }}>
                <span className="kicker" style={{ color: "var(--accent)", margin: 0 }}>SONRAKİ ADIMLAR</span>
                <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "var(--text)" }}>
                  Görev taslağını kaydettikten sonra doğrudan <strong>Hazırlık İçeriği</strong> alanına geçeceksiniz. Orada EVREN yapay zekâsıyla özet ve soruları tek tıkla üretebilir ve onaylayıp yayınlayabilirsiniz.
                </p>
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={save}
                  disabled={saving || selected.size === 0}
                  style={{ width: "100%", justifyContent: "center", minHeight: 42, fontSize: "0.95rem" }}
                >
                  {saving ? "Kaydediliyor…" : "Taslak Olarak Kaydet ve İçeriğe Geç →"}
                </button>
              </div>
            </section>
          )}

          {/* Alt Gezinme Butonları */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              ← Geri
            </button>

            {step < 4 && (
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
      </main>
    </div>
  );
}
