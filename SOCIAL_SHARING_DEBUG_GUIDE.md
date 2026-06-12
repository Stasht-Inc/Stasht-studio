# Social Media Sharing Debug Guide

## The Problem with SPAs (Single Page Applications)

Your app is a React SPA, which means:
- Meta tags are added by JavaScript (React Helmet) after the page loads
- Social media crawlers (Facebook, Twitter, LinkedIn) often don't execute JavaScript
- Result: They see the default meta tags from `index.html`, not the dynamic ones

## How to Debug What Facebook Sees

### Step 1: Use Facebook Sharing Debugger
1. Go to: https://developers.facebook.com/tools/debug/
2. Enter your published memory URL (e.g., `https://yourdomain.com/published-memory/your-slug`)
3. Click "Debug"
4. Look at what Facebook scraped:
   - **Title**: Should be your memory title
   - **Description**: Should be your memory description
   - **Image**: Should be your memory image (must be absolute URL)

### Step 2: Clear Facebook's Cache
If you updated your meta tags but Facebook still shows old data:
1. In the Sharing Debugger, click "Scrape Again"
2. This forces Facebook to re-fetch your page
3. Check if the new data appears

### Step 3: Verify Your Meta Tags
Open your published memory page in a browser:
1. Right-click → "View Page Source"
2. Look for `<meta property="og:` tags
3. **If you DON'T see them** → Meta tags are being added by JavaScript (Facebook can't see them)
4. **If you DO see them** → Meta tags are there, but might be incorrect

## Solutions

### Solution 1: Use Netlify (Easiest)
If deploying to Netlify:
1. Add the `netlify.toml` file (already created)
2. Install the prerendering plugin:
   ```bash
   npm install -D netlify-plugin-prerender-spa
   ```
3. Redeploy your site
4. Netlify will pre-render pages for social media crawlers

### Solution 2: Use Vercel
If deploying to Vercel, create `vercel.json`:
```json
{
  "buildCommand": "npm run build:prod",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false
}
```

### Solution 3: Manual Testing
1. Build production: `npm run build:prod`
2. Test locally: `npm run preview`
3. Use a tool like ngrok to expose your local server:
   ```bash
   npx ngrok http 4173
   ```
4. Use the ngrok URL in Facebook Sharing Debugger

### Solution 4: Add Server-Side Rendering (Advanced)
This requires more setup but is the most reliable solution.

## Common Issues and Fixes

### Issue 1: Image Not Showing
**Problem**: Image URL is relative (e.g., `/images/photo.jpg`)
**Fix**: Must be absolute URL (e.g., `https://yourdomain.com/images/photo.jpg`)

We've already fixed this in `PublishedMemoryPage.tsx` with the `getAbsoluteImageUrl` function.

### Issue 2: Image URL Not Accessible
**Problem**: Image URL returns 404 or requires authentication
**Fix**: Ensure images are publicly accessible (no auth required)

### Issue 3: Meta Tags Not Updated
**Problem**: Changed meta tags but Facebook shows old data
**Fix**: Use Facebook Sharing Debugger to "Scrape Again"

### Issue 4: Localhost URLs
**Problem**: Trying to share localhost URLs
**Fix**: Deploy to production first. Social media platforms can't access localhost.

## Verify Your Setup

### Checklist:
- [ ] Published memory page loads successfully
- [ ] Meta tags are visible in "View Page Source"
- [ ] Image URL is absolute (starts with `https://`)
- [ ] Image URL is publicly accessible (no 404 or auth)
- [ ] Tested with Facebook Sharing Debugger
- [ ] Cleared Facebook's cache with "Scrape Again"
- [ ] Memory is actually published (not draft/private)

## Example: What Facebook Should See

When scraping `https://yourdomain.com/published-memory/my-memory`:

```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://yourdomain.com/published-memory/my-memory" />
<meta property="og:title" content="My Amazing Memory" />
<meta property="og:description" content="A wonderful trip to the mountains" />
<meta property="og:image" content="https://yourdomain.com/images/memory-photo.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

## Still Not Working?

If you've tried everything above and it's still not working:

1. **Check browser console** for errors when loading the published page
2. **Verify the published URL** is accessible in an incognito window
3. **Check your deployment platform** logs for errors
4. **Contact support** with:
   - Your published memory URL
   - Screenshot from Facebook Sharing Debugger
   - Screenshot of "View Page Source" showing meta tags
