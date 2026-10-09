"use client";

// "DersBot" – Platformun akıllı, sevimli eğitim robotu ve etkileşimli öğrenme asistanı.
// - Kullanıcı ilk oturum açtığında sıcak bir mini karşılama sunar.
// - Tıklanabilir sağ alt köşe asistan penceresi açar.
// - Öğretmen, öğrenci ve yöneticilere rollerine özel akıllı hızlı ipucu çipleri sağlar.
// - /api/assistant/chat endpoint'iyle gerçek zamanlı etkileşir.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PREF_KEY = "dersbot-mascot-pref"; // "min" | "off" | "on"
const SEEN_KEY = "dersbot-mascot-seen";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}

/** Idempotency key for one chat message (a resent message is counted once). */
const newMessageId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function Mascot() {
  const pathname = usePathname() ?? "/";
  const [pref, setPref] = useState<"on" | "min">("on");
  const [isOpen, setIsOpen] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // DersBot quota: when used up the input is disabled; past messages stay visible.
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [assistantQuota, setAssistantQuota] = useState<{ remaining: number | null; limit: number; unlimited: boolean; resetHint: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isTeacher = pathname.startsWith("/ogretmen");
  const isStudent = pathname.startsWith("/ogrenci");
  const isAdmin = pathname.startsWith("/admin");
  const userRole = isTeacher ? "TEACHER" : isStudent ? "STUDENT" : isAdmin ? "ADMIN" : "GUEST";

  // Tercihleri yükle
  useEffect(() => {
    let p: "on" | "min" = "on";
    try {
      const v = localStorage.getItem(PREF_KEY);
      if (v === "min") p = "min";
    } catch {
      /* storage unavailable */
    }

    let seenWelcomed = false;
    try {
      const s = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "{}");
      seenWelcomed = Boolean(s.welcomed);
    } catch {
      /* ignore */
    }

    if (!seenWelcomed) {
      try {
        sessionStorage.setItem(SEEN_KEY, JSON.stringify({ welcomed: true }));
      } catch {
        /* ignore */
      }
    }

    void Promise.resolve().then(() => {
      setPref(p);
      setWelcome(!seenWelcomed && p !== "min");
    });
  }, []);

  // Karşılama baloncuğu otomatik gizlenme
  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => setWelcome(false), 3600);
    return () => clearTimeout(t);
  }, [welcome]);

  const idCounterRef = useRef(0);

  // Role göre başlangıç mesajı
  useEffect(() => {
    let initialGreeting =
      "Merhaba! Ben DersBot, akıllı eğitim yardımcınım. Platform hakkında aklına takılan her şeyi bana sorabilirsin!";
    if (isTeacher) {
      initialGreeting =
        "Merhaba Hocam! Ben DersBot. Yeni görev planlama, sınıf kodları veya öğrenci değerlendirmeleri konusunda size rehberlik etmek için buradayım.";
    } else if (isStudent) {
      initialGreeting =
        "Selam! Ben DersBot. Sınıfa katılma, derse hazırlık özetleri veya soru çözümleri hakkında takıldığın her an bana danışabilirsin!";
    } else if (isAdmin) {
      initialGreeting =
        "Merhaba Yönetici! Ben DersBot. Öğretmen davet kodları, kullanıcı izinleri veya AI servis durumu hakkında sorularınızı yanıtlayabilirim.";
    }

    void Promise.resolve().then(() => {
      setMessages((prev) =>
        prev.length === 0 ? [{ id: "welcome-1", sender: "bot", text: initialGreeting }] : prev
      );
    });
  }, [isTeacher, isStudent, isAdmin]);

  // Sohbet açılınca (girişli kullanıcı) kalan DersBot hakkını getir.
  useEffect(() => {
    if (!isOpen || userRole === "GUEST") return;
    let cancelled = false;
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const q = json?.data?.quotas?.find((x: { feature: string }) => x.feature === "AI_ASSISTANT_MESSAGE");
        if (cancelled || !q) return;
        setAssistantQuota({ remaining: q.remaining, limit: q.limit, unlimited: q.unlimited, resetHint: q.resetHint });
        if (!q.unlimited && q.remaining === 0) setLimitMessage(q.limitMessage);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen, userRole]);

  // Yeni mesajda aşağı kaydır
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSend(textToSend?: string) {
    const query = (textToSend ?? input).trim();
    if (!query || loading || limitMessage) return;

    idCounterRef.current += 1;
    const userMsg: Message = { id: `u-${idCounterRef.current}`, sender: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          // Same id if this message is ever resent → counted once.
          messageId: newMessageId(),
          context: { path: pathname, role: userRole },
        }),
      });
      const data = await res.json();
      if (res.status === 429 && data?.code === "USAGE_LIMIT_REACHED") {
        setLimitMessage(data.message);
        setAssistantQuota((q) => (q ? { ...q, remaining: 0 } : q));
        idCounterRef.current += 1;
        setMessages((prev) => [...prev, { id: `b-${idCounterRef.current}`, sender: "bot", text: data.message }]);
        return;
      }
      setAssistantQuota((q) => (q && !q.unlimited && q.remaining !== null ? { ...q, remaining: Math.max(0, q.remaining - 1) } : q));
      idCounterRef.current += 1;
      const botMsg: Message = {
        id: `b-${idCounterRef.current}`,
        sender: "bot",
        text: data?.message || "Şu anda yanıt verilemedi. Lütfen tekrar deneyin.",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      idCounterRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${idCounterRef.current}`,
          sender: "bot",
          text: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const savePref = (p: "on" | "min") => {
    setPref(p);
    try {
      if (p === "on") localStorage.removeItem(PREF_KEY);
      else localStorage.setItem(PREF_KEY, p);
    } catch {
      /* storage unavailable */
    }
  };

  // Hızlı öneri çipleri
  const teacherChips = [
    "Yeni görev nasıl oluşturulur?",
    "Sınıf kodu nerede ve nasıl paylaşılır?",
    "Öğrenci cevaplarını nasıl değerlendiririm?",
    "AI taslak oluşturma nasıl çalışır?",
  ];

  const studentChips = [
    "Sınıfa nasıl katılırım?",
    "Bugünkü görevlerim nerede?",
    "Derse Hazır rozeti ne demek?",
    "Tekrar Gerekli ne anlama gelir?",
  ];

  const adminChips = [
    "Öğretmen davet kodu nasıl üretilir?",
    "Kullanıcı durumunu nasıl güncellerim?",
    "AI servis sağlığı nasıl kontrol edilir?",
  ];

  const chips = isTeacher ? teacherChips : isStudent ? studentChips : isAdmin ? adminChips : teacherChips;

  return (
    <>
      {/* Sağ Alt Köşe Yüzen DersBot Butonu */}
      <div
        className="dersbot-mascot-container"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
        aria-live="polite"
      >
        {/* Karşılama Baloncuğu */}
        {(welcome || (!isOpen && pref === "on")) && (
          <div
            className="dersbot-welcome-bubble"
            onClick={() => setIsOpen(true)}
            style={{
              backgroundColor: "#ffffff",
              color: "var(--brand-navy, #0f1e42)",
              padding: "10px 14px",
              borderRadius: "14px",
              border: "1.5px solid #bfdbfe",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.15)",
              fontSize: "0.84rem",
              fontWeight: 500,
              maxWidth: 240,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              lineHeight: 1.35,
              animation: "dersbot-fade-in 0.25s ease-out",
            }}
          >
            <span style={{ fontSize: "1rem" }}>👋</span>
            <div>
              <strong style={{ color: "var(--brand-blue, #2563eb)", display: "block" }}>
                DersBot Çevrim İçi
              </strong>
              <span>Yardıma mı ihtiyacın var? Tıkla!</span>
            </div>
          </div>
        )}

        {/* Ana Robot Butonu */}
        <button
          type="button"
          aria-label={isOpen ? "DersBot asistanını kapat" : "DersBot ile sohbet et"}
          title="DersBot – Akıllı Öğrenme Asistanı"
          onClick={() => {
            if (pref === "min") {
              savePref("on");
            }
            setIsOpen((prev) => !prev);
          }}
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            border: "2.5px solid #2563eb",
            boxShadow: isOpen
              ? "0 0 0 4px rgba(37, 99, 235, 0.2), 0 8px 20px rgba(15, 23, 42, 0.2)"
              : "0 4px 18px rgba(37, 99, 235, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            overflow: "hidden",
            position: "relative",
            transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/dersbot-mascot.jpg"
            alt="DersBot"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />

          {/* Çevrim içi yeşil durum noktası */}
          <span
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#10b981",
              border: "2px solid #ffffff",
              boxShadow: "0 0 6px #10b981",
            }}
          />
        </button>
      </div>

      {/* DersBot Sohbet Penceresi */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="DersBot Öğrenme Asistanı"
          style={{
            position: "fixed",
            bottom: "86px",
            right: "20px",
            width: "380px",
            maxWidth: "calc(100vw - 32px)",
            height: "520px",
            maxHeight: "calc(100vh - 110px)",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1.5px solid #bfdbfe",
            boxShadow: "0 16px 36px -4px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(37, 99, 235, 0.1)",
            display: "flex",
            flexDirection: "column",
            zIndex: 101,
            overflow: "hidden",
            animation: "dersbot-fade-in 0.2s ease-out",
          }}
        >
          {/* DersBot Başlık Barı (Mavi Degrade + Maskot) */}
          <div
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, #0f2252 0%, #1d4ed8 100%)",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid #ffffff",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/dersbot-mascot.jpg"
                  alt="DersBot Asistan"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
                    Ders<span style={{ color: "#38bdf8" }}>Bot</span>
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "2px 6px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "#fef08a",
                      fontWeight: 600,
                    }}
                  >
                    MEB Uyumlu
                  </span>
                </div>
                <div style={{ fontSize: "0.76rem", opacity: 0.9, lineHeight: 1.2 }}>
                  {isTeacher
                    ? "Öğretmen Rehber Robotu"
                    : isStudent
                    ? "Öğrenci Ders Arkadaşı"
                    : isAdmin
                    ? "Yönetici Sistem Asistanı"
                    : "Akıllı Eğitim Robotu"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  savePref("min");
                  setIsOpen(false);
                }}
                title="Simge durumuna küçült"
                aria-label="Küçült"
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                –
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Pencereyi kapat"
                aria-label="Kapat"
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Mesaj Akışı */}
          <div
            style={{
              flex: 1,
              padding: "16px 14px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              backgroundColor: "#f8fafc",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "86%",
                  padding: "10px 14px",
                  borderRadius: m.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  backgroundColor: m.sender === "user" ? "var(--brand-blue, #2563eb)" : "#ffffff",
                  color: m.sender === "user" ? "#ffffff" : "var(--brand-navy, #0f1e42)",
                  border: m.sender === "user" ? "none" : "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
                  fontSize: "0.88rem",
                  lineHeight: 1.55,
                  whiteSpace: "pre-line",
                  wordBreak: "break-word",
                }}
              >
                {m.text}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "8px 12px",
                  borderRadius: "14px 14px 14px 2px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #bfdbfe",
                  color: "var(--brand-blue, #2563eb)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontStyle: "italic" }}>DersBot düşünüyor ve yanıt hazırlıyor…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Hızlı Öneri Çipleri */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              whiteSpace: "nowrap",
              scrollbarWidth: "none",
            }}
          >
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSend(chip)}
                disabled={loading || Boolean(limitMessage)}
                style={{
                  fontSize: "0.78rem",
                  padding: "5px 12px",
                  borderRadius: "9999px",
                  border: "1px solid #bfdbfe",
                  backgroundColor: "#f0f9ff",
                  color: "#0369a1",
                  fontWeight: 500,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {(limitMessage || (assistantQuota && !assistantQuota.unlimited)) && (
            <div
              role={limitMessage ? "alert" : "status"}
              style={{
                padding: "6px 12px",
                fontSize: "0.76rem",
                borderTop: "1px solid #e2e8f0",
                background: limitMessage ? "#fffbeb" : "#ffffff",
                color: limitMessage ? "#92400e" : "#64748b",
              }}
            >
              {limitMessage ?? `${assistantQuota!.remaining} / ${assistantQuota!.limit} mesaj kaldı · ${assistantQuota!.resetHint}`}
            </div>
          )}

          {/* Soru Gönderme Formu */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "10px 12px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={limitMessage ? "Kullanım hakkınız doldu" : "DersBot'a bir soru sor…"}
              disabled={loading || Boolean(limitMessage)}
              style={{
                flex: 1,
                padding: "8px 14px",
                borderRadius: "9999px",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                outline: "none",
                minHeight: "38px",
                background: "#f8fafc",
                color: "#0f172a",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || Boolean(limitMessage)}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background:
                  input.trim() && !loading
                    ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                    : "#e2e8f0",
                color: "#ffffff",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: input.trim() && !loading ? "0 2px 6px rgba(37, 99, 235, 0.3)" : "none",
                transition: "all 0.15s ease",
              }}
              title="Gönder"
              aria-label="Gönder"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
