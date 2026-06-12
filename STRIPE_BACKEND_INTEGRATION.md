# Stripe Payment Integration - Laravel Backend Guide

This document outlines the complete **Laravel backend** implementation required for Stripe payment integration in the StashtStudio application (React.js frontend).

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Stripe Account Setup](#stripe-account-setup)
4. [Laravel Installation & Setup](#laravel-installation--setup)
5. [Environment Variables](#environment-variables)
6. [Database Migrations](#database-migrations)
7. [Models & Relationships](#models--relationships)
8. [API Routes](#api-routes)
9. [Controllers Implementation](#controllers-implementation)
10. [Stripe Webhooks](#stripe-webhooks)
11. [Security & Middleware](#security--middleware)
12. [Testing](#testing)
13. [Frontend Integration Points](#frontend-integration-points)

---

## Tech Stack

- **Backend**: Laravel 10+ (PHP 8.1+)
- **Frontend**: React.js
- **Payment Gateway**: Stripe
- **Database**: MySQL/PostgreSQL
- **Package**: Laravel Cashier (Stripe)

---

## Prerequisites

- Laravel 10+ installed
- PHP 8.1 or higher
- Composer
- MySQL/PostgreSQL database
- Stripe Account (create at https://stripe.com)
- SSL Certificate (HTTPS required for production)

---

## Stripe Account Setup

### Step 1: Create Stripe Account
1. Go to https://dashboard.stripe.com/register
2. Complete registration
3. Verify email and business details

### Step 2: Get API Keys
1. Navigate to **Developers → API Keys**
2. Copy the following keys:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

### Step 3: Configure Products and Prices
1. Go to **Products** in Stripe Dashboard
2. Create two products:

#### Product 1: Intermediate Plan
- **Name**: Intermediate Plan
- **Description**: Power users plan with 1TB storage
- **Pricing**:
  - Monthly: $9.00/month (recurring)
  - Yearly: $7.47/month billed annually ($89.64/year)

#### Product 2: Professional Plan
- **Name**: Professional Plan
- **Description**: Teams & organizations plan with 10TB storage
- **Pricing**:
  - Monthly: $19.00/month (recurring)
  - Yearly: $15.77/month billed annually ($189.24/year)

3. **Copy the Price IDs** for each plan (e.g., `price_xxxxx`)

---

## Laravel Installation & Setup

### Step 1: Install Laravel Cashier

Laravel Cashier provides an expressive, fluent interface to Stripe's subscription billing services.

```bash
composer require laravel/cashier
```

### Step 2: Publish Cashier Migrations

```bash
php artisan vendor:publish --tag="cashier-migrations"
```

### Step 3: Run Migrations

```bash
php artisan migrate
```

This creates the following tables:
- `subscriptions` - Stores subscription data
- `subscription_items` - Stores subscription line items

---

## Environment Variables

Add these to your `.env` file:

```env
# Stripe API Keys
STRIPE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Stripe Price IDs
STRIPE_PRICE_INTERMEDIATE_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_INTERMEDIATE_YEARLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL_YEARLY=price_xxxxxxxxxxxxxxxxxxxx

# Cashier Settings
CASHIER_CURRENCY=usd
CASHIER_CURRENCY_LOCALE=en_US
CASHIER_LOGGER=stack

# Application URLs
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:8000
```

### Update `config/services.php`

Add Stripe configuration:

```php
'stripe' => [
    'key' => env('STRIPE_KEY'),
    'secret' => env('STRIPE_SECRET'),
    'webhook' => [
        'secret' => env('STRIPE_WEBHOOK_SECRET'),
        'tolerance' => env('STRIPE_WEBHOOK_TOLERANCE', 300),
    ],
],
```

---

## Database Migrations

### Additional Migration: Payment Methods

Create a migration for storing payment method details:

```bash
php artisan make:migration create_payment_methods_table
```

**Migration file** (`database/migrations/xxxx_create_payment_methods_table.php`):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('stripe_payment_method_id');
            $table->string('card_brand')->nullable();
            $table->string('card_last4', 4)->nullable();
            $table->integer('card_exp_month')->nullable();
            $table->integer('card_exp_year')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('payment_methods');
    }
};
```

### Additional Migration: Payment History

```bash
php artisan make:migration create_payment_history_table
```

**Migration file**:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('payment_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('stripe_payment_intent_id')->nullable();
            $table->string('stripe_invoice_id')->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('usd');
            $table->string('status', 50);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('payment_history');
    }
};
```

Run migrations:
```bash
php artisan migrate
```

---

## Models & Relationships

### Update User Model

**File**: `app/Models/User.php`

```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Cashier\Billable;

class User extends Authenticatable
{
    use Billable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    // Relationships
    public function paymentMethods()
    {
        return $this->hasMany(PaymentMethod::class);
    }

    public function paymentHistory()
    {
        return $this->hasMany(PaymentHistory::class);
    }
}
```

### Create PaymentMethod Model

```bash
php artisan make:model PaymentMethod
```

**File**: `app/Models/PaymentMethod.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    protected $fillable = [
        'user_id',
        'stripe_payment_method_id',
        'card_brand',
        'card_last4',
        'card_exp_month',
        'card_exp_year',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

### Create PaymentHistory Model

```bash
php artisan make:model PaymentHistory
```

**File**: `app/Models/PaymentHistory.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentHistory extends Model
{
    protected $table = 'payment_history';

    protected $fillable = [
        'user_id',
        'stripe_payment_intent_id',
        'stripe_invoice_id',
        'amount',
        'currency',
        'status',
        'description',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

---

## API Routes

**File**: `routes/api.php`

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StripeController;

Route::middleware('auth:sanctum')->group(function () {
    // Subscription endpoints
    Route::post('/stripe/create-setup-intent', [StripeController::class, 'createSetupIntent']);
    Route::post('/stripe/create-subscription', [StripeController::class, 'createSubscription']);
    Route::get('/stripe/subscription', [StripeController::class, 'getSubscription']);
    Route::post('/stripe/cancel-subscription', [StripeController::class, 'cancelSubscription']);
    Route::post('/stripe/resume-subscription', [StripeController::class, 'resumeSubscription']);
    Route::post('/stripe/update-subscription', [StripeController::class, 'updateSubscription']);

    // Payment methods
    Route::get('/stripe/payment-methods', [StripeController::class, 'getPaymentMethods']);
    Route::post('/stripe/payment-methods', [StripeController::class, 'addPaymentMethod']);
    Route::delete('/stripe/payment-methods/{id}', [StripeController::class, 'deletePaymentMethod']);

    // Payment history
    Route::get('/stripe/invoices', [StripeController::class, 'getInvoices']);
});

// Webhook (no auth required)
Route::post('/stripe/webhook', [StripeController::class, 'handleWebhook']);
```

---

## Controllers Implementation

### Create Stripe Controller

```bash
php artisan make:controller StripeController
```

**File**: `app/Http/Controllers/StripeController.php`

```php
<?php

namespace App\Http\Controllers;

use App\Models\PaymentMethod;
use App\Models\PaymentHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Cashier;
use Stripe\Stripe;

class StripeController extends Controller
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Create Setup Intent for collecting payment method
     */
    public function createSetupIntent(Request $request)
    {
        try {
            $user = $request->user();

            // Create Stripe customer if doesn't exist
            if (!$user->stripe_id) {
                $user->createAsStripeCustomer();
            }

            $setupIntent = $user->createSetupIntent();

            return response()->json([
                'success' => true,
                'clientSecret' => $setupIntent->client_secret,
                'customerId' => $user->stripe_id,
            ]);
        } catch (\Exception $e) {
            Log::error('Setup Intent Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

        /**
        * Create new subscription
        */
    public function createSubscription(Request $request)
    {
        $request->validate([
            'payment_method_id' => 'required|string',
            'price_id' => 'required|string',
            'plan_name' => 'required|string|in:intermediate,professional',
            'billing_period' => 'required|string|in:monthly,yearly',
        ]);

        try {
            $user = $request->user();

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

            // Create subscription
            $subscription = $user->newSubscription('default', $request->price_id)
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
     * Get current subscription
     */
    public function getSubscription(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->subscribed('default')) {
                return response()->json([
                    'success' => true,
                    'subscription' => null,
                ]);
            }

            $subscription = $user->subscription('default');

            return response()->json([
                'success' => true,
                'subscription' => [
                    'id' => $subscription->stripe_id,
                    'status' => $subscription->stripe_status,
                    'plan' => $subscription->stripe_price,
                    'current_period_end' => $subscription->ends_at ?? $subscription->asStripeSubscription()->current_period_end,
                    'cancel_at_period_end' => $subscription->onGracePeriod(),
                    'trial_ends_at' => $subscription->trial_ends_at,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Get Subscription Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel subscription
     */
    public function cancelSubscription(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->subscribed('default')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No active subscription found'
                ], 404);
            }

            $user->subscription('default')->cancel();

            return response()->json([
                'success' => true,
                'message' => 'Subscription will cancel at period end',
            ]);
        } catch (\Exception $e) {
            Log::error('Cancel Subscription Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Resume subscription
     */
    public function resumeSubscription(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->subscription('default')->onGracePeriod()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Subscription is not on grace period'
                ], 400);
            }

            $user->subscription('default')->resume();

            return response()->json([
                'success' => true,
                'message' => 'Subscription resumed successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Resume Subscription Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update subscription (upgrade/downgrade)
     */
    public function updateSubscription(Request $request)
    {
        $request->validate([
            'price_id' => 'required|string',
        ]);

        try {
            $user = $request->user();

            if (!$user->subscribed('default')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No active subscription found'
                ], 404);
            }

            $user->subscription('default')->swap($request->price_id);

            return response()->json([
                'success' => true,
                'message' => 'Subscription updated successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Update Subscription Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get payment methods
     */
    public function getPaymentMethods(Request $request)
    {
        try {
            $user = $request->user();
            $paymentMethods = $user->paymentMethods();

            return response()->json([
                'success' => true,
                'payment_methods' => $paymentMethods->map(function ($pm) {
                    return [
                        'id' => $pm->id,
                        'brand' => $pm->card->brand,
                        'last4' => $pm->card->last4,
                        'exp_month' => $pm->card->exp_month,
                        'exp_year' => $pm->card->exp_year,
                    ];
                }),
            ]);
        } catch (\Exception $e) {
            Log::error('Get Payment Methods Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get invoices/payment history
     */
    public function getInvoices(Request $request)
    {
        try {
            $user = $request->user();
            $invoices = $user->invoices();

            return response()->json([
                'success' => true,
                'invoices' => collect($invoices)->map(function ($invoice) {
                    return [
                        'id' => $invoice->id,
                        'amount' => $invoice->total() / 100,
                        'currency' => $invoice->currency,
                        'status' => $invoice->status,
                        'invoice_pdf' => $invoice->invoice_pdf,
                        'created' => $invoice->date()->toDateTimeString(),
                    ];
                }),
            ]);
        } catch (\Exception $e) {
            Log::error('Get Invoices Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Handle Stripe webhooks
     */
    public function handleWebhook(Request $request)
    {
        try {
            $payload = $request->getContent();
            $sig_header = $request->header('Stripe-Signature');
            $webhook_secret = config('services.stripe.webhook.secret');

            $event = \Stripe\Webhook::constructEvent(
                $payload,
                $sig_header,
                $webhook_secret
            );

            // Handle the event
            switch ($event->type) {
                case 'invoice.payment_succeeded':
                    $this->handleInvoicePaymentSucceeded($event->data->object);
                    break;

                case 'invoice.payment_failed':
                    $this->handleInvoicePaymentFailed($event->data->object);
                    break;

                case 'customer.subscription.deleted':
                    $this->handleSubscriptionDeleted($event->data->object);
                    break;

                case 'customer.subscription.updated':
                    $this->handleSubscriptionUpdated($event->data->object);
                    break;

                default:
                    Log::info('Unhandled webhook event: ' . $event->type);
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Webhook Error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Handle successful invoice payment
     */
    private function handleInvoicePaymentSucceeded($invoice)
    {
        $user = Cashier::findBillable($invoice->customer);

        if ($user) {
            PaymentHistory::create([
                'user_id' => $user->id,
                'stripe_payment_intent_id' => $invoice->payment_intent,
                'stripe_invoice_id' => $invoice->id,
                'amount' => $invoice->amount_paid / 100,
                'currency' => $invoice->currency,
                'status' => 'succeeded',
                'description' => 'Subscription payment',
            ]);
        }
    }

    /**
     * Handle failed invoice payment
     */
    private function handleInvoicePaymentFailed($invoice)
    {
        $user = Cashier::findBillable($invoice->customer);

        if ($user) {
            PaymentHistory::create([
                'user_id' => $user->id,
                'stripe_invoice_id' => $invoice->id,
                'amount' => $invoice->amount_due / 100,
                'currency' => $invoice->currency,
                'status' => 'failed',
                'description' => 'Subscription payment failed',
            ]);

            // TODO: Send email notification to user
        }
    }

    /**
     * Handle subscription deletion
     */
    private function handleSubscriptionDeleted($subscription)
    {
        Log::info('Subscription deleted: ' . $subscription->id);
        // Additional logic if needed
    }

    /**
     * Handle subscription update
     */
    private function handleSubscriptionUpdated($subscription)
    {
        Log::info('Subscription updated: ' . $subscription->id);
        // Additional logic if needed
    }
}
```

---

## Stripe Webhooks

### Step 1: Configure Webhook Endpoint in Stripe Dashboard

1. Go to **Developers → Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy **Signing Secret** and add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Step 2: Disable CSRF for Webhook Route

**File**: `app/Http/Middleware/VerifyCsrfToken.php`

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    protected $except = [
        'api/stripe/webhook',
    ];
}
```

---

## Security & Middleware

### Enable CORS for React Frontend

**File**: `config/cors.php`

```php
<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:3000')],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

### Setup Laravel Sanctum for API Authentication

```bash
php artisan vendor:publish --provider="Laravel\Sanctum\ServiceProvider"
php artisan migrate
```

**File**: `app/Http/Kernel.php`

Add to `api` middleware group:
```php
'api' => [
    \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
    'throttle:api',
    \Illuminate\Routing\Middleware\SubstituteBindings::class,
],
```

---

## Testing

### Test with Stripe CLI

Install Stripe CLI:
```bash
# Download from: https://stripe.com/docs/stripe-cli
```

Login and forward webhooks to local server:
```bash
stripe login
stripe listen --forward-to localhost:8000/api/stripe/webhook
```

### Test Card Numbers

Use these test cards in Stripe test mode:
- **Success**: `4242 4242 4242 4242`
- **Requires Authenticat0ion**: `4000 0027 6000 3184`
- **Declined**: `4000 0000 0000 0002`
- Any future expiry (e.g., `12/25`)
- Any 3-digit CVC

### Test Subscription Creation

```bash
# Create test user
php artisan tinker

$user = User::find(1);
$user->newSubscription('default', 'price_xxxxx')->create('pm_card_visa');
```

---

## Frontend Integration Points

### React Environment Variables

Add to React `.env`:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
```

### API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/stripe/create-setup-intent` | POST | ✅ | Get client secret for payment |
| `/api/stripe/create-subscription` | POST | ✅ | Create subscription |
| `/api/stripe/subscription` | GET | ✅ | Get subscription status |
| `/api/stripe/cancel-subscription` | POST | ✅ | Cancel subscription |
| `/api/stripe/resume-subscription` | POST | ✅ | Resume canceled subscription |
| `/api/stripe/update-subscription` | POST | ✅ | Upgrade/downgrade plan |
| `/api/stripe/payment-methods` | GET | ✅ | Get saved payment methods |
| `/api/stripe/invoices` | GET | ✅ | Get payment history |
| `/api/stripe/webhook` | POST | ❌ | Handle Stripe events |

### Example React Integration (Next Steps)

```javascript
// In React - Get Setup Intent
const response = await fetch('http://localhost:8000/api/stripe/create-setup-intent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const { clientSecret } = await response.json();

// Use Stripe.js to confirm payment
const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
const { error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { ... }
  }
});
```

---

## Additional Laravel Commands

### Clear cache
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```

### Run Laravel server
```bash
php artisan serve
```

### Create controller
```bash
php artisan make:controller StripeController
```

### Create migration
```bash
php artisan make:migration create_table_name
```

---

## Checklist

- [ ] Install Laravel Cashier: `composer require laravel/cashier`
- [ ] Publish migrations: `php artisan vendor:publish --tag="cashier-migrations"`
- [ ] Run migrations: `php artisan migrate`
- [ ] Add Stripe keys to `.env`
- [ ] Add `Billable` trait to User model
- [ ] Create StripeController
- [ ] Add API routes
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Disable CSRF for webhook route
- [ ] Setup CORS for React
- [ ] Test with Stripe test cards
- [ ] Configure Stripe products and prices
- [ ] Copy price IDs to `.env`

---

## Support & Documentation

- **Laravel Cashier Docs**: https://laravel.com/docs/10.x/billing
- **Stripe API Docs**: https://stripe.com/docs/api
- **Stripe PHP Library**: https://github.com/stripe/stripe-php

---

## Questions?

If you need clarification on any part of this implementation, please contact the frontend team or refer to the official Laravel Cashier documentation.
