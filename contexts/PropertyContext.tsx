import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setTabPropertyView } from '../utils/inventoryView';
import { ACCOUNT_STATE_CLEARED_EVENT, PROPERTY_VIEW_OWNER_KEY } from '../utils/accountState';

interface Property {
  id: number;
  name: string;
  username: string;
  unique_id: string;
  image?: string;
  location?: string;
  user_id?: number;
  // The signed-in user's relation to it (from the properties payload): decides property-view tools.
  user_role?: string;
  is_creator?: boolean;
}

interface PropertyContextType {
  viewType: 'personal' | 'property';
  currentProperty: Property | null;
  switchToProperty: (property: Property) => void;
  switchToPersonal: () => void;
  // Merges fields into the property being viewed (e.g. its new image after the avatar camera upload); the header,
  // dropdown and stored selected_property follow. No-op when no property is open or the id differs.
  updateCurrentProperty: (propertyId: number | string, patch: Partial<Property>) => void;
  isPendingPropertySwitch: boolean;
  // Drops localStorage 'pending_property_switch' and stops waiting for it (stay in the account view).
  cancelPendingPropertySwitch: () => void;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

/** The signed-in account's login id from localStorage stasht_user, or null. */
function signedInAccountId(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem('stasht_user') || 'null');
    const id = user?.id ?? user?.email ?? user?.phone_number;
    return id === null || id === undefined || String(id).trim() === '' ? null : String(id);
  } catch {
    return null;
  }
}

function storedViewIsForAnotherAccount(): boolean {
  try {
    const owner = localStorage.getItem(PROPERTY_VIEW_OWNER_KEY);
    const me = signedInAccountId();
    return !!owner && !!me && owner !== me;
  } catch {
    return false;
  }
}

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [isPendingPropertySwitch, setIsPendingPropertySwitch] = useState(() => {
    return !!localStorage.getItem('pending_property_switch');
  });

  // Initialize from localStorage. A salesperson's External account view (their own external property) is restored
  // like any other property view (utils/salespersonLanding).
  // A view saved for another sign-in (selected_property_owner names the account it was opened by) is never restored
  // (utils/accountState, Chris 5 Nov 2026). Views saved before the owner was recorded are checked against the
  // account's properties once signed in (App).
  const [restoredForOtherAccount] = useState(() => {
    const other = storedViewIsForAnotherAccount();
    // Before any page's first request (their effects run before this provider's): this tab is in the account view.
    if (other) setTabPropertyView('personal', null);
    return other;
  });

  const [viewType, setViewType] = useState<'personal' | 'property'>(() => {
    if (restoredForOtherAccount) return 'personal';
    const stored = localStorage.getItem('view_type');
    return (stored === 'property' ? 'property' : 'personal') as 'personal' | 'property';
  });

  const [currentProperty, setCurrentProperty] = useState<Property | null>(() => {
    if (restoredForOtherAccount) return null;
    const stored = localStorage.getItem('selected_property');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored property:', e);
        return null;
      }
    }
    return null;
  });

  // Persist to localStorage whenever viewType or currentProperty changes. API requests from this tab follow the same
  // view (utils/inventoryView: a salesperson's External view names its property, so the main account's inventory shows).
  useEffect(() => {
    setTabPropertyView(viewType, currentProperty as any);
    localStorage.setItem('view_type', viewType);
    if (currentProperty) {
      localStorage.setItem('selected_property', JSON.stringify(currentProperty));
      const owner = signedInAccountId();
      if (owner) localStorage.setItem(PROPERTY_VIEW_OWNER_KEY, owner);
    } else {
      localStorage.removeItem('selected_property');
      localStorage.removeItem(PROPERTY_VIEW_OWNER_KEY);
    }
  }, [viewType, currentProperty]);

  // A sign-out / sign-in cleared the account's stored view (utils/accountState): this page must not keep showing the
  // previous account's property either (a sign-in doesn't reload the page). Back to the account view.
  useEffect(() => {
    const onCleared = () => {
      setTabPropertyView('personal', null);
      setViewType('personal');
      setCurrentProperty(null);
      setIsPendingPropertySwitch(!!localStorage.getItem('pending_property_switch'));
    };
    window.addEventListener(ACCOUNT_STATE_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(ACCOUNT_STATE_CLEARED_EVENT, onCleared);
  }, []);

  const switchToProperty = (property: Property) => {
    console.log('🏠 Switching to property view:', property.name);
    // Before any re-render: pages refetch in their own effects, which run before this provider's.
    setTabPropertyView('property', property as any);
    setViewType('property');
    setCurrentProperty(property);
    setIsPendingPropertySwitch(false);
  };

  const switchToPersonal = () => {
    console.log('👤 Switching to personal view');
    setTabPropertyView('personal', null);
    setViewType('personal');
    setCurrentProperty(null);
  };

  const updateCurrentProperty = (propertyId: number | string, patch: Partial<Property>) => {
    setCurrentProperty((current) =>
      current && String(current.id) === String(propertyId) ? { ...current, ...patch } : current,
    );
  };

  const cancelPendingPropertySwitch = () => {
    localStorage.removeItem('pending_property_switch');
    setIsPendingPropertySwitch(false);
  };

  return (
    <PropertyContext.Provider
      value={{
        viewType,
        currentProperty,
        switchToProperty,
        switchToPersonal,
        updateCurrentProperty,
        isPendingPropertySwitch,
        cancelPendingPropertySwitch,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}
