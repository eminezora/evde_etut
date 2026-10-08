"use client";

// "Hazırlık İçeriği" tab: AI/manual preparation content, question editor and
// "Onayla ve Yayınla". All rules are enforced again on the server.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

type Scope = "ALL" | "SUMMARY" | "QUESTIONS";
type JobState =
  | { state: "NONE" | "IDLE" }
  | { state: "RUNNING" | "GENERATING"; jobId: string; scope: Scope; startedAt?: string; generationStartedAt?: string }
  | { state: "SUCCEEDED" | "SUCCESS"; jobId: string }
  | { state: "TIMEOUT"; jobId: string; message: string; isStaleRecovered?: boolean }
  | { state: "FAILED"; jobId: string; message: string; reason?: "TIMEOUT" | "INVALID_RESPONSE" | "FAILED"; isStaleRecovered?: boolean };
/** Generation UI state. Every path out of "generating" ends in success, failed or timeout. */
type GenState = "idle" | "generating" | "success" | "failed" | "timeout";
const SLOW_AFTER_S = 60;

const POLL_MS = 2500;
// Client timeout aligned with backend: 150 seconds max.
const CLIENT_MAX_WAIT_MS = 150_000;
const DONE_KEY = (id: string) => `content-generated:${id}`;
const GENERATED_TEXT = "Taslak oluşturuldu. Yayınlamadan önce inceleyip düzenleyin.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ContentEditor({
  assignmentId,
  assignmentStatus,
  aiConfigured,
  aiNotConfiguredMessage,
  questionCount: initialQuestionCount,
  outcomes,
  content,
  questions,
  questionsLocked = false,
}: {
  assignmentId: string;
  assignmentStatus: string;
  aiConfigured: boolean;
  aiNotConfiguredMessage: string;
  questionCount: number;
  outcomes: OutcomeOption[];
  content: EditorContent | null;
  questions: EditorQuestion[];
  /** True once a student has started the check (see content-service QUESTIONS_LOCKED_MESSAGE). */
  questionsLocked?: boolean;
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

  const [elapsed, setElapsed] = useState(0);
  const [retryScope, setRetryScope] = useState<Scope | null>(null);
  const [genState, setGenState] = useState<GenState>("idle");
  const [genError, setGenError] = useState<string | null>(null);
  const endGeneration = useCallback((state: "failed" | "timeout", scope: Scope, text: string) => {
    setBusy(null);
    setGenState(state);
    setGenError(text);
    setRetryScope(scope);
  }, []);
  const alive = useRef(true);

  /** Poll the job until it finishes; the editor then reloads with the saved draft. */
  const followJob = useCallback(
    async (jobId: string, scope: Scope, startedAt = Date.now()) => {
      setBusy(`gen-${scope}`);
      setGenState("generating");
      setGenError(null);
      setRetryScope(null);
      let networkErrors = 0;
      while (alive.current) {
        setElapsed(Math.round((Date.now() - startedAt) / 1000));
        if (Date.now() - startedAt > CLIENT_MAX_WAIT_MS) {
          endGeneration("timeout", scope, "Yapay zekâdan zamanında yanıt alınamadı. Lütfen tekrar deneyin veya içeriği manuel hazırlayın.");
          return;
        }
        await sleep(POLL_MS);
        if (!alive.current) return;
        let job: JobState | null = null;
        try {
          const res = await fetch(`/api/assignments/${assignmentId}/content/generate`, { cache: "no-store" });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.data) job = json.data as JobState;
        } catch {
          job = null;
        }
        if (!job) {
          // Brief network hiccups are tolerated; the job keeps running on the server.
          if (++networkErrors >= 5) {
            endGeneration("failed", scope, "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
            return;
          }
          continue;
        }
        networkErrors = 0;
        if ((job.state === "RUNNING" || job.state === "GENERATING") && job.jobId === jobId) continue;
        if (job.state === "SUCCEEDED" || job.state === "SUCCESS") {
          try {
            sessionStorage.setItem(DONE_KEY(assignmentId), "1");
          } catch {
            /* storage unavailable: the badge on the reloaded content still shows the new draft */
          }
          setBusy(null);
          setGenState("success");
          setMessage({ kind: "ok", lines: [GENERATED_TEXT] });
          setDirty(false);
          router.refresh();
          return;
        }
        if (job.state === "TIMEOUT") {
          endGeneration("timeout", scope, job.message || "Yapay zekâ yanıtı zamanında gelmedi. Lütfen tekrar deneyin veya içeriği manuel hazırlayın.");
          return;
        }
        if (job.state === "FAILED") {
          endGeneration(job.reason === "TIMEOUT" ? "timeout" : "failed", scope, job.message || "İçerik oluşturulamadı. Lütfen tekrar deneyin.");
          return;
        }
        endGeneration("failed", scope, "İçerik oluşturulamadı. Lütfen tekrar deneyin.");
        return;
      }
    },
    [assignmentId, router, endGeneration],
  );

  // On mount: show the "draft ready" notice after the reload, or resume a job that is still running
  // (e.g. the teacher refreshed the page while the draft was being prepared).
  // Also recovers stale/failed states without getting stuck in an infinite spinner.
  useEffect(() => {
    alive.current = true;
    let justGenerated = false;
    try {
      justGenerated = sessionStorage.getItem(DONE_KEY(assignmentId)) !== null;
      sessionStorage.removeItem(DONE_KEY(assignmentId));
    } catch {
      /* storage unavailable */
    }
    if (justGenerated) void Promise.resolve().then(() => alive.current && setMessage({ kind: "ok", lines: [GENERATED_TEXT] }));
    if (isDraft && aiConfigured) {
      fetch(`/api/assignments/${assignmentId}/content/generate`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!alive.current) return;
          const job = json?.data as JobState | undefined;
          if (!job) return;
          if (job.state === "RUNNING" || job.state === "GENERATING") {
            const started = job.generationStartedAt ? Date.parse(job.generationStartedAt) : job.startedAt ? Date.parse(job.startedAt) : Date.now();
            void followJob(job.jobId, job.scope, started);
          } else if (job.state === "TIMEOUT") {
            setGenState("timeout");
            setGenError(job.message || "Önceki içerik oluşturma işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.");
            setRetryScope("ALL");
          } else if (job.state === "FAILED" && job.isStaleRecovered) {
            setGenState("failed");
            setGenError(job.message || "Önceki içerik oluşturma işlemi tamamlanamadı. Lütfen tekrar deneyin.");
            setRetryScope("ALL");
          }
        })
        .catch(() => undefined);
    }
    return () => {
      alive.current = false;
    };
  }, [assignmentId, isDraft, aiConfigured, followJob]);

  async function generate(scope: Scope) {
    const hasExisting = (scope !== "QUESTIONS" && content) || (scope !== "SUMMARY" && questions.length > 0);
    if (hasExisting) {
      const what = scope === "ALL" ? "Hazırlık içeriği ve tüm sorular" : scope === "SUMMARY" ? "Hazırlık içeriği (sorular hariç)" : "Tüm sorular";
      const extra = dirty ? "\n\nKaydedilmemiş değişiklikleriniz de kaybolacak." : "";
      if (!window.confirm(`${what} yapay zekâ ile yeniden oluşturulacak ve mevcut düzenlemelerin yerini alacak. Devam edilsin mi?${extra}`)) return;
    }
    setBusy(`gen-${scope}`);
    setGenState("generating");
    setGenError(null);
    setElapsed(0);
    setRetryScope(null);
    setMessage(null);
    let started: { ok: boolean; json: { data?: { jobId?: string }; error?: string; errors?: Record<string, string[]> } | null };
    try {
      started = await send(`/api/assignments/${assignmentId}/content/generate`, "POST", { scope, questionCount, confirmOverwrite: Boolean(hasExisting) });
    } catch {
      started = { ok: false, json: { error: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." } };
    }
    const jobId = started.json?.data?.jobId;
    if (!started.ok || !jobId) {
      const errs = Object.values(started.json?.errors ?? {}).flat();
      endGeneration("failed", scope, errs[0] ?? started.json?.error ?? "İçerik oluşturma başlatılamadı. Lütfen tekrar deneyin.");
      return;
    }
    await followJob(jobId, scope);
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
              {genState === "generating" && generating && (
                <div className="generating" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <div>
                    <strong>{elapsed >= SLOW_AFTER_S ? "İşlem beklenenden uzun sürüyor." : "İçerik hazırlanıyor, bu işlem biraz sürebilir."}</strong>
                    <p className="muted" style={{ margin: "2px 0 0" }}>
                      {elapsed >= SLOW_AFTER_S ? "Yapay zekâ servisi şu an yavaş yanıt veriyor; lütfen bekleyin." : "Genellikle 1–2 dakika sürer."}
                      {elapsed > 0 ? ` · ${elapsed} sn` : ""} İçerik hazırlanırken lütfen bu sayfayı kapatmayın.
                    </p>
                  </div>
                </div>
              )}
              {(genState === "failed" || genState === "timeout") && !generating && (
                <div className="generation-error" role="alert">
                  <strong>{genState === "timeout" ? "Yapay zekâ zamanında yanıt vermedi." : "Taslak oluşturulamadı."}</strong>
                  <p style={{ margin: "4px 0 10px" }}>{genError}</p>
                  {retryScope && (
                    <button type="button" className="primary" onClick={() => generate(retryScope)} disabled={working}>
                      Tekrar Dene
                    </button>
                  )}
                </div>
              )}
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
                    {!questionsLocked && (
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
        {questionsLocked && (
          <p className="notice-inline" role="note">🔒 Öğrenciler bu görevin sorularını çözmeye başladığı için sorular kilitlendi. Verilen cevapların anlamını korumak için soru eklenemez, silinemez ve düzenlenemez. Hazırlık içeriğini, son teslim tarihini ve deneme hakkını değiştirebilirsiniz.</p>
        )}
        {!questionsLocked &&
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
