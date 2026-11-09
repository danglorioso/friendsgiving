import type { TAGS } from "./config";

export type Tag = (typeof TAGS)[number];

export interface Category {
  id: string;
  label: string;
  emoji: string;
  cap: number;
  hint: string;
}

/** One person's dish. Public: everything here is shown to every guest. */
export interface Signup {
  id: string;
  category: string;
  name: string;
  dish: string;
  tags: Tag[];
  note: string;
  createdAt: number;
}

export interface CategoryStatus extends Category {
  taken: number;
  left: number;
}

export interface Board {
  categories: CategoryStatus[];
  signups: Signup[];
  /** False when running on the in-memory store (local dev without Redis). */
  persistent: boolean;
}

export type Fields = Pick<Signup, "category" | "name" | "dish" | "tags" | "note">;
