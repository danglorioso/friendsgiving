import { LIMITS, TAGS } from "./config";
import type { Board, Category, CategoryStatus, Fields, Signup, Tag } from "./types";

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

export function findCategory(categories: Category[], id: string) {
  return categories.find((c) => c.id === id);
}

/** Turns an untrusted request body into sign-up fields, or an error message for the guest. */
export function parseFields(
  body: unknown,
  categories: Category[],
): { ok: true; fields: Fields } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const category = typeof b.category === "string" ? b.category : "";
  if (!findCategory(categories, category)) return { ok: false, error: "Pick a category." };

  const name = clean(b.name, LIMITS.name);
  if (!name) return { ok: false, error: "Add your name so people know who's bringing it." };

  const dish = clean(b.dish, LIMITS.dish);
  if (!dish) return { ok: false, error: "Tell us what you're bringing." };

  const tags = Array.isArray(b.tags)
    ? TAGS.filter((t) => (b.tags as unknown[]).includes(t))
    : ([] as Tag[]);

  return { ok: true, fields: { category, name, dish, tags, note: clean(b.note, LIMITS.note) } };
}

const ID = /^[a-z0-9-]{1,40}$/;

/**
 * Validates the host's edited category list. Existing ids are kept so sign-ups
 * stay attached; new rows get a fresh id from `makeId`. A category that still
 * has sign-ups can't be deleted, so no sign-up is ever left without a home.
 */
export function parseCategories(
  body: unknown,
  signups: Signup[],
  makeId: () => string,
): { ok: true; categories: Category[] } | { ok: false; error: string } {
  const rows = (body as { categories?: unknown } | null)?.categories;
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Keep at least one category." };
  if (rows.length > LIMITS.categories) return { ok: false, error: `At most ${LIMITS.categories} categories.` };

  const seen = new Set<string>();
  const categories: Category[] = [];
  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const label = clean(r.label, LIMITS.categoryLabel);
    if (!label) return { ok: false, error: "Every category needs a name." };

    let id = typeof r.id === "string" && ID.test(r.id) ? r.id : "";
    if (!id || seen.has(id)) id = makeId();
    seen.add(id);

    const capNum = Number(r.cap);
    if (!Number.isFinite(capNum) || capNum < 0) return { ok: false, error: `Spots for ${label} must be 0 or more.` };
    const cap = Math.min(LIMITS.cap, Math.floor(capNum));

    const emoji = Array.from(clean(r.emoji, 64)).slice(0, LIMITS.categoryEmoji).join("") || "🍽️";
    categories.push({ id, label, emoji, cap, hint: clean(r.hint, LIMITS.categoryHint) });
  }

  for (const s of signups) {
    if (!seen.has(s.category)) {
      const n = signups.filter((x) => x.category === s.category).length;
      return {
        ok: false,
        error: `A category you deleted still has ${n} sign-up${n === 1 ? "" : "s"}. Remove ${n === 1 ? "it" : "them"} first, or keep the category.`,
      };
    }
  }
  return { ok: true, categories };
}

/** Counts per category, in the host's order. */
export function buildBoard(signups: Signup[], categories: Category[], persistent: boolean): Board {
  const sorted = [...signups].sort((a, b) => a.createdAt - b.createdAt);
  const withStatus: CategoryStatus[] = categories.map((c) => {
    const taken = sorted.filter((s) => s.category === c.id).length;
    return { ...c, taken, left: Math.max(0, c.cap - taken) };
  });
  return { categories: withStatus, signups: sorted, persistent };
}

/** The line guests paste into their Partiful RSVP answer. */
export function rsvpLine(s: Pick<Signup, "dish" | "category">, categories: Category[]) {
  const cat = findCategory(categories, s.category);
  return `Bringing ${s.dish}${cat ? ` (${cat.label})` : ""}`;
}
