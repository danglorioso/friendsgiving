import { randomBytes, timingSafeEqual } from "node:crypto";
import { buildBoard } from "./signup";
import type { Store } from "./store";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

export const newId = () => randomBytes(6).toString("hex");
/** Prefixed so the Redis client never mistakes an all-digit secret for a number. */
export const newSecret = () => `s_${randomBytes(16).toString("hex")}`;

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The PIN lives only in the HOST_PIN env var; with none set, nobody is host. */
export function isHost(req: Request): boolean {
  const pin = process.env.HOST_PIN;
  return !!pin && same(req.headers.get("x-host-pin") ?? "", pin);
}

/** A guest proves a sign-up is theirs with the secret they got when they made it. */
export async function ownsSignup(req: Request, store: Store, id: string) {
  const given = req.headers.get("x-signup-secret");
  if (!given) return false;
  const secret = await store.secretOf(id);
  return !!secret && same(given, secret);
}

export async function board(store: Store) {
  return buildBoard(await store.list(), store.persistent);
}
