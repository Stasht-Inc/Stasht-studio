import React, { useState } from 'react';
import { X, Loader2, CreditCard, Home, Clock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      '::placeholder': { color: '#9CA3AF' },
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    invalid: { color: '#EF4444' },
  },
  hidePostalCode: true,
};

interface PropertyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string;
  paymentIntentId: string;
  propertyCount: number;
  totalAmount: number;
  onPayNowSuccess: () => void;
  onPayLater: () => void;
}

function PaymentForm({
  clientSecret,
  paymentIntentId,
  propertyCount,
  totalAmount,
  onClose,
  onPayNowSuccess,
  onPayLater,
}: Omit<PropertyPaymentModalProps, 'isOpen'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPayingLater, setIsPayingLater] = useState(false);
  const [cardError, setCardError] = useState('');

  const handlePayNow = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setIsProcessing(true);
    setCardError('');

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        setCardError(error.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        const { dashboardAPI } = await import('../utils/authUtils');
        const confirmRes = await dashboardAPI.confirmPropertyPayment(paymentIntentId);
        if (!confirmRes.success) {
          setCardError(confirmRes.error || 'Payment confirmed but failed to finalize. Contact support.');
          setIsProcessing(false);
          return;
        }
        onPayNowSuccess();
      }
    } catch (err: any) {
      setCardError(err.message || 'An error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  const handlePayLater = async () => {
    setIsPayingLater(true);
    try {
      await onPayLater();
    } finally {
      setIsPayingLater(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isProcessing || isPayingLater}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-[#6C60FF]/10 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-[#6C60FF]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Property Checkout</h2>
              <p className="text-sm text-gray-500">Complete payment to activate your properties</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Properties</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {propertyCount} propert{propertyCount === 1 ? 'y' : 'ies'} × $2.00
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">${totalAmount}.00</p>
            </div>
          </div>

          {/* Card input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CreditCard className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Card Details
            </label>
            <div
              className={`w-full px-4 py-3 border rounded-lg focus-within:ring-2 transition-colors ${
                cardError
                  ? 'border-red-300 focus-within:ring-red-200'
                  : 'border-gray-300 focus-within:ring-[#6C60FF]/20 focus-within:border-[#6C60FF]'
              }`}
            >
              <CardElement
                options={CARD_ELEMENT_OPTIONS}
                onChange={(e) => {
                  if (e.error) setCardError(e.error.message || '');
                  else setCardError('');
                }}
              />
            </div>
            {cardError && <p className="text-xs text-red-500 mt-1.5">{cardError}</p>}
            <p className="text-xs text-gray-400 mt-1.5">
              Secure payment powered by Stripe. Card details are never stored on our servers.
            </p>
          </div>

          {/* Pay now */}
          <button
            onClick={handlePayNow}
            disabled={!stripe || isProcessing || isPayingLater}
            className="w-full text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#E60076' }}
            onMouseEnter={e => { if (!isProcessing && !isPayingLater) e.currentTarget.style.backgroundColor = '#cc006a'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#E60076'; }}
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            ) : (
              `Pay $${totalAmount}.00 & Create Properties`
            )}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400">or</span>
            </div>
          </div>

          {/* Pay later */}
          <button
            onClick={handlePayLater}
            disabled={isProcessing || isPayingLater}
            className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPayingLater ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <><Clock className="w-4 h-4" /> Create Properties &amp; Pay Later</>
            )}
          </button>
          <p className="text-xs text-center text-gray-400 -mt-2">
            Properties will be created with payment pending status
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PropertyPaymentModal(props: PropertyPaymentModalProps) {
  if (!props.isOpen || !props.clientSecret) return null;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <PaymentForm {...props} />
    </Elements>
  );
}
