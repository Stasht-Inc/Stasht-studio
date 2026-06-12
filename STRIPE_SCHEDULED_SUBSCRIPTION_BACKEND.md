# Stripe Scheduled Subscription Changes - Backend Implementation

## Overview

This feature implements "Pay Now, Start Later" subscription changes, similar to Jio recharge:
- User pays for new plan immediately
- New plan starts AFTER current plan ends
- No gap in service
- No double billing

---

## 1. Database Migration

### Create `scheduled_subscription_changes` Table

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('scheduled_subscription_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('stripe_schedule_id')->unique();
            $table->string('stripe_subscription_id')->nullable();
            $table->string('current_plan_name'); // Plan being replaced
            $table->string('new_plan_name'); // intermediate, professional
            $table->string('new_billing_period'); // monthly, yearly
            $table->string('new_stripe_price_id');
            $table->decimal('amount', 10, 2); // Amount charged
            $table->string('currency', 3)->default('USD');
            $table->timestamp('scheduled_start_date'); // When new plan starts
            $table->timestamp('current_plan_end_date'); // When current plan ends
            $table->string('status')->default('scheduled'); // scheduled, active, cancelled, failed
            $table->timestamp('charged_at')->nullable(); // When payment was taken
            $table->timestamp('activated_at')->nullable(); // When schedule activated
            $table->text('metadata')->nullable(); // JSON for additional data
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('scheduled_start_date');
        });
    }

    public function down()
    {
        Schema::dropIfExists('scheduled_subscription_changes');
    }
};
```

---

## 2. Environment Variables

Add to `.env`:

```env
# Stripe Price IDs
STRIPE_INTERMEDIATE_MONTHLY_PRICE_ID=price_xxx
STRIPE_INTERMEDIATE_YEARLY_PRICE_ID=price_xxx
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_xxx
STRIPE_PROFESSIONAL_YEARLY_PRICE_ID=price_xxx

# Stripe API Keys (already exists)
STRIPE_KEY=pk_test_xxx
STRIPE_SECRET=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## 3. Model

### Create `ScheduledSubscriptionChange` Model

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduledSubscriptionChange extends Model
{
    protected $fillable = [
        'user_id',
        'stripe_schedule_id',
        'stripe_subscription_id',
        'current_plan_name',
        'new_plan_name',
        'new_billing_period',
        'new_stripe_price_id',
        'amount',
        'currency',
        'scheduled_start_date',
        'current_plan_end_date',
        'status',
        'charged_at',
        'activated_at',
        'metadata',
    ];

    protected $casts = [
        'scheduled_start_date' => 'datetime',
        'current_plan_end_date' => 'datetime',
        'charged_at' => 'datetime',
        'activated_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isScheduled(): bool
    {
        return $this->status === 'scheduled';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function cancel(): void
    {
        if ($this->stripe_schedule_id) {
            \Stripe\SubscriptionSchedule::update($this->stripe_schedule_id, [
                'end_behavior' => 'cancel',
            ]);
        }

        $this->update(['status' => 'cancelled']);
    }
}
```

---

## 4. Controller - StripeController.php

### Full Implementation with Subscription Schedules

```php
<?php

namespace App\Http\Controllers;

use App\Models\ScheduledSubscriptionChange;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Stripe\StripeClient;
use Carbon\Carbon;

class StripeController extends Controller
{
    private $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(env('STRIPE_SECRET'));
    }

    /**
     * Create or Schedule Subscription
     * POST /api/stripe/create-subscription
     */
    public function createSubscription(Request $request)
    {
        $request->validate([
            'payment_method_id' => 'required|string',
            'plan_name' => 'required|in:intermediate,professional',
            'billing_period' => 'required|in:monthly,yearly',
        ]);

        $user = $request->user();
        $newPlanName = $request->plan_name;
        $newBillingPeriod = $request->billing_period;
        $paymentMethodId = $request->payment_method_id;

        try {
            // Get price ID for new plan
            $newPriceId = $this->getPriceId($newPlanName, $newBillingPeriod);
            if (!$newPriceId) {
                return response()->json([
                    'success' => false,
                    'error' => 'Invalid plan configuration',
                ], 400);
            }

            // Check if user has active subscription
            $currentSubscription = $user->subscription('default');

            if ($currentSubscription && $currentSubscription->active()) {
                // SCHEDULE NEW SUBSCRIPTION (Pay now, start later)
                return $this->scheduleSubscriptionChange(
                    $user,
                    $currentSubscription,
                    $newPlanName,
                    $newBillingPeriod,
                    $newPriceId,
                    $paymentMethodId
                );
            } else {
                // CREATE IMMEDIATE SUBSCRIPTION (No existing subscription)
                return $this->createImmediateSubscription(
                    $user,
                    $newPlanName,
                    $newBillingPeriod,
                    $newPriceId,
                    $paymentMethodId
                );
            }
        } catch (\Exception $e) {
            \Log::error('Subscription creation failed: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Schedule Subscription Change (Option A - Using Subscription Schedules)
     */
    private function scheduleSubscriptionChange($user, $currentSubscription, $newPlanName, $newBillingPeriod, $newPriceId, $paymentMethodId)
    {
        DB::beginTransaction();

        try {
            // 1. Attach payment method to customer
            $user->updateDefaultPaymentMethod($paymentMethodId);

            // 2. Get current subscription details
            $stripeSubscription = $currentSubscription->asStripeSubscription();
            $currentPlanEndDate = Carbon::createFromTimestamp($stripeSubscription->current_period_end);

            // 3. Get price details to calculate amount
            $price = $this->stripe->prices->retrieve($newPriceId);
            $amount = $price->unit_amount / 100; // Convert cents to dollars

            // 4. Create one-time invoice to charge NOW
            $invoiceItem = $this->stripe->invoiceItems->create([
                'customer' => $user->stripe_id,
                'amount' => $price->unit_amount,
                'currency' => $price->currency,
                'description' => "Advance payment for {$newPlanName} ({$newBillingPeriod}) plan starting " . $currentPlanEndDate->format('M d, Y'),
            ]);

            // 5. Create and finalize invoice immediately
            $invoice = $this->stripe->invoices->create([
                'customer' => $user->stripe_id,
                'auto_advance' => true,
            ]);

            $invoice = $this->stripe->invoices->finalizeInvoice($invoice->id);
            $invoice = $this->stripe->invoices->pay($invoice->id);

            if ($invoice->status !== 'paid') {
                throw new \Exception('Payment failed');
            }

            // 6. Create Subscription Schedule
            $schedule = $this->stripe->subscriptionSchedules->create([
                'customer' => $user->stripe_id,
                'start_date' => $stripeSubscription->current_period_end,
                'end_behavior' => 'release',
                'phases' => [
                    [
                        'items' => [
                            [
                                'price' => $newPriceId,
                                'quantity' => 1,
                            ],
                        ],
                        'collection_method' => 'charge_automatically',
                        'billing_cycle_anchor' => 'phase_start',
                    ],
                ],
            ]);

            // 7. Save scheduled change to database
            $scheduledChange = ScheduledSubscriptionChange::create([
                'user_id' => $user->id,
                'stripe_schedule_id' => $schedule->id,
                'current_plan_name' => $currentSubscription->name,
                'new_plan_name' => $newPlanName,
                'new_billing_period' => $newBillingPeriod,
                'new_stripe_price_id' => $newPriceId,
                'amount' => $amount,
                'currency' => strtoupper($price->currency),
                'scheduled_start_date' => $currentPlanEndDate,
                'current_plan_end_date' => $currentPlanEndDate,
                'status' => 'scheduled',
                'charged_at' => now(),
                'metadata' => json_encode([
                    'invoice_id' => $invoice->id,
                    'payment_intent_id' => $invoice->payment_intent,
                ]),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Payment successful! Your {$newPlanName} plan will start on " . $currentPlanEndDate->format('M d, Y h:i A'),
                'subscription_id' => null,
                'scheduled_change_id' => $scheduledChange->id,
                'schedule_id' => $schedule->id,
                'amount_charged' => $amount,
                'currency' => strtoupper($price->currency),
                'starts_at' => $currentPlanEndDate->toIso8601String(),
                'invoice_id' => $invoice->id,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Create Immediate Subscription (No existing subscription)
     */
    private function createImmediateSubscription($user, $newPlanName, $newBillingPeriod, $newPriceId, $paymentMethodId)
    {
        try {
            $subscription = $user->newSubscription('default', $newPriceId)
                ->create($paymentMethodId, [
                    'email' => $user->email,
                ]);

            return response()->json([
                'success' => true,
                'message' => "Successfully subscribed to {$newPlanName} plan!",
                'subscription_id' => $subscription->stripe_id,
                'status' => $subscription->stripe_status,
            ]);

        } catch (\Exception $e) {
            throw $e;
        }
    }

    /**
     * Get Subscription with Scheduled Changes
     * GET /api/stripe/subscription
     */
    public function getSubscription(Request $request)
    {
        try {
            $user = $request->user();

            // Get active subscriptions
            $activeSubscriptions = [];
            $subscriptions = $user->subscriptions()->where('stripe_status', 'active')->get();

            foreach ($subscriptions as $subscription) {
                $stripeSubscription = $subscription->asStripeSubscription();

                $activeSubscriptions[] = [
                    'id' => $subscription->stripe_id,
                    'status' => $subscription->stripe_status,
                    'plan_name' => $subscription->name,
                    'billing_period' => $this->getBillingPeriod($stripeSubscription),
                    'amount' => $stripeSubscription->items->data[0]->price->unit_amount / 100,
                    'currency' => strtoupper($stripeSubscription->currency),
                    'current_period_start' => Carbon::createFromTimestamp($stripeSubscription->current_period_start)->toDateTimeString(),
                    'current_period_end' => Carbon::createFromTimestamp($stripeSubscription->current_period_end)->toDateTimeString(),
                    'current_period_start_date' => Carbon::createFromTimestamp($stripeSubscription->current_period_start)->toDateString(),
                    'current_period_end_date' => Carbon::createFromTimestamp($stripeSubscription->current_period_end)->toDateString(),
                    'cancel_at_period_end' => $subscription->onGracePeriod(),
                    'cancel_at' => $subscription->ends_at ? $subscription->ends_at->toDateTimeString() : null,
                    'canceled_at' => $subscription->ends_at ? $subscription->ends_at->toDateTimeString() : null,
                    'trial_end' => $subscription->trial_ends_at ? $subscription->trial_ends_at->toDateTimeString() : null,
                    'trial_start' => null,
                    'created_at' => $subscription->created_at->toDateString(),
                    'latest_invoice' => $stripeSubscription->latest_invoice,
                ];
            }

            // Get scheduled changes
            $scheduledChanges = ScheduledSubscriptionChange::where('user_id', $user->id)
                ->where('status', 'scheduled')
                ->get()
                ->map(function ($change) {
                    return [
                        'id' => $change->id,
                        'stripe_schedule_id' => $change->stripe_schedule_id,
                        'new_plan_name' => $change->new_plan_name,
                        'new_billing_period' => $change->new_billing_period,
                        'amount' => $change->amount,
                        'currency' => $change->currency,
                        'scheduled_start_date' => $change->scheduled_start_date->toDateTimeString(),
                        'current_plan_end_date' => $change->current_plan_end_date->toDateTimeString(),
                        'status' => $change->status,
                        'charged_at' => $change->charged_at ? $change->charged_at->toDateTimeString() : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'active_subscriptions' => $activeSubscriptions,
                'scheduled_changes' => $scheduledChanges,
                'upcoming_subscriptions' => [],
                'total_active' => count($activeSubscriptions),
                'total_scheduled' => count($scheduledChanges),
                'total_upcoming' => 0,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel Scheduled Subscription Change
     * POST /api/stripe/cancel-scheduled-change
     */
    public function cancelScheduledChange(Request $request)
    {
        $request->validate([
            'scheduled_change_id' => 'required|integer',
        ]);

        try {
            $user = $request->user();
            $scheduledChange = ScheduledSubscriptionChange::where('id', $request->scheduled_change_id)
                ->where('user_id', $user->id)
                ->where('status', 'scheduled')
                ->firstOrFail();

            // Cancel the schedule in Stripe
            if ($scheduledChange->stripe_schedule_id) {
                $this->stripe->subscriptionSchedules->update(
                    $scheduledChange->stripe_schedule_id,
                    ['end_behavior' => 'cancel']
                );

                $this->stripe->subscriptionSchedules->cancel($scheduledChange->stripe_schedule_id);
            }

            // Update status in database
            $scheduledChange->update(['status' => 'cancelled']);

            return response()->json([
                'success' => true,
                'message' => 'Scheduled subscription change cancelled successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Helper: Get Price ID
     */
    private function getPriceId($planName, $billingPeriod)
    {
        $prices = [
            'intermediate_monthly' => env('STRIPE_INTERMEDIATE_MONTHLY_PRICE_ID'),
            'intermediate_yearly' => env('STRIPE_INTERMEDIATE_YEARLY_PRICE_ID'),
            'professional_monthly' => env('STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID'),
            'professional_yearly' => env('STRIPE_PROFESSIONAL_YEARLY_PRICE_ID'),
        ];

        $key = $planName . '_' . $billingPeriod;
        return $prices[$key] ?? null;
    }

    /**
     * Helper: Get Billing Period from Stripe Subscription
     */
    private function getBillingPeriod($stripeSubscription)
    {
        $interval = $stripeSubscription->items->data[0]->price->recurring->interval;
        return $interval === 'year' ? 'yearly' : 'monthly';
    }
}
```

---

## 5. Webhook Handler

### Handle Subscription Schedule Events

```php
<?php

namespace App\Http\Controllers;

use App\Models\ScheduledSubscriptionChange;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class StripeWebhookController extends Controller
{
    /**
     * Handle Stripe Webhooks
     */
    public function handleWebhook(Request $request)
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $webhookSecret = env('STRIPE_WEBHOOK_SECRET');

        try {
            $event = \Stripe\Webhook::constructEvent(
                $payload,
                $sigHeader,
                $webhookSecret
            );

            // Handle different event types
            switch ($event->type) {
                case 'subscription_schedule.released':
                    $this->handleSubscriptionScheduleReleased($event->data->object);
                    break;

                case 'subscription_schedule.completed':
                    $this->handleSubscriptionScheduleCompleted($event->data->object);
                    break;

                case 'subscription_schedule.canceled':
                    $this->handleSubscriptionScheduleCanceled($event->data->object);
                    break;

                case 'customer.subscription.created':
                    $this->handleSubscriptionCreated($event->data->object);
                    break;

                default:
                    Log::info('Unhandled webhook event: ' . $event->type);
            }

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Webhook error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * When scheduled subscription is released (becomes active)
     */
    private function handleSubscriptionScheduleReleased($schedule)
    {
        Log::info('Subscription schedule released: ' . $schedule->id);

        $scheduledChange = ScheduledSubscriptionChange::where('stripe_schedule_id', $schedule->id)
            ->first();

        if ($scheduledChange) {
            $scheduledChange->update([
                'status' => 'active',
                'activated_at' => now(),
                'stripe_subscription_id' => $schedule->subscription ?? null,
            ]);

            Log::info('Scheduled change activated for user: ' . $scheduledChange->user_id);
        }
    }

    /**
     * When scheduled subscription completes
     */
    private function handleSubscriptionScheduleCompleted($schedule)
    {
        Log::info('Subscription schedule completed: ' . $schedule->id);

        $scheduledChange = ScheduledSubscriptionChange::where('stripe_schedule_id', $schedule->id)
            ->first();

        if ($scheduledChange) {
            $scheduledChange->update(['status' => 'completed']);
        }
    }

    /**
     * When scheduled subscription is canceled
     */
    private function handleSubscriptionScheduleCanceled($schedule)
    {
        Log::info('Subscription schedule canceled: ' . $schedule->id);

        $scheduledChange = ScheduledSubscriptionChange::where('stripe_schedule_id', $schedule->id)
            ->first();

        if ($scheduledChange && $scheduledChange->status === 'scheduled') {
            $scheduledChange->update(['status' => 'cancelled']);
        }
    }

    /**
     * When new subscription is created (from schedule)
     */
    private function handleSubscriptionCreated($subscription)
    {
        Log::info('Subscription created: ' . $subscription->id);

        // Find if this subscription was created from a schedule
        $scheduledChange = ScheduledSubscriptionChange::where('status', 'active')
            ->whereNull('stripe_subscription_id')
            ->where('user_id', function ($query) use ($subscription) {
                $query->select('id')
                    ->from('users')
                    ->where('stripe_id', $subscription->customer);
            })
            ->first();

        if ($scheduledChange) {
            $scheduledChange->update([
                'stripe_subscription_id' => $subscription->id,
            ]);
        }
    }
}
```

---

## 6. Routes

Add to `routes/api.php`:

```php
use App\Http\Controllers\StripeController;
use App\Http\Controllers\StripeWebhookController;

Route::middleware('auth:sanctum')->group(function () {
    // Subscriptions
    Route::post('stripe/create-subscription', [StripeController::class, 'createSubscription']);
    Route::get('stripe/subscription', [StripeController::class, 'getSubscription']);
    Route::post('stripe/cancel-subscription', [StripeController::class, 'cancelSubscription']);

    // Scheduled Changes
    Route::post('stripe/cancel-scheduled-change', [StripeController::class, 'cancelScheduledChange']);
});

// Webhook (no auth middleware)
Route::post('stripe/webhook', [StripeWebhookController::class, 'handleWebhook']);
```

---

## 7. Testing Guide

### Test Scenario 1: Schedule Subscription Change

**Request:**
```bash
POST /api/stripe/create-subscription
{
    "payment_method_id": "pm_xxx",
    "plan_name": "professional",
    "billing_period": "yearly"
}
```

**Expected Response:**
```json
{
    "success": true,
    "message": "Payment successful! Your professional plan will start on Jan 19, 2026 12:06 PM",
    "scheduled_change_id": 1,
    "schedule_id": "sub_sched_xxx",
    "amount_charged": 189.00,
    "currency": "USD",
    "starts_at": "2026-01-19T12:06:20.000000Z",
    "invoice_id": "in_xxx"
}
```

### Test Scenario 2: Get Subscription with Scheduled Changes

**Request:**
```bash
GET /api/stripe/subscription
```

**Expected Response:**
```json
{
    "success": true,
    "active_subscriptions": [...],
    "scheduled_changes": [
        {
            "id": 1,
            "new_plan_name": "professional",
            "new_billing_period": "yearly",
            "amount": 189.00,
            "scheduled_start_date": "2026-01-19 12:06:20",
            "status": "scheduled",
            "charged_at": "2025-12-20 10:30:00"
        }
    ]
}
```

---

## 8. Common Issues & Solutions

### Issue 1: Payment Fails
**Solution:** Wrap invoice payment in try-catch, refund invoice item if payment fails

### Issue 2: Schedule Not Created
**Solution:** Check that current subscription exists and is active before creating schedule

### Issue 3: Double Billing
**Solution:** Use one-time invoice for advance payment, not recurring subscription

### Issue 4: Schedule Not Starting
**Solution:** Verify webhook is properly configured and handling `subscription_schedule.released`

---

## 9. Security Considerations

1. **Validate webhook signatures** - Always verify Stripe webhook signatures
2. **Check user ownership** - Ensure user owns the subscription they're modifying
3. **Transaction safety** - Use DB transactions for multi-step operations
4. **Log everything** - Log all subscription changes for audit trail
5. **Idempotency** - Handle duplicate webhook events gracefully

---

## 10. Deployment Checklist

- [ ] Run migration: `php artisan migrate`
- [ ] Add all STRIPE_*_PRICE_ID to .env
- [ ] Configure Stripe webhook endpoint
- [ ] Add webhook events: `subscription_schedule.*`, `customer.subscription.*`
- [ ] Test with Stripe test mode first
- [ ] Monitor logs for first week after deployment

---

## End of Documentation
