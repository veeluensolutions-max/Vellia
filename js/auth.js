import { Store } from "./store.js";

export const Auth = {
    login(email, password) {
        if (!email || !password) {
            Store.addLog(email || "desconhecido", "LOGIN_ATTEMPT", "Tentativa de login sem preencher e-mail ou senha.", "WARN");
            return { success: false, error: "Por favor, preencha todos os campos." };
        }

        const emailLower = email.toLowerCase().trim();

        // Verificar se há lockout ativo
        const lockoutUntil = localStorage.getItem(`lockout_${emailLower}`);
        if (lockoutUntil) {
            const remaining = Math.ceil((new Date(lockoutUntil) - new Date()) / 1000);
            if (remaining > 0) {
                Store.addLog(emailLower, "LOGIN_ATTEMPT", `Tentativa de login bloqueada: lockout ativo (${remaining}s restantes).`, "WARN");
                return { success: false, error: `Muitas tentativas incorretas. Login bloqueado por ${remaining}s.` };
            } else {
                localStorage.removeItem(`lockout_${emailLower}`);
            }
        }

        const user = Store.getUserByEmail(emailLower);

        if (!user) {
            // Incrementar tentativas falhas
            let attempts = parseInt(localStorage.getItem(`attempts_${emailLower}`)) || 0;
            attempts++;
            localStorage.setItem(`attempts_${emailLower}`, attempts);

            if (attempts >= 3) {
                const lockoutTime = new Date(Date.now() + 30 * 1000).toISOString();
                localStorage.setItem(`lockout_${emailLower}`, lockoutTime);
                localStorage.removeItem(`attempts_${emailLower}`);
                Store.addLog(emailLower, "LOGIN_LOCKOUT", "Muitas tentativas de login incorretas. Conta temporariamente bloqueada por 30s.", "SECURITY");
                return { success: false, error: "Muitas tentativas incorretas. Login bloqueado por 30 segundos." };
            }

            Store.addLog(emailLower, "LOGIN_ATTEMPT", `Tentativa de login falhou: e-mail não cadastrado.`, "WARN");
            return { success: false, error: "Usuário ou senha incorretos." };
        }

        if (user.password !== password) {
            // Incrementar tentativas falhas
            let attempts = parseInt(localStorage.getItem(`attempts_${emailLower}`)) || 0;
            attempts++;
            localStorage.setItem(`attempts_${emailLower}`, attempts);

            if (attempts >= 3) {
                const lockoutTime = new Date(Date.now() + 30 * 1000).toISOString();
                localStorage.setItem(`lockout_${emailLower}`, lockoutTime);
                localStorage.removeItem(`attempts_${emailLower}`);
                Store.addLog(emailLower, "LOGIN_LOCKOUT", "Muitas tentativas de login incorretas. Conta temporariamente bloqueada por 30s.", "SECURITY");
                return { success: false, error: "Muitas tentativas incorretas. Login bloqueado por 30 segundos." };
            }

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
            manager: ["dashboard", "crm", "kanban", "proposals", "team", "goals", "services", "inspections", "calendar", "ai-agents"],
            seller: ["dashboard", "crm", "kanban", "proposals", "goals", "inspections", "calendar", "ai-agents"]
        };

        if (role === "admin") return true;

        const allowed = permissions[role] || [];
        return allowed.includes(route);
    }
};
