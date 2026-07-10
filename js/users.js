import { Store } from "./store.js";
import { Auth } from "./auth.js";

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
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum usuário cadastrado.</td></tr>`;
            return;
        }

        const roleLabels = {
            admin: "Administrador",
            manager: "Gerente Comercial",
            seller: "Vendedor"
        };

        users.forEach(user => {
            // Calcular quantidade de leads trabalhados (não perdidos) por esse usuário
            const workedLeads = leads.filter(l => l.owner === user.email && l.stage !== "Cliente Perdido").length;

            // Formatar último login
            let lastLogin = "Nunca logou";
            if (user.lastLoginAt) {
                lastLogin = new Date(user.lastLoginAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                });
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="user-avatar" style="width: 32px; height: 32px; font-size: 11px; font-weight: 700; flex-shrink: 0;">
                            ${user.avatar || user.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary);">${user.name}</span>
                    </div>
                </td>
                <td><span style="font-size: 13px;">${user.email}</span></td>
                <td><span class="badge" style="background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 11px;">${roleLabels[user.role] || user.role}</span></td>
                <td>
                    <span class="badge ${user.status === "active" ? "badge-success" : "badge-danger"}" style="cursor: pointer; user-select: none;" onclick="window.UsersModuleToggleStatus('${user.id}')" title="Clique para alternar status">
                        ${user.status === "active" ? "🟢 Ativo" : "🔴 Inativo"}
                    </span>
                </td>
                <td><span style="font-size: 12px; color: var(--text-secondary);">${lastLogin}</span></td>
                <td><span style="font-weight: 700; color: var(--primary); font-size: 13px; padding-left: 8px;">${workedLeads} lead(s)</span></td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 11px; height: auto;" onclick="window.UsersModuleEdit('${user.id}')" title="Editar Usuário">
                            Editar
                        </button>
                        <button class="btn btn-outline" style="padding: 4px 10px; font-size: 11px; height: auto; border-color: var(--warning); color: var(--warning);" onclick="window.UsersModuleResetPassword('${user.id}')" title="Resetar Senha para 123456">
                            Reset Senha
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Vincular funções globais temporariamente para chamadas inline onclick
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

        // Configurar formulário de alteração de senha própria
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

            // Validar senha atual
            if (users[idx].password !== currentPwd) {
                alert("Senha atual incorreta!");
                return;
            }

            // Validar confirmação
            if (newPwd !== confirmNewPwd) {
                alert("A nova senha e a confirmação não conferem!");
                return;
            }

            // Atualizar senha
            users[idx].password = newPwd;
            Store.saveUsers(users);
            Store.addLog(currentUser.email, "PASSWORD_CHANGE", `Sua própria senha foi redefinida com sucesso.`, "SUCCESS");

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
        document.getElementById("user-status").value = user.status;
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

        // Impedir desativação de si mesmo
        const current = Auth.getCurrentUser();
        if (current && current.id === id) {
            alert("Ação negada: Você não pode desativar sua própria conta!");
            return;
        }

        const newStatus = users[idx].status === "active" ? "inactive" : "active";
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
        const confirmReset = confirm(`Deseja realmente resetar a senha de ${name} para o padrão comercial '123456'?`);
        if (!confirmReset) return;

        users[idx].password = "123456";
        Store.saveUsers(users);
        Store.addLog(Auth.getCurrentUser().email, "USER_MANAGEMENT", `Senha do usuário ${name} resetada para o padrão comercial pelo Admin.`, "SUCCESS");

        alert(`Senha de ${name} resetada com sucesso para '123456'!`);
    },

    openChangePasswordModal() {
        document.getElementById("change-password-modal-overlay").style.display = "block";
        document.getElementById("change-password-modal").classList.add("open");
    }
};
