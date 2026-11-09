"use client";

import { useCallback, useEffect, useState } from "react";
import { Tags } from "@/components/CategoryCard";
import { CategoryEditor } from "@/components/CategoryEditor";
import { CopyButton } from "@/components/CopyButton";
import { ApiError, api } from "@/lib/client";
import type { Board, Category } from "@/lib/types";

const PIN_KEY = "fg:host-pin";

/** Host-only view: everything in one list, with notes, and the power to remove any sign-up. */
export default function HostPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const unlock = useCallback(async (p: string) => {
    setError(null);
    try {
      await api.checkPin(p);
      try {
        sessionStorage.setItem(PIN_KEY, p);
      } catch {}
      setUnlocked(true);
      setBoard(await api.board());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(PIN_KEY);
    } catch {}
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the PIN typed earlier this session
      setPin(saved);
      unlock(saved);
    }
  }, [unlock]);

  async function remove(id: string) {
    try {
      const res = await api.remove(id, { pin });
      setBoard(res.board);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the server.");
    }
  }

  async function saveCategories(categories: Category[]) {
    setSaving(true);
    setEditError(null);
    try {
      const res = await api.saveCategories(categories, pin);
      setBoard(res.board);
      setEditing(false);
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : "Couldn't reach the server.");
      if (e instanceof ApiError && e.board) setBoard(e.board);
    } finally {
      setSaving(false);
    }
  }

  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
        <h1 className="font-display text-4xl italic">Host view</h1>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            unlock(pin);
          }}
        >
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Host PIN"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-squash focus:ring-2 focus:ring-squash/25"
          />
          {error && <p className="text-sm text-cranberry-dark">{error}</p>}
          <button type="submit" className="w-full rounded-full bg-cranberry py-3 font-semibold text-white">
            Unlock
          </button>
        </form>
      </main>
    );
  }

  if (!board) return null;

  const summary = board.categories
    .map((c) => {
      const rows = board.signups.filter((s) => s.category === c.id);
      const lines = rows.map((s) => `  • ${s.dish} (${s.name})${s.tags.length ? ` [${s.tags.join(", ")}]` : ""}`);
      return [`${c.emoji} ${c.label}: ${rows.length}/${c.cap}`, ...lines].join("\n");
    })
    .join("\n\n");

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl italic">Host view</h1>
          <p className="mt-1 text-muted">
            {board.signups.length} sign-up{board.signups.length === 1 ? "" : "s"} ·{" "}
            {board.categories.filter((c) => c.left === 0).length} of {board.categories.length} categories full
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setEditError(null);
                setEditing(true);
              }}
              className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-paper hover:bg-ink/85"
            >
              Edit categories
            </button>
          )}
          <button
            type="button"
            onClick={async () => setBoard(await api.board())}
            className="rounded-full border border-ink/15 bg-card px-3.5 py-1.5 text-sm font-medium hover:border-ink/40"
          >
            Refresh
          </button>
          <CopyButton text={summary} label="Copy summary" />
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-cranberry/10 px-3 py-2 text-sm text-cranberry-dark">{error}</p>}

      {editing ? (
        <section className="mt-8 rounded-3xl border border-line bg-card p-4 sm:p-6">
          <h2 className="font-display text-2xl">Categories</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Changes go live for guests as soon as you save. The emoji box takes any emoji.
          </p>
          <CategoryEditor
            categories={board.categories}
            busy={saving}
            error={editError}
            onSave={saveCategories}
            onCancel={() => setEditing(false)}
          />
        </section>
      ) : (
      <div className="mt-8 space-y-6">
        {board.categories.map((c) => {
          const rows = board.signups.filter((s) => s.category === c.id);
          return (
            <section key={c.id} className="rounded-3xl border border-line bg-card p-5">
              <h2 className="flex items-baseline justify-between font-display text-xl">
                <span>
                  {c.emoji} {c.label}
                </span>
                <span className={`font-sans text-sm ${c.left === 0 ? "text-muted" : "text-sage"}`}>
                  {c.taken}/{c.cap}
                </span>
              </h2>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Nobody yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {rows.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p>
                          <span className="font-semibold">{s.dish}</span>
                          <span className="text-muted"> · {s.name}</span>
                        </p>
                        <Tags tags={s.tags} />
                        {s.note && <p className="mt-1 text-sm italic text-muted">&ldquo;{s.note}&rdquo;</p>}
                        <p className="mt-1 text-xs text-muted/70">
                          {new Date(s.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      {confirm === s.id ? (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => remove(s.id)}
                            className="rounded-full bg-cranberry px-3 py-1 text-xs font-semibold text-white"
                          >
                            Remove
                          </button>
                          <button type="button" onClick={() => setConfirm(null)} className="px-2 text-xs text-muted">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirm(s.id)}
                          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-cranberry/10 hover:text-cranberry"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      )}
    </main>
  );
}
