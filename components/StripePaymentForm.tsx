import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripeApi, PaymentMethod } from '../utils/stripeApi';

interface StripePaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  planName: string;
  planPrice: string;
  isYearly: boolean;
  clientSecret: string;
  onPaymentSuccess: (paymentMethodId: string) => void;
  mode?: 'setup' | 'payment'; // 'setup' = SetupIntent (subscriptions), 'payment' = PaymentIntent (one-time)
}

export interface BillingData {
  firstName: string;
  lastName: string;
  email: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  agreedToTerms: boolean;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      '::placeholder': {
        color: '#9CA3AF',
      },
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    invalid: {
      color: '#EF4444',
    },
  },
  hidePostalCode: true, // We collect it separately in billing address
};

export function StripePaymentForm({
  isOpen,
  onClose,
  onBack,
  planName,
  planPrice,
  isYearly,
  clientSecret,
  onPaymentSuccess,
  mode = 'setup',
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [formData, setFormData] = useState<BillingData>({
    firstName: '',
    lastName: '',
    email: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    agreedToTerms: false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof BillingData | 'card', string>>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  // Saved payment methods
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [paymentOption, setPaymentOption] = useState<'saved' | 'new'>('new');
  const [selectedSavedCard, setSelectedSavedCard] = useState<string>('');

  // Fetch saved payment methods on mount
  useEffect(() => {
    if (isOpen) {
      fetchSavedPaymentMethods();
    }
  }, [isOpen]);

  const fetchSavedPaymentMethods = async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await stripeApi.getPaymentMethods();
      if (response.success && response.payment_methods) {
        setSavedPaymentMethods(response.payment_methods);

        // If there are saved cards, default to saved option with first card selected
        if (response.payment_methods.length > 0) {
          setPaymentOption('saved');
          setSelectedSavedCard(response.payment_methods[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

  if (!isOpen) return null;

  const billingPeriod = mode === 'payment' ? 'one-time' : (isYearly ? 'year' : 'month');

  const displayPrice = mode === 'payment'
    ? planPrice
    : isYearly
    ? (parseFloat(planPrice) * 12).toFixed(2)
    : planPrice;

  const handleInputChange = (field: keyof BillingData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof BillingData | 'card', string>> = {};

    // Card validation - only for new cards
    if (paymentOption === 'saved') {
      if (!selectedSavedCard) {
        newErrors.card = 'Please select a payment method';
      }
    } else {
      // Validate card details for new card
      if (!cardComplete) {
        newErrors.card = 'Please enter valid card details';
      }
    }

    // Billing Address validation - ALWAYS required (both saved and new card)
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name required';
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      newErrors.email = 'Valid email required';
    }
    if (!formData.streetAddress.trim()) {
      newErrors.streetAddress = 'Street address required';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City required';
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Country required';
    }
    if (!formData.state.trim()) {
      const stateLabel = formData.country === 'Canada' ? 'Province' : 'State';
      newErrors.state = `${stateLabel} required`;
    }
    if (!formData.zipCode.trim()) {
      const zipLabel = formData.country === 'Canada' ? 'Postal Code' : 'Zip Code';
      newErrors.zipCode = `${zipLabel} required`;
    }

    // Terms validation - ALWAYS required
    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);

    try {
      const billingDetails = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        address: {
          line1: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          postal_code: formData.zipCode,
          country: formData.country === 'United States' ? 'US' : 'CA',
        },
      };

      if (mode === 'payment') {
        // PaymentIntent flow (one-time charge)
        const paymentMethodParam = (paymentOption === 'saved' && selectedSavedCard)
          ? selectedSavedCard
          : { card: elements.getElement(CardElement)!, billing_details: billingDetails };

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: paymentMethodParam as any,
        });

        if (error) {
          setErrors({ card: error.message || 'Payment failed. Please try again.' });
          setIsProcessing(false);
          return;
        }

        if (paymentIntent?.status === 'succeeded') {
          onPaymentSuccess(paymentIntent.payment_method as string);
        }
        return;
      }

      // SetupIntent flow (subscriptions) — default
      // If using saved card, directly call onPaymentSuccess with the saved card ID
      if (paymentOption === 'saved' && selectedSavedCard) {
        onPaymentSuccess(selectedSavedCard);
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement, billing_details: billingDetails },
      });

      if (error) {
        console.error('Payment error:', error);
        setErrors({ card: error.message || 'Payment failed. Please try again.' });
        setIsProcessing(false);
        return;
      }

      if (setupIntent.status === 'succeeded' && setupIntent.payment_method) {
        onPaymentSuccess(setupIntent.payment_method as string);
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      setErrors({ card: error.message || 'An error occurred. Please try again.' });
      setIsProcessing(false);
    }
  };

  // US States for dropdown
  const states = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming',
  ];

  // Canadian Provinces for dropdown
  const provinces = [
    'Alberta',
    'British Columbia',
    'Manitoba',
    'New Brunswick',
    'Newfoundland and Labrador',
    'Northwest Territories',
    'Nova Scotia',
    'Nunavut',
    'Ontario',
    'Prince Edward Island',
    'Quebec',
    'Saskatchewan',
    'Yukon',
  ];

  // Dynamic labels based on country
  const isCanada = formData.country === 'Canada';
  const isUSA = formData.country === 'United States';
  const stateLabel = isCanada ? 'Province' : 'State';
  const zipLabel = isCanada ? 'Postal Code' : 'Zip Code';
  const stateOptions = isCanada ? provinces : states;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-xl w-full relative max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-6 pb-4 border-b">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your payment and billing information
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Saved Payment Methods Section */}
            {isLoadingPaymentMethods ? (
              <div className="mb-6 flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#6C60FF]" />
              </div>
            ) : savedPaymentMethods.length > 0 ? (
              <>
                {/* Saved Cards */}
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Saved Payment Methods</h3>
                  <div className="space-y-3">
                    {savedPaymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentOption('saved');
                          setSelectedSavedCard(method.id);
                          setCardComplete(false);
                          // Clear any card errors since we're using saved card
                          setErrors((prev) => ({ ...prev, card: '' }));
                          // Clear the card input field
                          const cardElement = elements?.getElement(CardElement);
                          if (cardElement) {
                            cardElement.clear();
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                          paymentOption === 'saved' && selectedSavedCard === method.id
                            ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-900 capitalize flex items-center gap-2">
                              {method.brand} **** {method.last4}
                              {method.is_default && (
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                                  Default
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600">
                              Expires {method.exp_month}/{method.exp_year}
                            </p>
                          </div>
                        </div>
                        {paymentOption === 'saved' && selectedSavedCard === method.id && (
                          <svg className="w-5 h-5 text-[#6C60FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">Or enter new card details</span>
                  </div>
                </div>
              </>
            ) : null}

            {/* Card Details - Always visible */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {savedPaymentMethods.length > 0 ? 'New Card Information' : 'Card Information'}
              </h3>

              <div className="space-y-4">
                {/* Stripe Card Element */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Card Details
                  </label>
                  <div
                    className={`w-full px-4 py-3 border rounded-lg focus-within:outline-none focus-within:ring-2 transition-colors ${
                      errors.card
                        ? 'border-red-300 focus-within:ring-red-200'
                        : 'border-gray-300 focus-within:ring-[#6C60FF]/20 focus-within:border-[#6C60FF]'
                    }`}
                  >
                    <CardElement
                      options={CARD_ELEMENT_OPTIONS}
                      onChange={(e) => {
                        // Only switch to new card mode if user actually typed something
                        if (!e.empty) {
                          setPaymentOption('new');
                          setSelectedSavedCard(''); // Deselect saved card when typing
                        }
                        setCardComplete(e.complete);
                        if (e.error) {
                          setErrors((prev) => ({ ...prev, card: e.error?.message }));
                        } else {
                          setErrors((prev) => ({ ...prev, card: '' }));
                        }
                      }}
                    />
                  </div>
                  {errors.card && <p className="text-xs text-red-500 mt-1">{errors.card}</p>}
                  <p className="text-xs text-gray-500 mt-1.5">
                    Secure payment powered by Stripe. Your card details are never stored on our
                    servers.
                  </p>
                </div>
              </div>
            </div>

            {/* Billing Address - Always show */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Billing Address</h3>

              <div className="space-y-4">
                {/* First Name & Last Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      disabled={isProcessing}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                        errors.firstName
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={isProcessing}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                        errors.lastName
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={isProcessing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                      errors.email
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                {/* Street Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.streetAddress}
                    onChange={(e) => handleInputChange('streetAddress', e.target.value)}
                    disabled={isProcessing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                      errors.streetAddress
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.streetAddress && (
                    <p className="text-xs text-red-500 mt-1">{errors.streetAddress}</p>
                  )}
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    disabled={isProcessing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                      errors.city
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => {
                      handleInputChange('country', e.target.value);
                      // Clear state when country changes
                      handleInputChange('state', '');
                    }}
                    disabled={isProcessing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors appearance-none bg-white disabled:opacity-50 ${
                      errors.country
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                  </select>
                  {errors.country && (
                    <p className="text-xs text-red-500 mt-1">{errors.country}</p>
                  )}
                </div>

                {/* Province/State */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {stateLabel}
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    disabled={isProcessing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors appearance-none bg-white disabled:opacity-50 ${
                      errors.state
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  >
                    <option value="">Select {stateLabel.toLowerCase()}</option>
                    {stateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                </div>

                {/* Postal Code/Zip Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {zipLabel}
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                    disabled={isProcessing}
                    placeholder={isCanada ? 'A1A 1A1' : '12345'}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                      errors.zipCode
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.zipCode && (
                    <p className="text-xs text-red-500 mt-1">{errors.zipCode}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={(e) => handleInputChange('agreedToTerms', e.target.checked)}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-[#6C60FF] border-gray-300 rounded focus:ring-[#6C60FF] disabled:opacity-50"
                />
                <span className="text-sm text-gray-600">
                  I agree to the{' '}
                  <a href="#" className="text-[#6C60FF] hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-[#6C60FF] hover:underline">
                    Privacy Policy
                  </a>
                  . I understand that my subscription will automatically renew.
                </span>
              </label>
              {errors.agreedToTerms && (
                <p className="text-xs text-red-500 mt-1 ml-7">{errors.agreedToTerms}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t">
              {/* Back Button */}
              <button
                onClick={onBack}
                disabled={isProcessing}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {/* Plan Info and Pay Button */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">{planName} Plan</p>
                  <p className="text-sm font-bold text-gray-900">
                    ${displayPrice}/{billingPeriod}
                  </p>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!stripe || isProcessing}
                  className="bg-[#6C60FF] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#5A4FFF] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay ${displayPrice}
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default StripePaymentForm;
