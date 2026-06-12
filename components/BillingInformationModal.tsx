import React, { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';

interface BillingInformationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  planName: string;
  planPrice: string;
  isYearly: boolean;
  onSubmit?: (billingData: BillingData) => void;
}

export interface BillingData {
  cardNumber: string;
  expiryDate: string;
  cvc: string;
  nameOnCard: string;
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

export function BillingInformationModal({
  isOpen,
  onClose,
  onBack,
  planName,
  planPrice,
  isYearly,
  onSubmit
}: BillingInformationModalProps) {
  const [formData, setFormData] = useState<BillingData>({
    cardNumber: '',
    expiryDate: '',
    cvc: '',
    nameOnCard: '',
    firstName: '',
    lastName: '',
    email: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    agreedToTerms: false
  });

  const [errors, setErrors] = useState<Partial<Record<keyof BillingData, string>>>({});

  if (!isOpen) return null;

  const billingPeriod = isYearly ? 'year' : 'month';

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  // Format expiry date as MM/YY
  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
    }
    return v;
  };

  const handleInputChange = (field: keyof BillingData, value: string) => {
    let formattedValue = value;

    if (field === 'cardNumber') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiryDate') {
      formattedValue = formatExpiryDate(value);
    } else if (field === 'cvc') {
      formattedValue = value.replace(/[^0-9]/gi, '').substring(0, 4);
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof BillingData, string>> = {};

    // Payment Details validation
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
      newErrors.cardNumber = 'Valid card number required';
    }
    if (!formData.expiryDate || formData.expiryDate.length !== 5) {
      newErrors.expiryDate = 'Valid expiry date required (MM/YY)';
    }
    if (!formData.cvc || formData.cvc.length < 3) {
      newErrors.cvc = 'Valid CVC required';
    }
    if (!formData.nameOnCard.trim()) {
      newErrors.nameOnCard = 'Name on card required';
    }

    // Billing Address validation
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
    if (!formData.state.trim()) {
      newErrors.state = 'State required';
    }
    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'ZIP code required';
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Country required';
    }

    // Terms validation
    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm() && onSubmit) {
      onSubmit(formData);
    }
  };

  // US States for dropdown
  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ];

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
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-6 pb-4 border-b">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">Billing Information</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your billing details to complete your purchase</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Payment Details */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Payment Details</h3>

              <div className="space-y-4">
                {/* Card Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={formData.cardNumber}
                    onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.cardNumber
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.cardNumber && (
                    <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>
                  )}
                </div>

                {/* Expiry Date & CVC */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={formData.expiryDate}
                      onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.expiryDate
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    />
                    {errors.expiryDate && (
                      <p className="text-xs text-red-500 mt-1">{errors.expiryDate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      CVC
                    </label>
                    <input
                      type="text"
                      value={formData.cvc}
                      onChange={(e) => handleInputChange('cvc', e.target.value)}
                      placeholder="123"
                      maxLength={4}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.cvc
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    />
                    {errors.cvc && (
                      <p className="text-xs text-red-500 mt-1">{errors.cvc}</p>
                    )}
                  </div>
                </div>

                {/* Name on Card */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name on Card
                  </label>
                  <input
                    type="text"
                    value={formData.nameOnCard}
                    onChange={(e) => handleInputChange('nameOnCard', e.target.value)}
                    placeholder="John Doe"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.nameOnCard
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.nameOnCard && (
                    <p className="text-xs text-red-500 mt-1">{errors.nameOnCard}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Billing Address */}
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
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
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
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.email
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      errors.streetAddress
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                    }`}
                  />
                  {errors.streetAddress && (
                    <p className="text-xs text-red-500 mt-1">{errors.streetAddress}</p>
                  )}
                </div>

                {/* City & State */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.city
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    />
                    {errors.city && (
                      <p className="text-xs text-red-500 mt-1">{errors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      State
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors appearance-none bg-white ${
                        errors.state
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    >
                      <option value="">Select state</option>
                      {states.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    {errors.state && (
                      <p className="text-xs text-red-500 mt-1">{errors.state}</p>
                    )}
                  </div>
                </div>

                {/* ZIP Code & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => handleInputChange('zipCode', e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.zipCode
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                      }`}
                    />
                    {errors.zipCode && (
                      <p className="text-xs text-red-500 mt-1">{errors.zipCode}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Country
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors appearance-none bg-white ${
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
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={(e) => setFormData(prev => ({ ...prev, agreedToTerms: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-[#6C60FF] border-gray-300 rounded focus:ring-[#6C60FF]"
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
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {/* Plan Info and Pay Button */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">{planName} Plan</p>
                  <p className="text-sm font-bold text-gray-900">${planPrice}/{billingPeriod}</p>
                </div>
                <button
                  onClick={handleSubmit}
                  className="bg-[#6C60FF] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#5A4FFF] transition-colors flex items-center gap-2"
                >
                  Pay ${planPrice}
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

export default BillingInformationModal;
