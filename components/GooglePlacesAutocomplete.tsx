import React, { useRef, useEffect, useState } from 'react';
import { Input } from './ui/input';

interface GooglePlacesAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string, placeData?: any) => void;
  onPlaceSelect?: (placeData: any) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

declare global {
  interface Window {
    google: any;
    initGooglePlaces: () => void;
  }
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  id,
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter location...",
  className,
  style,
  onFocus,
  onBlur
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Load Google Places API
  useEffect(() => {
    const loadGooglePlaces = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleLoaded(true);
        return;
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        window.initGooglePlaces = () => setIsGoogleLoaded(true);
        return;
      }

      // Get API key from environment variables
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || process.env.REACT_APP_GOOGLE_PLACES_API_KEY;
      
      console.log('Google Places API Key:', apiKey ? 'Found' : 'Not found');
      
      if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
        console.warn('Google Places API key not found. Please set VITE_GOOGLE_PLACES_API_KEY in your .env file.');
        return;
      }

      // Create script to load Google Places API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
      script.async = true;
      script.defer = true;
      
      window.initGooglePlaces = () => {
        console.log('Google Places API loaded successfully');
        setIsGoogleLoaded(true);
      };

      console.log('Loading Google Places API script...');
      document.head.appendChild(script);

      return () => {
        window.initGooglePlaces = () => {};
      };
    };

    loadGooglePlaces();
  }, []);

  // Initialize autocomplete when Google is loaded
  useEffect(() => {
    if (!isGoogleLoaded || !inputRef.current) return;

    console.log('Initializing Google Places Autocomplete...');

    try {
      // Create autocomplete instance
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components']
      });

      console.log('Google Places Autocomplete initialized successfully');

      // Listen for place selection
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (place && place.formatted_address) {
          const placeData = {
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            geometry: place.geometry,
            address_components: place.address_components,
            coordinates: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0
            }
          };

          onChange(place.formatted_address, placeData);
          onPlaceSelect?.(placeData);
        }
      });

      return () => {
        if (window.google && window.google.maps && window.google.maps.event) {
          window.google.maps.event.removeListener(listener);
        }
      };
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }
  }, [isGoogleLoaded, onChange, onPlaceSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent form submission when Enter is pressed in autocomplete
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <Input
      ref={inputRef}
      id={id}
      value={value}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      style={style}
      autoComplete="off"
    />
  );
};

export default GooglePlacesAutocomplete;