# Lead Detail — Full View Redesign

**Date:** 2026-09-20
**Status:** Design approved in chat; awaiting spec review
**Source of truth:** Chris's Figma frame "Stasht Studio – Leads NEW" (1243 × 856), saved at
[`assets/lead-detail-chris-design.webp`](assets/lead-detail-chris-design.webp).
The Figma file is view-only and the Figma connector is not authorized, so all measurements below
are read off the screenshot (approximate, ±2px). **Matching this design is the primary success
criterion**; every functional behavior of today's lead drawer is retained.

## 1. Goal

Replace the current 30%-width right-hand lead drawer with a full-width lead detail view that looks
like Chris's design, without losing any existing functionality. No backend change: this ships as a
Studio-only build.

## 2. Scope

**In scope**
- Full-width Lead detail view for a selected lead (Users → Leads).
- Restyle of header, correspondence thread, composer, contact/engagement column to match the design.

**Out of scope**
- **Notes card** (Notes textarea + Update button in the design). No backend field exists; deferred to
  a follow-up ticket (decided with the user 2026-09-20). The right column simply ends after Engagement.
- Group detail and Conversation panels (`GroupDetailDrawer`, `ConversationDrawer`) — unchanged, still
  the 30% side panel.
- The app shell (left nav, top bar) — unchanged.
- Any backend / API / schema change.

## 3. Where it lives

- `pages/UsersPage.tsx` currently renders the selected lead in a 30% right panel next to the list
  (`{isPanelOpen && …}` block, ~L2735). New behavior: when `selectedLead` is set, the lead view fills
  the main content area **in place of the leads list + panel**. The list stays **mounted but hidden**
  so filters, search text, pagination and scroll position survive "Leads" (back) and close.
- Group / conversation selection keeps the existing side-panel behavior.
- On mobile the panel is already full-screen (`fixed inset-0`); that stays.
- `components/LeadDetailDrawer.tsx` keeps its name, props (`lead, open, onClose, onRefreshLead,
  isArchived, highlightTarget, onTargetHandled, onNavigate`) and **all state/handlers**. Only the JSX
  is restructured (approach A — re-layout in place). The new right-hand column is extracted to a
  presentational `components/LeadDetailsSidebar.tsx` (contact + engagement) so the main file does not
  grow.

## 4. Layout (desktop, ≥ lg)

Detail area = main content region right of the app nav, below the app top bar. Two columns under a
header bar:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ‹ Leads / Rachel Torres [🔥 Hot]                [✦ AI Suggest] [☎ Call] ✕ │  header bar
├──────────────────────────────────────────────────┬────────────────────────┤
│ Correspondence                              🔍 ⟳ │ Contact Details        │
│  (scrolling thread)                              │  avatar  name          │
│                                                  │          Via: …        │
│                                                  │  EMAIL / PHONE /       │
│                                                  │  LOCATION /            │
│                                                  │  LAST ENGAGED / STATUS │
│                                                  │ ────────────────────── │
│ ┌──────────────────────────────────────────────┐ │ Engagement             │
│ │ Type a message to Rachel…                    │ │  [14] [23] [780d]      │
│ │ 📎 ＋Campaign …                     [Send ▷] │ │                        │
│ └──────────────────────────────────────────────┘ │                        │
└──────────────────────────────────────────────────┴────────────────────────┘
```

- **Right column:** fixed ≈ 342px wide, own vertical scroll, left border. **Left column:** flexible
  (≈ 600px in the 1243 frame).
- Header bar bottom border and the column divider are light gray (`gray-200`).
- **< lg (mobile/tablet):** single column. Order: header bar → contact + engagement (compact, as
  today's top block) → thread → composer pinned at bottom.

## 5. Component-by-component

### 5.1 Header bar
- Left: gray chevron-left + "Leads" (gray, clickable → `onClose`), `/` separator, **lead name** (bold,
  ~12–13px), then a **read-only status chip** exactly as in the design (light red bg, red text, flame
  icon, small). Chip variants for warm / cold / visited / sold follow the existing
  `STATUS_STYLES` + icons. No chip when status is unset.
- Unread badge (red count) sits right after the chip, only when `unreadCount > 0` (not in the design
  when 0, so nothing shows).
- Right: **AI Suggest** (existing gradient-border button, sparkle icon, purple→pink gradient text),
  **Call** (outlined, phone icon; only when a phone exists; `tel:` as today), **✕** (gray, existing
  close action with `aria-label="Close"`).
- AI Suggest panel: same content, credits banner and actions as today, but anchored as a dropdown
  under the button, right-aligned, ~340px wide (fixed positioning with the existing click-away
  overlay). `is_rollup` disabling and tooltip unchanged.

### 5.2 Correspondence column
- Heading "Correspondence" — sentence case, bold, ~12px (design), not the current uppercase
  tracking style. Right side: search icon button (design) and a small **refresh icon button**
  (**addition** — the design omits it; kept so manual refresh is not lost; same size/style as the
  search icon).
- Search input, when open, appears under the heading as today.
- "Viewed" row: eye icon + `{firstName} viewed "{story title}"` + date, unchanged content.
- **Incoming message:** 32px circular avatar, `Name` bold + `via Email|SMS` muted, date right-aligned
  (muted); subject (bold) above; body in a light-gray rounded bubble; **Reply** as a small purple text
  link under the bubble.
- **Outgoing message:** right-aligned; "`Sep 7  You (avatar)`" header; `Re: {subject}` in small
  purple text; body in a **purple** rounded bubble with white text.
- Comments, threaded replies, inline reply boxes, attachments, highlight-on-jump (Search Group) keep
  their current behavior and get the same bubble/avatar styling.
- The thread scrolls independently; the composer stays pinned to the bottom of the column.

### 5.3 Composer
- Rounded bordered white card. Placeholder **"Type a message to {firstName}…"** (design wording).
- Bottom row, left → right: 📎 attach icon, **"＋ Campaign"** pill (light-purple, purple text — this
  is the existing **Share New Cars** button restyled to the design's pill; behavior and
  `ShareCarsDialog` unchanged; keeps `aria-label`/title "Share new cars"), then the existing **emoji**
  and **via Email/SMS** controls (**kept although not in the design** — needed to pick a channel;
  styled small/quiet so the row still reads like the design), Retry (only after an AI draft), and
  **Send** (right-aligned, purple, paper-plane icon; light/disabled look when `!canSend`, per design).
- SMS character counter, attachment chips, idempotency keys (separate SMS / Email / reply refs),
  Enter-to-send, 2 MB attachment limit: unchanged.
- Replacement states unchanged: rollup ("View only…"), archived, no-contact — each fully replaces the
  composer.

### 5.4 Right column — `LeadDetailsSidebar`
- **Contact Details** heading (bold). Then avatar (~32px) + name (bold) + `Via: {story title}`
  (muted, small).
- Labeled fields — tiny uppercase gray label over the value: **EMAIL**, **PHONE**, **LOCATION**,
  **LAST ENGAGED** (`getTimeAgo`), **STATUS**. Rows are omitted when the value is missing (same
  rule as today) except LAST ENGAGED and STATUS.
- **Email** value is a `mailto:` link and **Phone** a `tel:` link — this replaces the old Email
  button so the visual matches the design without losing the action.
- **STATUS** is the **editable** control: the existing Select (Hot / Warm / Cold / Visited / Sold /
  Set status), with the same `updateStatus` behavior, styled as the design's chip plus a small caret.
  The header chip is read-only and mirrors it.
- Divider, then **Engagement** heading and three stat tiles (light-gray rounded tiles, bold number,
  tiny centered label): **Campaigns viewed**, **Messages sent**, **Days as lead**.

## 6. Copy — where we differ from the mock

| Design text | We use | Why |
|---|---|---|
| "Stories viewed" | **Campaigns viewed** | Studio calls these Campaigns everywhere (sidebar, search, current stat). Changing one screen would be inconsistent. Trivial to flip if Chris wants "Stories". |
| Composer: paperclip + "+ Campaign" only | + emoji, via Email/SMS, Retry | Functional controls the design omits. |
| Header: AI Suggest + Call only | Email becomes a link on the address | Keeps `mailto:` without adding a button the design lacks. |
| Correspondence: search icon only | + refresh icon | Manual refresh retained. |
| Notes card | Not built | No backend; follow-up. |

All other copy follows the design.

## 7. Behavior preserved (regression checklist)

Status update (with revert on failure) · unread count + close refresh (`leads-unread-count-refresh`)
· AI Suggest actions, credit banner + Buy → billing, Retry (free) · send Email/SMS with separate
idempotency keys · attachments (image/PDF ≤ 2 MB, email only) · emoji · SMS counter · Enter-to-send ·
Share New Cars dialog · reply to message / comment (threaded) · message search + highlight-jump from
Search Group (`highlightTarget`) · guest leads (no contact info) · rollup (read-only) · archived ·
mobile layout · Escape / focus-trap / `aria-labelledby` (`useDialogBehavior`) · a11y label + contrast
fixes from the recent a11y pass.

## 8. Verification

Studio login is OTP-only, so verify in a throwaway mocked-network harness (deleted before commit,
same technique as the Share-Cars work):
- **Visual match:** render at the design's proportions (≈ 1243-wide viewport) and compare against a
  crop of the design image for header, both columns, bubbles, composer, right column. Iterate until
  the differences are limited to the documented deviations in §6.
- Functional pass for each item in §7 that the harness can exercise (status change, AI panel,
  composer states, reply, search, share cars).
- Widths: desktop, tablet, mobile (375).
- `npx tsc --noEmit` on touched files; `npm run build:prod` on Node 20.3.1.
- Cannot verify against live data/session from this environment — state that when reporting.

## 9. Risks

- **Screenshot-only spec:** exact spacing/colors are approximations; mitigated by the side-by-side
  comparison and by asking for Figma access (or Dev Mode values) if a pixel-level pass is wanted.
- **Regression in a 1,300-line stateful component:** mitigated by changing JSX/layout only and
  keeping every handler and ref as-is.
- **List-hidden-not-unmounted** in `UsersPage` must not leave the hidden list receiving focus
  (use `hidden` + `inert`/`aria-hidden`).
