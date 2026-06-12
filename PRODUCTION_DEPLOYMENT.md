# Production Deployment Checklist

## Before Deployment

### 1. Environment Configuration
- [ ] Update `.env.production` with your production API URL
- [ ] Set `VITE_API_BASE_URL=https://your-production-domain.com/api/react`
- [ ] Remove any development-only configurations

### 2. Backend API Configuration
- [ ] Ensure your backend API is accessible at the production URL
- [ ] Configure CORS settings on your backend to allow your production domain
- [ ] Test all API endpoints are working

### 3. Build Configuration
- [ ] Run production build: `npm run build`
- [ ] Test the built files work correctly
- [ ] Verify sourcemaps are disabled for security

### 4. Security Considerations
- [ ] Remove any console.log statements with sensitive data
- [ ] Ensure no hardcoded credentials or API keys
- [ ] Verify HTTPS is used for all API calls in production
- [ ] Configure proper CORS headers on your backend

### 5. Performance Optimization
- [ ] Enable gzip compression on your server
- [ ] Configure proper caching headers
- [ ] Optimize images and assets
- [ ] Test loading times

## Deployment Steps

### 1. Build the Application
```bash
npm run build
```

### 2. Deploy to Server
- Upload the `dist` folder contents to your web server
- Configure your web server to serve the React app
- Set up routing to handle React Router paths

### 3. Server Configuration
For Apache, add `.htaccess`:
```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QR,L]
```

For Nginx:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### 4. Backend Integration
- Ensure your backend API is running
- Configure API endpoints to accept requests from your production domain
- Test all API integrations work in production

## Post-Deployment Testing

- [ ] Test login functionality
- [ ] Verify dashboard loads correctly
- [ ] Check media page and search functionality
- [ ] Test memory creation and management
- [ ] Verify user profile and logout work
- [ ] Test responsive design on mobile devices
- [ ] Check browser console for any errors

## Production API Configuration

### Environment Variable Configuration
Update `.env.production` with your production backend URL:
```env
VITE_API_BASE_URL=https://your-production-domain.com/stasht-for-multiple-admins/public/api/react
```

### Example Production URLs:
- If your backend is at: `https://yoursite.com/stasht-for-multiple-admins/public/api/react`
- If your backend is at: `https://api.yoursite.com/api/react`
- If your backend is on different port: `https://yoursite.com:8080/api/react`

## Common Issues to Watch For

1. **CORS Errors**: Ensure your backend allows requests from production domain
2. **API URL Mismatches**: Double-check all API endpoints are correct
3. **Routing Issues**: Configure server to handle SPA routing
4. **Asset Loading**: Verify all images and fonts load correctly
5. **Authentication**: Test login/logout flows work properly

## Files That Need Production Updates

1. `.env.production` - Set your production API URL
2. `vite.config.ts` - Already optimized for production builds
3. Backend CORS configuration - Allow requests from production domain

## Simple Production Setup

1. **Update `.env.production`** with your backend URL
2. **Build the app**: `npm run build`
3. **Upload `dist` folder** to your web server
4. **Configure backend CORS** to allow your production domain
5. **Test all functionality** after deployment