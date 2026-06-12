import React, { useState } from 'react';
import { X, CreditCard, Shield } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripeApi } from '../utils/stripeApi';
import { toast } from 'sonner';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
  },
};

function PaymentForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'paypal' | 'apple'>('card');
  const [cardholderName, setCardholderName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMethod !== 'card') {
      toast.info('PayPal and Apple Pay coming soon!');
      return;
    }

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Adding payment method...');

    try {
      // Get card number element
      const cardNumberElement = elements.getElement(CardNumberElement);

      if (!cardNumberElement) {
        throw new Error('Card element not found');
      }

      // Create payment method with Stripe
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
        billing_details: {
          name: cardholderName,
          address: {
            postal_code: zipCode,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Add payment method to backend
      const response = await stripeApi.addPaymentMethod(paymentMethod!.id, setAsDefault);

      if (response.success) {
        toast.success(response.message || 'Payment method added successfully!', { id: toastId });
        onSuccess();
        onClose();
      } else {
        throw new Error(response.error || 'Failed to add payment method');
      }
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      toast.error(error.message || 'Failed to add payment method', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">Payment Method</label>
        <div className="space-y-2">
          {/* Credit or Debit Card */}
          <button
            type="button"
            onClick={() => setSelectedMethod('card')}
            className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
              selectedMethod === 'card'
                ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Credit or Debit Card</p>
                <p className="text-xs text-gray-500">Visa, Mastercard, Amex, Discover</p>
              </div>
            </div>
            {selectedMethod === 'card' && (
              <svg className="w-5 h-5 text-[#6C60FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* PayPal */}
          <button
            type="button"
            onClick={() => setSelectedMethod('paypal')}
            className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
              selectedMethod === 'paypal'
                ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#003087">
                  <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.795.68l-.04.22-.63 3.993-.032.17a.804.804 0 01-.794.679H7.72a.483.483 0 01-.477-.558L9.278 7.3a.977.977 0 01.963-.825h4.187c.863 0 1.617.118 2.253.357 1.055.4 1.755 1.14 2.253 2.353.124.303.22.62.282.95l.15.496z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">PayPal</p>
                <p className="text-xs text-gray-500">Pay with your PayPal account</p>
              </div>
            </div>
            {selectedMethod === 'paypal' && (
              <svg className="w-5 h-5 text-[#6C60FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Apple Pay */}
          <button
            type="button"
            onClick={() => setSelectedMethod('apple')}
            className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
              selectedMethod === 'apple'
                ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Apple Pay</p>
                <p className="text-xs text-gray-500">Fast and Secure with Touch ID</p>
              </div>
            </div>
            {selectedMethod === 'apple' && (
              <svg className="w-5 h-5 text-[#6C60FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Card Details Form (only show if card is selected) */}
      {selectedMethod === 'card' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Card Details</h3>

          {/* Card Number */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">Card Number</label>
            <div className="border border-gray-300 rounded-lg px-3 py-3 focus-within:border-[#6C60FF] focus-within:ring-2 focus-within:ring-[#6C60FF]/20 transition-all">
              <CardNumberElement options={cardElementOptions} />
            </div>
          </div>

          {/* Cardholder Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">Cardholder Name</label>
            <input
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="John Doe"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 transition-all"
              required
            />
          </div>

          {/* Expiry, CVV, ZIP Code Row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Expiry Date</label>
              <div className="border border-gray-300 rounded-lg px-3 py-3 focus-within:border-[#6C60FF] focus-within:ring-2 focus-within:ring-[#6C60FF]/20 transition-all">
                <CardExpiryElement options={cardElementOptions} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">CVV</label>
              <div className="border border-gray-300 rounded-lg px-3 py-3 focus-within:border-[#6C60FF] focus-within:ring-2 focus-within:ring-[#6C60FF]/20 transition-all">
                <CardCvcElement options={cardElementOptions} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Postal Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="12345"
                className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 transition-all"
                required
              />
            </div>
          </div>

          {/* Set as Default Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="setAsDefault"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="w-4 h-4 text-[#6C60FF] border-gray-300 rounded focus:ring-[#6C60FF]"
            />
            <label htmlFor="setAsDefault" className="text-sm text-gray-700">
              Set as default payment method
            </label>
          </div>
        </div>
      )}

      {/* Secure Payment Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
        <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-900">Secure Payment</p>
          <p className="text-xs text-green-700 mt-1">
            Your payment information is encrypted and securely stored using industry-standard security protocols.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessing || !stripe}
          className="flex-1 px-4 py-2.5 bg-[#f6339A] hover:bg-[#d42982] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Add Payment Method'}
        </button>
      </div>
    </form>
  );
}

export default function AddPaymentMethodModal({ isOpen, onClose, onSuccess }: AddPaymentMethodModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Payment Method</h2>
            <p className="text-sm text-gray-600 mt-1">Choose your preferred payment method</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          <Elements stripe={stripePromise}>
            <PaymentForm onClose={onClose} onSuccess={onSuccess} />
          </Elements>
        </div>
      </div>
    </div>
  );
}
