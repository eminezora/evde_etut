"use client";

// Teacher assignment wizard: Classroom -> Subject -> Theme/Unit -> MEB outcomes -> details.
// Every option list is fetched on demand from the curriculum API for the chosen classroom;
// the grade always comes from the classroom on the server. The same Zod schema the server
// uses gives immediate feedback here, but the server re-validates everything.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createAssignmentSchema, fieldErrors } from "@/lib/assignments/assignment-schema.ts";

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
  const [deadline, setDeadline] = useState("");
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
      deadline: deadline ? new Date(deadline).toISOString() : "",
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
    <div className="card">
      <ol className="steps" aria-label="Adımlar">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "active" : ""}>{i + 1}. {s}</li>
        ))}
      </ol>
      {loadError && <p className="error" role="alert">{loadError}</p>}

      {step === 0 && (
        <section>
          <h2>Adım 1 – Sınıf</h2>
          {classrooms.length === 0 ? (
            <p className="muted">Size ait sınıf yok.</p>
          ) : (
            <div className="option-list" role="radiogroup">
              {classrooms.map((c) => (
                <label key={c.id} className={`option ${c.id === classroomId ? "selected" : ""}`}>
                  <input type="radio" name="classroom" checked={c.id === classroomId} onChange={() => pickClassroom(c.id)} />
                  <span>{c.name} <span className="muted">({c.grade}. sınıf)</span></span>
                </label>
              ))}
            </div>
          )}
          {classroom && <p className="muted">Müfredat {classroom.grade}. sınıf ile sınırlandırıldı.</p>}
        </section>
      )}

      {step === 1 && (
        <section>
          <h2>Adım 2 – Ders</h2>
          {!subjects ? <p className="muted">Yükleniyor…</p> : subjects.length === 0 ? <p className="muted">Bu sınıf düzeyi için ders yok.</p> : (
            <div className="option-list" role="radiogroup">
              {subjects.map((s) => (
                <label key={s} className={`option ${s === subject ? "selected" : ""}`}>
                  <input type="radio" name="subject" checked={s === subject} onChange={() => pickSubject(s)} />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>Adım 3 – Tema / Ünite</h2>
          {!units ? <p className="muted">Yükleniyor…</p> : (
            <div className="option-list" role="radiogroup">
              {units.map((u) => (
                <label key={u.unitOrTheme} className={`option ${u.unitOrTheme === unitOrTheme ? "selected" : ""}`}>
                  <input type="radio" name="unit" checked={u.unitOrTheme === unitOrTheme} onChange={() => pickUnit(u.unitOrTheme)} />
                  <span>{u.unitOrTheme}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section>
          <h2>Adım 4 – Öğrenme Çıktısı</h2>
          <p className="muted">Bir veya daha fazla öğrenme çıktısı seçin. Yalnızca doğrulanmış (VERIFIED) MEB çıktıları listelenir.</p>
          {!outcomes ? <p className="muted">Yükleniyor…</p> : (
            <div className="option-list">
              {outcomes.map((o) => (
                <label key={o.id} className={`option ${selected.has(o.id) ? "selected" : ""}`}>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOutcome(o)} />
                  <span>
                    <span className="code">{o.outcomeCode}</span>
                    {o.outcomeText}
                  </span>
                </label>
              ))}
            </div>
          )}
          {selectedList.map((o) => (
            <div key={o.id} className="info">
              <strong>MEB Öğrenme Çıktısı</strong>
              <div>Kod: <span className="code" style={{ display: "inline" }}>{o.outcomeCode}</span></div>
              <div>Kaynak: MEB Türkiye Yüzyılı Maarif Modeli</div>
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">Kaynağı Görüntüle</a>
            </div>
          ))}
          {errorList("outcomeIds")}
        </section>
      )}

      {step === 4 && (
        <section>
          <h2>Detaylar</h2>
          <p className="muted">
            {classroom?.name} · {subject} · {unitOrTheme} · {selected.size} öğrenme çıktısı
          </p>
          <label htmlFor="topic">Konu</label>
          <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
          {errorList("topic")}
          <label htmlFor="minimumScore">Başarı eşiği (%)</label>
          <input id="minimumScore" type="number" min={0} max={100} step={1} value={minimumScore} onChange={(e) => setMinimumScore(e.target.value)} />
          {errorList("minimumScore")}
          <label htmlFor="deadline">Son tarih</label>
          <input id="deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {errorList("deadline")}
          <label htmlFor="questionCount">Ön bilgi kontrol sorusu sayısı (5–10)</label>
          <input id="questionCount" type="number" min={5} max={10} step={1} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} />
          {errorList("questionCount")}
          {errorList("outcomeIds")}
          {errorList("classroomId")}
          {errorList("subject")}
          {errorList("unitOrTheme")}
          {errorList("_form")}
          <p className="muted">Görev taslak olarak kaydedilir. Sonraki adımda hazırlık içeriğini oluşturup onayladığınızda yayınlanır.</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="primary" onClick={save} disabled={saving || selected.size === 0}>
              {saving ? "Kaydediliyor…" : "Taslak olarak kaydet ve devam et"}
            </button>
          </div>
        </section>
      )}

      <div className="row" style={{ marginTop: 20, justifyContent: "space-between" }}>
        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Geri</button>
        {step < STEPS.length - 1 && (
          <button type="button" className="primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>İleri</button>
        )}
      </div>
    </div>
  );
}
