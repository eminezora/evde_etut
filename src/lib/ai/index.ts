// Provider factory driven by environment variables (server-only; nothing here is NEXT_PUBLIC_):
//   AI_PROVIDER = evren | anthropic | mock   (unset → AI generation disabled, manual flow still works)
//   AI_TIMEOUT_MS = request timeout          (optional; default 150000)
// evren (OpenAI-compatible EVREN LLM API):
//   EVREN_LLM_BASE_URL = API base URL incl. /v1 (required)
//   EVREN_LLM_API_KEY  = API key (required; AI_API_KEY is accepted as a fallback)
//   EVREN_LLM_MODEL    = model id (optional; fallback glm-5.3) – switch models (e.g. gemma-4-31b,
//                        qwen3.8-flash-next) by changing only this variable
//   EVREN_LLM_REASONING_EFFORT = none | low | medium | high | off (optional; default low;
//                        "off" omits the parameter for models that do not accept it)
// anthropic:
//   AI_API_KEY = API key (required), AI_MODEL = model id (optional; default claude-opus-5-5)

import type { ContentGenerationProvider } from "./content-generation-provider.ts";
import { AnthropicContentProvider } from "./providers/anthropic-provider.ts";
import { EVREN_DEFAULT_REASONING_EFFORT, EVREN_FALLBACK_MODEL, EvrenContentProvider, REASONING_EFFORTS, type ReasoningEffort } from "./providers/evren-provider.ts";
import { MockContentProvider } from "./providers/mock-provider.ts";

export const AI_NOT_CONFIGURED_MESSAGE = "Yapay zekâ içerik üretimi şu anda yapılandırılmamış. İçeriği manuel olarak hazırlayabilirsiniz.";
export const AI_FAILED_MESSAGE = "İçerik oluşturulamadı. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.";

export function aiTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const v = Number(env.AI_TIMEOUT_MS);
  return Number.isFinite(v) && v >= 5_000 ? v : 150_000;
}

export function getContentProvider(env: NodeJS.ProcessEnv = process.env): ContentGenerationProvider | null {
  const provider = env.AI_PROVIDER?.trim().toLowerCase();
  if (provider === "evren") {
    const baseUrl = env.EVREN_LLM_BASE_URL?.trim();
    const apiKey = env.EVREN_LLM_API_KEY?.trim() || env.AI_API_KEY?.trim();
    if (!baseUrl || !/^https?:\/\//.test(baseUrl) || !apiKey) return null;
    const effortSetting = env.EVREN_LLM_REASONING_EFFORT?.trim().toLowerCase();
    const reasoningEffort =
      effortSetting === "off" ? null : REASONING_EFFORTS.includes(effortSetting as ReasoningEffort) ? (effortSetting as ReasoningEffort) : EVREN_DEFAULT_REASONING_EFFORT;
    return new EvrenContentProvider({ baseUrl, apiKey, model: env.EVREN_LLM_MODEL?.trim() || EVREN_FALLBACK_MODEL, reasoningEffort });
  }
  const model = env.AI_MODEL?.trim() || undefined;
  if (provider === "anthropic") {
    const key = env.AI_API_KEY?.trim();
    return key ? new AnthropicContentProvider(key, model, aiTimeoutMs(env)) : null;
  }
  if (provider === "mock" && env.NODE_ENV !== "production") return new MockContentProvider();
  return null;
}

export const isAiConfigured = (env: NodeJS.ProcessEnv = process.env) => getContentProvider(env) !== null;
