"use client";

// "Etüt" – Platform's interactive AI assistant and mascot.
// - Welcomes user on first session visit with a gentle animation.
// - Clicking opens the interactive chat panel with contextual quick-help chips.
// - Connects to /api/assistant/chat with graceful fallback.
// - Persists minimize / close preferences in localStorage.
// - Mobile-friendly and respects prefers-reduced-motion.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PREF_KEY = "etut-mascot"; // "min" | "off" | "on"
const SEEN_KEY = "etut-mascot-seen";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
}

export function Mascot() {
  const pathname = usePathname() ?? "/";
  const [pref, setPref] = useState<"on" | "min" | "off" | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isTeacher = pathname.startsWith("/ogretmen");
  const isStudent = pathname.startsWith("/ogrenci");
  const userRole = isTeacher ? "TEACHER" : isStudent ? "STUDENT" : "GUEST";

  // Read preferences on mount
  useEffect(() => {
    let p: "on" | "min" | "off" = "on";
    try {
      const v = localStorage.getItem(PREF_KEY);
      if (v === "min" || v === "off") p = v;
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
      setWelcome(!seenWelcomed && p !== "off");
    });
  }, []);

  // Welcome animation auto-dismiss
  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => setWelcome(false), 1600);
    return () => clearTimeout(t);
  }, [welcome]);

  const idCounterRef = useRef(0);

  // Set default greeting based on role
  useEffect(() => {
    let initialGreeting = "Merhaba! Ben Etüt, Evde Etüt asistanınızım. Platform hakkında aklınıza takılan her şeyi bana sorabilirsiniz.";
    if (isTeacher) {
      initialGreeting = "Merhaba Hocam! Ben Etüt. Görev hazırlama, sınıf kodları veya öğrenci değerlendirmeleri konusunda size yardımcı olabilirim.";
    } else if (isStudent) {
      initialGreeting = "Selam! Ben Etüt. Sınıfa katılma, görevleri tamamlama veya başarı durumun hakkında sorularını cevaplayabilirim.";
    }

    void Promise.resolve().then(() => {
      setMessages((prev) => (prev.length === 0 ? [{ id: "welcome-1", sender: "bot", text: initialGreeting }] : prev));
    });
  }, [isTeacher, isStudent]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSend(textToSend?: string) {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

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
          context: { path: pathname, role: userRole },
        }),
      });
      const data = await res.json();
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

  const savePref = (p: "on" | "min" | "off") => {
    setPref(p);
    try {
      if (p === "on") localStorage.removeItem(PREF_KEY);
      else localStorage.setItem(PREF_KEY, p);
    } catch {
      /* storage unavailable */
    }
  };

  if (pref === null || pref === "off") return null;

  // Quick suggestion chips
  const teacherChips = [
    "Yeni görev nasıl oluşturulur?",
    "Sınıf kodu nerede?",
    "Öğrenci cevaplarını göster",
    "AI taslak nasıl hazırlanır?",
  ];

  const studentChips = [
    "Sınıfa nasıl katılırım?",
    "Görevlerim nerede?",
    "Derse Hazır ne demek?",
    "Tekrar Gerekli ne demek?",
  ];

  const chips = isTeacher ? teacherChips : studentChips;

  return (
    <>
      {/* Floating Mascot Button */}
      <div
        className={`mascot${welcome ? " mascot-welcome" : ""}${pref === "min" ? " mascot-min" : ""}`}
        aria-live="polite"
        style={{ zIndex: 100 }}
      >
        <button
          type="button"
          className="mascot-owl"
          aria-label={isOpen ? "Asistan panelini kapat" : "Etüt Asistanı ile sohbet et"}
          title="Etüt Asistanı – Çalışma Rehberi"
          onClick={() => {
            if (pref === "min") {
              savePref("on");
            }
            setIsOpen((prev) => !prev);
          }}
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            border: "1.5px solid var(--border)",
            boxShadow: "0 4px 14px rgba(22, 28, 40, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 8,
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          {/* Fine-line editorial owl SVG */}
          <svg viewBox="0 0 40 40" width="34" height="34" fill="none" stroke="#161c28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Owl Body & Crown */}
            <path d="M12 30c-3-4-4-9-2-15 2-7 7-11 14-11s12 4 14 11c2 6 1 11-2 15-3 4-21 4-24 0z" />
            {/* Feather details */}
            <path d="M16 28c-1-3-1-6 0-9 2-3 5-4 8-4s6 1 8 4c1 3 1 6 0 9" stroke="#1e3a8a" strokeWidth="1.4" />
            {/* Scholarly spectacles */}
            <circle cx="15.5" cy="18" r="4.2" stroke="#1e3a8a" strokeWidth="1.5" />
            <circle cx="24.5" cy="18" r="4.2" stroke="#1e3a8a" strokeWidth="1.5" />
            <line x1="19.7" y1="18" x2="20.3" y2="18" stroke="#1e3a8a" strokeWidth="1.5" />
            {/* Eyes / Pupils */}
            <circle cx="15.5" cy="18" r="1.4" fill="#161c28" stroke="none" />
            <circle cx="24.5" cy="18" r="1.4" fill="#161c28" stroke="none" />
            {/* Beak */}
            <path d="M18.8 22.2l1.2 2 1.2-2z" fill="#c2410c" stroke="#c2410c" strokeWidth="0.8" />
            {/* Open Book Base */}
            <path d="M11 34c4-1 8-1 9 1 1-2 5-2 9-1" stroke="#161c28" strokeWidth="1.6" />
          </svg>
        </button>
      </div>

      {/* Editorial Assistant Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Etüt Çalışma Asistanı Paneli"
          style={{
            position: "fixed",
            bottom: "82px",
            right: "20px",
            width: "370px",
            maxWidth: "calc(100vw - 32px)",
            height: "500px",
            maxHeight: "calc(100vh - 110px)",
            backgroundColor: "var(--bg)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px -4px rgba(22, 28, 40, 0.18), 0 0 0 1px rgba(22, 28, 40, 0.06)",
            display: "flex",
            flexDirection: "column",
            zIndex: 101,
            overflow: "hidden",
            animation: "mascot-fade 0.2s ease-out",
          }}
        >
          {/* Masthead Header */}
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--ink)",
              color: "#fbfaf7",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #2d3748",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fbfaf7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M6 6h10" />
                  <path d="M6 10h10" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--terracotta)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  ETÜT REHBERİ
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.2, color: "#ffffff" }}>
                  {isTeacher ? "Öğretmen Masası Asistanı" : isStudent ? "Öğrenci Çalışma Asistanı" : "Platform Asistanı"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Simge durumuna küçült"
                aria-label="Küçült"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  padding: "2px 6px",
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
                  background: "transparent",
                  border: "none",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  padding: "2px 6px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div
            style={{
              flex: 1,
              padding: "16px 14px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              backgroundColor: "var(--surface-subtle)",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "86%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: m.sender === "user" ? "var(--accent)" : "#ffffff",
                  color: m.sender === "user" ? "#ffffff" : "var(--ink)",
                  border: m.sender === "user" ? "none" : "1px solid var(--border)",
                  borderLeft: m.sender === "user" ? "none" : "3px solid var(--accent)",
                  boxShadow: "0 1px 2px rgba(22, 28, 40, 0.05)",
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
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--border)",
                  borderLeft: "3px solid var(--muted)",
                  color: "var(--muted)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontStyle: "italic" }}>Etüt araştırıyor ve yanıt hazırlıyor…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid var(--border)",
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
                disabled={loading}
                style={{
                  fontSize: "0.78rem",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-subtle)",
                  color: "var(--ink)",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "10px 12px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sorunuzu buraya yazın…"
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
                fontSize: "0.88rem",
                outline: "none",
                minHeight: "36px",
                background: "var(--surface-subtle)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-xs)",
                backgroundColor: input.trim() && !loading ? "var(--accent)" : "var(--border)",
                color: "#ffffff",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s ease",
              }}
              title="Gönder"
              aria-label="Gönder"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
