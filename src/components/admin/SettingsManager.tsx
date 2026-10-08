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

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>Genel Platform Bilgileri</h2>

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

        <div style={{ marginBottom: 14 }}>
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

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>Kayıt ve Erişim Politikaları</h2>

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

        <div style={{ marginBottom: 14 }}>
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

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>Görev ve AI Varsayılanları</h2>

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

        <div style={{ marginBottom: 14 }}>
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

      <div className="info" style={{ marginBottom: 20, fontSize: "0.85rem" }}>
        🔒 <strong>Güvenlik İlkesi:</strong> Veritabanı bağlantı adresleri (DATABASE_URL), şifreleme anahtarları (AUTH_SECRET), Resend ve EVREN LLM API anahtarları gibi kritik sırlar asla bu ekranda gösterilmez; sunucu ortam değişkenleri (Environment Variables) olarak saklanır.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={busy} className="button primary">
          {busy ? "Kaydediliyor..." : "Ayarları Kaydet"}
        </button>
      </div>
    </form>
  );
}
