import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { MapPin, X, AlertCircle } from 'lucide-react';
import { useGooglePlacesWithFallback, PlaceResult } from '../../hooks/useGooglePlacesWithFallback';

interface GooglePlacesInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onPlaceSelect?: (place: PlaceResult) => void;
  useFallback?: boolean;
}

// Declare global google types
declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

export default function GooglePlacesInput({
  value,
  onChange,
  placeholder = "Enter location...",
  className = "",
  onPlaceSelect,
  useFallback = true
}: GooglePlacesInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  // Use the enhanced hook with fallback
  const {
    suggestions,
    isLoading,
    error,
    noResults,
    searchQuery,
    setSearchQuery,
    selectPlace,
    clearSuggestions,
    isGoogleLoaded
  } = useGooglePlacesWithFallback({
    apiKey: API_KEY,
    onPlaceSelect: onPlaceSelect
  });

  // Sync internal search query with external value when using fallback
  useEffect(() => {
    if (useFallback) {
      // Always sync the value, not just when user has typed
      // This allows auto-detect and programmatic updates to work
      setSearchQuery(value);
    }
  }, [value, useFallback, setSearchQuery]);

  // Reset hasUserTyped when value is cleared
  useEffect(() => {
    if (!value) {
      setHasUserTyped(false);
    }
  }, [value]);

  // Show/hide suggestions based on results
  useEffect(() => {
    if (hasUserTyped) {
      if (suggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } else if (noResults || error) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }
  }, [suggestions, noResults, error, hasUserTyped]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setHasUserTyped(true);
    
    if (!useFallback) {
      // Legacy behavior without fallback
      return;
    }
    
    // The hook will handle debouncing and searching
    setSearchQuery(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: any) => {
    onChange(suggestion.description);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setHasUserTyped(false);
    
    if (useFallback) {
      // Get full place details when using fallback
      await selectPlace(suggestion);
      clearSuggestions();
    } else if (onPlaceSelect) {
      // Legacy behavior
      onPlaceSelect({
        place_id: suggestion.place_id,
        name: suggestion.structured_formatting.main_text,
        formatted_address: suggestion.description,
        geometry: undefined
      });
    }
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay hiding suggestions to allow for click events
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 150);
  };

  // Handle input focus
  const handleFocus = () => {
    // Only show suggestions on focus if user has typed something
    if (hasUserTyped && (suggestions.length > 0 || noResults)) {
      setShowSuggestions(true);
    }
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setHasUserTyped(false);
    if (useFallback) {
      clearSuggestions();
      setSearchQuery('');
    }
    inputRef.current?.focus();
  };


  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`pr-8 ${className}`}
        />
        
        {/* Loading indicator or clear button */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : value ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions dropdown or no results message */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <div
                key={suggestion.place_id}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {suggestion.structured_formatting.main_text}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {suggestion.structured_formatting.secondary_text}
                    </div>
                    {suggestion.source === 'findPlace' && (
                      <div className="text-xs text-blue-600 mt-1">
                        Found via search
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : noResults ? (
            <div className="px-3 py-4 text-center">
              <AlertCircle className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <div className="text-sm text-gray-600">No results found</div>
              <div className="text-xs text-gray-500 mt-1">
                Try a different search term
              </div>
            </div>
          ) : error ? (
            <div className="px-3 py-4 text-center">
              <AlertCircle className="h-5 w-5 text-red-400 mx-auto mb-2" />
              <div className="text-sm text-red-600">Error loading suggestions</div>
              <div className="text-xs text-gray-500 mt-1">{error}</div>
            </div>
          ) : null}
        </div>
      )}

      {/* No API key warning */}
      {!API_KEY && (
        <div className="absolute z-[9999] w-full mt-1 bg-yellow-50 border border-yellow-200 rounded-md p-2">
          <div className="text-xs text-yellow-700">
            Google Places API key not found. Please add VITE_GOOGLE_PLACES_API_KEY to your .env file.
          </div>
        </div>
      )}

      {/* Google Maps loading indicator */}
      {API_KEY && !isGoogleLoaded && value && (
        <div className="absolute z-[9999] w-full mt-1 bg-blue-50 border border-blue-200 rounded-md p-2">
          <div className="text-xs text-blue-700 flex items-center">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
            Loading Google Maps...
          </div>
        </div>
      )}
    </div>
  );
}