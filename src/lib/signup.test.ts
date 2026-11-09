import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./config";
import { buildBoard, parseFields, rsvpLine } from "./signup";
import { decide } from "./store";
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
    const r = parseFields({ category: cat.id, name: "  Sam  ", dish: "Mac  &\n cheese", tags: ["Vegan", "Spicy"] });
    expect(r).toEqual({ ok: true, fields: { category: cat.id, name: "Sam", dish: "Mac & cheese", tags: ["Vegan"], note: "" } });
  });
  it("rejects unknown categories and blank fields", () => {
    expect(parseFields({ category: "nope", name: "a", dish: "b" }).ok).toBe(false);
    expect(parseFields({ category: cat.id, name: "  ", dish: "b" }).ok).toBe(false);
    expect(parseFields({ category: cat.id, name: "a", dish: "" }).ok).toBe(false);
    expect(parseFields(null).ok).toBe(false);
  });
  it("caps lengths", () => {
    const r = parseFields({ category: cat.id, name: "x".repeat(500), dish: "y".repeat(500) });
    expect(r.ok && r.fields.name.length).toBe(40);
  });
});

describe("decide", () => {
  const full = Array.from({ length: cat.cap }, (_, i) => mk(`s${i}`));

  it("blocks a new sign-up once a category is full", () => {
    expect(decide(full, mk("new"), cat.cap, true, 100)).toBe("full");
    expect(decide(full.slice(1), mk("new"), cat.cap, true, 100)).toBe("ok");
  });
  it("lets someone edit within a full category", () => {
    expect(decide(full, { ...full[0], dish: "changed" }, cat.cap, false, 100)).toBe("ok");
  });
  it("blocks moving into a full category but allows moving out", () => {
    const elsewhere = mk("x", other.id);
    expect(decide([...full, elsewhere], { ...elsewhere, category: cat.id }, cat.cap, false, 100)).toBe("full");
    expect(decide(full, { ...full[0], category: other.id }, other.cap, false, 100)).toBe("ok");
  });
  it("reports edits of removed sign-ups and the overall limit", () => {
    expect(decide([], mk("gone"), cat.cap, false, 100)).toBe("missing");
    expect(decide([mk("a", other.id)], mk("b"), cat.cap, true, 1)).toBe("limit");
  });
});

describe("buildBoard", () => {
  it("counts per category and never shows negative spots", () => {
    const signups = Array.from({ length: cat.cap + 2 }, (_, i) => mk(`s${i}`));
    const b = buildBoard(signups, true);
    expect(b.categories[0]).toMatchObject({ taken: cat.cap + 2, left: 0 });
    expect(b.categories[1]).toMatchObject({ taken: 0, left: other.cap });
  });
  it("sorts oldest first", () => {
    expect(buildBoard([mk("s3"), mk("s1")], true).signups.map((s) => s.id)).toEqual(["s1", "s3"]);
  });
});

it("rsvpLine names the category", () => {
  expect(rsvpLine({ dish: "Pie", category: cat.id })).toBe(`Bringing Pie (${cat.label})`);
});
