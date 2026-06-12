import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { Button } from './ui/button';
import { aiCreditsAPI } from '../services/aiCreditsAPI';
import { stripeApi } from '../utils/stripeApi';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CreditsPurchasePaymentForm } from './CreditsPurchasePaymentForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  price_per_credit: number;
  currency: string;
  expiration_months: number;
  stripe_price_id: string;
  savings?: string;
}

interface PurchaseCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages?: CreditPackage[];
  onPurchaseSuccess?: () => void;
}

export function PurchaseCreditsModal({
  isOpen,
  onClose,
  packages,
  onPurchaseSuccess
}: PurchaseCreditsModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [isLoadingPaymentIntent, setIsLoadingPaymentIntent] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch current balance when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCurrentBalance();
    }
  }, [isOpen]);

  const fetchCurrentBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const balance = await aiCreditsAPI.getBalance();
      setCurrentBalance(balance.total_credits);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  if (!isOpen) return null;

  const handlePurchase = async () => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }

    setIsLoadingPaymentIntent(true);
    const toastId = toast.loading('Preparing payment...');

    try {
      // Get selected package details
      const pkg = packages?.find(p => p.id === selectedPackage);
      if (!pkg) throw new Error('Package not found');

      // Validate stripe_price_id exists
      if (!pkg.stripe_price_id) {
        throw new Error('Stripe price ID not found for selected package');
      }

      // Create PaymentIntent via backend
      const amount = Math.round(pkg.price * 100); // Convert to cents
      const response = await stripeApi.createPaymentIntent(
        selectedPackage,
        amount,
        pkg.stripe_price_id
      );

      if (response.success && response.clientSecret) {
        setClientSecret(response.clientSecret);
        setShowPaymentForm(true);
        toast.dismiss(toastId);
      } else {
        // Check if it's a 404 error (route not found)
        if (response.error?.includes('route') || response.error?.includes('not found') || response.error?.includes('404')) {
          toast.error(
            'Backend endpoint not configured. Please add /stripe/create-payment-intent endpoint.',
            { id: toastId, duration: 6000 }
          );
          console.error(
            '❌ Backend Missing: Add POST /stripe/create-payment-intent endpoint. See BACKEND_ENDPOINT_NEEDED.md for details.'
          );
        } else {
          throw new Error(response.error || 'Failed to initialize payment');
        }
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      // Check if error message indicates missing route
      const errorMessage = error.message || '';
      if (errorMessage.includes('route') || errorMessage.includes('not found') || errorMessage.includes('404')) {
        toast.error(
          'Backend endpoint not configured. Please add the Stripe PaymentIntent endpoint to your Laravel backend.',
          { id: toastId, duration: 6000 }
        );
        console.error(
          '❌ Backend Missing: Add POST /api/react/stripe/create-payment-intent endpoint.',
          '\nSee BACKEND_ENDPOINT_NEEDED.md for implementation details.'
        );
      } else {
        toast.error(errorMessage || 'Failed to initialize payment', { id: toastId });
      }
    } finally {
      setIsLoadingPaymentIntent(false);
    }
  };

  const handlePaymentSuccess = async (
    paymentIntentId: string,
    paymentMethodId: string,
    invoicePdf?: string,
    stripeInvoiceId?: string
  ) => {
    const toastId = toast.loading('Completing purchase...');

    console.log('📤 Calling /ai-credits/purchase API with:', {
      package_id: selectedPackage,
      payment_method_id: paymentMethodId,
      payment_intent_id: paymentIntentId,
      invoice_pdf: invoicePdf,
      stripe_invoice_id: stripeInvoiceId
    });

    try {
      // Call backend purchase API with payment details
      const result = await aiCreditsAPI.purchaseCredits(
        selectedPackage!,
        paymentMethodId,
        paymentIntentId,
        invoicePdf,
        stripeInvoiceId
      );

      console.log('✅ Purchase API response:', result);

      if (result) {
        toast.success(
          `Successfully purchased ${result.credits_purchased} credits!`,
          { id: toastId, duration: 5000 }
        );

        // Close payment form
        setShowPaymentForm(false);

        // Close main modal
        onClose();

        // Trigger success callback to refresh credit balance
        if (onPurchaseSuccess) {
          onPurchaseSuccess();
        }
      } else {
        throw new Error('Purchase failed');
      }
    } catch (error: any) {
      console.error('Purchase completion error:', error);
      toast.error(
        error.message || 'Purchase failed. Please contact support.',
        { id: toastId }
      );

      // Close payment form but keep modal open for retry
      setShowPaymentForm(false);
    }
  };

  const handlePaymentBack = () => {
    setShowPaymentForm(false);
    setClientSecret('');
  };

  return (
    <>
      {!showPaymentForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100">
                  <Sparkles className="w-5 h-5 text-[#6C60FF]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Purchase AI Credits</h2>
                  <p className="text-sm text-gray-600">
                    {isLoadingBalance ? (
                      'Loading balance...'
                    ) : (
                      `Current balance: ${currentBalance || 0} credits`
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

        {/* Packages */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages?.map((pkg) => {
              const isSelected = selectedPackage === pkg.id;
              const isPopular = pkg.id === '500_credits';

              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`relative cursor-pointer rounded-xl border-2 p-6 transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                        Popular
                      </span>
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">
                      {pkg.credits}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">Credits</p>

                    <div className="mb-4">
                      <div className="text-2xl font-bold text-gray-900">
                        ${pkg.price}
                      </div>
                      <div className="text-xs text-gray-500">
                        ${pkg.price_per_credit.toFixed(3)} per credit
                      </div>
                    </div>

                    {pkg.savings && (
                      <div className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full mb-4">
                        {pkg.savings}
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      Expires in {pkg.expiration_months} months
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  About AI Credits
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Credits roll over month-to-month until expiration</li>
                  <li>• Use credits for AI Campaign Wizard (2 credits) and AI Captions (1 credit)</li>
                  <li>• Credits expire {packages?.[0]?.expiration_months || 3} months after purchase</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={!selectedPackage || isLoadingPaymentIntent}
                className="px-6 bg-gradient-to-r from-[#6C60FF] to-[#5B52FF] hover:from-[#5B52FF] hover:to-[#4A42E5] text-white"
              >
                {isLoadingPaymentIntent ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Purchase Credits'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Elements stripe={stripePromise}>
          <CreditsPurchasePaymentForm
            isOpen={showPaymentForm}
            onClose={onClose}
            onBack={handlePaymentBack}
            packageId={selectedPackage!}
            packageName={`${packages?.find(p => p.id === selectedPackage)?.credits} Credits`}
            packagePrice={packages?.find(p => p.id === selectedPackage)?.price.toFixed(2) || '0.00'}
            clientSecret={clientSecret}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </Elements>
      )}
    </>
  );
}
