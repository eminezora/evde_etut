"use client";

import { useState } from "react";

export interface SettingsMap {
  platformName: string;
  supportEmail: string;
  teacherSignupsEnabled: string;
  studentSignupsEnabled: string;
  defaultSuccessScore: string;
  defaultQuestionCount: string;
  maintenanceMode: string;
}

export function SettingsManager({ initialSettings }: { initialSettings: SettingsMap }) {
  const [settings, setSettings] = useState<SettingsMap>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ayarlar kaydedilemedi.");
      } else {
        setSuccess("Sistem ayarları başarıyla güncellendi.");
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 640 }}>
      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="notice-inline ok" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <h2 style={{ fontSize: "1.05rem", fontFamily: "var(--font-serif)", margin: 0 }}>Genel Platform Parametreleri</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Platform adı ve resmi iletişim adresi</span>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="setting-platform-name">Platform Adı</label>
            <input
              id="setting-platform-name"
              type="text"
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="setting-support-email">Destek E-posta Adresi</label>
            <input
              id="setting-support-email"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <h2 style={{ fontSize: "1.05rem", fontFamily: "var(--font-serif)", margin: 0 }}>Kayıt ve Erişim Politikaları</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Kullanıcı kabulü ve bakım modu denetimi</span>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="setting-teacher-signup">Öğretmen Kayıtları</label>
            <select
              id="setting-teacher-signup"
              value={settings.teacherSignupsEnabled}
              onChange={(e) => setSettings({ ...settings, teacherSignupsEnabled: e.target.value })}
            >
              <option value="true">Açık (Davet Kodu ile)</option>
              <option value="false">Kapalı (Yeni öğretmen kabul edilmez)</option>
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="setting-student-signup">Öğrenci Kayıtları</label>
            <select
              id="setting-student-signup"
              value={settings.studentSignupsEnabled}
              onChange={(e) => setSettings({ ...settings, studentSignupsEnabled: e.target.value })}
            >
              <option value="true">Açık (Serbest Kayıt)</option>
              <option value="false">Kapalı (Yeni öğrenci kaydı kabul edilmez)</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-maintenance">Bakım Modu</label>
            <select
              id="setting-maintenance"
              value={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.value })}
            >
              <option value="false">Kapalı (Normal Çalışma)</option>
              <option value="true">Açık (Bakım Uyarısı Aktif)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <h2 style={{ fontSize: "1.05rem", fontFamily: "var(--font-serif)", margin: 0 }}>Görev ve AI Varsayılanları</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Yeni görevler için temel eşikler</span>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="setting-default-score">Varsayılan Başarı Eşiği (%)</label>
            <input
              id="setting-default-score"
              type="number"
              min={30}
              max={100}
              value={settings.defaultSuccessScore}
              onChange={(e) => setSettings({ ...settings, defaultSuccessScore: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="setting-default-qcount">Varsayılan AI Soru Sayısı</label>
            <input
              id="setting-default-qcount"
              type="number"
              min={5}
              max={10}
              value={settings.defaultQuestionCount}
              onChange={(e) => setSettings({ ...settings, defaultQuestionCount: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: "14px 18px",
          background: "var(--surface-subtle)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)",
          fontSize: "0.86rem",
          lineHeight: 1.6,
          borderRadius: "var(--radius-xs)",
        }}
      >
        <strong style={{ color: "var(--accent)" }}>Güvenlik ve Gizlilik İlkesi:</strong> Veritabanı bağlantı adresleri (DATABASE_URL), şifreleme anahtarları (AUTH_SECRET), Resend ve EVREN LLM API anahtarları gibi kritik sırlar asla bu ekranda gösterilmez; sunucu ortam değişkenleri (Environment Variables) olarak saklanır.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={busy} className="button primary" style={{ minHeight: 38, padding: "8px 24px" }}>
          {busy ? "Kaydediliyor..." : "Ayarları Kaydet"}
        </button>
      </div>
    </form>
  );
}
