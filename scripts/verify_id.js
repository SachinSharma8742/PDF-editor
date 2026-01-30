
import puppeteer from 'puppeteer';

const verify = async () => {
    console.log('Checking Page IDs...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });

        // Add a blank page to ensure at least one page exists (if none loaded)
        const addPageBtn = await page.$('button[title="Add Page"]');
        if (addPageBtn) {
            await addPageBtn.click();
            await new Promise(r => setTimeout(r, 200));
            const buttons = await page.$$('button');
            for (const btn of buttons) {
                const t = await page.evaluate(el => el.textContent, btn);
                if (t && t.includes('Blank')) { await btn.click(); break; }
            }
            await new Promise(r => setTimeout(r, 500));
        }

        // Check if #page-1 exists
        const page1 = await page.$('#page-1');
        if (page1) {
            console.log('PASS: Found element with id="page-1". Navigation scroll should work.');
        } else {
            throw new Error('Element #page-1 NOT found.');
        }

        console.log('Verification Success.');

    } catch (error) {
        console.error('Verification FAILED:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
};

verify();
