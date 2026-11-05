import { Store } from "./store.js";
import { hashPassword } from "./utils.js";

export const Auth = {
    async login(email, password) {
        if (!email || !password) {
            Store.addLog(email || "desconhecido", "LOGIN_ATTEMPT", "Tentativa de login sem preencher e-mail ou senha.", "WARN");
            return { success: false, error: "Por favor, preencha todos os campos." };
        }

        const emailLower = email.toLowerCase().trim();

        let user = Store.getUserByEmail(emailLower);

        if (!user) {
            try {
                await Store.syncFromSupabase();
                user = Store.getUserByEmail(emailLower);
            } catch(e) {}
        }

        if (!user) {
            Store.addLog(emailLower, "LOGIN_ATTEMPT", `Tentativa de login falhou: e-mail não cadastrado.`, "WARN");
            return { success: false, error: "Usuário ou senha incorretos." };
        }

        const inputHash = await hashPassword(password);
        const storedPassword = String(user.password || "");
        const isSha256 = storedPassword.length === 64 && /^[0-9a-f]{64}$/i.test(storedPassword);

        let passwordValid = false;
        if (isSha256) {
            passwordValid = storedPassword.toLowerCase() === inputHash.toLowerCase();
        } else {
            // Retrocompatibilidade: se a senha ainda estiver em texto puro, valida e migra para hash SHA-256
            passwordValid = storedPassword === password;
            if (passwordValid) {
                user.password = inputHash;
                const users = Store.getUsers();
                const uIdx = users.findIndex(u => u.id === user.id);
                if (uIdx !== -1) {
                    users[uIdx].password = inputHash;
                    Store.saveUsers(users);
                }
            }
        }

        if (!passwordValid) {
            Store.addLog(emailLower, "LOGIN_ATTEMPT", `Tentativa de login falhou: senha incorreta.`, "WARN");
            return { success: false, error: "Usuário ou senha incorretos." };
        }

        if (user.status === "inactive") {
            Store.addLog(emailLower, "LOGIN_ATTEMPT", `Tentativa de login falhou: conta inativa.`, "WARN");
            return { success: false, error: "Esta conta está inativa. Entre em contato com o administrador." };
        }

        // Limpar tentativas falhas em caso de sucesso
        localStorage.removeItem(`attempts_${emailLower}`);
        localStorage.removeItem(`lockout_${emailLower}`);

        // Atualizar data de último login
        const users = Store.getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
            users[idx].lastLoginAt = new Date().toISOString();
            Store.saveUsers(users);
        }

        const isMika = user.email && (user.email.toLowerCase().trim() === "mika@vellia.com" || (user.name && user.name.toLowerCase().includes("mika")));
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            companyAccess: user.companyAccess || (isMika ? "Excelência Ambiental" : "Ambas")
        };

        // Sessão temporária via sessionStorage (fecha a aba/navegador = exige login novamente)
        sessionStorage.setItem("comercial_session", JSON.stringify(sessionUser));
        localStorage.removeItem("comercial_session");
        Store.addLog(user.email, "USER_LOGIN", `Usuário ${user.name} efetuou login como ${this.getRoleLabel(user.role)}.`, "SUCCESS");

        return { success: true, user: sessionUser };
    },

    logout() {
        const user = this.getCurrentUser();
        if (user) {
            Store.addLog(user.email, "USER_LOGOUT", `Usuário ${user.name} saiu do sistema.`, "SUCCESS");
        }
        sessionStorage.removeItem("comercial_session");
        localStorage.removeItem("comercial_session");
        window.location.reload();
    },

    getCurrentUser() {
        try {
            // Sessão temporária ativa apenas enquanto a aba/navegador estiver aberto
            const session = sessionStorage.getItem("comercial_session");
            if (session) {
                return JSON.parse(session);
            }
            // Limpa resíduos legados do localStorage para impedir acesso sem login
            if (localStorage.getItem("comercial_session")) {
                localStorage.removeItem("comercial_session");
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    isAuthenticated() {
        return this.getCurrentUser() !== null;
    },

    getRoleLabel(role) {
        const labels = {
            admin: "Administrador",
            manager: "Gerente Comercial",
            seller: "Vendedor",
            operacional: "Operações"
        };
        return labels[role] || role;
    },

    // Verificação de permissão simples baseada em rotas
    canAccessRoute(role, route) {
        if (!role) return false;
        const roleLower = role.toLowerCase();
        if (roleLower === "admin") return true;

        const permissions = {
            admin: ["*"], // Administrador acessa tudo
            manager: ["dashboard", "clients", "crm", "kanban", "proposals", "contracts", "post-sales", "trash", "calculators", "isocinetica", "team", "goals", "services", "inspections", "calendar", "ai-agents"],
            gerente: ["dashboard", "clients", "crm", "kanban", "proposals", "contracts", "post-sales", "trash", "calculators", "isocinetica", "team", "goals", "services", "inspections", "calendar", "ai-agents"],
            seller: ["dashboard", "clients", "crm", "kanban", "proposals", "contracts", "post-sales", "trash", "calculators", "isocinetica", "goals", "inspections", "calendar", "ai-agents"],
            vendedor: ["dashboard", "clients", "crm", "kanban", "proposals", "contracts", "post-sales", "trash", "calculators", "isocinetica", "goals", "inspections", "calendar", "ai-agents"],
            operacional: ["dashboard", "calendar", "inspections"],
            operacoes: ["dashboard", "calendar", "inspections"],
            operacao: ["dashboard", "calendar", "inspections"]
        };

        const allowed = permissions[roleLower] || [];
        return allowed.includes(route);
    }
};
