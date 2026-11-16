import React, { useEffect, useState } from "react";
import { X, Loader2, Mail, Phone, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import CountrySelect from "./CountrySelect";
import { isPlausibleSplitPhone, splitTypedPhone, toE164 } from "../utils/phoneUtils";
import { enquiryMessage, enquiryErrors, ENQUIRY_SENT, ENQUIRY_MAX_MESSAGE } from "../utils/productEnquiry";

/**
 * Chris 16 Nov 2026 (point 4): the public campaign page's "Enquire" form for one product moment. Same look as the
 * "Request a Moment" form (RequestMomentModal): name, an email-or-mobile choice, a message prefilled with the product,
 * Send. It POSTs /memories/{memoryId}/enquire; the owner gets the enquirer as a lead with the enquiry in its chat.
 * Field errors sit under their field, anything else at the bottom of the card.
 */
export interface ProductEnquireModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoryId: string | number | null | undefined;
  /** The product moment (memory_images id). */
  postId: string | number | null;
  productTitle: string;
  /** The page's access token (Private campaigns) and printed QR code, sent so the server applies the page's access. */
  accessToken?: string | null;
  qr?: string | null;
}

type FieldErrors = { name?: string; contact?: string; message?: string };

export default function ProductEnquireModal({ open, onOpenChange, memoryId, postId, productTitle, accessToken = null, qr = null }: ProductEnquireModalProps) {
  const [name, setName] = useState('');
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [contactValue, setContactValue] = useState('');
  const [contactCountry, setContactCountry] = useState('+1');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // A fresh form, with the message prefilled for this product, every time it opens.
  useEffect(() => {
    if (!open) return;
    setName('');
    setContactType('phone');
    setContactValue('');
    setContactCountry('+1');
    setMessage(enquiryMessage(productTitle));
    setErrors({});
    setSubmitError('');
    setSubmitting(false);
    setSent(false);
  }, [open, postId, productTitle]);

  const close = () => {
    if (submitting) return;
    onOpenChange(false);
  };

  const handleSend = async () => {
    if (submitting) return;
    const next: FieldErrors = {};
    const contact = contactValue.trim();
    if (!name.trim()) next.name = 'Enter your name.';
    if (!contact) next.contact = contactType === 'email' ? 'Enter your email.' : 'Enter your mobile number.';
    else if (contactType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) next.contact = 'Enter a valid email address.';
    else if (contactType === 'phone' && !isPlausibleSplitPhone(contactCountry, contact)) next.contact = 'Enter a valid mobile number.';
    setErrors(next);
    setSubmitError('');
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      // Raw fetch, not apiRequest: its 401 handling would send a signed-out visitor to /login.
      const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/react';
      const res = await fetch(`${apiBase}/memories/${encodeURIComponent(String(memoryId))}/enquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          memory_image_id: Number(postId),
          name: name.trim(),
          ...(contactType === 'email' ? { email: contact } : { phone: toE164(contactCountry, contact) || contact }),
          message: message.trim(),
          ...(accessToken ? { access_token: accessToken } : {}),
          ...(qr ? { qr } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const mapped = enquiryErrors(res.status, body);
        setErrors(mapped.fields);
        setSubmitError(mapped.general);
        return;
      }
      setSent(true);
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputBorder = (bad: boolean) => bad
    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
    : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && submitting) return; onOpenChange(next); }}>
      <DialogContent
        // Typed text only goes on an explicit close (X / Cancel), as the Request a Moment form: on phones the
        // keyboard opening was read as a tap outside.
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        data-testid="product-enquire-modal"
        className="max-w-none md:max-w-[480px] w-full h-full md:h-auto md:w-[calc(100%-30px)] md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <h4 className="font-semibold text-[18px] text-gray-900">Enquire</h4>
          <button type="button" onClick={close} disabled={submitting} aria-label="Close"
            className="h-10 w-10 flex items-center justify-center hover:bg-gray-100 rounded-full disabled:opacity-40 disabled:cursor-not-allowed">
            <X className="w-[28px] h-[28px] text-black" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 md:px-0 md:py-0">
          <DialogTitle className="hidden md:block text-lg font-semibold text-gray-900 mb-1">Enquire</DialogTitle>
          {sent ? (
            <div role="status" className="flex flex-col items-center text-center gap-3 py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              <p className="text-[16px] font-medium text-gray-900">{ENQUIRY_SENT}</p>
            </div>
          ) : (
            <>
              <p className="text-[14px] md:text-sm text-[#6A7282] leading-relaxed mb-5 break-words">{productTitle}</p>

              {/* Name */}
              <div className="mb-5">
                <label htmlFor="enquire-name" className="block text-[14px] md:text-sm font-medium text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input id="enquire-name" type="text" value={name} maxLength={191} placeholder="Your name" autoComplete="name"
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
                  aria-invalid={!!errors.name}
                  className={`w-full h-12 md:h-10 px-4 md:px-3 border rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 ${inputBorder(!!errors.name)}`} />
                {errors.name && <p className="text-[14px] md:text-xs text-red-600 mt-2">{errors.name}</p>}
              </div>

              {/* Phone or email */}
              <div className="mb-5">
                <span className="block text-[14px] md:text-sm font-medium text-gray-900 mb-2">
                  Phone or email <span className="text-red-500">*</span>
                </span>
                <div className="flex items-center gap-5 mb-3">
                  {(['phone', 'email'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="enquire-contact-type" value={type} checked={contactType === type}
                        onChange={() => { setContactType(type); setContactValue(''); setErrors({ ...errors, contact: undefined }); }}
                        className="w-4 h-4 accent-[#6C60FF]" />
                      <span className="text-[14px] md:text-sm text-gray-700">{type === 'email' ? 'Email' : 'Phone'}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  {contactType === 'phone' && (
                    <CountrySelect value={contactCountry} onChange={(code) => { setContactCountry(code); if (errors.contact) setErrors({ ...errors, contact: undefined }); }}
                      ariaLabel="Country code"
                      className="w-28 flex-shrink-0 h-12 md:h-10 border border-gray-300 rounded-lg bg-white text-[14px] md:text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]" />
                  )}
                  <div className="relative flex-1 min-w-0">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      {contactType === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>
                    <input
                      type={contactType === 'email' ? 'email' : 'tel'}
                      inputMode={contactType === 'email' ? 'email' : 'tel'}
                      autoComplete={contactType === 'email' ? 'email' : 'tel-national'}
                      value={contactValue}
                      onChange={(e) => {
                        if (contactType === 'phone') {
                          const next = splitTypedPhone(contactCountry, e.target.value);
                          setContactCountry(next.countryCode);
                          setContactValue(next.number);
                        } else {
                          setContactValue(e.target.value);
                        }
                        if (errors.contact) setErrors({ ...errors, contact: undefined });
                      }}
                      placeholder={contactType === 'email' ? 'name@example.com' : '1235555555'}
                      maxLength={contactType === 'email' ? 191 : 20}
                      aria-label={contactType === 'email' ? 'Email' : 'Phone'}
                      aria-invalid={!!errors.contact}
                      className={`w-full h-12 md:h-10 pl-9 pr-4 md:pr-3 border rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 ${inputBorder(!!errors.contact)}`}
                    />
                  </div>
                </div>
                {errors.contact && <p className="text-[14px] md:text-xs text-red-600 mt-2">{errors.contact}</p>}
              </div>

              {/* Message */}
              <div className="mb-2">
                <label htmlFor="enquire-message" className="block text-[14px] md:text-sm font-medium text-gray-900 mb-2">Message</label>
                <textarea id="enquire-message" value={message} rows={4} maxLength={ENQUIRY_MAX_MESSAGE}
                  onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors({ ...errors, message: undefined }); }}
                  aria-invalid={!!errors.message}
                  className={`w-full px-4 md:px-3 py-3 border rounded-lg text-[14px] md:text-sm resize-none focus:outline-none focus:ring-2 ${inputBorder(!!errors.message)}`} />
                {errors.message && <p className="text-[14px] md:text-xs text-red-600 mt-2">{errors.message}</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer: errors at the bottom of the card, then the buttons */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 md:border-0 md:px-0 md:pb-0 md:pt-5">
          {submitError && !sent && (
            <p role="alert" className="text-[14px] md:text-xs text-red-600 mb-3 text-center md:text-right">{submitError}</p>
          )}
          <div className="flex items-center justify-end gap-3">
            {sent ? (
              <Button type="button" onClick={close} className="flex-1 md:flex-none h-11 md:h-10 px-6 bg-[#6C60FF] hover:bg-[#5A52E6] text-white">Done</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={close} disabled={submitting}
                  className="flex-1 md:flex-none h-11 md:h-10 px-6 border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</Button>
                <Button type="button" onClick={handleSend} disabled={submitting}
                  className="flex-1 md:flex-none h-11 md:h-10 px-6 bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>) : 'Send'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
