import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Property {
  id: number;
  name: string;
  username: string;
  unique_id: string;
  image?: string;
  location?: string;
  user_id?: number;
}

interface PropertyContextType {
  viewType: 'personal' | 'property';
  currentProperty: Property | null;
  switchToProperty: (property: Property) => void;
  switchToPersonal: () => void;
  isPendingPropertySwitch: boolean;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [isPendingPropertySwitch, setIsPendingPropertySwitch] = useState(() => {
    return !!localStorage.getItem('pending_property_switch');
  });

  // Initialize from localStorage
  const [viewType, setViewType] = useState<'personal' | 'property'>(() => {
    const stored = localStorage.getItem('view_type');
    return (stored === 'property' ? 'property' : 'personal') as 'personal' | 'property';
  });

  const [currentProperty, setCurrentProperty] = useState<Property | null>(() => {
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

  return (
    <PropertyContext.Provider
      value={{
        viewType,
        currentProperty,
        switchToProperty,
        switchToPersonal,
        isPendingPropertySwitch,
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
