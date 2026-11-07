import { useCallback, useEffect, useState } from 'react';
import { newslettersAPI, type NewsletterBrand, type TypeScale } from '../../../services/newslettersAPI';
import type { NlResult } from '../lib/apiResult';
import { headerFrom } from '../lib/draft';
import { recentColorsFrom } from '../lib/colorPicker';
import { sameScale, scaleOf, storedScale } from '../lib/typeScale';

// The account's newsletter brand. GET pre-fills a new draft's header and gives the footer's business address.
// The header is never PUT here: saving a newsletter's header saves the brand header too (contract note 8).
// PUT is only for setting the business address (asked for on the first send if missing) and the default Message box
// text ("Set as my default message", Chris, 1 Nov), which pre-fills every new newsletter.
export interface BrandState {
  brand: NewsletterBrand | null;
  loaded: boolean;
  saveAddress(address: string): Promise<NlResult<NewsletterBrand>>;
  /** Null clears it. Not ok when the API did not keep exactly this text (refused, or an API without the column). */
  saveDefaultMessage(message: string | null): Promise<NlResult<NewsletterBrand>>;
  /** "Use as my default" text sizes (Chris, 7 Nov; null: the usual ones). True when the API kept exactly these. */
  saveTypeScale(scale: TypeScale | null): Promise<boolean>;
}

const normalise = (b: NewsletterBrand): NewsletterBrand => ({
  header: headerFrom(b.header),
  business_address: b.business_address ?? null,
  default_message: typeof b.default_message === 'string' && b.default_message.trim() ? b.default_message : null,
  // Chris, 6 Nov: the colours picked with Custom (RecentColors). Left out when the API has none to give.
  ...(Array.isArray(b.recent_colors) ? { recent_colors: recentColorsFrom(b.recent_colors) } : {}),
  type_scale: storedScale(b.type_scale),
});

export const DEFAULT_MESSAGE_ERROR = "Your default message couldn't be saved. Try again.";

export function useNewsletterBrand(enabled: boolean): BrandState {
  const [brand, setBrand] = useState<NewsletterBrand | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    newslettersAPI.getBrand().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setBrand(normalise(res.data));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  const saveAddress = useCallback(async (address: string) => {
    const res = await newslettersAPI.updateBrand({ business_address: address.trim() });
    if (res.ok && res.data) setBrand(normalise(res.data));
    return res;
  }, []);

  const saveDefaultMessage = useCallback(async (message: string | null) => {
    const wanted = message?.trim() || null;
    const res = await newslettersAPI.updateBrand({ default_message: wanted });
    if (!res.ok || !res.data) return res;
    const next = normalise(res.data);
    setBrand(next);
    return next.default_message === wanted ? res : { ok: false, error: DEFAULT_MESSAGE_ERROR, fieldErrors: {} };
  }, []);

  const saveTypeScale = useCallback(async (scale: TypeScale | null) => {
    const res = await newslettersAPI.updateBrand({ type_scale: scale });
    if (!res.ok || !res.data) return false;
    const next = normalise(res.data);
    setBrand(next);
    // An API without text sizes answers without them: not saved.
    return sameScale(scaleOf(next.type_scale), scaleOf(scale));
  }, []);

  return { brand, loaded, saveAddress, saveDefaultMessage, saveTypeScale };
}
