import { LIMITS } from "@/lib/config";
import { board, fail, isHost, json, ownsSignup } from "@/lib/server";
import { findCategory, parseFields } from "@/lib/signup";
import { getStore } from "@/lib/store";

/** Edits a sign-up. Needs the guest's `x-signup-secret` (or the host PIN). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/signups/[id]">) {
  const { id } = await ctx.params;
  const store = getStore();
  if (!isHost(req) && !(await ownsSignup(req, store, id))) return fail("That sign-up isn't yours to edit.", 403);

  const parsed = parseFields(await req.json().catch(() => null));
  if (!parsed.ok) return fail(parsed.error);

  const existing = (await store.list()).find((s) => s.id === id);
  if (!existing) return fail("That sign-up was removed.", 404);

  const cat = findCategory(parsed.fields.category)!;
  const signup = { ...existing, ...parsed.fields };
  const result = await store.put(signup, cat.cap, { total: LIMITS.totalSignups });
  if (result === "missing") return fail("That sign-up was removed.", 404);
  if (result === "full") {
    return json({ error: `${cat.label} is full, so your sign-up stayed where it was.`, board: await board(store) }, 409);
  }
  return json({ signup, board: await board(store) });
}

/** Removes a sign-up. The guest who made it, or the host. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/signups/[id]">) {
  const { id } = await ctx.params;
  const store = getStore();
  if (!isHost(req) && !(await ownsSignup(req, store, id))) return fail("That sign-up isn't yours to remove.", 403);
  await store.remove(id);
  return json({ board: await board(store) });
}
