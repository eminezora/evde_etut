import { describe, expect, it } from "vitest";
import { chatWithAssistant } from "../src/lib/assistant/assistant-service.ts";

describe("assistant chatbot (Etüt Asistan)", () => {
  it("gives contextual teacher guidance for assignment creation", async () => {
    const res = await chatWithAssistant(
      "Yeni görev nasıl oluşturulur?",
      { role: "TEACHER", path: "/ogretmen/gorevler" },
      {} as NodeJS.ProcessEnv
    );
    expect(res).toContain("Yeni Görev");
    expect(res).toContain("kazanım");
  });

  it("gives contextual teacher guidance for classroom join codes", async () => {
    const res = await chatWithAssistant(
      "Sınıf kodu nerede ve nasıl paylaşılır?",
      { role: "TEACHER", path: "/ogretmen/siniflar" },
      {} as NodeJS.ProcessEnv
    );
    expect(res).toContain("Sınıflarım");
    expect(res).toContain("kod");
  });

  it("gives student guidance on how to join a classroom", async () => {
    const res = await chatWithAssistant(
      "Sınıfa nasıl katılırım?",
      { role: "STUDENT", path: "/ogrenci/gorevler" },
      {} as NodeJS.ProcessEnv
    );
    expect(res).toContain("katılım kodunu");
    expect(res).toContain("Sınıfa Katıl");
  });

  it("explains 'Derse Hazır' status clearly to a student", async () => {
    const res = await chatWithAssistant(
      "Derse Hazır ne demek?",
      { role: "STUDENT", path: "/ogrenci/gorevler" },
      {} as NodeJS.ProcessEnv
    );
    expect(res).toContain("Derse Hazır");
    expect(res).toContain("başarı eşiğinin");
  });

  it("explains 'Tekrar Gerekli' status clearly to a student", async () => {
    const res = await chatWithAssistant(
      "Tekrar Gerekli ne demek?",
      { role: "STUDENT", path: "/ogrenci/gorevler" },
      {} as NodeJS.ProcessEnv
    );
    expect(res).toContain("Tekrar Gerekli");
    expect(res).toContain("deneme");
  });

  it("returns polite fallback and never throws even for obscure questions", async () => {
    const res = await chatWithAssistant(
      "Rastgele ve bilinmeyen bir soru?",
      { role: "GUEST", path: "/" },
      {} as NodeJS.ProcessEnv
    );
    expect(res.length).toBeGreaterThan(10);
  });
});
