# Leads inbox, "+ Send Message", and lead assignment — design

**Date:** 2026-09-23
**Requested by:** Chris (Serpa Chrysler), relayed by Deepak
**Reference:** Chris's screenshots of a third-party "Messages" inbox (one row per conversation: Date/Time, Phone, Name, Message Excerpt, Assignee; Open/Closed tabs; "Send a Text" button) and its "Start A New Message" dialog.

## Goal

1. Make the Leads list an inbox: one line per lead, latest message excerpt, assignee.
2. Let a rep start a new SMS or email conversation with anyone ("+ Send Message").
3. Give leads an owner on the dealer's team: admins assign directly; new leads are broadcast to the team and the first rep to accept gets them.

## Decisions (agreed 2026-09-23)

| # | Question | Decision |
|---|---|---|
| 1 | What "accept" means for a new lead | **First to accept wins.** Admin assignment is **immediate** (no accept step). |
| 2 | What a rep sees | **Their assigned leads + unassigned leads on their properties.** Not other reps' leads. Admins see all. |
| 3 | "+ Send Message" to a new contact | **Campaign optional.** No campaign → a *direct lead* on the property, assigned to the sender. |
| 4 | Platforms | **Backend for both APIs now; Studio first; app as a follow-up release.** |
| 5 | Existing leads at rollout | **Backfilled as assigned to their campaign owner** (no flood of "unassigned" alerts). |
| 6 | Property "viewer" members | **Excluded** — no notifications, no leads. |
| 7 | Messaging permission | **Assignee, property admins, and the campaign owner** may message a lead. Supersedes the 2026-08-15 "admin-rollup leads are read-only" decision. |
| 8 | Open / Closed | **Closed = the existing Archive**, renamed in the UI. No new state. |

## Definitions

- **Lead's property** (`leads.property_id`): the dealer the lead belongs to. Resolved when the lead is created: the campaign's `property_id`, else its first `memory_property` pivot row, else the sender's/owner's property (first property where they are owner/admin/rep). Direct leads always carry it.
- **Team of a property:** the property owner (`properties.user_id`) plus `property_users` with role `owner`, `admin` or `rep`.
- **Admin of a property:** the property owner, or a `property_users` row with role `owner` or `admin`.

## 1. Data model

New columns on `leads` (`mysql_stasht`), shipped as a hand-applied SQL script (production `migrate` is broken — see restapi migrations note) plus a matching migration file for local/test DBs:

| Column | Type | Notes |
|---|---|---|
| `property_id` | bigint unsigned, nullable, indexed | Lead's property (see Definitions) |
| `assigned_user_id` | bigint unsigned, nullable, indexed | External user id (same id space as `owner_user_id`) |
| `assigned_at` | timestamp, nullable | |
| `assigned_by_user_id` | bigint unsigned, nullable | Null when claimed via Accept or auto-assigned |

`memory_id` becomes **nullable** (direct leads). The existing `uq_lead (owner_user_id, viewer_user_id, memory_id)` unique key stays; MySQL allows multiple NULLs, and direct-lead de-duplication is done in code (§3).

**Backfill (same script):**
- `property_id` from the campaign (`memories.property_id`, else pivot).
- `assigned_user_id = owner_user_id`, `assigned_at = created_at` for every existing lead.

## 2. Rules

### How a lead gets its assignee
- **Created by outreach → assigned to the sender:** "Share new cars" new campaign sends, campaign invites that create a lead (`addCollaboratorByPhone`), "+ Send Message".
- **Created by the customer → unassigned:** first view of a published campaign, guest photo submission, first reply to an untracked invite (webhook bootstraps).
- **Accept:** `POST /leads/{id}/accept`. Atomic `UPDATE leads SET assigned_user_id = :me, assigned_at = NOW() WHERE id = :id AND assigned_user_id IS NULL`. 0 rows → **409** `{ taken_by: {id, name} }`. Caller must be on the lead's property team.
- **Assign / reassign:** `POST /leads/{id}/assign { user_id }` (or `null` to unassign). Admins only (403 otherwise). Target must be on the team (422 otherwise). Immediate.

### Visibility (leads list, lead detail, messages, counts)
A user sees a lead if **any** of:
- they are the campaign owner (`owner_user_id` — today's rule, kept);
- they are an admin of the lead's property;
- they are the assignee;
- the lead is unassigned **and** they are on the lead's property team.

Existing partial-admin scoping (`partial_admin_email`) keeps working as today and is not widened.

### Messaging / mutations
Allowed for: assignee, admins of the lead's property, campaign owner. Everyone else who can *see* a lead (i.e. a rep looking at an unassigned lead) can only **Accept** it.

## 3. API (web API `stasht-database`, mirrored in `admin-portal`)

- `GET /leads` — adds `assigned=me|unassigned|<user_id>`; applies §2 visibility; each lead gains:
  - `latest_message`: `{ body, direction, channel, sender_name, sent_at, attachment_name }` (null if none)
  - `assignee`: `{ id, name, profile_color }` (null if unassigned)
  - `property_id`, `can_message` (bool), `can_assign` (bool)
  - Default sort: latest activity (latest message `sent_at`, else `last_engaged_at`) desc.
- `POST /leads/{id}/accept`, `POST /leads/{id}/assign` — §2.
- `GET /leads/{id}/assignable-users` — the lead's property team (for the admin dropdown).
- `POST /leads/start-conversation` `{ property_id?, name?, channel: sms|email, phone?, email?, memory_id?, body }`
  - Resolve property (explicit, else the sender's only property; 422 if ambiguous).
  - If a lead on that property already matches the phone (phone-candidate matching, as the webhook does) or email → reuse the most recently engaged one; else create a direct lead (`memory_id` = chosen campaign or null, assigned to sender).
  - Refuse opted-out contacts (422). Send via `LeadDeliveryService` (passes the campaign so its link is Storeel-tokenised). Returns the lead.

### Lead intake (one place that knows a lead is new)
Leads are created in 7 places, 4 via raw `INSERT … ON DUPLICATE KEY UPDATE` (Eloquent events don't fire). All seven call a single `LeadIntake::created($lead, $source, $assignTo)` **only when a row was actually inserted** (for raw inserts: MySQL affected-rows = 1). It sets `property_id` + assignee and dispatches the new-lead notification. Repeat views of a known viewer never notify.

Creation sites (web API): `LeadWebhookController` ×2, `MediaController:902`, `MemoriesController:2919, 5052, 10911, 13860/13904`. `admin-portal` creates no leads today.

## 4. Notifications

Push via OneSignal (existing `LeadPushNotifier` transport, addressing users by external id) **and** a `notifications` row for the Studio bell.

| Event | Recipients | Push data `type` |
|---|---|---|
| New unassigned lead | Every team member | `lead_unassigned` |
| Admin assigns / reassigns | New assignee | `lead_assigned` |
| Customer reply (existing push) | Assignee; whole team if unassigned; campaign owner if no property | `lead_message` (unchanged) |

Opening a stale `lead_unassigned` notification after someone accepted shows the lead as "Taken by <name>" (no Accept button). Push failures never fail the request (existing notifier contract).

## 5. Studio UI

### Leads sub-tab (inbox)
- Header: "Leads" + **+ Send Message** (right).
- Filters: **Assigned to** (Me / Unassigned / a rep — rep option admins only), **Status** (Hot/Warm/Cold), **Search** (name/phone/email).
- Tabs: **Open (n)** / **Closed (n)** — Closed = archived. Stat cards removed.
- Columns: **Date/Time** · **Phone** (email if no phone) · **Name** (+ small status pill; campaign name on hover) · **Message Excerpt** (one line; outbound prefixed "✓ <sender>"; attachments "File: <name>"; unread rows bold) · **Assignee** (avatar + name; unassigned → **Accept** for reps, assign dropdown for admins).
- Row hover actions: Close, Assign (admins), Mark read.
- Row click → existing full lead view. Its details sidebar gains an **Assignee** control (admin dropdown / rep Accept / read-only name).
- Groups and My Conversations sub-tabs: unchanged.

### "+ Send Message" dialog
Name (optional) · SMS/Email toggle · Phone or Email · Campaign (optional; inserts its link) · Message (320-char counter for SMS) · Property picker (only if the user has >1 property) · Cancel / Send. On success opens the lead's thread. Errors (opted out, invalid number, ambiguous property) shown inline.

### Notifications
Bell items for `lead_unassigned` / `lead_assigned` open the lead (Accept shown when applicable).

## 6. App (follow-up release)
Inbox list matching §5, Accept from the push notification and lead screen, "+ Send Message" sheet. Uses the same `admin-portal` endpoints, which ship with the backend release.

## 7. Error handling
| Case | Response |
|---|---|
| Accept on an already-assigned lead | 409 + `taken_by` |
| Assign by non-admin | 403 |
| Assign to someone off the team | 422 |
| Any action on a lead the caller can't see | 404 (don't leak existence) |
| Start conversation: opted-out contact | 422 "This contact has opted out" |
| Start conversation: user has several properties, none given | 422 "Choose a property" |

## 8. Testing & verification
- **Web API** feature tests (real mysql + mysql_stasht, `DatabaseTransactions`): visibility matrix (owner/admin/rep/viewer/stranger × assigned/unassigned); accept race (second accept → 409); assign permissions and team check; start-conversation (new contact, existing-contact reuse, opted-out, campaign link tokenised); intake fires once on insert and not on duplicate-key update; notification fan-out with `Http::fake()` for OneSignal; backfill SQL on a fixture.
- **admin-portal:** no local DB — `php -l`, boot, `route:list`; logic mirrors the tested web API.
- **Studio:** isolated harness renders during build; after Deepak deploys the backend, full check on the local dev server against the live API.

## 9. Rollout
1. SQL script (ALTERs + backfill) applied by hand on the server. Before applying, confirm which physical database(s) hold `leads` for each backend (web API reads it via `mysql_stasht`; admin-portal's `Lead` model uses its default connection) — if they differ, apply to both.
2. Deploy order: web API → admin-portal → Studio zip → app.
3. All work on each repo's `development` branch, pushed; Deepak merges to `main` and deploys.

## Out of scope
- Round-robin / automatic assignment rules.
- Declining a lead, SLAs, or re-broadcast when nobody accepts.
- Quick-link chips beyond the campaign link (Chris's reference had Register/Storefront/Payments).
- Changes to Groups / My Conversations.
