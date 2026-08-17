const fs = require('fs');

// 1. Fix app.js for 'operacional' role visibility
let appJs = fs.readFileSync('js/app.js', 'utf8');
appJs = appJs.replace(
    /\} else if \(role === "seller"\) \{[\s\S]*?isVisible = !\["logs", "team", "services", "integrations", "users"\].includes\(viewName\);\s*\}/,
    `} else if (role === "seller") {
            // Vendedor vê CRM, Kanban, Propostas e IA. Não vê Logs, Equipe, Serviços, Integrações e Usuários.
            isVisible = !["logs", "team", "services", "integrations", "users"].includes(viewName);
        } else if (role === "operacional") {
            // Operacional vê apenas o Calendário e Dashboard
            isVisible = ["calendar", "dashboard"].includes(viewName);
        }`
);
fs.writeFileSync('js/app.js', appJs);

// 2. Fix users.js for 'operacional' styling
let usersJs = fs.readFileSync('js/users.js', 'utf8');
usersJs = usersJs.replace(
    /seller: \{\s*label: "Vendedor",\s*bg: "rgba\(100, 116, 139, 0\.10\)",\s*color: "var\(--text-secondary\)",\s*border: "rgba\(100, 116, 139, 0\.2\)"\s*\}/,
    `seller: {
        label: "Vendedor",
        bg: "rgba(100, 116, 139, 0.10)",
        color: "var(--text-secondary)",
        border: "rgba(100, 116, 139, 0.2)"
    },
    operacional: {
        label: "Operacional",
        bg: "rgba(245, 158, 11, 0.12)",
        color: "#d97706",
        border: "rgba(245, 158, 11, 0.25)"
    }`
);

usersJs = usersJs.replace(
    /seller: "linear-gradient\(135deg, #0ea5e9, #06b6d4\)"/,
    `seller: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
    operacional: "linear-gradient(135deg, #f59e0b, #d97706)"`
);

fs.writeFileSync('js/users.js', usersJs);

console.log('done fixing operacional');
