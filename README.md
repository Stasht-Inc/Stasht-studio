# Stasht Studio (Frontend)

React + Vite + TypeScript frontend for Stasht. Talks to the `stasht-database` Laravel API (proxied through Vite in dev).

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

Requires Node 20 (see `netlify.toml` / recent CI pin).

### Environment (`.env`)

`.env` is currently **tracked in git** (added in commit `f6d7018`) and contains live secrets — Stripe live key, Facebook app secret, DocuSign keys, API keys. This should be untracked (`git rm --cached .env` + add to `.gitignore`) and those keys rotated; anyone with repo access can currently read them.

Key var for local dev:

```
PHP_BACKEND_URL=http://127.0.0.1:8000
```

`vite.config.ts` reads this via `loadEnv()` and uses it as the dev proxy target for `/api` and the share-link redirect base. Without it, it falls back to the production API (`https://restapi-stasht.wd-projects.online`).

### Backend

Point `PHP_BACKEND_URL` at a running local instance of `stasht-database` (see that repo's README). The dev server proxies `/api` → `PHP_BACKEND_URL`, `/sso-api` → `mobile-api.stasht.com`, `/s3-proxy` → S3.

## Recent session notes (2026-07-31)

- **Signup/Login OTP disclaimer** ([pages/SignupPage.tsx](pages/SignupPage.tsx), [pages/LoginPage.tsx](pages/LoginPage.tsx)): the "By requesting this code..." consent text moved from above the phone/email field to below the submit/Send OTP button, still in its blue alert-box styling. Two separate copies of this text exist (Login and Signup each have their own) — keep both in sync if it changes again.
- **Login social buttons** ([pages/LoginPage.tsx](pages/LoginPage.tsx)): desktop layout now matches mobile — Google/Apple buttons render above the phone/email method selector, with the "Or continue with" divider below the buttons (not above).
- **Interstitial loading screen logo** ([App.tsx](App.tsx)): the full-screen loading state shown while auth resolves (and the account-switch loading state) had a hardcoded fake logo (gradient box + bold "S" text). Replaced with the real mark at `/public/S-logo.svg`.
- **Campaigns grid showing 0 despite nonzero count** ([pages/MemoriesPage.tsx](pages/MemoriesPage.tsx)): the Grid view read campaign data from `allMemories` directly, while the header count and List view already used a fallback chain (`allMemories → latestMemories → propMemories`, see `memoriesToFilter` at line ~1566). When `allMemories` was empty but `latestMemories` had data, the count showed a number but the grid rendered nothing. Fixed by making the grid use `memoriesToFilter` too, consistent with the rest of the page.
- **Root cause of the above + missing category badges/sidebar stuck on "Loading categories..."**: turned out to be a **backend** bug, not frontend — see `stasht-database`'s README. `all_memories`/`sidebar` were empty because the `/memories` endpoint was 500ing entirely (missing `ShopifyCatalogService` class). Now fixed backend-side; worth re-verifying the frontend fallback logic above is still needed once that's confirmed stable (it's harmless to keep either way, and makes the page more resilient to partial API responses).

### Known follow-ups (not yet addressed)

- `vite.config.ts`: `build.minify: false` and `chunkSizeWarningLimit: 10000` ship unminified JS to production — confirm whether this is an intentional debug setting or should be reverted.
- Dev server dropped `host: true` / `allowedHosts: true` (more secure default) — breaks exposing the dev server over ngrok/network if anyone relies on that for OAuth callback testing (see the ngrok URL commented in `.env`).
- The `/shopify/*` frontend components (`ShopifyCatalogNav`, `ShopifyProductCard`, `ShopifyProductPicker`, `utils/shopifyProduct.ts`) were merged in `f6d7018`, but the corresponding backend controller doesn't exist yet — see `stasht-database` README. These UI surfaces will error if exercised until that's built.
