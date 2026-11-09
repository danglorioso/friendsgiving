import { Redis } from "@upstash/redis";
import type { Signup } from "./types";

/**
 * - ok: saved
 * - full: the target category has no spots left
 * - missing: tried to edit a sign-up that no longer exists
 * - limit: the whole board hit LIMITS.totalSignups
 */
export type PutResult = "ok" | "full" | "missing" | "limit";

export interface Store {
  persistent: boolean;
  list(): Promise<Signup[]>;
  secretOf(id: string): Promise<string | null>;
  /**
   * Saves a sign-up, checking the category's cap in the same step so two guests
   * grabbing the last spot at the same moment can't both get it. Editing a
   * sign-up within its own category never counts against the cap.
   * `secret` is set for new sign-ups only.
   */
  put(s: Signup, cap: number, opts: { secret?: string; total: number }): Promise<PutResult>;
  remove(id: string): Promise<void>;
}

/** Shared by both stores so they enforce exactly the same rules. */
export function decide(existing: Signup[], s: Signup, cap: number, isNew: boolean, total: number): PutResult {
  const old = existing.find((e) => e.id === s.id);
  if (isNew && old) return "ok"; // id collision is practically impossible; treat as idempotent retry
  if (!isNew && !old) return "missing";
  if (isNew && existing.length >= total) return "limit";
  if (old?.category === s.category) return "ok";
  const taken = existing.filter((e) => e.category === s.category && e.id !== s.id).length;
  return taken >= cap ? "full" : "ok";
}

// ---------- in-memory (local dev only: lost on restart) ----------

type Memory = { signups: Map<string, Signup>; secrets: Map<string, string> };

class MemoryStore implements Store {
  persistent = false;
  private get mem(): Memory {
    const g = globalThis as typeof globalThis & { __fg?: Memory };
    g.__fg ??= { signups: new Map(), secrets: new Map() };
    return g.__fg;
  }
  async list() {
    return structuredClone([...this.mem.signups.values()]);
  }
  async secretOf(id: string) {
    return this.mem.secrets.get(id) ?? null;
  }
  async put(s: Signup, cap: number, opts: { secret?: string; total: number }) {
    const result = decide([...this.mem.signups.values()], s, cap, !!opts.secret, opts.total);
    if (result !== "ok") return result;
    this.mem.signups.set(s.id, structuredClone(s));
    if (opts.secret) this.mem.secrets.set(s.id, opts.secret);
    return result;
  }
  async remove(id: string) {
    this.mem.signups.delete(id);
    this.mem.secrets.delete(id);
  }
}

// ---------- Upstash Redis ----------

// Local dev, preview and production can share one database, so each gets its own keys.
const SPACE = `fg:${process.env.VERCEL_ENV ?? "development"}`;
const KEY = { signups: `${SPACE}:signups`, secrets: `${SPACE}:secrets` };

/**
 * Same rules as `decide`, run inside Redis so the check and the write are one
 * atomic step. KEYS: signups hash, secrets hash.
 * ARGV: id, category, cap, json, secret ('' when editing), total.
 */
export const PUT_SCRIPT = `
local id, cat, cap, json, secret, total = ARGV[1], ARGV[2], tonumber(ARGV[3]), ARGV[4], ARGV[5], tonumber(ARGV[6])
local isNew = secret ~= ''
local oldRaw = redis.call('HGET', KEYS[1], id)
if isNew and oldRaw then return 'ok' end
if (not isNew) and (not oldRaw) then return 'missing' end
if isNew and redis.call('HLEN', KEYS[1]) >= total then return 'limit' end
local oldCat = nil
if oldRaw then oldCat = cjson.decode(oldRaw).category end
if oldCat ~= cat then
  local taken = 0
  for _, raw in ipairs(redis.call('HVALS', KEYS[1])) do
    local s = cjson.decode(raw)
    if s.category == cat and s.id ~= id then taken = taken + 1 end
  end
  if taken >= cap then return 'full' end
end
redis.call('HSET', KEYS[1], id, json)
if isNew then redis.call('HSET', KEYS[2], id, secret) end
return 'ok'
`;

class RedisStore implements Store {
  persistent = true;
  constructor(private redis: Redis) {}

  async list() {
    // Values are stored as JSON strings by the script; the client may hand them back parsed.
    const all = await this.redis.hgetall<Record<string, Signup | string>>(KEY.signups);
    return Object.values(all ?? {}).map((v) => (typeof v === "string" ? (JSON.parse(v) as Signup) : v));
  }
  async secretOf(id: string) {
    const v = await this.redis.hget<string | number>(KEY.secrets, id);
    return v == null ? null : String(v);
  }
  async put(s: Signup, cap: number, opts: { secret?: string; total: number }) {
    return (await this.redis.eval(
      PUT_SCRIPT,
      [KEY.signups, KEY.secrets],
      [s.id, s.category, String(cap), JSON.stringify(s), opts.secret ?? "", String(opts.total)],
    )) as PutResult;
  }
  async remove(id: string) {
    await this.redis.pipeline().hdel(KEY.signups, id).hdel(KEY.secrets, id).exec();
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  store = url && token ? new RedisStore(new Redis({ url, token })) : new MemoryStore();
  return store;
}
