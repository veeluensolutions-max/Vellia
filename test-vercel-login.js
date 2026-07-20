const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log("Iniciando teste de login na Vercel...");
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        page.on('console', msg => console.log('LOG DO NAVEGADOR:', msg.text()));
        page.on('pageerror', err => console.log('ERRO DO NAVEGADOR:', err.toString()));

        await page.goto('https://velliacrm-qf1x5xgcf-veeluensolutions-maxs-projects.vercel.app', { waitUntil: 'domcontentloaded' });

        console.log("Preenchendo e-mail e senha...");
        await page.waitForSelector('#login-email');
        await page.type('#login-email', 'admin@vellia.com');
        await page.type('#login-password', '123456');

        console.log("Clicando em Acessar Plataforma...");
        await page.click('#btn-login-submit');

        await new Promise(r => setTimeout(r, 2000));

        const isAppShellVisible = await page.evaluate(() => {
            const appShell = document.getElementById('app-shell');
            return appShell ? getComputedStyle(appShell).display !== 'none' : false;
        });

        console.log("--> Tela Principal (App Shell) visível:", isAppShellVisible);

        if (isAppShellVisible) {
            console.log("✅ TESTE DE LOGIN REALIZADO COM SUCESSO!");
        } else {
            console.log("❌ LOGIN FALHOU.");
        }

        await browser.close();
    } catch (e) {
        console.error("Erro no script de teste:", e);
        process.exit(1);
    }
})();
