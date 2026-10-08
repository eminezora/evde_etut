// EVREN LLM (OpenAI-compatible chat completions API) implementation. Text-only: the request
// carries the same grounded MEB prompt as every other provider and asks for the same JSON shape;
// the content service still validates the result with Zod before anything is saved.
// Server-only: reads its configuration from environment variables via the provider factory.

import { z } from "zod";
import { ProviderError, type ContentGenerationProvider, type PreparationContentInput, type ProviderResult } from "../content-generation-provider.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt-builder.ts";
import { wireSchemas } from "../response-schema.ts";

/** Used only when EVREN_LLM_MODEL is not set. */
export const EVREN_FALLBACK_MODEL = "glm-5.3";

export const REASONING_EFFORTS = ["none", "low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
/** Reasoning models (e.g. glm-5.3) otherwise spend most of the budget and minutes "thinking". */
export const EVREN_DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

export interface EvrenConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Sent as `reasoning_effort`; null omits the parameter (for models that reject it). */
  reasoningEffort?: ReasoningEffort | null;
  fetchImpl?: typeof fetch;
}

type ChatResponse = {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Extract the JSON object from a chat answer. Tolerates <think> blocks, ``` fences, a short sentence
 * before/after the object and trailing commas – nothing else is "repaired": anything still invalid
 * is rejected (and the result is validated with Zod afterwards anyway).
 */
export function extractJson(content: string): unknown {
  let text = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ProviderError("INCOMPLETE", "AI yanıtında JSON bulunamadı.");
  const body = text.slice(start, end + 1);
  for (const candidate of [body, body.replace(/,\s*([}\]])/g, "$1")]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next, more lenient candidate */
    }
  }
  throw new ProviderError("INCOMPLETE", "AI yanıtı geçerli JSON değil.");
}

/** Transient upstream statuses worth exactly one retry. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 1500;
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

export class EvrenContentProvider implements ContentGenerationProvider {
  readonly name = "evren";
  readonly model: string;
  private readonly url: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly reasoningEffort: ReasoningEffort | null;

  constructor({ baseUrl, apiKey, model, reasoningEffort = EVREN_DEFAULT_REASONING_EFFORT, fetchImpl }: EvrenConfig) {
    this.reasoningEffort = reasoningEffort;
    this.url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl ?? fetch;
  }

  private async call(input: PreparationContentInput, signal: AbortSignal, responseFormat: Record<string, unknown>) {
    return this.fetchImpl(this.url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${buildUserPrompt(input)}\n\nYanıtı yalnızca tek bir JSON nesnesi olarak ver; açıklama veya markdown ekleme.` },
        ],
        temperature: 0.2,
        // Targeted token limit for concise JSON (~1.5k–2k tokens for 5–10 questions).
        max_tokens: 4096,
        ...(this.reasoningEffort ? { reasoning_effort: this.reasoningEffort } : {}),
        response_format: responseFormat,
      }),
    });
  }

  async generatePreparationContent(input: PreparationContentInput, { signal }: { signal: AbortSignal }): Promise<ProviderResult> {
    const schema = z.toJSONSchema(wireSchemas[input.scope]);
    const schemaFormat = { type: "json_schema", json_schema: { name: "preparation_content", strict: true, schema } };
    let res: Response | null = null;
    // At most two HTTP calls: one controlled retry after a network error or 429/5xx.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await this.call(input, signal, schemaFormat);
        // Servers without json_schema support: retry once in plain JSON mode (Zod still validates).
        if (res.status === 400 || res.status === 422) res = await this.call(input, signal, { type: "json_object" });
      } catch {
        if (signal.aborted) throw new ProviderError("TIMEOUT", "AI isteği zaman aşımına uğradı.");
        if (attempt === 2) throw new ProviderError("FAILED", "AI servisine bağlanılamadı.");
        res = null;
      }
      if (res && !RETRYABLE.has(res.status)) break;
      if (attempt === 2) break;
      try {
        await sleep(RETRY_DELAY_MS, signal);
      } catch {
        throw new ProviderError("TIMEOUT", "AI isteği zaman aşımına uğradı.");
      }
    }
    if (!res) throw new ProviderError("FAILED", "AI servisine bağlanılamadı.");
    if (!res.ok) throw new ProviderError("FAILED", `AI API hatası (HTTP ${res.status}).`);

    let body: ChatResponse;
    try {
      body = (await res.json()) as ChatResponse;
    } catch {
      throw new ProviderError("INCOMPLETE", "AI yanıtı çözümlenemedi.");
    }
    const choice = body.choices?.[0];
    if (choice?.finish_reason === "length") throw new ProviderError("INCOMPLETE", "AI yanıtı yarıda kesildi (max_tokens).");
    if (choice?.finish_reason === "content_filter") throw new ProviderError("REFUSED", "AI isteği içerik filtresine takıldı.");
    const content = choice?.message?.content;
    if (!content) throw new ProviderError("INCOMPLETE", "AI yanıtı boş.");
    return { raw: extractJson(content), inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
  }
}
