import re

with open('js/store.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update Schemas
code = re.sub(r"comercial_leads:\s*\['id',\s*'company',", "comercial_leads: ['id', 'workspace', 'company',", code)
code = re.sub(r"comercial_proposals:\s*\['id',\s*'leadId',", "comercial_proposals: ['id', 'workspace', 'leadId',", code)
code = re.sub(r"comercial_tasks:\s*\['id',\s*'owner',", "comercial_tasks: ['id', 'workspace', 'owner',", code)
code = re.sub(r"comercial_calendar_events:\s*\['id',\s*'title',", "comercial_calendar_events: ['id', 'workspace', 'title',", code)

# 2. addLead
code = re.sub(
    r'addLead\(lead\)\s*\{\s*const leads = JSON\.parse\(localStorage\.getItem\("comercial_leads"\)\) \|\| \[\];\s*leads\.push\(lead\);',
    'addLead(lead) {\n        const leads = JSON.parse(localStorage.getItem("comercial_leads")) || [];\n        if (!lead.workspace) lead.workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";\n        leads.push(lead);',
    code
)

# 3. addProposal
code = re.sub(
    r'addProposal\(proposal\)\s*\{\s*const proposals = JSON\.parse\(localStorage\.getItem\("comercial_proposals"\)\) \|\| \[\];\s*proposals\.push\(proposal\);',
    'addProposal(proposal) {\n        const proposals = JSON.parse(localStorage.getItem("comercial_proposals")) || [];\n        if (!proposal.workspace) proposal.workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";\n        proposals.push(proposal);',
    code
)

# 4. addTask
code = re.sub(
    r'addTask\(task\)\s*\{\s*const tasks = JSON\.parse\(localStorage\.getItem\("comercial_tasks"\)\) \|\| \[\];\s*tasks\.push\(task\);',
    'addTask(task) {\n        const tasks = JSON.parse(localStorage.getItem("comercial_tasks")) || [];\n        if (!task.workspace) task.workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";\n        tasks.push(task);',
    code
)

# 5. saveCalendarEvents
code = re.sub(
    r'saveCalendarEvents\(events\)\s*\{\s*localStorage\.setItem\("vellia_calendar_events",\s*JSON\.stringify\(events\)\);',
    'saveCalendarEvents(events) {\n        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";\n        events.forEach(e => { if(!e.workspace) e.workspace = activeCompany; });\n        localStorage.setItem("vellia_calendar_events", JSON.stringify(events));',
    code
)

with open('js/store.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated js/store.js")
