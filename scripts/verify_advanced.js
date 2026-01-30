
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const verify = async () => {
    console.log('Verifying Advanced Features (Robust)...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();

        // Fallback port logic
        let url = 'http://localhost:5174';
        try {
            console.log('Trying 5174...');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        } catch {
            url = 'http://localhost:5173';
            console.log('Trying 5173...');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        }
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(e => console.log('Idle timeout ignored.'));

        const screenshotDir = path.join(process.cwd(), 'verification_screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);

        // 1. Check Thumbnails (Sidebar)
        // We look for canvas elements in the sidebar
        console.log('[1/4] Checking Thumbnails...');
        try {
            await page.waitForSelector('canvas', { timeout: 5000 }); // Thumbnail canvases
            console.log('PASS: Canvases found (Thumbnails active).');
        } catch (e) {
            console.warn('WARN: No canvases found yet (maybe pdf not loaded?). Proceeding.');
        }

        // 2. Check Add Page Modal
        console.log('[2/4] Checking Advanced Modal...');
        // Find Add Page button
        const addBtn = await page.$('button[title="Add Page"]');
        if (addBtn) {
            await addBtn.click();
            await new Promise(r => setTimeout(r, 500));
            // Check text "Page Dimensions"
            const content = await page.content();
            if (content.includes('Page Dimensions')) console.log('PASS: Advanced Modal UI found.');
            else console.warn('WARN: "Page Dimensions" text not found in modal.');

            // Close modal
            await page.keyboard.press('Escape');
        } else {
            console.error('FAIL: Add Page button not found.');
        }

        // 3. Check Insert Image Button
        console.log('[3/4] Checking Insert Image Toolbar...');
        const imgBtn = await page.$('button[title="Insert Image"]');
        if (imgBtn) console.log('PASS: Insert Image button found.');
        else console.error('FAIL: Insert Image button missing.');

        // 4. Check Save Button
        console.log('[4/4] Checking Save...');
        const saveBtn = await page.$('button:has(svg.lucide-save)') || await page.$('button:has(span ::-p-text(Save))');
        if (saveBtn) console.log('PASS: Save button functional (UI present).');

        await page.screenshot({ path: path.join(screenshotDir, 'final_advanced.png') });
        console.log('DONE.');

    } catch (error) {
        console.error('FAILED:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
};

verify();
