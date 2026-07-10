import { Store } from "./store.js";
import { Auth } from "./auth.js";

// Paleta de cores premium para cada cargo
const ROLE_STYLES = {
    admin: {
        label: "Administrador",
        bg: "rgba(139, 92, 246, 0.12)",
        color: "#7c3aed",
        border: "rgba(139, 92, 246, 0.25)"
    },
    manager: {
        label: "Gerente Comercial",
        bg: "rgba(59, 130, 246, 0.12)",
        color: "#1d4ed8",
        border: "rgba(59, 130, 246, 0.25)"
    },
    seller: {
        label: "Vendedor",
        bg: "rgba(100, 116, 139, 0.10)",
        color: "var(--text-secondary)",
        border: "rgba(100, 116, 139, 0.2)"
    }
};

// Gradientes dos avatares por cargo
const AVATAR_GRADIENTS = {
    admin: "linear-gradient(135deg, #7c3aed, #a855f7)",
    manager: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
    seller: "linear-gradient(135deg, #0ea5e9, #06b6d4)"
};

export const Users = {
    initialized: false,

    init() {
        this.renderUsers();
        this.setupModalEvents();
    },

    renderUsers() {
        const tableBody = document.getElementById("users-table-body");
        if (!tableBody) return;

        const users = Store.getUsers();
        const leads = Store.getLeads();

        tableBody.innerHTML = "";

        if (users.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 48px 24px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--text-muted);">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span style="font-size: 14px;">Nenhum usuário cadastrado.</span>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        users.forEach(user => {
            // Garantir que usuários antigos sem status sejam tratados como ativos
            const effectiveStatus = user.status || "active";

            // Calcular leads trabalhados
            const workedLeads = leads.filter(l => l.owner === user.email && l.stage !== "Cliente Perdido").length;

            // Formatar último login
            let lastLogin = '<span style="color: var(--text-muted); font-style: italic; font-size: 12px;">Nunca</span>';
            if (user.lastLoginAt) {
                const d = new Date(user.lastLoginAt);
                lastLogin = `<span style="font-size: 12px; color: var(--text-secondary);">${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} <span style="color: var(--text-muted);">•</span> ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>`;
            }

            const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.seller;
            const avatarGrad = AVATAR_GRADIENTS[user.role] || AVATAR_GRADIENTS.seller;
            const avatarText = (user.avatar || user.name.substring(0, 2)).toUpperCase();
            const isActive = effectiveStatus === "active";
            const isSelf = Auth.getCurrentUser()?.id === user.id;

            const tr = document.createElement("tr");
            tr.style.cssText = "transition: background var(--transition-fast);";
            tr.innerHTML = `
                <td style="padding: 14px 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="
                            width: 36px; height: 36px; border-radius: 10px;
                            background: ${avatarGrad};
                            display: flex; align-items: center; justify-content: center;
                            font-size: 12px; font-weight: 800; color: #fff;
                            flex-shrink: 0; letter-spacing: 0.5px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        ">${avatarText}</div>
                        <div>
                            <span style="font-weight: 700; font-size: 13px; color: var(--text-primary); display: block;">${user.name}</span>
                            ${isSelf ? '<span style="font-size: 10px; color: var(--primary); font-weight: 600; background: rgba(99,102,241,0.1); padding: 1px 6px; border-radius: 4px;">Você</span>' : ''}
                        </div>
                    </div>
                </td>
                <td style="padding: 14px 16px;">
                    <span style="font-size: 12.5px; color: var(--text-secondary); font-family: monospace;">${user.email}</span>
                </td>
                <td style="padding: 14px 16px;">
                    <span style="
                        display: inline-flex; align-items: center; gap: 5px;
                        background: ${roleStyle.bg};
                        color: ${roleStyle.color};
                        border: 1px solid ${roleStyle.border};
                        padding: 3px 10px; border-radius: 20px;
                        font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
                        white-space: nowrap;
                    ">${roleStyle.label}</span>
                </td>
                <td style="padding: 14px 16px;">
                    <button
                        onclick="window.UsersModuleToggleStatus('${user.id}')"
                        title="${isActive ? "Clique para desativar" : "Clique para ativar"}"
                        style="
                            display: inline-flex; align-items: center; gap: 6px;
                            background: ${isActive ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)"};
                            color: ${isActive ? "#15803d" : "#dc2626"};
                            border: 1px solid ${isActive ? "rgba(22, 163, 74, 0.25)" : "rgba(220, 38, 38, 0.25)"};
                            padding: 4px 10px; border-radius: 20px;
                            font-size: 11.5px; font-weight: 700;
                            cursor: ${isSelf ? "not-allowed" : "pointer"};
                            transition: all 0.2s; white-space: nowrap;
                            opacity: ${isSelf ? "0.5" : "1"};
                            outline: none;
                        "
                        ${isSelf ? "disabled" : ""}>
                        <span style="
                            width: 7px; height: 7px; border-radius: 50%;
                            background: ${isActive ? "#16a34a" : "#dc2626"};
                            box-shadow: 0 0 0 2px ${isActive ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"};
                            flex-shrink: 0;
                            ${isActive ? "animation: pulse-status 2s infinite;" : ""}
                        "></span>
                        ${isActive ? "Ativo" : "Inativo"}
                    </button>
                </td>
                <td style="padding: 14px 16px;">${lastLogin}</td>
                <td style="padding: 14px 16px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="
                            font-weight: 700; font-size: 15px; color: var(--text-primary);
                        ">${workedLeads}</span>
                        <span style="font-size: 11px; color: var(--text-muted);">lead${workedLeads !== 1 ? "s" : ""}</span>
                        ${workedLeads > 0 ? `
                        <div style="
                            width: 50px; height: 4px; background: var(--bg-body); border-radius: 2px; overflow: hidden;
                        ">
                            <div style="height: 100%; width: ${Math.min(workedLeads * 10, 100)}%; background: var(--primary); border-radius: 2px;"></div>
                        </div>` : ""}
                    </div>
                </td>
                <td style="padding: 14px 16px; text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                        <button
                            onclick="window.UsersModuleEdit('${user.id}')"
                            title="Editar Usuário"
                            class="user-action-btn"
                            style="
                                width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color);
                                background: var(--bg-card); color: var(--text-secondary);
                                display: flex; align-items: center; justify-content: center;
                                cursor: pointer; transition: all 0.2s; flex-shrink: 0;
                            ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                            onclick="window.UsersModuleResetPassword('${user.id}')"
                            title="Resetar Senha para padrão"
                            class="user-action-btn user-action-warn"
                            style="
                                width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(234, 179, 8, 0.3);
                                background: rgba(234, 179, 8, 0.07); color: #ca8a04;
                                display: flex; align-items: center; justify-content: center;
                                cursor: pointer; transition: all 0.2s; flex-shrink: 0;
                            ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Injetar keyframes de animação se não existirem
        if (!document.getElementById("users-style-pulse")) {
            const style = document.createElement("style");
            style.id = "users-style-pulse";
            style.textContent = `
                @keyframes pulse-status {
                    0%, 100% { box-shadow: 0 0 0 2px rgba(22,163,74,0.3); }
                    50% { box-shadow: 0 0 0 4px rgba(22,163,74,0.1); }
                }
                .user-action-btn:hover {
                    background: var(--bg-hover) !important;
                    border-color: var(--primary) !important;
                    color: var(--primary) !important;
                    transform: scale(1.08);
                }
                .user-action-warn:hover {
                    background: rgba(234, 179, 8, 0.15) !important;
                    border-color: rgba(234, 179, 8, 0.5) !important;
                    color: #b45309 !important;
                }
                #view-users tbody tr:hover {
                    background: var(--bg-hover);
                }
            `;
            document.head.appendChild(style);
        }

        // Vincular funções globais
        window.UsersModuleToggleStatus = (id) => this.toggleStatus(id);
        window.UsersModuleEdit = (id) => this.openEditModal(id);
        window.UsersModuleResetPassword = (id) => this.resetPassword(id);
    },

    setupModalEvents() {
        if (this.initialized) return;
        this.initialized = true;

        const overlay = document.getElementById("users-modal-overlay");
        const modal = document.getElementById("user-config-modal");
        const form = document.getElementById("user-form");
        const title = document.getElementById("user-modal-title");
        const btnCreate = document.getElementById("btn-create-user");
        const btnClose = document.getElementById("btn-close-users-modal");
        const btnCancel = document.getElementById("btn-cancel-user");
        const pwdGroup = document.getElementById("password-field-group");

        const openModal = () => {
            overlay.style.display = "block";
            modal.classList.add("open");
        };

        const closeModal = () => {
            overlay.style.display = "none";
            modal.classList.remove("open");
            form.reset();
            document.getElementById("user-id").value = "";
        };

        if (btnCreate) {
            btnCreate.addEventListener("click", () => {
                title.textContent = "Novo Usuário";
                pwdGroup.querySelector("label").textContent = "Senha de Acesso *";
                document.getElementById("user-password").setAttribute("required", "required");
                document.getElementById("user-email").removeAttribute("readonly");
                openModal();
            });
        }

        if (btnClose) btnClose.addEventListener("click", closeModal);
        if (btnCancel) btnCancel.addEventListener("click", closeModal);

        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const userId = document.getElementById("user-id").value;
            const name = document.getElementById("user-name").value.trim();
            const email = document.getElementById("user-email").value.trim().toLowerCase();
            const role = document.getElementById("user-role").value;
            const status = document.getElementById("user-status").value;
            const password = document.getElementById("user-password").value;

            const users = Store.getUsers();

            if (userId) {
                // Modo Edição
                const idx = users.findIndex(u => u.id === userId);
                if (idx !== -1) {
                    users[idx].name = name;
                    users[idx].role = role;
                    users[idx].status = status;
                    if (password) users[idx].password = password;
                    Store.saveUsers(users);
                    Store.addLog(Auth.getCurrentUser().email, "USER_MANAGEMENT", `Usuário ${name} (${email}) editado pelo Admin.`, "SUCCESS");
                }
            } else {
                // Modo Cadastro
                const exists = users.some(u => u.email === email);
                if (exists) {
                    alert("Erro: Este e-mail já está cadastrado!");
                    return;
                }

                const newUser = {
                    id: "usr_" + Date.now(),
                    name,
                    email,
                    role,
                    status,
                    password: password || "123456",
                    avatar: name.substring(0, 2).toUpperCase(),
                    lastLoginAt: null
                };

                users.push(newUser);
                Store.saveUsers(users);
                Store.addLog(Auth.getCurrentUser().email, "USER_MANAGEMENT", `Novo usuário ${name} (${email}) cadastrado como ${role} pelo Admin.`, "SUCCESS");
            }

            closeModal();
            this.renderUsers();
        });

        // Formulário de alteração de senha própria
        const changePwdOverlay = document.getElementById("change-password-modal-overlay");
        const changePwdModal = document.getElementById("change-password-modal");
        const changePwdForm = document.getElementById("change-password-form");
        const btnCancelChangePwd = document.getElementById("btn-cancel-change-pwd");
        const btnCloseChangePwd = document.getElementById("btn-close-change-pwd-modal");

        const closeChangePwdModal = () => {
            changePwdOverlay.style.display = "none";
            changePwdModal.classList.remove("open");
            changePwdForm.reset();
        };

        if (btnCloseChangePwd) btnCloseChangePwd.addEventListener("click", closeChangePwdModal);
        if (btnCancelChangePwd) btnCancelChangePwd.addEventListener("click", closeChangePwdModal);

        changePwdForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const currentPwd = document.getElementById("current-pwd").value;
            const newPwd = document.getElementById("new-pwd").value;
            const confirmNewPwd = document.getElementById("confirm-new-pwd").value;

            const currentUser = Auth.getCurrentUser();
            if (!currentUser) return;

            const users = Store.getUsers();
            const idx = users.findIndex(u => u.id === currentUser.id);

            if (idx === -1) {
                alert("Erro ao identificar usuário da sessão.");
                return;
            }

            if (users[idx].password !== currentPwd) {
                alert("Senha atual incorreta!");
                return;
            }

            if (newPwd !== confirmNewPwd) {
                alert("A nova senha e a confirmação não conferem!");
                return;
            }

            users[idx].password = newPwd;
            Store.saveUsers(users);
            Store.addLog(currentUser.email, "PASSWORD_CHANGE", "Própria senha redefinida com sucesso.", "SUCCESS");

            alert("Senha alterada com sucesso!");
            closeChangePwdModal();
        });
    },

    openEditModal(id) {
        const user = Store.getUsers().find(u => u.id === id);
        if (!user) return;

        document.getElementById("user-id").value = user.id;
        document.getElementById("user-name").value = user.name;
        document.getElementById("user-email").value = user.email;
        document.getElementById("user-email").setAttribute("readonly", "readonly");
        document.getElementById("user-role").value = user.role;
        document.getElementById("user-status").value = user.status || "active";
        document.getElementById("user-password").removeAttribute("required");

        const title = document.getElementById("user-modal-title");
        const pwdGroup = document.getElementById("password-field-group");

        title.textContent = "Editar Usuário";
        pwdGroup.querySelector("label").textContent = "Nova Senha (opcional)";

        document.getElementById("users-modal-overlay").style.display = "block";
        document.getElementById("user-config-modal").classList.add("open");
    },

    toggleStatus(id) {
        const users = Store.getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) return;

        const current = Auth.getCurrentUser();
        if (current && current.id === id) {
            alert("Ação negada: Você não pode desativar sua própria conta!");
            return;
        }

        const effectiveStatus = users[idx].status || "active";
        const newStatus = effectiveStatus === "active" ? "inactive" : "active";
        users[idx].status = newStatus;
        Store.saveUsers(users);
        Store.addLog(current.email, "USER_MANAGEMENT", `Status do usuário ${users[idx].name} alterado para ${newStatus === "active" ? "ATIVO" : "INATIVO"}.`, "SUCCESS");

        this.renderUsers();
    },

    resetPassword(id) {
        const users = Store.getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) return;

        const name = users[idx].name;
        const confirmReset = confirm(`Deseja resetar a senha de "${name}" para a senha padrão '123456'?`);
        if (!confirmReset) return;

        users[idx].password = "123456";
        Store.saveUsers(users);
        Store.addLog(Auth.getCurrentUser().email, "USER_MANAGEMENT", `Senha do usuário ${name} resetada para padrão pelo Admin.`, "SUCCESS");

        alert(`Senha de "${name}" resetada com sucesso para '123456'!`);
    },

    openChangePasswordModal() {
        document.getElementById("change-password-modal-overlay").style.display = "block";
        document.getElementById("change-password-modal").classList.add("open");
    }
};
