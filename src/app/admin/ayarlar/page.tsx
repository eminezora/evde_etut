import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";
import { SettingsManager, type SettingsMap } from "@/components/admin/SettingsManager.tsx";

export const metadata = { title: "Sistem Ayarları – Evde Etüt Admin" };

const DEFAULT_SETTINGS: SettingsMap = {
  platformName: "Evde Etüt",
  supportEmail: "destek@evdeetut.k12.tr",
  teacherSignupsEnabled: "true",
  studentSignupsEnabled: "true",
  defaultSuccessScore: "70",
  defaultQuestionCount: "7",
  maintenanceMode: "false",
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  const rows = await prisma.systemSetting.findMany();
  const settings: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in settings) {
      (settings as unknown as Record<string, string>)[r.key] = r.value;
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>Sistem Ayarları</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Platform genelindeki kayıt politikaları, varsayılan eşikler ve operasyonel tercihler.
        </p>
      </div>

      <SettingsManager initialSettings={settings} />
    </div>
  );
}
