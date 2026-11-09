import type { Category } from "./types";

/**
 * Everything a host would want to change lives here. Edit and redeploy.
 *
 * `cap` is how many people can sign up for that category. Lowering it below
 * the number already signed up never removes anyone; it just stops new sign-ups.
 */
export const EVENT = {
  title: "Friendsgiving",
  /** Shown under the title. Leave empty to hide. */
  date: "",
  /**
   * Your Partiful event link, so guests can hop back to RSVP. Set it as the
   * NEXT_PUBLIC_PARTIFUL_URL env var (not here) so it never lands in the public repo.
   */
  partifulUrl: process.env.NEXT_PUBLIC_PARTIFUL_URL ?? "",
  /** A line from the hosts under the header. */
  note: "We've got the turkey. Pick a category, tell us what you're bringing, and your name goes on the board so nobody doubles up.",
};

export const CATEGORIES: Category[] = [
  { id: "apps", label: "Appetizers & snacks", emoji: "🧀", cap: 3, hint: "Cheese board, dip, something to graze on" },
  { id: "sides", label: "Savory sides", emoji: "🥔", cap: 6, hint: "Stuffing, mashed potatoes, green beans, mac & cheese" },
  { id: "salads", label: "Salads & veggies", emoji: "🥗", cap: 2, hint: "Something green to balance it out" },
  { id: "bread", label: "Bread & rolls", emoji: "🥖", cap: 2, hint: "Rolls, cornbread, biscuits" },
  { id: "desserts", label: "Desserts", emoji: "🥧", cap: 3, hint: "Pie, cake, cookies" },
  { id: "drinks", label: "Drinks", emoji: "🍷", cap: 3, hint: "Wine, cider, seltzer — something without alcohol is great too" },
  { id: "supplies", label: "Supplies", emoji: "🧊", cap: 2, hint: "Ice, cups, to-go containers for leftovers" },
  { id: "wildcard", label: "Wildcard", emoji: "✨", cap: 3, hint: "Your famous thing that doesn't fit anywhere else" },
];

export const TAGS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Contains nuts"] as const;

export const LIMITS = {
  name: 40,
  dish: 60,
  note: 140,
  /** Stops a runaway script from filling the database. */
  totalSignups: 150,
};
