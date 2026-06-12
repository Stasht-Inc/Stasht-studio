import React, { useState } from 'react';
import GooglePlacesInput from '../components/ui/google-places-input';
import GooglePlacesEnhanced from '../components/ui/google-places-enhanced';
import { PlaceResult } from '../hooks/useGooglePlacesWithFallback';

export default function TestGooglePlaces() {
  const [standardValue, setStandardValue] = useState('');
  const [enhancedValue, setEnhancedValue] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedEnhancedPlace, setSelectedEnhancedPlace] = useState<PlaceResult | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Google Places Autocomplete Test Page
          </h1>
          
          {/* Standard Implementation with Fallback */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Standard Component with Fallback (Updated)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Location (with automatic fallback)
                </label>
                <GooglePlacesInput
                  value={standardValue}
                  onChange={setStandardValue}
                  placeholder="Type any location..."
                  onPlaceSelect={(place) => {
                    console.log('Standard place selected:', place);
                    setSelectedPlace(place);
                  }}
                  useFallback={true}
                />
              </div>
              
              {selectedPlace && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Selected Place Details:
                  </h3>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div><strong>Place ID:</strong> {selectedPlace.place_id}</div>
                    <div><strong>Name:</strong> {selectedPlace.name}</div>
                    <div><strong>Address:</strong> {selectedPlace.formatted_address}</div>
                    {selectedPlace.coordinates && (
                      <div>
                        <strong>Coordinates:</strong> 
                        {` ${selectedPlace.coordinates.lat.toFixed(6)}, ${selectedPlace.coordinates.lng.toFixed(6)}`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Implementation */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Enhanced Component (New)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enhanced Search with Visual Feedback
                </label>
                <GooglePlacesEnhanced
                  value={enhancedValue}
                  onChange={(value, placeData) => {
                    setEnhancedValue(value);
                    if (placeData) {
                      console.log('Enhanced place data:', placeData);
                      setSelectedEnhancedPlace(placeData);
                    }
                  }}
                  placeholder="Search for any place..."
                  onPlaceSelect={(place) => {
                    console.log('Enhanced place selected:', place);
                    setSelectedEnhancedPlace(place);
                  }}
                />
              </div>
              
              {selectedEnhancedPlace && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h3 className="text-sm font-semibold text-green-900 mb-2">
                    Selected Place Details:
                  </h3>
                  <div className="space-y-1 text-sm text-green-800">
                    <div><strong>Place ID:</strong> {selectedEnhancedPlace.place_id}</div>
                    <div><strong>Name:</strong> {selectedEnhancedPlace.name}</div>
                    <div><strong>Address:</strong> {selectedEnhancedPlace.formatted_address}</div>
                    {selectedEnhancedPlace.coordinates && (
                      <div>
                        <strong>Coordinates:</strong> 
                        {` ${selectedEnhancedPlace.coordinates.lat.toFixed(6)}, ${selectedEnhancedPlace.coordinates.lng.toFixed(6)}`}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Scenarios */}
          <div className="mt-8 p-4 bg-gray-100 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Test Scenarios:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>
                  <strong>Normal autocomplete:</strong> Type "New York" - should show autocomplete suggestions
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>
                  <strong>Fallback to FindPlace:</strong> Type something specific like "xyzabc123" - should trigger fallback search
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>
                  <strong>No results:</strong> Type random gibberish - should show "No results found" message
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>
                  <strong>Keyboard navigation:</strong> Use arrow keys to navigate suggestions, Enter to select
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>
                  <strong>Clear button:</strong> Type something, then click X to clear
                </span>
              </li>
            </ul>
          </div>

          {/* API Information */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">
              Important Notes:
            </h3>
            <ul className="space-y-1 text-sm text-yellow-700">
              <li>• Ensure VITE_GOOGLE_PLACES_API_KEY is set in your .env file</li>
              <li>• The API key must have Places API and Maps JavaScript API enabled</li>
              <li>• Fallback automatically triggers when autocomplete returns no results</li>
              <li>• Both APIs are searched sequentially to maximize result coverage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}