// Shared Zod schema for creating an assignment. Used by the wizard (client-side feedback) and by
// the server (authoritative). The server additionally re-checks every outcome against the DB.

import { z } from "zod";
import { DEFAULT_QUESTION_COUNT, questionCountSchema } from "../content/study-content-schema.ts";

export const createAssignmentSchema = z
  .object({
    classroomId: z.string().min(1, "Sınıf seçilmelidir."),
    subject: z.string().trim().min(1, "Ders seçilmelidir."),
    unitOrTheme: z.string().trim().min(1, "Tema/ünite seçilmelidir."),
    topic: z.string().trim().min(1, "Konu girilmelidir.").max(200, "Konu en fazla 200 karakter olabilir."),
    outcomeIds: z.array(z.string().min(1)).max(50, "En fazla 50 öğrenme çıktısı seçilebilir."),
    minimumScore: z.coerce
      .number({ error: "Başarı eşiği sayı olmalıdır." })
      .int("Başarı eşiği tam sayı olmalıdır.")
      .min(0, "Başarı eşiği 0–100 arasında olmalıdır.")
      .max(100, "Başarı eşiği 0–100 arasında olmalıdır."),
    deadline: z.coerce.date({ error: "Geçerli bir son tarih girilmelidir." }),
    questionCount: questionCountSchema.default(DEFAULT_QUESTION_COUNT),
    // Assignments are always created as drafts; publishing happens via "Onayla ve Yayınla"
    // after the preparation content is reviewed.
    status: z.literal("DRAFT", { error: "Görev önce taslak olarak oluşturulur; hazırlık içeriği onaylanınca yayınlanır." }).default("DRAFT"),
  })
  .superRefine((v, ctx) => {
    if (Number.isNaN(v.deadline.getTime())) {
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "Geçerli bir son tarih girilmelidir." });
    } else if (v.deadline.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "Son tarih gelecekte olmalıdır." });
    }
    if (new Set(v.outcomeIds).size !== v.outcomeIds.length) {
      ctx.addIssue({ code: "custom", path: ["outcomeIds"], message: "Aynı öğrenme çıktısı birden fazla seçilmiş." });
    }
  });

export type CreateAssignmentInput = z.input<typeof createAssignmentSchema>;
export type ValidCreateAssignment = z.output<typeof createAssignmentSchema>;

/** Flatten Zod issues to { field: [messages] } for the UI. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
