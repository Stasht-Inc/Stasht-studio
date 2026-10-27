import { useCallback, useEffect, useState } from 'react';
import { newslettersAPI, type NewsletterBrand } from '../../../services/newslettersAPI';
import type { NlResult } from '../lib/apiResult';
import { headerFrom } from '../lib/draft';

// The account's newsletter brand. GET pre-fills a new draft's header and gives the footer's business address.
// The header is never PUT here: saving a newsletter's header saves the brand header too (contract note 8).
// PUT is only for setting the business address (asked for on the first send if missing).
export interface BrandState {
  brand: NewsletterBrand | null;
  loaded: boolean;
  saveAddress(address: string): Promise<NlResult<NewsletterBrand>>;
}

const normalise = (b: NewsletterBrand): NewsletterBrand => ({ header: headerFrom(b.header), business_address: b.business_address ?? null });

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

  return { brand, loaded, saveAddress };
}
