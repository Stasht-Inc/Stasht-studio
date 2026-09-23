# Leads Inbox & Assignment — Web API Implementation Plan (Plan A of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the web API (`stasht-database`) lead assignment (first-to-accept + admin assign), team visibility, new-lead notifications, an inbox-shaped leads list, and a "start conversation" endpoint, per spec `docs/superpowers/specs/2026-09-23-leads-inbox-and-assignment-design.md`.

**Architecture:** Two new services own the rules — `LeadAccess` (who is on a property's team/admin, who can see/message a lead, the visibility query) and `LeadIntake` (runs once when a lead row is truly created: sets `property_id`, notifies the team when unassigned). `LeadAssignmentNotifier` fans out bell + web push + OneSignal. Controllers swap their inline `owner_user_id !==` checks for `LeadAccess`. Plan B mirrors this in `admin-portal`; Plan C is Studio.

**Tech Stack:** Laravel 10, PHP 8.1+, MySQL (two connections `mysql` / `mysql_stasht`, both `stasht_testing` locally), PHPUnit 10 with `DatabaseTransactions`, Passport (`react_api` guard).

## Global Constraints

- Repo/worktree: `Codes/stasht-database/.worktrees/share-cars-dev`, branch `development`. Never commit on `main`. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run tests from the worktree: `php vendor/bin/phpunit <path>` (vendor is a real copy, not a symlink).
- ~19 tests in `tests/Feature/CampaignSms` + `tests/Feature/Storeel` already fail identically before this work (local DB column mismatch). "No new failures" = the failing set is unchanged.
- User ids everywhere below are **external user ids** (`users.external_user_id` on `mysql`; `UserStash.id` on `mysql_stasht`; `property_users.user_id`; `properties.user_id`; `leads.owner_user_id`).
- Team of a property = `properties.user_id` + `property_users.user_id` with role in `owner, admin, rep`. Admin = `properties.user_id` + role in `owner, admin`. Role `viewer` gets nothing.
- Production `php artisan migrate` is broken — every schema change also goes into the hand-run SQL script (Task 1).
- Lead creation, message sending and webhooks must never fail because of intake/notification code: wrap it in `try/catch` + `Log::error`.
- Every new test class calls `Http::fake()` in `setUp()` (or per test) — lead creation now fans out OneSignal pushes, and tests must never reach the network.
- Error codes: accept on taken lead → 409 `{message, taken_by:{id,name}}`; assign by non-admin → 403; assign to non-team → 422; lead not visible → 404; start-conversation opted-out → 422 "This contact has opted out"; ambiguous property → 422 "Choose a property".

## File map

| File | Responsibility |
|---|---|
| `database/migrations/2026_09_23_000001_add_assignment_to_leads.php` (new) | Local/test schema |
| `docs/sql/2026-09-23-leads-assignment.sql` (new) | Production ALTER + backfill script |
| `app/Services/Leads/LeadAccess.php` (new) | Team/admin lookup, can-see / can-message, visibility query |
| `app/Services/Leads/LeadIntake.php` (new) | Property resolution, raw upsert helper, on-created hook |
| `app/Services/Leads/LeadAssignmentNotifier.php` (new) | Bell + web push + OneSignal fan-out |
| `app/Services/LeadPushNotifier.php` | Extract `pushToUser()`; inbound push goes to assignee/team |
| `app/Models/Lead.php` | Casts, `created` event → intake |
| `app/Models/LeadMessage.php` | Stamp `last_message_at` |
| `app/Http/Controllers/ReactApi/LeadAssignmentController.php` (new) | accept / assign / assignable-users |
| `app/Http/Controllers/ReactApi/LeadConversationStartController.php` (new) | start-conversation |
| `app/Http/Controllers/ReactApi/LeadsController.php` | index visibility/filters/new fields; mutations via `LeadAccess` |
| `app/Http/Controllers/ReactApi/LeadMessagesController.php` | thread/send/reply/mark-read/share-cars via `LeadAccess`; unread count visibility |
| `app/Http/Controllers/ReactApi/MediaController.php`, `MemoriesController.php` | Raw lead inserts → `LeadIntake::upsertViewerLead()`; invite lead assigned to sender |
| `routes/react_api.php` | New routes |
| `tests/Feature/Leads/*.php` (new) | Tests per task |

---

### Task 1: Schema — assignment columns + production SQL

**Files:**
- Create: `database/migrations/2026_09_23_000001_add_assignment_to_leads.php`
- Create: `docs/sql/2026-09-23-leads-assignment.sql`
- Modify: `app/Models/Lead.php` (casts)
- Test: `tests/Feature/Leads/LeadAssignmentSchemaTest.php`

**Interfaces:**
- Produces: `leads.property_id`, `leads.assigned_user_id`, `leads.assigned_at`, `leads.assigned_by_user_id`, `leads.last_message_at` (all nullable); `leads.memory_id` nullable. `Lead` casts `assigned_at`, `last_message_at` as datetime.

- [ ] **Step 1: Write the failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class LeadAssignmentSchemaTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    public function test_direct_lead_without_campaign_can_be_stored_with_assignment(): void
    {
        $lead = Lead::create([
            'owner_user_id' => 810001, 'viewer_user_id' => null, 'viewer_phone' => '+15550101010',
            'memory_id' => null, 'property_id' => 42, 'assigned_user_id' => 810001, 'assigned_at' => now(),
            'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now(), 'last_message_at' => now(),
        ]);

        $fresh = $lead->fresh();
        $this->assertNull($fresh->memory_id);
        $this->assertSame(42, (int) $fresh->property_id);
        $this->assertSame(810001, (int) $fresh->assigned_user_id);
        $this->assertNotNull($fresh->assigned_at);
        $this->assertInstanceOf(\Carbon\CarbonInterface::class, $fresh->last_message_at);
    }
}
```

- [ ] **Step 2: Run it — expect FAIL** (`Unknown column 'property_id'` or `memory_id cannot be null`)

Run: `php vendor/bin/phpunit tests/Feature/Leads/LeadAssignmentSchemaTest.php`

- [ ] **Step 3: Migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $s = Schema::connection('mysql_stasht');

        $s->table('leads', function (Blueprint $t) use ($s) {
            if (! $s->hasColumn('leads', 'property_id')) {
                $t->unsignedBigInteger('property_id')->nullable()->after('memory_id')->index();
            }
            if (! $s->hasColumn('leads', 'assigned_user_id')) {
                $t->unsignedBigInteger('assigned_user_id')->nullable()->after('property_id')->index();
            }
            if (! $s->hasColumn('leads', 'assigned_at')) {
                $t->timestamp('assigned_at')->nullable()->after('assigned_user_id');
            }
            if (! $s->hasColumn('leads', 'assigned_by_user_id')) {
                $t->unsignedBigInteger('assigned_by_user_id')->nullable()->after('assigned_at');
            }
            if (! $s->hasColumn('leads', 'last_message_at')) {
                $t->timestamp('last_message_at')->nullable()->after('last_engaged_at');
            }
        });

        DB::connection('mysql_stasht')->statement('ALTER TABLE leads MODIFY memory_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        Schema::connection('mysql_stasht')->table('leads', function (Blueprint $t) {
            $t->dropColumn(['property_id', 'assigned_user_id', 'assigned_at', 'assigned_by_user_id', 'last_message_at']);
        });
    }
};
```

`app/Models/Lead.php` casts gain:

```php
        'assigned_at'     => 'datetime',
        'last_message_at' => 'datetime',
```

- [ ] **Step 4: Apply locally and re-run** — `php artisan migrate --env=testing` then the test. Expected: PASS.

- [ ] **Step 5: Production SQL script** `docs/sql/2026-09-23-leads-assignment.sql`

```sql
-- Leads assignment (spec 2026-09-23). Run by hand on the DB that holds `leads`
-- (web API: mysql_stasht). Confirm admin-portal's `leads` is the same table first;
-- if not, run on both. Idempotency: check each column with SHOW COLUMNS first.
ALTER TABLE leads
  ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER memory_id,
  ADD COLUMN assigned_user_id BIGINT UNSIGNED NULL AFTER property_id,
  ADD COLUMN assigned_at TIMESTAMP NULL AFTER assigned_user_id,
  ADD COLUMN assigned_by_user_id BIGINT UNSIGNED NULL AFTER assigned_at,
  ADD COLUMN last_message_at TIMESTAMP NULL AFTER last_engaged_at,
  ADD INDEX leads_property_id_index (property_id),
  ADD INDEX leads_assigned_user_id_index (assigned_user_id);
ALTER TABLE leads MODIFY memory_id BIGINT UNSIGNED NULL;

-- Backfill 1: property from the campaign, else its first pivot property.
UPDATE leads l JOIN memories m ON m.id = l.memory_id
   SET l.property_id = m.property_id
 WHERE l.property_id IS NULL AND m.property_id IS NOT NULL;
UPDATE leads l
   JOIN (SELECT memory_id, MIN(property_id) AS pid FROM memory_property GROUP BY memory_id) mp
     ON mp.memory_id = l.memory_id
   SET l.property_id = mp.pid
 WHERE l.property_id IS NULL;

-- Backfill 2: every existing lead belongs to its campaign owner (no alert flood).
UPDATE leads SET assigned_user_id = owner_user_id, assigned_at = created_at
 WHERE assigned_user_id IS NULL;

-- Backfill 3: latest message time for inbox sorting.
UPDATE leads l JOIN (SELECT lead_id, MAX(sent_at) AS t FROM lead_messages GROUP BY lead_id) x
    ON x.lead_id = l.id
   SET l.last_message_at = x.t;
```

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_09_23_000001_add_assignment_to_leads.php docs/sql/2026-09-23-leads-assignment.sql app/Models/Lead.php tests/Feature/Leads/LeadAssignmentSchemaTest.php
git commit -m "feat(leads): assignment columns, nullable memory_id, production SQL + backfill"
```

---

### Task 2: `LeadAccess` — team, admin, visibility

**Files:**
- Create: `app/Services/Leads/LeadAccess.php`
- Test: `tests/Feature/Leads/LeadAccessTest.php`

**Interfaces:**
- Produces (all ids are external user ids):
  - `teamIds(?int $propertyId): Collection<int>`
  - `isAdmin(int $userId, ?int $propertyId): bool`
  - `isOnTeam(int $userId, ?int $propertyId): bool`
  - `adminPropertyIds(int $userId): Collection<int>`
  - `teamPropertyIds(int $userId): Collection<int>`
  - `propertyIdOf(Lead $lead): ?int` — `lead.property_id`, else the campaign's property (via `StoreelSendService::dealerIdFor`)
  - `canView(Lead $lead, int $userId): bool`
  - `canMessage(Lead $lead, int $userId): bool`
  - `canDelete(Lead $lead, int $userId): bool` — owner or property admin
  - `applyVisibility(Builder $query, int $userId): Builder`

- [ ] **Step 1: Failing test** — a matrix over owner/admin/rep/viewer/stranger × assigned/unassigned.

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\Memory;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Services\Leads\LeadAccess;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class LeadAccessTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    private function world(): array
    {
        $owner = 820000; $admin = 820001; $repA = 820002; $repB = 820003; $viewer = 820004; $stranger = 820005; $campaignOwner = 820006;
        $p = Property::create(['name' => 'Dealer', 'user_id' => $owner, 'status' => 1, 'unique_id' => 'd-' . uniqid(), 'username' => 'd-' . uniqid()]);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => $admin, 'role' => 'admin']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => $repA, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => $repB, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => $viewer, 'role' => 'viewer']);
        $m = Memory::factory()->create(['user_id' => $campaignOwner, 'published' => 1, 'slug' => 'a-' . uniqid(), 'property_id' => $p->id]);
        $mk = fn (?int $assignee) => Lead::create(['owner_user_id' => $campaignOwner, 'viewer_user_id' => null, 'viewer_phone' => '+1555' . random_int(1000000, 9999999),
            'memory_id' => $m->id, 'property_id' => $p->id, 'assigned_user_id' => $assignee, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);
        return compact('owner', 'admin', 'repA', 'repB', 'viewer', 'stranger', 'campaignOwner', 'p', 'm') + ['unassigned' => $mk(null), 'mineA' => $mk($repA)];
    }

    public function test_team_and_admin_membership(): void
    {
        $w = $this->world(); $a = app(LeadAccess::class);
        $this->assertEqualsCanonicalizing([$w['owner'], $w['admin'], $w['repA'], $w['repB']], $a->teamIds($w['p']->id)->all());
        $this->assertTrue($a->isAdmin($w['owner'], $w['p']->id));
        $this->assertTrue($a->isAdmin($w['admin'], $w['p']->id));
        $this->assertFalse($a->isAdmin($w['repA'], $w['p']->id));
        $this->assertFalse($a->isOnTeam($w['viewer'], $w['p']->id));
        $this->assertFalse($a->isAdmin($w['owner'], null));
    }

    public function test_view_and_message_matrix(): void
    {
        $w = $this->world(); $a = app(LeadAccess::class);
        $u = $w['unassigned']; $mine = $w['mineA'];

        // unassigned: whole team + campaign owner can see; only admins/owner can message
        foreach (['owner', 'admin', 'repA', 'repB', 'campaignOwner'] as $who) {
            $this->assertTrue($a->canView($u, $w[$who]), "$who should see unassigned");
        }
        foreach (['viewer', 'stranger'] as $who) {
            $this->assertFalse($a->canView($u, $w[$who]), "$who must not see unassigned");
        }
        $this->assertFalse($a->canMessage($u, $w['repA']));
        $this->assertTrue($a->canMessage($u, $w['admin']));
        $this->assertTrue($a->canMessage($u, $w['campaignOwner']));

        // assigned to repA: repB cannot see it; repA can message
        $this->assertTrue($a->canView($mine, $w['repA']));
        $this->assertTrue($a->canMessage($mine, $w['repA']));
        $this->assertFalse($a->canView($mine, $w['repB']));
        $this->assertTrue($a->canView($mine, $w['admin']));
        $this->assertFalse($a->canDelete($mine, $w['repA']));
        $this->assertTrue($a->canDelete($mine, $w['admin']));
    }

    public function test_visibility_query_matches_can_view(): void
    {
        $w = $this->world(); $a = app(LeadAccess::class);
        $ids = fn (int $user) => $a->applyVisibility(Lead::query()->whereIn('id', [$w['unassigned']->id, $w['mineA']->id]), $user)->pluck('id')->all();

        $this->assertEqualsCanonicalizing([$w['unassigned']->id, $w['mineA']->id], $ids($w['admin']));
        $this->assertEqualsCanonicalizing([$w['unassigned']->id, $w['mineA']->id], $ids($w['repA']));
        $this->assertEqualsCanonicalizing([$w['unassigned']->id], $ids($w['repB']));
        $this->assertSame([], $ids($w['viewer']));
        $this->assertSame([], $ids($w['stranger']));
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (`Class "App\Services\Leads\LeadAccess" not found`).

- [ ] **Step 3: Implement**

```php
<?php
namespace App\Services\Leads;

use App\Models\Lead;
use App\Models\Memory;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Services\Storeel\StoreelSendService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Who may see / act on a lead (spec 2026-09-23 §2). Team of a property = its owner
 * plus property_users with role owner/admin/rep; admin = owner + role owner/admin.
 * All ids are external user ids. Memoised per request.
 */
class LeadAccess
{
    private const TEAM_ROLES  = ['owner', 'admin', 'rep'];
    private const ADMIN_ROLES = ['owner', 'admin'];

    private array $teamCache = [];
    private array $adminCache = [];
    private array $adminPropsCache = [];
    private array $teamPropsCache = [];

    public function teamIds(?int $propertyId): Collection
    {
        if (! $propertyId) {
            return collect();
        }
        return $this->teamCache[$propertyId] ??= $this->members($propertyId, self::TEAM_ROLES);
    }

    public function adminIds(?int $propertyId): Collection
    {
        if (! $propertyId) {
            return collect();
        }
        return $this->adminCache[$propertyId] ??= $this->members($propertyId, self::ADMIN_ROLES);
    }

    public function isAdmin(int $userId, ?int $propertyId): bool
    {
        return $this->adminIds($propertyId)->contains($userId);
    }

    public function isOnTeam(int $userId, ?int $propertyId): bool
    {
        return $this->teamIds($propertyId)->contains($userId);
    }

    public function adminPropertyIds(int $userId): Collection
    {
        return $this->adminPropsCache[$userId] ??= $this->propertiesFor($userId, self::ADMIN_ROLES);
    }

    public function teamPropertyIds(int $userId): Collection
    {
        return $this->teamPropsCache[$userId] ??= $this->propertiesFor($userId, self::TEAM_ROLES);
    }

    public function propertyIdOf(Lead $lead): ?int
    {
        if ($lead->property_id) {
            return (int) $lead->property_id;
        }
        $memory = $lead->memory_id ? Memory::find($lead->memory_id) : null;
        return $memory ? app(StoreelSendService::class)->dealerIdFor($memory) : null;
    }

    public function canView(Lead $lead, int $userId): bool
    {
        if ((int) $lead->owner_user_id === $userId || (int) $lead->assigned_user_id === $userId) {
            return true;
        }
        $propertyId = $this->propertyIdOf($lead);
        if ($this->isAdmin($userId, $propertyId)) {
            return true;
        }
        return $lead->assigned_user_id === null && $this->isOnTeam($userId, $propertyId);
    }

    public function canMessage(Lead $lead, int $userId): bool
    {
        return (int) $lead->owner_user_id === $userId
            || (int) $lead->assigned_user_id === $userId
            || $this->isAdmin($userId, $this->propertyIdOf($lead));
    }

    public function canDelete(Lead $lead, int $userId): bool
    {
        return (int) $lead->owner_user_id === $userId || $this->isAdmin($userId, $this->propertyIdOf($lead));
    }

    public function applyVisibility(Builder $query, int $userId): Builder
    {
        $adminProps = $this->adminPropertyIds($userId);
        $teamProps  = $this->teamPropertyIds($userId);
        // Leads created before property_id existed and not yet backfilled still
        // resolve through their campaign (the pre-2026-09-23 rollup rule).
        $adminMemoryIds = $adminProps->isNotEmpty() ? Memory::whereIn('property_id', $adminProps)->pluck('id') : collect();

        return $query->where(function ($w) use ($userId, $adminProps, $teamProps, $adminMemoryIds) {
            $w->where('owner_user_id', $userId)->orWhere('assigned_user_id', $userId);
            if ($adminProps->isNotEmpty()) {
                $w->orWhereIn('property_id', $adminProps);
            }
            if ($adminMemoryIds->isNotEmpty()) {
                $w->orWhere(fn ($x) => $x->whereNull('property_id')->whereIn('memory_id', $adminMemoryIds));
            }
            if ($teamProps->isNotEmpty()) {
                $w->orWhere(fn ($x) => $x->whereNull('assigned_user_id')->whereIn('property_id', $teamProps));
            }
        });
    }

    private function members(int $propertyId, array $roles): Collection
    {
        $owner = Property::where('id', $propertyId)->value('user_id');
        return PropertyUser::where('property_id', $propertyId)->whereIn('role', $roles)->pluck('user_id')
            ->when($owner, fn ($c) => $c->push($owner))
            ->map(fn ($id) => (int) $id)->unique()->values();
    }

    private function propertiesFor(int $userId, array $roles): Collection
    {
        return Property::where('user_id', $userId)->pluck('id')
            ->concat(PropertyUser::where('user_id', $userId)->whereIn('role', $roles)->pluck('property_id'))
            ->map(fn ($id) => (int) $id)->unique()->values();
    }
}
```

- [ ] **Step 4: Run — expect PASS.** `php vendor/bin/phpunit tests/Feature/Leads/LeadAccessTest.php`
- [ ] **Step 5: Commit** — `git add app/Services/Leads/LeadAccess.php tests/Feature/Leads/LeadAccessTest.php && git commit -m "feat(leads): LeadAccess — team/admin/visibility rules"`

---

### Task 3: `LeadAssignmentNotifier` + `LeadPushNotifier::pushToUser`

**Files:**
- Create: `app/Services/Leads/LeadAssignmentNotifier.php`
- Modify: `app/Services/LeadPushNotifier.php` (extract `pushToUser`, route inbound to assignee/team)
- Test: `tests/Feature/Leads/LeadAssignmentNotifierTest.php`

**Interfaces:**
- Consumes: `LeadAccess::teamIds()`, `LeadAccess::propertyIdOf()`.
- Produces:
  - `LeadPushNotifier::pushToUser(int $externalUserId, string $heading, string $content, array $data): void` (OneSignal, same fallbacks as today; never throws)
  - `LeadPushNotifier::notifyOwnerOfInbound(Lead, LeadMessage)` — unchanged name; now pushes to `LeadAssignmentNotifier::inboundRecipients($lead)`
  - `LeadAssignmentNotifier::notifyNewLead(Lead $lead): void` — bell `type=lead_unassigned` + web push + OneSignal to every team member
  - `LeadAssignmentNotifier::notifyAssigned(Lead $lead, int $assigneeId, ?int $byUserId): void` — `type=lead_assigned` to the assignee only
  - `LeadAssignmentNotifier::inboundRecipients(Lead $lead): array<int>` — `[assignee]`, else team, else `[owner]`
  - `LeadAssignmentNotifier::displayName(Lead $lead): string`

- [ ] **Step 1: Failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\Memory;
use App\Models\Notification;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Services\Leads\LeadAssignmentNotifier;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LeadAssignmentNotifierTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    private function lead(?int $assignee = null): Lead
    {
        $p = Property::create(['name' => 'Dealer', 'user_id' => 830000, 'status' => 1, 'unique_id' => 'n-' . uniqid(), 'username' => 'n-' . uniqid()]);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 830001, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 830002, 'role' => 'viewer']);
        $m = Memory::factory()->create(['user_id' => 830000, 'published' => 1, 'slug' => 'n-' . uniqid(), 'property_id' => $p->id]);
        return Lead::create(['owner_user_id' => 830000, 'viewer_user_id' => null, 'viewer_name' => 'Brian Felicio', 'viewer_phone' => '+15550102020',
            'memory_id' => $m->id, 'property_id' => $p->id, 'assigned_user_id' => $assignee ?? 830000, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);
    }

    public function test_new_lead_notifies_every_team_member_but_not_viewers(): void
    {
        config(['services.onesignal.app_id' => 'app', 'services.onesignal.rest_api_key' => 'key']);
        Http::fake(['onesignal.com/*' => Http::response(['id' => 'x', 'recipients' => 1])]);
        $lead = $this->lead();
        Notification::where('lead_id', $lead->id)->delete(); // ignore anything intake did

        app(LeadAssignmentNotifier::class)->notifyNewLead($lead);

        $bell = Notification::where('lead_id', $lead->id)->where('type', 'lead_unassigned')->pluck('user_id')->map(fn ($i) => (int) $i)->all();
        $this->assertEqualsCanonicalizing([830000, 830001], $bell);
        $this->assertStringContainsString('Brian Felicio', Notification::where('lead_id', $lead->id)->value('title'));

        $pushedTo = collect(Http::recorded())->map(fn ($p) => $p[0]['include_aliases']['external_id'][0] ?? null)->filter()->values()->all();
        $this->assertEqualsCanonicalizing(['830000', '830001'], $pushedTo);
    }

    public function test_assigned_notifies_only_the_assignee_and_inbound_routes_to_assignee(): void
    {
        Http::fake();
        $lead = $this->lead(830001);
        $n = app(LeadAssignmentNotifier::class);
        Notification::where('lead_id', $lead->id)->delete();

        $n->notifyAssigned($lead, 830001, 830000);

        $this->assertSame([830001], Notification::where('lead_id', $lead->id)->where('type', 'lead_assigned')->pluck('user_id')->map(fn ($i) => (int) $i)->all());
        $this->assertSame([830001], $n->inboundRecipients($lead));

        $lead->assigned_user_id = null;
        $this->assertEqualsCanonicalizing([830000, 830001], $n->inboundRecipients($lead));
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (class not found).

- [ ] **Step 3: Refactor `LeadPushNotifier`.** Move the body of `notifyOwnerOfInbound` (config check, payload, the three addressing attempts, logging) into `pushToUser(int $externalUserId, string $heading, string $content, array $data)`; the device-token fallback reads `UserStash::find($externalUserId)?->device_token`. `notifyOwnerOfInbound` becomes:

```php
    public function notifyOwnerOfInbound(Lead $lead, LeadMessage $message): void
    {
        $notifier = app(\App\Services\Leads\LeadAssignmentNotifier::class);
        $name     = $notifier->displayName($lead);
        $channel  = $message->channel === 'sms' ? 'SMS' : 'email';
        $preview  = trim((string) ($message->body ?: ($message->subject ?: '')));
        $preview  = $preview === '' ? 'Open the app to read it.' : mb_strimwidth($preview, 0, 140, '…');
        $data     = ['type' => 'lead_message', 'lead_id' => $lead->id, 'memory_id' => $lead->memory_id, 'message_id' => $message->id, 'channel' => $message->channel];

        foreach ($notifier->inboundRecipients($lead) as $userId) {
            $this->pushToUser($userId, "{$name} replied via {$channel}", $preview, $data);
        }
    }
```

Keep `ios_badgeType`/`ios_badgeCount` in the payload built by `pushToUser`. `pushToUser` wraps everything in `try { … } catch (\Throwable $e) { Log::error(...) }`.

- [ ] **Step 4: Implement `LeadAssignmentNotifier`**

```php
<?php
namespace App\Services\Leads;

use App\Models\Lead;
use App\Models\Notification;
use App\Models\UserStash;
use App\Services\LeadPushNotifier;
use Illuminate\Support\Facades\Log;

/** Bell + web push + mobile push for lead assignment events (spec §4). Never throws. */
class LeadAssignmentNotifier
{
    public function __construct(private LeadAccess $access, private LeadPushNotifier $push)
    {
    }

    public function notifyNewLead(Lead $lead): void
    {
        $recipients = $this->access->teamIds($this->access->propertyIdOf($lead))->all();
        $name = $this->displayName($lead);
        $this->fanOut($lead, $recipients, 'lead_unassigned', "New lead: {$name}", 'Tap to accept this lead.', null);
    }

    public function notifyAssigned(Lead $lead, int $assigneeId, ?int $byUserId): void
    {
        $by   = $byUserId ? (UserStash::find($byUserId)?->name ?: 'An admin') : null;
        $name = $this->displayName($lead);
        $body = $by ? "{$by} assigned {$name} to you." : "{$name} is now yours.";
        $this->fanOut($lead, [$assigneeId], 'lead_assigned', "Lead assigned: {$name}", $body, $byUserId);
    }

    /** @return array<int> */
    public function inboundRecipients(Lead $lead): array
    {
        if ($lead->assigned_user_id) {
            return [(int) $lead->assigned_user_id];
        }
        $team = $this->access->teamIds($this->access->propertyIdOf($lead));
        return $team->isNotEmpty() ? $team->all() : [(int) $lead->owner_user_id];
    }

    public function displayName(Lead $lead): string
    {
        $viewer = $lead->viewer_user_id ? UserStash::find($lead->viewer_user_id) : null;
        return trim((string) ($viewer?->name ?: ($lead->viewer_name ?: ($lead->viewer_phone ?: ($lead->viewer_email ?: 'A lead')))));
    }

    private function fanOut(Lead $lead, array $userIds, string $type, string $title, string $body, ?int $senderId): void
    {
        $data = ['type' => $type, 'lead_id' => $lead->id, 'memory_id' => $lead->memory_id];

        foreach (array_unique($userIds) as $userId) {
            try {
                Notification::create([
                    'user_id' => $userId, 'sender_id' => $senderId, 'type' => $type, 'lead_id' => $lead->id,
                    'title' => $title, 'description' => $body, 'read' => 0,
                ]);
            } catch (\Throwable $e) {
                Log::warning('[LeadAssign] bell notification failed', ['lead_id' => $lead->id, 'user_id' => $userId, 'error' => $e->getMessage()]);
            }
            try {
                \sendPushNotification($userId, $title, $body, $data); // browser (Studio) push
            } catch (\Throwable $e) {
                Log::warning('[LeadAssign] web push failed', ['lead_id' => $lead->id, 'user_id' => $userId, 'error' => $e->getMessage()]);
            }
            $this->push->pushToUser((int) $userId, $title, $body, $data); // mobile; never throws
        }
    }
}
```

- [ ] **Step 5: Run the new test + existing inbound push test** — `php vendor/bin/phpunit tests/Feature/Leads/LeadAssignmentNotifierTest.php tests/Feature/CampaignSms/InboundReplyPushTest.php`. Expected: new test PASS; `InboundReplyPushTest` result unchanged from before this task (record its before/after).
- [ ] **Step 6: Commit** — `git commit -m "feat(leads): assignment notifier; inbound push goes to assignee or team"`

---

### Task 4: `LeadIntake` — one hook for truly-new leads

**Files:**
- Create: `app/Services/Leads/LeadIntake.php`
- Modify: `app/Models/Lead.php` (`created` event), `app/Models/LeadMessage.php` (stamp `last_message_at`)
- Modify: `app/Http/Controllers/ReactApi/MediaController.php:~902`, `MemoriesController.php:~2917, ~5050, ~13858` (raw inserts → `upsertViewerLead`), `MemoriesController.php:~10911` (invite lead: `assigned_user_id` = sender)
- Test: `tests/Feature/Leads/LeadIntakeTest.php`

**Interfaces:**
- Consumes: `LeadAccess::propertyIdOf()`, `LeadAssignmentNotifier::notifyNewLead()`.
- Produces:
  - `LeadIntake::handleCreated(Lead $lead): void` — sets `property_id` if null (quiet save); if `assigned_user_id` is null → `notifyNewLead`; never throws
  - `LeadIntake::upsertViewerLead(int $ownerId, int $viewerId, int $memoryId): ?Lead` — the existing `INSERT … ON DUPLICATE KEY UPDATE`, run with `affectingStatement`; on affected = 1 (insert) calls `handleCreated`; returns the lead row

- [ ] **Step 1: Failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\LeadMessage;
use App\Models\Memory;
use App\Models\Notification;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Services\Leads\LeadIntake;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class LeadIntakeTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    private function campaign(): Memory
    {
        $p = Property::create(['name' => 'Dealer', 'user_id' => 840000, 'status' => 1, 'unique_id' => 'i-' . uniqid(), 'username' => 'i-' . uniqid()]);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 840001, 'role' => 'rep']);
        return Memory::factory()->create(['user_id' => 840000, 'published' => 1, 'slug' => 'i-' . uniqid(), 'property_id' => $p->id]);
    }

    public function test_unassigned_new_lead_gets_property_and_notifies_team_once(): void
    {
        $m = $this->campaign();
        $lead = Lead::create(['owner_user_id' => 840000, 'viewer_user_id' => null, 'viewer_phone' => '+15550103030', 'memory_id' => $m->id,
            'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);

        $this->assertSame((int) $m->property_id, (int) $lead->fresh()->property_id);
        $this->assertSame(2, Notification::where('lead_id', $lead->id)->where('type', 'lead_unassigned')->count());
    }

    public function test_assigned_new_lead_does_not_broadcast(): void
    {
        $m = $this->campaign();
        $lead = Lead::create(['owner_user_id' => 840000, 'viewer_user_id' => null, 'viewer_phone' => '+15550104040', 'memory_id' => $m->id,
            'assigned_user_id' => 840001, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);
        $this->assertSame(0, Notification::where('lead_id', $lead->id)->where('type', 'lead_unassigned')->count());
    }

    public function test_raw_upsert_notifies_on_insert_only_not_on_repeat_view(): void
    {
        $m = $this->campaign();
        $intake = app(LeadIntake::class);

        $first  = $intake->upsertViewerLead(840000, 840099, $m->id);
        $second = $intake->upsertViewerLead(840000, 840099, $m->id);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(2, (int) $second->engagement);
        $this->assertSame(2, Notification::where('lead_id', $first->id)->where('type', 'lead_unassigned')->count());
    }

    public function test_any_message_stamps_last_message_at(): void
    {
        $m = $this->campaign();
        $lead = Lead::create(['owner_user_id' => 840000, 'viewer_user_id' => null, 'viewer_phone' => '+15550105050', 'memory_id' => $m->id,
            'assigned_user_id' => 840000, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()->subDays(3)]);

        LeadMessage::create(['lead_id' => $lead->id, 'direction' => 'outbound', 'channel' => 'sms', 'body' => 'hi', 'status' => 'sent', 'is_read' => true, 'sent_at' => now()]);

        $this->assertTrue($lead->fresh()->last_message_at->gt(now()->subMinute()));
    }
}
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `LeadIntake`**

```php
<?php
namespace App\Services\Leads;

use App\Models\Lead;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Runs exactly once per truly-new lead row (spec §3 "Lead intake"). Eloquent creates
 * reach it through Lead::created; the raw INSERT … ON DUPLICATE KEY UPDATE paths go
 * through upsertViewerLead(), which only calls it when MySQL reports an insert
 * (affected rows = 1; an update reports 2, a no-op 0).
 */
class LeadIntake
{
    public function __construct(private LeadAccess $access, private LeadAssignmentNotifier $notifier)
    {
    }

    public function handleCreated(Lead $lead): void
    {
        try {
            if (! $lead->property_id) {
                $propertyId = $this->access->propertyIdOf($lead);
                if ($propertyId) {
                    $lead->property_id = $propertyId;
                    $lead->saveQuietly();
                }
            }
            if ($lead->assigned_user_id === null) {
                $this->notifier->notifyNewLead($lead);
            }
        } catch (\Throwable $e) {
            Log::error('[LeadIntake] failed', ['lead_id' => $lead->id, 'error' => $e->getMessage()]);
        }
    }

    public function upsertViewerLead(int $ownerId, int $viewerId, int $memoryId): ?Lead
    {
        $affected = DB::connection('mysql_stasht')->affectingStatement(
            'INSERT INTO leads (owner_user_id, viewer_user_id, memory_id, engagement, first_seen_at, last_engaged_at, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW(), NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                 engagement      = IF(is_archived = 0, engagement + 1, engagement),
                 last_engaged_at = IF(is_archived = 0, NOW(), last_engaged_at),
                 updated_at      = IF(is_archived = 0, NOW(), updated_at)',
            [$ownerId, $viewerId, $memoryId]
        );

        $lead = Lead::where('owner_user_id', $ownerId)->where('viewer_user_id', $viewerId)->where('memory_id', $memoryId)->first();

        if ($lead && $affected === 1) {
            $this->handleCreated($lead);
        }

        return $lead;
    }
}
```

`app/Models/Lead.php`:

```php
    protected static function booted(): void
    {
        // Every Eloquent-created lead passes through intake once (property + new-lead
        // alert). Raw-SQL creates call LeadIntake::upsertViewerLead() instead.
        static::created(fn (Lead $lead) => app(\App\Services\Leads\LeadIntake::class)->handleCreated($lead));
    }
```

`app/Models/LeadMessage.php` — extend the existing `created` hook:

```php
        static::created(function (LeadMessage $message) {
            if (! $message->lead_id) {
                return;
            }
            $stamp = ['last_message_at' => $message->sent_at ?? now()];
            if ($message->direction === 'inbound') {
                $stamp['last_engaged_at'] = now();
            }
            Lead::whereKey($message->lead_id)->update($stamp);
        });
```

- [ ] **Step 4: Replace the four raw inserts.** At each site, replace the whole `\DB::connection('mysql_stasht')->statement('INSERT INTO leads … ', [$owner, $viewer, $memory]);` call with:

```php
                app(\App\Services\Leads\LeadIntake::class)->upsertViewerLead((int) $memory->user_id, (int) $user->external_user_id, (int) $memoryImage->memory_id); // MediaController ~902
```
```php
            app(\App\Services\Leads\LeadIntake::class)->upsertViewerLead((int) $memory->user_id, (int) $user_id, (int) $id); // MemoriesController ~2917
```
```php
                app(\App\Services\Leads\LeadIntake::class)->upsertViewerLead((int) $memory->user_id, (int) $viewer->external_user_id, (int) $memory_id); // MemoriesController ~5050
```
In `recordGuestLead` (~13858) replace the statement and the following `return Lead::where(...)->first();` with:
```php
                return app(\App\Services\Leads\LeadIntake::class)->upsertViewerLead((int) $memory->user_id, (int) $matchedUser->external_user_id, (int) $memory->id);
```

Invite lead (`MemoriesController` ~10911, inside `addCollaboratorByPhone`): add to the `Lead::create([...])` array:
```php
                                        'assigned_user_id' => $sender->external_user_id,
                                        'assigned_at'      => now(),
```

Verify no raw lead insert remains: `grep -rn "INSERT INTO leads" app` → only `LeadIntake.php`.

- [ ] **Step 5: Run** `php vendor/bin/phpunit tests/Feature/Leads tests/Feature/PropertyStaffNotCountedAsLeadsTest.php tests/Feature/Storeel tests/Feature/CampaignSms` — new tests PASS; the pre-existing failing set is unchanged (diff the failure list against a run on the previous commit).
- [ ] **Step 6: Commit** — `git commit -m "feat(leads): LeadIntake — property + new-lead alert only on real inserts; last_message_at"`

---

### Task 5: Accept / assign / assignable-users endpoints

**Files:**
- Create: `app/Http/Controllers/ReactApi/LeadAssignmentController.php`
- Modify: `routes/react_api.php` (inside the `auth:react_api` group, next to the Leads routes)
- Test: `tests/Feature/Leads/LeadAssignmentEndpointsTest.php`

**Interfaces:**
- Consumes: `LeadAccess`, `LeadAssignmentNotifier::notifyAssigned()`.
- Produces routes:
  - `POST /api/react/leads/{lead_id}/accept` → 200 `{lead_id, assignee:{id,name,profile_color}}` | 409 `{message, taken_by:{id,name}}` | 404
  - `POST /api/react/leads/{lead_id}/assign` body `{user_id: int|null}` → 200 same shape | 403 | 422 | 404
  - `GET /api/react/leads/{lead_id}/assignable-users` → 200 `{users:[{id,name,profile_color,role}]}` | 404
- Produces helper (public static, reused by Task 6): `LeadAssignmentController::assigneeBlock(?int $userId): ?array`

- [ ] **Step 1: Failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\Memory;
use App\Models\Notification;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Passport\Passport;
use Tests\TestCase;

class LeadAssignmentEndpointsTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    private array $u = [];
    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['owner' => 850000, 'repA' => 850001, 'repB' => 850002, 'viewer' => 850003] as $k => $id) {
            $this->u[$k] = User::factory()->create(['role' => 'user', 'external_user_id' => $id, 'name' => ucfirst($k)]);
        }
        $p = Property::create(['name' => 'Dealer', 'user_id' => 850000, 'status' => 1, 'unique_id' => 'e-' . uniqid(), 'username' => 'e-' . uniqid()]);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 850001, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 850002, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 850003, 'role' => 'viewer']);
        $m = Memory::factory()->create(['user_id' => 850000, 'published' => 1, 'slug' => 'e-' . uniqid(), 'property_id' => $p->id]);
        $this->lead = Lead::create(['owner_user_id' => 850000, 'viewer_user_id' => null, 'viewer_phone' => '+15550106060', 'memory_id' => $m->id,
            'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);
    }

    public function test_first_accept_wins_second_gets_409(): void
    {
        Passport::actingAs($this->u['repA'], [], 'react_api');
        $this->postJson("/api/react/leads/{$this->lead->id}/accept")->assertOk()->assertJsonPath('assignee.id', 850001);

        Passport::actingAs($this->u['repB'], [], 'react_api');
        $this->postJson("/api/react/leads/{$this->lead->id}/accept")->assertStatus(409)->assertJsonPath('taken_by.id', 850001);
        $this->assertSame(850001, (int) $this->lead->fresh()->assigned_user_id);
    }

    public function test_viewer_cannot_accept(): void
    {
        Passport::actingAs($this->u['viewer'], [], 'react_api');
        $this->postJson("/api/react/leads/{$this->lead->id}/accept")->assertNotFound();
    }

    public function test_admin_assigns_immediately_and_assignee_is_notified(): void
    {
        Passport::actingAs($this->u['owner'], [], 'react_api');
        $this->postJson("/api/react/leads/{$this->lead->id}/assign", ['user_id' => 850002])->assertOk()->assertJsonPath('assignee.id', 850002);

        $fresh = $this->lead->fresh();
        $this->assertSame(850002, (int) $fresh->assigned_user_id);
        $this->assertSame(850000, (int) $fresh->assigned_by_user_id);
        $this->assertSame(1, Notification::where('lead_id', $this->lead->id)->where('type', 'lead_assigned')->where('user_id', 850002)->count());
    }

    public function test_rep_cannot_assign_and_admin_cannot_assign_off_team(): void
    {
        Passport::actingAs($this->u['repA'], [], 'react_api');
        $this->postJson("/api/react/leads/{$this->lead->id}/assign", ['user_id' => 850001])->assertForbidden();

        Passport::actingAs($this->u['owner'], [], 'react_api');
        $this->postJson("/api/react/leads/{$this->lead->id}/assign", ['user_id' => 850003])->assertStatus(422);
    }

    public function test_assignable_users_lists_team_only(): void
    {
        Passport::actingAs($this->u['owner'], [], 'react_api');
        $ids = collect($this->getJson("/api/react/leads/{$this->lead->id}/assignable-users")->assertOk()->json('users'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing([850000, 850001, 850002], $ids);
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (404 route).

- [ ] **Step 3: Implement controller**

```php
<?php
namespace App\Http\Controllers\ReactApi;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\PropertyUser;
use App\Models\UserStash;
use App\Services\Leads\LeadAccess;
use App\Services\Leads\LeadAssignmentNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Lead assignment: first-to-accept claim, admin assign, team picker (spec §2–§3). */
class LeadAssignmentController extends Controller
{
    public function __construct(private LeadAccess $access, private LeadAssignmentNotifier $notifier)
    {
    }

    public function accept(Request $request, $lead_id)
    {
        $me   = (int) Auth::guard('react_api')->user()->external_user_id;
        $lead = Lead::find($lead_id);
        if (! $lead || ! $this->access->canView($lead, $me)) {
            return response()->json(['message' => 'Lead not found.'], 404);
        }
        if ((int) $lead->assigned_user_id === $me) {
            return response()->json(['lead_id' => $lead->id, 'assignee' => self::assigneeBlock($me)]);
        }
        if (! $this->access->isOnTeam($me, $this->access->propertyIdOf($lead))) {
            return response()->json(['message' => 'Only this dealer\'s team can accept this lead.'], 403);
        }

        // Atomic claim: only one concurrent Accept can flip NULL → me.
        $won = Lead::whereKey($lead->id)->whereNull('assigned_user_id')
            ->update(['assigned_user_id' => $me, 'assigned_at' => now(), 'assigned_by_user_id' => null]);

        if ($won === 0) {
            $taker = (int) Lead::whereKey($lead->id)->value('assigned_user_id');
            return response()->json([
                'message'  => 'This lead was already accepted.',
                'taken_by' => ['id' => $taker, 'name' => UserStash::find($taker)?->name],
            ], 409);
        }

        return response()->json(['lead_id' => $lead->id, 'assignee' => self::assigneeBlock($me)]);
    }

    public function assign(Request $request, $lead_id)
    {
        $data = $request->validate(['user_id' => 'present|nullable|integer']);
        $me   = (int) Auth::guard('react_api')->user()->external_user_id;
        $lead = Lead::find($lead_id);
        if (! $lead || ! $this->access->canView($lead, $me)) {
            return response()->json(['message' => 'Lead not found.'], 404);
        }
        $propertyId = $this->access->propertyIdOf($lead);
        if (! $this->access->isAdmin($me, $propertyId)) {
            return response()->json(['message' => 'Only an admin can assign leads.'], 403);
        }
        $target = $data['user_id'] === null ? null : (int) $data['user_id'];
        if ($target !== null && ! $this->access->isOnTeam($target, $propertyId)) {
            return response()->json(['message' => 'That person is not on this dealer\'s team.'], 422);
        }

        $lead->forceFill([
            'property_id'         => $lead->property_id ?: $propertyId,
            'assigned_user_id'    => $target,
            'assigned_at'         => $target ? now() : null,
            'assigned_by_user_id' => $target ? $me : null,
        ])->save();

        if ($target !== null && $target !== $me) {
            $this->notifier->notifyAssigned($lead, $target, $me);
        }

        return response()->json(['lead_id' => $lead->id, 'assignee' => self::assigneeBlock($target)]);
    }

    public function assignableUsers(Request $request, $lead_id)
    {
        $me   = (int) Auth::guard('react_api')->user()->external_user_id;
        $lead = Lead::find($lead_id);
        if (! $lead || ! $this->access->canView($lead, $me)) {
            return response()->json(['message' => 'Lead not found.'], 404);
        }
        $propertyId = $this->access->propertyIdOf($lead);
        $ids   = $this->access->teamIds($propertyId);
        $roles = PropertyUser::where('property_id', $propertyId)->whereIn('user_id', $ids)->pluck('role', 'user_id');
        $users = UserStash::whereIn('id', $ids)->get(['id', 'name', 'profile_color'])
            ->map(fn ($u) => ['id' => (int) $u->id, 'name' => $u->name, 'profile_color' => $u->profile_color, 'role' => $roles[$u->id] ?? 'owner'])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values();

        return response()->json(['users' => $users]);
    }

    public static function assigneeBlock(?int $userId): ?array
    {
        if (! $userId) {
            return null;
        }
        $u = UserStash::find($userId);
        return ['id' => $userId, 'name' => $u?->name, 'profile_color' => $u?->profile_color];
    }
}
```

Routes (after `Route::get('/leads/unread-count', …)` — keep static paths before `{lead_id}` ones):

```php
    Route::post('/leads/{lead_id}/accept', [\App\Http\Controllers\ReactApi\LeadAssignmentController::class, 'accept']);
    Route::post('/leads/{lead_id}/assign', [\App\Http\Controllers\ReactApi\LeadAssignmentController::class, 'assign']);
    Route::get('/leads/{lead_id}/assignable-users', [\App\Http\Controllers\ReactApi\LeadAssignmentController::class, 'assignableUsers']);
```

- [ ] **Step 4: Run — expect PASS.** `php vendor/bin/phpunit tests/Feature/Leads/LeadAssignmentEndpointsTest.php`
- [ ] **Step 5: Commit** — `git commit -m "feat(leads): accept / assign / assignable-users endpoints"`

---

### Task 6: Leads index — visibility, filters, inbox fields, tab counts

**Files:**
- Modify: `app/Http/Controllers/ReactApi/LeadsController.php` (`index`)
- Test: `tests/Feature/Leads/LeadsInboxIndexTest.php`

**Interfaces:**
- Consumes: `LeadAccess::applyVisibility/canMessage/isAdmin/propertyIdOf`, `LeadAssignmentController::assigneeBlock`.
- Produces on `GET /api/react/leads`:
  - new query param `assigned` in `me|unassigned|<int>`
  - new sort default: `GREATEST(COALESCE(last_message_at, '1970-01-01'), COALESCE(last_engaged_at, '1970-01-01')) DESC` (only when no explicit `sort`)
  - each lead gains `latest_message` `{body, direction, channel, sender_name, sent_at, attachment_name}|null`, `assignee` (assigneeBlock), `property_id`, `can_message`, `can_assign`, `last_activity_at`
  - payload gains `tab_counts: {open, closed}` (visibility + filters, ignoring `archived`)
  - existing fields unchanged (`is_rollup` now = `! can_message`)

- [ ] **Step 1: Failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\LeadMessage;
use App\Models\Memory;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Passport\Passport;
use Tests\TestCase;

class LeadsInboxIndexTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    public function test_rep_sees_own_and_unassigned_with_latest_message_and_counts(): void
    {
        $owner = User::factory()->create(['role' => 'user', 'external_user_id' => 860000, 'name' => 'Owner']);
        $repA  = User::factory()->create(['role' => 'user', 'external_user_id' => 860001, 'name' => 'Sam']);
        User::factory()->create(['role' => 'user', 'external_user_id' => 860002, 'name' => 'Other']);
        $p = Property::create(['name' => 'Dealer', 'user_id' => 860000, 'status' => 1, 'unique_id' => 'x-' . uniqid(), 'username' => 'x-' . uniqid()]);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 860001, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 860002, 'role' => 'rep']);
        $m = Memory::factory()->create(['user_id' => 860000, 'published' => 1, 'slug' => 'x-' . uniqid(), 'property_id' => $p->id]);
        $mk = fn (?int $a, string $name, bool $archived = false) => Lead::create(['owner_user_id' => 860000, 'viewer_user_id' => null, 'viewer_name' => $name,
            'viewer_phone' => '+1555' . random_int(1000000, 9999999), 'memory_id' => $m->id, 'property_id' => $p->id, 'assigned_user_id' => $a,
            'is_archived' => $archived, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()->subDay()]);

        $mine  = $mk(860001, 'Mine');
        $free  = $mk(null, 'Free');
        $mk(860002, 'Theirs');
        $mk(860001, 'MineClosed', true);
        LeadMessage::create(['lead_id' => $mine->id, 'sender_user_id' => 860001, 'direction' => 'outbound', 'channel' => 'sms', 'body' => 'Hi Brian, quote attached', 'status' => 'sent', 'is_read' => true, 'sent_at' => now()]);

        Passport::actingAs($repA, [], 'react_api');
        $r = $this->getJson('/api/react/leads')->assertOk();

        $names = collect($r->json('leads'))->pluck('user.name')->all();
        $this->assertSame(['Mine', 'Free'], $names); // newest activity first; Theirs hidden; closed excluded
        $this->assertSame(['open' => 2, 'closed' => 1], $r->json('tab_counts'));

        $first = $r->json('leads.0');
        $this->assertSame('Hi Brian, quote attached', $first['latest_message']['body']);
        $this->assertSame('outbound', $first['latest_message']['direction']);
        $this->assertSame('Sam', $first['latest_message']['sender_name']);
        $this->assertSame(860001, $first['assignee']['id']);
        $this->assertTrue($first['can_message']);
        $this->assertFalse($first['can_assign']);
        $this->assertNull($r->json('leads.1.assignee'));
        $this->assertFalse($r->json('leads.1.can_message'));

        $this->assertSame(['Free'], collect($this->getJson('/api/react/leads?assigned=unassigned')->json('leads'))->pluck('user.name')->all());
        $this->assertSame(['Mine'], collect($this->getJson('/api/react/leads?assigned=me')->json('leads'))->pluck('user.name')->all());

        Passport::actingAs($owner, [], 'react_api');
        $this->assertCount(3, $this->getJson('/api/react/leads')->json('leads'));
        $this->assertSame(['Theirs'], collect($this->getJson('/api/react/leads?assigned=860002')->json('leads'))->pluck('user.name')->all());
        $this->assertTrue($this->getJson('/api/react/leads')->json('leads.0.can_assign'));
    }
}
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** In `index()`:

1. Validation: add `'assigned' => ['nullable', 'regex:/^(me|unassigned|\d+)$/'],`.
2. Replace the non-partial-admin scoping block (the `else { $query->where(function ($q) use ($owner_user_id, $adminMemoryIds) {...}); }`) with `app(LeadAccess::class)->applyVisibility($query, $owner_user_id);`. Keep `$adminMemoryIds` computation only if still referenced (remove it and its `is_rollup` use — see point 6). Build `$query` **without** the `is_archived` filter first, as `$base`, then:

```php
        $access = app(\App\Services\Leads\LeadAccess::class);
        // Direct leads have no campaign; campaign leads still require the campaign to exist.
        // Grouped so later ANDs bind to the whole condition.
        $base = Lead::where(fn ($q) => $q->whereNull('memory_id')->orWhereIn('memory_id', Memory::select('id')));

        if ($scopedMemoryIds !== null) {
            $base->where('owner_user_id', $owner_user_id)->whereIn('memory_id', $scopedMemoryIds);
        } else {
            $access->applyVisibility($base, $owner_user_id);
        }

        $assigned = $request->input('assigned');
        if ($assigned === 'me') {
            $base->where('assigned_user_id', $owner_user_id);
        } elseif ($assigned === 'unassigned') {
            $base->whereNull('assigned_user_id');
        } elseif ($assigned !== null) {
            $base->where('assigned_user_id', (int) $assigned);
        }
        // status + search filters (existing code) apply to $base here …

        $tabCounts = (clone $base)->reorder()->selectRaw('SUM(is_archived = 0) AS open_count, SUM(is_archived = 1) AS closed_count')->first();
        $query = (clone $base)->where('is_archived', $showArchived);
```

3. Default sort branch (`default => …` and the no-`sort` case) becomes:

```php
                default => $query->orderByRaw("GREATEST(COALESCE(last_message_at, '1970-01-01'), COALESCE(last_engaged_at, '1970-01-01')) DESC")->orderByDesc('id'),
```

4. After `$messageCounts`, batch-load latest messages and assignee/sender names:

```php
        $latestIds = LeadMessage::whereIn('lead_id', $leadIds)->selectRaw('MAX(id) AS id')->groupBy('lead_id')->pluck('id');
        $latest = LeadMessage::whereIn('id', $latestIds)->with('attachments')->get()->keyBy('lead_id');
        $peopleIds = $leads->pluck('assigned_user_id')->concat($latest->pluck('sender_user_id'))->filter()->unique();
        $people = \App\Models\UserStash::whereIn('id', $peopleIds)->get(['id', 'name', 'profile_color'])->keyBy('id');
```

5. In the `map`, add (after `'first_seen_at'`):

```php
                'property_id'      => $lead->property_id ? (int) $lead->property_id : null,
                'assignee'         => $lead->assigned_user_id ? [
                    'id' => (int) $lead->assigned_user_id,
                    'name' => $people[$lead->assigned_user_id]->name ?? null,
                    'profile_color' => $people[$lead->assigned_user_id]->profile_color ?? null,
                ] : null,
                'latest_message'   => ($lm = $latest->get($lead->id)) ? [
                    'body'            => mb_strimwidth(trim(preg_replace('/\s+/', ' ', (string) ($lm->body ?: $lm->subject))), 0, 200, '…'),
                    'direction'       => $lm->direction,
                    'channel'         => $lm->channel,
                    'sender_name'     => $lm->direction === 'outbound' ? ($people[$lm->sender_user_id]->name ?? null) : null,
                    'sent_at'         => $lm->sent_at?->toIso8601String(),
                    'attachment_name' => $lm->attachments->first()?->file_name ?? null,
                ] : null,
                'last_activity_at' => collect([$lead->last_message_at, $lead->last_engaged_at])->filter()->max()?->toIso8601String(),
                'can_message'      => $canMessage = $access->canMessage($lead, $owner_user_id),
                'can_assign'       => $access->isAdmin($owner_user_id, $access->propertyIdOf($lead)),
```

and change `'is_rollup'` to `'is_rollup' => ! $canMessage,` (declare `$canMessage` before the return array to keep evaluation order explicit). Add `$latest, $people, $access` to the closure's `use`. Check the attachment filename column with `grep -n "fillable\|file" app/Models/LeadMessageAttachment.php` and use the real column name.

6. Add `'tab_counts' => ['open' => (int) ($tabCounts->open_count ?? 0), 'closed' => (int) ($tabCounts->closed_count ?? 0)],` to `$payload`.

- [ ] **Step 4: Run — expect PASS**, then the whole `tests/Feature/Leads` folder.
- [ ] **Step 5: Commit** — `git commit -m "feat(leads): inbox index — team visibility, assigned filter, latest message, assignee, tab counts"`

---

### Task 7: Permission swap on every lead action

**Files:**
- Modify: `app/Http/Controllers/ReactApi/LeadMessagesController.php` (lines ~37, 84, 181, 328, 435, 562, 598; `totalUnreadCount`), `app/Http/Controllers/ReactApi/LeadsController.php` (update ~343, destroy ~371, archive ~409, aiSuggest ~451, exportData ~587)
- Test: `tests/Feature/Leads/LeadActionPermissionsTest.php`

**Interfaces:**
- Consumes: `LeadAccess::canView/canMessage/canDelete/applyVisibility`.
- Rule per endpoint: `getThread`, `markRead`, `markCommentsRead` → `canView`; `sendSms`, `sendEmail`, `reply`, `shareCars`, `update`, `archive`, `aiSuggest`, `exportData` → `canMessage`; `destroy` → `canDelete`. A lead the caller can't `canView` → **404**; can view but lacks the action → **403**. Partial-admin (`partial_admin_email`) checks stay exactly as they are, after these checks. Sender of outbound messages = the acting user (already true: `$ownerUser` resolves from the acting user's id).
- `totalUnreadCount`: replace its owner/rollup scoping with `applyVisibility` (partial-admin branch unchanged).
- Delete the now-unused `isRollupAdminFor()`.

- [ ] **Step 1: Failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\Memory;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Models\User;
use App\Services\LeadDeliveryService;
use App\Models\LeadMessage;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Passport\Passport;
use Mockery;
use Tests\TestCase;

class LeadActionPermissionsTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    public function test_assignee_can_message_other_rep_cannot_see_rep_cannot_message_unassigned(): void
    {
        $users = [];
        foreach ([870000 => 'Owner', 870001 => 'Sam', 870002 => 'Kim'] as $id => $n) {
            $users[$id] = User::factory()->create(['role' => 'user', 'external_user_id' => $id, 'name' => $n, 'phone_number' => '+1555' . $id]);
        }
        $p = Property::create(['name' => 'Dealer', 'user_id' => 870000, 'status' => 1, 'unique_id' => 'q-' . uniqid(), 'username' => 'q-' . uniqid()]);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 870001, 'role' => 'rep']);
        PropertyUser::create(['property_id' => $p->id, 'user_id' => 870002, 'role' => 'rep']);
        $m = Memory::factory()->create(['user_id' => 870000, 'published' => 1, 'slug' => 'q-' . uniqid(), 'property_id' => $p->id]);
        $mk = fn (?int $a) => Lead::create(['owner_user_id' => 870000, 'viewer_user_id' => null, 'viewer_phone' => '+1555' . random_int(1000000, 9999999),
            'memory_id' => $m->id, 'property_id' => $p->id, 'assigned_user_id' => $a, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);
        $samLead = $mk(870001);
        $free    = $mk(null);

        $delivery = Mockery::mock(LeadDeliveryService::class);
        $delivery->shouldReceive('deliverSms')->once()->andReturnUsing(fn ($lead, $viewer, $sender) => LeadMessage::create([
            'lead_id' => $lead->id, 'sender_user_id' => $sender->external_user_id, 'direction' => 'outbound', 'channel' => 'sms',
            'body' => 'x', 'status' => 'sent', 'is_read' => true, 'sent_at' => now()]));
        $this->app->instance(LeadDeliveryService::class, $delivery);

        Passport::actingAs($users[870001], [], 'react_api');
        $this->postJson("/api/react/leads/{$samLead->id}/messages/sms", ['body' => 'hello'])->assertOk();
        $this->assertSame(870001, (int) LeadMessage::where('lead_id', $samLead->id)->value('sender_user_id'));
        $this->getJson("/api/react/leads/{$free->id}/messages")->assertOk();
        $this->postJson("/api/react/leads/{$free->id}/messages/sms", ['body' => 'hello'])->assertForbidden();

        Passport::actingAs($users[870002], [], 'react_api');
        $this->getJson("/api/react/leads/{$samLead->id}/messages")->assertNotFound();
        $this->postJson("/api/react/leads/{$samLead->id}/archive")->assertNotFound();
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (Sam gets 403 on his own lead today).

- [ ] **Step 3: Implement.** In both controllers add `use App\Services\Leads\LeadAccess;`. Replace each inline check with the matching block, e.g. for message-sending endpoints:

```php
        $access = app(LeadAccess::class);
        if (! $access->canView($lead, (int) $owner_user_id)) {
            return response()->json(['message' => 'Lead not found.'], 404);
        }
        if (! $access->canMessage($lead, (int) $owner_user_id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
```

For `getThread`/`markRead`/`markCommentsRead` only the `canView` → 404 block. For `destroy` use `canDelete` for the 403. In `totalUnreadCount`, replace the owner/rollup lead-id query with `app(LeadAccess::class)->applyVisibility(Lead::query(), (int) $owner_user_id)->pluck('id')` (keep the partial-admin branch as is). Remove `isRollupAdminFor()`.

- [ ] **Step 4: Run** `php vendor/bin/phpunit tests/Feature/Leads tests/Feature/CampaignSms tests/Feature/Storeel` — new test PASS, pre-existing failing set unchanged.
- [ ] **Step 5: Commit** — `git commit -m "feat(leads): assignee/admin/owner can act on a lead; reps only see their own + unclaimed"`

---

### Task 8: `POST /leads/start-conversation`

**Files:**
- Create: `app/Http/Controllers/ReactApi/LeadConversationStartController.php`
- Modify: `routes/react_api.php`
- Test: `tests/Feature/Leads/StartConversationTest.php`

**Interfaces:**
- Consumes: `LeadAccess::teamPropertyIds`, `LeadDeliveryService::deliverSms(Lead, ?User, User, string $body, ?int $groupId, ?string $broadcastId, string $client, ?Memory $memory)`, `deliverEmail(Lead, ?User, User, string $subject, string $body, ?int $parent, ?int $group, ?string $broadcast, array $attachments, string $client, ?Memory $memory)`.
- Produces: `POST /api/react/leads/start-conversation` body `{property_id?, name?, channel: sms|email, phone?, email?, memory_id?, subject?, body}` → 200 `{lead_id, created: bool, message_id}` | 422 `{message}`.
- Rules: property = given (must be in caller's team properties, else 422 "Choose a property") else the caller's only team property else `null` when they have none; >1 and none given → 422 "Choose a property". `memory_id` (optional) must be a campaign the caller owns or whose property is that property (else 422). Existing lead match: same property (or, with no property, same `owner_user_id` = caller), phone in phone-candidates of the given number / email case-insensitive, most recent `last_engaged_at`. New lead: `owner_user_id = caller`, `viewer_user_id = null`, `viewer_name/phone/email`, `memory_id`, `property_id`, `assigned_user_id = caller`, `assigned_at = now()`, `engagement 1`, `first_seen_at/last_engaged_at = now()`. Opted-out → 422 "This contact has opted out". An existing lead assigned to someone else that the caller cannot message → 422 "This contact is already being handled by <name>".

- [ ] **Step 1: Failing test**

```php
<?php
namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Models\LeadMessage;
use App\Models\Property;
use App\Models\PropertyUser;
use App\Models\User;
use App\Services\LeadDeliveryService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Passport\Passport;
use Mockery;
use Tests\TestCase;

class StartConversationTest extends TestCase
{
    use DatabaseTransactions;
    protected $connectionsToTransact = ['mysql', 'mysql_stasht'];

    private User $rep;
    private Property $p;

    protected function setUp(): void
    {
        parent::setUp();
        $this->rep = User::factory()->create(['role' => 'user', 'external_user_id' => 880001, 'name' => 'Sam']);
        $this->p = Property::create(['name' => 'Dealer', 'user_id' => 880000, 'status' => 1, 'unique_id' => 's-' . uniqid(), 'username' => 's-' . uniqid()]);
        PropertyUser::create(['property_id' => $this->p->id, 'user_id' => 880001, 'role' => 'rep']);

        $delivery = Mockery::mock(LeadDeliveryService::class);
        $delivery->shouldReceive('deliverSms')->andReturnUsing(fn ($lead, $viewer, $sender, $body) => LeadMessage::create([
            'lead_id' => $lead->id, 'sender_user_id' => $sender->external_user_id, 'direction' => 'outbound', 'channel' => 'sms',
            'body' => $body, 'status' => 'sent', 'is_read' => true, 'sent_at' => now()]));
        $this->app->instance(LeadDeliveryService::class, $delivery);
        Passport::actingAs($this->rep, [], 'react_api');
    }

    public function test_new_contact_becomes_direct_lead_assigned_to_sender(): void
    {
        $r = $this->postJson('/api/react/leads/start-conversation', ['name' => 'Brian', 'channel' => 'sms', 'phone' => '(647) 913-1301', 'body' => 'Hi Brian'])
            ->assertOk()->assertJsonPath('created', true);

        $lead = Lead::find($r->json('lead_id'));
        $this->assertNull($lead->memory_id);
        $this->assertSame($this->p->id, (int) $lead->property_id);
        $this->assertSame(880001, (int) $lead->assigned_user_id);
        $this->assertSame('Brian', $lead->viewer_name);
        $this->assertSame(1, LeadMessage::where('lead_id', $lead->id)->count());
    }

    public function test_existing_contact_on_property_is_reused(): void
    {
        $existing = Lead::create(['owner_user_id' => 880000, 'viewer_user_id' => null, 'viewer_phone' => '+16479131301', 'memory_id' => null,
            'property_id' => $this->p->id, 'assigned_user_id' => 880001, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);

        $this->postJson('/api/react/leads/start-conversation', ['channel' => 'sms', 'phone' => '647-913-1301', 'body' => 'Again'])
            ->assertOk()->assertJsonPath('created', false)->assertJsonPath('lead_id', $existing->id);
    }

    public function test_opted_out_contact_is_refused(): void
    {
        Lead::create(['owner_user_id' => 880000, 'viewer_user_id' => null, 'viewer_phone' => '+16470000000', 'memory_id' => null, 'opted_out' => true,
            'property_id' => $this->p->id, 'assigned_user_id' => 880001, 'engagement' => 1, 'first_seen_at' => now(), 'last_engaged_at' => now()]);

        $this->postJson('/api/react/leads/start-conversation', ['channel' => 'sms', 'phone' => '6470000000', 'body' => 'Hi'])
            ->assertStatus(422)->assertJsonPath('message', 'This contact has opted out');
    }

    public function test_multiple_properties_require_a_choice(): void
    {
        $p2 = Property::create(['name' => 'Second', 'user_id' => 880009, 'status' => 1, 'unique_id' => 's2-' . uniqid(), 'username' => 's2-' . uniqid()]);
        PropertyUser::create(['property_id' => $p2->id, 'user_id' => 880001, 'role' => 'rep']);

        $this->postJson('/api/react/leads/start-conversation', ['channel' => 'sms', 'phone' => '6475551234', 'body' => 'Hi'])
            ->assertStatus(422)->assertJsonPath('message', 'Choose a property');
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (404 route).

- [ ] **Step 3: Implement**

```php
<?php
namespace App\Http\Controllers\ReactApi;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Memory;
use App\Models\User;
use App\Services\Exceptions\LeadDeliveryException;
use App\Services\LeadDeliveryService;
use App\Services\Leads\LeadAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** "+ Send Message": start an SMS/email conversation with anyone (spec §3). */
class LeadConversationStartController extends Controller
{
    public function __construct(private LeadAccess $access, private LeadDeliveryService $delivery)
    {
    }

    public function __invoke(Request $request)
    {
        $data = $request->validate([
            'property_id' => 'nullable|integer',
            'name'        => 'nullable|string|max:120',
            'channel'     => 'required|in:sms,email',
            'phone'       => 'required_if:channel,sms|nullable|string|max:32',
            'email'       => 'required_if:channel,email|nullable|email|max:190',
            'memory_id'   => 'nullable|integer',
            'subject'     => 'nullable|string|max:190',
            'body'        => 'required|string|max:1600',
        ]);

        $sender = Auth::guard('react_api')->user();
        $me     = (int) $sender->external_user_id;

        $myProps = $this->access->teamPropertyIds($me);
        if (! empty($data['property_id'])) {
            if (! $myProps->contains((int) $data['property_id'])) {
                return response()->json(['message' => 'Choose a property'], 422);
            }
            $propertyId = (int) $data['property_id'];
        } elseif ($myProps->count() > 1) {
            return response()->json(['message' => 'Choose a property'], 422);
        } else {
            $propertyId = $myProps->first();
        }

        $memory = null;
        if (! empty($data['memory_id'])) {
            $memory = Memory::find($data['memory_id']);
            $ok = $memory && ((int) $memory->user_id === $me || ($propertyId && (int) $memory->property_id === $propertyId));
            if (! $ok) {
                return response()->json(['message' => 'You can\'t attach that campaign.'], 422);
            }
        }

        $phone = $data['channel'] === 'sms' ? $this->normalisePhone($data['phone']) : null;
        $email = $data['channel'] === 'email' ? strtolower(trim($data['email'])) : null;
        if ($data['channel'] === 'sms' && ! $phone) {
            return response()->json(['message' => 'Enter a valid phone number'], 422);
        }

        $existing = Lead::query()
            ->when($propertyId, fn ($q) => $q->where('property_id', $propertyId), fn ($q) => $q->where('owner_user_id', $me))
            ->when($phone, fn ($q) => $q->whereIn('viewer_phone', $this->phoneCandidates($phone)))
            ->when($email, fn ($q) => $q->whereRaw('LOWER(viewer_email) = ?', [$email]))
            ->orderByDesc('last_engaged_at')->first();

        if ($existing && $existing->opted_out) {
            return response()->json(['message' => 'This contact has opted out'], 422);
        }
        if ($existing && ! $this->access->canMessage($existing, $me)) {
            $name = \App\Models\UserStash::find($existing->assigned_user_id)?->name ?? 'someone else';
            return response()->json(['message' => "This contact is already being handled by {$name}"], 422);
        }

        $lead = $existing ?? Lead::create([
            'owner_user_id'    => $me,
            'viewer_user_id'   => null,
            'viewer_name'      => $data['name'] ?? null,
            'viewer_phone'     => $phone,
            'viewer_email'     => $email,
            'memory_id'        => $memory?->id,
            'property_id'      => $propertyId,
            'assigned_user_id' => $me,
            'assigned_at'      => now(),
            'engagement'       => 1,
            'first_seen_at'    => now(),
            'last_engaged_at'  => now(),
        ]);

        if ($existing && ! $existing->viewer_name && ! empty($data['name'])) {
            $existing->forceFill(['viewer_name' => $data['name']])->save();
        }

        $client = $request->header('X-Stasht-Client') === 'mobile' ? 'mobile' : 'web';
        $senderUser = User::where('external_user_id', $me)->first() ?? $sender;

        try {
            $message = $data['channel'] === 'sms'
                ? $this->delivery->deliverSms($lead, null, $senderUser, $data['body'], null, null, $client, $memory)
                : $this->delivery->deliverEmail($lead, null, $senderUser, $data['subject'] ?: 'Message from ' . ($senderUser->name ?: 'your dealer'), $data['body'], null, null, null, [], $client, $memory);
        } catch (LeadDeliveryException $e) {
            return response()->json(['message' => $e->getMessage(), 'lead_id' => $lead->id], 500);
        }

        return response()->json(['lead_id' => $lead->id, 'created' => ! $existing, 'message_id' => $message->id]);
    }

    /** "+1XXXXXXXXXX" for 10/11-digit North American input; null if unusable. */
    private function normalisePhone(?string $raw): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $raw);
        if (strlen($digits) === 10) {
            return '+1' . $digits;
        }
        if (strlen($digits) === 11 && $digits[0] === '1') {
            return '+' . $digits;
        }
        return strlen($digits) >= 8 ? '+' . $digits : null;
    }

    /** Same variants the inbound-SMS router matches on. */
    private function phoneCandidates(string $e164): array
    {
        $digits = preg_replace('/\D/', '', $e164);
        $ten    = strlen($digits) === 11 && $digits[0] === '1' ? substr($digits, 1) : $digits;
        return array_values(array_unique([$e164, $digits, $ten, '+' . $ten, '+1' . $ten, '1' . $ten]));
    }
}
```

Check the real namespace of `LeadDeliveryException` first: `grep -rn "class LeadDeliveryException" app` and fix the `use` line.

Route (static path — must be registered **before** any `/leads/{lead_id}` POST route):

```php
    Route::post('/leads/start-conversation', \App\Http\Controllers\ReactApi\LeadConversationStartController::class);
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Full regression** — `php vendor/bin/phpunit tests/Feature` and compare the failure list with the one recorded before Task 1: only pre-existing failures allowed.
- [ ] **Step 6: Commit** — `git commit -m "feat(leads): start-conversation (+ Send Message) — direct leads, reuse, opt-out guard"`

---

## After Plan A

- Push `development` (expect 403 from CLI → Deepak pushes via GitHub Desktop).
- Plan B (`admin-portal` mirror: same columns, `LeadAccess`/notifier/intake-free since admin-portal creates no leads, endpoints under the `api` guard with `$user->id` as the external id) and Plan C (Studio inbox, assignee controls, "+ Send Message" dialog, bell items) are written after Plan A lands, using the exact response shapes above.
