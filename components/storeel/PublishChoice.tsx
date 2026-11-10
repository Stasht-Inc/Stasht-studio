// Chris 9 Nov 2026 (point 6): the Send card's Publishing options are one choice — Public pre-selected on an unpublished
// campaign, its own mode on a published one — that Save & Send applies (POST /memories/{id}/storeel-send publish_role).
// Tapping an option publishes nothing. The campaign page wraps its Edit / Send stepper in this provider so the
// Publishing card (which sets the choice) and the Send step (which sends it) share it; the Create Campaign flow has no
// provider, so its sends are unchanged (no publish_role: the API publishes Public).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultPublishChoice, publishedRole, type PublishRole } from './lib/publishing';

export interface PublishChoiceValue {
  role: PublishRole;
  setRole(role: PublishRole): void;
}

const PublishChoiceContext = createContext<PublishChoiceValue | null>(null);

export function PublishChoiceProvider({ published, children }: { published: unknown; children: ReactNode }) {
  const current = publishedRole(published);
  const [role, setRole] = useState<PublishRole>(() => defaultPublishChoice(current));
  // Published / switched / unpublished (Publish now, Unpublish): the choice follows the campaign's mode again.
  useEffect(() => { setRole(defaultPublishChoice(current)); }, [current]);
  return <PublishChoiceContext.Provider value={{ role, setRole }}>{children}</PublishChoiceContext.Provider>;
}

/** The Publishing choice, or null outside the campaign page's stepper. */
export function usePublishChoice(): PublishChoiceValue | null {
  return useContext(PublishChoiceContext);
}
