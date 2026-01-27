const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');
const fs = require('fs');

const Config = {
    followNewTab: true,
    fps: 30,
    videoFrame: {
        width: 1920,
        height: 1080,
    },
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'ultrafast',
    videoBitrate: 3000,
    autopad: {
        color: '#0f172a',
    },
    aspectRatio: '16:9',
};

async function createToolsDemo() {
    console.log('🎬 Starting tools page demo recording...\n');
    
    const outputDir = path.join(__dirname, 'frontend', 'videos');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const videoPath = path.join(outputDir, 'demo.mp4');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Start recording
    const recorder = new PuppeteerScreenRecorder(page, Config);
    await recorder.start(videoPath);
    console.log('📹 Recording started...');
    
    // Navigate to tools page
    console.log('📍 Loading tools page...');
    await page.goto('file://' + path.join(__dirname, 'frontend', 'tools.html'), {
        waitUntil: 'networkidle2',
        timeout: 60000
    });
    
    // Wait for page to fully render
    await sleep(3000);
    
    // Scene 1: Hero section with stats
    console.log('🎬 Scene 1: Hero section with stats');
    await sleep(2000);
    
    // Scene 2: Scroll down to tools section
    console.log('🎬 Scene 2: Scrolling to tools section');
    await smoothScroll(page, 600);
    await sleep(1500);
    
    // Scene 3: Show search functionality
    console.log('🎬 Scene 3: Demonstrating search');
    await page.focus('#search-input');
    await sleep(500);
    await typeWithEffect(page, 'nmap');
    await sleep(2000);
    
    // Clear search
    await page.evaluate(() => {
        document.querySelector('#search-input').value = '';
        const event = new Event('input', { bubbles: true });
        document.querySelector('#search-input').dispatchEvent(event);
    });
    await sleep(1000);
    
    // Scene 4: Click different categories
    console.log('🎬 Scene 4: Browsing categories');
    const categories = ['web-apps', 'password', 'exploitation', 'wireless'];
    
    for (const cat of categories) {
        await page.evaluate((categoryId) => {
            const btn = document.querySelector(`[data-category="${categoryId}"]`);
            if (btn) {
                btn.click();
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, cat);
        await sleep(1500);
    }
    
    // Back to all
    await page.evaluate(() => {
        const allBtn = document.querySelector('[data-category="all"]');
        if (allBtn) allBtn.click();
    });
    await sleep(1000);
    
    // Scene 5: Toggle grid/list view
    console.log('🎬 Scene 5: Switching views');
    await page.evaluate(() => {
        const listBtn = document.querySelector('[data-view="list"]');
        if (listBtn) listBtn.click();
    });
    await sleep(2000);
    
    await page.evaluate(() => {
        const gridBtn = document.querySelector('[data-view="grid"]');
        if (gridBtn) gridBtn.click();
    });
    await sleep(1500);
    
    // Scene 6: Click on a tool to show modal
    console.log('🎬 Scene 6: Opening tool detail');
    await page.evaluate(() => {
        const firstTool = document.querySelector('.tool-card');
        if (firstTool) firstTool.click();
    });
    await sleep(3000);
    
    // Close modal
    await page.evaluate(() => {
        const closeBtn = document.querySelector('#tool-modal .close-modal');
        if (closeBtn) closeBtn.click();
    });
    await sleep(1000);
    
    // Scene 7: Filter by plan
    console.log('🎬 Scene 7: Filtering by plan');
    await page.evaluate(() => {
        const proFilter = document.querySelector('#plan-filter');
        if (proFilter) proFilter.value = 'pro';
        const event = new Event('change', { bubbles: true });
        proFilter.dispatchEvent(event);
    });
    await sleep(2000);
    
    // Reset filter
    await page.evaluate(() => {
        const filter = document.querySelector('#plan-filter');
        if (filter) filter.value = 'all';
        const event = new Event('change', { bubbles: true });
        filter.dispatchEvent(event);
    });
    await sleep(1000);
    
    // Scene 8: Scroll through more tools
    console.log('🎬 Scene 8: Scrolling through tools');
    await smoothScroll(page, 800);
    await sleep(1500);
    await smoothScroll(page, 600);
    await sleep(1500);
    
    // Scene 9: Back to top
    console.log('🎬 Scene 9: Final shot');
    await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await sleep(2000);
    
    // Stop recording
    await recorder.stop();
    console.log('\n✅ Recording stopped');
    
    await browser.close();
    
    // Check if file was created
    if (fs.existsSync(videoPath)) {
        const stats = fs.statSync(videoPath);
        console.log(`\n🎉 Demo video created successfully!`);
        console.log(`📁 Location: ${videoPath}`);
        console.log(`📦 Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    } else {
        console.log('\n❌ Failed to create video');
    }
}

// Helper functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function smoothScroll(page, distance) {
    await page.evaluate((dist) => {
        window.scrollBy({
            top: dist,
            behavior: 'smooth'
        });
    }, distance);
    await sleep(800);
}

async function typeWithEffect(page, text) {
    for (const char of text) {
        await page.keyboard.type(char);
        await sleep(100 + Math.random() * 100);
    }
}

// Run the demo creation
createToolsDemo().catch(console.error);
