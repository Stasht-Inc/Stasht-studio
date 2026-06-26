# AutoTrader Integration Spec

> Section 1 (Widget Installation & Marketplace) is already implemented.
> This document covers sections 2–6.

---

## 2. AutoTrader Connection

### Authentication
- Secure connection to the dealer's AutoTrader account
- Method: API Key / OAuth / Partner Access (depending on AutoTrader capabilities)
- Credentials required:
  - **Dealer ID** — AutoTrader dealer account number
  - **API Key** — Issued from AutoTrader API Portal
  - **API Secret** — Generated alongside the API Key

### Connection States

| State | Description |
|-------|-------------|
| `not_connected` | No credentials saved, dealer not linked |
| `connecting` | Credentials submitted, awaiting verification |
| `connected` | Successfully authenticated, listings available |
| `error` | Connection failed — invalid credentials or API issue |

---

## 3. Listings Import

### Data Pulled Per Listing

| Field | Description |
|-------|-------------|
| `vehicle_title` | e.g. "2022 BMW X5" |
| `price` | Listed sale price |
| `description` | Full vehicle description |
| `images` | Multiple images per listing |
| `location` | Dealer/vehicle location (optional) |
| `listing_id` | Unique AutoTrader listing identifier |
| `status` | `active` or `inactive` |

### Import Behavior
- Fetch all **active** listings on initial connection
- Sync triggered by:
  - Initial connection
  - Manual refresh (user-initiated)
  - Scheduled sync *(future)*

---

## 4. Listings Display (Within Stasht)

### UI Representation
- View mode: **Grid** or **List** toggle
- Each listing card shows:
  - Image thumbnail
  - Vehicle title
  - Price
  - Short description

### Actions Per Listing
- **Select listing** → add to a Story
- **Preview listing** → view full listing details
- **Refresh listings** → re-sync from AutoTrader

---

## 5. Story Integration

- Users can add vehicle listings directly into a Story
- Listings can be combined with existing photos and videos
- Listings behave as:
  - **Media blocks** — displayed inline like a photo/video
  - **Embedded cards** — structured card with listing details

---

## 6. Sync & Updates

### Listing Sync Rules
- Listings should reflect live updates from AutoTrader:
  - Price changes
  - Status changes (active → inactive)
- Handle edge cases:
  - **Removed listings** — mark as unavailable or remove from Story
  - **Updated content** — overwrite with latest data from AutoTrader

### Sync Triggers
| Trigger | Type |
|---------|------|
| Initial connection | Automatic |
| Manual refresh | User-initiated |
| Scheduled sync | Automatic *(future roadmap)* |

---

## Status Tracker

| Section | Feature | Status |
|---------|---------|--------|
| 1 | Widget in Marketplace + Get Widget modal | ✅ Done |
| 2 | Connection flow UI (modal with credentials) | ✅ Done |
| 2 | Backend authentication & connection states | 🔲 Pending |
| 3 | Listings import from AutoTrader API | 🔲 Pending |
| 4 | Listings display UI in Stasht | 🔲 Pending |
| 5 | Story integration for listings | 🔲 Pending |
| 6 | Sync & update handling | 🔲 Pending |
