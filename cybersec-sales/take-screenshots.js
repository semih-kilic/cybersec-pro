const puppeteer = require('puppeteer');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'frontend/screenshots');
const BASE_URL = 'http://localhost:5173';

const screenshots = [
    { name: '01-dashboard-overview', url: '/', wait: 3000, description: 'Dashboard Overview - 690 Tools' },
    { name: '02-tools-list', url: '/tools', wait: 3000, description: 'Security Tools Catalog' },
    { name: '03-tool-categories', url: '/tools?category=Information%20Gathering', wait: 2000, description: 'Tool Categories' },
    { name: '04-tool-detail-nmap', url: '/tools/nmap', wait: 2000, description: 'Nmap Tool Detail' },
    { name: '05-tool-detail-metasploit', url: '/tools/metasploit', wait: 2000, description: 'Metasploit Framework' },
    { name: '06-tool-detail-burpsuite', url: '/tools/burpsuite', wait: 2000, description: 'Burp Suite Professional' },
    { name: '07-terminal-interface', url: '/terminal', wait: 2000, description: 'Terminal Interface' },
    { name: '08-scans-management', url: '/scans', wait: 2000, description: 'Scans Management' },
    { name: '09-vulnerability-reports', url: '/reports', wait: 2000, description: 'Vulnerability Reports' },
    { name: '10-system-settings', url: '/settings', wait: 2000, description: 'System Settings' },
    { name: '11-api-documentation', url: '/api-docs', wait: 2000, description: 'API Documentation' },
    { name: '12-tool-statistics', url: '/stats', wait: 2000, description: 'Tool Statistics - 59% Coverage' }
];

// Helper function for waiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshots() {
    console.log('🚀 Starting screenshot capture...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    for (const shot of screenshots) {
        try {
            console.log(`📸 Capturing: ${shot.description}...`);
            await page.goto(`${BASE_URL}${shot.url}`, { waitUntil: 'networkidle0', timeout: 30000 });
            await delay(shot.wait);
            
            const filepath = path.join(SCREENSHOTS_DIR, `${shot.name}.png`);
            await page.screenshot({ path: filepath, fullPage: false });
            console.log(`   ✅ Saved: ${shot.name}.png`);
        } catch (error) {
            console.log(`   ❌ Failed: ${shot.description} - ${error.message}`);
        }
    }
    
    await browser.close();
    console.log('\n✨ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

takeScreenshots().catch(console.error);
