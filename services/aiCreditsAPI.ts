// AI Credits API service functions
import { apiRequest } from '../utils/authUtils';

// AI Credits API response interfaces
export interface CreditBalance {
  total_credits: number;
  monthly_credits: {
    available: number;
    allocation: number;
    used_this_month: number;
    usage_percentage: number;
    next_reset_date: string;
    days_until_reset: number;
  };
  addon_credits: {
    available: number;
    total_purchased: number;
    breakdown: AddonCredit[];
  };
  plan: {
    name: string;
    monthly_allocation: number;
  };
}

export interface AddonCredit {
  purchase_id: number;
  credits_remaining: number;
  credits_purchased?: number;
  description?: string;
  purchased_at: string;
  expires_at: string;
  days_until_expiration: number;
}

export interface CreditCheckResponse {
  has_sufficient_credits: boolean;
  total_available: number;
  credits_needed: number;
  balance_after?: number;
  shortage?: number;
  purchase_options?: PurchaseOptions;
}

export interface PurchaseOptions {
  packages: CreditPackage[];
  current_balance: {
    monthly: number;
    addon: number;
    total: number;
  };
}

export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  price_per_credit: number;
  currency: string;
  expiration_months: number;
  stripe_price_id: string;
  savings?: string;
}

export interface UsageHistoryResponse {
  summary: {
    total_credits_used: number;
    by_service: {
      ai_captions: number;
      ai_memory_wizard: number;
    };
  };
  usage: UsageItem[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_records: number;
    per_page: number;
  };
}

export interface UsageItem {
  id: number;
  operation_type: 'ai_captions' | 'ai_memory_wizard';
  credits_consumed: number;
  memory_id: number | null;
  image_id: number | null;
  created_at: string;
  memory?: {
    id: number;
    title: string;
    published_url: string;
  };
  memory_name?: string;
}

export interface PurchaseResponse {
  purchase_id: number;
  credits_purchased: number;
  amount_paid: number;
  currency: string;
  purchased_at: string;
  expires_at: string;
  days_until_expiration: number;
  new_balance: {
    monthly: number;
    addon: number;
    total: number;
  };
}

// AI Credits API service
export const aiCreditsAPI = {
  // Get credit balance
  async getBalance(): Promise<CreditBalance> {
    const response = await apiRequest('/ai-credits/balance', {
      method: 'GET',
    });
    // API returns { status: 1, data: {...} }, we need the inner data
    return response.data?.data || response.data;
  },

  // Check if user has sufficient credits
  async checkSufficientCredits(
    operationType: 'ai_captions' | 'ai_memory_wizard',
    creditsNeeded: number
  ): Promise<CreditCheckResponse> {
    const response = await apiRequest('/ai-credits/check', {
      method: 'POST',
      body: JSON.stringify({
        operation_type: operationType,
        credits_needed: creditsNeeded,
      }),
    });
    // API returns { status: 1, data: {...} }, we need the inner data
    return response.data?.data || response.data;
  },

  // Get usage history
  async getUsageHistory(params?: {
    from_date?: string;
    to_date?: string;
    operation_type?: 'ai_captions' | 'ai_memory_wizard';
    page?: number;
    per_page?: number;
  }): Promise<UsageHistoryResponse> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const url = `/ai-credits/usage-history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiRequest(url, {
      method: 'GET',
    });
    return response.data?.data || response.data;
  },

  // Get purchase options
  async getPurchaseOptions(): Promise<PurchaseOptions> {
    const response = await apiRequest('/ai-credits/purchase-options', {
      method: 'GET',
    });
    return response.data?.data || response.data;
  },

  // Purchase add-on credits
  async purchaseCredits(
    packageId: string,
    paymentMethodId: string,
    paymentIntentId?: string,
    invoicePdf?: string,
    stripeInvoiceId?: string
  ): Promise<PurchaseResponse> {
    const body: any = {
      package_id: packageId,
      payment_method_id: paymentMethodId,
    };

    // Always include payment_intent_id (required for backend to fetch receipt)
    if (paymentIntentId) {
      body.payment_intent_id = paymentIntentId;
    }

    // Include invoice_pdf even if undefined (backend will fetch it)
    body.invoice_pdf = invoicePdf || null;

    // Include stripe_invoice_id even if undefined
    body.stripe_invoice_id = stripeInvoiceId || null;

    console.log('🚀 aiCreditsAPI.purchaseCredits - Sending to backend:');
    console.log('  📦 package_id:', body.package_id);
    console.log('  💳 payment_method_id:', body.payment_method_id);
    console.log('  🎫 payment_intent_id:', body.payment_intent_id);
    console.log('  📄 invoice_pdf:', body.invoice_pdf || '(null - backend will fetch)');
    console.log('  🧾 stripe_invoice_id:', body.stripe_invoice_id || '(null - rarely exists)');
    console.log('  📋 Full body:', body);

    const response = await apiRequest('/ai-credits/purchase', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    console.log('✅ Backend Response:', response);

    return response.data?.data || response.data;
  },
};
