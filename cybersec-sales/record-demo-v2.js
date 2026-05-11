#!/usr/bin/env node
/**
 * CyberSec Pro - Automated Demo Video Recorder v2
 * 
 * Records a full demo: Login → Dashboard → Nmap Scan → Reports
 * Uses puppeteer-screen-recorder for smooth video capture.
 * 
 * Usage:
 *   node record-demo-v2.js                    # Record with defaults
 *   node record-demo-v2.js --upload youtube    # Record + upload to YouTube
 *   node record-demo-v2.js --upload vimeo      # Record + upload to Vimeo
 *   node record-demo-v2.js --no-login          # Skip login, use existing session
 * 
 * Environment:
 *   DEMO_EMAIL     - Login email (default: demo@semihkilic.com)
 *   DEMO_PASSWORD  - Login password (default: demo123!)
 *   DEMO_BASE_URL  - App URL (default: https://app.cyber-sec-pro.com)
 *   YT_CLIENT_ID   - YouTube OAuth client ID
 *   YT_CLIENT_SECRET - YouTube OAuth client secret
 *   YT_REFRESH_TOKEN - YouTube OAuth refresh token
 *   VIMEO_TOKEN    - Vimeo access token
 */

const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');
const fs = require('fs');

// ── Config ───────────────────────────────────────────────────

const CONFIG = {
  baseUrl: process.env.DEMO_BASE_URL || 'https://app.cyber-sec-pro.com',
  email: process.env.DEMO_EMAIL || 'demo@semihkilic.com',
  password: process.env.DEMO_PASSWORD || 'demo123!',
  outputDir: path.join(__dirname, 'demo-videos'),
  viewport: { width: 1920, height: 1080 },
  fps: 30,
  videoDuration: 120, // ~2 minutes target
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const timestamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

// ── Recorder Config ─────────────────────────────────────────

const recorderConfig = {
  followNewTab: false,
  fps: CONFIG.fps,
  ffmpeg_Path: null, // auto-detect
  videoFrame: {
    width: CONFIG.viewport.width,
    height: CONFIG.viewport.height,
  },
  videoCrf: 18,
  videoCodec: 'libx264',
  videoPreset: 'ultrafast',
  videoBitrate: 3000,
  autopad: {
    color: '#0f172a', // Match dark bg
  },
  aspectRatio: '16:9',
};

// ── Demo Scenario ───────────────────────────────────────────

const DEMO_STEPS = [
  // --- Act 1: Login (15s) ---
  {
    name: '🔐 Login Page',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(2000);
      
      // Type email with realistic speed
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail"]');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(CONFIG.email, { delay: 60 });
        await delay(500);
      }
      
      // Type password
      const passInput = await page.$('input[type="password"]');
      if (passInput) {
        await passInput.click();
        await passInput.type(CONFIG.password, { delay: 40 });
        await delay(500);
      }
      
      // Click login button
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
      }
      
      await delay(3000); // wait for redirect
    },
    duration: 8000,
  },

  // --- Act 2: Dashboard Overview (20s) ---
  {
    name: '📊 Dashboard Overview',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/overview`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      
      // Smooth scroll to show stats
      await smoothScroll(page, 400, 2000);
      await delay(1500);
      await smoothScroll(page, 0, 1000);
      await delay(2000);
    },
    duration: 10000,
  },

  // --- Act 3: Tools Catalog (15s) ---
  {
    name: '🔧 Tools Catalog',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/tools`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      
      // Scroll through tools
      await smoothScroll(page, 500, 2000);
      await delay(2000);
      await smoothScroll(page, 1000, 2000);
      await delay(2000);
      await smoothScroll(page, 0, 1000);
      await delay(1500);
    },
    duration: 13000,
  },

  // --- Act 4: Nmap Tool Detail (10s) ---
  {
    name: '🔍 Nmap Tool Detail',
    action: async (page) => {
      // Navigate to Nmap tool
      await page.goto(`${CONFIG.baseUrl}/dashboard/tools/nmap`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      
      // Scroll to show features
      await smoothScroll(page, 400, 2000);
      await delay(2000);
      await smoothScroll(page, 0, 1000);
      await delay(2000);
    },
    duration: 10000,
  },

  // --- Act 5: Start Nmap Scan (30s) ---
  {
    name: '🚀 Execute Nmap Scan',
    action: async (page) => {
      // Go to scan execution page with target pre-filled
      await page.goto(
        `${CONFIG.baseUrl}/dashboard/tools/nmap/run?target=scanme.nmap.org`,
        { waitUntil: 'networkidle2', timeout: 30000 }
      );
      await delay(3000);

      // Check if target is filled, if not type it
      const targetInput = await page.$('input[placeholder*="target"], input[placeholder*="nmap"], input[placeholder*="domain"]');
      if (targetInput) {
        const value = await page.evaluate(el => el.value, targetInput);
        if (!value) {
          await targetInput.click({ clickCount: 3 });
          await targetInput.type('scanme.nmap.org', { delay: 80 });
          await delay(1000);
        }
      }
      
      // Click Start Scan button
      const startBtn = await page.$('button:not([disabled])');
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Start Scan')) {
          await btn.click();
          break;
        }
      }
      
      await delay(4000);

      // Watch terminal output scrolling for ~20 seconds
      for (let i = 0; i < 10; i++) {
        await delay(2000);
        // Auto-scroll terminal
        const terminal = await page.$('.overflow-auto, [class*="terminal"], [class*="output"]');
        if (terminal) {
          await page.evaluate(el => el.scrollTop = el.scrollHeight, terminal);
        }
      }
    },
    duration: 28000,
  },

  // --- Act 6: Scans Dashboard (10s) ---
  {
    name: '📋 Scan History',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/scans`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      
      await smoothScroll(page, 300, 1500);
      await delay(2500);
      await smoothScroll(page, 0, 1000);
      await delay(2000);
    },
    duration: 10000,
  },

  // --- Act 7: Reports (10s) ---
  {
    name: '📊 Security Reports',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/reports`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      
      await smoothScroll(page, 400, 2000);
      await delay(2000);
      await smoothScroll(page, 800, 2000);
      await delay(2000);
      await smoothScroll(page, 0, 1000);
      await delay(1500);
    },
    duration: 12000,
  },

  // --- Act 8: Agents Page (10s) ---
  {
    name: '🖥️ Remote Agents',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/agents`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      
      await smoothScroll(page, 300, 1500);
      await delay(2500);
      await smoothScroll(page, 0, 1000);
      await delay(2000);
    },
    duration: 10000,
  },

  // --- Act 9: Back to Dashboard (5s) ---
  {
    name: '🏠 Final Dashboard View',
    action: async (page) => {
      await page.goto(`${CONFIG.baseUrl}/dashboard/overview`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
      await smoothScroll(page, 200, 1500);
      await delay(2000);
    },
    duration: 7000,
  },
];

// ── Helpers ─────────────────────────────────────────────────

async function smoothScroll(page, targetY, duration) {
  await page.evaluate(async (y, dur) => {
    const start = window.scrollY;
    const diff = y - start;
    const steps = Math.ceil(dur / 16); // ~60fps
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      // easeInOutCubic
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, start + diff * ease);
      await new Promise(r => setTimeout(r, 16));
    }
  }, targetY, duration);
}

async function addOverlayText(page, text) {
  await page.evaluate((t) => {
    // Remove existing overlay
    const existing = document.getElementById('demo-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'demo-overlay';
    overlay.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85); color: #00d4ff; padding: 12px 28px;
      border-radius: 12px; font-family: 'JetBrains Mono', monospace;
      font-size: 16px; font-weight: 600; z-index: 99999;
      border: 1px solid rgba(0, 212, 255, 0.4);
      backdrop-filter: blur(12px); letter-spacing: 0.5px;
      box-shadow: 0 4px 20px rgba(0, 212, 255, 0.15);
      animation: fadeIn 0.4s ease-out;
    `;
    overlay.textContent = t;
    
    // Add animation CSS
    if (!document.getElementById('demo-overlay-style')) {
      const style = document.createElement('style');
      style.id = 'demo-overlay-style';
      style.textContent = `
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(overlay);
  }, text);
}

async function removeOverlay(page) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-overlay');
    if (el) el.remove();
  });
}

// ── Main Recording Function ──────────────────────────────────

async function recordDemo() {
  console.log('🎬 CyberSec Pro Demo Recorder v2.0');
  console.log('═══════════════════════════════════');
  console.log(`📍 Target: ${CONFIG.baseUrl}`);
  console.log(`📐 Resolution: ${CONFIG.viewport.width}x${CONFIG.viewport.height}`);
  console.log(`🎞️  FPS: ${CONFIG.fps}`);
  console.log('');

  // Ensure output directory exists
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const videoPath = path.join(CONFIG.outputDir, `cybersec-demo-${timestamp()}.mp4`);
  const thumbPath = path.join(CONFIG.outputDir, `thumbnail-${timestamp()}.png`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--window-size=${CONFIG.viewport.width},${CONFIG.viewport.height}`,
      '--disable-web-security',
      '--ignore-certificate-errors',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport(CONFIG.viewport);

  // Set user agent for realistic demo
  await page.setUserAgent(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // ── Start Recording ──
  const recorder = new PuppeteerScreenRecorder(page, recorderConfig);
  console.log('🔴 Recording started...\n');
  await recorder.start(videoPath);

  const startTime = Date.now();
  let stepNum = 0;

  for (const step of DEMO_STEPS) {
    stepNum++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${elapsed}s] Step ${stepNum}/${DEMO_STEPS.length}: ${step.name}`);

    try {
      // Show step overlay
      await addOverlayText(page, step.name);
      await delay(800);

      // Execute step action
      await step.action(page);

      // Remove overlay before next step
      await removeOverlay(page);
      await delay(300);

    } catch (err) {
      console.log(`   ⚠️  Step failed: ${err.message}`);
      // Continue recording even if a step fails
      await delay(2000);
    }
  }

  // ── Stop Recording ──
  await recorder.stop();
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Recording complete! Duration: ${totalDuration}s`);
  console.log(`📁 Video: ${videoPath}`);

  // ── Take Thumbnail ──
  try {
    await page.goto(`${CONFIG.baseUrl}/dashboard/overview`, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(2000);
    await page.screenshot({ path: thumbPath, type: 'png' });
    console.log(`🖼️  Thumbnail: ${thumbPath}`);
  } catch (e) {
    console.log('⚠️  Thumbnail capture failed');
  }

  await browser.close();

  // ── Post-process with ffmpeg ──
  const finalPath = await postProcessVideo(videoPath);

  return { videoPath: finalPath, thumbPath, duration: totalDuration };
}

// ── Video Post-processing ──────────────────────────────────

async function postProcessVideo(inputPath) {
  const { execSync } = require('child_process');
  const outputPath = inputPath.replace('.mp4', '-final.mp4');

  console.log('\n🎞️  Post-processing video...');

  try {
    // Add intro/outro text overlay + ensure proper encoding
    const ffmpegCmd = [
      'ffmpeg -y',
      `-i "${inputPath}"`,
      // Add CyberSec Pro watermark in top-right
      `-vf "drawtext=text='CyberSec Pro':fontsize=24:fontcolor=white@0.5:x=w-tw-20:y=20"`,
      '-c:v libx264',
      '-preset medium',
      '-crf 20',
      '-pix_fmt yuv420p',
      '-movflags +faststart', // Web optimized
      `"${outputPath}"`,
    ].join(' ');

    execSync(ffmpegCmd, { stdio: 'pipe', timeout: 120000 });
    console.log(`✅ Final video: ${outputPath}`);

    // Get video info
    const durationCmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${outputPath}"`;
    const duration = execSync(durationCmd, { encoding: 'utf8' }).trim();
    const fileSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`📊 Duration: ${parseFloat(duration).toFixed(1)}s | Size: ${fileSize}MB`);

    return outputPath;
  } catch (err) {
    console.log(`⚠️  Post-processing failed: ${err.message}`);
    console.log('   Using raw recording instead.');
    return inputPath;
  }
}

// ── YouTube Upload ──────────────────────────────────────────

async function uploadToYouTube(videoPath, thumbPath) {
  const https = require('https');
  const http = require('http');

  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  const refreshToken = process.env.YT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('\n⚠️  YouTube credentials not set. Set these env vars:');
    console.log('   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN');
    console.log('\n📋 To get these:');
    console.log('   1. Go to https://console.cloud.google.com/');
    console.log('   2. Create OAuth 2.0 credentials');
    console.log('   3. Enable YouTube Data API v3');
    console.log('   4. Get refresh token via OAuth playground');
    return null;
  }

  console.log('\n📤 Uploading to YouTube...');

  // 1. Get access token from refresh token
  const tokenData = await new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString();

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  if (!tokenData.access_token) {
    console.log('❌ Failed to get YouTube access token');
    return null;
  }

  // 2. Upload video using resumable upload
  const videoFile = fs.readFileSync(videoPath);
  const today = new Date().toISOString().slice(0, 10);

  const metadata = {
    snippet: {
      title: `CyberSec Pro - Live Demo (${today})`,
      description: [
        'CyberSec Pro - Enterprise Cybersecurity Platform',
        '',
        'This automated demo shows:',
        '✅ Login & Dashboard Overview',
        '✅ 680+ Security Tools Catalog',
        '✅ Live Nmap Network Scan',
        '✅ Real-time Scan Output',
        '✅ Security Reports & Analytics',
        '✅ Remote Agent Management',
        '',
        '🔗 Try it free: https://app.cyber-sec-pro.com',
        '📧 Contact: info@semihkilic.com',
        '',
        '#cybersecurity #pentesting #kalilinux #nmap #infosec',
      ].join('\n'),
      tags: ['cybersecurity', 'penetration testing', 'kali linux', 'nmap', 'security tools', 'saas', 'infosec', 'demo'],
      categoryId: '28', // Science & Technology
      defaultLanguage: 'en',
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
      embeddable: true,
    },
  };

  // Initiate resumable upload
  const uploadUrl = await new Promise((resolve, reject) => {
    const metaJson = JSON.stringify(metadata);
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(metaJson),
        'X-Upload-Content-Length': videoFile.length,
        'X-Upload-Content-Type': 'video/mp4',
      },
    }, (res) => {
      resolve(res.headers.location);
    });
    req.on('error', reject);
    req.write(metaJson);
    req.end();
  });

  if (!uploadUrl) {
    console.log('❌ Failed to initiate YouTube upload');
    return null;
  }

  // Upload video data
  const result = await new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'video/mp4',
        'Content-Length': videoFile.length,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(videoFile);
    req.end();
  });

  if (result && result.id) {
    const videoUrl = `https://www.youtube.com/watch?v=${result.id}`;
    const embedUrl = `https://www.youtube.com/embed/${result.id}`;
    console.log(`✅ YouTube upload complete!`);
    console.log(`🔗 URL: ${videoUrl}`);
    console.log(`📺 Embed: ${embedUrl}`);
    
    // Save embed URL for landing page update
    saveVideoConfig({ youtube: { id: result.id, url: videoUrl, embed: embedUrl, uploaded_at: new Date().toISOString() }});
    return result.id;
  }

  console.log('❌ YouTube upload failed');
  return null;
}

// ── Vimeo Upload ─────────────────────────────────────────────

async function uploadToVimeo(videoPath) {
  const https = require('https');

  const token = process.env.VIMEO_TOKEN;
  if (!token) {
    console.log('\n⚠️  Vimeo token not set. Set VIMEO_TOKEN env var.');
    console.log('   Get one at: https://developer.vimeo.com/apps');
    return null;
  }

  console.log('\n📤 Uploading to Vimeo...');

  const videoFile = fs.readFileSync(videoPath);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Create video entry
  const createData = JSON.stringify({
    upload: {
      approach: 'tus',
      size: videoFile.length,
    },
    name: `CyberSec Pro - Live Demo (${today})`,
    description: 'CyberSec Pro enterprise cybersecurity platform demo. Login, scan, report.',
    privacy: { view: 'anybody', embed: 'public' },
  });

  const createResult = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.vimeo.com',
      path: '/me/videos',
      method: 'POST',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
        'Content-Length': Buffer.byteLength(createData),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(createData);
    req.end();
  });

  if (createResult && createResult.uri) {
    const videoId = createResult.uri.split('/').pop();
    const videoUrl = `https://vimeo.com/${videoId}`;
    const embedUrl = `https://player.vimeo.com/video/${videoId}`;

    // Upload via tus (simplified - actual tus protocol would use tus-js-client)
    const uploadLink = createResult.upload?.upload_link;
    if (uploadLink) {
      const url = new URL(uploadLink);
      const protocol = url.protocol === 'https:' ? https : require('http');
      
      await new Promise((resolve, reject) => {
        const req = protocol.request({
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': '0',
            'Content-Type': 'application/offset+octet-stream',
            'Content-Length': videoFile.length,
          },
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        req.write(videoFile);
        req.end();
      });
    }

    console.log(`✅ Vimeo upload complete!`);
    console.log(`🔗 URL: ${videoUrl}`);
    console.log(`📺 Embed: ${embedUrl}`);

    saveVideoConfig({ vimeo: { id: videoId, url: videoUrl, embed: embedUrl, uploaded_at: new Date().toISOString() }});
    return videoId;
  }

  console.log('❌ Vimeo upload failed');
  return null;
}

// ── Config Persistence ──────────────────────────────────────

function saveVideoConfig(data) {
  const configPath = path.join(__dirname, 'demo-video-config.json');
  let config = {};
  
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  }
  
  config = { ...config, ...data, updated_at: new Date().toISOString() };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`💾 Config saved: ${configPath}`);
}

// ── CLI ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const uploadTarget = args.includes('--upload') ? args[args.indexOf('--upload') + 1] : null;

  try {
    // 1. Record demo
    const { videoPath, thumbPath, duration } = await recordDemo();

    // 2. Upload if requested
    if (uploadTarget === 'youtube') {
      await uploadToYouTube(videoPath, thumbPath);
    } else if (uploadTarget === 'vimeo') {
      await uploadToVimeo(videoPath);
    } else if (uploadTarget === 'both') {
      await uploadToYouTube(videoPath, thumbPath);
      await uploadToVimeo(videoPath);
    }

    console.log('\n════════════════════════════════════');
    console.log('🎬 Demo recording pipeline complete!');
    console.log(`📁 Video: ${videoPath}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Recording failed:', err);
    process.exit(1);
  }
}

main();
