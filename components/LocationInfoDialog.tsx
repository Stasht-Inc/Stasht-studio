import { useState } from "react";
import { X, Edit, MapPin, Check } from "lucide-react";
import { Button } from "./ui/button";
import { mediaAPI } from "../services/mediaAPI";
import GooglePlacesInput from "./ui/google-places-input";

interface LocationInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageId?: string;
  locationData?: {
    address?: string;
    exifData?: {
      dateTaken?: string;
      camera?: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
  };
  onEditLocation?: () => void;
  onLocationUpdated?: (newLocation: string) => void;
  onRefreshData?: () => void; // New callback for refreshing page data
  isCommentSectionOpen?: boolean; // New prop to determine styling
}

export function LocationInfoDialog({ 
  isOpen, 
  onClose,
  imageId, 
  locationData,
  onEditLocation,
  onLocationUpdated,
  onRefreshData,
  isCommentSectionOpen = false
}: LocationInfoDialogProps) {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState(locationData?.address || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleEditLocation = () => {
    setLocationInput(locationData?.address || '');
    setIsEditingLocation(true);
  };

  const handleSaveLocation = async () => {
    if (!imageId) {
      console.error('No image ID provided for location update');
      return;
    }

    setIsSaving(true);
    try {
      const result = await mediaAPI.updateImageLocation(imageId, locationInput);
      
      if (result.success) {
        console.log('✅ Location updated successfully');
        setIsEditingLocation(false);
        
        // Call onLocationUpdated first to update the parent component's state
        onLocationUpdated?.(locationInput);
        
        // Then call other callbacks
        onEditLocation?.();
        
        // Refresh the page data to show updated location
        if (onRefreshData) {
          setTimeout(() => {
            onRefreshData();
          }, 100); // Small delay to ensure the update is processed
        }
      } else {
        console.error('Failed to update location:', result.error);
        alert('Failed to update location: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Error updating location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setLocationInput(locationData?.address || '');
    setIsEditingLocation(false);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div 
      className="absolute inset-0 z-[10000] pointer-events-auto" 
      onClick={onClose}
    >
      <div 
        className={`absolute p-4 w-72 shadow-2xl bg-black/60 text-white rounded-lg ${
          isCommentSectionOpen 
            ? 'top-16 right-[28rem]' 
            : 'top-16 right-16'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <h3 className="text-base font-medium">Location Information</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1 h-6 w-6"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        {/* Address Section */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Address</h4>
          {isEditingLocation ? (
            <div className="flex items-center gap-2">
              <GooglePlacesInput
                value={locationInput}
                onChange={(value) => setLocationInput(value)}
                placeholder="Enter location"
                className="flex-1 bg-gray-700 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                onPlaceSelect={(place) => {
                  console.log('Selected place in LocationInfoDialog:', place);
                  // You can add additional logic here when a place is selected
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveLocation}
                disabled={isSaving}
                className="text-white bg-blue-600 hover:bg-blue-700 p-1 h-7 w-7 rounded disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="text-gray-300 hover:text-white hover:bg-white/10 p-1 h-7 w-7"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-200 text-sm">
                {locationData?.address || 'No location set'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditLocation}
                className="text-gray-300 hover:text-white hover:bg-white/10 p-1 h-5 w-5"
              >
                <Edit className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* EXIF Data Section */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">EXIF Data</h4>
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-gray-400">Taken: </span>
              <span className="text-gray-200">
                {formatDateTime(locationData?.exifData?.dateTaken)}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">Camera: </span>
              <span className="text-gray-200">
                {locationData?.exifData?.camera || 'Unknown'}
              </span>
            </div>
            {locationData?.exifData?.coordinates && (
              <div className="text-sm">
                <span className="text-gray-400">Coordinates: </span>
                <span className="text-gray-200 text-xs">
                  {locationData.exifData.coordinates.lat.toFixed(6)}, {locationData.exifData.coordinates.lng.toFixed(6)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}