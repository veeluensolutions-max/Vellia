const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
        
        await page.goto('https://velliacrm.vercel.app', { waitUntil: 'networkidle0' });

        // wait for preset buttons
        await page.waitForSelector('.preset-btn-new[data-email="admin@vellia.com"]');
        
        console.log("Clicking login button...");
        await page.click('.preset-btn-new[data-email="admin@vellia.com"]');
        
        await new Promise(r => setTimeout(r, 2000));
        
        await page.screenshot({ path: 'login_attempt.png' });
        console.log("Screenshot saved to login_attempt.png");
        
        const hash = await page.evaluate(() => window.location.hash);
        console.log("Current hash after login:", hash);
        
        const isLoginVisible = await page.evaluate(() => {
            return document.getElementById('login-screen').style.display !== 'none';
        });
        console.log("Is Login Screen still visible:", isLoginVisible);
        
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
