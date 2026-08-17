const fs = require('fs');
let code = fs.readFileSync('js/store.js', 'utf8');

code = code.replace(/saveLeads\(leads\)\s*\{\n\s*localStorage\.setItem\("comercial_leads", JSON\.stringify\(leads\)\);\n\s*if \(Array\.isArray\(leads\)\) \{\n\s*for \(const lead of leads\) \{\n\s*upsertSupabase\("comercial_leads", lead\);\n\s*\}\n\s*\}\n\s*\}/, 
`saveLeads(workspaceLeads) {
        let allLeads = this.getLeadsRaw();
        const active = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        
        // Remove old ones from this workspace
        allLeads = allLeads.filter(l => {
            const w = l.workspace || "Veeluen Solutions";
            return w !== active;
        });
        
        // Add updated ones
        allLeads = allLeads.concat(workspaceLeads);
        
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        
        if (Array.isArray(workspaceLeads)) {
            for (const lead of workspaceLeads) {
                upsertSupabase("comercial_leads", lead);
            }
        }
    }`);

fs.writeFileSync('js/store.js', code);
console.log('done saveLeads');
