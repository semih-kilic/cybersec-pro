const puppeteer = require('puppeteer');
const path = require('path');
const { exec } = require('child_process');

const VIDEOS_DIR = path.join(__dirname, 'frontend/videos');
const BASE_URL = 'http://localhost:5173';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Demo scenario - Updated for v2.1.0
const scenario = [
    { action: 'goto', url: '/', wait: 4000, description: 'CyberSec Pro Dashboard - 690 Tools' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Show tool statistics' },
    { action: 'scroll', y: 600, wait: 2000, description: 'Show features overview' },
    { action: 'scroll', y: 0, wait: 1500, description: 'Back to top' },
    
    { action: 'goto', url: '/tools', wait: 3000, description: 'Security Tools Catalog' },
    { action: 'scroll', y: 400, wait: 2000, description: 'Browse tool categories' },
    { action: 'click', selector: '[data-category="information-gathering"]', wait: 2000, description: 'Information Gathering tools', optional: true },
    
    { action: 'goto', url: '/tools/nmap', wait: 3000, description: 'Nmap - Network Scanner' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Tool details and usage' },
    
    { action: 'goto', url: '/tools/metasploit', wait: 3000, description: 'Metasploit Framework' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Exploitation framework' },
    
    { action: 'goto', url: '/tools/burpsuite', wait: 3000, description: 'Burp Suite Professional' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Web application testing' },
    
    { action: 'goto', url: '/terminal', wait: 3000, description: 'Integrated Terminal' },
    { action: 'scroll', y: 200, wait: 2000, description: 'Command execution interface' },
    
    { action: 'goto', url: '/scans', wait: 3000, description: 'Scan Management' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Security scan results' },
    
    { action: 'goto', url: '/reports', wait: 3000, description: 'Vulnerability Reports' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Detailed security reports' },
    
    { action: 'goto', url: '/settings', wait: 3000, description: 'System Configuration' },
    { action: 'scroll', y: 300, wait: 2000, description: 'Platform settings' },
    
    { action: 'goto', url: '/', wait: 4000, description: 'Return to Dashboard' },
    { action: 'scroll', y: 200, wait: 2000, description: 'Final overview' }
];

async function recordDemo() {
    console.log('🎬 Starting Demo Recording...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new', // Headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Take screenshots during demo for video creation
    const screenshots = [];
    let frameCount = 0;
    
    for (const step of scenario) {
        console.log(`📍 ${step.description}...`);
        
        try {
            if (step.action === 'goto') {
                await page.goto(`${BASE_URL}${step.url}`, { waitUntil: 'networkidle0', timeout: 30000 });
            } else if (step.action === 'scroll') {
                await page.evaluate((y) => window.scrollTo(0, y), step.y);
            } else if (step.action === 'click' && step.selector) {
                const element = await page.$(step.selector);
                if (element) {
                    await element.click();
                }
            }
            
            // Take frame screenshots for video
            const framePath = path.join(VIDEOS_DIR, `frames/frame_${String(frameCount++).padStart(5, '0')}.png`);
            await page.screenshot({ path: framePath });
            
            await delay(step.wait);
            
            // Take more frames during wait
            for (let i = 0; i < Math.floor(step.wait / 500); i++) {
                await delay(500);
                const framePath = path.join(VIDEOS_DIR, `frames/frame_${String(frameCount++).padStart(5, '0')}.png`);
                await page.screenshot({ path: framePath });
            }
            
        } catch (error) {
            if (!step.optional) {
                console.log(`   ⚠️ Warning: ${error.message}`);
            }
        }
    }
    
    await browser.close();
    
    console.log('\n✅ Demo recording complete!');
    console.log(`📁 ${frameCount} frames captured in: ${VIDEOS_DIR}/frames`);
    console.log('\n🎞️  Creating video from frames...');
    
    // Use ffmpeg to create video from frames
    const outputVideo = path.join(VIDEOS_DIR, 'demo.mp4');
    const ffmpegCmd = `ffmpeg -y -framerate 2 -i "${VIDEOS_DIR}/frames/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p -vf "scale=1920:1080" "${outputVideo}"`;
    
    return new Promise((resolve, reject) => {
        exec(ffmpegCmd, (error, stdout, stderr) => {
            if (error) {
                console.log('❌ Video creation failed:', error.message);
                reject(error);
            } else {
                console.log(`✅ Video saved to: ${outputVideo}`);
                resolve();
            }
        });
    });
}

// Create frames directory
const fs = require('fs');
const framesDir = path.join(VIDEOS_DIR, 'frames');
if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
}

recordDemo().catch(console.error);
