# Leads as its own page (sidebar item above Users)

**Date:** 2026-09-21 · **Source:** Chris's feedback on the Lead full view (via Deepak) ·
**Status:** implemented same day (design + plan combined; scope was clear from the request)

## Goal
Move Leads out of the Users page's tab bar into its own top-level page with its own left-sidebar
item **above Users**. All existing Leads functionality must keep working.

## Also in this change
Message thread column gets a light-gray background (`gray-50`) with a bordered header band, and the
composer strip stays white with a soft-shadow card, so the message box stands out (per the design).

## New page: `pages/LeadsPage.tsx`
Owns everything Leads-specific that used to live in `UsersPage`:
- State: selected lead / group / conversation, commentary jump target, status filter, refresh
  trigger, unread breakdown (`GET /leads/unread-count`, refreshed on `leads-unread-count-refresh`).
- Deep link from a `lead_message` notification (`openConversationLeadId` → opens the thread).
- Renders `LeadsTab` (Leads / Groups / My Conversations sub-tabs, stat cards, Leads Report button),
  the full-width `LeadDetailDrawer` view, and the 30% side panels for groups/conversations.
- Header card "Leads" replaces the Users header/stat cards (LeadsTab has its own stat cards).
- Group/conversation side panel now uses `sticky top-20 h-[calc(100dvh-5rem)]` (was `top-0 h-screen`,
  which overshot by the 5rem app header — same bug class fixed for the lead view earlier).

## `UsersPage` after the move
- Tabs: **All Users · Shared with · Properties** (Leads tab removed). Default = **All Users**
  (previously the default was the Leads tab); "All Users" moves to the first position so the
  leftmost tab is the default, as before. `users_open_tab=properties` deep link still works.
- All lead state/effects/panels/imports removed; `openConversationLeadId`/`onConversationOpened`
  props removed. `onViewStoreelReport` stays (Properties tab uses it).

## Navigation wiring
- Sidebar: new **Leads** item directly above **Users** (icon `Target`), carrying the unread badge
  that used to sit on Users. Header content for the item: "Leads / Manage Leads & Conversations".
- Route: page id `leads`, URL `/leads` (URL map, initial-URL detection, no sub-sidebar, same layout
  padding rule as `users`).
- Notification click (`handleOpenConversation`) → `leads`.
- Storeel Report back button → `leads` when opened from the Leads page, `users` (Properties tab) when
  opened from a property row.
- Mobile bottom nav: Leads button added before Users (Users was "visible for all roles", and it used
  to be the way in to Leads on mobile, so Leads is shown for all roles too).

## Decisions made without asking (flag to owner)
1. Leads sidebar item is shown to **all roles including partial admins** (the sidebar hides Users for
   partial admins, but the Leads API is partial-admin aware and mobile nav exposed it to them).
2. Users default tab = All Users, tab order changed accordingly.
3. Leads sidebar item shows only the unread badge (no total count).

## Not in scope
Backend changes; redesign of `LeadsTab` itself; Notes card.

## Verification
Mocked-network harness mounting the real app pieces (Sidebar → LeadsPage / UsersPage): navigation,
list → full view → back, groups/conversations panels, deep-link, Users tabs, mobile nav at 375px;
`tsc` on touched files; `build:prod` (Node 20.3.1).
