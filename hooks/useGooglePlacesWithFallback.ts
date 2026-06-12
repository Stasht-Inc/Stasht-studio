import { useState, useRef, useEffect, useCallback } from 'react';

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
    viewport?: any;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  source?: 'autocomplete' | 'findPlace';
}

interface UseGooglePlacesWithFallbackOptions {
  apiKey?: string;
  debounceMs?: number;
  onPlaceSelect?: (place: PlaceResult) => void;
}

interface UseGooglePlacesWithFallbackReturn {
  suggestions: PlaceSuggestion[];
  isLoading: boolean;
  error: string | null;
  noResults: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectPlace: (suggestion: PlaceSuggestion) => Promise<void>;
  clearSuggestions: () => void;
  isGoogleLoaded: boolean;
}

declare global {
  interface Window {
    google: any;
    initGoogleMapsWithFallback: () => void;
  }
}

export function useGooglePlacesWithFallback(
  options: UseGooglePlacesWithFallbackOptions = {}
): UseGooglePlacesWithFallbackReturn {
  const { 
    apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY, 
    debounceMs = 300,
    onPlaceSelect 
  } = options;

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  const autocompleteSuggestion = useRef<any>(null);
  const placesService = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const useNewAPI = useRef<boolean>(false);

  // Initialize Google Maps API
  useEffect(() => {
    console.log('🗺️ === GOOGLE PLACES INITIALIZATION START ===');
    console.log('🔑 API Key exists:', !!apiKey);
    console.log('🔑 API Key value:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
    console.log('🌍 Environment:', import.meta.env.MODE);
    console.log('📍 VITE_GOOGLE_PLACES_API_KEY env var:', import.meta.env.VITE_GOOGLE_PLACES_API_KEY ? 'SET' : 'NOT SET');

    if (!apiKey) {
      const errorMsg = '❌ Google Places API key not found in environment variables';
      console.error(errorMsg);
      console.error('💡 Make sure VITE_GOOGLE_PLACES_API_KEY is set in your .env file');
      setError('Google Places API key not configured');
      return;
    }

    let mounted = true;

    const initializeServices = async () => {
      if (!mounted) return;
      console.log('🔧 initializeServices called');
      console.log('🔍 Checking window.google:', !!window.google);
      console.log('🔍 Checking window.google.maps:', !!(window.google && window.google.maps));

      if (window.google && window.google.maps) {
        console.log('✅ Google Maps API is loaded and available');
        setIsGoogleLoaded(true);

        try {
          // Use legacy API (it still works and is supported)
          console.log('🔧 Using legacy Places API...');
          useNewAPI.current = false;

          // Use legacy API
          if (window.google.maps.places) {
            console.log('🔧 Using legacy AutocompleteService...');
            if (window.google.maps.places.AutocompleteService) {
              autocompleteSuggestion.current = new window.google.maps.places.AutocompleteService();
              console.log('✅ Legacy AutocompleteService created successfully');
            }
          }

          // Create a hidden map element for PlacesService
          console.log('🗺️ Creating hidden map div...');
          const mapDiv = document.createElement('div');
          mapDiv.style.display = 'none';
          document.body.appendChild(mapDiv);

          console.log('🗺️ Initializing Google Map...');
          mapRef.current = new window.google.maps.Map(mapDiv, {
            center: { lat: 0, lng: 0 },
            zoom: 1
          });
          console.log('✅ Google Map created successfully');

          // Initialize PlacesService
          console.log('🔧 Creating PlacesService...');
          if (window.google.maps.places && window.google.maps.places.PlacesService) {
            placesService.current = new window.google.maps.places.PlacesService(mapRef.current);
            console.log('✅ PlacesService created successfully');
          }

          console.log('🎉 === GOOGLE PLACES INITIALIZATION COMPLETE ===');
          console.log(`🎯 Using LEGACY API`);
        } catch (err) {
          console.error('❌ === ERROR INITIALIZING GOOGLE PLACES SERVICES ===');
          console.error('Error details:', err);
          console.error('Error name:', (err as Error).name);
          console.error('Error message:', (err as Error).message);
          console.error('Error stack:', (err as Error).stack);
          setError(`Failed to initialize Google Places: ${(err as Error).message}`);
        }
      } else {
        console.warn('⚠️ Google Maps API not fully loaded yet');
      }
    };

    // Check if Google Maps is already loaded
    console.log('🔍 Checking if Google Maps is already loaded...');
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('✅ Google Maps already loaded with places library, initializing services...');
      initializeServices();
      return;
    }

    // Check if script is already loading
    console.log('🔍 Checking for existing Google Maps script...');
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('⏳ Google Maps script already exists, waiting for it to load...');
      console.log('📜 Script src:', existingScript.getAttribute('src'));

      let checkCount = 0;
      const maxAttempts = 100; // 10 seconds total
      const checkInterval = setInterval(() => {
        checkCount++;
        console.log(`⏳ Waiting for Google Maps to load... (attempt ${checkCount}/${maxAttempts})`);

        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('✅ Google Maps loaded successfully after waiting');
          clearInterval(checkInterval);
          initializeServices();
        } else if (checkCount >= maxAttempts) {
          console.error('❌ Google Maps failed to load within 10 seconds');
          console.error('🔍 Final state check:');
          console.error('  - window.google:', !!window.google);
          console.error('  - window.google.maps:', !!(window.google && window.google.maps));
          console.error('  - window.google.maps.places:', !!(window.google && window.google.maps && window.google.maps.places));
          clearInterval(checkInterval);
          // Still try to initialize if Google Maps exists, even without proper callback
          if (window.google && window.google.maps) {
            console.log('🔧 Attempting to initialize anyway since Google Maps is present...');
            initializeServices();
          } else {
            setError('Google Maps API loading timeout - check network connection and API key');
          }
        }
      }, 100);

      return;
    }

    // Load Google Maps script with Places library
    console.log('📜 Loading Google Maps script...');

    // Use unique callback name to avoid conflicts
    const callbackName = `initGoogleMapsWithFallback_${Date.now()}`;
    const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&callback=${callbackName}`;
    console.log('🔗 Script URL:', scriptUrl.replace(apiKey, apiKey.substring(0, 10) + '...'));

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;

    // Set up callback
    (window as any)[callbackName] = () => {
      if (!mounted) return;
      console.log('✅ Google Maps callback triggered:', callbackName);
      initializeServices();
      // Clean up callback
      delete (window as any)[callbackName];
    };

    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully');
      // If callback wasn't triggered, manually check and initialize
      setTimeout(() => {
        if (mounted && window.google && window.google.maps && window.google.maps.places && !isGoogleLoaded) {
          console.log('🔧 Callback may have been missed, initializing manually...');
          initializeServices();
        }
      }, 500);
    };

    script.onerror = (error) => {
      if (!mounted) return;
      const errorMsg = '❌ Failed to load Google Maps API script';
      console.error(errorMsg);
      console.error('Error event:', error);
      console.error('🔍 Possible causes:');
      console.error('  1. Network connection issues');
      console.error('  2. Invalid API key');
      console.error('  3. Firewall/proxy blocking Google Maps');
      console.error('  4. CORS or content security policy issues');
      console.error('  5. API key restrictions (HTTP referrers, IP addresses)');
      setError('Failed to load Google Maps API - check console for details');
    };

    console.log('📜 Appending script to document head...');
    document.head.appendChild(script);

    // Cleanup
    return () => {
      mounted = false;
      if (mapRef.current) {
        const mapDiv = mapRef.current.getDiv();
        if (mapDiv && mapDiv.parentNode) {
          mapDiv.parentNode.removeChild(mapDiv);
        }
      }
    };
  }, [apiKey]);

  // Fetch suggestions from Autocomplete API
  const fetchAutocomplete = useCallback(async (input: string): Promise<PlaceSuggestion[]> => {
    console.log('🔍 fetchAutocomplete called with input:', input);

    if (!input.trim()) {
      console.log('ℹ️ Empty input, skipping autocomplete');
      return [];
    }

    try {
      // Use legacy API only
      if (!autocompleteSuggestion.current) {
        console.warn('⚠️ Autocomplete service not initialized');
        return [];
      }

      return new Promise((resolve) => {
        const request = {
          input: input,
          types: ['geocode', 'establishment'],
        };

        console.log('📤 Using legacy getPlacePredictions with:', request);

        autocompleteSuggestion.current.getPlacePredictions(
          request,
          (predictions: any[], status: any) => {
            console.log('📥 Legacy API response:');
            console.log('  - Status:', status);
            console.log('  - Predictions count:', predictions ? predictions.length : 0);

            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              console.log('✅ Legacy autocomplete successful, formatting', predictions.length, 'predictions');
              const formattedSuggestions = predictions.map(prediction => ({
                place_id: prediction.place_id,
                description: prediction.description,
                structured_formatting: {
                  main_text: prediction.structured_formatting?.main_text || prediction.description,
                  secondary_text: prediction.structured_formatting?.secondary_text || ''
                },
                source: 'autocomplete' as const
              }));
              console.log('✅ Formatted suggestions from legacy API:', formattedSuggestions);
              resolve(formattedSuggestions);
            } else {
              console.warn('⚠️ Legacy autocomplete returned no results or failed');
              resolve([]);
            }
          }
        );
      });
    } catch (error) {
      console.error('❌ Error in fetchAutocomplete:', error);
      return [];
    }
  }, []);

  // Fetch suggestions from FindPlaceFromQuery API
  const fetchFindPlace = useCallback((query: string): Promise<PlaceSuggestion[]> => {
    return new Promise((resolve) => {
      console.log('🔍 fetchFindPlace called with query:', query);

      if (!placesService.current) {
        console.warn('⚠️ PlacesService not initialized');
        resolve([]);
        return;
      }

      if (!query.trim()) {
        console.log('ℹ️ Empty query, skipping findPlace');
        resolve([]);
        return;
      }

      const request = {
        query: query,
        fields: ['place_id', 'name', 'formatted_address', 'geometry']
      };

      console.log('📤 Calling PlacesService.findPlaceFromQuery with:', request);

      placesService.current.findPlaceFromQuery(
        request,
        (results: any[], status: any) => {
          console.log('📥 FindPlace API response:');
          console.log('  - Status:', status);
          console.log('  - Status name:', window.google?.maps?.places?.PlacesServiceStatus ?
            Object.keys(window.google.maps.places.PlacesServiceStatus).find(
              key => window.google.maps.places.PlacesServiceStatus[key] === status
            ) : 'Unknown');
          console.log('  - Results count:', results ? results.length : 0);

          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            console.log('✅ FindPlace successful, formatting', results.length, 'results');
            const formattedSuggestions = results.map(place => ({
              place_id: place.place_id,
              description: place.formatted_address || place.name,
              structured_formatting: {
                main_text: place.name || place.formatted_address?.split(',')[0] || '',
                secondary_text: place.formatted_address?.substring(place.name?.length ? place.name.length + 2 : 0) || ''
              },
              source: 'findPlace' as const
            }));
            console.log('✅ Formatted suggestions:', formattedSuggestions);
            resolve(formattedSuggestions);
          } else {
            console.warn('⚠️ FindPlace returned no results or failed');
            resolve([]);
          }
        }
      );
    });
  }, []);

  // Main search function with fallback
  const performSearch = useCallback(async (query: string) => {
    console.log('🔍 === PERFORM SEARCH START ===');
    console.log('📝 Query:', query);
    console.log('🌍 Google Loaded:', isGoogleLoaded);

    if (!query.trim()) {
      console.log('ℹ️ Empty query, clearing suggestions');
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    if (!isGoogleLoaded) {
      console.warn('⚠️ Google Maps not loaded yet, cannot perform search');
      setSuggestions([]);
      setNoResults(false);
      setError('Google Maps is still loading...');
      return;
    }

    setIsLoading(true);
    setError(null);
    setNoResults(false);

    try {
      // Try Autocomplete first
      console.log('🔍 Step 1: Trying Autocomplete API for:', query);
      let results = await fetchAutocomplete(query);
      console.log('📊 Autocomplete results:', results.length);

      // If no results from Autocomplete, try FindPlaceFromQuery
      if (results.length === 0) {
        console.log('🔍 Step 2: No Autocomplete results, trying FindPlaceFromQuery for:', query);
        results = await fetchFindPlace(query);
        console.log('📊 FindPlace results:', results.length);
      }

      if (results.length > 0) {
        console.log('✅ Search successful! Found', results.length, 'suggestions');
        setSuggestions(results);
        setNoResults(false);
      } else {
        console.warn('⚠️ No results found for query:', query);
        setSuggestions([]);
        setNoResults(true);
      }
    } catch (err) {
      console.error('❌ === SEARCH ERROR ===');
      console.error('Error details:', err);
      console.error('Error name:', (err as Error).name);
      console.error('Error message:', (err as Error).message);
      console.error('Error stack:', (err as Error).stack);
      setError(`Search failed: ${(err as Error).message}`);
      setSuggestions([]);
      setNoResults(false);
    } finally {
      setIsLoading(false);
      console.log('🏁 === PERFORM SEARCH END ===');
    }
  }, [isGoogleLoaded, fetchAutocomplete, fetchFindPlace]);

  // Debounced search effect
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!searchQuery.trim()) {
      setSuggestions([]);
      setNoResults(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, performSearch, debounceMs]);

  // Get detailed place information
  const getPlaceDetails = useCallback((placeId: string): Promise<PlaceResult | null> => {
    return new Promise((resolve) => {
      if (!placesService.current) {
        resolve(null);
        return;
      }

      const request = {
        placeId: placeId,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components']
      };

      placesService.current.getDetails(request, (place: any, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          const result: PlaceResult = {
            place_id: place.place_id,
            name: place.name || '',
            formatted_address: place.formatted_address || '',
            geometry: place.geometry,
            coordinates: place.geometry?.location ? {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            } : undefined
          };
          resolve(result);
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  // Select a place and get its details
  const selectPlace = useCallback(async (suggestion: PlaceSuggestion) => {
    setIsLoading(true);
    try {
      const placeDetails = await getPlaceDetails(suggestion.place_id);
      if (placeDetails && onPlaceSelect) {
        onPlaceSelect(placeDetails);
      }
    } catch (err) {
      console.error('Error getting place details:', err);
      setError('Failed to get place details');
    } finally {
      setIsLoading(false);
    }
  }, [getPlaceDetails, onPlaceSelect]);

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setNoResults(false);
    setError(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    noResults,
    searchQuery,
    setSearchQuery,
    selectPlace,
    clearSuggestions,
    isGoogleLoaded
  };
}