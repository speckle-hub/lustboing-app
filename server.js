/* ═══════════════════════════════════════════════════
   LUSTBOING — Video Streaming Proxy Server
   Serves static frontend + provides fresh stream URLs
   and proxies video content to avoid CORS/expiry issues.
═══════════════════════════════════════════════════ */

const express = require('express');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Serve static frontend files ──────────────────────
app.use(express.static(path.join(__dirname)));

// ── API: Get a fresh stream URL via yt-dlp ───────────
// GET /api/stream?url=ENCODED_VIDEO_URL
app.get('/api/stream', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  try {
    const data = await runYtDlp(videoUrl);

    // Pick the best MP4 format
    const formats = data.formats || [];
    const mp4 = formats.filter(f => f.ext === 'mp4' && f.vcodec !== 'none');

    let streamUrl;
    if (mp4.length > 0) {
      const best = mp4.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      streamUrl = best.url;
    } else {
      streamUrl = data.url || '';
    }

    if (!streamUrl) {
      return res.status(404).json({ error: 'No playable stream URL found' });
    }

    res.json({
      streamUrl,
      title: data.title || '',
      duration: data.duration || 0,
    });
  } catch (err) {
    console.error('[yt-dlp error]', err.message);
    res.status(502).json({ error: 'Failed to resolve stream: ' + err.message });
  }
});

// ── API: Proxy video content (solves CORS + expiry) ──
// GET /api/proxy?url=ENCODED_STREAM_URL
// Supports Range headers for video seeking
app.get('/api/proxy', (req, res) => {
  const streamUrl = req.query.url;
  if (!streamUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(streamUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;
  const range = req.headers.range;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  };

  if (range) {
    options.headers['Range'] = range;
  }

  const proxyReq = client.get(options, (proxyRes) => {
    // Build response headers
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Cache-Control': 'no-cache',
    };

    // Forward essential headers from upstream
    const forwardHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
    ];
    forwardHeaders.forEach(h => {
      if (proxyRes.headers[h]) {
        responseHeaders[h] = proxyRes.headers[h];
      }
    });

    res.writeHead(range ? 206 : 200, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Proxy failed: ' + err.message });
    }
  });

  // Timeout after 30s of inactivity
  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Upstream timeout' });
    }
  });
});

// ── Run yt-dlp and return parsed JSON ────────────────
// Calls the yt-dlp binary directly (installed at /usr/local/bin/yt-dlp in Docker)
function runYtDlp(videoUrl) {
  return new Promise((resolve, reject) => {
    // Build yt-dlp args with dynamic headers based on the video URL's platform
    const args = [
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '--no-check-certificates',
      '--geo-bypass',
      '--dump-json',
      videoUrl
    ];

    // Dynamically set Referer from the video URL so each platform gets the correct one
    try {
      const parsed = new URL(videoUrl);
      const referer = parsed.protocol + '//' + parsed.hostname + '/';
      args.splice(2, 0, '--add-header', 'Referer: ' + referer);
    } catch {}

    const proc = spawn('yt-dlp', args, {
      timeout: 45000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error('Failed to parse yt-dlp JSON output'));
        }
      } else if (code === 124 || code === null) {
        reject(new Error('yt-dlp timed out (45s)'));
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error('Failed to start yt-dlp: ' + err.message));
    });
  });
}

// ── Start ────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n\x1b[35m╔═══════════════════════════════════════════════╗\n║         LUSTBOING Media Server                ║\n║                                               ║\n║   Open:  http://localhost:${String(PORT).padEnd(5)}               ║\n║                                               ║\n║   Streams are resolved dynamically via        ║\n║   yt-dlp and proxied through this server      ║\n║   to bypass CORS and URL expiry issues.       ║\n╚═══════════════════════════════════════════════╝\x1b[0m\n  `);
});
