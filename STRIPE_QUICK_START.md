# Stripe Integration - Quick Start Guide

Get your Stripe payment integration up and running in 5 minutes!

---

## Step 1: Get Your Stripe Keys

1. Go to https://dashboard.stripe.com/register (create account if needed)
2. Navigate to **Developers → API Keys**
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Keep this tab open, you'll need it

---

## Step 2: Create Products in Stripe

1. Go to **Products** in Stripe Dashboard
2. Click **Add product**

### Product 1: Intermediate Plan
- Name: `Intermediate Plan`
- Description: `Power users plan with 1TB storage`
- Pricing:
  - **Monthly**: $9.00/month (recurring)
  - **Yearly**: $89.64/year (save 17%)
- Click **Save product**
- **Copy both Price IDs** (you'll see 2, one for monthly, one for yearly)

### Product 2: Professional Plan
- Name: `Professional Plan`
- Description: `Teams & organizations plan with 10TB storage`
- Pricing:
  - **Monthly**: $19.00/month (recurring)
  - **Yearly**: $189.24/year (save 17%)
- Click **Save product**
- **Copy both Price IDs**

---

## Step 3: Update Your .env File

Open `C:\Users\works\Downloads\StashtStudio1.1\.env` and update:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE

# Stripe API URL (update for production)
VITE_STRIPE_API_URL=http://localhost:8000/api

# Stripe Price IDs (from Step 2)
VITE_STRIPE_PRICE_INTERMEDIATE_MONTHLY=price_YOUR_ID_HERE
VITE_STRIPE_PRICE_INTERMEDIATE_YEARLY=price_YOUR_ID_HERE
VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_YOUR_ID_HERE
VITE_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_YOUR_ID_HERE
```

---

## Step 4: Start Your Backend (Laravel)

```bash
cd your-laravel-backend
php artisan serve
```

Make sure it's running on `http://localhost:8000`

---

## Step 5: Start Your Frontend

```bash
cd C:\Users\works\Downloads\StashtStudio1.1
npm run dev
```

---

## Step 6: Test the Integration

### Test the Upgrade Flow

1. Open your app in the browser
2. Navigate to where you have the upgrade button
3. Click "Upgrade Plan"
4. Select a plan (Intermediate or Professional)
5. Toggle monthly/yearly billing
6. Click "Upgrade to [Plan Name]"
7. Select "Credit or Debit Card"
8. Enter test card: `4242 4242 4242 4242`
9. Enter any future expiry: `12/25`
10. Enter any CVC: `123`
11. Fill in billing address
12. Check the terms checkbox
13. Click "Pay $X"

**Expected result:** Success message and subscription created! 🎉

### Test the Subscription Management

1. Add the SubscriptionManagement component to your settings page
2. View your active subscription
3. Try canceling the subscription
4. Try resuming the canceled subscription

---

## Example: Add to Profile Settings

Open `pages/ProfileSettingsPage.tsx` and add:

```tsx
import SubscriptionManagement from '../components/SubscriptionManagement';
import { useState } from 'react';

// Inside your component:
const [showUpgradeModal, setShowUpgradeModal] = useState(false);

// In your JSX (add a new section):
<section id="billing" ref={billingSectionRef}>
  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
    <h2 className="text-xl font-semibold text-gray-900 mb-6">
      Billing & Subscription
    </h2>

    <SubscriptionManagement
      onUpgradeClick={() => setShowUpgradeModal(true)}
    />
  </div>
</section>

<UpgradePlanModal
  isOpen={showUpgradeModal}
  onClose={() => setShowUpgradeModal(false)}
  onUpgrade={(planId, isYearly) => {
    console.log(`Upgraded to ${planId} (${isYearly ? 'yearly' : 'monthly'})`);
    // Optionally refresh user data here
  }}
/>
```

---

## Test Cards

Use these test cards in Stripe test mode:

| Card Number | Result |
|------------|--------|
| `4242 4242 4242 4242` | Success ✅ |
| `4000 0027 6000 3184` | Requires 3D Secure |
| `4000 0000 0000 0002` | Declined ❌ |

Always use:
- **Expiry**: Any future date (e.g., `12/25`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

---

## Troubleshooting

### "Stripe has not been initialized"
- Check `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env`
- Restart dev server: `Ctrl+C` then `npm run dev`

### "Failed to create setup intent"
- Make sure Laravel backend is running: `php artisan serve`
- Check `VITE_STRIPE_API_URL` matches your backend URL
- Check Laravel `.env` has `STRIPE_SECRET` configured

### Card element not showing
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Check browser console for errors

### "Invalid price ID"
- Make sure you copied the correct Price IDs from Stripe Dashboard
- Price IDs start with `price_`
- Restart dev server after updating `.env`

---

## What's Next?

- ✅ Read the full [Frontend Integration Guide](STRIPE_FRONTEND_INTEGRATION.md)
- ✅ Read the [Backend Integration Guide](STRIPE_BACKEND_INTEGRATION.md)
- ✅ Customize the pricing plans to match your needs
- ✅ Style the components to match your brand
- ✅ Set up webhooks for production
- ✅ Deploy with live Stripe keys

---

## Need Help?

- **Full Documentation**: See `STRIPE_FRONTEND_INTEGRATION.md`
- **Backend Setup**: See `STRIPE_BACKEND_INTEGRATION.md`
- **Stripe Docs**: https://stripe.com/docs
- **Test Cards**: https://stripe.com/docs/testing

---

**You're all set! Happy coding! 🚀**
