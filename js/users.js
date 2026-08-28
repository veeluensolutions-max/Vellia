import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { generatePerformancePDF } from "./report.js";

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
    },
    operacional: {
        label: "Operacional",
        bg: "rgba(245, 158, 11, 0.12)",
        color: "#d97706",
        border: "rgba(245, 158, 11, 0.25)"
    }
};

// Gradientes dos avatares por cargo
const AVATAR_GRADIENTS = {
    admin: "linear-gradient(135deg, #7c3aed, #a855f7)",
    manager: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
    seller: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
    operacional: "linear-gradient(135deg, #f59e0b, #d97706)"
};

export const Users = {
    initialized: false,
    _presenceTimer: null,

    async init() {
        this.setupModalEvents();
        this.renderUsers();

        // 1. Puxar dados mais recentes de login/presença do Supabase
        try {
            const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
            const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";
            const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_users?select=*`, {
                headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
            });
            if (res.ok) {
                const remoteUsers = await res.json();
                if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
                    localStorage.setItem("comercial_users", JSON.stringify(remoteUsers));
                    this.renderUsers();
                }
            }
        } catch (e) {
            console.log("Users presence sync fallback:", e);
        }

        // 2. Auto-refresh periódico de presença enquanto estiver na visualização de usuários
        if (!this._presenceTimer) {
            this._presenceTimer = setInterval(() => {
                const usersView = document.getElementById("view-users");
                if (usersView && usersView.style.display !== "none") {
                    this.renderUsers();
                }
            }, 10000); // atualiza a cada 10s
        }
    },

    renderUsers() {
        const tableBody = document.getElementById("users-table-body");
        if (!tableBody) return;

        const users = Store.getUsers();
        const leads = Store.getLeads();

        // Filtrar contas reais (ocultar contas de sistema/configurações)
        const validUsers = users.filter(u => u && u.name && u.role !== "system" && !u.email.includes("config@"));

        // Helper de cálculo de presença e data/hora
        const getPresenceInfo = (user, isSelf) => {
            if (isSelf) {
                return {
                    status: "online",
                    badge: `<span class="presence-badge presence-online"><span class="presence-dot pulse"></span> Online Agora</span>`,
                    timeText: `<span style="font-size: 11px; color: #10b981; font-weight: 600;">Sessão Ativa</span>`
                };
            }

            if (!user.lastLoginAt) {
                return {
                    status: "offline",
                    badge: `<span class="presence-badge presence-offline"><span class="presence-dot"></span> Offline</span>`,
                    timeText: `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Nunca acessou</span>`
                };
            }

            const lastTime = new Date(user.lastLoginAt).getTime();
            const diffMs = Date.now() - lastTime;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            const d = new Date(user.lastLoginAt);
            const isToday = new Date().toDateString() === d.toDateString();
            const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();
            
            const timeFmt = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            let dateFmt = "";
            if (isToday) {
                dateFmt = `Hoje às ${timeFmt}`;
            } else if (isYesterday) {
                dateFmt = `Ontem às ${timeFmt}`;
            } else {
                dateFmt = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${timeFmt}`;
            }

            if (diffMins < 5) {
                return {
                    status: "online",
                    badge: `<span class="presence-badge presence-online"><span class="presence-dot pulse"></span> Online</span>`,
                    timeText: `<span style="font-size: 11px; color: #10b981; font-weight: 600;">${dateFmt}</span>`
                };
            } else if (diffMins < 15) {
                return {
                    status: "away",
                    badge: `<span class="presence-badge presence-away"><span class="presence-dot"></span> Ausente</span>`,
                    timeText: `<span style="font-size: 11px; color: #d97706; font-weight: 600;">${dateFmt} <span style="font-size: 10px; opacity: 0.8;">(há ${diffMins}m)</span></span>`
                };
            } else {
                const relativeText = diffHours < 24 ? `há ${diffHours}h` : `há ${diffDays}d`;
                return {
                    status: "offline",
                    badge: `<span class="presence-badge presence-offline"><span class="presence-dot"></span> Offline</span>`,
                    timeText: `<span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">${dateFmt} <span style="color: var(--text-muted); font-size: 10px;">(${relativeText})</span></span>`
                };
            }
        };

        // Calcular e atualizar KPIs
        const elTotal = document.getElementById("kpi-users-total");
        const elActive = document.getElementById("kpi-users-active");
        const elAdmins = document.getElementById("kpi-users-admins");
        const elSellers = document.getElementById("kpi-users-sellers");

        const currentUserId = Auth.getCurrentUser()?.id;
        const onlineCount = validUsers.filter(u => {
            const isSelf = currentUserId === u.id;
            return getPresenceInfo(u, isSelf).status === "online";
        }).length;

        if (elTotal) {
            const admins = validUsers.filter(u => u.role === "admin").length;
            const sellers = validUsers.filter(u => ["seller", "operacional", "vendedor", "manager", "gerente"].includes(u.role)).length;

            elTotal.textContent = validUsers.length;
            if (elActive) elActive.textContent = onlineCount;
            elAdmins.textContent = admins;
            elSellers.textContent = sellers;
        }

        tableBody.innerHTML = "";

        if (validUsers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 48px 24px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--text-muted);">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span style="font-size: 14px;">Nenhum usuário cadastrado.</span>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        validUsers.forEach(user => {
            // Garantir que usuários antigos sem status sejam tratados como ativos
            const effectiveStatus = user.status || "active";

            // Calcular leads trabalhados
            const workedLeads = leads.filter(l => l.owner === user.email && l.stage !== "Cliente Perdido").length;

            const isSelf = Auth.getCurrentUser()?.id === user.id;
            const presence = getPresenceInfo(user, isSelf);

            const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.seller;
            const avatarGrad = AVATAR_GRADIENTS[user.role] || AVATAR_GRADIENTS.seller;
            const avatarText = (user.avatar || user.name.substring(0, 2)).toUpperCase();
            const isActive = effectiveStatus === "active";

            // Criar a linha (tr) e preencher os dados
            const tr = document.createElement("tr");
            tr.style.cssText = "transition: background var(--transition-fast); border-bottom: 1px solid var(--border-color);";
            
            // Coluna de Nome / Perfil
            const tdProfile = document.createElement("td");
            tdProfile.style.cssText = "padding: 14px 16px;";
            tdProfile.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="position: relative;">
                        <div style="
                            width: 38px; height: 38px; border-radius: 12px;
                            background: ${avatarGrad};
                            display: flex; align-items: center; justify-content: center;
                            font-size: 13px; font-weight: 800; color: #fff;
                            flex-shrink: 0; letter-spacing: 0.5px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        ">${avatarText}</div>
                        <span style="
                            position: absolute; bottom: -2px; right: -2px;
                            width: 10px; height: 10px; border-radius: 50%;
                            background: ${presence.status === 'online' ? '#10b981' : presence.status === 'away' ? '#f59e0b' : '#94a3b8'};
                            border: 2px solid var(--bg-card, #fff);
                        "></span>
                    </div>
                    <div>
                        <span style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); display: block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${user.name}">${user.name}</span>
                        ${isSelf ? '<span style="font-size: 10px; color: var(--primary); font-weight: 700; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); padding: 1px 6px; border-radius: 4px;">Você (Atual)</span>' : ''}
                    </div>
                </div>
            `;
            tr.appendChild(tdProfile);

            // Coluna de E-mail
            const tdEmail = document.createElement("td");
            tdEmail.style.cssText = "padding: 14px 16px;";
            tdEmail.innerHTML = `<span style="font-size: 12.5px; color: var(--text-secondary); font-family: monospace; display: block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${user.email}">${user.email}</span>`;
            tr.appendChild(tdEmail);

            // Coluna de Cargo
            const tdRole = document.createElement("td");
            tdRole.style.cssText = "padding: 14px 16px;";
            tdRole.innerHTML = `
                <span style="
                    display: inline-flex; align-items: center; gap: 5px;
                    background: ${roleStyle.bg};
                    color: ${roleStyle.color};
                    border: 1px solid ${roleStyle.border};
                    padding: 3px 10px; border-radius: 20px;
                    font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
                    white-space: nowrap;
                ">${roleStyle.label}</span>
            `;
            tr.appendChild(tdRole);

            // Coluna de Empresa Acesso
            const tdCompanyAccess = document.createElement("td");
            tdCompanyAccess.style.cssText = "padding: 14px 16px;";
            const userCompany = user.companyAccess || "Ambas";
            let companyColor = "var(--text-secondary)";
            let companyBg = "rgba(0,0,0,0.05)";
            if (userCompany === "Veeluen Solutions") { companyColor = "#2563eb"; companyBg = "rgba(37,99,235,0.1)"; }
            if (userCompany === "Excelência Ambiental") { companyColor = "#16a34a"; companyBg = "rgba(22,163,74,0.1)"; }
            
            tdCompanyAccess.innerHTML = `
                <span style="
                    display: inline-block; padding: 4px 10px; border-radius: 6px;
                    font-size: 11px; font-weight: 600; color: ${companyColor}; background: ${companyBg};
                    white-space: nowrap;
                ">${userCompany}</span>
            `;
            tr.appendChild(tdCompanyAccess);

            // Coluna de Status da Conta
            const tdStatus = document.createElement("td");
            tdStatus.style.cssText = "padding: 14px 16px;";
            const statusBtn = document.createElement("button");
            statusBtn.title = isActive ? "Clique para desativar acesso" : "Clique para ativar acesso";
            statusBtn.disabled = isSelf;
            statusBtn.style.cssText = `
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
            `;
            statusBtn.innerHTML = `
                <span style="
                    width: 7px; height: 7px; border-radius: 50%;
                    background: ${isActive ? "#16a34a" : "#dc2626"};
                    box-shadow: 0 0 0 2px ${isActive ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"};
                    flex-shrink: 0;
                "></span>
                ${isActive ? "Ativo" : "Inativo"}
            `;
            statusBtn.onclick = () => this.toggleStatus(user.id);
            tdStatus.appendChild(statusBtn);
            tr.appendChild(tdStatus);

            // Coluna de Presença & Último Login (COM STATUS AO VIVO)
            const tdLastLogin = document.createElement("td");
            tdLastLogin.style.cssText = "padding: 14px 16px;";
            tdLastLogin.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${presence.badge}
                    ${presence.timeText}
                </div>
            `;
            tr.appendChild(tdLastLogin);

            // Coluna de Leads Ativos
            const tdLeads = document.createElement("td");
            tdLeads.style.cssText = "padding: 14px 16px;";
            tdLeads.innerHTML = `
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
            `;
            tr.appendChild(tdLeads);

            // Tornar a linha clicável para abrir a janela de status e opções
            tr.style.cursor = "pointer";
            tr.title = `Clique para ver o status, horário de login e opções de ${user.name}`;
            tr.onclick = (e) => {
                if (!e.target.closest("button") && !e.target.closest("a")) {
                    this.openUserDetailsModal(user.id);
                }
            };

            // Coluna de Ações
            const tdActions = document.createElement("td");
            tdActions.style.cssText = "padding: 14px 16px; text-align: right;";
            
            const actionsDiv = document.createElement("div");
            actionsDiv.style.cssText = "display: flex; gap: 6px; justify-content: flex-end; align-items: center;";

            // Botão Ver Status e Detalhes
            const viewBtn = document.createElement("button");
            viewBtn.title = "Abrir Janela de Status, Login e Opções de Uso";
            viewBtn.className = "user-action-btn user-action-info";
            viewBtn.style.cssText = `
                width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.3);
                background: rgba(99, 102, 241, 0.08); color: var(--primary);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s; flex-shrink: 0;
            `;
            viewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                this.openUserDetailsModal(user.id);
            };
            actionsDiv.appendChild(viewBtn);

            // Botão Editar
            const editBtn = document.createElement("button");
            editBtn.title = "Editar Usuário";
            editBtn.className = "user-action-btn";
            editBtn.style.cssText = `
                width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color);
                background: var(--bg-card); color: var(--text-secondary);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s; flex-shrink: 0;
            `;
            editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.openEditModal(user.id);
            };
            actionsDiv.appendChild(editBtn);

            // Botão Reset Senha
            const resetBtn = document.createElement("button");
            resetBtn.title = "Resetar Senha para padrão";
            resetBtn.className = "user-action-btn user-action-warn";
            resetBtn.style.cssText = `
                width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(234, 179, 8, 0.3);
                background: rgba(234, 179, 8, 0.07); color: #ca8a04;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s; flex-shrink: 0;
            `;
            resetBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
            resetBtn.onclick = (e) => {
                e.stopPropagation();
                this.resetPassword(user.id);
            };
            actionsDiv.appendChild(resetBtn);

            // Botão Relatório PDF
            const reportBtn = document.createElement("button");
            reportBtn.title = "Gerar Relatório de Desempenho (PDF)";
            reportBtn.className = "user-action-btn";
            reportBtn.style.cssText = `
                width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);
                background: rgba(59, 130, 246, 0.08); color: #2563eb;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s; flex-shrink: 0;
            `;
            reportBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
            reportBtn.onclick = (e) => {
                e.stopPropagation();
                reportBtn.disabled = true;
                reportBtn.style.opacity = "0.5";
                try { generatePerformancePDF(user.email); } catch(e) { alert("Erro ao gerar PDF: " + e.message); }
                setTimeout(() => { reportBtn.disabled = false; reportBtn.style.opacity = "1"; }, 1500);
            };
            actionsDiv.appendChild(reportBtn);

            // Botão Excluir (apenas se não for o próprio admin logado)
            if (!isSelf) {
                const deleteBtn = document.createElement("button");
                deleteBtn.title = "Excluir Usuário";
                deleteBtn.className = "user-action-btn user-action-danger";
                deleteBtn.style.cssText = `
                    width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(220, 38, 38, 0.3);
                    background: rgba(220, 38, 38, 0.07); color: #dc2626;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s; flex-shrink: 0;
                `;
                deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteUser(user.id, user.name);
                };
                actionsDiv.appendChild(deleteBtn);
            }

            tdActions.appendChild(actionsDiv);
            tr.appendChild(tdActions);

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
                .presence-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 3px 9px;
                    border-radius: 99px;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                    width: fit-content;
                }
                .presence-online {
                    background: rgba(16, 185, 129, 0.12);
                    color: #10b981;
                    border: 1px solid rgba(16, 185, 129, 0.28);
                }
                .presence-away {
                    background: rgba(245, 158, 11, 0.12);
                    color: #d97706;
                    border: 1px solid rgba(245, 158, 11, 0.28);
                }
                .presence-offline {
                    background: rgba(100, 116, 139, 0.08);
                    color: var(--text-muted, #64748b);
                    border: 1px solid rgba(100, 116, 139, 0.2);
                }
                .presence-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: currentColor;
                }
                .presence-dot.pulse {
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                    animation: presence-pulse 2s infinite;
                }
                @keyframes presence-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
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
                .user-action-danger:hover {
                    background: rgba(220, 38, 38, 0.18) !important;
                    border-color: rgba(220, 38, 38, 0.6) !important;
                    color: #b91c1c !important;
                    transform: scale(1.08);
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
        window.UsersModuleDelete = (id, name) => this.deleteUser(id, name);
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
            const companyAccess = document.getElementById("user-companyAccess").value;

            // Validar força da senha se informada (cadastro ou edição)
            if (password) {
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.\-_#$])[A-Za-z\d@$!%*?&.\-_#$]{8,}$/;
                if (!passwordRegex.test(password)) {
                    alert("Segurança da Senha:\nA senha deve conter pelo menos:\n- 8 caracteres\n- 1 letra maiúscula\n- 1 letra minúscula\n- 1 número\n- 1 caractere especial (ex: @$!%*?&.-_#)");
                    return;
                }
            }

            const users = Store.getUsers();

            if (userId) {
                // Modo Edição
                const idx = users.findIndex(u => u.id === userId);
                if (idx !== -1) {
                    users[idx].name = name;
                    users[idx].role = role;
                    users[idx].status = status;
                    users[idx].companyAccess = companyAccess;
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
                    companyAccess,
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

        // Inicializar listeners de alteração de senha
        this.initChangePassword();
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
        document.getElementById("user-companyAccess").value = user.companyAccess || "Ambas";
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
        this.initChangePassword();
        document.getElementById("change-password-modal-overlay").style.display = "block";
        document.getElementById("change-password-modal").classList.add("open");
    },

    initChangePassword() {
        if (this.changePasswordInitialized) return;
        this.changePasswordInitialized = true;

        const changePwdOverlay = document.getElementById("change-password-modal-overlay");
        const changePwdModal = document.getElementById("change-password-modal");
        const changePwdForm = document.getElementById("change-password-form");
        const btnCancelChangePwd = document.getElementById("btn-cancel-change-pwd");
        const btnCloseChangePwd = document.getElementById("btn-close-change-pwd-modal");

        if (!changePwdForm) return;

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

            // Validar força da nova senha
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.\-_#$])[A-Za-z\d@$!%*?&.\-_#$]{8,}$/;
            if (!passwordRegex.test(newPwd)) {
                alert("Segurança da Senha:\nA nova senha deve conter pelo menos:\n- 8 caracteres\n- 1 letra maiúscula\n- 1 letra minúscula\n- 1 número\n- 1 caractere especial (ex: @$!%*?&.-_#)");
                return;
            }

            users[idx].password = newPwd;
            Store.saveUsers(users);
            Store.addLog(currentUser.email, "PASSWORD_CHANGE", "Própria senha redefinida com sucesso.", "SUCCESS");

            alert("Senha alterada com sucesso!");
            closeChangePwdModal();
        });
    },

    deleteUser(id, name) {
        const currentUser = Auth.getCurrentUser();

        // Segurança: bloquear auto-exclusão
        if (currentUser && currentUser.id === id) {
            alert("Ação negada: Você não pode excluir sua própria conta!");
            return;
        }

        const confirmed = confirm(`⚠️ Tem certeza que deseja EXCLUIR o usuário "${name}"?\n\nEsta ação é permanente e não pode ser desfeita.`);
        if (!confirmed) return;

        Store.deleteUser(id);
        Store.addLog(
            currentUser?.email || "admin@vellia.com",
            "USER_DELETED",
            `Usuário "${name}" excluído permanentemente pelo Administrador.`,
            "SUCCESS"
        );

        this.renderUsers();
        // Feedback visual temporário
        const toast = document.createElement("div");
        toast.textContent = `🗑️ Usuário "${name}" excluído com sucesso.`;
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            background: #1e293b; color: #f1f5f9;
            padding: 12px 20px; border-radius: 10px;
            font-size: 13px; font-weight: 600;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            border-left: 4px solid #dc2626;
            animation: fadeIn 0.2s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    openUserDetailsModal(userId) {
        const user = Store.getUsers().find(u => u.id === userId);
        if (!user) return;

        const overlay = document.getElementById("user-details-modal-overlay");
        const modal = document.getElementById("user-details-modal");
        if (!overlay || !modal) return;

        const isSelf = Auth.getCurrentUser()?.id === user.id;
        const allLeads = Store.getLeads() || [];
        const userLeads = allLeads.filter(l => l && l.owner === user.email);
        const allProps = Store.getProposals() || [];
        const userProps = allProps.filter(p => p && (p.owner === user.email || p.seller === user.name));
        const allLogs = Store.getLogs() || [];
        const userLogs = allLogs.filter(lg => lg && (lg.user === user.email || lg.details?.includes(user.name))).slice(-8).reverse();

        // Presença e Login
        const d = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
        let lastLoginFmt = "Nunca acessou";
        let elapsedFmt = "Sem conexões registradas";
        let statusPresence = "offline";
        let badgeText = "⚪ Offline";
        let dotColor = "#94a3b8";

        if (isSelf) {
            statusPresence = "online";
            badgeText = "🟢 Online Agora (Sessão Ativa)";
            dotColor = "#10b981";
            lastLoginFmt = "Sessão Atual Conectada";
            elapsedFmt = "Ativo neste navegador";
        } else if (d) {
            const diffMs = Date.now() - d.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            const isToday = new Date().toDateString() === d.toDateString();
            const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();
            const timeFmt = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            
            if (isToday) {
                lastLoginFmt = `Hoje às ${timeFmt}`;
            } else if (isYesterday) {
                lastLoginFmt = `Ontem às ${timeFmt}`;
            } else {
                lastLoginFmt = `${d.toLocaleDateString("pt-BR")} às ${timeFmt}`;
            }

            if (diffMins < 5) {
                statusPresence = "online";
                badgeText = "🟢 Online Agora";
                dotColor = "#10b981";
                elapsedFmt = "Atividade nos últimos minutos";
            } else if (diffMins < 15) {
                statusPresence = "away";
                badgeText = `🟡 Ausente (${diffMins} min)`;
                dotColor = "#f59e0b";
                elapsedFmt = `Inativo há ${diffMins} minutos`;
            } else {
                statusPresence = "offline";
                badgeText = "⚪ Offline";
                dotColor = "#94a3b8";
                elapsedFmt = diffHours < 24 ? `Última conexão há ${diffHours}h` : `Última conexão há ${diffDays} dias`;
            }
        }

        // Preencher Cabeçalho
        const roleStyle = ROLE_STYLES[user.role] || ROLE_STYLES.seller;
        const avatarGrad = AVATAR_GRADIENTS[user.role] || AVATAR_GRADIENTS.seller;
        const avatarText = (user.avatar || user.name.substring(0, 2)).toUpperCase();

        const elAvatar = document.getElementById("user-detail-avatar");
        if (elAvatar) {
            elAvatar.textContent = avatarText;
            elAvatar.style.background = avatarGrad;
        }

        const elDot = document.getElementById("user-detail-presence-dot");
        if (elDot) elDot.style.background = dotColor;

        const elName = document.getElementById("user-detail-name");
        if (elName) elName.textContent = user.name;

        const elEmail = document.getElementById("user-detail-email");
        if (elEmail) elEmail.textContent = user.email;

        const selfTag = document.getElementById("user-detail-self-tag");
        if (selfTag) selfTag.style.display = isSelf ? "inline-block" : "none";

        const roleBadge = document.getElementById("user-detail-role-badge");
        if (roleBadge) {
            roleBadge.textContent = roleStyle.label;
            roleBadge.style.background = roleStyle.bg;
            roleBadge.style.color = roleStyle.color;
            roleBadge.style.border = `1px solid ${roleStyle.border}`;
        }

        const companyBadge = document.getElementById("user-detail-company-badge");
        if (companyBadge) companyBadge.textContent = user.companyAccess || "Ambas as Empresas";

        // Bloco 1: Presença e Conexão
        const elPresBadge = document.getElementById("user-detail-presence-badge");
        if (elPresBadge) {
            elPresBadge.textContent = badgeText;
            elPresBadge.style.color = dotColor;
        }

        const elLastLogin = document.getElementById("user-detail-last-login");
        if (elLastLogin) elLastLogin.textContent = lastLoginFmt;

        const elElapsed = document.getElementById("user-detail-elapsed");
        if (elElapsed) elElapsed.textContent = elapsedFmt;

        // Bloco 2: Métricas Comerciais
        const negotiatingLeads = userLeads.filter(l => l && !["Cliente Ganho", "Cliente Perdido"].includes(l.stage)).length;
        const elLeadsCount = document.getElementById("user-detail-leads-count");
        if (elLeadsCount) elLeadsCount.textContent = userLeads.length;

        const elLeadsNeg = document.getElementById("user-detail-leads-negotiating");
        if (elLeadsNeg) elLeadsNeg.textContent = `${negotiatingLeads} em andamento`;

        const totalPropsVal = userProps.reduce((acc, p) => acc + (parseFloat(p.value) || 0), 0);
        const elPropsCount = document.getElementById("user-detail-props-count");
        if (elPropsCount) elPropsCount.textContent = userProps.length;

        const elPropsVal = document.getElementById("user-detail-props-value");
        if (elPropsVal) elPropsVal.textContent = totalPropsVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        // Bloco 3: Logs Recentes
        const logsContainer = document.getElementById("user-detail-logs-list");
        if (logsContainer) {
            logsContainer.innerHTML = "";
            if (userLogs.length === 0) {
                logsContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); font-style: italic; padding: 4px 0;">Nenhuma atividade recente registrada nos logs para este usuário.</div>`;
            } else {
                userLogs.forEach(lg => {
                    const logItem = document.createElement("div");
                    logItem.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 12px;";
                    const time = lg.timestamp ? new Date(lg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
                    logItem.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                            <span style="font-size: 10px; font-weight: 700; color: var(--primary); background: rgba(99,102,241,0.12); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${lg.action || "AÇÃO"}</span>
                            <span style="color: var(--text-primary); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${lg.details || ""}</span>
                        </div>
                        <span style="font-size: 11px; color: var(--text-muted); font-family: monospace; white-space: nowrap; margin-left: 8px;">${time}</span>
                    `;
                    logsContainer.appendChild(logItem);
                });
            }
        }

        // Rodapé de Ações
        const btnToggleStatus = document.getElementById("btn-user-detail-toggle-status");
        if (btnToggleStatus) {
            const isActive = (user.status || "active") === "active";
            btnToggleStatus.innerHTML = isActive ? "🔴 Desativar Conta" : "🟢 Ativar Conta";
            btnToggleStatus.disabled = isSelf;
            btnToggleStatus.style.opacity = isSelf ? "0.5" : "1";
            btnToggleStatus.style.cursor = isSelf ? "not-allowed" : "pointer";
            btnToggleStatus.onclick = () => {
                this.toggleStatus(user.id);
                this.openUserDetailsModal(user.id);
            };
        }

        const btnResetPwd = document.getElementById("btn-user-detail-reset-pwd");
        if (btnResetPwd) {
            btnResetPwd.onclick = () => {
                this.resetPassword(user.id);
            };
        }

        const btnPdf = document.getElementById("btn-user-detail-pdf");
        if (btnPdf) {
            btnPdf.onclick = () => {
                btnPdf.disabled = true;
                btnPdf.style.opacity = "0.5";
                try { generatePerformancePDF(user.email); } catch(e) { alert("Erro ao gerar PDF: " + e.message); }
                setTimeout(() => { btnPdf.disabled = false; btnPdf.style.opacity = "1"; }, 1500);
            };
        }

        const btnEdit = document.getElementById("btn-user-detail-edit");
        if (btnEdit) {
            btnEdit.onclick = () => {
                this.closeUserDetailsModal();
                this.openEditModal(user.id);
            };
        }

        const btnClose = document.getElementById("btn-close-user-details");
        if (btnClose) btnClose.onclick = () => this.closeUserDetailsModal();
        overlay.onclick = () => this.closeUserDetailsModal();

        overlay.style.display = "block";
        modal.style.display = "block";
        modal.classList.add("open");
    },

    closeUserDetailsModal() {
        const overlay = document.getElementById("user-details-modal-overlay");
        const modal = document.getElementById("user-details-modal");
        if (overlay) overlay.style.display = "none";
        if (modal) {
            modal.style.display = "none";
            modal.classList.remove("open");
        }
    }
};

window.UsersModuleOpenDetails = (id) => Users.openUserDetailsModal(id);

