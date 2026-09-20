# Lead Detail Full View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 30% lead side-drawer with a full-width lead detail view that matches Chris's Figma design, keeping every existing behavior.

**Architecture:** Keep `LeadDetailDrawer` (props, state, handlers, refs) and restructure only its JSX into header bar + thread column + details column. Extract the new right column (contact + engagement + editable status) into `LeadDetailsSidebar.tsx`. `UsersPage` hides its whole left block (kept mounted) when a lead is selected and gives the lead panel the full width.

**Tech Stack:** React 18 + TypeScript, Tailwind 3, Radix Select (`components/ui/select`), lucide-react, sonner.

Spec: `docs/superpowers/specs/2026-09-20-lead-detail-full-view-design.md`
Design image: `docs/superpowers/specs/assets/lead-detail-chris-design.webp`

## Global Constraints

- Match the design image; deviations only those in spec §6 (Campaigns viewed; extra emoji/via/Retry; email as link; refresh icon; no Notes card).
- No backend/API change. No new dependency.
- Do not change any handler, ref, idempotency key, or effect in `LeadDetailDrawer` — JSX/class changes only (plus the one new local state-free helper imports).
- Notes card is NOT built.
- Studio has no test runner: verification = mocked-network harness + `npx tsc --noEmit` (filtered to touched files) + `npm run build:prod` on Node 20.3.1 (`nvm use 20.3.1`).
- Harness files `scratch-*.tsx|html` are temporary and must never be committed.
- Commit on the standing `development` branch; end commit messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Body text sizes follow the design (~12px, `text-xs`) for the thread; keep `text-gray-600` or darker for small text (a11y pass).

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `components/LeadDetailsSidebar.tsx` | Create | Status types/styles/chip, right column: Contact Details + editable Status + Engagement |
| `components/LeadDetailDrawer.tsx` | Modify | Header bar, two-column shell, thread restyle, composer restyle |
| `pages/UsersPage.tsx` | Modify (~L1386, L1393, L2740) | Full-view swap for a selected lead |

---

### Task 1: `LeadDetailsSidebar` + shared status pieces

**Files:**
- Create: `components/LeadDetailsSidebar.tsx`

**Interfaces:**
- Produces: `export type LeadStatus`, `export const STATUS_STYLES`, `export function StatusChip({ status })`, default export `LeadDetailsSidebar(props: LeadDetailsSidebarProps)` where
  `LeadDetailsSidebarProps = { lead: Lead; leadName: string; initials: string; lastEngaged: string; daysAsLead: number; currentStatus: LeadStatus | null; isUpdatingStatus: boolean; onStatusChange: (val: string) => void }`

- [ ] **Step 1: Create the file**

```tsx
import { MapPin, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import type { Lead } from '../services/leadsAPI';

export type LeadStatus = 'hot' | 'warm' | 'cold' | 'visited' | 'sold';

export const STATUS_STYLES: Record<LeadStatus, string> = {
  hot: 'bg-red-100 text-red-600 border-red-200',
  warm: 'bg-orange-100 text-orange-500 border-orange-200',
  cold: 'bg-blue-100 text-blue-500 border-blue-200',
  visited: 'bg-purple-100 text-purple-600 border-purple-200',
  sold: 'bg-green-100 text-green-600 border-green-200',
};

function StatusLabel({ status }: { status: LeadStatus }) {
  switch (status) {
    case 'hot': return <span className="flex items-center gap-1"><img src="/hot-icon.svg" alt="" className="w-3 h-3.5" />Hot</span>;
    case 'warm': return <span className="flex items-center gap-1"><img src="/warm-icon.svg" alt="" className="w-2 h-3.5" />Warm</span>;
    case 'cold': return <span className="flex items-center gap-1"><img src="/cold-icon.svg" alt="" className="w-3.5 h-3.5" />Cold</span>;
    case 'visited': return <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Visited</span>;
    case 'sold': return <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span>;
  }
}

// Read-only status pill — the header breadcrumb's "Hot" chip in the design.
export function StatusChip({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-md border text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      <StatusLabel status={status} />
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-600">{label}</p>
      <div className="mt-0.5 text-xs text-gray-900 break-words">{children}</div>
    </div>
  );
}

interface LeadDetailsSidebarProps {
  lead: Lead;
  leadName: string;
  initials: string;
  lastEngaged: string;
  daysAsLead: number;
  currentStatus: LeadStatus | null;
  isUpdatingStatus: boolean;
  onStatusChange: (val: string) => void;
}

// Right-hand column of the lead detail view: Contact Details + Engagement.
// Presentational only — all state/handlers live in LeadDetailDrawer.
export default function LeadDetailsSidebar({
  lead, leadName, initials, lastEngaged, daysAsLead, currentStatus, isUpdatingStatus, onStatusChange,
}: LeadDetailsSidebarProps) {
  const email = lead.user?.email;
  const phone = lead.user?.phone_number || lead.user?.phone;
  const location = lead.user?.location || [lead.user?.city, lead.user?.country].filter(Boolean).join(', ');

  return (
    <div>
      <section className="p-4">
        <h3 className="text-xs font-bold text-gray-900">Contact Details</h3>

        <div className="mt-3 flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={lead.user?.profile_image} alt={leadName} />
            <AvatarFallback className="bg-[#6C60FF] text-white text-[11px] font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{leadName}</p>
            <p className="text-[10px] text-gray-600 truncate">Via: {lead.story.title}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {email && (
            <Field label="Email">
              <a href={`mailto:${email}`} className="hover:text-[#6C60FF] hover:underline">{email}</a>
            </Field>
          )}
          {phone && (
            <Field label="Phone">
              <a href={`tel:${phone}`} className="hover:text-[#6C60FF] hover:underline">{phone}</a>
            </Field>
          )}
          {location && <Field label="Location">{location}</Field>}
          <Field label="Last engaged">{lastEngaged}</Field>
          <Field label="Status">
            <Select
              value={currentStatus ?? 'none'}
              disabled={isUpdatingStatus || lead.is_rollup}
              onValueChange={onStatusChange}
            >
              <SelectTrigger
                aria-label="Lead status"
                className={`h-5 text-[11px] font-semibold rounded-md px-2 w-auto min-w-[60px] gap-1 border shadow-none focus:ring-0 focus:outline-none outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-1 ${
                  currentStatus ? STATUS_STYLES[currentStatus] : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {currentStatus ? <StatusLabel status={currentStatus} /> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Set status</SelectItem>
                <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" alt="" className="w-3 h-3.5" />Hot</span></SelectItem>
                <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" alt="" className="w-2 h-3.5" />Warm</span></SelectItem>
                <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" alt="" className="w-3.5 h-3.5" />Cold</span></SelectItem>
                <SelectSeparator />
                <SelectItem value="visited"><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span></SelectItem>
                <SelectItem value="sold"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span></SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="p-4 border-t border-gray-200">
        <h3 className="text-xs font-bold text-gray-900">Engagement</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { value: lead.engagement, label: 'Campaigns viewed' },
            { value: lead.sent_count ?? 0, label: 'Messages sent' },
            { value: `${daysAsLead}d`, label: 'Days as lead' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-100 rounded-lg px-2 py-2.5 text-center">
              <div className="text-base font-bold text-gray-900">{s.value}</div>
              <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "LeadDetailsSidebar"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/LeadDetailsSidebar.tsx
git commit -m "feat(leads): LeadDetailsSidebar — contact, editable status, engagement (Chris design)"
```

---

### Task 2: Two-column shell + header bar in `LeadDetailDrawer`

**Files:**
- Modify: `components/LeadDetailDrawer.tsx` (imports L1-11; STATUS_STYLES L13-19; return block L650-895; close of shell ~L1294)

**Interfaces:**
- Consumes: `StatusChip`, `STATUS_STYLES` is no longer needed locally → remove local const; import `LeadDetailsSidebar, { StatusChip }` from `./LeadDetailsSidebar`.

- [ ] **Step 1: Imports.** Add `ChevronLeft` to the lucide import; remove now-unused `Select*` imports and `STATUS_STYLES` const (verify with `grep -n "STATUS_STYLES\|<Select" components/LeadDetailDrawer.tsx` afterwards); add `import LeadDetailsSidebar, { StatusChip } from './LeadDetailsSidebar';`. Keep `Mail`, `Phone`, `MapPin`, `Clock`, `CheckCircle2`, `Eye` etc. only if still referenced; let `tsc` (noUnusedLocals if enabled) / grep guide removal.

- [ ] **Step 2: Replace the block from `return (` (L650) through the end of the "Profile header" `</div>` (L895)** — i.e. the old avatar/name/status/contact/stats/AI-Email-Call block — with the new shell + header. The correspondence block (old L897-1098) stays but moves inside the left column (Step 3). New opening:

```tsx
  return (
    <div ref={panelRef} {...dialogProps} className="h-full flex flex-col overflow-hidden bg-white">
      {/* Header bar — breadcrumb, AI Suggest, Call, close (Chris design) */}
      <div className="shrink-0 flex items-center justify-between gap-3 h-14 px-4 sm:px-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 min-w-0 text-xs">
          <button
            onClick={onClose}
            className="flex items-center gap-1 shrink-0 text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] rounded"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Leads
          </button>
          <span className="text-gray-400" aria-hidden="true">/</span>
          <h2 id="lead-drawer-title" className="font-semibold text-gray-900 truncate">{leadName}</h2>
          {!lead.user?.id && (
            <span className="flex items-center gap-1 px-2 h-5 rounded-md bg-blue-50 text-blue-500 border border-blue-200 text-[10px] font-medium shrink-0">
              <UserRound className="w-2.5 h-2.5" /> Guest
            </span>
          )}
          {currentStatus && <StatusChip status={currentStatus} />}
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-lg bg-red-500 text-white text-[11px] font-bold shrink-0">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => { if (!lead.is_rollup) setShowAiSuggest((v) => !v); }}
              disabled={lead.is_rollup}
              title={lead.is_rollup ? 'View only — managed by the property owner' : undefined}
              className={`flex items-center justify-center gap-1 h-8 px-3 rounded-lg whitespace-nowrap transition-opacity ${lead.is_rollup ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{
                border: '1.5px solid transparent',
                backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #6C60FF, #FF5FAD)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <Sparkles className="w-3 h-3 shrink-0 text-[#6C60FF]" />
              <span className="bg-gradient-to-r from-[#6C60FF] to-[#FF5FAD] bg-clip-text text-transparent text-xs font-medium">AI Suggest</span>
            </button>

            {showAiSuggest && !lead.is_rollup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAiSuggest(false)} />
                <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] z-50 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[70vh]">
                  {/* ↓ paste the EXISTING panel children unchanged: header, credits banner,
                      Suggested Actions list, footer (old L797-870 inner content) */}
                </div>
              </>
            )}
          </div>

          {(lead.user?.phone_number || lead.user?.phone) && (
            <button
              onClick={() => { const p = lead.user?.phone_number || lead.user?.phone; if (p) window.open(`tel:${p}`); }}
              className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-900 font-medium hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-gray-900" />
              Call
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body: thread column + details column */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="order-2 lg:order-1 flex-1 min-h-0 min-w-0 flex flex-col">
          {/* Correspondence scroller (was `<div key={lead.id} ref={scrollBodyRef} …>`) */}
          <div key={lead.id} ref={scrollBodyRef} className="flex-1 overflow-y-auto">
            {/* ↓ existing "Correspondence" block goes here (Step 3 restyles its header) */}
          </div>
          {/* ↓ existing compose box goes here (Task 4) */}
        </div>

        <aside className="order-1 lg:order-2 shrink-0 lg:w-[342px] max-h-[40vh] lg:max-h-none overflow-y-auto border-b lg:border-b-0 lg:border-l border-gray-200">
          <LeadDetailsSidebar
            lead={lead}
            leadName={leadName}
            initials={getInitials(leadName)}
            lastEngaged={getTimeAgo(lead.last_engaged_at)}
            daysAsLead={daysAsLead}
            currentStatus={currentStatus}
            isUpdatingStatus={isUpdatingStatus}
            onStatusChange={handleStatusChange}
          />
        </aside>
      </div>

      <ShareCarsDialog … />   {/* unchanged, keep at the end inside the root div */}
    </div>
  );
```

  The AI Suggest panel's inner JSX (old L797-870) is moved verbatim — do not edit it.

- [ ] **Step 3: Correspondence header restyle.** In the moved Correspondence block change the heading paragraph to `text-xs font-bold text-gray-900` (drop `uppercase tracking-wider text-[11px] font-semibold`); wrapper padding `px-4 sm:px-6 pt-4`; search button and Refresh become icon buttons of the same size: replace the text "Refresh" button with

```tsx
<button
  onClick={() => fetchMessages(lead.id)}
  disabled={isLoadingMessages}
  aria-label="Refresh messages"
  title="Refresh"
  className="h-6 w-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-[#6C60FF] hover:border-[#6C60FF] disabled:opacity-40 transition-colors"
>
  <RefreshCw className={`w-3 h-3 ${isLoadingMessages ? 'animate-spin' : ''}`} />
</button>
```

- [ ] **Step 4: Type-check + grep for leftovers**

Run: `npx tsc --noEmit 2>&1 | grep -E "LeadDetail"` → no output.
Run: `grep -n "STATUS_STYLES\|<Select" components/LeadDetailDrawer.tsx` → no output.

- [ ] **Step 5: Commit**

```bash
git add components/LeadDetailDrawer.tsx
git commit -m "feat(leads): full-view shell — header bar, thread column, details column"
```

---

### Task 3: Thread restyle to match the design

**Files:**
- Modify: `components/LeadDetailDrawer.tsx` (`renderMessage`, comment rows)

- [ ] **Step 1: Incoming message** — in `renderMessage`'s incoming branch: avatar `h-9 w-9` → `h-8 w-8`; **delete** the channel-badge `<div className="absolute -bottom-1 …">…</div>`; name line becomes

```tsx
<span className="text-xs font-semibold text-gray-900">
  {firstName}
  <span className="font-normal text-gray-600"> via {channelLabel}</span>
</span>
```
bubble: `bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5` keep; body `<p className="text-xs text-gray-700 leading-relaxed">`; subject `text-xs font-semibold text-gray-900`; "Reply" link keep (`text-xs text-[#6C60FF]`). Wrapper padding `py-4` → `py-3`.

- [ ] **Step 2: Outgoing message** — header row becomes `date · via Channel · You · avatar`:

```tsx
<div className="flex items-center gap-1.5 mb-1">
  <span className="text-xs text-gray-600">{formatShortDate(msg.sent_at)}</span>
  <span className="text-xs text-gray-600">· via {channelLabel}</span>
  <span className="text-xs font-semibold text-gray-900">You</span>
  <Avatar className="h-6 w-6">…unchanged…</Avatar>
</div>
```
Delete the trailing `via {channelLabel} ⌄` footer block (channel now in the header). Bubble body `text-xs`. Subject stays purple `text-xs font-semibold`.

- [ ] **Step 3: Comments** — parent/child comment avatars/bubbles: same treatment (avatar `h-8 w-8`, body `text-xs`), keeping reply boxes and threading untouched.

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "LeadDetail"
git add components/LeadDetailDrawer.tsx
git commit -m "feat(leads): thread bubbles restyled to Chris's design"
```

---

### Task 4: Composer restyle

**Files:**
- Modify: `components/LeadDetailDrawer.tsx` (compose block, old L1101-1285)

- [ ] **Step 1:** Outer container: `border-t border-gray-200 px-4 pt-3 pb-4 bg-white` → `px-4 sm:px-6 pt-2 pb-4 bg-white` (keep the `hidden` conditional). The three replacement-state notes keep `border-t`.

- [ ] **Step 2:** Placeholder → `` `Type a message to ${firstName}...` ``.

- [ ] **Step 3:** Restyle the "+" Share-cars button as the design's pill (same `onClick`, `title`, `aria-label`), placed after the attach button:

```tsx
<button
  onClick={() => setShowShareCars(true)}
  title="Share new cars"
  aria-label="Share new cars"
  className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-purple-50 hover:bg-purple-100 text-[#5A4FE5] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
>
  <Plus className="w-3 h-3" aria-hidden="true" />
  Campaign
</button>
```
Order in the row: 📎 attach → ＋ Campaign → emoji → via select → (ml-auto) Retry → Send.

- [ ] **Step 3b:** Send button → `h-8 px-3 rounded-lg text-xs` with `<Send className="w-3.5 h-3.5" />`; keep `disabled:opacity-50`. Retry button same height (`h-8 px-3 text-xs`). via select → `text-xs py-1`.

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "LeadDetail"
git add components/LeadDetailDrawer.tsx
git commit -m "feat(leads): composer matches design — + Campaign pill, compact send row"
```

---

### Task 5: `UsersPage` full-view swap

**Files:**
- Modify: `pages/UsersPage.tsx` (L1386, L1393, L2740-2742)

- [ ] **Step 1:** After `isPanelOpen` (L1386) add:

```tsx
  // A selected lead takes over the whole page (Chris's full-view design);
  // group / conversation panels keep the 30% side panel.
  const isLeadFullView = activeTab === 'leads' && !!selectedLead;
```

- [ ] **Step 2:** Left block class (L1393):

```tsx
<div className={`transition-all duration-300 ${isLeadFullView ? 'hidden' : isPanelOpen ? 'hidden sm:block sm:w-[70%]' : 'w-full'}`}>
```
`hidden` = `display:none`, so the list stays mounted (filters/search/scroll/pagination survive) but is not focusable or announced.

- [ ] **Step 3:** Right panel wrapper class (L2742):

```tsx
<div className={isLeadFullView
  ? 'fixed inset-0 z-[60] bg-white flex flex-col sm:static sm:inset-auto sm:z-auto sm:flex-1 sm:min-w-0 sm:sticky sm:top-0 sm:h-screen sm:overflow-hidden'
  : 'fixed inset-0 z-[60] bg-white flex flex-col sm:static sm:inset-auto sm:z-auto sm:w-[30%] sm:border-l sm:border-gray-200 sm:sticky sm:top-0 sm:h-screen sm:overflow-hidden'}>
```

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "UsersPage|LeadDetail"
git add pages/UsersPage.tsx
git commit -m "feat(leads): selected lead opens full-width; list stays mounted"
```

---

### Task 6: Verify against the design, fix, ship

**Files:** temporary `scratch-verify.html` / `scratch-verify.tsx` (never committed)

- [ ] **Step 1:** Recreate the mocked harness (same fetch mock as the Share-Cars work: `/messages` returns 2 inbound + 1 outbound email/SMS messages incl. subjects, one comment thread; lead "Rachel Torres", story "Summer Family Reunion 2024", status hot, engagement 14, sent_count 23) mounting `LeadDetailDrawer` inside a `w-full h-screen` container. `preview_start studio-main`.
- [ ] **Step 2:** Screenshot at ~1243×856 (`resize_window` width 1243, height 856) and compare region-by-region with the design image: header bar, breadcrumb/chip, AI Suggest/Call/close, Correspondence heading + icons, incoming/outgoing bubbles, composer row, Contact Details fields, Engagement tiles. Fix spacing/size/color deltas until only spec §6 deviations remain.
- [ ] **Step 3:** Functional pass (via `javascript_tool` + clicks): status change writes through and header chip mirrors it; AI Suggest dropdown opens/closes; Call/mailto links; refresh icon; search toggle; reply box; "+ Campaign" opens ShareCarsDialog; rollup/archived/no-contact composer states (vary the fixture); guest badge.
- [ ] **Step 4:** Widths: 1243, 768, 375 — no horizontal scroll; composer pinned; AI panel fits on 375.
- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep -E "LeadDetail|UsersPage"`; `nvm use 20.3.1 && npm run build:prod`.
- [ ] **Step 6:** Delete scratch files, `git checkout -- dev-dist/sw.js`, stop preview, `git status` clean of scratch, final commit if any fix-ups. Report to the user honestly: verified in mocked harness, not live.
