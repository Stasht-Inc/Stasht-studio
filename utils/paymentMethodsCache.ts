// The Dashboard trial banner's card check (Chris, 4 Nov 2026; review): GET /stripe/payment-methods asks Stripe, so it is
// asked once per login (token) rather than on every Dashboard visit. Adding a card (AddPaymentMethodModal) or removing
// one (Billing) clears it. A failed answer is never kept. Pure (the fetch is passed in): tests/utils/trialBanner.test.mjs.

type Fetcher = () => Promise<any>;

let cached: { token: string; promise: Promise<any> } | null = null;

/** The payment-methods answer for this token: the one already asked for, else a new call (null when it threw). */
export function cachedPaymentMethods(token: string | null | undefined, fetcher: Fetcher): Promise<any> {
  if (!token) return Promise.resolve(null);
  if (cached && cached.token === token) return cached.promise;
  const promise = fetcher().catch(() => null);
  const entry = { token, promise };
  cached = entry;
  void promise.then((res) => {
    // Only a successful answer is kept; ask again next time otherwise.
    if (!(res && res.success === true) && cached === entry) cached = null;
  });
  return promise;
}

/** Forget the answer (a card was added or removed): the next check asks again. */
export function clearPaymentMethodsCache(): void {
  cached = null;
}
