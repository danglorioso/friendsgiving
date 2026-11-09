import { CATEGORIES, LIMITS, TAGS } from "./config";
import type { Board, CategoryStatus, Fields, Signup, Tag } from "./types";

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

export function findCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

/** Turns an untrusted request body into sign-up fields, or an error message for the guest. */
export function parseFields(body: unknown): { ok: true; fields: Fields } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const category = typeof b.category === "string" ? b.category : "";
  if (!findCategory(category)) return { ok: false, error: "Pick a category." };

  const name = clean(b.name, LIMITS.name);
  if (!name) return { ok: false, error: "Add your name so people know who's bringing it." };

  const dish = clean(b.dish, LIMITS.dish);
  if (!dish) return { ok: false, error: "Tell us what you're bringing." };

  const tags = Array.isArray(b.tags)
    ? TAGS.filter((t) => (b.tags as unknown[]).includes(t))
    : ([] as Tag[]);

  return { ok: true, fields: { category, name, dish, tags, note: clean(b.note, LIMITS.note) } };
}

/** Counts per category, in config order. Categories removed from config are ignored. */
export function buildBoard(signups: Signup[], persistent: boolean): Board {
  const sorted = [...signups].sort((a, b) => a.createdAt - b.createdAt);
  const categories: CategoryStatus[] = CATEGORIES.map((c) => {
    const taken = sorted.filter((s) => s.category === c.id).length;
    return { ...c, taken, left: Math.max(0, c.cap - taken) };
  });
  return { categories, signups: sorted, persistent };
}

/** The line guests paste into their Partiful RSVP answer. */
export function rsvpLine(s: Pick<Signup, "dish" | "category">) {
  const cat = findCategory(s.category);
  return `Bringing ${s.dish}${cat ? ` (${cat.label})` : ""}`;
}
