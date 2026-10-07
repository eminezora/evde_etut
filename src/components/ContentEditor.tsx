"use client";

// "Hazırlık İçeriği" tab: AI/manual preparation content, question editor and
// "Onayla ve Yayınla". All rules are enforced again on the server.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { QuestionForm, stateFromQuestion, type OutcomeOption } from "./QuestionForm.tsx";

export interface EditorContent {
  introduction: string;
  keyConcepts: { term: string; explanation: string }[];
  summary: string;
  simpleExample: string;
  mustKnow: string[];
  status: string;
  generatedBy: string;
  contentVersion: number;
}

export interface EditorQuestion {
  id: string;
  type: string;
  questionText: string;
  points: number;
  generatedBy: string;
  outcomeCodes: string[];
  strict: Record<string, unknown> & { type: string };
}

const STATUS_LABEL: Record<string, string> = {
  AI_GENERATED_DRAFT: "Yapay zekâ taslağı – öğretmen onayı bekliyor",
  MANUAL_DRAFT: "Manuel taslak – öğretmen onayı bekliyor",
  TEACHER_APPROVED: "Öğretmen tarafından onaylandı",
};

const emptyContent = { introduction: "", keyConcepts: [] as EditorContent["keyConcepts"], summary: "", simpleExample: "", mustKnow: [] as string[] };

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export function ContentEditor({
  assignmentId,
  assignmentStatus,
  aiConfigured,
  aiNotConfiguredMessage,
  questionCount: initialQuestionCount,
  outcomes,
  content,
  questions,
}: {
  assignmentId: string;
  assignmentStatus: string;
  aiConfigured: boolean;
  aiNotConfiguredMessage: string;
  questionCount: number;
  outcomes: OutcomeOption[];
  content: EditorContent | null;
  questions: EditorQuestion[];
}) {
  const router = useRouter();
  const isDraft = assignmentStatus === "DRAFT";
  const [form, setForm] = useState(() => (content ? { ...content, keyConcepts: content.keyConcepts.map((k) => ({ ...k })), mustKnow: [...content.mustKnow] } : { ...emptyContent }));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; lines: string[] } | null>(null);
  const [questionCount, setQuestionCount] = useState(String(initialQuestionCount));
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const update = <K extends keyof typeof emptyContent>(k: K, v: (typeof emptyContent)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const report = (ok: boolean, json: { error?: string; errors?: Record<string, string[]> } | null, okText: string) =>
    setMessage(ok ? { kind: "ok", lines: [okText] } : { kind: "error", lines: Object.values(json?.errors ?? {}).flat().length ? Object.values(json!.errors!).flat() : [json?.error ?? "İşlem yapılamadı."] });

  async function saveContent() {
    setBusy("save");
    const { ok, json } = await send(`/api/assignments/${assignmentId}/content`, "PUT", {
      introduction: form.introduction,
      keyConcepts: form.keyConcepts,
      summary: form.summary,
      simpleExample: form.simpleExample,
      mustKnow: form.mustKnow,
    });
    setBusy(null);
    report(ok, json, "İçerik kaydedildi.");
    if (ok) {
      setDirty(false);
      router.refresh();
    }
  }

  async function generate(scope: "ALL" | "SUMMARY" | "QUESTIONS") {
    const hasExisting = (scope !== "QUESTIONS" && content) || (scope !== "SUMMARY" && questions.length > 0);
    if (hasExisting) {
      const what = scope === "ALL" ? "Hazırlık içeriği ve tüm sorular" : scope === "SUMMARY" ? "Hazırlık içeriği (sorular hariç)" : "Tüm sorular";
      const extra = dirty ? "\n\nKaydedilmemiş değişiklikleriniz de kaybolacak." : "";
      if (!window.confirm(`${what} yapay zekâ ile yeniden oluşturulacak ve mevcut düzenlemelerin yerini alacak. Devam edilsin mi?${extra}`)) return;
    }
    setBusy(`gen-${scope}`);
    setMessage(null);
    const { ok, json } = await send(`/api/assignments/${assignmentId}/content/generate`, "POST", { scope, questionCount, confirmOverwrite: Boolean(hasExisting) });
    setBusy(null);
    report(ok, json, "Taslak oluşturuldu. Yayınlamadan önce inceleyip düzenleyin.");
    if (ok) {
      setDirty(false);
      router.refresh();
    }
  }

  async function questionAction(url: string, method: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(url + method);
    const { ok, json } = await send(url, method, body);
    setBusy(null);
    if (!ok) report(false, json, "");
    else router.refresh();
  }

  async function submitQuestion(payload: Record<string, unknown>, id?: string) {
    const { ok, json } = await send(id ? `/api/assignments/${assignmentId}/questions/${id}` : `/api/assignments/${assignmentId}/questions`, id ? "PATCH" : "POST", payload);
    if (!ok) return (json?.errors as Record<string, string[]>) ?? { _form: [json?.error ?? "Soru kaydedilemedi."] };
    setEditing(null);
    router.refresh();
    return null;
  }

  async function publish() {
    if (!window.confirm("Hazırlık içeriği ve sorular onaylanıp görev öğrencilere yayınlanacak. Onaylıyor musunuz?")) return;
    setBusy("publish");
    const { ok, json } = await send(`/api/assignments/${assignmentId}/publish`, "POST");
    setBusy(null);
    report(ok, json, "Görev yayınlandı.");
    if (ok) router.refresh();
  }

  const working = busy !== null;
  const generating = busy?.startsWith("gen-") ?? false;
  const hasAnything = Boolean(content) || questions.length > 0;
  const totalPoints = questions.reduce((n, q) => n + q.points, 0);

  return (
    <>
      {message && (
        <div className={`card ${message.kind === "error" ? "notice-error" : "notice-ok"}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.lines.map((l) => <p key={l} style={{ margin: "2px 0" }}>{l}</p>)}
        </div>
      )}

      {isDraft && (
        <div className="card">
          <h2>Yapay zekâ ile taslak</h2>
          {!aiConfigured ? (
            <p className="muted">{aiNotConfiguredMessage}</p>
          ) : (
            <>
              <p className="muted">Taslak yalnızca seçtiğiniz MEB öğrenme çıktılarına dayanır ve onayınız olmadan öğrencilere gösterilmez.</p>
              <label htmlFor="qc">Soru sayısı (5–10)</label>
              <input id="qc" type="number" min={5} max={10} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} style={{ maxWidth: 120 }} />
              <div className="row" style={{ marginTop: 12 }}>
                {!hasAnything ? (
                  <button type="button" className="primary" onClick={() => generate("ALL")} disabled={working}>
                    {busy === "gen-ALL" ? "Oluşturuluyor…" : "Hazırlık İçeriği Oluştur"}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => generate("ALL")} disabled={working}>{busy === "gen-ALL" ? "Oluşturuluyor…" : "Tüm İçeriği Yeniden Oluştur"}</button>
                    <button type="button" onClick={() => generate("SUMMARY")} disabled={working}>{busy === "gen-SUMMARY" ? "Oluşturuluyor…" : "Özeti Yeniden Oluştur"}</button>
                    <button type="button" onClick={() => generate("QUESTIONS")} disabled={working}>{busy === "gen-QUESTIONS" ? "Oluşturuluyor…" : "Soruları Yeniden Oluştur"}</button>
                  </>
                )}
              </div>
              {generating && <p className="muted" role="status">İçerik oluşturuluyor; bu işlem bir dakika kadar sürebilir.</p>}
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Hazırlık İçeriği</h2>
          {content && <span className="badge">{STATUS_LABEL[content.status] ?? content.status}{content.contentVersion > 1 ? ` · sürüm ${content.contentVersion}` : ""}</span>}
        </div>
        {!content && <p className="muted">Henüz içerik yok. Yapay zekâ ile oluşturabilir ya da aşağıya manuel yazıp kaydedebilirsiniz.</p>}
        {!isDraft && <p className="muted">Görev yayında. Yaptığınız düzenlemeler yeni içerik sürümü olarak kaydedilir.</p>}

        <label htmlFor="intro">Konuya Giriş</label>
        <textarea id="intro" rows={3} value={form.introduction} onChange={(e) => update("introduction", e.target.value)} />

        <label>Temel Kavramlar</label>
        {form.keyConcepts.map((k, i) => (
          <div key={i} className="concept-row">
            <input type="text" aria-label={`Kavram ${i + 1}`} placeholder="Kavram" value={k.term} onChange={(e) => update("keyConcepts", form.keyConcepts.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))} />
            <textarea aria-label={`Kavram ${i + 1} açıklaması`} rows={2} placeholder="Açıklama" value={k.explanation} onChange={(e) => update("keyConcepts", form.keyConcepts.map((x, j) => (j === i ? { ...x, explanation: e.target.value } : x)))} />
            <button type="button" onClick={() => update("keyConcepts", form.keyConcepts.filter((_, j) => j !== i))}>Sil</button>
          </div>
        ))}
        {form.keyConcepts.length < 10 && <button type="button" onClick={() => update("keyConcepts", [...form.keyConcepts, { term: "", explanation: "" }])}>+ Kavram ekle</button>}

        <label htmlFor="summary">Konu Özeti</label>
        <textarea id="summary" rows={8} value={form.summary} onChange={(e) => update("summary", e.target.value)} />

        <label htmlFor="example">Basit Örnek</label>
        <textarea id="example" rows={3} value={form.simpleExample} onChange={(e) => update("simpleExample", e.target.value)} />

        <label>Bunu Bilmen Yeterli <span className="muted">(“Derse gelmeden önce bunları bilmen yeterli.” – 3–6 madde)</span></label>
        {form.mustKnow.map((m, i) => (
          <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
            <input type="text" aria-label={`Madde ${i + 1}`} value={m} onChange={(e) => update("mustKnow", form.mustKnow.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" onClick={() => update("mustKnow", form.mustKnow.filter((_, j) => j !== i))}>Sil</button>
          </div>
        ))}
        {form.mustKnow.length < 6 && <button type="button" onClick={() => update("mustKnow", [...form.mustKnow, ""])}>+ Madde ekle</button>}

        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="primary" onClick={saveContent} disabled={working || (!dirty && Boolean(content))}>
            {busy === "save" ? "Kaydediliyor…" : content ? "Değişiklikleri Kaydet" : "Manuel İçeriği Kaydet"}
          </button>
          {dirty && <span className="muted">Kaydedilmemiş değişiklikler var.</span>}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Ön Bilgi Kontrol Soruları</h2>
          <span className="muted">{questions.length} soru · toplam {totalPoints} puan</span>
        </div>
        {questions.length === 0 && <p className="muted">Henüz soru yok.</p>}
        <ol className="question-list">
          {questions.map((q, i) => (
            <li key={q.id} className="question-card">
              {editing === q.id ? (
                <QuestionForm initial={stateFromQuestion(q.strict)} outcomes={outcomes} submitLabel="Soruyu Kaydet" onSubmit={(p) => submitQuestion(p, q.id)} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span><strong>{i + 1}.</strong> <span className="badge">{QUESTION_TYPE_LABELS[q.type as QuestionType] ?? q.type}</span> <span className="muted">{q.points} puan · {q.generatedBy === "AI" ? "YZ" : "Öğretmen"}</span></span>
                    {isDraft && (
                      <span className="row">
                        <button type="button" onClick={() => setEditing(q.id)} disabled={working}>Düzenle</button>
                        <button type="button" onClick={() => questionAction(`/api/assignments/${assignmentId}/questions/${q.id}`, "DELETE", undefined, "Soru silinsin mi?")} disabled={working}>Sil</button>
                        <button type="button" aria-label="Yukarı taşı" onClick={() => questionAction(`/api/assignments/${assignmentId}/questions/${q.id}/move`, "POST", { direction: "up" })} disabled={working || i === 0}>↑ Yukarı taşı</button>
                        <button type="button" aria-label="Aşağı taşı" onClick={() => questionAction(`/api/assignments/${assignmentId}/questions/${q.id}/move`, "POST", { direction: "down" })} disabled={working || i === questions.length - 1}>↓ Aşağı taşı</button>
                      </span>
                    )}
                  </div>
                  <p style={{ whiteSpace: "pre-wrap" }}>{q.questionText}</p>
                  <p className="muted" style={{ margin: 0 }}>Bağlı outcome: {q.outcomeCodes.length ? q.outcomeCodes.join(", ") : "—"}</p>
                </>
              )}
            </li>
          ))}
        </ol>
        {isDraft &&
          (editing === "new" ? (
            <QuestionForm outcomes={outcomes} submitLabel="Soruyu Ekle" onSubmit={(p) => submitQuestion(p)} onCancel={() => setEditing(null)} />
          ) : (
            <button type="button" onClick={() => setEditing("new")} disabled={working}>+ Yeni Soru Ekle</button>
          ))}
      </div>

      {isDraft && (
        <div className="card">
          <h2>Onay</h2>
          <p className="muted">Yayınladığınızda içerik “öğretmen onaylı” olarak işaretlenir ve görev sınıftaki öğrencilere açılır.</p>
          <button type="button" className="primary" onClick={publish} disabled={working || dirty}>
            {busy === "publish" ? "Yayınlanıyor…" : "Onayla ve Yayınla"}
          </button>
          {dirty && <p className="muted">Önce içerikteki değişiklikleri kaydedin.</p>}
        </div>
      )}
    </>
  );
}
