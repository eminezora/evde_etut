"use client";

// "Hazırlık İçeriği" tab: AI/manual preparation content, question editor and
// "Onayla ve Yayınla". All rules are enforced again on the server.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { UsageMeter, type UsageMeterData } from "./usage/UsageMeter.tsx";
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
type GenState = "idle" | "generating" | "success" | "failed" | "timeout" | "limit";
const SLOW_AFTER_S = 30;

const POLL_MS = 2500;
// Client timeout aligned with backend: 65 seconds max (serverless hard limit + margin).
const CLIENT_MAX_WAIT_MS = 65_000;
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
  aiQuota = null,
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
  /** The teacher's AI_CONTENT_GENERATION quota (null = not limited / unknown). */
  aiQuota?: UsageMeterData | null;
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
          endGeneration("timeout", scope, "Yapay zekâ servisi beklenenden uzun sürdü. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
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
        if (job.state === "RUNNING" || job.state === "GENERATING") continue;
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
          setTimeout(() => {
            if (alive.current) {
              window.location.reload();
            }
          }, 400);
          return;
        }
        if (job.state === "TIMEOUT") {
          endGeneration("timeout", scope, job.message || "Yapay zekâ servisi beklenenden uzun sürdü. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
          return;
        }
        if (job.state === "FAILED") {
          endGeneration(job.reason === "TIMEOUT" ? "timeout" : "failed", scope, job.message || "İçerik bu kez oluşturulamadı. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
          return;
        }
        endGeneration("failed", scope, "İçerik bu kez oluşturulamadı. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
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
            if (Date.now() - started >= 58_000) {
              setGenState("timeout");
              setGenError("Yapay zekâ servisi beklenenden uzun sürdü. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
              setRetryScope(job.scope || "ALL");
            } else {
              void followJob(job.jobId, job.scope, started);
            }
          } else if (job.state === "TIMEOUT") {
            setGenState("timeout");
            setGenError(job.message || "Yapay zekâ servisi beklenenden uzun sürdü. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
            setRetryScope("ALL");
          } else if (job.state === "FAILED") {
            setGenState("failed");
            setGenError(job.message || "İçerik bu kez oluşturulamadı. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
            setRetryScope("ALL");
          }
        })
        .catch(() => undefined);
    }
    return () => {
      alive.current = false;
    };
  }, [assignmentId, isDraft, aiConfigured, followJob]);

  async function generate(scope: Scope, skipConfirm = false) {
    const hasExisting = (scope !== "QUESTIONS" && content) || (scope !== "SUMMARY" && questions.length > 0);
    if (hasExisting && !skipConfirm) {
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
    let started: { ok: boolean; json: { data?: { jobId?: string }; error?: string; code?: string; errors?: Record<string, string[]> } | null };
    try {
      started = await send(`/api/assignments/${assignmentId}/content/generate`, "POST", { scope, questionCount, confirmOverwrite: Boolean(hasExisting) });
    } catch {
      started = { ok: false, json: { error: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." } };
    }
    const jobId = started.json?.data?.jobId;
    if (!started.ok && started.json?.code === "USAGE_LIMIT_REACHED") {
      // Quota used up: a calm notice, no retry button (retrying can't help until the reset).
      setBusy(null);
      setGenState("limit");
      setGenError(started.json.error ?? "Bugünkü yapay zekâ kullanım hakkınızı tamamladınız. Yeni kullanım hakkınız yarın yenilenecek.");
      setRetryScope(null);
      router.refresh();
      return;
    }
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
  const quotaEmpty = Boolean(aiQuota && !aiQuota.unlimited && (aiQuota.remaining ?? 0) === 0);
  const generating = busy?.startsWith("gen-") ?? false;
  const hasAnything = Boolean(content) || questions.length > 0;
  const totalPoints = questions.reduce((n, q) => n + q.points, 0);

  return (
    <>
      {message && (
        <div className={`editorial-panel ${message.kind === "error" ? "notice-error" : "notice-ok"}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.lines.map((l) => <p key={l} style={{ margin: "2px 0" }}>{l}</p>)}
        </div>
      )}

      {isDraft && (
        <div className="editorial-panel" style={{ borderLeft: "3px solid var(--accent)", backgroundColor: "var(--surface)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>OTOMATİK İÇERİK DESTEĞİ</span>
              <h2 style={{ fontSize: "1.2rem", margin: "2px 0 4px" }}>Yapay Zekâ ile Ders Taslağı</h2>
            </div>
            <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)", borderColor: "var(--accent-border)" }}>
              ✎ AI Destekli EVREN Pedagojisi
            </span>
          </div>

          {!aiConfigured ? (
            <p className="muted" style={{ margin: 0 }}>{aiNotConfiguredMessage}</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: "0.88rem", marginBottom: 12 }}>
                Üretilen ders notu ve sorular yalnızca seçtiğiniz MEB kazanımlarına dayanır. Öğretmen onayı verilmeden öğrencilere gösterilmez.
              </p>

              {aiQuota && (
                <div style={{ maxWidth: 360, marginBottom: 14 }}>
                  <UsageMeter q={aiQuota} compact />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label htmlFor="qc" style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "nowrap" }}>Soru Sayısı (5–10):</label>
                  <input id="qc" type="number" min={5} max={10} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} style={{ width: 80, padding: "5px 8px" }} />
                  {Number(questionCount) > 5 && (
                    <span className="muted" style={{ fontSize: "0.78rem" }}>⚡ 5 soru en hızlı ve güvenli sürede üretilir</span>
                  )}
                </div>

                <div className="row" style={{ gap: 8 }}>
                  {!hasAnything ? (
                    <button type="button" className="primary" onClick={() => generate("ALL")} disabled={working || quotaEmpty} style={{ minHeight: 34, fontSize: "0.85rem" }}>
                      {busy === "gen-ALL" ? "Hazırlanıyor…" : "Özet ve Soruları Oluştur"}
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => generate("ALL")} disabled={working || quotaEmpty} style={{ minHeight: 34, fontSize: "0.85rem" }}>
                        {busy === "gen-ALL" ? "Hazırlanıyor…" : "Tümünü Yeniden Oluştur"}
                      </button>
                      <button type="button" onClick={() => generate("SUMMARY")} disabled={working || quotaEmpty} style={{ minHeight: 34, fontSize: "0.85rem" }}>
                        {busy === "gen-SUMMARY" ? "Hazırlanıyor…" : "Yalnızca Özeti Yenile"}
                      </button>
                      <button type="button" onClick={() => generate("QUESTIONS")} disabled={working || quotaEmpty} style={{ minHeight: 34, fontSize: "0.85rem" }}>
                        {busy === "gen-QUESTIONS" ? "Hazırlanıyor…" : "Yalnızca Soruları Yenile"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {genState === "generating" && generating && (
                <div style={{ padding: "12px 14px", backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", display: "flex", alignItems: "center", gap: 12 }} role="status" aria-live="polite">
                  <span style={{ fontSize: "1.1rem" }}>⏳</span>
                  <div>
                    <strong>{elapsed >= SLOW_AFTER_S ? "İşlem beklenenden uzun sürüyor." : "İçerik hazırlanıyor, lütfen bekleyin."}</strong>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>
                      {elapsed >= SLOW_AFTER_S ? "Yapay zekâ servisi şu an yanıt veriyor; lütfen bekleyin." : "Genellikle 30–45 saniye sürer."}
                      {elapsed > 0 ? ` · ${elapsed} sn` : ""} Lütfen sayfayı kapatmayın.
                    </p>
                  </div>
                </div>
              )}

              {quotaEmpty && genState !== "limit" && !generating && aiQuota && (
                <div className="quota-notice" role="status">
                  <strong>{aiQuota.periodLabel === "Günlük" ? "Bugünkü yapay zekâ kullanım hakkınızı tamamladınız." : `${aiQuota.periodLabel} kullanım hakkınızı tamamladınız.`}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>Kotanız {aiQuota.resetHint.replace(/^Yarın/, "yarın").replace(/'da yenilenir$/, "")}&apos;da yenilenecek. Bu sürede içeriği aşağıdan elle hazırlayabilirsiniz.</p>
                </div>
              )}

              {genState === "limit" && !generating && (
                <div className="quota-notice" role="alert">
                  <strong>Kullanım hakkınız doldu.</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>{genError}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>Bu sürede içeriği aşağıdan elle hazırlayabilirsiniz.</p>
                </div>
              )}

              {(genState === "failed" || genState === "timeout") && !generating && (
                <div className="error" role="alert" style={{ marginTop: 10 }}>
                  <strong>İçerik bu kez oluşturulamadı.</strong>
                  <p style={{ margin: "4px 0 8px", fontSize: "0.85rem" }}>
                    {genError || (genState === "timeout" ? "Yapay zekâ servisi beklenenden uzun sürdü. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz." : "İçerik bu kez oluşturulamadı. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.")}
                  </p>
                  {retryScope && (
                    <button type="button" className="primary" onClick={() => generate(retryScope, true)} disabled={working} style={{ minHeight: 30, fontSize: "0.8rem", padding: "2px 10px" }}>
                      Tekrar Dene
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hazırlık İçeriği - Ders Notu & Föy Çalışma Alanı */}
      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>DERS NOTU YAYIN ÇALIŞMA ALANI</span>
            <h2 style={{ fontSize: "1.25rem", margin: "2px 0 0" }}>Hazırlık İçeriği (Özet Föyü)</h2>
          </div>
          {content && (
            <span className="badge">
              {STATUS_LABEL[content.status] ?? content.status}{content.contentVersion > 1 ? ` · sürüm ${content.contentVersion}` : ""}
            </span>
          )}
        </div>

        {!content && <p className="muted" style={{ fontSize: "0.9rem" }}>Henüz içerik bulunmuyor. Yukarıdan yapay zekâ ile üretebilir ya da alanları manuel doldurabilirsiniz.</p>}
        {!isDraft && <p className="muted" style={{ fontSize: "0.9rem" }}>Görev yayında. Yaptığınız düzenlemeler yeni içerik sürümü olarak saklanır.</p>}

        <label htmlFor="intro">1. Konuya Giriş</label>
        <textarea id="intro" rows={3} value={form.introduction} onChange={(e) => update("introduction", e.target.value)} placeholder="Öğrencinin konuya ilgisini çekecek kısa bir giriş..." />

        <label style={{ marginTop: 16 }}>2. Temel Kavramlar & Tanımlar</label>
        <div style={{ display: "grid", gap: 10 }}>
          {form.keyConcepts.map((k, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 10, alignItems: "start", padding: "10px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
              <input type="text" aria-label={`Kavram ${i + 1}`} placeholder="Kavram Adı" value={k.term} onChange={(e) => update("keyConcepts", form.keyConcepts.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))} />
              <textarea aria-label={`Kavram ${i + 1} açıklaması`} rows={2} placeholder="Açıklama" value={k.explanation} onChange={(e) => update("keyConcepts", form.keyConcepts.map((x, j) => (j === i ? { ...x, explanation: e.target.value } : x)))} />
              <button type="button" onClick={() => update("keyConcepts", form.keyConcepts.filter((_, j) => j !== i))} style={{ minHeight: 34, padding: "2px 8px", fontSize: "0.8rem" }}>Sil</button>
            </div>
          ))}
        </div>
        {form.keyConcepts.length < 10 && (
          <button type="button" onClick={() => update("keyConcepts", [...form.keyConcepts, { term: "", explanation: "" }])} style={{ marginTop: 8, minHeight: 30, fontSize: "0.82rem" }}>
            + Kavram Ekle
          </button>
        )}

        <label htmlFor="summary" style={{ marginTop: 16 }}>3. Konu Özeti (Ders Notu)</label>
        <textarea id="summary" rows={7} value={form.summary} onChange={(e) => update("summary", e.target.value)} placeholder="Ders öncesi okunacak 5 dakikalık editoryal konu özeti..." />

        <label htmlFor="example" style={{ marginTop: 16 }}>4. Günlük Hayattan Somut Örnek</label>
        <textarea id="example" rows={3} value={form.simpleExample} onChange={(e) => update("simpleExample", e.target.value)} placeholder="Konunun günlük yaşamla bağlantısı..." />

        <label style={{ marginTop: 16 }}>
          5. Bunu Bilmen Yeterli <span className="muted">(“Derse gelmeden önce bunları bilmen yeterli” – 3–6 madde)</span>
        </label>
        <div style={{ display: "grid", gap: 8 }}>
          {form.mustKnow.map((m, i) => (
            <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
              <span className="code" style={{ minWidth: 26, textAlign: "center" }}>{i + 1}</span>
              <input type="text" aria-label={`Madde ${i + 1}`} value={m} onChange={(e) => update("mustKnow", form.mustKnow.map((x, j) => (j === i ? e.target.value : x)))} style={{ flex: 1 }} />
              <button type="button" onClick={() => update("mustKnow", form.mustKnow.filter((_, j) => j !== i))} style={{ minHeight: 34, padding: "2px 8px", fontSize: "0.8rem" }}>Sil</button>
            </div>
          ))}
        </div>
        {form.mustKnow.length < 6 && (
          <button type="button" onClick={() => update("mustKnow", [...form.mustKnow, ""])} style={{ marginTop: 8, minHeight: 30, fontSize: "0.82rem" }}>
            + Madde Ekle
          </button>
        )}

        <div className="row" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button type="button" className="primary" onClick={saveContent} disabled={working || (!dirty && Boolean(content))}>
            {busy === "save" ? "Kaydediliyor…" : content ? "İçerik Değişikliklerini Kaydet" : "Manuel İçeriği Kaydet"}
          </button>
          {dirty && <span className="muted" style={{ fontSize: "0.85rem" }}>Kaydedilmemiş değişiklikler var.</span>}
        </div>
      </div>

      {/* Soru Listesi & Editörü */}
      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>FORMATİF DEĞERLENDİRME</span>
            <h2 style={{ fontSize: "1.25rem", margin: "2px 0 0" }}>Ön Bilgi Kontrol Soruları</h2>
          </div>
          <span className="badge">{questions.length} soru · {totalPoints} puan</span>
        </div>

        {questions.length === 0 && <p className="muted" style={{ fontSize: "0.9rem" }}>Henüz soru eklenmedi.</p>}

        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {questions.map((q, i) => (
            <li key={q.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "16px", backgroundColor: "var(--surface)" }}>
              {editing === q.id ? (
                <QuestionForm initial={stateFromQuestion(q.strict)} outcomes={outcomes} submitLabel="Soruyu Kaydet" onSubmit={(p) => submitQuestion(p, q.id)} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong style={{ fontSize: "0.95rem" }}>{i + 1}.</strong>
                      <span className="badge">{QUESTION_TYPE_LABELS[q.type as QuestionType] ?? q.type}</span>
                      <span className="code">{q.points} puan</span>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>{q.generatedBy === "AI" ? "Yapay Zekâ" : "Öğretmen"}</span>
                    </div>

                    {!questionsLocked && (
                      <div className="row" style={{ gap: 6 }}>
                        <button type="button" onClick={() => setEditing(q.id)} disabled={working} style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.78rem" }}>Düzenle</button>
                        <button type="button" onClick={() => questionAction(`/api/assignments/${assignmentId}/questions/${q.id}`, "DELETE", undefined, "Soru silinsin mi?")} disabled={working} style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.78rem" }}>Sil</button>
                        <button type="button" aria-label="Yukarı taşı" onClick={() => questionAction(`/api/assignments/${assignmentId}/questions/${q.id}/move`, "POST", { direction: "up" })} disabled={working || i === 0} style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.78rem" }}>↑</button>
                        <button type="button" aria-label="Aşağı taşı" onClick={() => questionAction(`/api/assignments/${assignmentId}/questions/${q.id}/move`, "POST", { direction: "down" })} disabled={working || i === questions.length - 1} style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.78rem" }}>↓</button>
                      </div>
                    )}
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 8px", fontSize: "0.95rem", lineHeight: 1.5 }}>{q.questionText}</p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Bağlı MEB çıktısı: {q.outcomeCodes.length ? q.outcomeCodes.join(", ") : "—"}</p>
                </>
              )}
            </li>
          ))}
        </ol>

        {questionsLocked && (
          <p className="error" role="note" style={{ marginTop: 14 }}>🔒 Öğrenciler bu görevin sorularını çözmeye başladığı için soru listesi kilitlenmiştir.</p>
        )}

        {!questionsLocked &&
          (editing === "new" ? (
            <div style={{ marginTop: 16 }}>
              <QuestionForm outcomes={outcomes} submitLabel="Soruyu Ekle" onSubmit={(p) => submitQuestion(p)} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setEditing("new")} disabled={working} style={{ minHeight: 34, fontSize: "0.85rem" }}>
                + Yeni Soru Ekle
              </button>
            </div>
          ))}
      </div>

      {/* Onay ve Yayınlama Paneli */}
      {isDraft && (
        <div className="editorial-panel" style={{ border: "1px solid var(--ok-border)", backgroundColor: "var(--ok-bg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <strong style={{ display: "block", color: "var(--ok-text)", fontSize: "1.05rem" }}>Görevi Onayla ve Yayınla</strong>
              <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                Yayınladığınızda ders notu ve sorular sınıftaki tüm öğrencilerin çalışma listesinde aktif hale gelecektir.
              </p>
            </div>
            <button type="button" className="primary" onClick={publish} disabled={working || dirty} style={{ minHeight: 40, padding: "8px 22px" }}>
              {busy === "publish" ? "Yayınlanıyor…" : "Onayla ve Yayınla →"}
            </button>
          </div>
          {dirty && <p className="muted" style={{ marginTop: 8, fontSize: "0.82rem" }}>Önce içerikteki değişiklikleri kaydediniz.</p>}
        </div>
      )}
    </>
  );
}
