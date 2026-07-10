const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR:', response.status(), response.url());
    }
  });

  await page.goto('http://127.0.0.1:8080/#integrations', {waitUntil: 'networkidle0'});
  
  await page.evaluate(() => {
    document.getElementById('login-email').value = 'admin@vellia.com';
    document.getElementById('login-password').value = 'admin123';
    document.querySelector('#login-form button').click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
