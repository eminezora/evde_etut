// Avatar (Google photo or initials), name, e-mail, role and account date.
import { formatDate } from "@/lib/assignments/format.ts";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("tr-TR") || "?";
}

export function ProfileHeader({ user }: { user: { name: string; email: string; role: string; createdAt: Date; avatarUrl: string | null; googleLinked: boolean } }) {
  const teacher = user.role === "TEACHER";
  return (
    <div className="card profile-header">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar, tiny, no optimisation needed
        <img src={user.avatarUrl} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
      ) : (
        <span className={`profile-avatar${teacher ? "" : " student"}`} aria-hidden="true">{initials(user.name)}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem" }}>{user.name}</h1>
        <p className="muted" style={{ margin: "0 0 8px", wordBreak: "break-all" }}>{user.email}</p>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge" style={teacher ? { background: "var(--accent-light)", color: "var(--accent)", borderColor: "var(--accent-border)" } : { background: "var(--ok-bg)", color: "var(--ok-text)", borderColor: "var(--ok-border)" }}>
            {teacher ? "👨‍🏫 Öğretmen" : "🎓 Öğrenci"}
          </span>
          {user.googleLinked && <span className="badge">Google hesabı bağlı</span>}
          <span className="muted" style={{ fontSize: "0.85rem" }}>Üyelik: {formatDate(user.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
