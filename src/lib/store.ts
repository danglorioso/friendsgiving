import { Redis } from "@upstash/redis";
import { DEFAULT_CATEGORIES } from "./config";
import type { Category, Signup } from "./types";

/**
 * - ok: saved
 * - full: the target category has no spots left
 * - nocat: the target category no longer exists (the host just deleted it)
 * - missing: tried to edit a sign-up that no longer exists
 * - limit: the whole board hit LIMITS.totalSignups
 */
export type PutResult = "ok" | "full" | "nocat" | "missing" | "limit";

/** - orphan: a category being removed still has sign-ups */
export type SetCategoriesResult = "ok" | "orphan";

export interface Store {
  persistent: boolean;
  list(): Promise<Signup[]>;
  categories(): Promise<Category[]>;
  /** Replaces the category list, refusing if it would strand any sign-up. */
  setCategories(categories: Category[]): Promise<SetCategoriesResult>;
  secretOf(id: string): Promise<string | null>;
  /**
   * Saves a sign-up, checking the category's current cap in the same step so
   * two guests grabbing the last spot at the same moment can't both get it.
   * Editing a sign-up within its own category never counts against the cap.
   * `secret` is set for new sign-ups only.
   */
  put(s: Signup, opts: { secret?: string; total: number }): Promise<PutResult>;
  remove(id: string): Promise<void>;
}

// The rules below exist twice: here (in-memory store, and the reference for
// tests) and in the Lua scripts further down. Keep them in sync.

export function decide(
  existing: Signup[],
  categories: Category[],
  s: Signup,
  isNew: boolean,
  total: number,
): PutResult {
  const old = existing.find((e) => e.id === s.id);
  if (isNew && old) return "ok"; // id collision is practically impossible; treat as idempotent retry
  if (!isNew && !old) return "missing";
  if (isNew && existing.length >= total) return "limit";
  const cat = categories.find((c) => c.id === s.category);
  if (!cat) return "nocat";
  if (old?.category === s.category) return "ok";
  const taken = existing.filter((e) => e.category === s.category && e.id !== s.id).length;
  return taken >= cat.cap ? "full" : "ok";
}

export function decideCategories(existing: Signup[], next: Category[]): SetCategoriesResult {
  const ids = new Set(next.map((c) => c.id));
  return existing.every((s) => ids.has(s.category)) ? "ok" : "orphan";
}

// ---------- in-memory (local dev only: lost on restart) ----------

type Memory = { signups: Map<string, Signup>; secrets: Map<string, string>; categories?: Category[] };

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
  async categories() {
    return structuredClone(this.mem.categories ?? DEFAULT_CATEGORIES);
  }
  async setCategories(categories: Category[]) {
    const result = decideCategories([...this.mem.signups.values()], categories);
    if (result === "ok") this.mem.categories = structuredClone(categories);
    return result;
  }
  async secretOf(id: string) {
    return this.mem.secrets.get(id) ?? null;
  }
  async put(s: Signup, opts: { secret?: string; total: number }) {
    const result = decide([...this.mem.signups.values()], await this.categories(), s, !!opts.secret, opts.total);
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
const KEY = { signups: `${SPACE}:signups`, secrets: `${SPACE}:secrets`, categories: `${SPACE}:categories` };

/**
 * Same rules as `decide`, run inside Redis so reading the cap, counting and
 * writing are one atomic step. KEYS: signups hash, secrets hash, categories.
 * ARGV: id, category, json, secret ('' when editing), total.
 */
export const PUT_SCRIPT = `
local id, cat, json, secret, total = ARGV[1], ARGV[2], ARGV[3], ARGV[4], tonumber(ARGV[5])
local isNew = secret ~= ''
local oldRaw = redis.call('HGET', KEYS[1], id)
if isNew and oldRaw then return 'ok' end
if (not isNew) and (not oldRaw) then return 'missing' end
if isNew and redis.call('HLEN', KEYS[1]) >= total then return 'limit' end
local catsRaw = redis.call('GET', KEYS[3])
if not catsRaw then return 'nocat' end
local cap = nil
for _, c in ipairs(cjson.decode(catsRaw)) do
  if c.id == cat then cap = tonumber(c.cap) end
end
if cap == nil then return 'nocat' end
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

/**
 * Same rule as `decideCategories`. KEYS: signups hash, categories.
 * ARGV: categories json.
 */
export const SET_CATEGORIES_SCRIPT = `
local ids = {}
for _, c in ipairs(cjson.decode(ARGV[1])) do ids[c.id] = true end
for _, raw in ipairs(redis.call('HVALS', KEYS[1])) do
  if not ids[cjson.decode(raw).category] then return 'orphan' end
end
redis.call('SET', KEYS[2], ARGV[1])
return 'ok'
`;

const parse = <T>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);

class RedisStore implements Store {
  persistent = true;
  constructor(private redis: Redis) {}

  async list() {
    // Values are stored as JSON strings by the script; the client may hand them back parsed.
    const all = await this.redis.hgetall<Record<string, Signup | string>>(KEY.signups);
    return Object.values(all ?? {}).map((v) => parse<Signup>(v));
  }
  async categories() {
    const saved = await this.redis.get<Category[] | string>(KEY.categories);
    if (saved) return parse<Category[]>(saved);
    // First visit: save the defaults so the cap check in PUT_SCRIPT has something to read.
    await this.redis.set(KEY.categories, JSON.stringify(DEFAULT_CATEGORIES), { nx: true });
    const now = await this.redis.get<Category[] | string>(KEY.categories);
    return now ? parse<Category[]>(now) : DEFAULT_CATEGORIES;
  }
  async setCategories(categories: Category[]) {
    return (await this.redis.eval(
      SET_CATEGORIES_SCRIPT,
      [KEY.signups, KEY.categories],
      [JSON.stringify(categories)],
    )) as SetCategoriesResult;
  }
  async secretOf(id: string) {
    const v = await this.redis.hget<string | number>(KEY.secrets, id);
    return v == null ? null : String(v);
  }
  async put(s: Signup, opts: { secret?: string; total: number }) {
    await this.categories(); // makes sure the defaults are saved before the script reads them
    return (await this.redis.eval(
      PUT_SCRIPT,
      [KEY.signups, KEY.secrets, KEY.categories],
      [s.id, s.category, JSON.stringify(s), opts.secret ?? "", String(opts.total)],
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
