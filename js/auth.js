import { Store } from "./store.js";

export const Auth = {
    login(email, password) {
        if (!email || !password) {
            Store.addLog(email || "desconhecido", "LOGIN_ATTEMPT", "Tentativa de login sem preencher e-mail ou senha.", "WARN");
            return { success: false, error: "Por favor, preencha todos os campos." };
        }

        const user = Store.getUserByEmail(email);

        if (!user) {
            Store.addLog(email, "LOGIN_ATTEMPT", `Tentativa de login falhou: e-mail não cadastrado.`, "WARN");
            return { success: false, error: "Usuário ou senha incorretos." };
        }

        if (user.password !== password) {
            Store.addLog(email, "LOGIN_ATTEMPT", `Tentativa de login falhou: senha incorreta.`, "WARN");
            return { success: false, error: "Usuário ou senha incorretos." };
        }

        if (user.status === "inactive") {
            Store.addLog(email, "LOGIN_ATTEMPT", `Tentativa de login falhou: conta inativa.`, "WARN");
            return { success: false, error: "Esta conta está inativa. Entre em contato com o administrador." };
        }

        // Atualizar data de último login
        const users = Store.getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
            users[idx].lastLoginAt = new Date().toISOString();
            Store.saveUsers(users);
        }

        // Criar sessão (sem persistir a senha na sessão por segurança)
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar
        };

        localStorage.setItem("comercial_session", JSON.stringify(sessionUser));
        Store.addLog(user.email, "USER_LOGIN", `Usuário ${user.name} efetuou login como ${this.getRoleLabel(user.role)}.`, "SUCCESS");

        return { success: true, user: sessionUser };
    },

    logout() {
        const user = this.getCurrentUser();
        if (user) {
            Store.addLog(user.email, "USER_LOGOUT", `Usuário ${user.name} saiu do sistema.`, "SUCCESS");
        }
        localStorage.removeItem("comercial_session");
        window.location.reload();
    },

    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem("comercial_session")) || null;
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
            seller: "Vendedor"
        };
        return labels[role] || role;
    },

    // Verificação de permissão simples baseada em rotas
    canAccessRoute(role, route) {
        const permissions = {
            admin: ["*"], // Administrador acessa tudo
            manager: ["dashboard", "crm", "kanban", "proposals", "team", "goals", "services", "forecast", "inspections", "calendar", "ai-agents"],
            seller: ["dashboard", "crm", "kanban", "proposals", "goals", "inspections", "calendar", "ai-agents"]
        };

        if (role === "admin") return true;

        const allowed = permissions[role] || [];
        return allowed.includes(route);
    }
};
