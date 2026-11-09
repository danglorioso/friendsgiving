@AGENTS.md
# Friendsgiving sign-up

Potluck sign-up board. See README.md. Event details are in src/lib/config.ts; categories are stored in the database and edited on /host (`DEFAULT_CATEGORIES` only seeds them). Cap and category rules live in two places that must stay in sync in src/lib/store.ts: `decide()` / `PUT_SCRIPT` and `decideCategories()` / `SET_CATEGORIES_SCRIPT`.
