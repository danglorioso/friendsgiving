"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/config";
import type { Category, CategoryStatus } from "@/lib/types";

type Row = Category & { key: string; taken: number };

let tempKey = 0;
const newKey = () => `new-${++tempKey}`;

/**
 * Edits the whole category list at once and saves it in one go, so guests never
 * see a half-edited set. A category with sign-ups can't be deleted from here.
 */
export function CategoryEditor({
  categories,
  busy,
  error,
  onSave,
  onCancel,
}: {
  categories: CategoryStatus[];
  busy: boolean;
  error: string | null;
  onSave: (categories: Category[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    categories.map(({ id, label, emoji, cap, hint, taken }) => ({ key: id, id, label, emoji, cap, hint, taken })),
  );

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(rows.map(({ id, label, emoji, cap, hint }) => ({ id, label, emoji, cap, hint })));
      }}
    >
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-2xl border border-line bg-white/70 p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <label className="shrink-0">
              <span className="sr-only">Emoji</span>
              <input
                value={r.emoji}
                onChange={(e) => patch(r.key, { emoji: e.target.value })}
                maxLength={LIMITS.categoryEmoji}
                className="h-12 w-14 rounded-xl border border-line bg-white text-center text-2xl outline-none focus:border-squash focus:ring-2 focus:ring-squash/25"
              />
            </label>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Category name</span>
              <input
                required
                value={r.label}
                placeholder="Category name"
                onChange={(e) => patch(r.key, { label: e.target.value })}
                maxLength={LIMITS.categoryLabel}
                className={`${input} h-12 font-display text-lg`}
              />
            </label>
            <div className="flex shrink-0 flex-col">
              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <path d="M5 12l5-5 5 5" />
              </IconButton>
              <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <path d="M5 8l5 5 5-5" />
              </IconButton>
            </div>
          </div>

          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-semibold text-muted">Ideas shown to guests</span>
            <input
              value={r.hint}
              placeholder="e.g. Pie, cake, cookies"
              onChange={(e) => patch(r.key, { hint: e.target.value })}
              maxLength={LIMITS.categoryHint}
              className={input}
            />
          </label>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">Spots</span>
              <div className="flex items-center rounded-full border border-line bg-white">
                <button
                  type="button"
                  aria-label="Fewer spots"
                  disabled={r.cap <= 0}
                  onClick={() => patch(r.key, { cap: Math.max(0, r.cap - 1) })}
                  className="h-9 w-9 rounded-full text-lg disabled:opacity-30"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={LIMITS.cap}
                  value={r.cap}
                  aria-label="Spots"
                  onChange={(e) => patch(r.key, { cap: Math.max(0, Math.min(LIMITS.cap, Number(e.target.value) || 0)) })}
                  className="w-10 bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="More spots"
                  disabled={r.cap >= LIMITS.cap}
                  onClick={() => patch(r.key, { cap: Math.min(LIMITS.cap, r.cap + 1) })}
                  className="h-9 w-9 rounded-full text-lg disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-right text-xs leading-tight">
              <p className="text-muted">{r.taken} signed up</p>
              {r.taken > 0 ? null : (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="-mr-2 mt-0.5 rounded-full px-2 py-0.5 font-medium text-cranberry hover:bg-cranberry/10"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          {r.taken > 0 && (
            <p className="mt-2 text-xs text-muted/70">To delete this category, cancel and remove its sign-ups first.</p>
          )}
          {r.cap < r.taken && (
            <p className="mt-2 text-xs text-squash">
              Fewer spots than people already signed up. Nobody is removed; the category just shows as full.
            </p>
          )}
        </div>
      ))}

      {rows.length < LIMITS.categories && (
        <button
          type="button"
          onClick={() =>
            setRows((rs) => [...rs, { key: newKey(), id: "", label: "", emoji: "🍽️", cap: 2, hint: "", taken: 0 }])
          }
          className="w-full rounded-2xl border border-dashed border-muted/50 py-3 text-sm font-medium text-muted hover:border-squash hover:text-ink"
        >
          + Add category
        </button>
      )}

      {error && <p className="rounded-xl bg-cranberry/10 px-3 py-2 text-sm text-cranberry-dark">{error}</p>}

      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-gradient-to-t from-card via-card to-card/0 px-1 pb-1 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 rounded-full border border-line py-3 font-semibold hover:bg-line/40">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-[2] rounded-full bg-cranberry py-3 font-semibold text-white hover:bg-cranberry-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save categories"}
        </button>
      </div>
    </form>
  );
}

const input =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none placeholder:text-muted/60 focus:border-squash focus:ring-2 focus:ring-squash/25";

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-6 w-8 items-center justify-center rounded-md text-muted hover:bg-line/60 hover:text-ink disabled:opacity-25"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
