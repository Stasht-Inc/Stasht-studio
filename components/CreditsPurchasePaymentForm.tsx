import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Loader2, CreditCard, Check } from 'lucide-react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripeApi, PaymentMethod } from '../utils/stripeApi';

interface CreditsPurchasePaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  packageId: string;
  packageName: string;
  packagePrice: string;
  clientSecret: string;
  onPaymentSuccess: (
    paymentIntentId: string,
    paymentMethodId: string,
    invoicePdf?: string,
    stripeInvoiceId?: string
  ) => void;
}

interface BillingData {
  firstName: string;
  lastName: string;
  zipCode: string;
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
};

export function CreditsPurchasePaymentForm({
  isOpen,
  onClose,
  onBack,
  packageId,
  packageName,
  packagePrice,
  clientSecret,
  onPaymentSuccess,
}: CreditsPurchasePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [formData, setFormData] = useState<BillingData>({
    firstName: '',
    lastName: '',
    zipCode: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof BillingData | 'card' | 'general', string>>>({});
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

  const handleInputChange = (field: keyof BillingData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof BillingData | 'card' | 'general', string>> = {};

    // Card validation
    if (paymentOption === 'saved') {
      if (!selectedSavedCard) {
        newErrors.card = 'Please select a payment method';
      }
    } else {
      // Validate card details for new card
      if (!cardComplete) {
        newErrors.card = 'Please enter valid card details';
      }

      // Validate billing info for new card only
      if (!formData.firstName.trim()) {
        newErrors.firstName = 'First name required';
      }
      if (!formData.lastName.trim()) {
        newErrors.lastName = 'Last name required';
      }
      if (!formData.zipCode.trim()) {
        newErrors.zipCode = 'Zip code required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to retrieve full PaymentIntent with charge details
  const retrievePaymentIntentWithCharge = async (paymentIntentId: string): Promise<{ invoicePdf?: string; stripeInvoiceId?: string }> => {
    if (!stripe) {
      console.warn('⚠️ Stripe not initialized');
      return {};
    }

    try {
      // Retrieve the PaymentIntent - NOTE: Stripe.js doesn't expand charge automatically
      const { paymentIntent: fullPaymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

      console.log('📦 Full PaymentIntent retrieved:', fullPaymentIntent);
      console.log('📦 PaymentIntent ID:', paymentIntentId);

      let invoicePdf: string | undefined;
      let stripeInvoiceId: string | undefined;

      // Cast to any to access Stripe properties not in type definition
      const piAny = fullPaymentIntent as any;

      console.log('🔍 Checking for invoice:', piAny.invoice);
      console.log('🔍 Checking for latest_charge:', piAny.latest_charge);

      // Check if invoice exists
      if (piAny.invoice) {
        stripeInvoiceId = typeof piAny.invoice === 'string'
          ? piAny.invoice
          : piAny.invoice.id;
        console.log('✅ Found stripe_invoice_id:', stripeInvoiceId);
      } else {
        console.log('❌ No invoice found in PaymentIntent');
      }

      // Check for receipt URL from charge
      if (piAny.latest_charge) {
        const charge = piAny.latest_charge;
        console.log('🔍 Charge type:', typeof charge);
        console.log('🔍 Charge data:', charge);

        // If charge is expanded object
        if (typeof charge === 'object' && charge.receipt_url) {
          invoicePdf = charge.receipt_url;
          console.log('✅ Found invoice_pdf (receipt_url):', invoicePdf);
        } else if (typeof charge === 'string') {
          // Charge is just an ID - receipt URL not available from Stripe.js
          console.log('⚠️ Charge is just ID, receipt URL not available from Stripe.js');
          console.log('⚠️ Charge ID:', charge);
          console.log('⚠️ Backend MUST fetch receipt URL using this payment_intent_id:', paymentIntentId);
        } else {
          console.log('❌ Unexpected charge format');
        }
      } else {
        console.log('❌ No latest_charge found in PaymentIntent');
      }

      console.log('📤 Extracted invoice details:', { invoicePdf, stripeInvoiceId });

      if (!invoicePdf) {
        console.warn('⚠️ invoice_pdf NOT available from frontend');
        console.warn('⚠️ Backend MUST retrieve it using payment_intent_id:', paymentIntentId);
      }

      return { invoicePdf, stripeInvoiceId };
    } catch (error) {
      console.error('❌ Error retrieving PaymentIntent details:', error);
      return {};
    }
  };

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      // Using PaymentIntent for one-time payment
      if (paymentOption === 'saved' && selectedSavedCard) {
        // Confirm payment with saved card
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: selectedSavedCard,
        });

        if (error) {
          console.error('Payment error:', error);
          setErrors({ card: error.message || 'Payment failed. Please try again.' });
          setIsProcessing(false);
          return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Retrieve full PaymentIntent with charge details to get receipt URL
          const { invoicePdf, stripeInvoiceId } = await retrievePaymentIntentWithCharge(paymentIntent.id);

          console.log('Payment succeeded! Sending to backend:', {
            paymentIntentId: paymentIntent.id,
            paymentMethodId: paymentIntent.payment_method,
            invoicePdf,
            stripeInvoiceId
          });

          onPaymentSuccess(
            paymentIntent.id,
            paymentIntent.payment_method as string,
            invoicePdf,
            stripeInvoiceId
          );
        }
      } else {
        // Confirm payment with new card
        const cardElement = elements.getElement(CardElement);

        if (!cardElement) {
          throw new Error('Card element not found');
        }

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${formData.firstName} ${formData.lastName}`,
              address: {
                postal_code: formData.zipCode,
              },
            },
          },
        });

        if (error) {
          console.error('Payment error:', error);
          setErrors({ card: error.message || 'Payment failed. Please try again.' });
          setIsProcessing(false);
          return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Retrieve full PaymentIntent with charge details to get receipt URL
          const { invoicePdf, stripeInvoiceId } = await retrievePaymentIntentWithCharge(paymentIntent.id);

          console.log('Payment succeeded! Sending to backend:', {
            paymentIntentId: paymentIntent.id,
            paymentMethodId: paymentIntent.payment_method,
            invoicePdf,
            stripeInvoiceId
          });

          onPaymentSuccess(
            paymentIntent.id,
            paymentIntent.payment_method as string,
            invoicePdf,
            stripeInvoiceId
          );
        }
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      setErrors({ general: error.message || 'An error occurred. Please try again.' });
      setIsProcessing(false);
    }
  };

  const getBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    if (brandLower === 'visa') return '💳';
    if (brandLower === 'mastercard') return '💳';
    if (brandLower === 'amex') return '💳';
    return '💳';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isProcessing}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Complete Purchase</h2>
              <p className="text-sm text-gray-600">{packageName} - ${packagePrice}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Payment Method Selection */}
          {isLoadingPaymentMethods ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Saved Cards vs New Card Toggle */}
              {savedPaymentMethods.length > 0 && (
                <div className="space-y-4">
                  <label className="text-sm font-medium text-gray-900">Payment Method</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentOption('saved')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        paymentOption === 'saved'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={isProcessing}
                    >
                      <div className="text-sm font-medium text-gray-900">Saved Card</div>
                      <div className="text-xs text-gray-600 mt-1">Use existing payment method</div>
                    </button>
                    <button
                      onClick={() => setPaymentOption('new')}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        paymentOption === 'new'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={isProcessing}
                    >
                      <div className="text-sm font-medium text-gray-900">New Card</div>
                      <div className="text-xs text-gray-600 mt-1">Enter new card details</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Cards List */}
              {paymentOption === 'saved' && savedPaymentMethods.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-900">Select Card</label>
                  {savedPaymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setSelectedSavedCard(method.id);
                        setErrors((prev) => ({ ...prev, card: '' }));
                      }}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedSavedCard === method.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={isProcessing}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getBrandIcon(method.brand)}</span>
                          <div>
                            <div className="font-medium text-gray-900 capitalize">
                              {method.brand} •••• {method.last4}
                            </div>
                            <div className="text-sm text-gray-600">
                              Expires {method.exp_month}/{method.exp_year}
                            </div>
                          </div>
                        </div>
                        {selectedSavedCard === method.id && (
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      {method.is_default && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Default
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                  {errors.card && <p className="text-sm text-red-600">{errors.card}</p>}
                </div>
              )}

              {/* New Card Form */}
              {paymentOption === 'new' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">Card Information</label>
                    <div className="p-4 border border-gray-300 rounded-lg bg-white focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                      <CardElement
                        options={CARD_ELEMENT_OPTIONS}
                        onChange={(e) => {
                          setCardComplete(e.complete);
                          if (e.error) {
                            setErrors((prev) => ({ ...prev, card: e.error?.message }));
                          } else {
                            setErrors((prev) => ({ ...prev, card: '' }));
                          }
                        }}
                      />
                    </div>
                    {errors.card && <p className="text-sm text-red-600 mt-1">{errors.card}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          errors.firstName ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="John"
                        disabled={isProcessing}
                      />
                      {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-900 mb-2 block">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          errors.lastName ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Doe"
                        disabled={isProcessing}
                      />
                      {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">Zip Code</label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => handleInputChange('zipCode', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        errors.zipCode ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="12345"
                      disabled={isProcessing}
                    />
                    {errors.zipCode && <p className="text-sm text-red-600 mt-1">{errors.zipCode}</p>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !stripe || !elements || isLoadingPaymentMethods}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Pay ${packagePrice}
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            Your payment is secured by Stripe. Credits will be added immediately upon successful payment.
          </p>
        </div>
      </div>
    </div>
  );
}
