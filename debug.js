const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/#integrations', {waitUntil: 'networkidle0'});
  
  // click login if needed
  if (await page.$('#login-email')) {
    await page.click('[data-email="admin@vellia.com"]');
    await new Promise(r => setTimeout(r, 1000));
    await page.goto('http://127.0.0.1:8080/#integrations', {waitUntil: 'networkidle0'});
  }

  const rects = await page.evaluate(() => {
    const getRect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {id: sel, y: r.y, height: r.height, display: window.getComputedStyle(el).display};
    };
    return [
        getRect('.main-panel'),
        getRect('.app-header'),
        getRect('.app-content'),
        getRect('#view-integrations'),
        getRect('#dashboard-exec')
    ];
  });
  console.log(JSON.stringify(rects, null, 2));
  await browser.close();
})();
