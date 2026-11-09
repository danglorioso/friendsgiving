# Friendsgiving sign-up

A live "who's bringing what" board for a potluck. Guests pick a category, write their dish, and see everyone else's choices right away. Each category has a cap, so nobody ends up with five bottles of wine and no sides.

Built to pair with a Partiful invite: link the page from the invite description, and after signing up guests get a one-line answer to paste into the Partiful RSVP question.

- `/`: the guest board
- `/host`: the host view, behind a PIN. It shows every sign-up with dietary tags and notes, lets you remove any sign-up, and copies a plain-text summary.

## Customize

Everything lives in [`src/lib/config.ts`](src/lib/config.ts):

- `EVENT`: title, date, your Partiful link, and the note under the header
- `CATEGORIES`: names, emoji, ideas text and `cap` (spots) for each category
- `TAGS`: dietary tags guests can add

Changing a cap after people sign up is safe. Lowering it never removes anyone; it just stops new sign-ups.

## Run locally

```sh
pnpm install
HOST_PIN=1234 pnpm dev
```

Without Redis env vars, sign-ups live in memory: fine for trying it out, but they're lost on restart. The page shows a "Test mode" banner when that's the case.

## Deploy (Vercel + Upstash)

1. Push to GitHub and import the repo in Vercel.
2. In the Vercel project, open **Storage** and add **Upstash for Redis** (the free tier is plenty). That sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.
3. Add `HOST_PIN` as an environment variable.
4. Deploy. If you want it under your own site, point a subdomain at it (e.g. `friendsgiving.yourdomain.com`) under **Settings → Domains**.

Production, preview and local dev use separate Redis keys (`fg:<VERCEL_ENV>:*`), so testing never touches the real board.

## How it works

- **Caps are enforced atomically.** The "is there a spot left?" check and the write happen in one Redis Lua script (`PUT_SCRIPT` in `src/lib/store.ts`), so two people grabbing the last spot at the same moment can't both get it. The in-memory store applies the same rules through `decide()`.
- **No accounts.** Making a sign-up returns a secret that the browser keeps in localStorage. That secret is what lets a guest edit or remove their own sign-up later from the same device. The host can remove anything with the PIN.
- **Live updates.** The board polls every 8 seconds while the tab is visible.

## Scripts

```sh
pnpm test   # unit tests (validation, cap rules, board counts)
pnpm lint
pnpm build
```
