import { describe, expect, it } from "vitest";
import { getContentProvider } from "../src/lib/ai/index.ts";
import { ProviderError, type PreparationContentInput } from "../src/lib/ai/content-generation-provider.ts";
import { EvrenContentProvider, extractJson } from "../src/lib/ai/providers/evren-provider.ts";
import { SYSTEM_PROMPT } from "../src/lib/ai/prompt-builder.ts";
import { parseGeneratedContent } from "../src/lib/ai/response-schema.ts";

const base = { NODE_ENV: "test", AI_PROVIDER: "evren", EVREN_LLM_BASE_URL: "https://llm.example.test/v1", EVREN_LLM_API_KEY: "test-key" } as NodeJS.ProcessEnv;

const input: PreparationContentInput = {
  scope: "SUMMARY",
  subject: "Matematik",
  grade: 5,
  unitOrTheme: "1.Tema",
  teacherTopic: "Basamak değeri",
  questionCount: 5,
  outcomes: [{ code: "MAT.5.1.1", text: "Altı basamaklı sayıları okuma…", processComponents: ["a) …"] }],
};
const summary = { introduction: "Giriş", keyConcepts: [{ term: "Basamak", explanation: "…" }], summary: "Özet", simpleExample: "Örnek", mustKnow: ["1", "2", "3"] };

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const chat = (content: string, finish = "stop") => ({ choices: [{ message: { content }, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
const signal = () => AbortSignal.timeout(5_000);

describe("EVREN provider configuration", () => {
  it("reads the model only from EVREN_LLM_MODEL, falling back to glm-5.3", () => {
    expect(getContentProvider(base)?.model).toBe("glm-5.3");
    expect(getContentProvider({ ...base, EVREN_LLM_MODEL: "gemma-4-31b" })?.model).toBe("gemma-4-31b");
    expect(getContentProvider({ ...base, EVREN_LLM_MODEL: "qwen3.8-flash-next" })?.model).toBe("qwen3.8-flash-next");
    expect(getContentProvider({ ...base, AI_MODEL: "something-else" })?.model).toBe("glm-5.3"); // AI_MODEL is not used for evren
    expect(getContentProvider(base)?.name).toBe("evren");
  });

  it("controls reasoning effort via EVREN_LLM_REASONING_EFFORT", async () => {
    const effort = async (v?: string) => {
      const f = fakeFetch([{ status: 200, body: chat(JSON.stringify(summary)) }]);
      const env = { ...base, ...(v === undefined ? {} : { EVREN_LLM_REASONING_EFFORT: v }) };
      const p = getContentProvider(env) as EvrenContentProvider;
      (p as unknown as { fetchImpl: typeof fetch }).fetchImpl = f.impl;
      await p.generatePreparationContent(input, { signal: signal() });
      return JSON.parse(String(f.calls[0].init.body)).reasoning_effort;
    };
    expect(await effort()).toBe("low");
    expect(await effort("high")).toBe("high");
    expect(await effort("off")).toBeUndefined();
    expect(await effort("nonsense")).toBe("low");
  });

  it("is disabled (manual flow) without base URL or API key", () => {
    expect(getContentProvider({ ...base, EVREN_LLM_BASE_URL: "" })).toBeNull();
    expect(getContentProvider({ ...base, EVREN_LLM_BASE_URL: "not-a-url" })).toBeNull();
    expect(getContentProvider({ ...base, EVREN_LLM_API_KEY: "" })).toBeNull();
    expect(getContentProvider({ ...base, EVREN_LLM_API_KEY: "", AI_API_KEY: "k" })).not.toBeNull();
  });
});

describe("EVREN provider requests", () => {
  it("sends the grounded MEB prompt as text-only chat completion with a JSON schema", async () => {
    const f = fakeFetch([{ status: 200, body: chat(JSON.stringify(summary)) }]);
    const p = new EvrenContentProvider({ baseUrl: "https://llm.example.test/v1/", apiKey: "k", model: "glm-5.3", fetchImpl: f.impl });
    const r = await p.generatePreparationContent(input, { signal: signal() });
    expect(f.calls[0].url).toBe("https://llm.example.test/v1/chat/completions");
    const body = JSON.parse(String(f.calls[0].init.body));
    expect(body.model).toBe("glm-5.3");
    expect(body.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(body.messages[1].content).toContain("MAT.5.1.1");
    expect(typeof body.messages[1].content).toBe("string"); // no image/audio parts
    expect(body.response_format.type).toBe("json_schema");
    expect(body.reasoning_effort).toBe("low");
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(parseGeneratedContent("SUMMARY", r.raw, { questionCount: 5, allowedOutcomeCodes: ["MAT.5.1.1"] }).ok).toBe(true);
    expect(r).toMatchObject({ inputTokens: 10, outputTokens: 20 });
  });

  it("falls back to json_object mode when json_schema is rejected", async () => {
    const f = fakeFetch([{ status: 400, body: { error: { message: "response_format not supported" } } }, { status: 200, body: chat("```json\n" + JSON.stringify(summary) + "\n```") }]);
    const p = new EvrenContentProvider({ baseUrl: "https://llm.example.test/v1", apiKey: "k", model: "glm-5.3", fetchImpl: f.impl });
    const r = await p.generatePreparationContent(input, { signal: signal() });
    expect(f.calls).toHaveLength(2);
    expect(JSON.parse(String(f.calls[1].init.body)).response_format).toEqual({ type: "json_object" });
    expect(r.raw).toEqual(summary);
  });

  it("maps failures to safe provider errors", async () => {
    const make = (status: number, body: unknown) => new EvrenContentProvider({ baseUrl: "https://x.test/v1", apiKey: "k", model: "m", fetchImpl: fakeFetch([{ status, body }]).impl });
    await expect(make(401, { error: {} }).generatePreparationContent(input, { signal: signal() })).rejects.toMatchObject({ kind: "FAILED" });
    await expect(make(200, chat("{\"a\":", "length")).generatePreparationContent(input, { signal: signal() })).rejects.toMatchObject({ kind: "INCOMPLETE" });
    await expect(make(200, chat("üzgünüm, JSON yok")).generatePreparationContent(input, { signal: signal() })).rejects.toBeInstanceOf(ProviderError);
  });

  it("reports an unreachable API as a safe provider error (real network call, no mock)", async () => {
    const p = new EvrenContentProvider({ baseUrl: "http://127.0.0.1:9/v1", apiKey: "k", model: "glm-5.3" });
    await expect(p.generatePreparationContent(input, { signal: signal() })).rejects.toMatchObject({ kind: "FAILED" });
  });

  it("strips reasoning blocks and code fences", () => {
    expect(extractJson("<think>plan…</think>\n```json\n{\"x\":1}\n```")).toEqual({ x: 1 });
    expect(() => extractJson("{bozuk")).toThrow(ProviderError);
  });
});
