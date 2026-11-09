import { LIMITS } from "@/lib/config";
import { board, fail, json, newId, newSecret } from "@/lib/server";
import { findCategory, parseFields } from "@/lib/signup";
import { getStore } from "@/lib/store";
import type { Signup } from "@/lib/types";

/** The whole board: every category with spots left, and every sign-up. */
export async function GET() {
  return json(await board(getStore()));
}

/**
 * Claims a spot. Answers `{ signup, secret, board }`; the guest keeps the secret
 * to edit or remove their sign-up later. 409 when the category just filled up
 * or was removed.
 */
export async function POST(req: Request) {
  const store = getStore();
  const categories = await store.categories();
  const parsed = parseFields(await req.json().catch(() => null), categories);
  if (!parsed.ok) return fail(parsed.error);

  const cat = findCategory(categories, parsed.fields.category)!;
  const signup: Signup = { id: newId(), createdAt: Date.now(), ...parsed.fields };
  const secret = newSecret();

  const result = await store.put(signup, { secret, total: LIMITS.totalSignups });
  if (result === "full") {
    return json({ error: `${cat.label} just filled up. Try another category?`, board: await board(store) }, 409);
  }
  if (result === "nocat") {
    return json({ error: "The hosts just changed that category. Pick again?", board: await board(store) }, 409);
  }
  if (result === "limit") return fail("The sign-up sheet is full. Message the hosts!", 409);
  return json({ signup, secret, board: await board(store) }, 201);
}
