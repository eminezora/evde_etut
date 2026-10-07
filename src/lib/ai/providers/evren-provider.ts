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

export interface EvrenConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

type ChatResponse = {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Extract the JSON object from a chat answer (tolerates <think> blocks and ``` fences). */
export function extractJson(content: string): unknown {
  let text = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ProviderError("INCOMPLETE", "AI yanıtında JSON bulunamadı.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ProviderError("INCOMPLETE", "AI yanıtı geçerli JSON değil.");
  }
}

export class EvrenContentProvider implements ContentGenerationProvider {
  readonly name = "evren";
  readonly model: string;
  private readonly url: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl, apiKey, model, fetchImpl }: EvrenConfig) {
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
        temperature: 0.3,
        max_tokens: 8000,
        response_format: responseFormat,
      }),
    });
  }

  async generatePreparationContent(input: PreparationContentInput, { signal }: { signal: AbortSignal }): Promise<ProviderResult> {
    const schema = z.toJSONSchema(wireSchemas[input.scope]);
    let res: Response;
    try {
      res = await this.call(input, signal, { type: "json_schema", json_schema: { name: "preparation_content", strict: true, schema } });
      // Servers without json_schema support: retry once in plain JSON mode (Zod still validates).
      if (res.status === 400 || res.status === 422) res = await this.call(input, signal, { type: "json_object" });
    } catch {
      if (signal.aborted) throw new ProviderError("TIMEOUT", "AI isteği zaman aşımına uğradı.");
      throw new ProviderError("FAILED", "AI servisine bağlanılamadı.");
    }
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
