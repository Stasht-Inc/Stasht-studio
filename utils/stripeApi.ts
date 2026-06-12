import axios from 'axios';

// Get API base URL - use proxy in development to avoid CORS issues
const getStripeApiUrl = () => {
  // Use environment variable if set (production)
  if (import.meta.env.VITE_STRIPE_API_URL) {
    return import.meta.env.VITE_STRIPE_API_URL;
  }

  // Development mode: use Vite proxy
  if (import.meta.env.DEV) {
    console.log('🔍 Development mode: Using Vite proxy for Stripe API requests');
    return '/api/react';
  }

  // Production fallback: assume same domain with /api prefix
  return `${window.location.origin}/api/react`;
};

const STRIPE_API_URL = getStripeApiUrl();

// Create axios instance with default config
const stripeAxios = axios.create({
  baseURL: STRIPE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
stripeAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('stasht_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SetupIntentResponse {
  success: boolean;
  clientSecret: string;
  customerId: string;
  error?: string;
}

export interface PaymentIntentResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  error?: string;
}

export interface CreateSubscriptionRequest {
  payment_method_id: string;
  plan_name: 'intermediate' | 'professional';
  billing_period: 'monthly' | 'yearly';
}

export interface SubscriptionResponse {
  success: boolean;
  subscription_id?: string;
  scheduled_change_id?: number;
  schedule_id?: string;
  amount_charged?: number;
  currency?: string;
  starts_at?: string;
  invoice_id?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface SubscriptionItem {
  id: string;
  status: string;
  plan_name: string;
  billing_period: string;
  amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  current_period_start_date: string;
  current_period_end_date: string;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  canceled_at: string | null;
  trial_end: string | null;
  trial_start: string | null;
  created_at: string;
  latest_invoice: string;
}

export interface ScheduledChange {
  id: number;
  stripe_schedule_id: string;
  new_plan_name: string;
  new_billing_period: string;
  amount: number | string;
  currency: string;
  scheduled_start_date: string;
  current_plan_end_date: string;
  status: string;
  charged_at: string | null;
}

export interface CurrentSubscriptionResponse {
  success: boolean;
  active_subscriptions?: SubscriptionItem[];
  scheduled_changes?: ScheduledChange[];
  upcoming_subscriptions?: SubscriptionItem[];
  total_active?: number;
  total_scheduled?: number;
  total_upcoming?: number;
  error?: string;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_pdf: string;
  created: string;
}

export interface BillingHistoryItem {
  id: number;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string;
  amount: string;
  currency: string;
  status: string;
  description: string;
  invoice_pdf: string;
  plan_name: string;
  billing_period: string;
  payment_date: string;
  payment_time: string;
  payment_datetime: string;
}

export interface BillingHistoryResponse {
  success: boolean;
  billing_history?: BillingHistoryItem[];
  error?: string;
}

export const stripeApi = {
  /**
   * Create a Setup Intent for collecting payment method
   */
  async createSetupIntent(): Promise<SetupIntentResponse> {
    try {
      const response = await stripeAxios.post('/stripe/create-setup-intent');
      return response.data;
    } catch (error: any) {
      console.error('Error creating setup intent:', error);
      return {
        success: false,
        clientSecret: '',
        customerId: '',
        error: error.response?.data?.error || error.message || 'Failed to create setup intent',
      };
    }
  },

  /**
   * Create a Payment Intent for one-time credit purchase
   */
  async createPaymentIntent(
    packageId: string,
    amount: number,
    stripePriceId: string
  ): Promise<PaymentIntentResponse> {
    try {
      const response = await stripeAxios.post('/stripe/create-payment-intent', {
        package_id: packageId,
        amount: amount,
        currency: 'usd',
        price_id: stripePriceId,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        clientSecret: '',
        paymentIntentId: '',
        amount: 0,
        currency: 'usd',
        error: error.response?.data?.error || error.message || 'Failed to create payment intent',
      };
    }
  },

  /**
   * Create a new subscription
   */
  async createSubscription(data: CreateSubscriptionRequest): Promise<SubscriptionResponse> {
    try {
      const response = await stripeAxios.post('/stripe/create-subscription', data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to create subscription',
      };
    }
  },

  /**
   * Get current subscription
   */
  async getCurrentSubscription(): Promise<CurrentSubscriptionResponse> {
    try {
      const response = await stripeAxios.get('/stripe/subscription');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch subscription',
      };
    }
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.post('/stripe/cancel-subscription');
      return response.data;
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to cancel subscription',
      };
    }
  },

  /**
   * Resume subscription
   */
  async resumeSubscription(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.post('/stripe/resume-subscription');
      return response.data;
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to resume subscription',
      };
    }
  },

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(priceId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.post('/stripe/update-subscription', { price_id: priceId });
      return response.data;
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to update subscription',
      };
    }
  },

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<{ success: boolean; payment_methods?: PaymentMethod[]; error?: string }> {
    try {
      const response = await stripeAxios.get('/stripe/payment-methods');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching payment methods:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch payment methods',
      };
    }
  },

  /**
   * Add payment method
   */
  async addPaymentMethod(paymentMethodId: string, setAsDefault: boolean = false): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.post('/stripe/payment-methods', {
        payment_method_id: paymentMethodId,
        set_as_default: setAsDefault,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to add payment method',
      };
    }
  },

  /**
   * Delete payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.delete(`/stripe/payment-methods/${paymentMethodId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to delete payment method',
      };
    }
  },

  /**
   * Get invoices/payment history
   */
  async getInvoices(): Promise<{ success: boolean; invoices?: Invoice[]; error?: string }> {
    try {
      const response = await stripeAxios.get('/stripe/invoices');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch invoices',
      };
    }
  },

  /**
   * Get billing history
   */
  async getBillingHistory(): Promise<BillingHistoryResponse> {
    try {
      const response = await stripeAxios.get('/stripe/billing-history');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching billing history:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch billing history',
      };
    }
  },

  /**
   * Downgrade to Starter (free) plan - for users with no active paid subscription
   */
  async downgradeToStarter(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.post('/stripe/downgrade-to-starter');
      return response.data;
    } catch (error: any) {
      console.error('Error downgrading to starter:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to downgrade to starter',
      };
    }
  },

  /**
   * Cancel scheduled subscription change
   */
  async cancelScheduledChange(scheduledChangeId: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await stripeAxios.post('/stripe/cancel-scheduled-change', {
        scheduled_change_id: scheduledChangeId,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error canceling scheduled change:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to cancel scheduled change',
      };
    }
  },
};

export default stripeApi;
