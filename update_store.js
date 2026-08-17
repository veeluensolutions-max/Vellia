const fs = require('fs');
const code = fs.readFileSync('js/store.js', 'utf8');

let out = code.replace(/comercial_leads:\s*\['id',\s*'company',/g, "comercial_leads: ['id', 'workspace', 'company',");
out = out.replace(/comercial_proposals:\s*\['id',\s*'leadId',/g, "comercial_proposals: ['id', 'workspace', 'leadId',");
out = out.replace(/comercial_tasks:\s*\['id',\s*'owner',/g, "comercial_tasks: ['id', 'workspace', 'owner',");
out = out.replace(/comercial_calendar_events:\s*\['id',\s*'title',/g, "comercial_calendar_events: ['id', 'workspace', 'title',");

out = out.replace(/id: `lead_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`,/, "id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,\n            workspace: localStorage.getItem('activeCompany') || 'Veeluen Solutions',");

out = out.replace(/id: `prop_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`,/, "id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,\n            workspace: localStorage.getItem('activeCompany') || 'Veeluen Solutions',");

out = out.replace(/id: `task_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 5\)\}`,/, "id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,\n            workspace: localStorage.getItem('activeCompany') || 'Veeluen Solutions',");

out = out.replace(/saveCalendarEvents\(events\)\s*\{\n\s*localStorage\.setItem\("vellia_calendar_events",\s*JSON\.stringify\(events\)\);/, "saveCalendarEvents(events) {\n        const activeCompany = localStorage.getItem('activeCompany') || 'Veeluen Solutions';\n        events.forEach(e => { if(!e.workspace) e.workspace = activeCompany; });\n        localStorage.setItem('vellia_calendar_events', JSON.stringify(events));");

fs.writeFileSync('js/store.js', out);
console.log('done');
