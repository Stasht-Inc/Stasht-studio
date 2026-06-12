# Admin Login Choice Feature - Requirements Document

## Overview
When a user is invited as an Admin to another user's account and they sign up/login, they should see a choice screen to select which account they want to access.

---

## User Flow

### Scenario Example:
1. **Tarush1** (existing user) invites **Tarush2** as Admin using the Invite Modal
2. System calls `POST /react-api/memories/add-account-admin` with `{ collaborators: [{ email: "tarush2@email.com" }] }`
3. **Tarush2** receives an invitation/signup email
4. **Tarush2** clicks the link and signs up
5. **Signup response** contains `collaborators` array with `role: "admin"`
6. **Tarush2** receives activation email → clicks activation link
7. After activation, check stored collaborators from signup
8. If any collaborator has `role: "admin"`, show **Choice Screen**:
   - **"Login as Tarush1"** → Access Tarush1's data/memories (admin privileges)
   - **"Login as Personal"** → Access Tarush2's own data/memories

---

## Technical Requirements

### 1. Collaborator Array Structure ✅ CONFIRMED
```json
{
  "collaborators": [
    {
      "owner_id": "123",      // Tarush1's ID (account owner who invited)
      "memory_id": null,      // null for admin role
      "role": "admin",        // Check for this value
      "user_id": "456"        // Tarush2's ID (the invited user)
    }
  ]
}
```

### 2. Where Collaborators Array Comes From
- **Signup Response** → Contains `collaborators` array
- **Login Response** → Contains `collaborators` array
- **Activation Response** → May NOT contain `collaborators` (need to store from signup)

### 3. Implementation Flow

#### A. SIGNUP FLOW (Email Method):
1. User fills signup form → Submit
2. `SignupPage.tsx` calls `authAPI.register()` (via `onSignup` prop)
3. **NEW:** Check if response contains `collaborators` array
4. **NEW:** If admin role exists, store `collaborators` in localStorage
5. User sees "Check your email" message
6. User clicks activation link → `AccountActivationPage.tsx` loads
7. `authAPI.activateAccount(token)` is called
8. **NEW:** After activation success, check localStorage for stored collaborators
9. **NEW:** If admin role exists → Show `AccountChoiceModal`
10. User clicks option → Either call `loginAsAdmin` API or continue normal flow

#### B. LOGIN FLOW:
1. User logs in → `LoginPage.tsx` calls `authAPI.login()`
2. Response contains `collaborators` array
3. **NEW:** Check if any collaborator has `role === "admin"`
4. **NEW:** If yes → Show `AccountChoiceModal` instead of reloading
5. User clicks option → Either call `loginAsAdmin` API or continue normal flow

---

### 4. APIs Required

#### A. Login/Signup Response Structure ✅ CONFIRMED
```json
{
  "success": true,
  "user": { ... },
  "token": "...",
  "collaborators": [
    {
      "owner_id": "123",
      "memory_id": null,
      "role": "admin",
      "user_id": "456"
    }
  ]
}
```

#### B. Login as Admin API ✅ FULLY CONFIRMED
```
POST /react-api/login-as-admin
Body: { owner_id: "<owner_id from collaborator>" }

Response:
{
  "data": {
    "user": {
      "id": 123,
      "external_user_id": "...",
      "name": "Tarush1",           // Owner's name
      "email": "tarush1@email.com", // Owner's email
      "phone_number": "...",
      "phone_verified": true,
      "role": "...",
      "admin_id": "...",
      "avatar": "...",
      "status": "...",
      "profile_color": "...",
      "created_at": "...",
      "change_password": false
    },
    "token": "<new_access_token>",  // New token for owner's account
    "token_type": "Bearer",
    "expires_at": "..."
  }
}
```

**What happens:**
- Returns owner's user data (Tarush1's data)
- Returns a new token for the owner's account
- Frontend replaces localStorage user/token with owner's data
- User now sees owner's memories/data

---

## Implementation Checklist

### Phase 1: Setup ✅ COMPLETED
- [x] Get collaborators array structure from login/signup response
- [x] Get "Login as Admin" API endpoint details
- [x] Identify which files handle login/signup redirect
- [x] Understand device verification flow
- [x] Understand account switching requirement

### Phase 2: Implementation
- [ ] Add `loginAsAdmin` API function to `authUtils.ts`
- [ ] Create `AccountChoiceModal.tsx` component
- [ ] Update `SignupPage.tsx`:
  - [ ] Store collaborators in localStorage after signup (for email activation flow)
  - [ ] Check collaborators after OTP verification (for phone flow)
  - [ ] Show AccountChoiceModal if admin role exists
- [ ] Update `AccountActivationPage.tsx`:
  - [ ] Check stored collaborators after activation
  - [ ] Show AccountChoiceModal if admin role exists
- [ ] Update `LoginPage.tsx`:
  - [ ] Check collaborators after login
  - [ ] Check collaborators after device verification
  - [ ] Show AccountChoiceModal if admin role exists
- [ ] Handle "Login as Admin" click:
  - [ ] Call loginAsAdmin API
  - [ ] Store BOTH accounts in admin_switch_data
  - [ ] Set current_mode to "admin"
  - [ ] Redirect to /memories
- [ ] Handle "Login as Personal" click:
  - [ ] Store BOTH accounts in admin_switch_data
  - [ ] Set current_mode to "personal"
  - [ ] Redirect to /memories
- [ ] Update Header component:
  - [ ] Check for admin_switch_data in localStorage
  - [ ] Show "Switch Account" option if has_admin_access = true
  - [ ] Implement switchAccount() function

### Phase 3: Testing
- [ ] Test signup (email) with admin invite → activation → modal appears
- [ ] Test signup (phone) with admin invite → OTP → modal appears
- [ ] Test login with admin collaborator → modal appears
- [ ] Test login with device verification + admin collaborator
- [ ] Test "Login as Admin" button → shows owner's data
- [ ] Test "Login as Personal" button → shows user's own data
- [ ] Test account switching in header (Admin → Personal)
- [ ] Test account switching in header (Personal → Admin)
- [ ] Test user without admin role → no modal, no switch option
- [ ] Test logout clears admin_switch_data

---

## Files to Modify/Create

| File | Action | Changes |
|------|--------|---------|
| `utils/authUtils.ts` | MODIFY | Add `loginAsAdmin()` API function |
| `components/AccountChoiceModal.tsx` | **CREATE** | Modal with two account options |
| `pages/SignupPage.tsx` | MODIFY | Store collaborators, show modal after OTP |
| `pages/AccountActivationPage.tsx` | MODIFY | Check collaborators, show modal after activation |
| `pages/LoginPage.tsx` | MODIFY | Check collaborators, show modal after login/device verify |
| `components/Header.tsx` (or similar) | MODIFY | Add "Switch Account" option in profile dropdown |

---

## Key Code Locations

| File | Line | Description |
|------|------|-------------|
| `SignupPage.tsx` | ~377 | `onSignup()` called - capture collaborators here |
| `SignupPage.tsx` | ~678-721 | Phone OTP verification - check collaborators before reload |
| `AccountActivationPage.tsx` | ~50 | `authAPI.activateAccount(token)` called |
| `AccountActivationPage.tsx` | ~106-108 | Check collaborators before redirect to `/memories` |
| `LoginPage.tsx` | ~386-390 | `authAPI.login()` called - capture collaborators |
| `LoginPage.tsx` | ~425-451 | Check collaborators before reload |
| `LoginPage.tsx` | ~467-494 | `handleDeviceVerified()` - check collaborators here too |
| `Header component` | TBD | Profile dropdown - add Switch Account option |

---

## Implementation Flow Diagrams

### 1. LOGIN FLOW (with Device Verification consideration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LOGS IN                                    │
│                         (LoginPage.tsx line 386)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   authAPI.login() response      │
                    │   contains: user, token,        │
                    │   collaborators[], requires_    │
                    │   verification                  │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  requires_verification = true?  │
                    └─────────────────────────────────┘
                           │                    │
                          YES                   NO
                           │                    │
                           ▼                    │
        ┌──────────────────────────────┐        │
        │  Show DeviceVerificationModal │        │
        │  (existing flow)             │        │
        └──────────────────────────────┘        │
                           │                    │
                           ▼                    │
        ┌──────────────────────────────┐        │
        │  handleDeviceVerified()      │        │
        │  (line 467-494)              │        │
        └──────────────────────────────┘        │
                           │                    │
                           └────────┬───────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Store auth data in localStorage │
                    │  - stasht_user                  │
                    │  - stasht_token                 │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Check collaborators array      │
                    │  for role === "admin"           │
                    └─────────────────────────────────┘
                           │                    │
                    HAS ADMIN              NO ADMIN
                           │                    │
                           ▼                    ▼
        ┌──────────────────────────────┐  ┌──────────────────┐
        │  Show AccountChoiceModal     │  │  window.location │
        │  - "Login as [Owner]"        │  │  .reload()       │
        │  - "Login as Personal"       │  │  (normal flow)   │
        └──────────────────────────────┘  └──────────────────┘
                    │              │
         ┌─────────┘              └─────────┐
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│ "Login as Admin"    │          │ "Login as Personal" │
│ clicked             │          │ clicked             │
└─────────────────────┘          └─────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│ Call loginAsAdmin   │          │ Keep current user   │
│ API with owner_id   │          │ data in localStorage│
└─────────────────────┘          └─────────────────────┘
         │                                  │
         ▼                                  │
┌─────────────────────┐                     │
│ Response: owner's   │                     │
│ user data + token   │                     │
└─────────────────────┘                     │
         │                                  │
         ▼                                  │
┌─────────────────────┐                     │
│ Replace localStorage│                     │
│ with owner's data:  │                     │
│ - stasht_user       │                     │
│ - stasht_token      │                     │
└─────────────────────┘                     │
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  Redirect to        │
              │  /memories          │
              └─────────────────────┘
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│ Shows OWNER's data  │   │ Shows USER's own    │
│ (Tarush1's memories)│   │ data (Tarush2's     │ 
│                     │   │ memories)           │
└─────────────────────┘   └─────────────────────┘
```

---

### 2. SIGNUP FLOW (Email Method with Activation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER SIGNS UP                                      │
│                      (SignupPage.tsx line 377)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   authAPI.register() response   │
                    │   contains: message,            │
                    │   collaborators[]               │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  Check collaborators array      │
                    │  for role === "admin"           │
                    └─────────────────────────────────┘
                           │                    │
                    HAS ADMIN              NO ADMIN
                           │                    │
                           ▼                    ▼
        ┌──────────────────────────────┐  ┌──────────────────┐
        │  Store collaborators in      │  │  Do nothing      │
        │  localStorage:               │  │  (no storage)    │
        │  "pending_admin_collaborators"│  │                  │
        └──────────────────────────────┘  └──────────────────┘
                           │                    │
                           └────────┬───────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Show "Check your email"        │
                    │  activation message             │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  User receives email            │
                    │  Clicks activation link:        │
                    │  http://localhost:5173?token=xxx│
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  App.tsx detects token in URL   │
                    │  Shows AccountActivationPage    │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  authAPI.activateAccount(token) │
                    │  (AccountActivationPage line 50)│
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Activation successful          │
                    │  Store user + token in          │
                    │  localStorage                   │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Check localStorage for         │
                    │  "pending_admin_collaborators"  │
                    └─────────────────────────────────┘
                           │                    │
                        EXISTS             NOT EXISTS
                           │                    │
                           ▼                    ▼
        ┌──────────────────────────────┐  ┌──────────────────┐
        │  Show AccountChoiceModal     │  │  Redirect to     │
        │  - "Login as [Owner]"        │  │  /memories       │
        │  - "Login as Personal"       │  │  (normal flow)   │
        └──────────────────────────────┘  └──────────────────┘
                    │              │               │
         ┌─────────┘              └─────────┐     │
         │                                  │     │
         ▼                                  ▼     │
┌─────────────────────┐          ┌─────────────────────┐
│ "Login as Admin"    │          │ "Login as Personal" │
│ clicked             │          │ clicked             │
└─────────────────────┘          └─────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│ Call loginAsAdmin   │          │ Clear pending_admin │
│ API with owner_id   │          │ _collaborators from │
│                     │          │ localStorage        │
└─────────────────────┘          └─────────────────────┘
         │                                  │
         ▼                                  │
┌─────────────────────┐                     │
│ Replace localStorage│                     │
│ with owner's data   │                     │
└─────────────────────┘                     │
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  Redirect to        │
              │  /memories          │
              └─────────────────────┘
```

---

### 3. SIGNUP FLOW (Phone Method with OTP)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     USER SIGNS UP (Phone Method)                            │
│                      (SignupPage.tsx line 377)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   authAPI.register() response   │
                    │   contains: message (OTP sent), │
                    │   collaborators[]               │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  Check collaborators array      │
                    │  for role === "admin"           │
                    └─────────────────────────────────┘
                           │                    │
                    HAS ADMIN              NO ADMIN
                           │                    │
                           ▼                    ▼
        ┌──────────────────────────────┐  ┌──────────────────┐
        │  Store collaborators in      │  │  Do nothing      │
        │  localStorage:               │  │                  │
        │  "pending_admin_collaborators"│  │                  │
        └──────────────────────────────┘  └──────────────────┘
                           │                    │
                           └────────┬───────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Show OTP verification screen   │
                    │  (SignupPage.tsx line 858-964)  │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  User enters OTP                │
                    │  handleVerifyOtp() called       │
                    │  (line 641-745)                 │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  authAPI.verifyPhoneOtp()       │
                    │  returns user + token           │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Store user + token in          │
                    │  localStorage                   │
                    └─────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────┐
                    │  Check localStorage for         │
                    │  "pending_admin_collaborators"  │
                    └─────────────────────────────────┘
                           │                    │
                        EXISTS             NOT EXISTS
                           │                    │
                           ▼                    ▼
        ┌──────────────────────────────┐  ┌──────────────────┐
        │  Show AccountChoiceModal     │  │  window.location │
        │                              │  │  .reload()       │
        └──────────────────────────────┘  └──────────────────┘
                    │              │
                   ... (same as above)
```

---

### 4. AccountChoiceModal Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AccountChoiceModal                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                    Choose Account                                │     │
│    │           Select which account you want to access               │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │  ┌─────────────────────────────────────────────────────────┐   │     │
│    │  │  👤  Login as Tarush1                                    │   │     │
│    │  │      (Admin Access)                                      │   │     │
│    │  │      Access Tarush1's memories and data                  │   │     │
│    │  └─────────────────────────────────────────────────────────┘   │     │
│    │                                                                 │     │
│    │  ┌─────────────────────────────────────────────────────────┐   │     │
│    │  │  👤  Login as Personal                                   │   │     │
│    │  │      (Your Account)                                      │   │     │
│    │  │      Access your own memories and data                   │   │     │
│    │  └─────────────────────────────────────────────────────────┘   │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Props:
- isOpen: boolean
- onClose: () => void
- adminCollaborator: { owner_id, user_id, role }
- onLoginAsAdmin: (owner_id: string) => void
- onLoginAsPersonal: () => void
```

---

### 5. Account Switching in Header (AFTER Login)

**Important:** Only ONE admin account per user.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ACCOUNT SWITCHING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: User logs in with admin collaborator
                    │
                    ▼
STEP 2: User chooses account in AccountChoiceModal
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
"Login as Admin"         "Login as Personal"
        │                       │
        ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Call loginAsAdmin│    │ Keep personal   │
│ API             │    │ data            │
└─────────────────┘    └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────────────────────────────┐
│  Store BOTH accounts in localStorage:   │
│                                         │
│  "admin_switch_data": {                 │
│    "has_admin_access": true,            │
│    "current_mode": "admin" | "personal",│
│    "personal_account": {                │
│      "user": {...},                     │
│      "token": "..."                     │
│    },                                   │
│    "admin_account": {                   │
│      "owner_id": "123",                 │
│      "user": {...},   // owner's data   │
│      "token": "..."   // owner's token  │
│    }                                    │
│  }                                      │
└─────────────────────────────────────────┘
                    │
                    ▼
STEP 3: User is on /memories page
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Currently logged in as: ADMIN (Tarush1)                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Profile Image]  Tarush1  ▼                                        │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  🔄 Switch to Personal Account (Tarush2)                    │    │   │
│  │  ├─────────────────────────────────────────────────────────────┤    │   │
│  │  │  ⚙️  Settings                                               │    │   │
│  │  ├─────────────────────────────────────────────────────────────┤    │   │
│  │  │  🚪 Logout                                                  │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ Click "Switch to Personal Account"
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SWITCH LOGIC (No API call needed):                                         │
│                                                                             │
│  1. Read admin_switch_data from localStorage                                │
│  2. Get personal_account.user and personal_account.token                    │
│  3. Update stasht_user with personal_account.user                           │
│  4. Update stasht_token with personal_account.token                         │
│  5. Update admin_switch_data.current_mode = "personal"                      │
│  6. Reload page                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HEADER (After Switch)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Currently logged in as: PERSONAL (Tarush2)                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Profile Image]  Tarush2  ▼                                        │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  🔄 Switch to Admin Account (Tarush1)                       │    │   │
│  │  ├─────────────────────────────────────────────────────────────┤    │   │
│  │  │  ⚙️  Settings                                               │    │   │
│  │  ├─────────────────────────────────────────────────────────────┤    │   │
│  │  │  🚪 Logout                                                  │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  NOTE: "Switch to Admin Account" option ONLY appears for users with         │
│        admin_switch_data.has_admin_access = true                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 6. localStorage Structure for Account Switching

```javascript
// Normal user (no admin access):
localStorage = {
  "stasht_user": { id, name, email, ... },
  "stasht_token": "xyz..."
}

// User with admin access:
localStorage = {
  "stasht_user": { ... },           // Current active user (admin or personal)
  "stasht_token": "...",            // Current active token

  "admin_switch_data": {
    "has_admin_access": true,
    "current_mode": "admin",        // "admin" or "personal"
    "personal_account": {
      "user": {
        "id": "456",
        "name": "Tarush2",
        "email": "tarush2@email.com",
        ...
      },
      "token": "personal_token_xyz..."
    },
    "admin_account": {
      "owner_id": "123",
      "user": {
        "id": "123",
        "name": "Tarush1",
        "email": "tarush1@email.com",
        ...
      },
      "token": "admin_token_abc..."
    }
  }
}
```

---

### 7. Switch Account Logic (No API Call)

```javascript
// Function to switch account (in Header component or AuthContext)
const switchAccount = () => {
  const switchData = JSON.parse(localStorage.getItem('admin_switch_data'));

  if (!switchData || !switchData.has_admin_access) return;

  if (switchData.current_mode === 'admin') {
    // Switch to Personal
    localStorage.setItem('stasht_user', JSON.stringify(switchData.personal_account.user));
    localStorage.setItem('stasht_token', switchData.personal_account.token);
    switchData.current_mode = 'personal';
  } else {
    // Switch to Admin
    localStorage.setItem('stasht_user', JSON.stringify(switchData.admin_account.user));
    localStorage.setItem('stasht_token', switchData.admin_account.token);
    switchData.current_mode = 'admin';
  }

  localStorage.setItem('admin_switch_data', JSON.stringify(switchData));
  window.location.reload();
};
```

---

## Status

**Current Status:** ✅ IMPLEMENTATION COMPLETE

**All Features Implemented:**
- ✅ Collaborators array handling in login/signup responses
- ✅ Login as Admin API endpoint integration
- ✅ AccountChoiceModal for account selection
- ✅ Account switching in header dropdown
- ✅ localStorage-based account switching (no API call needed)

---

## Implementation Summary

### Files Created:
1. **`components/AccountChoiceModal.tsx`** - Modal for choosing between admin/personal account
   - Exports: `AccountChoiceModal`, `getAdminCollaborator`, `getAdminSwitchData`, `switchAccount`, `clearAdminSwitchData`, `storeAdminSwitchData`

### Files Modified:

1. **`utils/authUtils.ts`**
   - Added `loginAsAdmin()` function (line ~2345-2361)
   - Updated `register()` to include collaborators in response

2. **`pages/LoginPage.tsx`**
   - Added collaborator check after login success
   - Added collaborator check after device verification
   - Added AccountChoiceModal integration

3. **`pages/SignupPage.tsx`**
   - Added collaborator check after signup
   - Store collaborators in localStorage for email activation flow
   - Added collaborator check after OTP verification
   - Added AccountChoiceModal integration

4. **`pages/AccountActivationPage.tsx`**
   - Added collaborator check from localStorage after activation
   - Added AccountChoiceModal integration

5. **`components/DeviceVerificationModal.tsx`**
   - Updated onVerified callback to include collaborators

6. **`imports/ProfileDdwn.tsx`**
   - Added "Switch Account" button in dropdown (only shown for admin users)
   - Added switchAccount handler
   - Clear admin data on logout

---

## Related Files (Previously Modified)

### 1. `utils/authUtils.ts` (Line 2325-2343)
Added `addAccountAdmin` function for inviting users as admin:
```typescript
addAccountAdmin: async (collaboratorData: {
  collaborators: Array<{email: string}>;
}): Promise<ApiResponse<any>> => {
  return await apiRequest('/memories/add-account-admin', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
}
```

### 2. `components/InviteToMemoryModal.tsx` (Line 288-313)
Updated to call `addAccountAdmin` API when Admin role is selected.

---

## Document History

| Date | Change |
|------|--------|
| 2025-12-01 | Initial document created |
