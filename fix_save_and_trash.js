const fs = require('fs');
let code = fs.readFileSync('js/store.js', 'utf8');

// Fix getTrashLeads
code = code.replace(/getTrashLeads\(\)\s*\{[\s\S]*?return this\.getAllLeadsRaw\(\)\.filter\(l => \{[\s\S]*?\}\);\s*\}/, 
`getTrashLeads() {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return this.getAllLeadsRaw().filter(l => {
            if (!l.deleted_at) return false;
            if (l.workspace && l.workspace !== activeCompany && activeCompany !== "Veeluen Solutions") return false;
            // Legacy items without workspace go to Veeluen
            if (!l.workspace && activeCompany !== "Veeluen Solutions") return false;
            
            const deletedTs = new Date(l.deleted_at).getTime();
            return (now - deletedTs) < THIRTY_DAYS_MS; 
        });
    }`);

// Fix saveLeads
code = code.replace(/saveLeads\(leads\)\s*\{[\s\S]*?localStorage\.setItem\("comercial_leads", JSON\.stringify\(leads\)\);[\s\S]*?if \(Array\.isArray\(leads\)\)\s*\{[\s\S]*?for \(const lead of leads\)\s*\{[\s\S]*?upsertSupabase\("comercial_leads", lead\);\s*\}\s*\}\s*\}/, 
`saveLeads(workspaceLeads) {
        let allLeads = this.getAllLeadsRaw();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        
        // Remove leads from active company from allLeads
        allLeads = allLeads.filter(l => {
            const w = l.workspace || "Veeluen Solutions";
            return w !== activeCompany;
        });
        
        // Add updated leads
        allLeads = allLeads.concat(workspaceLeads);
        
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        if (Array.isArray(workspaceLeads)) {
            for (const lead of workspaceLeads) {
                upsertSupabase("comercial_leads", lead);
            }
        }
    }`);

fs.writeFileSync('js/store.js', code);
console.log('done fixing saveLeads and getTrashLeads');
