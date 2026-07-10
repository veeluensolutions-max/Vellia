const fs = require('fs');
const file = 'c:/Users/USUÁRIO/OneDrive/Área de Trabalho/Campanha A/js/integrations.js';
const buf = fs.readFileSync(file);
const str = buf.toString('latin1');
const idx = str.indexOf('window.simulateMetaLead');
if (idx > -1) {
    const validPart = buf.slice(0, idx);
    fs.writeFileSync(file, validPart);
    
    const appendStr = `
window.simulateMetaLead = function() {
    import('./store.js').then(module => {
        const Store = module.Store;
        const leads = Store.getLeads();
        
        const newLead = {
            id: 'L' + Date.now(),
            name: 'Lead Simulado (Meta Ads)',
            email: 'simulado.meta@exemplo.com',
            phone: '(11) 9' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
            company: '-',
            segment: 'Varejo',
            owner: 'admin@vellia.com',
            stage: 'Contato',
            source: 'Meta Ads',
            date: new Date().toISOString()
        };
        
        leads.unshift(newLead);
        Store.saveLeads(leads);
        
        // Registrar log
        const logs = Store.getLogs();
        logs.unshift({
            id: 'log-' + Date.now(),
            date: new Date().toISOString(),
            user: 'Sistema Webhook',
            action: 'LEAD_RECEIVED',
            details: \`Lead recebido via Meta Ads: \${newLead.name}\`
        });
        Store.saveLogs(logs);

        // Atualizar contador na tela se existir
        const countSpan = document.getElementById('meta-leads-count');
        if (countSpan) {
            countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }

        alert('Lead simulado recebido com sucesso! Vá para a tela de Contatos para visualizá-lo.');
    });
};
`;
    fs.appendFileSync(file, appendStr, 'utf8');
    console.log('Fixed encoding!');
}
