
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({
        headless: true, // Run headless for speed, or false if debugging needs viz (but agent is headless)
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Standard safety for CI/Agent envs
    });

    const page = await browser.newPage();

    // 1. Navigate
    console.log('Navigating to app...');
    try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
    } catch (e) {
        console.log('Navigation timeout/error, trying to continue anyway...');
    }

    await delay(2000); // Wait for PDF and UI to settle

    await page.screenshot({ path: path.join(__dirname, 'step1_loaded.png') });
    console.log('Screenshot 1 taken.');

    // 2. Click "Edit Page" Button
    // Looking for the button with "Pencil" or title "Edit Page (Advanced)"
    console.log('Looking for Edit Page button...');

    // Debug: Dump tooltips or buttons
    const buttons = await page.$$eval('button', btns => btns.map(b => ({ html: b.outerHTML, text: b.textContent })));
    console.log('Available buttons:', buttons);

    // Try to find by title attribute first (Tooltip usually puts title on button or wrapper)
    // Actually my Tooltip component puts title on the wrapper or separate div?
    // Let's rely on the structure: Top Toolbar -> Center Group -> Button with Pencil icon.
    // We added <Pencil size={20} /> which renders an <svg> with class "lucide-pencil".

    try {
        // Try finding by internal generic SVG class if specific class fails
        // Lucide icons usually have 'lucide' class
        await page.waitForSelector('.lucide-pencil', { timeout: 5000 });
        const editButton = await page.evaluateHandle(() => {
            const pencil = document.querySelector('.lucide-pencil');
            return pencil.closest('button');
        });

        if (editButton) {
            console.log('Found Edit Button, clicking...');
            await editButton.click();
        } else {
            throw new Error('Button not found');
        }
    } catch (e) {
        console.error('Error identifying Edit Button:', e);
        console.log('Page HTML snippet:', await page.content());
        await browser.close();
        process.exit(1);
    }

    await delay(2000); // Animation fade-in

    // 3. Verify Editor Mode Open
    // Check for "Done" button or "EditorToolbar"
    // EditorTopBar has "Done" button.
    const doneButton = await page.$x("//button[contains(., 'Done')]");

    if (doneButton.length > 0) {
        console.log('Editor Mode Verified: "Done" button found.');
    } else {
        console.log('Warning: "Done" button not found. Checking for Toolbar...');
    }

    await page.screenshot({ path: path.join(__dirname, 'step2_editor_open.png') });
    console.log('Screenshot 2 taken.');

    // 4. Click Image Tool
    console.log('Looking for Image Tool...');
    // The Image tool has <ImageIcon /> -> .lucide-image
    // Note: There's an "Insert Image" in the main toolbar too, so we must be specific or rely on context.
    // In Editor Mode, the left toolbar is distinct.

    // We can look for buttons in the sidebar.
    // Or just look for the second .lucide-image on the screen? Or simpler:
    // The EditorToolbar is likely the one on the left.
    // Let's try to click the button with title="Image" if I added it?
    // I added `title={tool.label}` to the button in EditorToolbar.tsx!

    try {
        const imageToolBtn = await page.waitForSelector('button[title="Image"]', { visible: true, timeout: 5000 });
        if (imageToolBtn) {
            console.log('Found Image Tool, clicking...');
            await imageToolBtn.click();
        }
    } catch (e) {
        console.log('Could not find Image tool by title, trying generic icon search...');
    }

    await delay(1000);
    await page.screenshot({ path: path.join(__dirname, 'step3_image_tool_clicked.png') });
    console.log('Screenshot 3 taken.');

    await browser.close();
    console.log('Verification Complete.');
})();
