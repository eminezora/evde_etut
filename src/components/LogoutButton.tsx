"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ label = "Çıkış" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/giris");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
