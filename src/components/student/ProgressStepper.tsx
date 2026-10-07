// Visual progress through the readiness flow. State is shown with icon + text, not colour alone.
import { stepIndex } from "@/lib/assessment/status-machine.ts";

const STEPS = ["Konuya Giriş", "Konu Özeti", "Okudum ve Anladım", "Ön Bilgi Kontrolü", "Sonuç"];

export function ProgressStepper({ status, summaryConfirmed }: { status: string; summaryConfirmed: boolean }) {
  // Steps strictly before `current` are done; the result step is done once a result exists.
  let current = stepIndex(status);
  if (current === 3 && !summaryConfirmed) current = 2;
  const finished = ["READY_FOR_CLASS", "NEEDS_REVIEW"].includes(status);
  return (
    <ol className="stepper" aria-label="İlerleme">
      {STEPS.map((label, i) => {
        const done = i < current || (finished && i === 4);
        const active = !done && i === current;
        return (
          <li key={label} className={done ? "done" : active ? "active" : ""} aria-current={active ? "step" : undefined}>
            <span className="step-icon" aria-hidden="true">{done ? "✓" : active ? "●" : "○"}</span>
            <span>{label}</span>
            <span className="sr-only">{done ? " (tamamlandı)" : active ? " (şu anki adım)" : " (bekliyor)"}</span>
          </li>
        );
      })}
    </ol>
  );
}
