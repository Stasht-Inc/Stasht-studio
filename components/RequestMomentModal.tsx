import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Loader2, Mail, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import exifr from "exifr";
import { dashboardAPI } from "../utils/authUtils";
import ToneSelectionModal from "./ToneSelectionModal";

/**
 * "Share Request a Moment" submission form.
 *
 * Rendered in two places, which differ only by `variant`:
 *
 *  - 'public'        — the published memory page. The visitor may be anonymous,
 *                      so the photo goes through the public upload route and no
 *                      contact details are known up front.
 *  - 'authenticated' — the shared-with memory page. Always a signed-in user, so
 *                      the photo uses the normal /user upload route, the contact
 *                      field is prefilled from their account, and the caption
 *                      offers AI suggest (which needs auth and spends credits).
 *
 * Both variants POST the same payload to /memories/submit-photo.
 */

const RM_ACCEPT = '.jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic';
const RM_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'heic'];

export interface RequestMomentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Campaign the submission belongs to. */
  memoryId: string | number | null | undefined;
  /** Post the submission should land after; null = top of the timeline. */
  afterPostId?: string | null;
  variant: 'public' | 'authenticated';
  /** Prefills from the signed-in account — authenticated variant only. */
  prefillName?: string | null;
  prefillEmail?: string | null;
  prefillPhone?: string | null;
  onSubmitted?: () => void;
}

export default function RequestMomentModal({
  open,
  onOpenChange,
  memoryId,
  afterPostId = null,
  variant,
  prefillName,
  prefillEmail,
  prefillPhone,
  onSubmitted,
}: RequestMomentModalProps) {
  const isAuthed = variant === 'authenticated';

  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [contactValue, setContactValue] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadedMeta, setUploadedMeta] = useState<{
    imageUrl: string | null;
    location: string | null;
    date: string | null;
    size: number | string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Errors live next to the block they belong to, not in one shared line.
  const [nameError, setNameError] = useState('');
  const [fileError, setFileError] = useState('');
  const [contactError, setContactError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // AI caption suggestion (authenticated variant only)
  const [isToneModalOpen, setIsToneModalOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiSuggestButtonRef = useRef<HTMLButtonElement>(null);

  const resetForm = () => {
    setName('');
    setFile(null);
    setPreview(null);
    setUploadedMeta(null);
    setUploading(false);
    setCaption('');
    setContactType('email');
    setContactValue('');
    setNameError('');
    setFileError('');
    setContactError('');
    setSubmitError('');
    setSubmitting(false);
    setIsSuggesting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Seed the contact field from the signed-in account each time the modal opens.
  // Runs on open (not mount) so a fresh open after a reset re-applies it.
  useEffect(() => {
    if (!open || !isAuthed) return;
    if (prefillName) setName(prefillName);
    if (prefillEmail) {
      setContactType('email');
      setContactValue(prefillEmail);
    } else if (prefillPhone) {
      setContactType('phone');
      setContactValue(prefillPhone);
    }
  }, [open, isAuthed, prefillName, prefillEmail, prefillPhone]);

  const close = () => {
    if (submitting) return;
    onOpenChange(false);
    resetForm();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const ext = (picked.name.split('.').pop() || '').toLowerCase();
    if (!RM_ALLOWED_EXT.includes(ext)) {
      setFileError('Please choose a JPG, JPEG, PNG or HEIC image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFileError('');
    setFile(picked);
    setUploadedMeta(null);

    // HEIC has no browser decoder, so it gets a filename chip instead of a
    // thumbnail. The file still uploads — the backend converts it.
    if (ext === 'heic' || !picked.type.startsWith('image/')) {
      setPreview(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(picked);
    }

    // Upload straight away so the S3 URL and extracted location/date/size are
    // ready before Submit. Mirrors AddMomentModal's flow.
    setUploading(true);
    try {
      const exif = await exifr.parse(picked, ['Orientation']).catch(() => null);
      const orientation = exif?.Orientation ?? 1;
      const metaRes = isAuthed
        ? await dashboardAPI.uploadImageWithMetadata(picked, picked.name, orientation)
        : await dashboardAPI.uploadImageWithMetadataPublic(picked, picked.name, orientation);
      if (!metaRes?.success) {
        setFileError('We could not upload that photo. Please try again.');
        setUploadedMeta(null);
        return;
      }
      const meta = metaRes.data?.data || metaRes.data || {};
      setUploadedMeta({
        imageUrl: meta.fileUrl ?? null,
        location: meta.location ?? null,
        date: meta.capture_date ?? null,
        size: meta.originalSizeMB ?? null,
      });
    } catch {
      setFileError('We could not upload that photo. Please try again.');
      setUploadedMeta(null);
    } finally {
      setUploading(false);
    }
  };

  // AI suggest needs the decoded image, so it is unavailable for HEIC (no preview).
  const canSuggest = isAuthed && !!preview && !isSuggesting && !uploading;

  const handleToneSelect = async (tone: string) => {
    setIsToneModalOpen(false);
    if (!preview) return;
    setIsSuggesting(true);
    try {
      const res = await dashboardAPI.getSuggestedDescription(preview, tone, memoryId ? String(memoryId) : undefined);
      if (res.success && res.data?.description) {
        setCaption(res.data.description);
        toast.success('AI suggestion added!');
      } else {
        toast.error(res.error || 'Failed to get AI suggestion');
      }
    } catch {
      toast.error('Failed to get AI suggestion');
    } finally {
      setIsSuggesting(false);
    }
  };

  // Photo and contributor name are both required; the caption is optional.
  // Submit also stays blocked while the photo is still uploading, otherwise
  // image_url would go up null and the submission would silently lose its photo.
  const hasName = name.trim().length > 0;
  const hasPhoto = !!file;
  const canSubmit = hasName && hasPhoto && !uploading;
  const disabledHint = uploading
    ? 'Uploading your photo…'
    : !hasPhoto && !hasName
      ? 'Add a photo and enter your name to submit.'
      : !hasPhoto
        ? 'Add a photo to submit.'
        : 'Enter your name to submit.';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // Contact is optional, but validate the format when something was typed.
    const contact = contactValue.trim();
    if (contact) {
      if (contactType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        setContactError('Please enter a valid email address.');
        return;
      }
      if (contactType === 'phone' && contact.replace(/\D/g, '').length < 7) {
        setContactError('Please enter a valid mobile number.');
        return;
      }
    }
    setContactError('');
    setSubmitError('');
    setSubmitting(true);
    try {
      // Raw fetch, not apiRequest: apiRequest's 401 handler clears auth and
      // redirects to /login for any endpoint outside its whitelist, which would
      // throw a signed-out visitor off the published page.
      const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/react';
      const res = await fetch(`${apiBase}/memories/submit-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          memory_id: Number(memoryId),
          after_post_id: afterPostId ? Number(afterPostId) : null,
          image_url: uploadedMeta?.imageUrl ?? null,
          location: uploadedMeta?.location ?? null,
          date: uploadedMeta?.date ?? null,
          caption: caption.trim() || null,
          name: name.trim(),
          email: contactType === 'email' ? (contact || null) : null,
          mobile: contactType === 'phone' ? (contact || null) : null,
          size: uploadedMeta?.size ?? null,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // Laravel returns {message, errors:{field:[msg]}} on a 422
        const firstFieldError = body?.errors && Object.values(body.errors as Record<string, string[]>)[0]?.[0];
        setSubmitError(firstFieldError || body?.message || 'Something went wrong. Please try again.');
        return;
      }

      toast.success('Thanks! Your moment was submitted for review.');
      onSubmitted?.();
      close();
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Never yank the form away mid-submit — the request is already in flight.
          if (!next && submitting) return;
          onOpenChange(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent
          // This form holds an uploaded photo and typed text, so it only closes on
          // an explicit action: the X, Cancel, or a successful submit. Tapping
          // outside and pressing Escape are both ignored — on mobile the keyboard
          // opening was being misread as an outside tap and silently discarding
          // everything the contributor had entered.
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-w-none md:max-w-[560px] w-full h-full md:h-auto md:w-[calc(100%-30px)] md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
          {/* Mobile header */}
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h4 className="font-semibold text-[18px] text-gray-900">Request a Moment</h4>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="h-10 w-10 flex items-center justify-center hover:bg-gray-100 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X className="w-[28px] h-[28px] text-black" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 md:px-0 md:py-0">
            <DialogTitle className="hidden md:block text-lg font-semibold text-gray-900 mb-1">Request a Moment</DialogTitle>
            <p className="text-[14px] md:text-sm text-[#6A7282] leading-relaxed mb-5">
              Share your experience by uploading a photo and adding a caption. Your submission will be reviewed before it appears in the campaign.
            </p>

            {/* Photo */}
            <div className="mb-5">
              <label className="block text-[14px] md:text-sm font-medium text-gray-900 mb-2">
                Photo <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept={RM_ACCEPT}
                onChange={handleFileSelect}
                className="hidden"
                id="request-moment-file"
              />
              {!file ? (
                <label
                  htmlFor="request-moment-file"
                  className="flex flex-col items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#6C60FF] hover:bg-[#6C60FF]/5 transition-colors"
                >
                  <Upload className="w-6 h-6 text-[#6C60FF]" />
                  <span className="text-[14px] md:text-sm font-medium text-[#6C60FF]">Choose a photo</span>
                  <span className="text-[12px] md:text-xs text-gray-500">JPG, JPEG, PNG or HEIC</span>
                </label>
              ) : (
                <div className="relative rounded-lg border border-gray-200 overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Selected" className="w-full max-h-64 object-contain bg-gray-50" />
                  ) : (
                    // HEIC and other non-previewable files show a filename chip
                    <div className="flex items-center gap-3 p-4 bg-gray-50">
                      <div className="w-10 h-10 rounded-lg bg-[#6C60FF]/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-[#6C60FF]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] md:text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-[12px] md:text-xs text-gray-500">Preview unavailable for this format</p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); setUploadedMeta(null); setFileError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    aria-label="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-[#6C60FF] animate-spin" />
                    </div>
                  )}
                </div>
              )}
              {fileError && <p className="text-[13px] md:text-xs text-red-600 mt-2">{fileError}</p>}
            </div>

            {/* Caption */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="request-moment-caption" className="block text-[14px] md:text-sm font-medium text-gray-900">
                  Caption <span className="font-normal text-gray-400">(optional)</span>
                </label>
                {isAuthed && (
                  <Button
                    ref={aiSuggestButtonRef}
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsToneModalOpen(true)}
                    disabled={!canSuggest}
                    title={!preview ? 'Add a photo we can preview to use AI suggest' : undefined}
                    className="text-sm h-auto p-0 font-normal flex items-center gap-1.5 hover:bg-transparent"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-4 h-4 mr-2 flex-shrink-0"
                      style={{ color: 'rgb(108, 96, 255)' }}>
                      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
                      <path d="M20 3v4"></path>
                      <path d="M22 5h-4"></path>
                      <path d="M4 17v2"></path>
                      <path d="M5 18H3"></path>
                    </svg>
                    <span
                      style={{
                        background: 'linear-gradient(90deg, rgb(108, 96, 255) 0%, rgb(255, 81, 226) 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      {isSuggesting ? 'Suggesting...' : 'AI suggest'}
                    </span>
                  </Button>
                )}
              </div>
              <textarea
                id="request-moment-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Tell us about this moment..."
                className="w-full px-4 md:px-3 py-3 border border-gray-300 rounded-lg text-[14px] md:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
              />
            </div>

            {/* Contributor name — required, sits under the caption */}
            <div className="mb-5">
              <label htmlFor="request-moment-name" className="block text-[14px] md:text-sm font-medium text-gray-900 mb-2">
                Contributor Name <span className="text-red-500">*</span>
              </label>
              <input
                id="request-moment-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                // Flag the empty required field once they leave it, not while typing
                onBlur={() => setNameError(name.trim() ? '' : 'Name is required.')}
                placeholder="Your name"
                maxLength={191}
                aria-invalid={!!nameError}
                className={`w-full h-12 md:h-10 px-4 md:px-3 border rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 ${
                  nameError
                    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                }`}
              />
              {nameError && <p className="text-[13px] md:text-xs text-red-600 mt-2">{nameError}</p>}
            </div>

            {/* Contact — email or mobile, chosen by radio */}
            <div className="mb-2">
              <span className="block text-[14px] md:text-sm font-medium text-gray-900">
                Get notified about your moment <span className="font-normal text-gray-400">(optional)</span>
              </span>
              <p className="text-[12px] md:text-xs text-[#6A7282] mb-3 mt-1 leading-relaxed">
                Leave your email or mobile and we'll let you know once your photo has been reviewed and added to the campaign.
              </p>
              <div className="flex items-center gap-5 mb-3">
                {(['email', 'phone'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="request-moment-contact-type"
                      value={type}
                      checked={contactType === type}
                      onChange={() => {
                        setContactType(type);
                        // Re-apply the account value for the newly chosen channel
                        // rather than clearing what we prefilled.
                        const seeded = type === 'email' ? prefillEmail : prefillPhone;
                        setContactValue(isAuthed && seeded ? seeded : '');
                        setContactError('');
                      }}
                      className="w-4 h-4 accent-[#6C60FF]"
                    />
                    <span className="text-[14px] md:text-sm text-gray-700">{type === 'email' ? 'Email address' : 'Mobile number'}</span>
                  </label>
                ))}
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  {contactType === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </div>
                <input
                  type={contactType === 'email' ? 'email' : 'tel'}
                  inputMode={contactType === 'email' ? 'email' : 'tel'}
                  value={contactValue}
                  onChange={(e) => { setContactValue(e.target.value); if (contactError) setContactError(''); }}
                  placeholder={contactType === 'email' ? 'you@example.com' : '+1 555 000 1234'}
                  maxLength={contactType === 'email' ? 191 : 20}
                  aria-label={contactType === 'email' ? 'Email address' : 'Mobile number'}
                  aria-invalid={!!contactError}
                  className={`w-full h-12 md:h-10 pl-9 pr-4 md:pr-3 border rounded-lg text-[14px] md:text-sm focus:outline-none focus:ring-2 ${
                    contactError
                      ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-gray-300 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]'
                  }`}
                />
              </div>
              {contactError && <p className="text-[13px] md:text-xs text-red-600 mt-2">{contactError}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 md:border-0 md:px-0 md:pb-0 md:pt-5">
            {/* Tell the visitor why Submit is greyed out */}
            {!canSubmit && (
              <p className="text-[13px] md:text-xs text-gray-500 mb-3 text-center md:text-right">
                {disabledHint}
              </p>
            )}
            {submitError && (
              <p className="text-[13px] md:text-xs text-red-600 mb-3 text-center md:text-right">{submitError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={submitting}
                className="flex-1 md:flex-none h-11 md:h-10 px-6 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="flex-1 md:flex-none h-11 md:h-10 px-6 bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#6C60FF]"
              >
                {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>) : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isAuthed && (
        <ToneSelectionModal
          isOpen={isToneModalOpen}
          onClose={() => setIsToneModalOpen(false)}
          onToneSelect={handleToneSelect}
          buttonRef={aiSuggestButtonRef}
        />
      )}
    </>
  );
}
