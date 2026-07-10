const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle0' });

        // log in
        await page.waitForSelector('#login-email');
        await page.click('.preset-btn-new[data-email="admin@vellia.com"]');
        await new Promise(r => setTimeout(r, 1000));

        // goto integrations
        await page.goto('http://127.0.0.1:8080/#integrations', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));

        const data = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            let largestEmpty = null;
            let largestHeight = 0;

            const res = {};
            ['.main-panel', '.app-header', '.app-content', '#view-dashboard', '#view-ai', '#view-integrations', '#integrations-container'].forEach(sel => {
                const el = document.querySelector(sel);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    res[sel] = { 
                        display: window.getComputedStyle(el).display, 
                        y: rect.y, 
                        height: rect.height,
                        x: rect.x,
                        width: rect.width
                    };
                }
            });
            return res;
        });

        console.log(JSON.stringify(data, null, 2));
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
