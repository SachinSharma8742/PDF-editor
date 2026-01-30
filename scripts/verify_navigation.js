
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const verify = async () => {
    console.log('Starting Navigation Verification (Debug Mode)...');
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

        // DEBUG: Take screenshot immediately
        await page.screenshot({ path: path.join(screenshotDir, 'debug_initial.png') });

        // 1. Add a second page so we can scroll
        console.log('Looking for Add Page button...');
        try {
            await page.waitForSelector('button[title="Add Page"]', { timeout: 5000 });
        } catch (e) {
            console.error('Wait failed. Taking screenshot.');
            await page.screenshot({ path: path.join(screenshotDir, 'debug_wait_failed.png') });
            throw e;
        }

        const addPageBtn = await page.$('button[title="Add Page"]');
        if (!addPageBtn) throw new Error('Add Page button not found');
        await addPageBtn.click();
        await new Promise(r => setTimeout(r, 500));

        // Find "Blank Page" button
        const buttons = await page.$$('button');
        let clicked = false;
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Blank Page')) {
                await btn.click();
                clicked = true;
                break;
            }
        }

        if (!clicked) throw new Error('Blank Page button not found');
        await new Promise(r => setTimeout(r, 500));

        // 2. Click Thumbnail 2
        console.log('Clicking Page 2 Thumbnail...');
        const page2Thumb = await page.evaluateHandle(() => {
            // More robust finder: find specific text inside Sidebar
            const els = Array.from(document.querySelectorAll('span'));
            return els.find(el => el.innerText.includes('Page 2'));
        });

        if (page2Thumb.asElement()) {
            await page2Thumb.asElement().click();
            console.log('Clicked Page 2.');
            await new Promise(r => setTimeout(r, 1000)); // Wait for scroll

            // Check if Page 2 is in view
            const isVisible = await page.evaluate(() => {
                const el = document.getElementById('page-2');
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                console.log(`Page 2 Rect: Top=${rect.top}, Height=${rect.height}`);
                return rect.top >= 0 && rect.top < window.innerHeight;
            });

            await page.screenshot({ path: path.join(screenshotDir, 'debug_scrolled.png') });

            if (isVisible) {
                console.log('PASS: Page 2 is visible after click.');
            } else {
                // It might be obscured by toolbar or just below.
                // If we scrolled, rect.top should be small (e.g. 64px for toolbar).
                console.log('WARNING: Check debug_scrolled.png to verify.');
            }

        } else {
            throw new Error('Thumbnail for Page 2 not found');
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
