import re

with open('js/store.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace addLead
code = re.sub(
    r'addLead\(lead\)\s*\{\s*const leads = JSON\.parse\(localStorage\.getItem\("comercial_leads"\)\) \|\| \[\];',
    'addLead(lead) {\n        const leads = JSON.parse(localStorage.getItem("comercial_leads")) || [];\n        if (!lead.workspace) lead.workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";',
    code
)

# Replace addProposal
code = re.sub(
    r'addProposal\(proposal\)\s*\{\s*const proposals = JSON\.parse\(localStorage\.getItem\("comercial_proposals"\)\) \|\| \[\];',
    'addProposal(proposal) {\n        const proposals = JSON.parse(localStorage.getItem("comercial_proposals")) || [];\n        if (!proposal.workspace) proposal.workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";',
    code
)

# Replace addTask
code = re.sub(
    r'addTask\(task\)\s*\{\s*const tasks = JSON\.parse\(localStorage\.getItem\("comercial_tasks"\)\) \|\| \[\];',
    'addTask(task) {\n        const tasks = JSON.parse(localStorage.getItem("comercial_tasks")) || [];\n        if (!task.workspace) task.workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";',
    code
)

with open('js/store.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated js/store.js")
