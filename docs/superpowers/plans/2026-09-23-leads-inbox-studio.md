# Leads Inbox & Assignment — Studio Plan (Plan C of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Studio side of spec `2026-09-23-leads-inbox-and-assignment-design.md` §5: inbox-style Leads list, assignee controls (Accept / admin assign), "+ Send Message" dialog, and bell notifications that open the lead.

**Architecture:** New focused components under `components/leads/` so the 1,700-line `LeadsTab.tsx` only swaps its Leads-sub-tab table, filters and cards for them. Pure formatting lives in `utils/leadInbox.ts`. API contract = Plan A's response shapes.

**Tech Stack:** React 18 + TS, Tailwind (root font 16px), shadcn `Select`/`Dialog`/`DropdownMenu`/`Avatar`, sonner toasts, `apiRequest` (15s GET cache → use `skipCache` after mutations).

## Global Constraints
- Branch `development`; `git checkout -- dev-dist/sw.js` after running the dev server; delete any `scratch-*` harness files before committing. Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No test runner exists. Verify with `npx tsc --noEmit -p .` (only new errors in touched files matter — the repo has pre-existing ones) plus an isolated harness render (fetch mocked) per component; full check on the local dev server after Deepak deploys the backend.
- Copy: "Open" / "Closed" tabs; "+ Send Message"; "Accept"; "Assigned to"; "Unassigned"; toast on 409: "Already taken by {name}".
- `is_rollup` now means "read-only for you" (backend sets it to `!can_message`); keep using it for read-only gating.

## Tasks

### Task 1: API client + types (`services/leadsAPI.ts`)
- `Lead` gains `property_id?: number|null`, `assignee?: {id:number; name:string|null; profile_color:string|null}|null`, `latest_message?: {body:string; direction:'inbound'|'outbound'; channel:'sms'|'email'|'app'; sender_name:string|null; sent_at:string|null; attachment_name:string|null}|null`, `last_activity_at?: string|null`, `can_message?: boolean`, `can_assign?: boolean`, `can_delete?: boolean`; `story` becomes `LeadStory | null` (direct leads).
- `LeadsResponse.tab_counts?: {open:number; closed:number}`.
- `getLeads` params add `archived?: boolean` and `assigned?: 'me'|'unassigned'|number`; keep the legacy `status==='archived'` mapping.
- New: `acceptLead(id)`, `assignLead(id, userId|null)`, `getAssignableUsers(id)`, `startConversation(payload)`.
- Fix every `lead.story.title` read to tolerate `story === null` (LeadsTab, LeadDetailDrawer, LeadDetailsSidebar, commentary search).

### Task 2: `utils/leadInbox.ts`
- `formatInboxDate(iso)` → `Mon, Sep 21, 2026 4:49 PM`; `inboxExcerpt(lead)` → `{prefix: '✓ Sam'|null, text}` (attachment → `File: name`; none → `—`); `leadPhoneOrEmail(lead)`.

### Task 3: `components/leads/AssigneeControl.tsx`
- Props `{lead, onChanged(lead patch), size?: 'sm'|'md'}`. Renders: assignee avatar (profile_color) + name; unassigned + `can_assign` → Select of team (lazy `getAssignableUsers` on open) incl. "Unassigned"; unassigned + !can_assign → **Accept** button; assigned + can_assign → same Select (reassign). 409 → toast "Already taken by X" and `onChanged({assignee: taken_by, can_message:false, is_rollup:true})`.

### Task 4: `components/leads/LeadsInboxTable.tsx`
- Desktop table columns Date/Time · Phone · Name (+status pill, campaign on hover) · Message Excerpt (bold when unread) · Assignee (AssigneeControl) · ⋯ menu (Close/Reopen, Mark read, Delete when `can_delete`). Mobile: one card per lead with the same data.
- Props: `leads, isLoading, error, emptyAction, selectedLeadId, compact, isClosedTab, onSelect, onArchive, onDelete, onMarkRead, onLeadPatched`.

### Task 5: Wire into `LeadsTab.tsx`
- Leads sub-tab: remove its summary cards (Groups / Conversations keep theirs); add Open (n) / Closed (n) tabs from `tab_counts`; "Assigned to" Select (All / Me / Unassigned / admins: assignees seen in the list); drop "Archived" from the status Select (moved to Closed tab) and map `onFilterChange` to `'archived'` when on Closed; replace table + mobile cards with `LeadsInboxTable`; keep pagination, search, time filter, Message Group, Search Group, Leads Report, refresh.
- New props `openLeadId?: number|null`, `onOpenLeadHandled?()` — after a fetch, select that lead if present; if not visible, toast "This lead is no longer available — someone else accepted it." and clear.

### Task 6: `components/leads/SendMessageDialog.tsx` + LeadsPage button
- Fields per spec §5; property picker from `dashboardAPI.getStoreelMyProperties()` shown only when >1; campaign picker = optional searchable list from the existing campaigns API used by ShareCarsDialog (or plain Select of the user's campaigns); SMS 320-char counter. Submit → `startConversation` → toast → `onSent(leadId)`.
- LeadsPage header: "+ Send Message" button; on sent → bump refresh + set `openLeadId`.

### Task 7: Lead view + notifications
- `LeadDetailsSidebar`: "Assigned to" field with `AssigneeControl`.
- `LeadDetailDrawer`: read-only footer for `is_rollup` becomes "This lead isn't assigned to you." + **Accept** (when `assignee == null`) — on accept, refresh the lead (`onRefreshLead`).
- `NotificationDropdown`: `lead_unassigned` / `lead_assigned` → icon like `lead_message`; click → `onOpenLead(leadId)` → App sets `pendingLeadId` + navigates to leads → LeadsPage → LeadsTab `openLeadId`.

### Verification
- tsc clean for touched files; harness render of LeadsInboxTable (admin row, rep unassigned row with Accept, closed tab), SendMessageDialog, AssigneeControl states; after backend deploy: local dev server against live API (Deepak's session), Open/Closed counts, Accept, assign, + Send Message, bell click.
