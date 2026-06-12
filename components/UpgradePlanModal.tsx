import React, { useState, useEffect } from 'react';
import { X, Check, Zap, Crown, Loader2, Award, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentMethodModal from './PaymentMethodModal';
import StripePaymentForm from './StripePaymentForm';
import { stripeApi } from '../utils/stripeApi';
import { toast } from 'sonner';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export interface Plan {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  yearlyPrice: number;
  storage: string;
  features: string[];
  isPopular?: boolean;
  icon: React.ReactNode;
}

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  onUpgrade?: (planId: string, isYearly: boolean) => void;
  onSuccess?: () => void;
  canClose?: boolean;
  hideStarter?: boolean;
}

export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Power users',
    price: 0,
    yearlyPrice: 0,
    storage: '1 GB storage',
    icon: <Award className="w-5 h-5 text-white" />,
    features: [
      'AI Credits\n(5 credits/mo)',
      'All Accounts Sync',
      '1 Admin Role',
      'Unlimited Collaborators',
      'All Publishing Features'
    ]
  },
  {
    id: 'intermediate',
    name: 'Teams',
    subtitle: 'Power users',
    price: 9,
    yearlyPrice: 7.47, // ~17% savings
    storage: '500 GB storage',
    icon: <Zap className="w-5 h-5 text-white" />,
    features: [
      'Everything in Starter',
      'AI Credits\n(50 credits/mo)',
      'All Accounts Sync',
      '3 Admin Roles',
      'Unlimited Collaborators',
      'All Publishing Features',
      'Property Accounts'
    ]
  },
  {
    id: 'professional',
    name: 'Business',
    subtitle: 'Teams & orgs',
    price: 19,
    yearlyPrice: 15.77, // ~17% savings
    storage: '1 TB storage',
    isPopular: true,
    icon: <Crown className="w-5 h-5 text-white" />,
    features: [
      'Everything in Teams',
      'AI Credits\n(150 credits/mo)',
      'All Account Sync',
      '5 Admin Roles',
      'Unlimited Collaborators',
      'All Publishing Features',
      'Moments Moderation',
      'Property Accounts'
    ]
  }
];

function getDefaultPlan(currentPlan?: string): string {
  const plan = currentPlan?.toLowerCase();
  if (plan === 'intermediate') return 'professional';
  if (plan === 'professional') return 'professional';
  return 'intermediate'; // starter or unknown → intermediate
}

export function UpgradePlanModal({ isOpen, onClose, currentPlan, onUpgrade, onSuccess, canClose = true, hideStarter = false }: UpgradePlanModalProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>(() => getDefaultPlan(currentPlan));
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStripeFormOpen, setIsStripeFormOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isLoadingSetupIntent, setIsLoadingSetupIntent] = useState(false);
  const [error, setError] = useState<string>('');
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [isProcessingDowngrade, setIsProcessingDowngrade] = useState(false);
  const triggerMustSelectWarning = () => {
    toast.info('Please select a plan to access the Stasht portal.');
  };

  // Reset selected plan based on currentPlan whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPlan(getDefaultPlan(currentPlan));
    }
  }, [isOpen, currentPlan]);

  if (!isOpen && !isPaymentModalOpen && !isStripeFormOpen) return null;

  const selectedPlanData = plans.find(p => p.id === selectedPlan);
  const currentPrice = isYearly
    ? selectedPlanData?.yearlyPrice.toFixed(2)
    : selectedPlanData?.price.toFixed(2);

  // Called when user confirms downgrade from paid plan → Starter
  const handleConfirmDowngrade = async () => {
    setShowDowngradeConfirm(false);
    setIsProcessingDowngrade(true);
    const toastId = toast.loading('Cancelling your subscription...');
    try {
      const response = await stripeApi.cancelSubscription();
      if (response.success) {
        toast.success(response.message || 'Plan downgraded to Starter successfully!', { id: toastId });
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        toast.error(response.error || 'Failed to cancel subscription', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to cancel subscription. Please try again.', { id: toastId });
    } finally {
      setIsProcessingDowngrade(false);
    }
  };

  // Called when user has no paid plan and selects Starter
  const handleDowngradeToStarterNoPlan = async () => {
    setIsProcessingDowngrade(true);
    const toastId = toast.loading('Updating your plan...');
    try {
      const response = await stripeApi.downgradeToStarter();
      if (response.success) {
        const isNewUser = localStorage.getItem('is_new_user') === 'true';
        const message = isNewUser
          ? 'Your Starter plan is activated. Access the Stasht portal!'
          : (response.message || 'You are now on the Starter plan!');
        toast.success(message, { id: toastId });
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        toast.error(response.error || 'Failed to update plan', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to update plan. Please try again.', { id: toastId });
    } finally {
      setIsProcessingDowngrade(false);
    }
  };

  const handleUpgradeClick = async () => {
    // Starter (FREE) plan selected
    if (selectedPlan === 'starter') {
      try {
        const subResponse = await stripeApi.getCurrentSubscription();
        const hasPaidPlan =
          subResponse.success &&
          subResponse.active_subscriptions &&
          subResponse.active_subscriptions.length > 0;

        if (hasPaidPlan) {
          // Has paid plan → show downgrade confirmation
          setShowDowngradeConfirm(true);
        } else {
          // No paid plan → hit downgrade-to-starter API
          await handleDowngradeToStarterNoPlan();
        }
      } catch {
        // On error checking subscription, fall back to downgrade-to-starter
        await handleDowngradeToStarterNoPlan();
      }
      return;
    }

    try {
      // Check current subscription to prevent duplicate purchases
      const currentSubscriptionResponse = await stripeApi.getCurrentSubscription();

      if (currentSubscriptionResponse.success && currentSubscriptionResponse.active_subscriptions && currentSubscriptionResponse.active_subscriptions.length > 0) {
        const currentSubscription = currentSubscriptionResponse.active_subscriptions[0];
        const currentPlan = currentSubscription.plan_name;
        const currentBillingPeriod = currentSubscription.billing_period;
        const selectedBillingPeriod = isYearly ? 'yearly' : 'monthly';

        // Block if user is trying to purchase the SAME PLAN (regardless of billing period)
        if (currentPlan === selectedPlan) {
          const planDisplayName = selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1);
          const currentBillingDisplay = currentBillingPeriod === 'yearly' ? 'Yearly' : 'Monthly';

          toast.error(
            `You already have the ${planDisplayName} (${currentBillingDisplay}) plan. You can change plans on ${new Date(currentSubscription.current_period_end).toLocaleDateString()}.`,
            { duration: 5000 }
          );
          return; // Stop the purchase flow
        }

        // Check if user is trying to downgrade (optional warning)
        const planHierarchy: { [key: string]: number } = {
          'starter': 1,
          'intermediate': 2,
          'professional': 3
        };

        if (planHierarchy[selectedPlan] < planHierarchy[currentPlan]) {
          // Downgrade - show warning but allow
          toast.warning(
            `You're downgrading from ${currentPlan} to ${selectedPlan}. Changes will take effect on ${new Date(currentSubscription.current_period_end).toLocaleDateString()}.`,
            { duration: 5000 }
          );
        }
      }

      // If no duplicate detected, proceed to payment modal
      setIsPaymentModalOpen(true);
      setError('');
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      // If error checking subscription, still allow purchase
      setIsPaymentModalOpen(true);
      setError('');
    }
  };

  const handlePaymentBack = () => {
    // Go back to plan selection
    setIsPaymentModalOpen(false);
    setError('');
  };

  const handlePaymentContinue = async (paymentMethod: string) => {
    setSelectedPaymentMethod(paymentMethod);
    setError('');

    // If card is selected, create setup intent and show Stripe form
    if (paymentMethod === 'card') {
      // Set loading FIRST before closing modal
      setIsLoadingSetupIntent(true);

      // Close payment modal after a small delay to ensure loading shows
      setTimeout(() => {
        setIsPaymentModalOpen(false);
      }, 50);

      try {
        // Create Setup Intent from backend
        const response = await stripeApi.createSetupIntent();

        if (response.success && response.clientSecret) {
          setClientSecret(response.clientSecret);
          setIsStripeFormOpen(true);
        } else {
          setError(response.error || 'Failed to initialize payment. Please try again.');
          setIsPaymentModalOpen(true);
        }
      } catch (err: any) {
        console.error('Setup intent error:', err);
        setError('Failed to initialize payment. Please try again.');
        setIsPaymentModalOpen(true);
      } finally {
        setIsLoadingSetupIntent(false);
      }
    } else {
      // For PayPal and Apple Pay, process immediately
      console.log('Processing payment with:', paymentMethod);
      console.log('Plan:', selectedPlan, 'Yearly:', isYearly);

      // Call the upgrade callback if provided
      if (onUpgrade) {
        onUpgrade(selectedPlan, isYearly);
      }

      // Close modals
      setIsPaymentModalOpen(false);
      onClose();

      // TODO: Redirect to PayPal/Apple Pay flow
      alert('PayPal and Apple Pay integration coming soon!');
    }
  };

  const handleStripeFormBack = () => {
    // Go back to payment method selection
    setIsStripeFormOpen(false);
    setIsPaymentModalOpen(true);
    setClientSecret('');
  };

  const handlePaymentSuccess = async (paymentMethodId: string) => {
    const toastId = toast.loading('Creating subscription...');

    try {
      const selectedPlanData = plans.find(p => p.id === selectedPlan);
      if (!selectedPlanData) {
        throw new Error('Selected plan not found');
      }

      // Create subscription via backend
      // Backend will determine the price_id based on plan_name and billing_period
      const response = await stripeApi.createSubscription({
        payment_method_id: paymentMethodId,
        plan_name: selectedPlan as 'intermediate' | 'professional',
        billing_period: isYearly ? 'yearly' : 'monthly',
      });

      if (response.success) {
        // Show success message from API response
        const successMessage = response.message || `Successfully subscribed to ${selectedPlanData.name} plan!`;
        toast.success(successMessage, { id: toastId, duration: 5000 });

        // Call the upgrade callback if provided
        if (onUpgrade) {
          onUpgrade(selectedPlan, isYearly);
        }

        // Refresh billing page data
        if (onSuccess) {
          onSuccess();
        }

        // Close all modals
        setIsStripeFormOpen(false);
        setIsPaymentModalOpen(false);
        onClose();
      } else {
        // Show error message from API response
        const errorMessage = response.error || 'Failed to create subscription';
        toast.error(errorMessage, { id: toastId, duration: 5000 });
        setError(errorMessage);

        // Refresh billing page data even on error
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err: any) {
      console.error('Subscription creation error:', err);
      const errorMessage = err.message || 'Failed to create subscription. Please try again.';
      toast.error(errorMessage, { id: toastId, duration: 5000 });
      setError(errorMessage);

      // Refresh billing page data even on error
      if (onSuccess) {
        onSuccess();
      }
      // Keep the form open to show the error
    }
  };

  const handleClose = () => {
    setIsPaymentModalOpen(false);
    setIsStripeFormOpen(false);
    setClientSecret('');
    setError('');
    setShowDowngradeConfirm(false);
    if (canClose) onClose();
  };

  return (
    <>
      {/* Downgrade Confirmation Dialog */}
      {showDowngradeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Downgrade to Starter?</h3>
            <p className="text-gray-600 text-sm mb-6">
              Your current plan will remain active until the end of your billing period. After that, your account will move to the Starter (Free) plan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDowngradeConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDowngrade}
                disabled={isProcessingDowngrade}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isProcessingDowngrade ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Yes, Downgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for setup intent / downgrade processing */}
      {(isLoadingSetupIntent || isProcessingDowngrade) && !showDowngradeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#6C60FF]" />
            <p className="text-gray-700 font-medium">{isProcessingDowngrade ? 'Processing...' : 'Initializing payment...'}</p>
          </div>
        </div>
      )}

      {/* Plan Selection Modal - Only show when other modals are NOT open */}
      {isOpen && !isPaymentModalOpen && !isStripeFormOpen && (
        <div
          className="fixed inset-0 bg-gray-900/85 z-50 flex flex-col items-center justify-center p-4 gap-3"
          onClick={canClose ? handleClose : triggerMustSelectWarning}
        >
          {/* Lock indicator above modal — only when non-closeable */}
          {!canClose && (
            <div
              className="flex items-center gap-2 text-white/80 mb-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium tracking-wide">Select a plan to unlock the Stasht portal</span>
            </div>
          )}

          {/* Modal */}
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="p-6 pb-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
                <p className="text-gray-600 mt-1">Choose the perfect plan for your needs</p>
              </div>

              <div className="flex items-center gap-3">
                {/* Billing Toggle */}
                <div className="flex items-center bg-gray-100 rounded-full p-1">
                  <button
                    onClick={() => setIsYearly(false)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      !isYearly
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setIsYearly(true)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                      isYearly
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Yearly
                    <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                      Save 17%
                    </span>
                  </button>
                </div>

                {/* Close Button */}
                {canClose && (
                  <button
                    onClick={handleClose}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex flex-col gap-6">
              {/* Plans */}
              <div className="flex flex-col sm:flex-row gap-4">
                {plans.filter(p => !(hideStarter && p.id === 'starter')).map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`flex-1 border-2 rounded-2xl p-5 cursor-pointer transition-all duration-200 relative ${
                      selectedPlan === plan.id
                        ? plan.id === 'starter'
                          ? 'border-[#4A9CF5] bg-[#4A9CF5]/5 shadow-lg'
                          : plan.id === 'intermediate'
                          ? 'border-[#f6339A] bg-[#f6339A]/5 shadow-lg'
                          : 'border-[#6C60FF] bg-[#6C60FF]/5 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    {/* Selected Badge */}
                    {selectedPlan === plan.id && (
                      <div className={`absolute -top-3 left-4 text-white text-xs px-3 py-1 rounded-full font-medium ${
                        plan.id === 'starter' ? 'bg-[#4A9CF5]' : plan.id === 'intermediate' ? 'bg-[#f6339A]' : 'bg-[#6C60FF]'
                      }`}>
                        Selected
                      </div>
                    )}

                    {/* Popular Badge */}
                    {plan.isPopular && (
                      <div className={`absolute -top-3 ${selectedPlan === plan.id ? 'right-4' : 'left-4'} bg-[#6C60FF] text-white text-xs px-3 py-1 rounded-full font-medium`}>
                        Popular
                      </div>
                    )}

                    {/* Plan Header — mobile: icon+name LEFT, price RIGHT / desktop: stacked */}
                    <div className="flex items-center justify-between mb-3 sm:block">
                      <div className="flex items-center gap-3 sm:mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          plan.id === 'starter'
                            ? 'bg-gradient-to-br from-[#4A9CF5] to-[#2878D6]'
                            : plan.id === 'intermediate'
                            ? 'bg-gradient-to-br from-[#f6339A] to-[#d42982]'
                            : 'bg-gradient-to-br from-purple-500 to-purple-700'
                        }`}>
                          {plan.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                          <p className="text-xs text-gray-500">{plan.subtitle}</p>
                        </div>
                      </div>

                      {/* Price — inline on mobile (right side), hidden on desktop */}
                      <div className="text-right sm:hidden">
                        {plan.id === 'starter' ? (
                          <span className="text-xl font-bold text-gray-900">FREE</span>
                        ) : (
                          <div className="flex items-baseline gap-0.5 justify-end">
                            <span className="text-xl font-bold text-gray-900">
                              ${isYearly ? plan.yearlyPrice.toFixed(2) : plan.price}
                            </span>
                            <span className="text-gray-500 text-xs">/mo</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">{plan.storage}</p>
                      </div>
                    </div>

                    {/* Price — desktop only (stacked below header) */}
                    <div className="hidden sm:block mb-4">
                      <div className="flex items-baseline gap-1">
                        {plan.id === 'starter' ? (
                          <span className="text-3xl font-bold text-gray-900">FREE</span>
                        ) : (
                          <>
                            <span className="text-3xl font-bold text-gray-900">
                              ${isYearly ? plan.yearlyPrice.toFixed(2) : plan.price}
                            </span>
                            <span className="text-gray-500">/mo</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{plan.storage}</p>
                    </div>

                    {/* Features — 2-col grid on mobile, 1-col on desktop */}
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-1 sm:gap-y-0 sm:space-y-2.5">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600" />
                          </div>
                          <span className="text-xs sm:text-sm text-gray-700 whitespace-pre-line leading-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="w-full bg-gray-50 rounded-2xl p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {selectedPlanData?.name} ({selectedPlan === 'starter' ? 'free' : isYearly ? 'yearly' : 'monthly'})
                    </span>
                    <span className="text-gray-900 font-medium">{selectedPlan === 'starter' ? 'FREE' : `$${currentPrice}`}</span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">Total</span>
                      <span className="font-bold text-gray-900">{selectedPlan === 'starter' ? 'FREE' : `$${currentPrice}/month`}</span>
                    </div>
                  </div>
                </div>

                {/* Upgrade Button */}
                <button
                  onClick={handleUpgradeClick}
                  className={`w-full text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    selectedPlan === 'starter'
                      ? 'bg-[#4A9CF5] hover:bg-[#2878D6]'
                      : selectedPlan === 'intermediate'
                      ? 'bg-[#f6339A] hover:bg-[#d42982]'
                      : 'bg-[#6C60FF] hover:bg-[#5A4FFF]'
                  }`}
                >
                  {selectedPlan === 'starter' ? 'Get Started' : (() => {
                    const hierarchy: Record<string, number> = { starter: 1, intermediate: 2, professional: 3 };
                    const currentLevel = hierarchy[currentPlan?.toLowerCase() ?? ''] ?? 0;
                    const selectedLevel = hierarchy[selectedPlan] ?? 0;
                    const action = selectedLevel < currentLevel ? 'Downgrade' : 'Upgrade';
                    return `${action} to ${selectedPlanData?.name}`;
                  })()}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>

                {/* Cancel Button */}
                {canClose && (
                  <button
                    onClick={handleClose}
                    className="w-full mt-3 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <p className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                No setup fees • Cancel anytime
              </p>

              {/* Enterprise Accounts Notice */}
              <p className="text-center text-sm text-gray-600 mt-3">
                <span className="font-medium">Enterprise Accounts Available</span> – Pricing ranging from $49.99 and up including set up fees.{' '}
                <a href="https://stasht.com/#contact" target="_blank" rel="noopener noreferrer" className="text-[#6C60FF] hover:underline">Contact us</a> for more information.
              </p>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Payment Method Modal */}
      <PaymentMethodModal
        isOpen={isPaymentModalOpen}
        onClose={handleClose}
        onBack={handlePaymentBack}
        planName={selectedPlanData?.name || ''}
        planPrice={currentPrice || '0'}
        isYearly={isYearly}
        onContinue={handlePaymentContinue}
      />

      {/* Stripe Payment Form - Only shown when card payment is selected */}
      {clientSecret && (
        <Elements stripe={stripePromise}>
          <StripePaymentForm
            isOpen={isStripeFormOpen}
            onClose={handleClose}
            onBack={handleStripeFormBack}
            planName={selectedPlanData?.name || ''}
            planPrice={currentPrice || '0'}
            isYearly={isYearly}
            clientSecret={clientSecret}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </Elements>
      )}
    </>
  );
}

export default UpgradePlanModal;
