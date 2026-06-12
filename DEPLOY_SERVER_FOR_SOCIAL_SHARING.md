# 🚀 Deploy Express Server for Social Media Sharing

## ⚠️ CRITICAL: Why Social Sharing Still Doesn't Work

Your production site at `https://stashtpro.wd-projects.online` is showing default meta tags because:

1. **The Express server is NOT running on production** - it's only running on your local machine (localhost:3000)
2. **Production is serving static files only** - Facebook's crawler can't execute JavaScript
3. **You MUST deploy the Express server to production** for bot detection to work

## 📋 Quick Deploy Steps

### Step 1: Upload Files to Production Server

Upload these files via FTP/SSH to your production server:
- `dist/` folder (the built app)
- `server-with-api.js`
- `package.json`
- `package-lock.json`

### Step 2: SSH into Production and Install Dependencies

```bash
ssh your-user@stashtpro.wd-projects.online
cd /path/to/your/app
npm install
```

### Step 3: Start the Server on Production

**Using PM2 (Recommended):**
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server-with-api.js --name stasht-server -i 1

# Save configuration
pm2 save

# Set to start on reboot
pm2 startup
```

**Or run directly:**
```bash
PORT=3000 npm run server
```

### Step 4: Configure Nginx/Apache to Proxy to Node.js

**If using Nginx:**
```nginx
server {
    listen 80;
    server_name stashtpro.wd-projects.online;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
```

Restart Nginx:
```bash
sudo nginx -t && sudo systemctl restart nginx
```

### Step 5: Test with Facebook Sharing Debugger

1. Go to: https://developers.facebook.com/tools/debug/
2. Enter: `https://stashtpro.wd-projects.online/published-memory/tech-w-2026-68e96f1189f03`
3. Click "Scrape Again"
4. You should NOW see the correct memory title and image!

## 🔍 Verify Server is Running

Check if PM2 is running:
```bash
pm2 status
pm2 logs stasht-server
```

Test bot detection with curl:
```bash
curl -H "User-Agent: facebookexternalhit/1.1" https://stashtpro.wd-projects.online/published-memory/tech-w-2026-68e96f1189f03 | grep "og:title"
```

You should see your actual memory title, not "Stasht Studio"!

