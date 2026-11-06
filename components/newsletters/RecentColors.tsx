import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newslettersAPI } from '../../services/newslettersAPI';
import { addRecentColor, recentColorsFrom } from './lib/colorPicker';

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
  const [colors, setColors] = useState<string[]>(() => recentColorsFrom(initial));
  // The brand loads after the composer opens: take its list then (a colour picked meanwhile stays first).
  const picked = useRef<string[]>([]);
  useEffect(() => {
    if (initial === undefined || initial === null) return;
    setColors(picked.current.reduceRight((list, c) => addRecentColor(list, c), recentColorsFrom(initial)));
  }, [initial]);
  const add = useCallback((color: string) => {
    picked.current = addRecentColor(picked.current, color);
    setColors((list) => addRecentColor(list, color));
    newslettersAPI.updateBrand({ recent_color: color }).then((res) => {
      // An API without recent colours answers without the list: keep this session's.
      if (res.ok && Array.isArray(res.data?.recent_colors)) setColors(recentColorsFrom(res.data.recent_colors));
    });
  }, []);
  const value = useMemo(() => ({ colors, add }), [colors, add]);
  return <RecentColorsContext.Provider value={value}>{children}</RecentColorsContext.Provider>;
}

export function useRecentColors(): RecentColorsValue {
  return useContext(RecentColorsContext);
}
