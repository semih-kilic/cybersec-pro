#!/usr/bin/env node
// CyberSec Pro - Automated Screenshot Capture
// Uses Playwright to capture product screenshots for marketing

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = '/home/sam/APPS/cybersec-kali/frontend/screenshots';
const BASE_URL = 'http://10.0.0.240:5173';

const screenshots = [
    {
        name: '01-dashboard-overview',
        url: '/',
        description: 'Dashboard with all tool categories',
        waitFor: 3000,
        fullPage: false
    },
    {
        name: '02-tools-categories',
        url: '/',
        description: 'Tool categories grid',
        waitFor: 2000,
        fullPage: true
    },
    {
        name: '03-information-gathering',
        url: '/?category=information-gathering',
        description: 'Information Gathering tools',
        waitFor: 2000,
        fullPage: false
    },
    {
        name: '04-vulnerability-analysis',
        url: '/?category=vulnerability-analysis',
        description: 'Vulnerability Analysis tools',
        waitFor: 2000,
        fullPage: false
    },
    {
        name: '05-web-apps',
        url: '/?category=web-application',
        description: 'Web Application tools',
        waitFor: 2000,
        fullPage: false
    },
    {
        name: '06-dark-theme',
        url: '/',
        description: 'Dark mode interface',
        waitFor: 1000,
        fullPage: false
    }
];

async function captureScreenshots() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     📸 CyberSec Pro - Screenshot Capture Tool        ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
    // Ensure directory exists
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    
    console.log(`📁 Output: ${SCREENSHOTS_DIR}\n`);
    
    const browser = await chromium.launch({
        headless: true
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark'
    });
    
    const page = await context.newPage();
    
    for (const shot of screenshots) {
        try {
            console.log(`📷 Capturing: ${shot.description}...`);
            
            await page.goto(`${BASE_URL}${shot.url}`, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            await page.waitForTimeout(shot.waitFor);
            
            const filepath = path.join(SCREENSHOTS_DIR, `${shot.name}.png`);
            
            await page.screenshot({
                path: filepath,
                fullPage: shot.fullPage,
                type: 'png'
            });
            
            console.log(`   ✅ Saved: ${shot.name}.png`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
    
    await browser.close();
    
    // List captured screenshots
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 Captured Screenshots:\n');
    
    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    files.forEach(file => {
        const stats = fs.statSync(path.join(SCREENSHOTS_DIR, file));
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`   📷 ${file} (${sizeMB} MB)`);
    });
    
    console.log(`\n✅ Total: ${files.length} screenshots captured`);
    console.log(`📁 Location: ${SCREENSHOTS_DIR}`);
    
    // Copy to sales site
    const salesDir = '/home/sam/APPS/cybersec-sales/frontend/screenshots';
    if (!fs.existsSync(salesDir)) {
        fs.mkdirSync(salesDir, { recursive: true });
    }
    
    console.log(`\n📤 Syncing to sales site...`);
    files.forEach(file => {
        fs.copyFileSync(
            path.join(SCREENSHOTS_DIR, file),
            path.join(salesDir, file)
        );
    });
    console.log(`✅ Screenshots synced to: ${salesDir}\n`);
}

// Check if CyberSec is running
const http = require('http');

http.get(`${BASE_URL}`, (res) => {
    if (res.statusCode === 200) {
        captureScreenshots().catch(console.error);
    }
}).on('error', () => {
    console.error('❌ CyberSec Pro is not running on port 5173');
    console.error('Start it first: csctl start');
    process.exit(1);
});
