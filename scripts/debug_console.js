
import puppeteer from 'puppeteer';

const verify = async () => {
    console.log('Debugging Console Errors...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
        page.on('requestfailed', request => {
            console.log(`REQUEST FAILED: ${request.url()} ${request.failure().errorText}`);
        });

        try {
            await page.goto('http://localhost:5174', { waitUntil: 'networkidle0', timeout: 10000 });
        } catch (e) {
            console.log('Navigation timeout (expected if crashed specific way)');
        }

        console.log('Waiting for potential errors...');
        await new Promise(r => setTimeout(r, 2000));

        await browser.close();

    } catch (error) {
        console.error('Debug FAILED:', error);
        process.exit(1);
    }
};

verify();
