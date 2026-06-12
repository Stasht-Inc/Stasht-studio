/**
 * Simple Express server with meta tag injection for social media crawlers
 * This serves pre-rendered meta tags to Facebook, Twitter, LinkedIn bots
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// User agents that need pre-rendered meta tags
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

// Check if request is from a social media bot
function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
}

// Middleware to inject meta tags for bots
app.get('/published-memory/:slug', async (req, res) => {
  const userAgent = req.get('user-agent') || '';
  const slug = req.params.slug;

  console.log(`\n=== Request for published memory ===`);
  console.log(`Slug: ${slug}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Is Bot: ${isBot(userAgent)}`);

  // If it's a bot, inject meta tags
  if (isBot(userAgent)) {
    try {
      // Read the index.html file
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');

      // TODO: Fetch memory data from your API
      // For now, using placeholder data
      // You should make an API call here to get the actual memory data

      // Example API call (you need to implement this):
      // const memoryData = await fetch(`YOUR_API_URL/api/memory/${slug}`).then(r => r.json());

      // For demonstration, using placeholder
      const siteUrl = `${req.protocol}://${req.get('host')}`;
      const currentUrl = `${siteUrl}/published-memory/${slug}`;

      // Inject OpenGraph meta tags
      const metaTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${currentUrl}" />
    <meta property="og:title" content="Memory Title - Stasht" />
    <meta property="og:description" content="View this amazing memory on Stasht" />
    <meta property="og:image" content="${siteUrl}/default-og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${currentUrl}" />
    <meta name="twitter:title" content="Memory Title - Stasht" />
    <meta name="twitter:description" content="View this amazing memory on Stasht" />
    <meta name="twitter:image" content="${siteUrl}/default-og-image.jpg" />
  `;

      // Replace the head closing tag with our meta tags + head closing tag
      html = html.replace('</head>', `${metaTags}\n  </head>`);

      console.log(`✅ Serving pre-rendered HTML with meta tags to bot`);
      res.send(html);

    } catch (error) {
      console.error('Error serving bot HTML:', error);
      // Fallback to regular index.html
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
  } else {
    // For regular browsers, serve the normal SPA
    console.log(`📱 Serving normal SPA to browser`);
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

// All other routes serve the index.html (SPA routing - Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Serving from: ${path.join(__dirname, 'dist')}`);
  console.log(`🤖 Bot detection enabled for social media crawlers\n`);
});
