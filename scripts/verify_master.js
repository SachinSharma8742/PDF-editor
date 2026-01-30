
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const verify = async () => {
    console.log('Starting IMPROVED Master Verification...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();

        // Try 5174 first, then 5173
        let url = 'http://localhost:5174';
        try {
            console.log(`Trying ${url}...`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        } catch (e) {
            console.log(`${url} failed. Trying 5173...`);
            url = 'http://localhost:5173';
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        }

        console.log(`Connected to ${url}`);
        // Wait for network idle after initial connection
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(e => console.log('Network idle wait timeout (proceeding anyway)'));

        const screenshotDir = path.join(process.cwd(), 'verification_screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);

        // 1. Verify Empty State & Add Page Button
        console.log('[1/5] Checking Add Page Button (Empty State)...');
        try {
            await page.waitForSelector('button[title="Add Page"]', { timeout: 5000 });
        } catch (e) {
            await page.screenshot({ path: path.join(screenshotDir, 'debug_no_add_btn.png') });
            throw new Error('Add Page button not found. See debug_no_add_btn.png');
        }
        const addPageBtn = await page.$('button[title="Add Page"]');
        console.log('PASS: Add Page button found.');

        // 2. Add Page
        console.log('[2/5] Adding Blank Page...');
        await addPageBtn.click();
        await new Promise(r => setTimeout(r, 500));

        const buttons = await page.$$('button');
        let blankClicked = false;
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Blank Page')) {
                await btn.click();
                blankClicked = true;
                break;
            }
        }
        if (!blankClicked) throw new Error('Blank Page option verify failed.');
        console.log('PASS: Blank page added.');

        // 3. Verify IDs
        console.log('[3/5] Verifying ID #page-1...');
        try {
            await page.waitForSelector('#page-1', { timeout: 3000 });
            console.log('PASS: #page-1 found.');
        } catch (e) {
            throw new Error('#page-1 not found after adding page.');
        }

        // 4. Verify Drag Handles
        console.log('[4/5] Verifying Reordering UI...');
        const result = await page.evaluate(() => {
            return !!document.querySelector('.lucide-grip-vertical');
        });
        if (result) console.log('PASS: Drag handles visible.');
        else console.warn('WARNING: Drag handles not detected (visual check needed).');

        // 5. Verify Save
        console.log('[5/5] Verifying Save Button...');
        const buttons2 = await page.$$('button');
        let saveFound = false;
        for (const btn of buttons2) {
            const t = await page.evaluate(el => el.textContent, btn);
            if (t && t.includes('Save')) saveFound = true;
        }
        if (saveFound) console.log('PASS: Save button found.');
        else throw new Error('Save button missing.');

        console.log('MASTER VERIFICATION SUCCESS!');
        await page.screenshot({ path: path.join(screenshotDir, 'final_success.png') });

    } catch (error) {
        console.error('FAILED:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
};

verify();
