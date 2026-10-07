// Claude (Anthropic API) implementation. Server-only: reads AI_API_KEY from the environment.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ProviderError, type ContentGenerationProvider, type PreparationContentInput, type ProviderResult } from "../content-generation-provider.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt-builder.ts";
import { wireSchemas } from "../response-schema.ts";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export class AnthropicContentProvider implements ContentGenerationProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string = DEFAULT_ANTHROPIC_MODEL,
    timeoutMs = 90_000,
  ) {
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async generatePreparationContent(input: PreparationContentInput, { signal }: { signal: AbortSignal }): Promise<ProviderResult> {
    let response;
    try {
      response = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(input) }],
          output_config: { effort: "medium", format: betaZodOutputFormat(wireSchemas[input.scope]) },
          // Server-side refusal fallback (routes a declined request to a fallback model).
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal },
      );
    } catch (error) {
      if (signal.aborted || error instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError("TIMEOUT", "AI isteği zaman aşımına uğradı.");
      if (error instanceof Anthropic.APIError) throw new ProviderError("FAILED", `AI API hatası (HTTP ${error.status ?? "?"}).`);
      // Structured output that could not be parsed as JSON.
      throw new ProviderError("INCOMPLETE", "AI yanıtı çözümlenemedi.");
    }
    if (response.stop_reason === "refusal") throw new ProviderError("REFUSED", `AI isteği reddetti (${response.stop_details?.category ?? "kategori yok"}).`);
    if (response.stop_reason === "max_tokens") throw new ProviderError("INCOMPLETE", "AI yanıtı yarıda kesildi (max_tokens).");
    return {
      raw: response.parsed_output,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
