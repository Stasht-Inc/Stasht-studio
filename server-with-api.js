/**
 * Express server with API integration for social media meta tags
 * Fetches real memory data and injects proper OpenGraph tags
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Your API base URL (update this to match your backend)
// For production, use the deployed API URL
const API_BASE_URL = process.env.API_URL || 'https://restapi-stasht.wd-projects.online/api/react';

// Bot user agents
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'WhatsApp',
  'TelegramBot',
  'Googlebot'
];

function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
}

// Function to fetch share link info from /share-qr/info/{memory_id}
async function fetchShareLinkInfo(memoryId) {
  try {
    console.log(`📡 Fetching share link info for memory_id: ${memoryId}`);
    const response = await axios.get(`${API_BASE_URL}/share-qr/info/${memoryId}`);
    const data = response.data?.data || response.data;
    if (!data) return null;
    return {
      title: data.title || data.name || 'Shared Memory',
      description: data.description || 'You have been invited to join a memory on Stasht.',
      image: data.last_update_img || data.thumbnail || null,
    };
  } catch (error) {
    console.error(`❌ Error fetching share link info for memory_id ${memoryId}:`, error.message);
    return null;
  }
}

// Function to fetch memory data from API
async function fetchMemoryData(slug) {
  try {
    console.log(`📡 Fetching memory data for slug: ${slug}`);
    const response = await axios.get(`${API_BASE_URL}/published-memories?token=${slug}`);

    console.log(`✅ API Response Status:`, response.status);
    console.log(`✅ API Response Data:`, JSON.stringify(response.data, null, 2));

    // Extract memory data from response
    // Handle different response structures from the API
    const data = response.data.data?.data || response.data.data || response.data;
    const memory = data.memory || data;

    if (!memory) {
      console.error(`❌ No memory object found in API response for slug: ${slug}`);
      console.error(`Response structure:`, JSON.stringify(response.data, null, 2));
      return null;
    }

    console.log(`✅ Memory title: ${memory.title}`);
    console.log(`✅ Memory description: ${memory.description}`);

    // Get the best available image
    const imageUrl = memory.last_update_img ||
             (memory.posts && memory.posts[0]?.master_image_link) ||
             (memory.posts && memory.posts[0]?.image_link) ||
             null;

    console.log(`✅ Memory image URL: ${imageUrl}`);

    // Use the current request host for the URL, or fallback to stashtpro
    const memoryData = {
      title: memory.title || 'Shared Memory',
      description: memory.description || `View this memory on Stasht`,
      image: imageUrl,
      url: `https://stashtpro.wd-projects.online/published-memory/${slug}`
    };

    console.log(`✅ Returning memory data:`, memoryData);
    return memoryData;
  } catch (error) {
    console.error(`❌ Error fetching memory data for slug ${slug}:`, error.message);
    if (error.response) {
      console.error(`API Response Status: ${error.response.status}`);
      console.error(`API Response Data:`, error.response.data);
    }
    return null;
  }
}

// Middleware for published memory pages
app.get('/published-memory/:slug', async (req, res) => {
  const userAgent = req.get('user-agent') || '';
  const slug = req.params.slug;

  console.log(`\n=== Request for: /published-memory/${slug} ===`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Is Bot: ${isBot(userAgent)}`);

  // If it's a bot, fetch data and inject meta tags
  if (isBot(userAgent)) {
    try {
      // Fetch memory data from API
      const memoryData = await fetchMemoryData(slug);

      if (!memoryData) {
        console.log(`⚠️ No memory data found, serving default HTML`);
        return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      }

      // Read index.html
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');

      const siteUrl = `${req.protocol}://${req.get('host')}`;

      // Ensure image URL is absolute
      let imageUrl = memoryData.image;
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = imageUrl.startsWith('/') ? `${siteUrl}${imageUrl}` : `${siteUrl}/${imageUrl}`;
      }

      console.log(`🖼️ Image URL:`, imageUrl);

      // Build meta tags
      const metaTags = `
    <!-- Injected by server for social media bots -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${memoryData.url}" />
    <meta property="og:title" content="${escapeHtml(memoryData.title)}" />
    <meta property="og:description" content="${escapeHtml(memoryData.description)}" />
    ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
    ${imageUrl ? `<meta property="og:image:secure_url" content="${imageUrl}" />` : ''}
    ${imageUrl ? `<meta property="og:image:width" content="1200" />` : ''}
    ${imageUrl ? `<meta property="og:image:height" content="630" />` : ''}
    <meta property="og:site_name" content="Stasht" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${memoryData.url}" />
    <meta name="twitter:title" content="${escapeHtml(memoryData.title)}" />
    <meta name="twitter:description" content="${escapeHtml(memoryData.description)}" />
    ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}

    <title>${escapeHtml(memoryData.title)} - Stasht</title>
  `;

      // Inject meta tags
      html = html.replace('</head>', `${metaTags}\n  </head>`);

      console.log(`✅ Serving pre-rendered HTML to bot with meta tags`);
      console.log(`  Title: ${memoryData.title}`);
      console.log(`  Image: ${imageUrl}`);

      res.send(html);

    } catch (error) {
      console.error(`❌ Error processing bot request:`, error);
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
  } else {
    // Regular browser - serve SPA
    console.log(`📱 Serving SPA to regular browser`);
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

// Share link route — serves OG tags for ALL visitors (bots + humans)
// Handles: /memories?memory_id=2081&role=viewer&invite=1
// Bots read the OG tags (they don't run JS)
// Regular users are JS-redirected to the React SPA (which handles the join flow)

app.get('/memories', async (req, res, next) => {
  const { memory_id, invite } = req.query;

  // Only intercept invite/share links, not regular memory navigation
  if (!memory_id || !invite) return next();

  const siteUrl = `${req.protocol}://${req.get('host')}`;
  const pageUrl = `${siteUrl}/memories?memory_id=${memory_id}&role=${req.query.role || 'viewer'}&invite=${invite}`;

  console.log(`\n=== Share link request: /memories?memory_id=${memory_id} ===`);
  console.log(`User-Agent: ${req.get('user-agent') || ''}`);

  try {
    const data = await fetchShareLinkInfo(memory_id);

    const title       = escapeHtml(data?.title || 'Shared Memory');
    const description = escapeHtml(data?.description || 'You have been invited to join a memory on Stasht.');
    let   imageUrl    = data?.image || '';

    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${siteUrl}/${imageUrl.replace(/^\//, '')}`;
    }

    console.log(`✅ Share link info - title: ${title}, image: ${imageUrl}`);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:site_name" content="Stasht" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />` : ''}

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${pageUrl}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}

  <title>${title} - Stasht</title>

  <!-- Redirect regular users into the SPA which handles the join flow -->
  <script>window.location.replace("${pageUrl}");</script>
  <noscript><meta http-equiv="refresh" content="0;url=${pageUrl}" /></noscript>
</head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;">
  <div style="text-align:center;">
    <p style="color:#6c63ff;font-size:1.1rem;font-weight:600;">Opening memory...</p>
    <p style="color:#888;font-size:.9rem;">If you are not redirected, <a href="${pageUrl}" style="color:#6c63ff;">click here</a>.</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);

  } catch (error) {
    console.error(`❌ Error handling share link for memory_id ${memory_id}:`, error);
    return next();
  }
});

// Legacy /s/:token route (kept for backward compatibility)
const PHP_BACKEND_URL = process.env.PHP_BACKEND_URL || 'http://localhost/stasht-for-multiple-admins/public';

app.get('/s/:token', async (req, res) => {
  const { token } = req.params;
  const siteUrl = `${req.protocol}://${req.get('host')}`;
  const pageUrl = `${siteUrl}/s/${token}`;
  const phpJoinUrl = `${PHP_BACKEND_URL}/s/${token}`;

  console.log(`\n=== Share link request: /s/${token} ===`);
  console.log(`User-Agent: ${req.get('user-agent') || ''}`);

  try {
    const data = await fetchShareLinkInfo(token);

    const title       = escapeHtml(data?.title || 'Shared Memory');
    const description = escapeHtml(data?.description || 'You have been invited to join a memory on Stasht.');
    let   imageUrl    = data?.image || '';

    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${siteUrl}/${imageUrl.replace(/^\//, '')}`;
    }

    console.log(`✅ Share link info - title: ${title}, image: ${imageUrl}`);

    // Serve a page with OG meta tags + JS redirect.
    // Bots don't run JS → they read the OG tags and show the preview.
    // Regular users → JS redirects them instantly to the PHP join page.
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:site_name" content="Stasht" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />` : ''}

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${pageUrl}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}

  <title>${title} - Stasht</title>

  <!-- Redirect regular users to the join page immediately -->
  <script>window.location.replace("${phpJoinUrl}");</script>
  <noscript><meta http-equiv="refresh" content="0;url=${phpJoinUrl}" /></noscript>
</head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;">
  <div style="text-align:center;">
    <p style="color:#6c63ff;font-size:1.1rem;font-weight:600;">Opening memory...</p>
    <p style="color:#888;font-size:.9rem;">If you are not redirected, <a href="${phpJoinUrl}" style="color:#6c63ff;">click here</a>.</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);

  } catch (error) {
    console.error(`❌ Error handling share link for token ${token}:`, error);
    // Fallback: just redirect
    return res.redirect(302, phpJoinUrl);
  }
});

// Serve static files (AFTER dynamic routes so bot detection runs first)
app.use(express.static(path.join(__dirname, 'dist')));

// All other routes - catch-all for SPA routing (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, () => {
  console.log(`\n🚀 Stasht Server running on http://localhost:${PORT}`);
  console.log(`📊 Serving from: ${path.join(__dirname, 'dist')}`);
  console.log(`📡 API URL: ${API_BASE_URL}`);
  console.log(`🤖 Bot detection enabled\n`);
});
