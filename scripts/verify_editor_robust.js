
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    console.log('Starting Robust Verification...');
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Catch-all error handler
    page.on('error', err => console.error('Page error:', err));
    page.on('pageerror', err => console.error('Page error:', err));

    try {
        console.log('1. Navigating...');
        await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(3000);

        await page.screenshot({ path: path.join(__dirname, '1_loaded.png') });
        console.log('   Stats: Loaded screenshot taken.');

        // 2. Click Edit Button
        console.log('2. Search/Click Edit Page button...');
        // Find button containing the .lucide-pencil class or text "Edit Page"
        const btnClicked = await page.evaluate(async () => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Debug log
            console.log('Buttons found:', buttons.length);

            // Strategy 1: .lucide-pencil
            const pencil = document.querySelector('.lucide-pencil');
            if (pencil) {
                const btn = pencil.closest('button');
                if (btn) {
                    btn.click();
                    return 'clicked_pencil_icon';
                }
            }
            return 'not_found';
        });

        if (btnClicked === 'not_found') {
            throw new Error('Edit Page button not found!');
        }
        console.log('   Action: Clicked Edit Button (' + btnClicked + ')');
        await delay(3000); // Wait for transition

        // 3. Verify Editor Mode
        console.log('3. Verifying Editor Mode...');
        await page.screenshot({ path: path.join(__dirname, '2_editor_open.png') });

        // Check for "Done" button or specific Editor elements
        const editorActive = await page.evaluate(() => {
            // Check for specific text "Done" in buttons
            const buttons = Array.from(document.querySelectorAll('button'));
            const doneBtn = buttons.find(b => b.textContent.includes('Done'));
            if (doneBtn) return 'found_done_button';

            // Check for EditorToolbar
            if (document.querySelector('.EditorToolbar') || document.querySelector('input[type="file"]')) return 'found_file_input_or_toolbar';

            return 'not_found';
        });

        console.log('   Result: Editor State = ' + editorActive);

        // 4. Click Image Tool
        console.log('4. Clicking Image Tool...');
        // In EditorToolbar, we added input[type="file"] and buttons.
        // The image button has title="Image"
        await page.evaluate(() => {
            const imgBtn = document.querySelector('button[title="Image"]');
            if (imgBtn) imgBtn.click();
        });

        await delay(1000);
        await page.screenshot({ path: path.join(__dirname, '3_image_tool_clicked.png') });
        console.log('   Stats: Image tool screenshot taken.');

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
        await page.screenshot({ path: path.join(__dirname, 'error_state.png') });
    } finally {
        await browser.close();
        console.log('Verification Finished.');
    }
})();
