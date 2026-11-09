import { board, fail, isHost, json, newId } from "@/lib/server";
import { parseCategories } from "@/lib/signup";
import { getStore } from "@/lib/store";

/**
 * Host only. Replaces the whole category list (names, emoji, spots, ideas,
 * order). Answers 409 if a deleted category still has sign-ups.
 */
export async function PUT(req: Request) {
  if (!isHost(req)) return fail("Wrong PIN.", 401);
  const store = getStore();
  const parsed = parseCategories(await req.json().catch(() => null), await store.list(), newId);
  if (!parsed.ok) return fail(parsed.error);

  const result = await store.setCategories(parsed.categories);
  if (result === "orphan") {
    return json(
      { error: "Someone just signed up for a category you deleted. Remove their sign-up first.", board: await board(store) },
      409,
    );
  }
  return json({ board: await board(store) });
}
