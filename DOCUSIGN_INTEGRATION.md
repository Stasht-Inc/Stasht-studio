# DocuSign Integration Plan

## Current State

The UI is already built in `pages/MarketplacePage.tsx`:
- Marketplace card for DocuSign exists (lines ~1–224)
- `DocuSignConnectModal` component (lines 225–353) has form fields for Integration Key, Secret Key, Account ID
- "Connect DocuSign" button has **no onClick handler** — does nothing yet
- No backend API calls, no credential storage, no DocuSign SDK wired up

---

## Integration Steps

### Step 1 — DocuSign Developer Account Setup

- Create a free DocuSign Developer account at https://developers.docusign.com
- Go to Admin → Integrations → Apps and Keys
- Click "Add App and Integration Key"
- Set redirect URI to: `https://stasht.app/auth/docusign/callback`
- Enable "Signature" scope and save
- Copy: Integration Key, Secret Key, Account ID

---

### Step 2 — Backend: Store Credentials Securely

**Endpoint:** `POST /api/integrations/docusign/connect`

- Accept `integrationKey`, `secretKey`, `accountId` from the modal form
- Encrypt and store in database (never store in frontend or localStorage)
- Return success/error response to frontend

**Database fields needed:**
```
docusign_integrations table:
- user_id / account_id
- integration_key (encrypted)
- secret_key (encrypted)
- account_id
- access_token (encrypted)
- refresh_token (encrypted)
- token_expires_at
- connected_at
- status (connected | disconnected | error)
```

---

### Step 3 — OAuth 2.0 Auth Code Grant Flow

DocuSign uses standard OAuth 2.0:

1. After credentials saved → redirect user to DocuSign OAuth consent page
2. User logs in and approves permissions
3. DocuSign redirects back to your callback URL with `?code=AUTH_CODE`
4. Backend: `POST /api/integrations/docusign/callback`
   - Exchange auth code for access token + refresh token
   - Store tokens encrypted in database
5. Mark integration as "connected" for that user

**Scopes needed:**
- `signature` — send envelopes and get signature
- `extended` — access additional account info
- `impersonation` — for JWT Grant (optional for server-to-server)

---

### Step 4 — Wire Up the Modal "Connect" Button

**Frontend changes in `pages/MarketplacePage.tsx`:**

- Add state: `integrationKey`, `secretKey`, `accountId`, `isLoading`, `isConnected`
- On "Connect DocuSign" click:
  - Validate all fields filled
  - Call `POST /api/integrations/docusign/connect`
  - On success: start OAuth redirect OR show "Connected" state
  - On error: show error message in modal
- Update marketplace card to show green "Connected" badge when connected
- Add "Disconnect" option for connected state

---

### Step 5 — DocuSign Feature Inside Stories/Memories

Once connected, users can attach documents for signing inside a memory/story:

**UI additions needed:**
- "Attach Document for Signing" button inside the memory/story editor
- Upload PDF → preview with "Send for Signature" action
- Show envelope status badge: `Sent` / `Viewed` / `Signed` / `Declined`

**Backend endpoint:** `POST /api/docusign/envelopes`
- Accept: PDF file, recipient email, recipient name, story/memory ID
- Create envelope via DocuSign API
- Store envelope ID + status in database
- Return envelope URL and status to frontend

**Database fields needed:**
```
docusign_envelopes table:
- id
- user_id
- story_id / memory_id
- envelope_id (from DocuSign)
- document_name
- recipient_email
- recipient_name
- status (created | sent | delivered | signed | declined | voided)
- signed_document_url
- created_at
- updated_at
```

---

### Step 6 — Webhook for Real-Time Status Updates

- Register a DocuSign Connect webhook in their Admin panel
- Point webhook to: `POST /api/docusign/webhook`
- Backend receives events: `envelope-sent`, `envelope-signed`, `envelope-declined`, `envelope-voided`
- Update envelope status in database
- Push real-time update to frontend (via WebSocket or polling)
- Story/memory UI updates the badge automatically

---

## File Locations

| What | Where |
|---|---|
| Marketplace page + DocuSign modal | `pages/MarketplacePage.tsx` (lines 225–353) |
| DocuSign logo | `public/docusign-logo.png` |
| DocuSign icon | `public/docusign-icon.png` |
| Backend API (to be created) | `server/routes/integrations/docusign.ts` |
| Webhook handler (to be created) | `server/routes/docusign/webhook.ts` |
| DB migration (to be created) | `server/migrations/docusign_integrations.sql` |

---

## Effort Summary

| Layer | Status | Work Needed |
|---|---|---|
| Marketplace card UI | Done | Minor — add Connected badge state |
| Connect modal UI | Done | Wire up button, add state, handle loading/error |
| Backend connect endpoint | Not started | Create endpoint + encrypted storage |
| OAuth callback flow | Not started | Auth code exchange, token storage |
| Envelope send feature | Not started | PDF upload + DocuSign API call |
| Status webhook | Not started | Webhook handler + real-time update |
| Database migrations | Not started | 2 new tables |

---

## DocuSign API References

- Developer Portal: https://developers.docusign.com
- OAuth Guide: https://developers.docusign.com/platform/auth/
- eSignature REST API: https://developers.docusign.com/docs/esign-rest-api/
- Webhooks (Connect): https://developers.docusign.com/platform/webhooks/connect/
- Node.js SDK: https://github.com/docusign/docusign-esign-node-client
