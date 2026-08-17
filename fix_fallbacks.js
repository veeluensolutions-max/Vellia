const fs = require('fs');
let code = fs.readFileSync('js/store.js', 'utf8');

// 1. Fix getLeads
code = code.replace(
    /return allLeads\.filter\(l => !l\.deleted_at && \(!l\.workspace \|\| l\.workspace === activeCompany\)\);/,
    'return allLeads.filter(l => {\n            if(l.deleted_at) return false;\n            const w = l.workspace || "Veeluen Solutions";\n            return w === activeCompany;\n        });'
);

// 2. Fix getProposals
code = code.replace(
    /getProposals\(\) \{\s*const all = this\.getProposalsRaw\(\);\s*const active = localStorage\.getItem\("activeCompany"\) \|\| "Veeluen Solutions";\s*return all\.filter\(x => !x\.workspace \|\| x\.workspace === active\);\s*\}/,
    `getProposals() {
        const all = this.getProposalsRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => {
            const w = x.workspace || "Veeluen Solutions";
            return w === active;
        });
    }`
);

// 3. Fix getTasks
code = code.replace(
    /getTasks\(\) \{\s*const all = this\.getTasksRaw\(\);\s*const active = localStorage\.getItem\("activeCompany"\) \|\| "Veeluen Solutions";\s*return all\.filter\(x => !x\.workspace \|\| x\.workspace === active\);\s*\}/,
    `getTasks() {
        const all = this.getTasksRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => {
            const w = x.workspace || "Veeluen Solutions";
            return w === active;
        });
    }`
);

// 4. Fix getCalendarEvents
code = code.replace(
    /getCalendarEvents\(\) \{\s*const all = this\.getCalendarEventsRaw\(\);\s*const active = localStorage\.getItem\("activeCompany"\) \|\| "Veeluen Solutions";\s*return all\.filter\(x => !x\.workspace \|\| x\.workspace === active\);\s*\}/,
    `getCalendarEvents() {
        const all = this.getCalendarEventsRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => {
            const w = x.workspace || "Veeluen Solutions";
            return w === active;
        });
    }`
);

fs.writeFileSync('js/store.js', code);
console.log('done fixing fallbacks');
