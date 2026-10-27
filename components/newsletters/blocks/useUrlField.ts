import { useEffect, useRef, useState } from 'react';

/**
 * A link field that only ever saves a valid value. What people type stays in the field, but the block gets
 * `parse(typed)` when it is valid and '' otherwise: the API refuses a whole draft that holds a non-https link
 * (NewsletterContent::optionalUrl), so an unfinished link must never reach a save. On blur the field shows
 * the cleaned link ("serpachrysler.ca" → "https://serpachrysler.ca/").
 */
export function useUrlField(value: string, onCommit: (next: string) => void, parse: (raw: string) => string | null) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value);
    }
  }, [value]);

  const change = (raw: string) => {
    setDraft(raw);
    const next = raw.trim() ? parse(raw) ?? '' : '';
    if (next !== committed.current) {
      committed.current = next;
      onCommit(next);
    }
  };
  const blur = () => {
    const parsed = draft.trim() ? parse(draft) : null;
    if (parsed && parsed !== draft) setDraft(parsed);
  };
  const invalid = draft.trim() !== '' && parse(draft) === null;
  return { draft, change, blur, invalid };
}
