import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newslettersAPI } from '../../services/newslettersAPI';
import { recentFromBrand, recentFromServer, recentPick, recentStart, type RecentState } from './lib/colorPicker';

// Chris (6 Nov, point 4b): a colour picked with Custom is offered again in every colour panel (title / text colour,
// section and header background, button colour), newest first, at most 8. Saved with the account's newsletter brand
// (GET/PUT /newsletter-brand recent_colors), so it follows the account to every device. Without a provider (a part
// shown on its own) there are no recent colours and nothing is saved.

interface RecentColorsValue {
  colors: string[];
  /** A colour picked with Custom: first in the list now, and saved for the account. */
  add(color: string): void;
}

const RecentColorsContext = createContext<RecentColorsValue>({ colors: [], add: () => {} });

export function RecentColorsProvider({ initial, children }: { initial: unknown; children: ReactNode }) {
  // The state lives in a ref too, so a save's answer is checked against the latest save (review, 6 Nov: a late answer
  // must not drop a newer pick; lib/colorPicker.ts recentFromServer).
  const state = useRef<RecentState>(recentStart(initial));
  const [colors, setColors] = useState<string[]>(state.current.colors);
  const commit = (next: RecentState) => {
    state.current = next;
    setColors(next.colors);
  };
  // The brand loads after the composer opens: take its list then (a colour picked meanwhile stays first).
  useEffect(() => {
    if (initial === undefined || initial === null) return;
    commit(recentFromBrand(state.current, initial));
  }, [initial]);
  const add = useCallback((color: string) => {
    const { state: next, seq } = recentPick(state.current, color);
    commit(next);
    newslettersAPI.updateBrand({ recent_color: color }).then((res) => {
      // An API without recent colours answers without the list: keep this session's.
      commit(recentFromServer(state.current, res.ok ? res.data?.recent_colors : null, seq));
    });
  }, []);
  const value = useMemo(() => ({ colors, add }), [colors, add]);
  return <RecentColorsContext.Provider value={value}>{children}</RecentColorsContext.Provider>;
}

export function useRecentColors(): RecentColorsValue {
  return useContext(RecentColorsContext);
}
