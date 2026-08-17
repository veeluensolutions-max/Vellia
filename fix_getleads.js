const fs = require('fs');
let code = fs.readFileSync('js/store.js', 'utf8');

// 1. Replace getLeadsRaw with getAllLeadsRaw
code = code.replace(/this\.getLeadsRaw\(\)/g, 'this.getAllLeadsRaw()');

// 2. Fix getLeads() filter
code = code.replace(
    /return allLeads\.filter\(l => !l\.deleted_at\);/g,
    'const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";\n        return allLeads.filter(l => !l.deleted_at && (!l.workspace || l.workspace === activeCompany));'
);

// 3. Let's make sure Proposals, Tasks and Calendar use their Raw counterparts inside mutators!
// Wait, I created getProposalsRaw() but the mutators are still using getProposalsRaw?
// Let's ensure my update_getters.js script worked correctly for proposals.

fs.writeFileSync('js/store.js', code);
console.log('done fixing getLeads filter');
