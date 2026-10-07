// Provider abstraction for AI preparation-content generation. Implementations return the model's
// raw structured output; it is untrusted until src/lib/ai/response-schema.ts validates it.

import type { GenerationScope } from "./response-schema.ts";

export interface PreparationOutcome {
  code: string;
  text: string;
  processComponents: string[];
}

/** Everything the model is allowed to see – only verified MEB curriculum data plus the teacher's topic. */
export interface PreparationContentInput {
  scope: GenerationScope;
  subject: string;
  grade: number;
  unitOrTheme: string;
  teacherTopic: string;
  outcomes: PreparationOutcome[];
  questionCount: number;
}

export interface ProviderResult {
  raw: unknown; // unvalidated structured output
  inputTokens?: number;
  outputTokens?: number;
}

export interface ContentGenerationProvider {
  readonly name: string;
  readonly model: string;
  generatePreparationContent(input: PreparationContentInput, options: { signal: AbortSignal }): Promise<ProviderResult>;
}

/** Thrown by providers for failures that have a safe, user-facing classification. */
export class ProviderError extends Error {
  constructor(
    readonly kind: "TIMEOUT" | "REFUSED" | "INCOMPLETE" | "FAILED",
    message: string,
  ) {
    super(message);
  }
}
