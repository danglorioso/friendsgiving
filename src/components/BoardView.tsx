"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, loadMine, loadName, saveMine, saveName } from "@/lib/client";
import { EVENT } from "@/lib/config";
import { rsvpLine } from "@/lib/signup";
import type { Board, Fields, Signup } from "@/lib/types";
import { CategoryCard } from "./CategoryCard";
import { CopyButton } from "./CopyButton";
import { Sheet } from "./Sheet";
import { SignupForm } from "./SignupForm";

/**
 * Guests arrive from a link in the Partiful RSVP questionnaire, so the page is
 * a short guided flow: pick a category (seeing what everyone's bringing) →
 * add your dish → go back to Partiful to finish the RSVP. Guests who already
 * signed up on this device land on the last step.
 */
type Step = { kind: "pick" } | { kind: "details"; category: string } | { kind: "done"; fresh?: Signup };

const POLL_MS = 8000;

export function BoardView({ initial }: { initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [editing, setEditing] = useState<Signup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // localStorage is only readable after hydration.
  useEffect(() => {
    const saved = loadMine();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser storage */
    setMine(saved);
    setName(loadName());
    if (initial.signups.some((s) => saved[s.id])) setStep({ kind: "done" });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial]);

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

  function go(next: Step) {
    setError(null);
    setStep(next);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
      go({ kind: "done", fresh: res.signup });
    } catch (e) {
      failed(e);
      // The category filled up while they were typing: send them back to pick another.
      if (e instanceof ApiError && e.status === 409) setStep({ kind: "pick" });
    } finally {
      setBusy(false);
    }
  }

  const closeEdit = useCallback(() => {
    setEditing(null);
    setError(null);
    setConfirmRemove(false);
  }, []);

  async function update(id: string, fields: Fields) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.update(id, fields, { secret: mine[id] });
      setBoard(res.board);
      saveName(fields.name);
      setName(fields.name);
      closeEdit();
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
      closeEdit();
      if (!res.board.signups.some((s) => next[s.id])) go({ kind: "pick" });
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  const myList = board.signups.filter((s) => mine[s.id]);
  const totalCap = board.categories.reduce((n, c) => n + c.cap, 0);
  const totalTaken = board.categories.reduce((n, c) => n + Math.min(c.taken, c.cap), 0);
  const anyOpen = board.categories.some((c) => c.left > 0);
  const chosen = step.kind === "details" ? board.categories.find((c) => c.id === step.category) : undefined;
  // If the host deleted the chosen category mid-flow, fall back to picking.
  const picking = step.kind === "pick" || (step.kind === "details" && !chosen);

  const categoryGrid = (
    <div className="grid gap-4 md:grid-cols-2">
      {board.categories.map((c) => (
        <CategoryCard
          key={c.id}
          category={c}
          signups={board.signups.filter((s) => s.category === c.id)}
          mine={mine}
          onClaim={(category) => go({ kind: "details", category })}
          onEdit={setEditing}
        />
      ))}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-14">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-squash">Who&rsquo;s bringing what</p>
        <h1 className="mt-2 font-display text-5xl italic leading-none tracking-tight sm:text-6xl">{EVENT.title}</h1>
        {EVENT.date && <p className="mt-3 text-lg font-medium">{EVENT.date}</p>}
        <div className="mx-auto mt-5 max-w-xs">
          <div className="flex justify-between text-xs">
            <span className="font-semibold">
              {totalTaken} of {totalCap} spots claimed
            </span>
            <span className="text-muted">{totalCap - totalTaken} open</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="presentation">
            <div
              className="h-full rounded-full bg-gradient-to-r from-squash to-cranberry transition-all duration-700"
              style={{ width: `${totalCap ? (totalTaken / totalCap) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      {!board.persistent && (
        <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-squash/40 bg-squash/10 px-4 py-3 text-center text-sm">
          Test mode: sign-ups are kept in memory and vanish when the server restarts. Connect Upstash Redis before sharing
          the link.
        </p>
      )}

      <div ref={top} className="scroll-mt-4" />
      <Steps current={picking ? 1 : step.kind === "details" ? 2 : 3} />

      {picking && (
        <section className="animate-rise">
          <div className="mx-auto mb-6 max-w-2xl text-center">
            <h2 className="font-display text-3xl">Pick what you&rsquo;ll bring</h2>
            <p className="mt-2 text-balance text-muted">{EVENT.note}</p>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-cranberry/10 px-3 py-2 text-sm text-cranberry-dark">
                {error}
              </p>
            )}
            {!anyOpen && (
              <p className="mt-4 rounded-xl bg-line/60 px-3 py-2 text-sm">
                Every spot is taken! Message the hosts if you&rsquo;d still like to bring something.
              </p>
            )}
          </div>
          {categoryGrid}
        </section>
      )}

      {step.kind === "details" && chosen && (
        <section className="mx-auto max-w-lg animate-rise">
          <button
            type="button"
            onClick={() => go({ kind: "pick" })}
            className="mb-4 text-sm font-medium text-muted hover:text-ink"
          >
            ← Pick a different category
          </button>

          <div className="rounded-3xl border border-line bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {chosen.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl leading-tight">{chosen.label}</h2>
                <p className="text-sm text-muted">{chosen.left} {chosen.left === 1 ? "spot" : "spots"} open</p>
              </div>
            </div>
            {(() => {
              const already = board.signups.filter((s) => s.category === chosen.id);
              return already.length ? (
                <div className="mt-4 rounded-2xl bg-paper px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Already coming</p>
                  <ul className="mt-1.5 space-y-1">
                    {already.map((s) => (
                      <li key={s.id} className="text-sm">
                        <span className="font-semibold">{s.dish}</span>
                        <span className="text-muted"> · {s.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage">
                  Nobody&rsquo;s signed up here yet. You&rsquo;re first!
                </p>
              );
            })()}

            <div className="mt-5 border-t border-dashed border-line pt-5">
              <SignupForm
                key={chosen.id}
                categories={board.categories}
                initial={{ category: chosen.id, name, dish: "", tags: [], note: "" }}
                hideCategories
                submitLabel="Put me down"
                busy={busy}
                error={error}
                onSubmit={create}
              />
            </div>
          </div>
        </section>
      )}

      {step.kind === "done" && (
        <section className="animate-rise">
          <div className="mx-auto max-w-lg rounded-3xl bg-ink p-6 text-paper sm:p-8">
            <p className="text-3xl" aria-hidden>
              🎉
            </p>
            <h2 className="mt-2 font-display text-3xl leading-tight">
              {step.fresh ? "You're on the board!" : "You're signed up"}
            </h2>
            <p className="mt-2 text-paper/80">
              <strong className="text-paper">One more step:</strong> head back to Partiful and finish your RSVP. Paste
              this into the dish question:
            </p>

            <ul className="mt-4 space-y-2">
              {myList.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                  <p className="min-w-0 flex-1 font-medium">{rsvpLine(s, board.categories)}</p>
                  <CopyButton
                    text={rsvpLine(s, board.categories)}
                    className="!border-white/20 !bg-transparent text-paper"
                  />
                </li>
              ))}
            </ul>

            <BackToPartiful />

            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
              {myList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEditing(s)}
                  className="text-paper/70 underline-offset-4 hover:text-paper hover:underline"
                >
                  Edit {myList.length > 1 ? s.dish : "my dish"}
                </button>
              ))}
              {anyOpen && (
                <button
                  type="button"
                  onClick={() => go({ kind: "pick" })}
                  className="text-paper/70 underline-offset-4 hover:text-paper hover:underline"
                >
                  Bringing something else too?
                </button>
              )}
            </div>
          </div>

          <h2 className="mb-5 mt-14 text-center font-display text-3xl">The spread so far</h2>
          {categoryGrid}
        </section>
      )}

      {editing && (
        <Sheet title="Edit your sign-up" onClose={closeEdit}>
          <SignupForm
            key={editing.id}
            categories={board.categories}
            initial={editing}
            current={editing.category}
            submitLabel="Save changes"
            busy={busy}
            error={error}
            onSubmit={(f) => update(editing.id, f)}
          />
          <div className="mt-4 text-center">
            {confirmRemove ? (
              <div className="flex items-center justify-center gap-3 text-sm">
                <span>Take your name off the board?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(editing.id)}
                  className="rounded-full bg-cranberry/10 px-3 py-1.5 font-semibold text-cranberry-dark hover:bg-cranberry/20"
                >
                  Yes, remove
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="px-2 py-1.5 text-muted">
                  Keep it
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="text-sm text-muted hover:text-cranberry"
              >
                Can&rsquo;t make it anymore? Remove my sign-up
              </button>
            )}
          </div>
        </Sheet>
      )}
    </main>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Pick a category", "Add your dish", "Finish on Partiful"];
  return (
    <ol className="mx-auto my-8 flex max-w-md items-center justify-center gap-2 text-xs sm:text-sm" aria-label="Progress">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "next";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "now" ? "step" : undefined}>
            {i > 0 && <span className={`h-px w-4 sm:w-8 ${n <= current ? "bg-cranberry" : "bg-line"}`} aria-hidden />}
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                state === "next" ? "bg-line text-muted" : "bg-cranberry text-white"
              }`}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={`whitespace-nowrap ${state === "now" ? "font-semibold" : "text-muted"} ${state === "now" ? "" : "hidden sm:inline"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The page keeps no Partiful URL (the repo is public), so "back" uses the
 * browser's history: guests only reach this page from the Partiful
 * questionnaire, and the flow here adds no history entries, so one step back
 * is Partiful. When Partiful opened this in a new tab there's no history, so
 * we try closing the tab and otherwise point them to the Partiful tab.
 */
function BackToPartiful() {
  const [hint, setHint] = useState(false);

  function back() {
    if (history.length > 1) history.back();
    else window.close(); // only works for tabs opened by a script; harmless otherwise
    // Still here a moment later? Then going back didn't happen.
    setTimeout(() => setHint(true), 400);
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={back}
        className="w-full rounded-full bg-paper py-3.5 text-base font-semibold text-ink transition hover:bg-white"
      >
        Back to Partiful to finish RSVP →
      </button>
      <p className={`mt-3 text-center text-sm ${hint ? "text-paper" : "text-paper/60"}`} role={hint ? "status" : undefined}>
        {hint
          ? "Switch back to the Partiful tab or app to finish your RSVP. You can close this page."
          : "Opened this in a new tab? Just switch back to Partiful."}
      </p>
    </div>
  );
}
