// The Dashboard trial banner's data (Chris, 29 Oct 2026; components/Dashboard.tsx).
//
// The Admin Portal's "Trial Period Ends" date is the ACCOUNT's plan trial. GET /properties returns it as
// data.account_trial ({ trial_ends_at, trial_ends_on, trial_ended } or null; web API 1 Nov 2026). The banner used to
// read only an owned property's trial_ends_at, so an account with a plan trial and no property of its own (e.g.
// TheRoyalWoodShop) showed nothing. The account trial comes first; without one, the first owned property with a trial
// date shows as before (with its name).

export interface TrialSource {
  trial_ends_at?: string | null;
  trial_ends_on?: string | null;
  trial_ended?: boolean | null;
  name?: string;
}

export interface TrialBanner {
  ended: boolean;
  daysLeft: number;
  endDate: string;
  name?: string;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// A date-time without a zone ("2027-01-28 23:59:59", how property rows send it): its own calendar date.
const NO_ZONE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

const localDate = (y: string, m: string, d: string) => new Date(Number(y), Number(m) - 1, Number(d));

/** The trial's last day as a local calendar date (never a day early from a UTC parse); null when there is none. */
export function trialEndDate(t: TrialSource | null | undefined): Date | null {
  if (!t) return null;
  const on = typeof t.trial_ends_on === 'string' ? t.trial_ends_on.match(DATE_ONLY) : null;
  if (on) return localDate(on[1], on[2], on[3]);
  const at = typeof t.trial_ends_at === 'string' ? t.trial_ends_at.trim() : '';
  if (!at) return null;
  const bare = at.match(NO_ZONE);
  if (bare) return localDate(bare[1], bare[2], bare[3]);
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** The trial the banner is about: the account's plan trial, else the first owned property with a trial date. */
export function pickTrial(propertiesData: any): TrialSource | null {
  const d = propertiesData || {};
  const account = d.account_trial;
  if (account && (account.trial_ends_on || account.trial_ends_at)) {
    return { trial_ends_at: account.trial_ends_at, trial_ends_on: account.trial_ends_on, trial_ended: account.trial_ended };
  }
  const owned: any[] = Array.isArray(d.owned_properties) ? d.owned_properties : [];
  const withTrial = owned.find((p: any) => p?.trial_ends_at);
  return withTrial
    ? { trial_ends_at: withTrial.trial_ends_at, trial_ended: withTrial.trial_ended, name: withTrial.name }
    : null;
}

/** Days left while the trial runs, or an ended notice once it has finished; null = no banner. */
export function trialBannerFrom(propertiesData: any, now: Date = new Date(), locale?: string): TrialBanner | null {
  const trial = pickTrial(propertiesData);
  const endsOn = trialEndDate(trial);
  if (!trial || !endsOn) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((endsOn.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  const ended = Boolean(trial.trial_ended) || daysLeft < 0;
  const endDate = endsOn.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return { ended, daysLeft, endDate, name: trial.name };
}
