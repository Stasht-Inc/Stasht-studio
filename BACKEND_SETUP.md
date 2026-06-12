# Backend Server Setup

## Issue: HTTP 500 "Server returned empty response with status 500"

This error occurs when the frontend cannot connect to the Laravel backend API server. The frontend is configured to proxy API requests to `http://localhost/stasht-for-multiple-admins/public` but the backend server is not running.

## Solution Options

### Option 1: Start the Laravel Backend Server
1. Navigate to your Laravel backend directory: `stasht-for-multiple-admins`
2. Install dependencies: `composer install`
3. Set up environment: Copy `.env.example` to `.env` and configure database
4. Start the Laravel development server: `php artisan serve --host=localhost --port=80`
5. Or set up with XAMPP/WAMP to serve at `http://localhost/stasht-for-multiple-admins/public`

### Option 2: Change API Configuration
Update the proxy target in `vite.config.ts`:

```typescript
proxy: {
  '/api': {
    target: 'http://your-actual-backend-url.com', // Change this
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path,
  }
}
```

### Option 3: Use Environment Variable
Set the backend URL using environment variable in `.env`:
```
VITE_API_BASE_URL=http://your-backend-server.com/api/react
```

## Current Configuration
- **Frontend**: Running on `http://localhost:5173`
- **Expected Backend**: `http://localhost/stasht-for-multiple-admins/public`
- **API Endpoints**: `/api/react/signup`, `/api/react/login`, etc.

## Development Mode
The frontend will show helpful error messages in development mode to guide you through backend setup issues.