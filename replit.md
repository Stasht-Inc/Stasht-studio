# Stasht Studio

A React + TypeScript frontend for the Stasht memory-sharing app.

## Stack

- **Frontend**: React 19, TypeScript, Vite 6
- **UI**: Tailwind CSS, Radix UI, shadcn/ui components
- **Features**: PWA, Stripe payments, Google OAuth, Google Photos import, social sharing OG tags

## Running the frontend

```bash
npm run dev
```

Starts the Vite dev server on port 5173. The workflow is named **Start frontend**.

## Backend

The frontend proxies `/api` requests to a separate PHP/Laravel backend:
- Dev target: `http://localhost/stasht-for-multiple-admins/public`
- Production API: `https://restapi-stasht.wd-projects.online/api/react`

The PHP backend is **not** part of this repo and must be run/hosted separately.

## Environment variables

Copy `.env` and fill in these keys (all prefixed `VITE_`):

| Key | Purpose |
|-----|---------|
| `VITE_GOOGLE_PLACES_API_KEY` | Google Places autocomplete |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google sign-in |
| `VITE_GOOGLE_PICKER_API_KEY` | Google Photos import |
| `VITE_STRIPE_API_URL` | Stripe backend endpoint |
| `VITE_FACEBOOK_APP_ID` | Facebook OAuth |
| `VITE_FACEBOOK_APP_SECRET` | Facebook OAuth |

## Production

```bash
npm run build:prod   # build
npm run server       # serve with OG-tag Node server (server-with-api.js)
```

## User preferences

- Keep existing project structure and stack.
