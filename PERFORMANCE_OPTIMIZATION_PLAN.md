# Stasht Studio — Performance Optimization Plan

**Status:** Draft — investigation only, no code changes made yet.
**Created:** 2026-08-10
**Goal:** Studio should load in a flash and feel smooth to use. This document is the punch list to get there, ordered by impact-vs-effort so we can pick it up in phases.

Everything below is grounded in evidence gathered this session (a full console trace of a live `/stories` page load, plus direct inspection of the build config and source) — not guesses. Each item says what the evidence was.

---

## Root causes identified

### 1. Production build ships completely unminified JS
**File:** `vite.config.ts:157` — `minify: false`
**File:** `vite.config.ts:156` — `sourcemap: false` (fine, but combined with `minify: false` there's no reason for it)

The production build config explicitly disables minification. Confirmed in the actual build output this session — chunks like `pages-misc-*.js` (2.0MB raw / 330KB gzip), `page-memory-details-*.js` (1.76MB raw / 256KB gzip), and `vendor-misc-*.js` (1.6MB raw / 339KB gzip) are all shipping full variable names, comments, and whitespace to production. Minification alone (esbuild's built-in minifier, already available via Vite, zero new deps) typically cuts JS payload 30–50% on top of gzip. This is the single highest-impact, lowest-risk fix in this whole plan.

### 2. All 13 page components are eagerly imported — no code-splitting by route
**File:** `App.tsx:12-24` (approx) — `import MemoriesPage from "./pages/MemoriesPage"` etc., all at module top level, no `React.lazy`.

Confirmed: `grep "^import.*pages/" App.tsx` returns 13 static imports, zero `React.lazy`/`lazy()` usage anywhere in the file. Per `CLAUDE.md`, App.tsx is a hand-rolled router (`currentPage` string state), not React Router — so Vite's `manualChunks` splitting (`page-media`, `page-users`, `page-memory-details`, `page-published`, `pages-misc`) is currently cosmetic: because App.tsx imports every page eagerly, the browser still has to download and parse *all* of those chunks before the app can render anything, even though a user only ever looks at one page at a time. This is why the initial load has to process several MB of JS regardless of which page loads first.

### 3. Data-fetching functions fire multiple times per page load, with no dedup/cache layer
**File:** `App.tsx` — `fetchMemoriesData()` is called from 6 different call sites (`App.tsx:2643, 3205, 3212, 3542, 3579` + one commented out); `fetchMediaData()` from 3 sites (`App.tsx:2635, 3531, 3591`).
**Live evidence:** the console trace captured this session shows `fetchMemoriesData` firing three times back-to-back on a single `/stories` load (`🚀🚀🚀 fetchMemoriesData FUNCTION ENTRY` × 3), and `/integrations/shopify/status` + `/cars?per_page=100` each fetched twice.

There's no data-fetching/caching library in the stack (`package.json` has `axios` only — no `react-query`, `swr`, `zustand`, or `redux`; state is plain Context API + hooks per `CLAUDE.md`). That means every component that needs the same data re-fetches it independently, and effects that should run once are re-running on every relevant state change without checking "do we already have this."

### 4. ~15-20 API calls fire eagerly on every dashboard load, many for data the user may never look at
**Live evidence:** within the first ~1s of loading `/stories` this session, the app called: `auto-mark-seen`, `user/api-keys`, `user/storage-overview`, `user/collaborators-and-non-collaborators`, `ai/library/faces`, `integrations/docusign/status`, `integrations/shopify/status`, `leads/unread-count`, `properties`, `cars?per_page=100`, `memory-images`, `existing-memories`, `memories?per_page=50`, `user/memory-counts`, `user/check-memory-limit`, `user/notifications`, `user/notifications/delete-old` — most of them in parallel, several sequentially blocking on each other.

Several of these are for features the user isn't necessarily using on this page load (DocuSign status, Shopify status, Cars inventory, AI Face Library, API keys) — these read like they belong on their respective settings/feature pages, not the main dashboard's critical path. Every one of these also independently pays the per-request overhead described in #5 below.

### 5. Every single API call re-decodes the JWT and logs ~10 lines before the request even fires
**File:** `utils/authUtils.ts` — 689 `console.*` calls in this one file alone (confirmed via grep). `tokenUtils.isTokenExpired()` runs before every `apiRequest()` call, decoding the JWT, computing time-until-expiry, and logging ~10 lines (`🔑🔑🔑 STARTED`, token preview, length, parts count, decoded payload, current time, expiry, time-until-expiry ×2, valid/expired, RESULT) every single time.

With 15-20 calls firing on one page load (#4), that's 150-200+ console statements and 15-20 redundant JWT decodes just for the auth check, before any actual request work happens. `console.log` with object arguments is not free — the browser has to serialize/inspect the logged objects even if DevTools isn't open, and at this volume across a 4,385-call-strong codebase (`grep -rE "console\.(log|debug|warn)\(" — 4,385 matches, confirmed this session), it's a real, cumulative cost, not just noise.

### 6. Rate limiting adds latency under multi-tab/heavy use (already partially mitigated)
Documented earlier this session: Laravel's `RateLimiter::for('api', ...)` caps at 60 req/min **per user ID**, shared across every open tab/session for that account. Given #4 (15-20 calls per single page load), a user with two tabs open can trip this within seconds. We already added retry-with-backoff (`fetchWithRateLimitRetry` in `authUtils.ts`) for the raw-fetch upload paths — that stops hard failures, but retries still mean the user waits longer. Reducing call volume (#4) is the real fix; the retry logic is a safety net, not a speed fix.

### 7. Backend response times — not yet profiled
Everything above is frontend-side, verified directly. We have **not** profiled actual Laravel/`stasht-database` response times (query counts, N+1 patterns, missing eager-loading, missing indexes). `docs/API_DOCUMENTATION.md` and the existing ad-hoc `test_*.php` scripts don't include timing. This needs its own investigation pass before we can say how much of the perceived slowness is server-side vs. client-side — see Phase 3.

---

## Phase 1 — Quick wins (low risk, do first)

These are config/removal changes, no logic changes, safe to verify with a build + smoke test.

- [ ] **Enable minification.** Flip `vite.config.ts:157` from `minify: false` to the default (esbuild) or `minify: 'esbuild'`. Rebuild, diff bundle sizes before/after, spot-check the app still works (this codebase has no test suite, so manual smoke test is the only verification available — check login, dashboard, media page, campaign detail).
- [ ] **Strip/gate the `console.*` volume in `authUtils.ts` (689 calls) behind a dev-only flag**, or delete the debug logging entirely now that the specific bugs it was added for (429s, thumbnail issues) are resolved. At minimum, wrap in `if (import.meta.env.DEV)` so production ships silent.
- [ ] **Audit and dedupe the triple-fire of `fetchMemoriesData()` and double-fire of `fetchMediaData()`** in `App.tsx` — figure out which of the 6/3 call sites are legitimate (different triggers) vs. redundant (same effect firing multiple times per mount), and consolidate.
- [ ] **Move non-critical-path API calls off the dashboard's initial load.** `integrations/docusign/status`, `integrations/shopify/status`, `cars`, `user/api-keys`, `ai/library/faces` look like they belong to their respective feature pages/tabs — fetch on-demand (when that tab/section is opened) instead of eagerly on every dashboard mount.

**Expected impact:** meaningfully smaller JS payload (minify alone), fewer redundant network round-trips, less main-thread time spent on logging — should be noticeable without touching architecture.

## Phase 2 — Route-based code splitting (medium effort, medium risk)

- [ ] **Convert the 13 eager page imports in `App.tsx` to `React.lazy()` + `<Suspense>`.** Since this is a hand-rolled `currentPage`-driven router (not React Router), this needs care: add a loading fallback UI for the Suspense boundary, and verify the manual `window.location`/`history` sync logic in `main.tsx`/`App.tsx` still works correctly when a page chunk is still loading (test slow-network simulation in DevTools).
- [ ] **Re-verify Vite's `manualChunks` split (`vite.config.ts:167-203`) still makes sense once lazy-loading is in place** — right now `page-media` ↔ `pages-misc` ↔ `page-memory-details` have circular chunk dependencies (warned at build time this session: `Circular chunk: page-media -> pages-misc -> page-media`, and two more). Worth resolving so lazy chunks don't pull in more than they need to.
- [ ] **Preload the likely-next page** (e.g., prefetch `MemoriesPage` chunk right after login, since it's the default landing page) so the lazy-load doesn't introduce a visible flash on the most common navigation path.

**Expected impact:** initial page load should only download/parse the JS for the page actually being viewed, not all 13 pages — this is likely the single biggest "time to interactive" win available, but it's the part most likely to introduce a regression if the hand-rolled router's page-switching logic doesn't expect async chunk loads, so it needs real manual QA across every page transition (nav sidebar, deep links, back/forward, published-memory share links) before shipping.

## Phase 3 — Backend/API investigation (needs profiling before we can plan fixes)

- [ ] **Time the slowest endpoints from Phase 1's dashboard-load list** (`/memories`, `/existing-memories`, `/memory-images`, `/user/storage-overview`) directly against the Laravel backend — either via Laravel Telescope/Clockwork if available, or simple `Illuminate\Support\Facades\DB::listen()` query-count logging, to see if any of them are doing N+1 queries or missing eager-loads (`->with(...)`) on relations like `category`, `author`, `collaborators`, `photos`.
- [ ] **Check whether `/existing-memories` and `/memories?per_page=50` are fetching overlapping/duplicate data** — both return memory lists with nested photo/category data; confirmed this session both fire on the same page load. If they overlap significantly, consider consolidating into one endpoint or having the frontend only call the one it actually needs per view.
- [ ] **Confirm whether `php artisan config:cache` / `route:cache`** (documented as a deploy step in `docs/PROJECT_HANDOVER_GUIDE.md`) is actually being run on the live server — if not, every request pays Laravel's full config/route resolution cost on every hit.

## Phase 4 — Image loading (partially done)

- [x] **S3 image caching via service worker** — fixed this session (removed forced `mode: 'cors'` from the Workbox `runtimeCaching` rule in `vite.config.ts`, which was breaking every S3 image load; now caches opaque responses correctly). This should already help perceived load speed for repeat visits since images now cache properly instead of re-fetching (or failing) every time.
- [ ] **Consider adding explicit `width`/`height` or `aspect-ratio` CSS to campaign thumbnails** to avoid layout shift while images load, which contributes to the app *feeling* slower even when it isn't.
- [ ] **Check if S3 images are served at full original resolution everywhere** (campaign grid thumbnails, sidebar nav previews) or if there's any resizing/CDN transform in play — if not, thumbnails may be downloading full-size originals for tiny UI elements, which is a real bandwidth/decode-time cost, especially on the campaign grid where several load at once.

---

## Suggested sequencing

1. **Phase 1 first, in one pass** — it's all config-level or call-site cleanup, low risk, and should produce a noticeably faster app on its own. Good candidate to ship as its own build/deploy before touching anything riskier.
2. **Phase 2 second** — biggest potential win, but needs careful manual QA since this app's router isn't a standard library; don't rush this one.
3. **Phase 3 in parallel with 1/2** — it's investigation, not code changes, so it can run alongside frontend work; its findings will determine if there's a Phase 5 (backend query/index fixes).
4. **Phase 4 remainder** — lower priority, mostly polish.

## Non-goals for this plan

- Not proposing a data-fetching library (react-query/SWR) migration yet — that's a bigger architectural change than "make it faster," and Phase 1+2 should recover most of the low-hanging fruit without it. Worth revisiting only if Phase 1-3 don't get us far enough.
- Not touching the git/deployment pipeline gap noted in `INFRASTRUCTURE.md` — that's a separate, already-tracked issue.
