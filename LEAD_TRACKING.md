# Lead Tracking Feature — Implementation Spec

## Overview

When a logged-in user views a shared/published story owned by someone else, they are automatically tracked as a **lead** for that story owner. Each story the viewer opens creates its own row in the leads table. The owner can view all leads, filter by status, and manually classify each lead as Hot / Warm / Cold.

---

## UI Location
**UsersPage.tsx** — New "Leads" tab alongside: All Users | **Leads** | Contributors | Shared with | Properties

---

## Page Layout

### Top Bar
- Search input: "Search users or emails..."
- Status filter dropdown: All / Hot / Warm / Cold
- Clear button
- Lead count label: `X of Y leads`

### Table Columns

| Column | Description |
|--------|-------------|
| **Lead** | Avatar + Name + Email |
| **Story** | Title of the specific story this row represents |
| **Status** | Empty by default. Dropdown: Hot 🔥 / Warm 🌡️ / Cold ❄️ |
| **Engagement** | Number of times this viewer opened this specific story |
| **Messages** | Total chat message count + unread red badge |
| **Last Engaged** | Relative time (e.g., "20 months ago") since last view of this story |
| **First Seen** | Absolute date (e.g., "Aug 1, 2024") of first view of this story |
| **Actions** | `...` three-dot menu (future: delete, message, etc.) |

---

## Status Values

| Value | Badge Color | Icon |
|-------|-------------|------|
| `null` | — | Empty dropdown (not set) |
| `hot` | Red/Orange | 🔥 Hot |
| `warm` | Orange/Yellow | 🌡️ Warm |
| `cold` | Blue | ❄️ Cold |

---

## Backend API Spec

### 1. GET `/leads`

Fetch all leads for the authenticated owner. Returns **one entry per (viewer, story) pair** — if a viewer has seen 3 stories, they appear as 3 rows.

**Query Parameters:**
```
?search=<string>         // filter by name or email (optional)
?status=hot|warm|cold    // filter by status (optional)
```

**Response:**
```json
{
  "total": 9,
  "leads": [
    {
      "id": 1,
      "user": {
        "id": 101,
        "name": "Rachel Torres",
        "email": "rachel.torres@gmail.com",
        "profile_image": "https://..."
      },
      "story": {
        "id": 55,
        "title": "Summer Family Reunion 2024"
      },
      "status": null,
      "engagement": 7,
      "messages_count": 23,
      "unread_messages_count": 2,
      "last_engaged_at": "2024-08-01T10:00:00Z",
      "first_seen_at": "2024-08-01T10:00:00Z"
    }
  ]
}
```

**Rules:**
- Only return leads where `owner = currently authenticated user`
- One entry per (viewer_user_id, memory_id) pair
- `engagement` = total number of times that viewer opened that specific story
- `status` = per (viewer, story) row — each story row has its own status
- `last_engaged_at` = updated every time viewer opens this specific story
- `first_seen_at` = set once on first view of this story, never updated again
- Owner must **not** appear as their own lead

---

### 2. PATCH `/leads/{lead_id}`

Update the status of a specific lead row.

**Request Body:**
```json
{
  "status": "hot"
}
```

**Allowed values:** `"hot"` | `"warm"` | `"cold"` | `null` (null = clear/reset to empty)

**Response:**
```json
{
  "id": 1,
  "status": "hot"
}
```

---

### 3. Auto-Create / Update Lead on Story View (Backend Logic — No Frontend Call)

Triggered automatically when a **logged-in user** opens a **shared or published story**.

**Logic:**
```
IF viewer_user_id == owner_user_id → skip (owner is not their own lead)

IF lead record does NOT exist for (owner_id, viewer_user_id, memory_id):
  → CREATE lead with:
       first_seen_at  = now
       last_engaged_at = now
       memory_id      = this story's id
       status         = null
       engagement     = 1

IF lead record ALREADY EXISTS for (owner_id, viewer_user_id, memory_id):
  → UPDATE last_engaged_at = now
  → INCREMENT engagement by 1
```

---

## Database Table

```sql
leads (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  owner_user_id     INT NOT NULL,       -- story owner
  viewer_user_id    INT NOT NULL,       -- person who viewed
  memory_id         INT NOT NULL,       -- the specific story this row tracks
  status            ENUM('hot','warm','cold') NULL DEFAULT NULL,
  engagement        INT DEFAULT 1,      -- view count for this story by this viewer
  last_engaged_at   TIMESTAMP,
  first_seen_at     TIMESTAMP,
  created_at        TIMESTAMP,
  updated_at        TIMESTAMP,
  UNIQUE KEY (owner_user_id, viewer_user_id, memory_id)  -- one row per viewer+story
)
```

> No separate `lead_viewed_memories` table needed — each row in `leads` IS a (viewer, story) pair.

---

## Messages Column

- Uses the **existing direct chat/message system** between users
- `messages_count` = total messages exchanged between owner and this lead user
- `unread_messages_count` = messages received from this lead user that owner has not read
- Shown as: message icon + count + red badge if unread > 0
- Same message counts are shared across all rows of the same viewer (since messages are per user, not per story)

---

## Frontend Files to Create/Modify

| File | Action |
|------|--------|
| `pages/UsersPage.tsx` | Add "Leads" tab + render LeadsTab component |
| `components/LeadsTab.tsx` | New component — full leads table UI |
| `services/leadsAPI.ts` | New file — API calls for GET /leads and PATCH /leads/{id} |

---

## Frontend Component Logic

### LeadsTab.tsx
- On mount: call `GET /leads` → populate table
- Search input: debounce 300ms → re-call `GET /leads?search=...`
- Status filter dropdown → re-call `GET /leads?status=...`
- Clear button → reset search + status filter
- Status dropdown per row → call `PATCH /leads/{id}` on change → update row in state
- `last_engaged_at` displayed as relative time (e.g., "20 months ago")
- `first_seen_at` displayed as absolute date (e.g., "Aug 1, 2024")
- Same viewer can appear in multiple rows (one per story they viewed)

---

## Status Badge Colors (Tailwind)

```
hot  → bg-red-100 text-red-600 border border-red-200
warm → bg-orange-100 text-orange-500 border border-orange-200
cold → bg-blue-100 text-blue-500 border border-blue-200
null → show dropdown with placeholder "Set status"
```
