import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { dashboardAPI } from '../utils/authUtils';
import { allPropertyRows, cachedPropertyViewIsOwnAccount } from '../utils/salespersonLanding';

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

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [isPendingPropertySwitch, setIsPendingPropertySwitch] = useState(() => {
    return !!localStorage.getItem('pending_property_switch');
  });

  // A stored property view of the signed-in salesperson's own account is not restored (utils/salespersonLanding):
  // they land in their own account. Read once, before the first render, so the property view never flashes.
  const [storedOwnAccountView] = useState(() => {
    try {
      const stored = localStorage.getItem('selected_property');
      const signedIn = localStorage.getItem('stasht_user');
      return !!stored && !!signedIn && cachedPropertyViewIsOwnAccount(JSON.parse(stored), JSON.parse(signedIn));
    } catch {
      return false;
    }
  });

  // Initialize from localStorage
  const [viewType, setViewType] = useState<'personal' | 'property'>(() => {
    const stored = localStorage.getItem('view_type');
    if (storedOwnAccountView) return 'personal';
    return (stored === 'property' ? 'property' : 'personal') as 'personal' | 'property';
  });

  const [currentProperty, setCurrentProperty] = useState<Property | null>(() => {
    if (storedOwnAccountView) return null;
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

  // Persist to localStorage whenever viewType or currentProperty changes
  useEffect(() => {
    localStorage.setItem('view_type', viewType);
    if (currentProperty) {
      localStorage.setItem('selected_property', JSON.stringify(currentProperty));
    } else {
      localStorage.removeItem('selected_property');
    }
  }, [viewType, currentProperty]);

  const switchToProperty = (property: Property) => {
    console.log('🏠 Switching to property view:', property.name);
    setViewType('property');
    setCurrentProperty(property);
    setIsPendingPropertySwitch(false);
  };

  const switchToPersonal = () => {
    console.log('👤 Switching to personal view');
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

  // The signed-in account (a new sign-in, or an account switch) must never sit in the property view of its own
  // external property. The stored row's flags decide; a row stored before the API sent them is checked against
  // a fresh /properties read (only then, so other accounts make no extra request).
  const { user } = useAuth();
  const signedInId = (user as any)?.external_user_id ?? (user as any)?.id;
  useEffect(() => {
    if (viewType !== 'property' || !currentProperty || !user) return;
    if (cachedPropertyViewIsOwnAccount(currentProperty as any, user)) {
      switchToPersonal();
      return;
    }
    if ((currentProperty as any).account_type !== undefined) return;
    let cancelled = false;
    dashboardAPI.getProperties()
      .then((response) => {
        if (cancelled || !response?.success) return;
        if (cachedPropertyViewIsOwnAccount(currentProperty as any, user, allPropertyRows(response))) switchToPersonal();
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInId, viewType, currentProperty?.id]);

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
