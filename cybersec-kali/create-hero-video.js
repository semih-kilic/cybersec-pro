#!/usr/bin/env node
// CyberSec Pro - Hero Video/GIF Generator
// Creates animated demo for website hero section

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const OUTPUT_DIR = '/home/sam/APPS/cybersec-sales/frontend/videos';
const SCREENSHOTS_DIR = '/tmp/hero-frames';
const BASE_URL = 'http://10.0.0.240:5173';

async function createHeroVideo() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     🎬 CyberSec Pro - Hero Video Generator           ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Clean and create directories
    if (fs.existsSync(SCREENSHOTS_DIR)) {
        fs.rmSync(SCREENSHOTS_DIR, { recursive: true });
    }
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark'
    });
    const page = await context.newPage();

    let frameCount = 0;
    const captureFrame = async (delay = 100) => {
        frameCount++;
        const framePath = path.join(SCREENSHOTS_DIR, `frame_${String(frameCount).padStart(4, '0')}.png`);
        await page.screenshot({ path: framePath });
        await page.waitForTimeout(delay);
    };

    try {
        // Scene 1: Dashboard Load (2 seconds = 20 frames)
        console.log('📷 Scene 1: Dashboard loading...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
        
        // Capture dashboard for 2 seconds
        for (let i = 0; i < 20; i++) {
            await captureFrame(100);
        }

        // Scene 2: Scroll through categories (3 seconds)
        console.log('📷 Scene 2: Scrolling categories...');
        for (let i = 0; i < 15; i++) {
            await page.mouse.wheel(0, 50);
            await captureFrame(100);
        }
        
        // Pause at categories
        for (let i = 0; i < 10; i++) {
            await captureFrame(100);
        }

        // Scene 3: Click on Information Gathering (2 seconds)
        console.log('📷 Scene 3: Clicking category...');
        const categoryCard = await page.$('text=Information Gathering');
        if (categoryCard) {
            await categoryCard.hover();
            for (let i = 0; i < 5; i++) await captureFrame(100);
            await categoryCard.click();
            await page.waitForTimeout(300);
        }
        
        // Capture tools list
        for (let i = 0; i < 20; i++) {
            await captureFrame(100);
        }

        // Scene 4: Scroll through tools (2 seconds)
        console.log('📷 Scene 4: Browsing tools...');
        for (let i = 0; i < 10; i++) {
            await page.mouse.wheel(0, 40);
            await captureFrame(100);
        }
        
        // Scene 5: Click on a tool (Nmap) (2 seconds)
        console.log('📷 Scene 5: Selecting tool...');
        const nmapTool = await page.$('text=Nmap');
        if (nmapTool) {
            await nmapTool.hover();
            for (let i = 0; i < 5; i++) await captureFrame(100);
            await nmapTool.click();
            await page.waitForTimeout(500);
        }
        
        // Capture tool detail
        for (let i = 0; i < 20; i++) {
            await captureFrame(100);
        }

        // Scene 6: Back to dashboard (1 second)
        console.log('📷 Scene 6: Back to dashboard...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        for (let i = 0; i < 15; i++) {
            await captureFrame(100);
        }

        await browser.close();

        console.log(`\n✅ Captured ${frameCount} frames`);

        // Convert to video using FFmpeg
        console.log('\n🎬 Converting to video...');
        
        const mp4Output = path.join(OUTPUT_DIR, 'hero-demo.mp4');
        const webmOutput = path.join(OUTPUT_DIR, 'hero-demo.webm');
        const gifOutput = path.join(OUTPUT_DIR, 'hero-demo.gif');

        // MP4 (for most browsers)
        execSync(`ffmpeg -y -framerate 10 -i ${SCREENSHOTS_DIR}/frame_%04d.png -c:v libx264 -pix_fmt yuv420p -preset slow -crf 22 ${mp4Output}`, { stdio: 'inherit' });
        console.log('✅ MP4 created');

        // WebM (for modern browsers)
        execSync(`ffmpeg -y -framerate 10 -i ${SCREENSHOTS_DIR}/frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 1M ${webmOutput}`, { stdio: 'inherit' });
        console.log('✅ WebM created');

        // GIF (fallback, smaller)
        execSync(`ffmpeg -y -framerate 10 -i ${SCREENSHOTS_DIR}/frame_%04d.png -vf "fps=10,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" ${gifOutput}`, { stdio: 'inherit' });
        console.log('✅ GIF created');

        // Cleanup
        fs.rmSync(SCREENSHOTS_DIR, { recursive: true });

        // Show results
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📊 Output Files:\n');
        
        const files = fs.readdirSync(OUTPUT_DIR);
        files.forEach(file => {
            const stats = fs.statSync(path.join(OUTPUT_DIR, file));
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`   🎬 ${file} (${sizeMB} MB)`);
        });

        console.log(`\n📁 Location: ${OUTPUT_DIR}`);
        console.log('\n✅ Hero video ready for website!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        await browser.close();
    }
}

// Check dependencies
const http = require('http');
http.get(BASE_URL, (res) => {
    if (res.statusCode === 200) {
        createHeroVideo().catch(console.error);
    }
}).on('error', () => {
    console.error('❌ CyberSec Pro is not running on port 5173');
    process.exit(1);
});
