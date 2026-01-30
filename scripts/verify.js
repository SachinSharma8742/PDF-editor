
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const verify = async () => {
    console.log('Starting Targeted Verification (Empty State)...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });

        const screenshotDir = path.join(process.cwd(), 'verification_screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);

        // 1. Check for Add Page button in Sidebar (Critical Fix)
        const addPageBtn = await page.$('button[title="Add Page"]');
        if (addPageBtn) {
            console.log('PASS: Add Page button found in empty state.');
            await page.screenshot({ path: path.join(screenshotDir, '5_empty_state_with_add.png') });
        } else {
            console.error('FAIL: Add Page button NOT found in empty state.');
        }

        // 2. Check for "No PDF loaded" message
        const emptyMsg = await page.$('div ::-p-text(No pages.)');
        if (emptyMsg) {
            console.log('PASS: "No pages." message visible.');
        }

        console.log('Verification Complete.');

    } catch (error) {
        console.error('Verification FAILED:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
};

verify();
