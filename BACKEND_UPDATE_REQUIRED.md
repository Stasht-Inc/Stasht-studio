# Backend Update Required

## Changes Made to Frontend

The frontend has been updated to **NOT** send `price_id` to the backend. Instead, it only sends:
- `plan_name` ('intermediate' or 'professional')
- `billing_period` ('monthly' or 'yearly')
- `payment_method_id`

This means the **backend needs to determine the price_id** based on the plan_name and billing_period.

---

## Update Your Laravel Backend

### Update `app/Http/Controllers/StripeController.php`

Find the `createSubscription` method and update it:

**Before:**
```php
public function createSubscription(Request $request)
{
    $request->validate([
        'payment_method_id' => 'required|string',
        'price_id' => 'required|string',  // ❌ Remove this
        'plan_name' => 'required|string|in:intermediate,professional',
        'billing_period' => 'required|string|in:monthly,yearly',
    ]);

    // ... rest of code
    $subscription = $user->newSubscription('default', $request->price_id)
        ->create($request->payment_method_id);
}
```

**After:**
```php
public function createSubscription(Request $request)
{
    $request->validate([
        'payment_method_id' => 'required|string',
        'plan_name' => 'required|string|in:intermediate,professional',
        'billing_period' => 'required|string|in:monthly,yearly',
    ]);

    try {
        $user = $request->user();

        // ✅ Determine price_id based on plan and billing period
        $priceId = $this->getPriceId($request->plan_name, $request->billing_period);

        // Add payment method to customer
        $user->addPaymentMethod($request->payment_method_id);
        $user->updateDefaultPaymentMethod($request->payment_method_id);

        // Save payment method to database
        $paymentMethod = $user->defaultPaymentMethod();
        PaymentMethod::updateOrCreate(
            [
                'user_id' => $user->id,
                'stripe_payment_method_id' => $request->payment_method_id,
            ],
            [
                'card_brand' => $paymentMethod->card->brand,
                'card_last4' => $paymentMethod->card->last4,
                'card_exp_month' => $paymentMethod->card->exp_month,
                'card_exp_year' => $paymentMethod->card->exp_year,
                'is_default' => true,
            ]
        );

        // Create subscription using determined price_id
        $subscription = $user->newSubscription('default', $priceId)
            ->create($request->payment_method_id);

        return response()->json([
            'success' => true,
            'subscription_id' => $subscription->stripe_id,
            'status' => $subscription->stripe_status,
        ]);
    } catch (\Exception $e) {
        Log::error('Subscription Creation Error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'error' => $e->getMessage()
        ], 500);
    }
}

/**
 * Get Stripe price ID based on plan name and billing period
 */
private function getPriceId(string $planName, string $billingPeriod): string
{
    $priceMap = [
        'intermediate' => [
            'monthly' => env('STRIPE_PRICE_INTERMEDIATE_MONTHLY'),
            'yearly' => env('STRIPE_PRICE_INTERMEDIATE_YEARLY'),
        ],
        'professional' => [
            'monthly' => env('STRIPE_PRICE_PROFESSIONAL_MONTHLY'),
            'yearly' => env('STRIPE_PRICE_PROFESSIONAL_YEARLY'),
        ],
    ];

    $priceId = $priceMap[$planName][$billingPeriod] ?? null;

    if (!$priceId) {
        throw new \Exception("Invalid plan configuration: {$planName} - {$billingPeriod}");
    }

    return $priceId;
}
```

---

## Verify Your Backend .env

Make sure your Laravel `.env` file has these variables:

```env
STRIPE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Price IDs
STRIPE_PRICE_INTERMEDIATE_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_INTERMEDIATE_YEARLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL_YEARLY=price_xxxxxxxxxxxxxxxxxxxx
```

---

## Benefits of This Approach

✅ **Single Source of Truth** - Price IDs only stored in backend
✅ **Easier Maintenance** - Update prices in one place
✅ **More Secure** - Frontend can't send arbitrary price IDs
✅ **Simplified Frontend** - Less configuration needed

---

## Testing

After making these changes:

1. Restart your Laravel server: `php artisan serve`
2. Test the subscription flow from the frontend
3. Verify the correct price_id is being used in Stripe Dashboard

---

## Alternative: Keep Frontend Price IDs (Not Recommended)

If you prefer to keep price IDs in the frontend, you can revert the changes:

1. Add price IDs back to frontend `.env`
2. Restore the `priceId` prop in `UpgradePlanModal.tsx`
3. Keep backend accepting `price_id` from request

However, this approach has more maintenance overhead and is less secure.

---

## Summary

**Frontend now sends:**
```json
{
  "payment_method_id": "pm_xxxx",
  "plan_name": "intermediate",
  "billing_period": "monthly"
}
```

**Backend determines:**
- Maps plan_name + billing_period → price_id
- Uses price_id from .env configuration
- Creates subscription with correct price

**Result:** Cleaner architecture with single source of truth! ✅
