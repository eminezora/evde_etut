"use client";

// Student-side question controls. Each receives the student view of a question (never the
// correct answer) and reports changes through onChange. All controls are native form elements,
// so they work with keyboard and screen readers; matching uses selects and ordering uses
// up/down buttons instead of drag-and-drop.

import type { StudentQuestion } from "@/lib/content/question-schema.ts";
import type { AnswerValue } from "@/lib/assessment/answer-schema.ts";

type Props<T = AnswerValue> = { question: StudentQuestion; value: T | null; onChange: (v: AnswerValue) => void; disabled?: boolean };
type Q = Record<string, unknown> & StudentQuestion;

function Choices({ question, value, onChange, disabled, options }: Props & { options: string[] }) {
  const selected = value?.selectedIndex as number | undefined;
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend className="sr-only">Seçenekler</legend>
      {options.map((o, i) => (
        <label key={i} className={`option ${selected === i ? "selected" : ""}`}>
          <input type="radio" name={`q-${question.id}`} checked={selected === i} onChange={() => onChange({ selectedIndex: i })} />
          <span>{o}</span>
        </label>
      ))}
    </fieldset>
  );
}

function TrueFalse({ question, value, onChange, disabled }: Props) {
  const v = value?.value as boolean | undefined;
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend className="sr-only">Doğru mu, yanlış mı?</legend>
      {[true, false].map((b) => (
        <label key={String(b)} className={`option ${v === b ? "selected" : ""}`}>
          <input type="radio" name={`q-${question.id}`} checked={v === b} onChange={() => onChange({ value: b })} />
          <span>{b ? "Doğru" : "Yanlış"}</span>
        </label>
      ))}
    </fieldset>
  );
}

function TextAnswer({ question, value, onChange, disabled, long }: Props & { long?: boolean }) {
  const id = `ans-${question.id}`;
  const text = (value?.text as string | undefined) ?? "";
  return (
    <>
      <label htmlFor={id} className="sr-only">Cevabın</label>
      {long ? (
        <textarea id={id} rows={7} maxLength={5000} value={text} disabled={disabled} onChange={(e) => onChange({ text: e.target.value })} placeholder="Cevabını yaz…" />
      ) : question.type === "FILL_IN_THE_BLANK" ? (
        <input id={id} type="text" maxLength={200} value={text} disabled={disabled} onChange={(e) => onChange({ text: e.target.value })} placeholder="Boşluğa gelecek ifade" autoComplete="off" />
      ) : (
        <textarea id={id} rows={3} maxLength={1000} value={text} disabled={disabled} onChange={(e) => onChange({ text: e.target.value })} placeholder="Cevabını yaz…" />
      )}
    </>
  );
}

function Matching({ question, value, onChange, disabled }: Props) {
  const q = question as Q;
  const left = q.left as string[];
  const right = q.right as string[];
  const matches = (value?.matches as (string | null)[] | undefined) ?? left.map(() => null);
  return (
    <div className="matching">
      {left.map((l, i) => (
        <div key={l} className="match-row">
          <label htmlFor={`m-${question.id}-${i}`}>{l}</label>
          <select
            id={`m-${question.id}-${i}`}
            value={matches[i] ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ matches: matches.map((m, j) => (j === i ? e.target.value || null : m)) })}
          >
            <option value="">Seç…</option>
            {right.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function Ordering({ question, value, onChange, disabled }: Props) {
  const items = (question as Q).items as string[];
  const order = (value?.order as number[] | undefined) ?? items.map((_, i) => i);
  const move = (pos: number, dir: -1 | 1) => {
    const next = [...order];
    [next[pos], next[pos + dir]] = [next[pos + dir], next[pos]];
    onChange({ order: next });
  };
  return (
    <>
    <ol className="ordering">
      {order.map((idx, pos) => (
        <li key={idx}>
          <span>{items[idx]}</span>
          <span className="row">
            <button type="button" disabled={disabled || pos === 0} onClick={() => move(pos, -1)} aria-label={`${items[idx]}: yukarı taşı`}>↑</button>
            <button type="button" disabled={disabled || pos === order.length - 1} onClick={() => move(pos, 1)} aria-label={`${items[idx]}: aşağı taşı`}>↓</button>
          </span>
        </li>
      ))}
    </ol>
    {!value && (
      <button type="button" disabled={disabled} onClick={() => onChange({ order })}>Bu sıralamayı cevabım olarak işaretle</button>
    )}
    </>
  );
}

export function QuestionRenderer(props: Props) {
  const q = props.question as Q;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
      return <Choices {...props} options={q.options as string[]} />;
    case "TRUE_FALSE":
      return <TrueFalse {...props} />;
    case "FILL_IN_THE_BLANK":
    case "SHORT_ANSWER":
      return <TextAnswer {...props} />;
    case "LONG_ANSWER":
      return <TextAnswer {...props} long />;
    case "MATCHING":
      return <Matching {...props} />;
    case "ORDERING":
      return <Ordering {...props} />;
    case "CONTEXT_BASED":
      return (
        <>
          <blockquote className="context">{q.context as string}</blockquote>
          {q.options ? <Choices {...props} options={q.options as string[]} /> : <TextAnswer {...props} />}
        </>
      );
    case "IMAGE_INTERPRETATION":
      return (
        <>
          {q.imageUrl ? (
            // Teacher-provided https image (validated server-side); plain <img> avoids proxying
            // arbitrary hosts through next/image, and no referrer is leaked.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="question-image" src={q.imageUrl as string} alt={q.imageDescription as string} referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            <p className="info">Görsel: {q.imageDescription as string}</p>
          )}
          <TextAnswer {...props} />
        </>
      );
    default:
      return <p className="error">Bu soru türü desteklenmiyor.</p>;
  }
}

/** Mirrors answer-schema isAnswered for the client-side "unanswered" hint. */
export function hasAnswer(type: string, v: AnswerValue | null | undefined) {
  if (!v) return false;
  if ("text" in v) return String(v.text).trim().length > 0;
  if (type === "MATCHING") return (v.matches as (string | null)[]).some((x) => x !== null);
  return true;
}
