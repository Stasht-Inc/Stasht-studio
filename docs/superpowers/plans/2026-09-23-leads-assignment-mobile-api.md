# Leads Inbox & Assignment — Mobile API (admin-portal) Plan (Plan B of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the mobile API (`admin-portal`, Passport `api` guard) the same lead assignment rules and endpoints Plan A added to the web API, so the app follow-up release can use them.

**Architecture:** Port Plan A's `LeadAccess`, the assignment endpoints, the start-conversation endpoint, and the index changes. admin-portal creates no leads from customer activity (all intake happens on the web API), so there is no `LeadIntake` here and the only notification is "assigned to you".

**Tech Stack:** Laravel 10, Passport (`api` guard). No local DB and no domain tests — verification is `php -l`, app boot, and `php artisan route:list`.

## Global Constraints

- Repo `Codes/admin-portal`, branch `development`; auto-deploys from `main` — never commit on main. Commit only files this plan touches (the checkout has unrelated `.gitignore`/`composer.lock` edits). Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Identity differences from the web API: the acting user id is `Auth::guard('api')->user()->id` (already the "external" id space); names come from `App\Models\User` by `id`; models `Property`, `PropertyUser`, `Lead`, `Memory` use the default connection, which is the same database the web API reaches as `mysql_stasht` — so the Plan A SQL script covers this app too (no second run).
- Response shapes must equal Plan A's exactly (the app will share parsing with Studio's contract): `assignee {id,name,profile_color}`, `latest_message {body,direction,channel,sender_name,sent_at,attachment_name}`, `can_message`, `can_assign`, `last_activity_at`, `property_id`, `tab_counts {open,closed}`, accept 409 `{message, taken_by:{id,name}}`.
- Push uses `config('services.onesignal.app_id' / 'rest_api_key')` (env `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` — the same new OneSignal app the web API uses), addressed by `include_aliases.external_id`. Missing config → skip silently. Never throws.

## Tasks

### Task 1: `LeadAccess` + model casts/hook
- Create `app/Services/Leads/LeadAccess.php` — identical API to Plan A Task 2 (`teamIds, adminIds, isAdmin, isOnTeam, adminPropertyIds, teamPropertyIds, propertyIdOf, canView, canMessage, canDelete, applyVisibility`). `propertyIdOf()` resolves `lead.property_id`, else `memories.property_id`, else `MIN(memory_property.property_id)` via `DB::table('memory_property')` (no StoreelSendService dependency).
- `app/Models/Lead.php`: casts `assigned_at`, `last_message_at` → datetime.
- `app/Models/LeadMessage.php`: the existing `created` hook stamps `last_message_at` for every message and `last_engaged_at` for inbound (same as Plan A Task 4).
- Verify: `php -l` each file. Commit.

### Task 2: `config/services.php` onesignal + `LeadAssignmentNotifier` (assigned-only)
- Add `'onesignal' => ['app_id' => env('ONESIGNAL_APP_ID'), 'rest_api_key' => env('ONESIGNAL_REST_API_KEY')]` to `config/services.php`.
- Create `app/Services/Leads/LeadAssignmentNotifier.php` with `notifyAssigned(Lead $lead, int $assigneeId, ?int $byUserId): void` → `Notification::create([... 'type' => 'lead_assigned', 'lead_id' => ..., 'read' => 0])` + OneSignal push (external_id alias; on no recipients retry with the user's `device_token` as subscription id), and `displayName(Lead)`. Everything in try/catch + `Log`.
- Verify `php -l`. Commit.

### Task 3: `LeadAssignmentController` (accept / assign / assignable-users) + routes
- Port Plan A Task 5 controller with `Auth::guard('api')->user()->id`, `User::find()` names. Same status codes and shapes.
- Routes in the authenticated leads group of `routes/api.php`: `POST leads/start-conversation` (Task 5), `POST leads/{lead_id}/accept`, `POST leads/{lead_id}/assign`, `GET leads/{lead_id}/assignable-users`.
- Verify `php -l`, `php artisan route:list --path=api/leads`. Commit.

### Task 4: Index + permissions
- `LeadController::index`: validation adds `assigned` (`me|unassigned|\d+`); base query = `(memory_id IS NULL OR memory_id IN memories)` + `applyVisibility`; `assigned` filter; `tab_counts` before the archived filter; default order newest activity (`GREATEST(COALESCE(last_message_at,'1970-01-01'), COALESCE(last_engaged_at,'1970-01-01')) DESC, id DESC`); per-lead `property_id, assignee, latest_message, last_activity_at, can_message, can_assign` (batch-loaded as in Plan A Task 6). Viewer lookups must skip null `viewer_user_id`/`memory_id`.
- Replace both controllers' `ownedLeadOrFail($lead_id)` with `leadOrFail($lead_id, string $ability)` where ability ∈ `view|message|delete`: not visible → 404, lacking ability → 403. Map: `getThread, markRead, markCommentsRead` → view; `sendSms, sendEmail, reply, shareCars, update, archive, aiSuggest` → message; `destroy` → delete.
- `totalUnreadCount`: count over `applyVisibility` leads (non-archived).
- Verify `php -l`, route list, boot. Commit.

### Task 5: `LeadConversationStartController`
- Port Plan A Task 8 verbatim with the `api` guard / `User::find` substitutions and admin-portal's `LeadDeliveryService` (`deliverSms(..., string $client = 'mobile', ?Memory $memory)`, `deliverEmail(... , string $client, ?Memory $memory)`), client `'mobile'`. Check admin-portal's `LeadDeliveryException` namespace with grep before importing.
- Verify `php -l`, route list. Commit.

### Deploy notes (for Deepak)
- Needs the Plan A SQL applied first (same table).
- Add `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` (same values as restapi) to the mobile API `.env`, then `php artisan config:clear`. Without them, assignment still works; only the "assigned to you" push is skipped (the bell notification is still written).
