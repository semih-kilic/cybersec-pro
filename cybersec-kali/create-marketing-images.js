#!/usr/bin/env node
// CyberSec Pro - Gumroad Cover Image Generator
// Creates professional cover images for Gumroad listing

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = '/home/sam/APPS/cybersec-sales/frontend/marketing';

async function createGumroadImages() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     🎨 Gumroad Marketing Image Generator              ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });

    // 1. Cover Image (1280x720)
    console.log('📷 Creating Cover Image (1280x720)...');
    const coverPage = await browser.newPage();
    await coverPage.setViewportSize({ width: 1280, height: 720 });
    await coverPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    width: 1280px;
                    height: 720px;
                    background: linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a2e 100%);
                    font-family: 'Inter', sans-serif;
                    color: white;
                    display: flex;
                    overflow: hidden;
                }
                .left {
                    flex: 1;
                    padding: 60px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(0, 212, 255, 0.1);
                    border: 1px solid rgba(0, 212, 255, 0.3);
                    padding: 8px 16px;
                    border-radius: 50px;
                    font-size: 14px;
                    color: #00d4ff;
                    margin-bottom: 24px;
                    width: fit-content;
                }
                .badge::before {
                    content: '';
                    width: 8px;
                    height: 8px;
                    background: #00d4ff;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                h1 {
                    font-size: 56px;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-bottom: 20px;
                }
                .gradient {
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .subtitle {
                    font-size: 22px;
                    color: #9ca3af;
                    margin-bottom: 32px;
                    line-height: 1.5;
                }
                .features {
                    display: flex;
                    gap: 24px;
                }
                .feature {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #d1d5db;
                    font-size: 16px;
                }
                .feature svg {
                    width: 20px;
                    height: 20px;
                    color: #22c55e;
                }
                .right {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .screenshot {
                    width: 600px;
                    border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
                    border: 1px solid rgba(255,255,255,0.1);
                    transform: perspective(1000px) rotateY(-5deg);
                }
                .glow {
                    position: absolute;
                    width: 400px;
                    height: 400px;
                    background: radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, transparent 70%);
                    filter: blur(60px);
                    z-index: -1;
                }
            </style>
        </head>
        <body>
            <div class="left">
                <div class="badge">🛡️ Version 2.0 Available</div>
                <h1>The Ultimate<br><span class="gradient">Cybersecurity</span><br>Platform</h1>
                <p class="subtitle">230+ security tools in one powerful dashboard.<br>Built for professionals.</p>
                <div class="features">
                    <div class="feature">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Vulnerability Scanning
                    </div>
                    <div class="feature">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Network Analysis
                    </div>
                    <div class="feature">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        PDF Reports
                    </div>
                </div>
            </div>
            <div class="right">
                <div class="glow"></div>
                <img class="screenshot" src="file:///home/sam/APPS/cybersec-sales/frontend/screenshots/01-dashboard-overview.png" alt="Dashboard">
            </div>
        </body>
        </html>
    `);
    await coverPage.screenshot({ path: path.join(OUTPUT_DIR, 'gumroad-cover.png') });
    console.log('   ✅ gumroad-cover.png (1280x720)');

    // 2. Thumbnail (600x600)
    console.log('📷 Creating Thumbnail (600x600)...');
    const thumbPage = await browser.newPage();
    await thumbPage.setViewportSize({ width: 600, height: 600 });
    await thumbPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;800&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    width: 600px;
                    height: 600px;
                    background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
                    font-family: 'Inter', sans-serif;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }
                .logo {
                    width: 120px;
                    height: 120px;
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    border-radius: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 32px;
                    box-shadow: 0 20px 40px rgba(0, 212, 255, 0.3);
                }
                .logo svg {
                    width: 70px;
                    height: 70px;
                    color: white;
                }
                h1 {
                    font-size: 48px;
                    font-weight: 800;
                    margin-bottom: 16px;
                }
                .gradient {
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .tools {
                    font-size: 72px;
                    font-weight: 800;
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 8px;
                }
                .subtitle {
                    font-size: 24px;
                    color: #9ca3af;
                }
            </style>
        </head>
        <body>
            <div class="logo">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
            </div>
            <h1>CyberSec <span class="gradient">Pro</span></h1>
            <div class="tools">230+</div>
            <div class="subtitle">Security Tools</div>
        </body>
        </html>
    `);
    await thumbPage.screenshot({ path: path.join(OUTPUT_DIR, 'gumroad-thumbnail.png') });
    console.log('   ✅ gumroad-thumbnail.png (600x600)');

    // 3. OG Image (1200x630) - for social sharing
    console.log('📷 Creating OG Image (1200x630)...');
    const ogPage = await browser.newPage();
    await ogPage.setViewportSize({ width: 1200, height: 630 });
    await ogPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    width: 1200px;
                    height: 630px;
                    background: linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a2e 100%);
                    font-family: 'Inter', sans-serif;
                    color: white;
                    display: flex;
                    padding: 60px;
                    overflow: hidden;
                }
                .left {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .logo-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 32px;
                }
                .logo {
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .logo svg {
                    width: 36px;
                    height: 36px;
                    color: white;
                }
                .brand {
                    font-size: 28px;
                    font-weight: 800;
                }
                h1 {
                    font-size: 52px;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-bottom: 24px;
                }
                .gradient {
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .subtitle {
                    font-size: 24px;
                    color: #9ca3af;
                    margin-bottom: 32px;
                }
                .stats {
                    display: flex;
                    gap: 40px;
                }
                .stat {
                    text-align: center;
                }
                .stat-value {
                    font-size: 36px;
                    font-weight: 800;
                    background: linear-gradient(135deg, #00d4ff, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .stat-label {
                    font-size: 14px;
                    color: #9ca3af;
                }
                .right {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .screenshot {
                    width: 500px;
                    border-radius: 12px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
                    border: 1px solid rgba(255,255,255,0.1);
                }
            </style>
        </head>
        <body>
            <div class="left">
                <div class="logo-row">
                    <div class="logo">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                    </div>
                    <span class="brand">CyberSec Pro</span>
                </div>
                <h1>Professional<br><span class="gradient">Cybersecurity</span><br>Testing Platform</h1>
                <p class="subtitle">Everything you need for security testing in one dashboard.</p>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">230+</div>
                        <div class="stat-label">Security Tools</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">19</div>
                        <div class="stat-label">Categories</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">$149</div>
                        <div class="stat-label">Per Year</div>
                    </div>
                </div>
            </div>
            <div class="right">
                <img class="screenshot" src="file:///home/sam/APPS/cybersec-sales/frontend/screenshots/01-dashboard-overview.png" alt="Dashboard">
            </div>
        </body>
        </html>
    `);
    await ogPage.screenshot({ path: path.join(OUTPUT_DIR, 'og-image.png') });
    // Also copy to screenshots folder for website use
    fs.copyFileSync(path.join(OUTPUT_DIR, 'og-image.png'), '/home/sam/APPS/cybersec-sales/frontend/screenshots/og-image.png');
    console.log('   ✅ og-image.png (1200x630)');

    await browser.close();

    // List results
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 Marketing Images Created:\n');
    
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
    files.forEach(file => {
        const stats = fs.statSync(path.join(OUTPUT_DIR, file));
        const sizeKB = (stats.size / 1024).toFixed(0);
        console.log(`   🖼️  ${file} (${sizeKB} KB)`);
    });

    console.log(`\n📁 Location: ${OUTPUT_DIR}`);
    console.log('\n✅ Ready for Gumroad upload!\n');
}

createGumroadImages().catch(console.error);
