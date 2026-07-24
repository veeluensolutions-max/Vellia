const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log("Iniciando teste de login detalhado na porta 3000...");
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        page.on('console', msg => console.log('LOG DO NAVEGADOR:', msg.type(), msg.text()));
        page.on('pageerror', err => console.log('ERRO DO NAVEGADOR:', err.toString()));
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`FALHA NA REQUISIÇÃO [${response.status()}]: ${response.url()}`);
            }
        });

        await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle2' });

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
            console.log("✅ TESTE DE LOGIN LOCAL REALIZADO COM SUCESSO!");
        } else {
            console.log("❌ LOGIN FALHOU.");
        }

        await browser.close();
    } catch (e) {
        console.error("Erro no script de teste:", e);
        process.exit(1);
    }
})();
