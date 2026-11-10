# Friendsgiving sign-up

A live "who's bringing what" board for a potluck. Guests pick a category, write their dish, and see everyone else's choices right away. Each category has a cap, so nobody ends up with five bottles of wine and no sides.

Built to pair with a Partiful invite. Put the link in a Partiful RSVP questionnaire question ("Sign up for a dish here, then paste what you're bringing below"). Guests land on a short guided flow:

1. **Pick a category**, seeing every category with who's bringing what and how many spots are open.
2. **Add your dish**, with that category's existing dishes in view so nobody doubles up.
3. **Finish on Partiful**: a one-line answer to copy into the RSVP question and a "Back to Partiful" button. The app stores no Partiful URL; the button uses the browser's back (same tab) or closes the tab (new tab), and otherwise tells guests to switch back to Partiful.

Guests who already signed up on that device land straight on step 3, where they can edit or remove their dish.

- `/`: the guest flow
- `/host`: the host view, behind a PIN. It shows every sign-up with dietary tags and notes, lets you remove any sign-up, copies a plain-text summary, and lets you edit the categories (name, emoji, spots, ideas text, order, add and delete) live.

## Customize

**Categories** are edited on `/host` → **Edit categories**, and changes go live as soon as you save. Lowering a category's spots never removes anyone; it just stops new sign-ups. Setting spots to 0 closes a category. A category that still has sign-ups can't be deleted until those sign-ups are removed.

Everything else lives in [`src/lib/config.ts`](src/lib/config.ts):

- `EVENT`: title, date, and the note under the header
- `DEFAULT_CATEGORIES`: the starting categories, used until you first save on `/host`. After that, the saved list in the database wins.
- `TAGS`: dietary tags guests can add

## Run locally

```sh
pnpm install
HOST_PIN=1234 pnpm dev
```

Without Redis env vars, sign-ups live in memory: fine for trying it out, but they're lost on restart. The page shows a "Test mode" banner when that's the case.

## Deploy (Vercel + Upstash)

1. Push to GitHub and import the repo in Vercel.
2. In the Vercel project, open **Storage** and add **Upstash for Redis** (the free tier is plenty). That sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.
3. Add the `HOST_PIN` environment variable. It stays out of the repo. Changing it needs a redeploy.
4. Deploy. Keep the deployed URL out of this repo (README, repo description, website field): the repo is public, and anyone with the link can sign up. If you want it under your own site, point a subdomain at it (e.g. `friendsgiving.yourdomain.com`) under **Settings → Domains**.

Production, preview and local dev use separate Redis keys (`fg:<VERCEL_ENV>:*`), so testing never touches the real board.

## How it works

- **Caps are enforced atomically.** Reading the category's current cap, counting, and writing happen in one Redis Lua script (`PUT_SCRIPT` in `src/lib/store.ts`), so two people grabbing the last spot at the same moment can't both get it, and nobody can sign up for a category the host just deleted. Saving categories (`SET_CATEGORIES_SCRIPT`) likewise refuses atomically if it would leave a sign-up without a category. The in-memory store applies the same rules through `decide()` and `decideCategories()`.
- **No accounts.** Making a sign-up returns a secret that the browser keeps in localStorage. That secret is what lets a guest edit or remove their own sign-up later from the same device. The host can remove anything with the PIN.
- **Live updates.** The board polls every 8 seconds while the tab is visible.

## Scripts

```sh
pnpm test   # unit tests (validation, cap rules, board counts)
pnpm lint
pnpm build
```
