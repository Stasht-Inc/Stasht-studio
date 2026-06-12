import React, { useState, useRef } from 'react';
import { Input } from './input';
import { MapPin, X, AlertCircle, Search } from 'lucide-react';
import { useGooglePlacesWithFallback, PlaceResult } from '../../hooks/useGooglePlacesWithFallback';

interface GooglePlacesEnhancedProps {
  value: string;
  onChange: (value: string, placeData?: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  onPlaceSelect?: (place: PlaceResult) => void;
  showSearchIndicator?: boolean;
  debounceMs?: number;
}

export default function GooglePlacesEnhanced({
  value,
  onChange,
  placeholder = "Search for a location...",
  className = "",
  onPlaceSelect,
  showSearchIndicator = true,
  debounceMs = 300
}: GooglePlacesEnhancedProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
    debounceMs,
    onPlaceSelect: (place) => {
      onChange(place.formatted_address, place);
      onPlaceSelect?.(place);
    }
  });

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSearchQuery(newValue);
    
    if (!newValue.trim()) {
      setShowSuggestions(false);
    }
  };

  // Show suggestions when available
  React.useEffect(() => {
    if (suggestions.length > 0 || (noResults && searchQuery.trim())) {
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }
  }, [suggestions, noResults, searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
        }
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
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onChange(suggestion.description);
    
    // Get full place details
    await selectPlace(suggestion);
    clearSuggestions();
  };

  // Handle input blur
  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  // Handle input focus
  const handleFocus = () => {
    if ((suggestions.length > 0 || noResults) && value.trim()) {
      setShowSuggestions(true);
    }
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    clearSuggestions();
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Get status icon
  const getStatusIcon = () => {
    if (isLoading) {
      return (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      );
    }
    if (value && showSearchIndicator) {
      return (
        <button
          type="button"
          onClick={handleClear}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      );
    }
    if (showSearchIndicator) {
      return <Search className="h-4 w-4 text-gray-400" />;
    }
    return null;
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
          className={`pr-10 ${className}`}
          autoComplete="off"
        />
        
        {/* Status indicator */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          {getStatusIcon()}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto"
        >
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.place_id}-${index}`}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">
                        {suggestion.structured_formatting.main_text}
                      </div>
                      {suggestion.structured_formatting.secondary_text && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {suggestion.structured_formatting.secondary_text}
                        </div>
                      )}
                      {suggestion.source === 'findPlace' && (
                        <div className="inline-flex items-center mt-1">
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Extended search
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : noResults ? (
            <div className="px-4 py-6 text-center">
              <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-gray-900 mb-1">
                No results found
              </div>
              <div className="text-xs text-gray-500">
                We searched both autocomplete and place search APIs
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Try adjusting your search terms
              </div>
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <div className="text-sm font-medium text-red-600 mb-1">
                Search error
              </div>
              <div className="text-xs text-gray-500">{error}</div>
            </div>
          ) : null}
        </div>
      )}

      {/* API key warning */}
      {!isGoogleLoaded && value && !error && (
        <div className="absolute z-40 w-full mt-1 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex items-start">
            <AlertCircle className="h-4 w-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-700">
              <div className="font-medium mb-1">Google Places API Loading</div>
              <div>Please ensure VITE_GOOGLE_PLACES_API_KEY is set in your .env file</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}