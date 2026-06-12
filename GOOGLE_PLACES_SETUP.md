# Google Places API Setup

## Overview
The location input in the Edit Media modal now uses Google Places API for location suggestions and autocomplete functionality.

## Setup Instructions

### 1. Get Google Places API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API**
4. Go to **Credentials** and create an **API Key**
5. Restrict the API key to your domain for security

### 2. Configure Environment Variables
1. Open the `.env` file in the project root
2. Replace `YOUR_GOOGLE_PLACES_API_KEY_HERE` with your actual API key:
   ```
   VITE_GOOGLE_PLACES_API_KEY=your_actual_api_key_here
   ```
3. Restart the development server after updating the .env file

### 3. API Key Security (Production)
- Restrict the API key to your production domain
- Set up billing limits in Google Cloud Console
- Consider using API key restrictions by HTTP referrer

## Features

### Location Autocomplete
- **Type-ahead suggestions** as you type location names
- **Google Places integration** with accurate address data
- **Automatic coordinates** extraction (latitude/longitude)
- **Fallback support** - works as regular input if API key not configured

### Data Structure
When a Google Place is selected, the following data is sent to your backend:

```javascript
{
  displayName: "New York, NY, USA",           // Formatted address
  city: "New York",                           // City name
  country: "United States",                   // Country name
  coordinates: { lat: 40.7128, lng: -74.0060 }, // Lat/Lng
  place_id: "ChIJOwg_06VPwokRYv534QaPC8g",    // Google Place ID
  name: "New York"                            // Place name
}
```

### Backend Integration
The location data is automatically included when saving media item updates. Your backend will receive:
- Enhanced location information with coordinates
- Google Place ID for future reference
- Properly formatted addresses

## Troubleshooting

### Console Warnings
If you see: "Google Places API key not found"
- Check that VITE_GOOGLE_PLACES_API_KEY is set in .env
- Restart the development server
- Ensure the API key is valid and Places API is enabled

### No Suggestions Appearing
- Verify API key has Places API enabled
- Check browser developer console for API errors
- Ensure billing is set up in Google Cloud Console

### Manual Input Still Works
- Users can still type locations manually if Google Places is not available
- The component gracefully falls back to regular input functionality