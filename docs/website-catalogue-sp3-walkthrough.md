# Website Catalogue (sub-project 3): local visual walk-through

Every state of the Website Catalogue connector card, connect dialog and manage dialog, checked in a real browser against a
**local** web API on the **test** database. Studio login is OTP-only, so a harness page mounts the real Connectors page
(`pages/MarketplacePage.tsx`) with a locally minted token.

**Safety rules**
- Only the test database `stasht_testing_wc`. Both PHP scripts refuse to run on anything else, and step 4 proves the
  server reads it. Never point any of this at a real database or server.
- Nothing here is committed except this file. Scratch files live in `/private/tmp/claude-501/website-catalogue-sp3/`.
  The two harness files `scratch-wc.html` / `scratch-wc.tsx` in the Studio root are deleted in step 8.
- The walk-through account is `external_user_id` **990001**. The scripts touch only its rows, their own Passport
  client named `WC walkthrough`, and the `plans` rows they had to create (removed again in step 8).
- No request leaves this machine (step 6).

## 1. Environment file

```bash
mkdir -p /private/tmp/claude-501/website-catalogue-sp3/shots && cat > /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh <<'ENV'
export API=/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/Codes/stasht-database/.worktrees/website-catalogue
export STUDIO=/Users/deepaksharma/Pictures/Personal-Works/Stasht-Project/Codes/Stasht-studio/.worktrees/website-catalogue
export SCRATCH=/private/tmp/claude-501/website-catalogue-sp3
export PW=/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright
# The test database for every PHP command that sources this file (exported one by one: zsh does not word-split "$VAR").
export DB_DATABASE=stasht_testing_wc
export STASHT_DB_DATABASE=stasht_testing_wc
export APP_ENV=testing
export CACHE_DRIVER=file
ENV
```
Every later command starts with `source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh &&`. The test-database
variables are exported one by one on purpose: zsh does not word-split an unquoted `$VAR`, so an `env $VARS …` form would
set `DB_DATABASE` to the whole string and leave `mysql_stasht` on `.env.testing`'s database.

## 2. Prove the database first

```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$API" && php artisan tinker --env=testing --execute="echo DB::connection('mysql')->getDatabaseName(), ' ', DB::connection('mysql_stasht')->getDatabaseName(), PHP_EOL;"
```
Expected, exactly: `stasht_testing_wc stasht_testing_wc`. Anything else: stop.

## 3. The two PHP scripts

`/private/tmp/claude-501/website-catalogue-sp3/wc-seed.php` makes the walk-through account (Business plan) and a token:
```php
<?php
// Website Catalogue walk-through: account 990001 and a Passport token. stasht_testing_wc only.
use App\Models\Plan;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Passport\ClientRepository;

foreach (['mysql', 'mysql_stasht'] as $connection) {
    if (DB::connection($connection)->getDatabaseName() !== 'stasht_testing_wc') {
        throw new RuntimeException("Refusing to run: {$connection} is not stasht_testing_wc.");
    }
}

$scratch = (string) getenv('SCRATCH');
$plan    = Plan::firstOrCreate(['name' => 'Professional']);
if ($plan->wasRecentlyCreated) { // remember plan rows this walk-through made, so cleanup removes only those
    $made = json_decode((string) @file_get_contents("{$scratch}/plans-created.json"), true) ?: [];
    file_put_contents("{$scratch}/plans-created.json", json_encode(array_values(array_unique([...$made, $plan->id]))));
}
$user    = User::where('external_user_id', 990001)->first()
    ?? User::factory()->create(['role' => 'user', 'external_user_id' => 990001, 'name' => 'WC Walkthrough', 'email' => 'wc-walkthrough@example.com']);
$user->forceFill(['plan_id' => $plan->id])->save();

if (! DB::table('oauth_clients')->where('name', 'WC walkthrough')->exists()) {
    app(ClientRepository::class)->createPersonalAccessClient(null, 'WC walkthrough', 'http://localhost');
}
$token = $user->createToken('wc-walkthrough')->accessToken;

file_put_contents("{$scratch}/token.txt", $token);
file_put_contents("{$scratch}/user.json", json_encode([
    'id' => $user->id, 'external_user_id' => 990001, 'name' => $user->name, 'email' => $user->email, 'role' => '2',
]));
echo "seeded user {$user->id}; token written to {$scratch}/token.txt", PHP_EOL;
```
`/private/tmp/claude-501/website-catalogue-sp3/wc-state.php` puts account 990001 into one state (`WC_STATE`).
Engine-written times are UTC wall-clock strings, as the engine writes them.
```php
<?php
// Website Catalogue walk-through: one state for account 990001 (WC_STATE). stasht_testing_wc only; touches only 990001's rows.
use App\Models\CatalogDomain;
use App\Models\CatalogItem;
use App\Models\CatalogItemImage;
use App\Models\CatalogScan;
use App\Models\CatalogSource;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

foreach (['mysql', 'mysql_stasht'] as $connection) {
    if (DB::connection($connection)->getDatabaseName() !== 'stasht_testing_wc') {
        throw new RuntimeException("Refusing to run: {$connection} is not stasht_testing_wc.");
    }
}

$owner = 990001;
$host  = 'demo-shop.example.com';
$state = (string) getenv('WC_STATE');
$user  = User::where('external_user_id', $owner)->firstOrFail();
$utc   = fn (string $modify = 'now'): string => now('UTC')->modify($modify)->format('Y-m-d H:i:s');
$img   = fn (int $n): string => 'https://127.0.0.1/wc-img/' . ['pwa-icon-512.png', 'apple-touch-icon.png', 'autotrader-logo.png', 'docusign-logo.png', 'pwa-icon-192.png'][$n % 5];

$wipe = function () use ($owner): void {
    $sourceIds = CatalogSource::where('user_id', $owner)->pluck('id');
    $itemIds   = CatalogItem::whereIn('catalog_source_id', $sourceIds)->pluck('id');
    CatalogItemImage::whereIn('catalog_item_id', $itemIds)->delete();
    CatalogItem::whereIn('id', $itemIds)->delete();
    DB::connection('mysql_stasht')->table('catalog_runs')->whereIn('catalog_source_id', $sourceIds)->delete();
    CatalogSource::where('user_id', $owner)->delete();
    CatalogScan::where('user_id', $owner)->delete();
    CatalogDomain::where('user_id', $owner)->delete();
    foreach (['catalog-scans:', 'catalog-checks:', 'catalog-sync-now:'] as $key) {
        RateLimiter::clear($key . $owner);
    }
};

if ($state === 'cleanup') {
    $wipe();
    DB::table('oauth_access_tokens')->where('user_id', $user->id)->delete();
    $clientIds = DB::table('oauth_clients')->where('name', 'WC walkthrough')->pluck('id');
    DB::table('oauth_personal_access_clients')->whereIn('client_id', $clientIds)->delete();
    DB::table('oauth_clients')->whereIn('id', $clientIds)->delete();
    DB::table('users')->where('id', $user->id)->delete();
    $made = json_decode((string) @file_get_contents(getenv('SCRATCH') . '/plans-created.json'), true) ?: [];
    foreach ($made as $planId) { // only the plan rows this walk-through created, and only while no other account uses them
        if (! DB::table('users')->where('plan_id', $planId)->exists()) {
            DB::table('plans')->where('id', $planId)->delete();
        }
    }
    @unlink(getenv('SCRATCH') . '/plans-created.json');
    echo "cleaned up", PHP_EOL;

    return;
}

// Ends the Sync now window that Connect just used, so the walk-through can press Sync now itself (no wipe).
if ($state === 'clear-sync-limit') {
    RateLimiter::clear('catalog-sync-now:' . $owner);
    echo "state {$state} applied", PHP_EOL;

    return;
}

// Engine progress on the scan the browser just started (no wipe).
if (str_starts_with($state, 'scan:') || $state === 'verify-domain') {
    $latest = CatalogScan::where('user_id', $owner)->orderByDesc('id')->firstOrFail();
    if ($state === 'verify-domain') {
        CatalogDomain::whereKey($latest->catalog_domain_id)->update(['status' => 'verified', 'method' => 'meta', 'verified_at' => $utc()]);
    } elseif ($state === 'scan:ready') {
        $latest->forceFill(['status' => 'ready', 'progress_step' => null, 'result' => [
            'finished_at' => now('UTC')->toIso8601String(), 'site_kind' => 'retail', 'platform' => 'shopify',
            'recipe' => ['version' => 1, 'mode' => 'feed', 'feed' => 'shopify', 'site_kind' => 'retail', 'key' => 'sku'],
            'preview' => array_map(fn (int $n) => ['title' => "Walnut Side Table {$n}", 'price' => 180 + 20 * $n, 'currency' => 'CAD', 'url' => "https://{$host}/products/walnut-{$n}", 'image_url' => $img($n), 'category' => 'Tables'], range(1, 5)),
            'estimated_items' => 42, 'estimated_items_is_minimum' => false, 'item_limit' => 500,
        ]])->save();
    } else {
        [, $status, $step] = array_pad(explode(':', $state), 3, null);
        $latest->forceFill(['status' => $status ?: 'running', 'progress_step' => $step ?: 'checking'])->save();
    }
    echo "state {$state} applied to scan {$latest->id}", PHP_EOL;

    return;
}

$wipe();
$plan = in_array($state, ['teams', 'teams_paused'], true) ? 'Intermediate' : ($state === 'starter' ? 'Starter' : 'Professional');
$planRow = Plan::firstOrCreate(['name' => $plan]);
if ($planRow->wasRecentlyCreated) { // remember plan rows this walk-through made, so cleanup removes only those
    $made = json_decode((string) @file_get_contents(getenv('SCRATCH') . '/plans-created.json'), true) ?: [];
    file_put_contents(getenv('SCRATCH') . '/plans-created.json', json_encode(array_values(array_unique([...$made, $planRow->id]))));
}
$user->forceFill(['plan_id' => $planRow->id])->save();

$domain = function (string $status = 'pending', array $over = []) use ($owner, $host): CatalogDomain {
    $row = CatalogDomain::firstOrCreate(['user_id' => $owner, 'host' => $host], ['token' => '7c1e9a3b5d2f4e6a8b0c1d2e3f4a5b6c', 'status' => $status]);
    $row->forceFill(['status' => $status] + $over)->save();

    return $row;
};
$verification = fn (string $token): array => ['methods' => [
    'meta' => ['looked_for' => '<meta name="stasht-site-verification" content="' . $token . '"> inside the homepage <head>', 'where' => "https://www.{$host}/", 'found' => false, 'seen' => [], 'in_body' => true],
    'dns'  => ['looked_for' => 'A DNS TXT record "stasht-site-verification=' . $token . '" on ' . $host, 'where' => $host, 'found' => false, 'seen' => [], 'lookup_failed' => false],
]];
$scan = function (string $status, ?array $result, array $over = []) use ($owner, $host, $domain): CatalogScan {
    return CatalogScan::create(array_merge([
        'user_id' => $owner, 'url' => "https://www.{$host}/", 'host' => $host, 'catalog_domain_id' => $domain()->id,
        'status' => $status, 'result' => $result, 'expires_at' => now()->addHours(24),
    ], $over));
};
$ready = fn (int $estimated): array => [
    'finished_at' => now('UTC')->toIso8601String(), 'site_kind' => 'retail', 'platform' => 'shopify',
    'recipe' => ['version' => 1, 'mode' => 'feed', 'feed' => 'shopify', 'site_kind' => 'retail', 'key' => 'sku'],
    'preview' => array_map(fn (int $n) => ['title' => "Walnut Side Table {$n}", 'price' => 180 + 20 * $n, 'currency' => 'CAD', 'url' => "https://{$host}/products/walnut-{$n}", 'image_url' => $img($n), 'category' => 'Tables'], range(1, 5)),
    'estimated_items' => $estimated, 'estimated_items_is_minimum' => false, 'item_limit' => 500,
];
$source = function (string $status, ?string $reason = null) use ($owner, $host, $domain, $img, $utc): CatalogSource {
    $d = $domain('verified', ['method' => 'meta', 'verified_at' => $utc('-10 days')]);
    $s = CatalogSource::create([
        'user_id' => $owner, 'catalog_domain_id' => $d->id, 'url' => "https://www.{$host}/", 'host' => $host,
        'status' => $status, 'status_reason' => $reason, 'site_kind' => 'retail', 'recipe' => ['version' => 1, 'mode' => 'feed'],
        'item_limit' => 500, 'authorized_at' => now()->subDays(10), 'last_run_at' => $utc('-2 hours'), 'last_success_at' => $utc('-2 hours'),
    ]);
    foreach (range(1, 12) as $n) {
        $item = CatalogItem::create([
            'user_id' => $owner, 'catalog_source_id' => $s->id, 'external_key' => "wc-{$n}", 'title' => "Walnut Side Table {$n}",
            'price' => 180 + 20 * $n, 'currency' => 'CAD', 'category' => $n <= 6 ? 'Tables' : 'Lighting',
            'url' => "https://{$host}/products/walnut-{$n}", 'main_image' => $img($n), 'availability' => 'available', 'content_hash' => "h{$n}",
        ]);
        CatalogItemImage::create(['catalog_item_id' => $item->id, 'image_url' => $img($n), 'source_url' => $img($n), 'sort_order' => 0]);
    }

    return $s;
};

switch ($state) {
    case 'fresh': case 'teams': case 'starter':
        break;
    case 'teams_paused': $source('plan_required', 'plan_required'); break;
    case 'analysing': $scan('running', null, ['progress_step' => 'discovering']); break;
    case 'ready': $scan('ready', $ready(640)); break;
    case 'unverified': $scan('unverified', ['reason' => 'not_found', 'message' => 'engine text', 'verification' => $verification($domain()->token)]); break;
    case 'claimed': $scan('unverified', ['reason' => 'claimed', 'message' => 'engine text', 'verification' => $verification($domain()->token)]); break;
    case 'blocked_scan': $scan('blocked', ['reason' => 'blocked', 'message' => 'engine text', 'blocked' => ['ip' => '18.190.41.14', 'user_agent' => 'StashtBot/1.0 (+https://stasht.com)', 'url' => "https://www.{$host}/"]]); break;
    case 'unsupported': $scan('unsupported', ['reason' => 'javascript', 'message' => 'engine text']); break;
    case 'failed': $scan('failed', ['reason' => 'ai_error', 'message' => 'engine text', 'detail' => 'RuntimeException']); break;
    case 'active': $source('active'); break;
    case 'active_warning': $source('active'); CatalogDomain::where('user_id', $owner)->update(['missing_since' => $utc('-2 days')]); break;
    case 'paused': $source('paused'); break;
    case 'admin_paused': $source('paused', 'admin_paused'); break;
    case 'needs_attention': $source('needs_attention', 'recipe_drift'); break;
    case 'src_unverified': $source('unverified', 'verification_lost'); CatalogDomain::where('user_id', $owner)->update(['status' => 'lost', 'missing_since' => $utc('-8 days')]); break;
    case 'src_blocked': $source('blocked', 'blocked'); break;
    case 'plan_required': $source('plan_required', 'plan_required'); break;
    default: throw new InvalidArgumentException("Unknown state {$state}");
}
echo "state {$state} ready", PHP_EOL;
```
Seed the account:
```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$API" && php artisan tinker --env=testing --execute="require '$SCRATCH/wc-seed.php';"
```

## 4. Start the local web API (background)

```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$API/public" && CATALOG_PILOT_USER_IDS= php -d display_errors=0 -d log_errors=1 -S 127.0.0.1:8088 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php > "$SCRATCH/api.log" 2>&1
```
Prove it reads the test database: the walk-through token exists only there.
```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && curl -s -H "Accept: application/json" -H "Authorization: Bearer $(cat "$SCRATCH/token.txt")" http://127.0.0.1:8088/api/react/website-catalogue
```
Expected: `{"success":true,"data":{"available":true,…}}`. A 401 means the server is not reading `stasht_testing_wc`: stop it and find out why before anything else.
`display_errors=0` keeps PHP deprecation notices (Passport on PHP 8.4) out of the JSON answers; they go to `api.log`.
The control: a made-up token must get a 401.
```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Accept: application/json" -H "Authorization: Bearer not-a-real-token" http://127.0.0.1:8088/api/react/website-catalogue
```

## 5. The harness page and the dev server (background)

`$STUDIO/scratch-wc.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Website Catalogue walk-through</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/scratch-wc.tsx"></script>
  </body>
</html>
```
`$STUDIO/scratch-wc.tsx`:
```tsx
// TEMPORARY walk-through harness (never commit): the Connectors page as App mounts it.
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import './styles/globals.css';
import { AuthProvider } from './contexts/AuthContext';
import { PropertyProvider } from './contexts/PropertyContext';
import MarketplacePage from './pages/MarketplacePage';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <PropertyProvider>
      <MarketplacePage />
      <Toaster position="top-right" />
    </PropertyProvider>
  </AuthProvider>,
);
```
```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$STUDIO" && PHP_BACKEND_URL=http://127.0.0.1:8088 VITE_API_BASE_URL=/api/react ../../node_modules/.bin/vite --port 5199 --strictPort > "$SCRATCH/vite.log" 2>&1
```
Ready when `curl -s -o /dev/null -w '%{http_code}' http://localhost:5199/scratch-wc.html` prints `200`. The two variables on
the command line win over every `.env*` file, so `/api` goes only to the local API (the main checkout's `.env.local` /
`.env.development.local` point at production; the worktree does not read them, and the command line overrides them anyway).
The dev server also proxies `/sso-api` and `/s3-proxy` to real servers: the walk-through script aborts those paths.

## 6. The walk-through script

`/private/tmp/claude-501/website-catalogue-sp3/wc-walk.mjs`:
```js
// Website Catalogue SP3 walk-through: screenshots of every card and dialog state (local only, see the recipe).
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { readFileSync, appendFileSync } from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const API = process.env.API;
const SCRATCH = process.env.SCRATCH;
const BASE = 'http://localhost:5199/scratch-wc.html';
const token = readFileSync(`${SCRATCH}/token.txt`, 'utf8').trim();
const user = readFileSync(`${SCRATCH}/user.json`, 'utf8');
let plan = 'Professional';

function state(name) {
  execFileSync('php', ['artisan', 'tinker', '--env=testing', `--execute=require '${SCRATCH}/wc-state.php';`], {
    cwd: API,
    stdio: 'inherit',
    env: { ...process.env, DB_DATABASE: 'stasht_testing_wc', STASHT_DB_DATABASE: 'stasht_testing_wc', APP_ENV: 'testing', CACHE_DRIVER: 'file', WC_STATE: name },
  });
  if (!name.startsWith('scan:') && name !== 'verify-domain' && name !== 'clear-sync-limit') {
    plan = { teams: 'Intermediate', teams_paused: 'Intermediate', starter: 'Starter' }[name] ?? 'Professional';
  }
}

const browser = await chromium.launch({ headless: true });

async function open(width = 1280, height = 900) {
  // Fresh context per state; service workers blocked so the dev PWA worker can neither cache nor bypass routing.
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  await context.addInitScript(([t, u]) => {
    localStorage.setItem('stasht_token', t);
    localStorage.setItem('stasht_user', u);
  }, [token, user]);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  // ONE handler for every request; the safety guard runs first. Nothing may leave this machine: any host other than
  // localhost / 127.0.0.1 is aborted, and so are the dev server's /sso-api and /s3-proxy paths (Vite would forward
  // those to real servers).
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const u = new URL(url);
    if (!['localhost', '127.0.0.1'].includes(u.hostname) || /^\/(sso-api|s3-proxy)(\/|$)/.test(u.pathname)) {
      appendFileSync(`${SCRATCH}/blocked.txt`, `${url}\n`);
      return route.abort('blockedbyclient');
    }
    if (u.hostname === '127.0.0.1' && u.pathname.startsWith('/wc-img/')) {
      // The seeded "website photos" (https, as the preview requires), answered from Studio's own public/ folder.
      return route.fulfill({ path: `${process.env.STUDIO}/public/${u.pathname.slice('/wc-img/'.length)}` });
    }
    if (!u.pathname.startsWith('/api/')) return route.continue(); // the dev server's own files
    if (!u.pathname.startsWith('/api/react/')) return route.fulfill({ json: { success: true, data: [] } });
    if (u.pathname.startsWith('/api/react/website-catalogue')) return route.continue(); // the real local API
    if (url.includes('/user/storage-overview')) {
      return route.fulfill({ json: { success: true, data: { storage_overview: { plan_name: plan } } } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Connectors' }).waitFor();
  await page.waitForTimeout(1200);
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: `${SCRATCH}/shots/${name}.png`, fullPage: true });
  console.log('shot', name);
}

const card = (page) => page.getByRole('button', { name: /Website Catalogue$/ });

if (process.argv[2] === 'hidden') {
  state('active');
  const { context, page } = await open();
  await shot(page, '70-card-hidden-not-on-pilot');
  await context.close();
  await browser.close();
  console.log('done');
  process.exit(0);
}

// 1. Card states from a page load.
for (const [name, file] of [
  ['fresh', '01-card-business'], ['teams', '02-card-teams'], ['teams_paused', '03-card-teams-paused'], ['starter', '04-card-starter'],
  ['analysing', '05-card-analysing'], ['ready', '06-card-ready'], ['failed', '07-card-failed'], ['active', '08-card-active'],
  ['active_warning', '09-card-warning'], ['paused', '10-card-paused'], ['needs_attention', '11-card-needs-attention'],
  ['src_unverified', '12-card-unverified'], ['src_blocked', '13-card-blocked'], ['plan_required', '14-card-plan-required-business'],
]) {
  state(name);
  const { context, page } = await open();
  await shot(page, file);
  await context.close();
}

// 2. The connect flow end to end against the local API.
state('fresh');
{
  const { context, page } = await open();
  await card(page).click();
  await page.getByText('Website address').waitFor();
  await shot(page, '20-modal-url');
  await page.getByRole('button', { name: 'Continue' }).click();
  await shot(page, '21-modal-url-error');
  await page.getByPlaceholder('www.yourstore.com').fill('www.demo-shop.example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Option 1: a meta tag').waitFor();
  await shot(page, '22-modal-verify');
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByText('Verifying ownership').waitFor();
  await shot(page, '23-modal-progress-start');
  state('scan:running:discovering');
  await page.waitForTimeout(3500);
  await shot(page, '24-modal-progress-discovering');
  state('scan:ready');
  await page.getByText(/We found about/).waitFor({ timeout: 10000 });
  await shot(page, '25-modal-ready');
  state('verify-domain');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, '26-card-connected');
  await card(page).click();
  await page.getByText('Connected and syncing every night').waitFor();
  await shot(page, '27a-manage-right-after-connect'); // Connect used the Sync now window: the button waits
  state('clear-sync-limit'); // before closing: closing the dialog reloads the card
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  await card(page).click();
  await page.getByText('Connected and syncing every night').waitFor();
  await shot(page, '27-manage-active');
  await page.getByRole('button', { name: /Sync now/ }).click();
  await page.waitForTimeout(1000);
  await shot(page, '28-manage-sync-requested');
  await page.getByRole('button', { name: /Pause syncing/ }).click();
  await page.waitForTimeout(1000);
  await shot(page, '29-manage-paused');
  await page.getByRole('button', { name: /Resume syncing/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Disconnect', exact: true }).first().click();
  await page.getByRole('alertdialog').waitFor();
  await page.waitForTimeout(500); // let the confirmation finish fading in
  await shot(page, '30-disconnect-confirm');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disconnect' }).click();
  await page.waitForTimeout(1500);
  await shot(page, '31-card-after-disconnect');
  await context.close();
}

// 3. Outcomes and progress, reopened from the card.
for (const [name, file] of [
  ['unverified', '40-outcome-unverified'], ['claimed', '41-outcome-claimed'], ['blocked_scan', '42-outcome-blocked'],
  ['unsupported', '43-outcome-unsupported'], ['failed', '44-outcome-failed'], ['ready', '45-outcome-ready-over-limit'],
  ['analysing', '46-progress-reopened'],
]) {
  state(name);
  const { context, page } = await open();
  await card(page).click();
  await page.waitForTimeout(1000);
  await shot(page, file);
  await context.close();
}

// 4. The manage dialog in every state that needs the owner.
for (const [name, file] of [
  ['active_warning', '50-manage-warning'], ['admin_paused', '51-manage-paused-by-support'], ['needs_attention', '52-manage-needs-attention'],
  ['src_unverified', '53-manage-unverified'], ['src_blocked', '54-manage-blocked'], ['plan_required', '55-manage-plan-required-business'],
]) {
  state(name);
  const { context, page } = await open();
  await card(page).click();
  await page.waitForTimeout(1000);
  await shot(page, file);
  await context.close();
}

// 4b. The manage dialog's actions, where its body scrolls (the verification options or blocked help push them down).
for (const [name, file] of [
  ['active_warning', '50b-manage-warning-actions'], ['src_unverified', '53b-manage-unverified-actions'], ['src_blocked', '54b-manage-blocked-actions'],
]) {
  state(name);
  const { context, page } = await open();
  await card(page).click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelectorAll('.overflow-y-auto').forEach((el) => { el.scrollTop = el.scrollHeight; }));
  await page.waitForTimeout(300);
  await shot(page, file);
  await context.close();
}

// 4c. The Disconnect confirmation for a website with items.
state('active');
{
  const { context, page } = await open();
  await card(page).click();
  await page.getByText('Connected and syncing every night').waitFor();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).first().click();
  await page.getByRole('alertdialog').waitFor();
  await page.waitForTimeout(500);
  await shot(page, '30b-disconnect-confirm-12-items');
  await context.close();
}

// 5. Phone width.
state('fresh');
{
  const { context, page } = await open(390, 844);
  await shot(page, '60-phone-card');
  await card(page).click();
  await page.getByPlaceholder('www.yourstore.com').fill('www.demo-shop.example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Option 1: a meta tag').waitFor();
  await shot(page, '61-phone-verify');
  await context.close();
}
state('active_warning');
{
  const { context, page } = await open(390, 844);
  await card(page).click();
  await page.waitForTimeout(1000);
  await shot(page, '62-phone-manage');
  await context.close();
}

await browser.close();
console.log('done');
```
Run it:
```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$SCRATCH" && API="$API" SCRATCH="$SCRATCH" PW="$PW" ~/.nvm/versions/node/v24.5.0/bin/node wc-walk.mjs
```
Nothing leaves the machine: the script's one route handler aborts every request to a host other than `localhost` /
`127.0.0.1` (and the dev server's `/sso-api`, `/s3-proxy` paths) and lists it in `$SCRATCH/blocked.txt`; the only entries
expected are the Shopify card's two logos. The seeded "website photos" are `https://127.0.0.1/wc-img/…` URLs that the
script answers from Studio's `public/` folder (the preview shows only https photos). Service workers are blocked, so the
dev PWA worker can neither cache nor bypass the routing.

Expected: `shot …` lines and `done`, with no `PAGE ERROR` line. If the page shows the login screen, or a step waits forever, add `page.on('request', r => console.log(r.url()))` inside `open()` and run again. Find the `/api/react/...` call whose stubbed answer broke the page, and give that path a stub in the shape its caller reads. Never let it through to the local API unless it is a `website-catalogue` route.

Hidden card (outside the pilot list): stop the API server from step 4. Start it again with `CATALOG_PILOT_USER_IDS=1` instead of `CATALOG_PILOT_USER_IDS=`. Then:
```bash
source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$SCRATCH" && API="$API" SCRATCH="$SCRATCH" PW="$PW" ~/.nvm/versions/node/v24.5.0/bin/node wc-walk.mjs hidden
```

## 7. What each screenshot must show

| Screenshot | Must show |
|---|---|
| 01 | Website Catalogue card, globe tile, "Connect" button |
| 02 | "Available on the Business plan." and "See plans" |
| 03 | amber "Paused" badge, "demo-shop.example.com · paused: not on the Business plan", "Upgrade to Business" |
| 04 | the plain card (Starter: clicking opens the upgrade plans, as for every connector) |
| 05 | "Analysing demo-shop.example.com…", "View progress" |
| 06 | "demo-shop.example.com is ready to connect.", "Continue" |
| 07 | "We couldn't finish checking demo-shop.example.com.", "See details" |
| 08 | green "Connected", "demo-shop.example.com · 12 items · synced 2 hours ago", "Manage" |
| 09 | amber "Action needed", "verification code missing" |
| 10 | grey "Paused", "syncing paused" |
| 11–13 | amber badges: "Needs attention" / "Action needed" ("ownership not confirmed" / "blocked by bot protection") |
| 14 | amber "Paused", "resumes with the next sync" |
| 20–21 | How it works box, address field, the tick; 21 adds the red "Enter your website's address…" notice |
| 22 | Option 1 meta tag and Option 2 DNS record with Copy buttons (no widget option: the account has no widget) |
| 23–24 | the five step labels; the current one spins; "usually takes 1–3 minutes" |
| 25 | five preview cards (photo, title, price), "We found about 42 items.", Connect |
| 26 | the card now "Connected · … · sync starting" |
| 27a | right after Connect: Sync now disabled with "A sync is already on its way. … You can sync again in 15 minutes." (Connect uses the Sync now allowance) |
| 27–29 | green connected box, details list, Sync now / Pause syncing; after Sync now the button is disabled with "You can sync again in 15 minutes."; paused shows Resume syncing |
| 30 | the Disconnect confirmation naming the website (the connect-flow source has 0 items) |
| 30b | the same confirmation for the seeded source: "12 items" |
| 31 | the card back to "Connect". Open item (2026-10-09): `GET /website-catalogue` still returns the unexpired `ready` scan the website was connected from, so the card shows "… is ready to connect." / Continue |
| 40 | yellow notice "We couldn't find your verification code on demo-shop.example.com…", the Meta tag and DNS rows with "Not found", the in-body hint, "Check again" |
| 41 | the claimed sentence, no Check again |
| 42 | the blocked sentence, IP 18.190.41.14, the user agent, the IT note with Copy, "Retest" |
| 43 | grey notice "Not supported yet: … JavaScript …", Close and "Use a different address" (no Check again / Try again) |
| 44 | red notice with the API's `ai_error` sentence ("We couldn't finish analysing your website. Please try again."), "Try again"; nowhere the word RuntimeException |
| 45 | "We found about 640 items. We'll import the first 500." |
| 46 | progress list reopened at "Finding your products" |
| 50 | the 7-day warning sentence with both dates, verification options |
| 51 | "Stasht support has paused syncing…", no Resume button |
| 52–54 | each state's sentence; 53 has the verification options and "Check again"; 54 has the IP / user agent / IT note and "Retest" |
| 50b, 53b, 54b | the same dialogs scrolled to their actions: Sync now / Check again / Retest and Pause syncing; the IT note wraps between words (the IP address stays whole) |
| 55 | "Your account is on the Business plan again…", "Sync now" |
| 60–62 | phone width: no horizontal scroll, buttons wrap, nothing clipped |
| 70 | no Website Catalogue card at all |

Text nowhere smaller than 12 px; no raw codes (`needs_attention`, `plan_required`, …) or engine text ("engine text") anywhere.

## 8. Clean up (always, even after a failure)

```bash
pkill -f -- "-S 127.0.0.1:8088"; pkill -f "vite --port 5199"; source /private/tmp/claude-501/website-catalogue-sp3/wc-env.sh && cd "$API" && WC_STATE=cleanup php artisan tinker --env=testing --execute="require '$SCRATCH/wc-state.php';" && cd "$STUDIO" && rm -f scratch-wc.html scratch-wc.tsx && git checkout -- dev-dist && git status --short
```
Expected: `cleaned up`, and `git status --short` shows only `?? deploy-zips/` (and anything a fix commit still has to stage).
Cleanup also removes the `plans` rows the scripts created (listed in `$SCRATCH/plans-created.json`), and only while no
other account uses them. Confirm nothing is left running: `pgrep -fl -- "-S 127.0.0.1:8088|vite --port 5199"` prints nothing.
