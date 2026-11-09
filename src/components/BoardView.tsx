"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, api, loadMine, loadName, saveMine, saveName } from "@/lib/client";
import { EVENT } from "@/lib/config";
import { rsvpLine } from "@/lib/signup";
import type { Board, Fields, Signup } from "@/lib/types";
import { CategoryCard } from "./CategoryCard";
import { CopyButton } from "./CopyButton";
import { Sheet } from "./Sheet";
import { SignupForm } from "./SignupForm";

type Mode = { kind: "new"; category: string } | { kind: "edit"; signup: Signup } | { kind: "done"; signup: Signup };

const POLL_MS = 8000;

export function BoardView({ initial, partifulUrl }: { initial: Board; partifulUrl: string }) {
  const [board, setBoard] = useState(initial);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // localStorage is only readable after hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    setMine(loadMine());
    setName(loadName());
  }, []);

  const refresh = useCallback(() => {
    api.board().then(setBoard).catch(() => {});
  }, []);

  // Keep the board live while the tab is open, so people see spots fill up.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && refresh();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const close = useCallback(() => {
    setMode(null);
    setError(null);
    setConfirmRemove(false);
  }, []);

  function open(m: Mode) {
    setError(null);
    setConfirmRemove(false);
    setMode(m);
  }

  function rememberMine(next: Record<string, string>) {
    setMine(next);
    saveMine(next);
  }

  function failed(e: unknown) {
    if (e instanceof ApiError) {
      setError(e.message);
      if (e.board) setBoard(e.board);
    } else {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  async function create(fields: Fields) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.create(fields);
      setBoard(res.board);
      rememberMine({ ...mine, [res.signup.id]: res.secret });
      saveName(fields.name);
      setName(fields.name);
      setMode({ kind: "done", signup: res.signup });
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, fields: Fields) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.update(id, fields, { secret: mine[id] });
      setBoard(res.board);
      saveName(fields.name);
      setName(fields.name);
      setMode({ kind: "done", signup: res.signup });
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await api.remove(id, { secret: mine[id] });
      setBoard(res.board);
      const next = { ...mine };
      delete next[id];
      rememberMine(next);
      close();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  const myList = board.signups.filter((s) => mine[s.id]);
  const totalCap = board.categories.reduce((n, c) => n + c.cap, 0);
  const totalTaken = board.categories.reduce((n, c) => n + Math.min(c.taken, c.cap), 0);
  const firstOpen = board.categories.find((c) => c.left > 0)?.id;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-squash">Who&rsquo;s bringing what</p>
        <h1 className="mt-3 font-display text-5xl italic leading-none tracking-tight sm:text-7xl">{EVENT.title}</h1>
        {EVENT.date && <p className="mt-4 text-lg font-medium">{EVENT.date}</p>}
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted">{EVENT.note}</p>

        <div className="mx-auto mt-8 max-w-sm">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">
              {totalTaken} of {totalCap} spots claimed
            </span>
            <span className="text-muted">{totalCap - totalTaken} open</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="presentation">
            <div
              className="h-full rounded-full bg-gradient-to-r from-squash to-cranberry transition-all duration-700"
              style={{ width: `${totalCap ? (totalTaken / totalCap) * 100 : 0}%` }}
            />
          </div>
        </div>

        {firstOpen && myList.length === 0 && (
          <button
            type="button"
            onClick={() => open({ kind: "new", category: firstOpen })}
            className="mt-8 rounded-full bg-cranberry px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-cranberry-dark"
          >
            Sign up for a dish
          </button>
        )}
      </header>

      {!board.persistent && (
        <p className="mx-auto mt-8 max-w-2xl rounded-2xl border border-squash/40 bg-squash/10 px-4 py-3 text-center text-sm">
          Test mode: sign-ups are kept in memory and vanish when the server restarts. Connect Upstash Redis before sharing
          the link.
        </p>
      )}

      {myList.length > 0 && (
        <section className="mx-auto mt-10 max-w-2xl rounded-3xl bg-ink p-5 text-paper sm:p-6">
          <h2 className="font-display text-2xl">You&rsquo;re bringing</h2>
          <ul className="mt-3 space-y-3">
            {myList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                  <p className="font-semibold">{s.dish}</p>
                  <p className="text-sm text-paper/70">
                    {board.categories.find((c) => c.id === s.category)?.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => open({ kind: "edit", signup: s })}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-paper/80 hover:bg-white/10 hover:text-paper"
                >
                  Edit
                </button>
                <CopyButton text={rsvpLine(s)} label="Copy for Partiful" className="!border-white/20 !bg-transparent text-paper" />
              </li>
            ))}
          </ul>
          {firstOpen && (
            <button
              type="button"
              onClick={() => open({ kind: "new", category: firstOpen })}
              className="mt-4 text-sm font-medium text-paper/70 underline-offset-4 hover:text-paper hover:underline"
            >
              + Bringing something else too?
            </button>
          )}
        </section>
      )}

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {board.categories.map((c) => (
          <CategoryCard
            key={c.id}
            category={c}
            signups={board.signups.filter((s) => s.category === c.id)}
            mine={mine}
            onClaim={(category) => open({ kind: "new", category })}
            onEdit={(signup) => open({ kind: "edit", signup })}
          />
        ))}
      </div>

      {partifulUrl && (
        <p className="mt-12 text-center text-sm text-muted">
          RSVP and event details are on{" "}
          <a href={partifulUrl} className="font-semibold text-cranberry underline underline-offset-4">
            Partiful
          </a>
          .
        </p>
      )}

      {mode?.kind === "new" && (
        <Sheet title="Claim a spot" onClose={close}>
          <SignupForm
            key={mode.category}
            categories={board.categories}
            initial={{ category: mode.category, name, dish: "", tags: [], note: "" }}
            submitLabel="Put me down"
            busy={busy}
            error={error}
            onSubmit={create}
          />
        </Sheet>
      )}

      {mode?.kind === "edit" && (
        <Sheet title="Edit your sign-up" onClose={close}>
          <SignupForm
            key={mode.signup.id}
            categories={board.categories}
            initial={mode.signup}
            current={mode.signup.category}
            submitLabel="Save changes"
            busy={busy}
            error={error}
            onSubmit={(f) => update(mode.signup.id, f)}
          />
          <div className="mt-4 text-center">
            {confirmRemove ? (
              <div className="flex items-center justify-center gap-3 text-sm">
                <span>Take your name off the board?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(mode.signup.id)}
                  className="rounded-full bg-cranberry/10 px-3 py-1.5 font-semibold text-cranberry-dark hover:bg-cranberry/20"
                >
                  Yes, remove
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="px-2 py-1.5 text-muted">
                  Keep it
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} className="text-sm text-muted hover:text-cranberry">
                Can&rsquo;t make it anymore? Remove my sign-up
              </button>
            )}
          </div>
        </Sheet>
      )}

      {mode?.kind === "done" && (
        <Sheet title="You're on the board 🎉" onClose={close}>
          <p className="text-muted">
            Last step: paste this as your answer to the dish question on your Partiful RSVP, so the hosts have it there too.
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
            <p className="min-w-0 flex-1 font-medium">{rsvpLine(mode.signup)}</p>
            <CopyButton text={rsvpLine(mode.signup)} />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            {partifulUrl ? (
              <a
                href={partifulUrl}
                className="flex-1 rounded-full bg-cranberry py-3.5 text-center font-semibold text-white hover:bg-cranberry-dark"
              >
                Back to Partiful
              </a>
            ) : null}
            <button
              type="button"
              onClick={close}
              className={`flex-1 rounded-full py-3.5 font-semibold ${
                partifulUrl ? "border border-line hover:bg-line/40" : "bg-cranberry text-white hover:bg-cranberry-dark"
              }`}
            >
              Done
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            You can edit or remove it from this page on this device anytime.
          </p>
        </Sheet>
      )}
    </main>
  );
}
