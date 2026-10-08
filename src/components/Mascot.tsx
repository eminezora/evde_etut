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
          aria-label={isOpen ? "Asistanı kapat" : "Etüt Asistan ile sohbet et"}
          title="Etüt Asistan"
          onClick={() => {
            if (pref === "min") {
              savePref("on");
            }
            setIsOpen((prev) => !prev);
          }}
        >
          <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
            <path d="M14 50c-4-6-5-14-3-22 3-11 11-17 21-17s18 6 21 17c2 8 1 16-3 22-5 7-31 7-36 0z" fill="#2563eb" />
            <path d="M20 47c-2-4-2-9 0-13 3-5 8-7 12-7s9 2 12 7c2 4 2 9 0 13-4 5-20 5-24 0z" fill="#dbeafe" />
            <path d="M14 22 10 12l10 6zM50 22l4-10-10 6z" fill="#1d4ed8" />
            <circle cx="24" cy="27" r="7" fill="#fff" />
            <circle cx="40" cy="27" r="7" fill="#fff" />
            <circle className="mascot-pupil" cx="25" cy="28" r="3.2" fill="#1e293b" />
            <circle className="mascot-pupil" cx="39" cy="28" r="3.2" fill="#1e293b" />
            <path d="M29 33h6l-3 4z" fill="#f59e0b" />
            <path d="M18 9h28l-14-6z" fill="#1e293b" />
            <path d="M44 9v6" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <path d="M26 54h4M34 54h4" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Chatbot Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Etüt Asistan Sohbet Penceresi"
          style={{
            position: "fixed",
            bottom: "82px",
            right: "20px",
            width: "360px",
            maxWidth: "calc(100vw - 32px)",
            height: "490px",
            maxHeight: "calc(100vh - 110px)",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)",
            display: "flex",
            flexDirection: "column",
            zIndex: 101,
            overflow: "hidden",
            animation: "mascot-fade 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                🦉
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>Etüt Asistan</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                  {isTeacher ? "Öğretmen Rehberi" : isStudent ? "Öğrenci Rehberi" : "Platform Asistanı"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Küçült"
                aria-label="Küçült"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  padding: "0 6px",
                  lineHeight: 1,
                  opacity: 0.85,
                }}
              >
                –
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                }}
                title="Kapat"
                aria-label="Kapat"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  padding: "0 6px",
                  lineHeight: 1,
                  opacity: 0.85,
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
              padding: "14px 14px 8px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              backgroundColor: "#f8fafc",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "84%",
                  padding: "8px 12px",
                  borderRadius: m.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  backgroundColor: m.sender === "user" ? "#2563eb" : "#ffffff",
                  color: m.sender === "user" ? "#ffffff" : "#1e293b",
                  boxShadow: m.sender === "user" ? "0 1px 2px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.06)",
                  fontSize: "0.88rem",
                  lineHeight: 1.45,
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
                  color: "#64748b",
                  fontSize: "0.82rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🦉 Etüt düşünüyor...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div
            style={{
              padding: "6px 12px",
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
                disabled={loading}
                style={{
                  fontSize: "0.78rem",
                  padding: "4px 9px",
                  borderRadius: "9999px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
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
              padding: "8px 12px",
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
              placeholder="Bir soru yazın..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "20px",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                outline: "none",
                minHeight: "36px",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: input.trim() && !loading ? "#2563eb" : "#cbd5e1",
                color: "#ffffff",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flexShrink: 0,
                transition: "background 0.15s ease",
              }}
              title="Gönder"
              aria-label="Gönder"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
