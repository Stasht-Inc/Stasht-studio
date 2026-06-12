import React, { useState } from 'react';
import { X, CreditCard, ArrowLeft, Shield, Lock } from 'lucide-react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  planName: string;
  planPrice: string;
  isYearly: boolean;
  onContinue?: (paymentMethod: string) => void;
}

type PaymentMethod = 'card' | 'paypal' | 'apple-pay';

export function PaymentMethodModal({
  isOpen,
  onClose,
  onBack,
  planName,
  planPrice,
  isYearly,
  onContinue
}: PaymentMethodModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');

  if (!isOpen) return null;

  const handleContinue = () => {
    if (onContinue) {
      onContinue(selectedMethod);
    }
    // If card is selected, the billing modal will open
    // For PayPal and Apple Pay, the parent will handle the flow
  };

  const billingPeriod = isYearly ? 'year' : 'month';

  // Calculate full yearly amount if yearly is selected
  const displayPrice = isYearly
    ? (parseFloat(planPrice) * 12).toFixed(2)
    : planPrice;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-6 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Payment Method</h2>
            <p className="text-sm text-gray-500 mt-1">Select your preferred payment method</p>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Choose Payment Method</h3>
            <p className="text-sm text-gray-500 mb-4">Select your preferred payment option</p>

            {/* Payment Options */}
            <div className="space-y-3 mb-6">
              {/* Credit or Debit Card */}
              <button
                onClick={() => setSelectedMethod('card')}
                className={`w-full p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                  selectedMethod === 'card'
                    ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedMethod === 'card' ? 'bg-[#6C60FF]' : 'bg-gray-100'
                    }`}>
                      <CreditCard className={`w-5 h-5 ${
                        selectedMethod === 'card' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Credit or Debit Card</h4>
                      <p className="text-xs text-gray-500">Visa, Mastercard, American Express</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Card logos */}
                    <div className="flex items-center gap-1">
                      {/* Visa */}
                      <div className="w-8 h-5 bg-white border border-gray-200 rounded flex items-center justify-center">
                        <span className="text-[10px] font-bold text-blue-800">VISA</span>
                      </div>
                      {/* Mastercard */}
                      <div className="w-8 h-5 bg-white border border-gray-200 rounded flex items-center justify-center">
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-orange-400 -ml-1"></div>
                        </div>
                      </div>
                      {/* Generic card icon */}
                      <div className="w-8 h-5 bg-white border border-gray-200 rounded flex items-center justify-center">
                        <CreditCard className="w-3 h-3 text-gray-400" />
                      </div>
                    </div>
                    {/* Radio button */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedMethod === 'card'
                        ? 'border-[#6C60FF] bg-white'
                        : 'border-gray-300'
                    }`}>
                      {selectedMethod === 'card' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#6C60FF]"></div>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* PayPal */}
              <button
                onClick={() => setSelectedMethod('paypal')}
                className={`w-full p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                  selectedMethod === 'paypal'
                    ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedMethod === 'paypal' ? 'bg-[#0070BA]' : 'bg-[#0070BA]'
                    }`}>
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.679l-.04.22-.63 3.993-.032.17a.804.804 0 01-.794.679H7.72a.483.483 0 01-.477-.558L9.718 7.5a.805.805 0 01.794-.679h4.646c1.117 0 1.97.23 2.55.54.18.097.34.201.484.314.584.46.973 1.084 1.117 1.803z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">PayPal</h4>
                      <p className="text-xs text-gray-500">Pay with your PayPal account</p>
                    </div>
                  </div>
                  {/* Radio button */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === 'paypal'
                      ? 'border-[#6C60FF] bg-white'
                      : 'border-gray-300'
                  }`}>
                    {selectedMethod === 'paypal' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#6C60FF]"></div>
                    )}
                  </div>
                </div>
              </button>

              {/* Apple Pay */}
              <button
                onClick={() => setSelectedMethod('apple-pay')}
                className={`w-full p-4 border-2 rounded-xl text-left transition-all duration-200 ${
                  selectedMethod === 'apple-pay'
                    ? 'border-[#6C60FF] bg-[#6C60FF]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedMethod === 'apple-pay' ? 'bg-black' : 'bg-black'
                    }`}>
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Apple Pay</h4>
                      <p className="text-xs text-gray-500">Pay with Touch ID or Face ID</p>
                    </div>
                  </div>
                  {/* Radio button */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === 'apple-pay'
                      ? 'border-[#6C60FF] bg-white'
                      : 'border-gray-300'
                  }`}>
                    {selectedMethod === 'apple-pay' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#6C60FF]"></div>
                    )}
                  </div>
                </div>
              </button>
            </div>

            {/* Security Badges */}
            <div className="flex items-center justify-center gap-4 mb-6 text-gray-500">
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span className="text-xs">256-bit SSL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span className="text-xs">Secure payments</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t">
              {/* Back Button */}
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {/* Plan Info and Continue Button */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">{planName} Plan</p>
                  <p className="text-sm font-bold text-gray-900">${displayPrice}/{billingPeriod}</p>
                </div>
                <button
                  onClick={handleContinue}
                  className="bg-[#6C60FF] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#5A4FFF] transition-colors flex items-center gap-2"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PaymentMethodModal;
