// Assistant service ("Etüt Asistan"): context-aware, friendly, secure guidance.
// Integrates with EVREN LLM if configured, and falls back gracefully to a robust
// local domain knowledge base if EVREN is unreachable or times out.

import { EVREN_DEFAULT_REASONING_EFFORT, EVREN_FALLBACK_MODEL } from "../ai/providers/evren-provider.ts";

export interface AssistantChatContext {
  path?: string;
  role?: string; // "TEACHER" | "STUDENT" | "ADMIN" | "GUEST"
  userName?: string;
}

const SYSTEM_PROMPT = `Sen 'DersBot' adında, DersBot akıllı eğitim platformunda öğretmenlere ve öğrencilere yardımcı olan sevimli, zeki, mezuniyet kepli yardımcı eğitim robotusun.
Temel ilkelerin:
1. Kısa, samimi, anlaşılır, Türkçe ve motive edici yanıtlar ver (en fazla 2-3 kısa paragraf).
2. Kullanıcının rolüne (öğretmen veya öğrenci) ve bulunduğu sayfaya duyarlı rehberlik sağla.
3. Öğretmenlere: görev oluşturma, MEB kazanımı seçimi, AI taslak hazırlama, sınıf kodunu paylaşma, açık uçlu soru değerlendirme ve sınıf arşivleme konularında yol göster.
4. Öğrencilere: sınıfa katılma kodu girme, hazırlık görevlerini çözme, konu özetini okuma, 'Derse Hazır' / 'Tekrar Gerekli' durumları hakkında bilgi ver.
5. ASLA teknik gizli bilgileri (API key, veritabanı URL, şifre hash, token) açıklama.
6. ASLA başka kullanıcıların sınıflarına veya öğrenci verilerine eriştiğini iddia etme.
7. ASLA veritabanında henüz yapılmamış işlemleri 'yaptım/tamamlandı' gibi gösterme; kullanıcıya bu işlemi nasıl yapabileceğini tarif et.`;

// Comprehensive local domain knowledge base for instant, deterministic, and resilient answers
function getDeterministicResponse(message: string, context: AssistantChatContext): string | null {
  const q = message.toLowerCase().trim();
  const role = context.role ?? "GUEST";
  const path = context.path ?? "/";

  // Greetings
  if (/^(merhaba|selam|günaydın|iyi günler|hey)/.test(q)) {
    if (role === "TEACHER") {
      return `Merhaba Hocam! Ben DersBot, akıllı eğitim asistanınız. Yeni görev oluşturma, sınıf yönetimi veya öğrenci değerlendirmeleri konusunda size nasıl yardımcı olabilirim?`;
    }
    if (role === "STUDENT") {
      return `Merhaba! Ben DersBot. Sınıfa katılma, derse hazırlık görevlerini tamamlama veya başarı durumun hakkında aklına takılanları sorabilirsin!`;
    }
    return `Merhaba! Ben DersBot, akıllı eğitim platformunun rehber robotuyum. Platform hakkında merak ettiğiniz her şeyi bana sorabilirsiniz.`;
  }

  // Teacher specific questions
  if (role === "TEACHER" || q.includes("öğretmen") || q.includes("görev nasıl")) {
    if (q.includes("yeni görev") || q.includes("görev oluştur") || q.includes("ödev oluştur")) {
      return `Yeni görev oluşturmak için üst menüdeki **"+ Yeni Görev"** butonuna tıklayabilirsiniz. Sırasıyla:\n1. Sınıfınızı ve dersinizi seçin,\n2. MEB müfredatından ünite ve kazanımı belirleyin,\n3. "Yapay Zekâ ile Taslak Oluştur" butonuyla veya manuel olarak özet ve soruları hazırlayın,\n4. Başarı eşiğini (%70 vb.) ve teslim tarihini belirleyip görevi yayınlayın.`;
    }
    if (q.includes("sınıf kodu") || q.includes("kod nerede") || q.includes("katılım kodu")) {
      return `Sınıf kodunuza **"Sınıflarım"** sayfasından veya sınıfın detayına tıklayarak ulaşabilirsiniz. 8 haneli bu kodu (örn: AB12-CD34) öğrencilerinizle paylaşın; öğrenciler panolarındaki "Sınıfa Katıl" kutusuna girerek doğrudan sınıfınıza dahil olurlar. Dilerseniz sınıf detayından kodu dilediğiniz an yenileyebilirsiniz.`;
    }
    if (q.includes("ai taslak") || q.includes("yapay zekâ taslak") || q.includes("taslak oluştur")) {
      return `Görev oluştururken MEB kazanımını seçtikten sonra **"Yapay Zekâ ile Taslak Oluştur"** butonuna basarak kazanımla birebir uyumlu ders özeti ve soru setini otomatik hazırlatabilirsiniz. Üretilen taslak üzerinde dilediğiniz düzenlemeyi yapıp onaylayabilirsiniz.`;
    }
    if (q.includes("cevap") || q.includes("öğrenci cevap") || q.includes("analiz") || q.includes("sonuç")) {
      return `Öğrenci cevaplarını **"Değerlendirme"** sayfasından veya ilgili sınıfın detayındaki öğrenci listesinden **"Geçmişi Gör"** butonuna tıklayarak inceleyebilirsiniz. Otomatik puanlanan sorular anında görünür; açık uçlu soruları ise siz puanlayabilirsiniz.`;
    }
    if (q.includes("değerlendir") || q.includes("açık uçlu") || q.includes("puanla")) {
      return `Çoktan seçmeli ve eşleştirme soruları sistem tarafından otomatik puanlanır. Açık uçlu sorular için **"Değerlendirme"** sayfasındaki *İnceleme Bekleyenler* sekmesine giderek öğrencinin yanıtına 0-100 arası puan verip geri bildirim yazabilirsiniz.`;
    }
    if (q.includes("sınıf düzenle") || q.includes("sınıfı arşivle") || q.includes("sınıf sil")) {
      return `Sınıfınızı yönetmek için **"Sınıflarım"** menüsünden ilgili sınıfa tıklayın. Sayfanın üst kısmında bulunan **"Sınıfı Düzenle"** ile ad/açıklamayı değiştirebilir, **"Katılım Kodunu Yenile"** ile yeni kod üretebilir veya **"Sınıfı Arşivle"** ile sınıfı arşivleyebilirsiniz. Hiç öğrencisi olmayan boş sınıflar kalıcı olarak silinebilirken, verisi olan sınıflar geçmiş raporları korumak adına arşivlenir.`;
    }
  }

  // Student specific questions
  if (role === "STUDENT" || q.includes("öğrenci") || q.includes("sınıfa nasıl")) {
    if (q.includes("katıl") || q.includes("sınıf kodu") || q.includes("kodu nereye")) {
      return `Öğretmeninizin size verdiği 8 haneli katılım kodunu **"Görevlerim"** veya **"Profil"** sayfasındaki **"Sınıfa Katıl"** alanına yazıp "Katıl" butonuna tıklayarak hemen sınıfınıza dahil olabilirsiniz.`;
    }
    if (q.includes("görevler") || q.includes("ödevlerim") || q.includes("nasıl çözerim")) {
      return `**"Görevlerim"** sayfasına giderek size atanan hazırlık çalışmalarını görebilirsiniz. Bir göreve tıkladığınızda önce konu özetini ve kavramları dikkatle okuyun, ardından ön bilgi kontrol sorularını çözerek çalışmanızı tamamlayın.`;
    }
    if (q.includes("derse hazır") || q.includes("hazır ne demek")) {
      return `**"Derse Hazır"**, görevin konu anlatımını çalışıp soruları başarı eşiğinin üzerinde (örneğin %70 ve üzeri) doğru yanıtladığınız anlamına gelir. Bu rozeti aldığınızda derse tam donanımlı hazır sayılırsınız! 🎉`;
    }
    if (q.includes("tekrar gerekli") || q.includes("tekrar ne demek")) {
      return `**"Tekrar Gerekli"**, test puanınızın öğretmeninizin belirlediği başarı eşiğinin altında kaldığını gösterir. Endişelenmeyin! Konu özetini tekrar okuyup öğretmeninizin tanımladığı ek deneme haklarını kullanarak puanınızı yükseltebilirsiniz.`;
    }
    if (q.includes("şifre") || q.includes("şifremi değiştir")) {
      return `Şifrenizi değiştirmek için sağ üstteki **"Profil"** sayfasına gidin. "Şifre Yönetimi" bölümünden mevcut şifrenizi girerek güvenle yeni bir şifre belirleyebilirsiniz.`;
    }
  }

  // General questions
  if (q.includes("profil") || q.includes("hesap")) {
    return `Sağ üst menüdeki adınıza veya **"Profil"** bağlantısına tıklayarak ad soyad bilgilerinizi güncelleyebilir, şifrenizi değiştirebilir ve sınıf bilgilerinizi görüntüleyebilirsiniz.`;
  }
  if (q.includes("çıkış") || q.includes("çıkış yap")) {
    return `Sağ üst menüde yer alan **"Çıkış Yap"** butonuna tıklayarak oturumunuzu güvenle sonlandırabilirsiniz.`;
  }

  // Contextual fallback based on path
  if (path.includes("/ogretmen/gorevler/yeni")) {
    return `Şu anda **Yeni Görev** ekranındasınız. Bu ekranda sırasıyla sınıfınızı, dersinizi ve MEB öğrenme çıktısını seçerek AI destekli veya kendi hazırladığınız derse hazırlık görevini oluşturabilirsiniz.`;
  }
  if (path.includes("/ogretmen/siniflar")) {
    return `Şu anda **Sınıf Yönetimi** ekranındasınız. Burada yeni sınıflar açabilir, sınıf katılım kodlarını görüntüleyebilir veya sınıflarınızı arşivleyebilirsiniz.`;
  }
  if (path.includes("/ogrenci/gorevler")) {
    return `Şu anda **Görevlerim** ekranındasınız. Öğretmenlerinizin tanımladığı derse hazırlık çalışmalarını buradan takip edebilir veya üst kısımdan yeni bir sınıfa katılabilirsiniz.`;
  }

  return `Size en iyi şekilde yardımcı olmak isterim! DersBot platformunda görev oluşturma, sınıfa katılma kodları, ders özetleri veya başarı durumları hakkında bana soru sorabilirsiniz.`;
}

export async function chatWithAssistant(message: string, context: AssistantChatContext, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  return (await chatWithAssistantDetailed(message, context, { env })).text;
}

/**
 * Like chatWithAssistant, but also says whether EVREN actually answered (source "ai") – only then
 * does the message count against the user's DersBot quota. allowAi=false (guests, quota checks
 * that failed) answers from the local knowledge base without calling EVREN.
 */
export async function chatWithAssistantDetailed(
  message: string,
  context: AssistantChatContext,
  { env = process.env, allowAi = true, fetchImpl = fetch }: { env?: NodeJS.ProcessEnv; allowAi?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<{ text: string; source: "ai" | "fallback" }> {
  const trimmed = message.trim();
  if (!trimmed) return { text: "Lütfen bir soru yazın.", source: "fallback" };

  // Check if we can get a high-quality deterministic response first
  const deterministic = getDeterministicResponse(trimmed, context);

  // If EVREN LLM is configured, call EVREN with low reasoning effort & short token limit
  const baseUrl = env.EVREN_LLM_BASE_URL?.trim();
  const apiKey = env.EVREN_LLM_API_KEY?.trim() || env.AI_API_KEY?.trim();
  const provider = env.AI_PROVIDER?.trim().toLowerCase();

  if (allowAi && provider === "evren" && baseUrl && apiKey) {
    try {
      const model = env.EVREN_LLM_MODEL?.trim() || EVREN_FALLBACK_MODEL;
      const effort = env.EVREN_LLM_REASONING_EFFORT?.trim().toLowerCase() || EVREN_DEFAULT_REASONING_EFFORT;

      const userContextPrompt = `Kullanıcı Rolü: ${context.role ?? "GUEST"}\nBulunduğu Sayfa: ${context.path ?? "/"}\nKullanıcı Sorusu: ${trimmed}`;

      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContextPrompt },
        ],
        temperature: 0.3,
        max_tokens: 350,
      };

      if (effort && effort !== "off") {
        body.reasoning_effort = effort;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000); // 12 seconds max for chatbot

      const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim().length > 0) {
          // Clean any stray <think> blocks
          const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          if (cleaned.length > 0) return { text: cleaned, source: "ai" };
        }
      }
    } catch {
      // Graceful fallback to deterministic response
    }
  }

  // Resilient fallback (guarantees zero infinite spinner and instant response)
  return {
    text: deterministic ?? `Size yardımcı olmak isterim! Görev oluşturma, sınıfa katılma, başarı durumu veya profil ayarları hakkında soru sorabilirsiniz.`,
    source: "fallback",
  };
}
