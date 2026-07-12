// Configure public DNS servers and prefer IPv4 to avoid local ISP DNS resolution failures and IPv6 connection timeouts
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const fs = require('fs');
const path = require('path');
const customTempDir = path.join(__dirname, 'tmp', 'yt-dlp-temp');
if (!fs.existsSync(customTempDir)) {
  fs.mkdirSync(customTempDir, { recursive: true });
}
process.env.TEMP = customTempDir;
process.env.TMP = customTempDir;
process.env.TMPDIR = customTempDir;

process.env.YTDL_NO_UPDATE = 'true';


const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { runIngester } = require('./utils/videoIngester');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Scan and ingest local videos
runIngester();

// Trigger the background worker to process any pending uploads from last session
const youtubeWorker = require('./utils/youtubeWorker');
youtubeWorker.triggerQueue();

const app = express();

// Proxy YouTube assets needed for client-side PO token generation
const axios = require('axios');
app.get('/s/player/*', async (req, res) => {
  try {
    if (req.originalUrl.endsWith('base.js')) {
      const path = require('path');
      const vendorBaseJsPath = path.join(__dirname, './node_modules/youtube-po-token-generator/vendor/base.js');
      const injectJsPath = path.join(__dirname, './node_modules/youtube-po-token-generator/lib/inject.js');
      
      let baseContent = fs.readFileSync(vendorBaseJsPath, 'utf8');
      const injectContent = fs.readFileSync(injectJsPath, 'utf8');
      
      // Inject inject.js at the end of the IIFE closure of base.js so it has access to local variables (bOa, g)
      baseContent = baseContent.replace(/}\s*\)\(_yt_player\);\s*$/, (matched) => `;${injectContent};${matched}`);
      
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(baseContent);
    }

    const targetUrl = `https://www.youtube.com${req.originalUrl}`;
    const response = await axios.get(targetUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    res.status(response.status);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    response.data.pipe(res);
  } catch (err) {
    console.error('[AssetProxy] Error proxying:', req.originalUrl, err.message);
    res.status(500).send(err.message);
  }
});

// Serve static videos folder
app.use('/videos', express.static(path.join(__dirname, '../videos')));

// Serve static images folder
app.use('/images', express.static(path.join(__dirname, '../images')));

// Serve HLS stream cache
app.use('/cache/hls', express.static(path.join(__dirname, '../cache/hls'), {
    setHeaders: (res, filePath) => {
        // Set proper CORS and content types for HLS streaming
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (filePath.endsWith('.m3u8')) {
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        } else if (filePath.endsWith('.ts')) {
            res.setHeader('Content-Type', 'video/MP2T');
        }
    }
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'application/xml' })); // Support parsing raw Atom XML feeds from WebSub

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'YouTube Clone API is running...' });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/webhooks', require('./routes/webhook'));

const PORT = process.env.PORT || 5000;

if (process.env.VERCEL) {
  // In Vercel serverless environment, just export the app
  console.log("Running in Vercel Serverless mode");
  module.exports = app;
} else {
  // In traditional hosting (local, render, etc.), listen on PORT and run background jobs
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start the Self-Healing Microservice Agent
    const selfHealer = require('./jobs/selfHealer');
    selfHealer.start();
    
    // Background YouTube Channel syncing agent orchestrator
    const aiBrain = require('./aiBrain');
    let isSyncing = false;

    const runBackgroundSync = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        console.log('[Background Agent] AI Brain initiating check for new YouTube videos...');
        await aiBrain.syncChannelFeed();
      } catch (err) {
        console.error('[Background Agent] Automated YouTube sync failed:', err.message);
      } finally {
        isSyncing = false;
      }
    };

    // Run initial sync 5 seconds after server startup, then every 30 minutes
    setTimeout(runBackgroundSync, 5000);
    setInterval(runBackgroundSync, 30 * 60 * 1000);

    // Background YouTube Webhook Processor Agent
    const youtubeWebhookAgent = require('./utils/youtubeWebhookAgent');
    let isProcessingWebhooks = false;

    const runWebhookProcessor = async () => {
      if (isProcessingWebhooks) return;
      isProcessingWebhooks = true;
      try {
        console.log('[Background Agent] Webhook Processor checking for pending notifications...');
        await youtubeWebhookAgent.processPendingNotifications();
      } catch (err) {
        console.error('[Background Agent] Webhook processing failed:', err.message);
      } finally {
        isProcessingWebhooks = false;
      }
    };

    // Run webhook processor 10 seconds after server startup, then every 1 minute
    setTimeout(runWebhookProcessor, 10000);
    setInterval(runWebhookProcessor, 60000);

    // Background WebSub Channel Subscription Auto-Renewal Agent
    const subscribeChannels = require('./utils/subscribeChannels');
    
    const runSubscriptionRenewal = async () => {
      try {
        console.log('[Background Agent] Initiating automatic WebSub subscription renewal...');
        await subscribeChannels.runSubscriptionLoop();
      } catch (err) {
        console.error('[Background Agent] WebSub subscription renewal failed:', err.message);
      }
    };

    // Run initial subscription 15 seconds after server startup, then every 4 days
    setTimeout(runSubscriptionRenewal, 15000);
    setInterval(runSubscriptionRenewal, 4 * 24 * 60 * 60 * 1000);
  });
}


