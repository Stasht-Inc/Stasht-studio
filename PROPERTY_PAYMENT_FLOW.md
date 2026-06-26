# Property Payment Flow — Implementation Plan

## Overview
$2 charge per property creation via Stripe. Internal users (`is_internal: true` from login API) skip payment entirely.

---

## Auth Change
- Add `is_internal?: boolean` to `User` interface in `contexts/AuthContext.tsx`
- Extract `is_internal` from login API response in `utils/authUtils.ts` and store it in the user object in localStorage

---

## New API Functions (utils/authUtils.ts)

### `dashboardAPI.purchaseProperty(data)`
- Flow 1: `POST /api/react/billing/purchase-property` — multipart/form-data with property fields
- Flow 2 step 2: `POST /api/react/billing/purchase-property` — JSON with `{ quantity: 1, property_id }`
- Returns: `{ client_secret, payment_intent_id, amount, currency }`

### `dashboardAPI.confirmPropertyPayment(paymentIntentId)`
- `POST /api/react/billing/confirm-property-payment`
- Body: `{ payment_intent_id }`
- Returns: `{ status, message, data: { property } }`

---

## New Component: `components/PropertyPaymentModal.tsx`
Stripe payment modal shown after form submission for non-internal users.

**Props:**
- `isOpen`, `onClose`
- `clientSecret` — from `purchaseProperty` response
- `paymentIntentId`
- `propertyName`
- `onPayNowSuccess(propertyId)` — called after Stripe confirms + backend confirms
- `onPayLater()` — called when user skips payment

**Inside:**
- Wrapped in `<Elements stripe={stripePromise} options={{ clientSecret }}>`
- Stripe `CardElement` for card input
- "Pay $2 & Create Property" → `stripe.confirmCardPayment(clientSecret)` → `confirmPropertyPayment` → calls `onPayNowSuccess(propertyId)`
- "Create & Pay Later" → calls `onPayLater()`
- Shows price: $2.00

---

## Modified: `pages/UsersPage.tsx` — `handleCreateProperty`

### New state
```
propertyPaymentModal: { clientSecret, paymentIntentId, formData: PropertyFormData } | null
```

### Logic
```
handleCreateProperty(propertyData):
  if user.is_internal === true:
    → existing flow: call createProperty(formData), refresh, done

  else:
    → call purchaseProperty(formData as multipart)
    → get { client_secret, payment_intent_id }
    → set propertyPaymentModal state (keep CreatePropertyModal open or close it)
    → open PropertyPaymentModal
```

### On Pay Now (Flow 1)
```
handlePropertyPayNow(propertyId):
  → call createPropertyInviteLink(propertyId)  ← this activates the property
  → refresh properties
  → toast "Property created and activated"
  → close all modals
```

### On Pay Later (Flow 2)
```
handlePropertyPayLater():
  → rebuild FormData from stored propertyData
  → call createProperty(formData)
  → refresh properties
  → toast "Property added – payment pending"
  → close all modals
```

---

## Flow Summary

| User type | Button clicked | API calls |
|-----------|---------------|-----------|
| `is_internal: true` | Add Property | `POST /properties` → done |
| Regular user | Pay $2 & Create | `POST /billing/purchase-property` (multipart) → Stripe confirmCardPayment → `POST /billing/confirm-property-payment` → `GET /properties/{id}/invite-link` |
| Regular user | Create & Pay Later | `POST /billing/purchase-property` (multipart) to get intent → then `POST /properties` (direct) |

> Note: After "Pay Now" flow, property status = inactive until invite-link is called, which flips it to active.

---

## Files to Change
1. `contexts/AuthContext.tsx` — add `is_internal` to User interface
2. `utils/authUtils.ts` — extract `is_internal` from login response, add `purchaseProperty` + `confirmPropertyPayment`
3. `components/PropertyPaymentModal.tsx` — NEW component
4. `pages/UsersPage.tsx` — update `handleCreateProperty`, add new state + handlers
