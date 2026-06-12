# Stripe Frontend Integration Guide

This document provides complete instructions for setting up and using the Stripe payment integration in the StashtStudio React frontend.

---

## Overview

The frontend integration connects your React application with the Laravel backend Stripe implementation. It provides:

- 🎨 **Pricing Cards** - Beautiful UI for displaying subscription plans
- 💳 **Secure Payment Forms** - Stripe Elements for PCI-compliant card input
- 📊 **Subscription Management** - View and manage active subscriptions
- 🔄 **Real-time Status** - Display subscription status, billing dates, and more

---

## Prerequisites

Before starting, ensure you have:

1. ✅ Completed the [Laravel backend setup](STRIPE_BACKEND_INTEGRATION.md)
2. ✅ Stripe account with API keys
3. ✅ Created products and price IDs in Stripe Dashboard
4. ✅ Node.js and npm installed

---

## Installation

The required Stripe packages are already installed:

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

---

## Configuration

### Step 1: Update Environment Variables

Open `.env` file and configure the following:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxx
VITE_STRIPE_API_URL=http://localhost:8000/api

# Stripe Price IDs (from Stripe Dashboard -> Products)
VITE_STRIPE_PRICE_INTERMEDIATE_MONTHLY=price_xxxxxxxxxx
VITE_STRIPE_PRICE_INTERMEDIATE_YEARLY=price_xxxxxxxxxx
VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxxxxxxxxx
VITE_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_xxxxxxxxxx
```

**Where to find these values:**

1. **VITE_STRIPE_PUBLISHABLE_KEY**:
   - Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys)
   - Copy the **Publishable key** (starts with `pk_test_` or `pk_live_`)

2. **VITE_STRIPE_API_URL**:
   - Your Laravel backend URL + `/api`
   - Local: `http://localhost:8000/api`
   - Production: `https://your-backend-domain.com/api`

3. **Price IDs**:
   - Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
   - Click on each product → Copy the Price ID (starts with `price_`)
   - You need 4 price IDs total (2 plans × 2 billing periods)

---

## Components

### 1. UpgradePlanModal

Main component for displaying pricing plans and handling subscriptions.

**Location:** `components/UpgradePlanModal.tsx`

**Usage:**

```tsx
import { UpgradePlanModal } from './components/UpgradePlanModal';

function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleUpgrade = (planId: string, isYearly: boolean) => {
    console.log(`Subscribed to ${planId} (${isYearly ? 'yearly' : 'monthly'})`);
    // Optional: Refresh user data, show success message, etc.
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Upgrade Plan
      </button>

      <UpgradePlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpgrade={handleUpgrade}
      />
    </>
  );
}
```

**Features:**
- ✨ Side-by-side plan comparison
- 🔄 Monthly/yearly billing toggle
- 💰 Real-time price calculations
- 📝 Order summary
- 🎯 Multiple payment methods (Card, PayPal*, Apple Pay*)

*PayPal and Apple Pay coming soon

---

### 2. StripePaymentForm

Secure payment form using Stripe Elements.

**Location:** `components/StripePaymentForm.tsx`

**Features:**
- 🔒 PCI-compliant card input (Stripe Elements)
- 📋 Billing address collection
- ✅ Real-time validation
- 💳 Support for all major card brands
- 🔄 Loading states and error handling

**Note:** This component is automatically used by `UpgradePlanModal`. You typically don't need to use it directly.

---

### 3. SubscriptionManagement

Display and manage user's current subscription.

**Location:** `components/SubscriptionManagement.tsx`

**Usage:**

```tsx
import { SubscriptionManagement } from './components/SubscriptionManagement';

function ProfileSettings() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <div>
      <h2>Billing & Subscription</h2>

      <SubscriptionManagement
        onUpgradeClick={() => setShowUpgradeModal(true)}
      />

      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
```

**Features:**
- 📊 Current plan display
- 📅 Next billing date
- ⚠️ Cancellation warnings
- 🔄 Resume canceled subscriptions
- 🎯 Quick upgrade button

**States Displayed:**
- **Free tier** - Shows upgrade CTA
- **Active subscription** - Full management controls
- **Canceling subscription** - Shows access end date with resume option

---

### 4. Stripe API Utility

**Location:** `utils/stripeApi.ts`

Provides methods to interact with your Laravel backend:

```typescript
import { stripeApi } from './utils/stripeApi';

// Get current subscription
const subscription = await stripeApi.getCurrentSubscription();

// Cancel subscription
const result = await stripeApi.cancelSubscription();

// Resume subscription
const result = await stripeApi.resumeSubscription();

// Get payment methods
const methods = await stripeApi.getPaymentMethods();

// Get invoices
const invoices = await stripeApi.getInvoices();
```

**Authentication:**
The utility automatically includes the user's auth token from localStorage (`token` key).

---

## Payment Flow

Here's how the complete payment flow works:

```
1. User clicks "Upgrade Plan"
   └─> UpgradePlanModal opens

2. User selects plan & billing period
   └─> Clicks "Upgrade"

3. PaymentMethodModal opens
   └─> User selects "Credit or Debit Card"

4. Backend creates SetupIntent
   └─> Returns clientSecret

5. StripePaymentForm opens with Stripe Elements
   └─> User enters card details & billing info
   └─> Clicks "Pay"

6. Stripe confirms card setup
   └─> Returns payment method ID

7. Backend creates subscription
   └─> Attaches payment method
   └─> Creates subscription

8. Success! User is subscribed
   └─> Modal closes
   └─> Success message shown
```

---

## Customization

### Updating Plan Details

Edit the `plans` array in `components/UpgradePlanModal.tsx`:

```typescript
const plans: Plan[] = [
  {
    id: 'intermediate',
    name: 'Intermediate',
    subtitle: 'Power users',
    price: 9,
    yearlyPrice: 7.47,
    storage: '1 TB storage',
    icon: <Zap className="w-5 h-5 text-white" />,
    priceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_INTERMEDIATE_MONTHLY,
    priceIdYearly: import.meta.env.VITE_STRIPE_PRICE_INTERMEDIATE_YEARLY,
    features: [
      'Advanced Analytics',
      'Memory Wizard AI\n(5K credits per month)',
      // Add more features...
    ]
  },
  // Add more plans...
];
```

### Customizing Colors

The components use Tailwind CSS with a primary color of `#6C60FF`. To change:

```tsx
// Before
className="bg-[#6C60FF] text-white"

// After (example: blue theme)
className="bg-blue-600 text-white"
```

### Custom Success/Error Handling

Replace `alert()` calls with your preferred notification system:

```typescript
// In UpgradePlanModal.tsx
// Before:
alert(`Successfully subscribed to ${selectedPlanData.name} plan!`);

// After (example with toast):
import { toast } from 'sonner';
toast.success(`Successfully subscribed to ${selectedPlanData.name} plan!`);
```

---

## Testing

### Test Mode

Stripe provides test mode for development:

**Test Card Numbers:**
- **Success**: `4242 4242 4242 4242`
- **Requires 3D Secure**: `4000 0027 6000 3184`
- **Declined**: `4000 0000 0000 0002`

**Card Details:**
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

### Testing Checklist

- [ ] Pricing modal displays correct plans and prices
- [ ] Monthly/yearly toggle updates prices
- [ ] Card payment form accepts test cards
- [ ] Successful payment creates subscription
- [ ] Subscription displays in SubscriptionManagement
- [ ] Cancel subscription works
- [ ] Resume subscription works
- [ ] Error handling shows user-friendly messages

### Stripe CLI Testing

For webhook testing:

```bash
# Forward webhooks to local backend
stripe listen --forward-to localhost:8000/api/stripe/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
```

---

## Common Issues & Solutions

### Issue: "Stripe has not been initialized"

**Solution:** Make sure `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env` and starts with `pk_test_` or `pk_live_`.

---

### Issue: "Failed to create setup intent"

**Possible causes:**
1. Backend not running
2. Wrong `VITE_STRIPE_API_URL`
3. User not authenticated (no token)
4. CORS issues

**Solution:**
- Check backend is running: `php artisan serve`
- Verify API URL in `.env`
- Check browser console for errors
- Ensure Laravel CORS is configured

---

### Issue: "Invalid price ID"

**Solution:**
- Go to Stripe Dashboard → Products
- Copy the correct Price IDs
- Update `.env` with real price IDs
- Restart dev server: `npm run dev`

---

### Issue: Card element not showing

**Solution:**
- Check browser console for errors
- Ensure Stripe publishable key is valid
- Try hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## Production Deployment

### Pre-deployment Checklist

- [ ] Replace test API keys with live keys (`pk_live_` and `sk_live_`)
- [ ] Update all price IDs to production price IDs
- [ ] Set `VITE_STRIPE_API_URL` to production backend URL
- [ ] Configure production webhook endpoint in Stripe Dashboard
- [ ] Test complete payment flow in production mode
- [ ] Enable 3D Secure for cards (automatically handled by Stripe)
- [ ] Review Stripe Dashboard settings (branding, emails, etc.)

### Environment Variables (Production)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_API_URL=https://api.yourdomain.com/api
VITE_STRIPE_PRICE_INTERMEDIATE_MONTHLY=price_live_xxxxx
VITE_STRIPE_PRICE_INTERMEDIATE_YEARLY=price_live_xxxxx
VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_live_xxxxx
VITE_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_live_xxxxx
```

### Build for Production

```bash
npm run build
```

---

## Security Best Practices

1. ✅ **Never expose secret keys** - Only use publishable keys (`pk_`) in frontend
2. ✅ **Use HTTPS in production** - Required by Stripe
3. ✅ **Validate on backend** - Never trust frontend data
4. ✅ **Use Stripe Elements** - Don't build custom card forms
5. ✅ **Handle errors gracefully** - Don't expose sensitive error details
6. ✅ **Verify webhooks** - Use webhook signatures in backend

---

## API Reference

### stripeApi Methods

#### `createSetupIntent()`
Creates a SetupIntent for collecting payment method.

**Returns:** `Promise<SetupIntentResponse>`

---

#### `createSubscription(data: CreateSubscriptionRequest)`
Creates a new subscription.

**Parameters:**
- `payment_method_id` - Stripe payment method ID
- `price_id` - Stripe price ID
- `plan_name` - 'intermediate' | 'professional'
- `billing_period` - 'monthly' | 'yearly'

**Returns:** `Promise<SubscriptionResponse>`

---

#### `getCurrentSubscription()`
Gets the user's current subscription.

**Returns:** `Promise<CurrentSubscriptionResponse>`

---

#### `cancelSubscription()`
Cancels the subscription at period end.

**Returns:** `Promise<{ success: boolean; message?: string; error?: string }>`

---

#### `resumeSubscription()`
Resumes a canceled subscription.

**Returns:** `Promise<{ success: boolean; message?: string; error?: string }>`

---

#### `updateSubscription(priceId: string)`
Updates subscription to a different plan.

**Returns:** `Promise<{ success: boolean; message?: string; error?: string }>`

---

## Support & Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe React Docs**: https://stripe.com/docs/stripe-js/react
- **Test Cards**: https://stripe.com/docs/testing
- **Stripe Dashboard**: https://dashboard.stripe.com

---

## Next Steps

1. ✅ Complete backend setup (see `STRIPE_BACKEND_INTEGRATION.md`)
2. ✅ Configure `.env` with your Stripe keys and price IDs
3. ✅ Test the payment flow with test cards
4. ✅ Add SubscriptionManagement to your settings page
5. ✅ Customize styling to match your brand
6. ✅ Deploy to production with live keys

---

## File Structure

```
components/
├── UpgradePlanModal.tsx          # Main pricing & upgrade modal
├── StripePaymentForm.tsx          # Secure card payment form
├── SubscriptionManagement.tsx     # Subscription status & management
├── PaymentMethodModal.tsx         # Payment method selection
└── BillingInformationModal.tsx    # (Legacy - replaced by StripePaymentForm)

utils/
└── stripeApi.ts                   # Backend API integration

.env                               # Environment configuration
```

---

## Questions?

If you encounter any issues:

1. Check the [Common Issues](#common-issues--solutions) section
2. Review Stripe Dashboard for error logs
3. Check browser console for errors
4. Verify backend logs
5. Consult the [Laravel backend integration guide](STRIPE_BACKEND_INTEGRATION.md)

---

**Happy coding! 🚀**
