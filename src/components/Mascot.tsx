"use client";

// "Etüt" – the site's small helper owl. Original inline SVG + CSS (no animation library).
// - A ~1.5 s welcome animation on the first page view of a browser session, then it sits small in
//   the bottom-right corner.
// - One short, page-specific tip per page per session (auto-hides); clicking the owl shows it again.
// - Can be minimised (tip off) or closed; both remembered in localStorage.
// - prefers-reduced-motion: no movement (CSS); hidden when printing.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PREF_KEY = "etut-mascot"; // "min" | "off"
const SEEN_KEY = "etut-mascot-seen"; // sessionStorage: welcome played + pages already greeted

function tipFor(path: string): string | null {
  if (path === "/") return "Merhaba, ben Etüt! Derse hazırlıkta yanındayım.";
  if (path === "/giris") return "Şifreni unuttuysan “Şifremi unuttum” bağlantısını kullanabilirsin.";
  if (path.startsWith("/kayit")) return "Öğrenciysen kayıttan sonra öğretmeninin verdiği sınıf koduyla sınıfına katılırsın.";
  if (path === "/ogrenci/gorevler") return "Sınıfa katılmak için öğretmeninden aldığın kodu kullanabilirsin.";
  if (path.startsWith("/ogrenci/gorevler/") && path.endsWith("/ozet")) return "Özeti dikkatle oku; sonra kısa bir ön bilgi kontrolü seni bekliyor.";
  if (path === "/ogretmen/gorevler") return "Yeni görev oluşturmak için “+ Yeni Görev” ile başlayabilirsiniz.";
  if (path === "/ogretmen/gorevler/yeni") return "Önce sınıfı, sonra dersi, temayı ve MEB öğrenme çıktılarını seçin.";
  if (path === "/ogretmen/siniflar") return "Sınıf kodunu öğrencilerinizle paylaşın; kodla kendileri katılırlar.";
  if (path === "/ogretmen/degerlendirme") return "Yalnızca açık uçlu cevapları puanlamanız yeterli; diğerleri otomatik puanlanır.";
  if (path.endsWith("/analiz")) return "Bir öğrencinin tüm cevaplarını görmek için “Cevapları Gör”e tıklayın.";
  return null;
}

function readSeen(): { welcomed: boolean; pages: string[] } {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "") ?? { welcomed: false, pages: [] };
  } catch {
    return { welcomed: false, pages: [] };
  }
}
function writeSeen(v: { welcomed: boolean; pages: string[] }) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export function Mascot() {
  const path = usePathname() ?? "/";
  const [pref, setPref] = useState<"on" | "min" | "off" | null>(null); // null until read on the client
  const [welcome, setWelcome] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  // Read the stored preference once (client only, so server and first client render match).
  useEffect(() => {
    let p: "on" | "min" | "off" = "on";
    try {
      const v = localStorage.getItem(PREF_KEY);
      if (v === "min" || v === "off") p = v;
    } catch {
      /* storage unavailable: default on */
    }
    const seen = readSeen();
    const first = !seen.welcomed;
    if (first) writeSeen({ ...seen, welcomed: true });
    void Promise.resolve().then(() => {
      setPref(p);
      setWelcome(first && p !== "off");
    });
  }, []);

  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => setWelcome(false), 1600);
    return () => clearTimeout(t);
  }, [welcome]);

  // One tip per page per session, shown for a few seconds.
  useEffect(() => {
    if (pref !== "on") return;
    const text = tipFor(path);
    const seen = readSeen();
    if (!text || seen.pages.includes(path)) {
      void Promise.resolve().then(() => setTip(null));
      return;
    }
    writeSeen({ ...seen, pages: [...seen.pages, path].slice(-50) });
    const show = setTimeout(() => setTip(text), 900);
    const hide = setTimeout(() => setTip(null), 9000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [path, pref]);

  const save = (p: "on" | "min" | "off") => {
    setPref(p);
    setTip(null);
    try {
      if (p === "on") localStorage.removeItem(PREF_KEY);
      else localStorage.setItem(PREF_KEY, p);
    } catch {
      /* storage unavailable */
    }
  };

  if (pref === null || pref === "off") return null;

  return (
    <div className={`mascot${welcome ? " mascot-welcome" : ""}${pref === "min" ? " mascot-min" : ""}`} aria-live="polite">
      {tip && pref === "on" && (
        <div className="mascot-bubble" role="status">
          <span>{tip}</span>
          <button type="button" className="mascot-x" aria-label="İpucunu kapat" onClick={() => setTip(null)}>×</button>
        </div>
      )}
      {pref === "on" && (
        <div className="mascot-tools">
          <button type="button" onClick={() => save("min")} aria-label="Yardımcıyı küçült" title="Küçült">–</button>
          <button type="button" onClick={() => save("off")} aria-label="Yardımcıyı kapat" title="Kapat">×</button>
        </div>
      )}
      <button
        type="button"
        className="mascot-owl"
        aria-label={pref === "min" ? "Yardımcı Etüt’ü aç" : "Etüt’ten ipucu al"}
        title="Etüt"
        onClick={() => {
          if (pref === "min") return save("on");
          setTip(tipFor(path) ?? "Bir sorun olursa sayfayı yenileyebilir veya öğretmeninize danışabilirsiniz.");
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
  );
}
