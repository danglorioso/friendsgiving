import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES as CATEGORIES } from "./config";
import { buildBoard, parseCategories, parseFields, rsvpLine } from "./signup";
import { decide, decideCategories } from "./store";
import type { Signup } from "./types";

const cat = CATEGORIES[0];
const other = CATEGORIES[1];
const mk = (id: string, category = cat.id): Signup => ({
  id,
  category,
  name: "A",
  dish: "D",
  tags: [],
  note: "",
  createdAt: Number(id.replace(/\D/g, "")) || 0,
});

describe("parseFields", () => {
  it("trims and collapses whitespace, drops unknown tags", () => {
    const r = parseFields({ category: cat.id, name: "  Sam  ", dish: "Mac  &\n cheese", tags: ["Vegan", "Spicy"] }, CATEGORIES);
    expect(r).toEqual({ ok: true, fields: { category: cat.id, name: "Sam", dish: "Mac & cheese", tags: ["Vegan"], note: "" } });
  });
  it("rejects unknown categories and blank fields", () => {
    expect(parseFields({ category: "nope", name: "a", dish: "b" }, CATEGORIES).ok).toBe(false);
    expect(parseFields({ category: cat.id, name: "  ", dish: "b" }, CATEGORIES).ok).toBe(false);
    expect(parseFields({ category: cat.id, name: "a", dish: "" }, CATEGORIES).ok).toBe(false);
    expect(parseFields(null, CATEGORIES).ok).toBe(false);
  });
  it("caps lengths", () => {
    const r = parseFields({ category: cat.id, name: "x".repeat(500), dish: "y".repeat(500) }, CATEGORIES);
    expect(r.ok && r.fields.name.length).toBe(40);
  });
});

describe("decide", () => {
  const full = Array.from({ length: cat.cap }, (_, i) => mk(`s${i}`));

  it("blocks a new sign-up once a category is full", () => {
    expect(decide(full, CATEGORIES, mk("new"), true, 100)).toBe("full");
    expect(decide(full.slice(1), CATEGORIES, mk("new"), true, 100)).toBe("ok");
  });
  it("lets someone edit within a full category", () => {
    expect(decide(full, CATEGORIES, { ...full[0], dish: "changed" }, false, 100)).toBe("ok");
  });
  it("blocks moving into a full category but allows moving out", () => {
    const elsewhere = mk("x", other.id);
    expect(decide([...full, elsewhere], CATEGORIES, { ...elsewhere, category: cat.id }, false, 100)).toBe("full");
    expect(decide(full, CATEGORIES, { ...full[0], category: other.id }, false, 100)).toBe("ok");
  });
  it("reports edits of removed sign-ups and the overall limit", () => {
    expect(decide([], CATEGORIES, mk("gone"), false, 100)).toBe("missing");
    expect(decide([mk("a", other.id)], CATEGORIES, mk("b"), true, 1)).toBe("limit");
  });
});

describe("buildBoard", () => {
  it("counts per category and never shows negative spots", () => {
    const signups = Array.from({ length: cat.cap + 2 }, (_, i) => mk(`s${i}`));
    const b = buildBoard(signups, CATEGORIES, true);
    expect(b.categories[0]).toMatchObject({ taken: cat.cap + 2, left: 0 });
    expect(b.categories[1]).toMatchObject({ taken: 0, left: other.cap });
  });
  it("sorts oldest first", () => {
    expect(buildBoard([mk("s3"), mk("s1")], CATEGORIES, true).signups.map((s) => s.id)).toEqual(["s1", "s3"]);
  });
});

it("rsvpLine names the category", () => {
  expect(rsvpLine({ dish: "Pie", category: cat.id }, CATEGORIES)).toBe(`Bringing Pie (${cat.label})`);
});

describe("category editing", () => {
  let n = 0;
  const makeId = () => `gen${++n}`;
  const row = (p: Record<string, unknown> = {}) => ({ id: "a", label: "Apps", emoji: "🧀", cap: 3, hint: "", ...p });

  it("uses the cap from the category list it is given", () => {
    const cats = [{ ...cat, cap: 1 }];
    expect(decide([mk("s1")], cats, mk("new"), true, 100)).toBe("full");
    expect(decide([], cats, mk("new"), true, 100)).toBe("ok");
    expect(decide([], cats, mk("new", "gone"), true, 100)).toBe("nocat");
  });

  it("keeps ids, gives new rows and duplicates fresh ids, cleans values", () => {
    const r = parseCategories(
      { categories: [row(), row({ id: "", label: "  New  one ", cap: 2.7 }), row({ label: "Dup" }), row({ id: "BAD ID", label: "X", emoji: "" })] },
      [],
      makeId,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.categories.map((c) => c.id)).toEqual(["a", "gen1", "gen2", "gen3"]);
    expect(r.categories[1]).toMatchObject({ label: "New one", cap: 2 });
    expect(r.categories[3].emoji).toBe("🍽️");
  });

  it("rejects empty lists, blank names, negative caps and clamps huge ones", () => {
    expect(parseCategories({ categories: [] }, [], makeId).ok).toBe(false);
    expect(parseCategories({ categories: [row({ label: " " })] }, [], makeId).ok).toBe(false);
    expect(parseCategories({ categories: [row({ cap: -1 })] }, [], makeId).ok).toBe(false);
    expect(parseCategories({ categories: [row({ cap: "x" })] }, [], makeId).ok).toBe(false);
    const big = parseCategories({ categories: [row({ cap: 9999 })] }, [], makeId);
    expect(big.ok && big.categories[0].cap).toBe(50);
  });

  it("refuses to delete a category that still has sign-ups", () => {
    const r = parseCategories({ categories: [row({ id: "b", label: "B" })] }, [mk("s1", "a")], makeId);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("still has 1 sign-up") });
    expect(decideCategories([mk("s1", "a")], [{ ...cat, id: "b" }])).toBe("orphan");
    expect(decideCategories([mk("s1", "a")], [{ ...cat, id: "a" }])).toBe("ok");
  });
});
