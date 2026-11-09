"use client";

import type { Board, Category, Fields, Signup } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number, public board?: Board) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong. Try again?", res.status, data.board);
  return data as T;
}

export const api = {
  board: () => call<Board>("/api/signups"),
  create: (fields: Fields) =>
    call<{ signup: Signup; secret: string; board: Board }>("/api/signups", {
      method: "POST",
      body: JSON.stringify(fields),
    }),
  update: (id: string, fields: Fields, auth: Auth) =>
    call<{ signup: Signup; board: Board }>(`/api/signups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
      headers: authHeaders(auth),
    }),
  remove: (id: string, auth: Auth) =>
    call<{ board: Board }>(`/api/signups/${id}`, { method: "DELETE", headers: authHeaders(auth) }),
  saveCategories: (categories: Category[], pin: string) =>
    call<{ board: Board }>("/api/categories", {
      method: "PUT",
      body: JSON.stringify({ categories }),
      headers: { "x-host-pin": pin },
    }),
  checkPin: (pin: string) => call<{ ok: true }>("/api/host", { method: "POST", headers: { "x-host-pin": pin } }),
};

export type Auth = { secret: string } | { pin: string };

function authHeaders(auth: Auth): Record<string, string> {
  return "pin" in auth ? { "x-host-pin": auth.pin } : { "x-signup-secret": auth.secret };
}

// ---------- this browser's sign-ups ----------
// Wrapped in try/catch: private browsing and some in-app browsers throw on localStorage.

const MINE = "fg:mine";
const NAME = "fg:name";

export function loadMine(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MINE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveMine(mine: Record<string, string>) {
  try {
    localStorage.setItem(MINE, JSON.stringify(mine));
  } catch {}
}

export function loadName() {
  try {
    return localStorage.getItem(NAME) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME, name);
  } catch {}
}
