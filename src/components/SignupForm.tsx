"use client";

import { useState } from "react";
import { LIMITS, TAGS } from "@/lib/config";
import type { CategoryStatus, Fields, Tag } from "@/lib/types";

/**
 * Used for both new sign-ups and edits. `current` is the category the sign-up
 * already sits in when editing: it stays selectable even when full.
 */
export function SignupForm({
  categories,
  initial,
  current,
  hideCategories,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  categories: CategoryStatus[];
  initial: Fields;
  current?: string;
  /** For the guided flow, where the category was already picked on the previous step. */
  hideCategories?: boolean;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (fields: Fields) => void;
}) {
  const [f, setF] = useState<Fields>(initial);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const cat = categories.find((c) => c.id === f.category);
  const toggleTag = (t: Tag) =>
    set(
      "tags",
      f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t],
    );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
    >
      {!hideCategories && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Category</legend>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => {
              const open = c.left > 0 || c.id === current;
              const selected = f.category === c.id;
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-squash ${
                    selected
                      ? "border-cranberry bg-cranberry text-white"
                      : open
                        ? "border-line bg-paper/60 hover:border-ink/30"
                        : "cursor-not-allowed border-line/70 text-muted/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c.id}
                    checked={selected}
                    disabled={!open}
                    onChange={() => set("category", c.id)}
                    className="sr-only"
                  />
                  <span aria-hidden className="text-lg">
                    {c.emoji}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-medium">{c.label}</span>
                    <span
                      className={`block text-xs ${selected ? "text-white/80" : "text-muted"}`}
                    >
                      {c.id === current
                        ? "yours"
                        : c.left > 0
                          ? `${c.left} left`
                          : "full"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <Field label="Your name">
        <input
          required
          maxLength={LIMITS.name}
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="given-name"
          placeholder="First name is fine"
          className={inputCls}
        />
      </Field>

      <Field label="What are you bringing?" hint={cat?.hint}>
        <input
          required
          maxLength={LIMITS.dish}
          value={f.dish}
          onChange={(e) => set("dish", e.target.value)}
          placeholder="e.g. Grandma's sweet potato casserole"
          className={inputCls}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Good to know{" "}
          <span className="font-normal text-muted">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = f.tags.includes(t);
            return (
              <button
                type="button"
                key={t}
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  on
                    ? "border-sage bg-sage text-white"
                    : "border-line bg-paper/60 hover:border-ink/30"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Note for the hosts" optional>
        <input
          maxLength={LIMITS.note}
          value={f.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Need oven space? Bringing a +1?"
          className={inputCls}
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-cranberry/10 px-3 py-2 text-sm text-cranberry-dark"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-cranberry py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-cranberry-dark disabled:opacity-60"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none transition placeholder:text-muted/60 focus:border-squash focus:ring-2 focus:ring-squash/25";

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}{" "}
        {optional && <span className="font-normal text-muted">(optional)</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-muted">Ideas: {hint}</span>
      )}
    </label>
  );
}
