const fs = require('fs');
let code = fs.readFileSync('js/store.js', 'utf8');

// Lead
code = code.replace(/getLeads\(\)\s*\{\n\s*return JSON\.parse\(localStorage\.getItem\("comercial_leads"\)\) \|\| \[\];\n\s*\}/g,
`getLeadsRaw() { return JSON.parse(localStorage.getItem("comercial_leads")) || []; },
    getLeads() {
        const all = this.getLeadsRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => !x.workspace || x.workspace === active);
    }`);

code = code.replace(/const leads = this\.getLeads\(\);/g, "const leads = this.getLeadsRaw();");
// But wait, the UI calls getLeads(), so we need to make sure updateLead, deleteLead, addLead etc use getLeadsRaw() internally.
// `this.getLeadsRaw()` will be used instead of `this.getLeads()` for state mutations!

// Proposal
code = code.replace(/getProposals\(\)\s*\{\n\s*return JSON\.parse\(localStorage\.getItem\("comercial_proposals"\)\) \|\| \[\];\n\s*\}/g,
`getProposalsRaw() { return JSON.parse(localStorage.getItem("comercial_proposals")) || []; },
    getProposals() {
        const all = this.getProposalsRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => !x.workspace || x.workspace === active);
    }`);
code = code.replace(/const proposals = this\.getProposals\(\);/g, "const proposals = this.getProposalsRaw();");

// Task
code = code.replace(/getTasks\(\)\s*\{\n\s*return JSON\.parse\(localStorage\.getItem\("comercial_tasks"\)\) \|\| \[\];\n\s*\}/g,
`getTasksRaw() { return JSON.parse(localStorage.getItem("comercial_tasks")) || []; },
    getTasks() {
        const all = this.getTasksRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => !x.workspace || x.workspace === active);
    }`);
code = code.replace(/const tasks = this\.getTasks\(\);/g, "const tasks = this.getTasksRaw();");

// Calendar
code = code.replace(/getCalendarEvents\(\)\s*\{\n\s*return JSON\.parse\(localStorage\.getItem\("vellia_calendar_events"\)\) \|\| \[\];\n\s*\}/g,
`getCalendarEventsRaw() { return JSON.parse(localStorage.getItem("vellia_calendar_events")) || []; },
    getCalendarEvents() {
        const all = this.getCalendarEventsRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(x => !x.workspace || x.workspace === active);
    }`);
code = code.replace(/const events = this\.getCalendarEvents\(\);/g, "const events = this.getCalendarEventsRaw();");


fs.writeFileSync('js/store.js', code);
console.log('done modifying getters in store.js');
