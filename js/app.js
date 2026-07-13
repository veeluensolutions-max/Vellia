import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";
import { CRM } from "./crm.js";
import { Kanban } from "./kanban.js";
import { Proposals } from "./proposals.js";
import { Dashboard } from "./dashboard.js";
import { Goals } from "./goals.js";
import { Services } from "./services.js";
import { Forecast } from "./forecast.js";
import { VelliaAI, analyzeContext } from "./ai.js";
import { Notifications } from "./notifications.js";
import { DataExport } from "./export.js";
import { Team } from "./team.js";
import { Performance } from "./performance.js";
import { WhatsApp } from "./whatsapp.js";
import { Pricing } from "./pricing.js";
import { Integrations } from "./integrations.js";

// Elementos Globais DOM
const elements = {
    loginScreen: document.getElementById("login-screen"),
    appShell: document.getElementById("app-shell"),
    loginForm: document.getElementById("login-form"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),
    loginError: document.getElementById("login-error"),
    loginErrorText: document.getElementById("login-error-text"),
    btnLogout: document.getElementById("btn-logout"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),
    viewTitle: document.getElementById("view-title"),
    userAvatar: document.getElementById("user-avatar"),
    userDisplayName: document.getElementById("user-display-name"),
    userDisplayRole: document.getElementById("user-display-role"),
    menuToggleBtn: document.getElementById("menu-toggle-btn"),
    sidebar: document.querySelector(".app-sidebar"),
    sidebarOverlay: document.getElementById("sidebar-overlay"),
    logsTableBody: document.getElementById("logs-table-body"),
    logSearch: document.getElementById("log-search"),
    btnRefreshLogs: document.getElementById("btn-refresh-logs"),
    btnClearLogs: document.getElementById("btn-clear-logs"),
    presetBtns: document.querySelectorAll(".preset-btn-new"),
    menuItems: document.querySelectorAll(".sidebar-menu .menu-item")
};

// ==========================================================================
// INICIALIZAÇÃO E CONTROLE DE SESSÃO
// ==========================================================================

function initApp() {
    setupEventListeners();
    setupTheme();
    WhatsApp.init();
    Pricing.init();
    checkSession();
}

function checkSession() {
    if (Auth.isAuthenticated()) {
        const user = Auth.getCurrentUser();
        showAppShell(user);
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    elements.appShell.style.display = "none";
    elements.loginScreen.style.display = "flex";
    elements.loginError.style.display = "none";
    elements.loginForm.reset();
}

function showAppShell(user) {
    elements.loginScreen.style.display = "none";
    elements.appShell.style.display = "flex";
    
    // Atualizar Perfil no Rodapé da Sidebar
    elements.userDisplayName.textContent = user.name;
    elements.userDisplayRole.textContent = Auth.getRoleLabel(user.role);
    elements.userAvatar.textContent = user.avatar;
    
    // Configurar Itens da Sidebar conforme Permissões
    configureSidebarMenu(user.role);

    // Ir para a view ativa atual ou padrão (dashboard)
    const currentHash = window.location.hash.replace("#", "") || "dashboard";
    navigateTo(currentHash);

    // Inicializar Notificações e Exportação
    Notifications.init();
    DataExport.init();
}

// Configura quais botões do menu lateral aparecem baseado nas regras do perfil
function configureSidebarMenu(role) {
    elements.menuItems.forEach(item => {
        const viewName = item.getAttribute("data-view");
        
        // Regras de visibilidade customizadas para a Etapa 1
        let isVisible = false;
        
        if (role === "admin") {
            // Administrador vê tudo, menos recursos operacionais exclusivos de gerente/vendedor
            // Mas para testes, vamos permitir ver quase tudo. Ele vê obrigatoriamente Logs.
            isVisible = true;
        } else if (role === "manager") {
            // Gerente Comercial vê CRM, Kanban, Propostas, Metas, Serviços, Forecast, IA. Não vê logs.
            isVisible = viewName !== "logs" && viewName !== "users";
        } else if (role === "seller") {
            // Vendedor vê CRM, Kanban, Propostas e IA. Não vê Logs, Equipe, Serviços, Forecast, Integrações e Usuários.
            isVisible = !["logs", "team", "services", "forecast", "integrations", "users"].includes(viewName);
        }

        // Elementos HTML específicos
        const el = document.getElementById(`menu-${viewName}`);
        if (el) {
            el.style.display = isVisible ? "block" : "none";
        }
    });
}

// ==========================================================================
// ROTEADOR INTERNO SPA
// ==========================================================================

function navigateTo(viewName) {
    const user = Auth.getCurrentUser();
    if (!user) return showLoginScreen();

    // Redirecionamentos de abas unificadas
    if (viewName === "performance") {
        window.location.hash = "#team";
        setTimeout(() => {
            const tabBtn = document.querySelector('.subtab-btn[data-subtab="team-graficos"]');
            if (tabBtn) tabBtn.click();
        }, 100);
        return;
    }
    if (viewName === "forecast") {
        window.location.hash = "#team";
        setTimeout(() => {
            const tabBtn = document.querySelector('.subtab-btn[data-subtab="team-forecast"]');
            if (tabBtn) tabBtn.click();
        }, 100);
        return;
    }
    if (viewName === "services") {
        window.location.hash = "#team";
        setTimeout(() => {
            const tabBtn = document.querySelector('.subtab-btn[data-subtab="team-servicos"]');
            if (tabBtn) tabBtn.click();
        }, 100);
        return;
    }
    if (viewName === "pricing") {
        window.location.hash = "#proposals";
        return;
    }

    // Validar se o perfil tem permissão
    if (!Auth.canAccessRoute(user.role, viewName)) {
        Audit.logAccessDenied(user.email, viewName);
        alert("Acesso Negado: Seu perfil não possui permissão para acessar esta área.");
        window.location.hash = "#dashboard";
        return;
    }

    // Ocultar todas as views
    document.querySelectorAll(".spa-view").forEach(view => {
        view.style.display = "none";
    });

    // Mostrar view selecionada
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = "block";
        
        // Animar entrada
        targetView.classList.remove("animate-fade-in");
        void targetView.offsetWidth; // Trigger reflow
        targetView.classList.add("animate-fade-in");
    }

    // Atualizar menu ativo
    elements.menuItems.forEach(item => {
        if (item.getAttribute("data-view") === viewName) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Atualizar Título do Cabeçalho
    const activeMenuItem = document.querySelector(`.sidebar-menu .menu-item[data-view="${viewName}"] span`);
    if (activeMenuItem) {
        elements.viewTitle.textContent = activeMenuItem.textContent;
    }

    // Fechar menu mobile se aberto
    closeMobileMenu();

    // Ações específicas de views
    if (viewName === "logs") {
        renderLogs();
    } else if (viewName === "dashboard") {
        const user = Auth.getCurrentUser();
        if (user && user.role === "seller") {
            updateDashboardCounters();
        } else {
            Dashboard.init();
            updateDashboardCounters(); // Ainda atualiza o seller se for vendedor
        }
    } else if (viewName === "crm") {
        CRM.init();
    } else if (viewName === "kanban") {
        Kanban.init();
    } else if (viewName === "proposals") {
        Proposals.init();
    } else if (viewName === "team") {
        Team.init();
    } else if (viewName === "performance") {
        Performance.init();
    } else if (viewName === "goals") {
        Goals.init();
    } else if (viewName === "services") {
        Services.init();
    } else if (viewName === "forecast") {
        Forecast.init();
    } else if (viewName === "ai") {
        VelliaAI.init();
    } else if (viewName === "pricing") {
        Pricing.init();
    } else if (viewName === "integrations") {
        Integrations.init();
    } else if (viewName === "users") {
        import('./users.js').then(m => m.Users.init());
    }
}

// Fechar menu lateral no mobile
function closeMobileMenu() {
    elements.sidebar.classList.remove("open");
    elements.sidebarOverlay.classList.remove("open");
}

// ==========================================================================
// CONFIGURAÇÕES DE TEMA (CLARO/ESCURO)
// ==========================================================================

function setupTheme() {
    const savedTheme = localStorage.getItem("comercial_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("comercial_theme", newTheme);
    
    const user = Auth.getCurrentUser();
    if (user) {
        Audit.logConfigChange(user.email, "THEME_TOGGLE", `Tema alterado para ${newTheme === 'dark' ? 'Escuro' : 'Claro'}.`);
    }
}

// ==========================================================================
// VIEW: LOGS DE AUDITORIA & SEGURANÇA
// ==========================================================================

function renderLogs() {
    if (!elements.logsTableBody) return;
    
    const logs = Store.getLogs();
    const searchQuery = elements.logSearch.value.toLowerCase().trim();
    const filter = window.activeLogFilter || "all";
    
    // Filtragem
    const filteredLogs = logs.filter(log => {
        if (filter === "sdr") {
            const act = log.action.toLowerCase();
            if (!act.includes("sdr") && !act.includes("whatsapp")) return false;
        } else if (filter === "sales") {
            const act = log.action.toLowerCase();
            if (!act.includes("sale") && !act.includes("proposal")) return false;
        } else if (filter === "security") {
            const act = log.action.toLowerCase();
            if (!act.includes("access") && !act.includes("login") && !act.includes("config") && !act.includes("user_created") && !act.includes("sdr_ai_toggle")) return false;
        }

        if (!searchQuery) return true;
        return (
            log.action.toLowerCase().includes(searchQuery) ||
            log.userEmail.toLowerCase().includes(searchQuery) ||
            log.details.toLowerCase().includes(searchQuery) ||
            log.status.toLowerCase().includes(searchQuery)
        );
    });

    if (filteredLogs.length === 0) {
        elements.logsTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    Nenhum log encontrado para a busca.
                </td>
            </tr>
        `;
        return;
    }

    elements.logsTableBody.innerHTML = filteredLogs.map(log => {
        const formattedDate = new Date(log.timestamp).toLocaleString("pt-BR");
        
        let statusBadge = "";
        if (log.status === "SUCCESS") {
            statusBadge = '<span class="badge badge-success" style="background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.25);">Sucesso</span>';
        } else if (log.status === "WARN") {
            statusBadge = '<span class="badge badge-warning" style="background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.25);">Aviso</span>';
        } else if (log.status === "ERROR") {
            statusBadge = '<span class="badge badge-danger" style="background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25);">Erro</span>';
        }

        // Custom action badges
        let actionBadge = `<span class="badge badge-info" style="font-family: monospace; letter-spacing: 0px; text-transform: uppercase;">${log.action}</span>`;
        if (log.action.includes("SDR")) {
            actionBadge = `<span class="badge" style="background: rgba(139,92,246,0.12); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.25); font-family: monospace; letter-spacing: 0px; font-weight: 700; text-transform: uppercase;">🤖 ${log.action}</span>`;
        } else if (log.action.includes("WHATSAPP")) {
            actionBadge = `<span class="badge" style="background: rgba(37,211,102,0.12); color: #16a34a; border: 1px solid rgba(37,211,102,0.25); font-family: monospace; letter-spacing: 0px; font-weight: 700; text-transform: uppercase;">💬 ${log.action}</span>`;
        } else if (log.action.includes("SALE_WON")) {
            actionBadge = `<span class="badge" style="background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); font-family: monospace; letter-spacing: 0px; font-weight: 700; text-transform: uppercase;">🏆 ${log.action}</span>`;
        } else if (log.action.includes("SALE_LOST")) {
            actionBadge = `<span class="badge" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); font-family: monospace; letter-spacing: 0px; font-weight: 700; text-transform: uppercase;">📉 ${log.action}</span>`;
        } else if (log.action.includes("ACCESS_DENIED")) {
            actionBadge = `<span class="badge" style="background: rgba(220,38,38,0.15); color: #dc2626; border: 1px solid rgba(220,38,38,0.3); font-family: monospace; letter-spacing: 0px; font-weight: 800; text-transform: uppercase; animation: pulse-status 2s infinite;">🚨 ${log.action}</span>`;
        }

        return `
            <tr style="transition: all 0.2s; border-bottom: 1px solid var(--border-color);" onmouseover="this.style.background='var(--bg-surface-hover)'" onmouseout="this.style.background='transparent'">
                <td style="font-weight: 500; font-family: monospace; font-size: 12px; color: var(--text-secondary);">${formattedDate}</td>
                <td><strong style="color: var(--text-primary); font-size: 12.5px;">${log.userEmail}</strong></td>
                <td>${actionBadge}</td>
                <td style="color: var(--text-secondary); max-width: 400px; word-break: break-word; font-size: 12.5px;">${log.details}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join("");
}

// ==========================================================================
// VIEW: DASHBOARD METRICS
// ==========================================================================

function updateDashboardCounters() {
    try {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        const execSection = document.getElementById("dashboard-exec");
        const sellerSection = document.getElementById("dashboard-seller");

        const leads = Store.getLeads();
        const proposals = JSON.parse(localStorage.getItem("comercial_proposals")) || [];

        // Calcular KPIs globais/executivos
        const revenue = proposals
            .filter(p => p.status === "Ganho" || p.status === "Cliente Fechado")
            .reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

        const wins = proposals.filter(p => p.status === "Ganho" || p.status === "Cliente Fechado").length;
        const totalProposals = proposals.length;
        const conversion = totalProposals > 0 ? Math.round((wins / totalProposals) * 100) : 0;

        // =====================================================================
        // DASHBOARD DO VENDEDOR (OPERACIONAL)
        // =====================================================================
        if (currentUser.role === "seller") {
            if (execSection) execSection.style.display = "none";
            if (sellerSection) sellerSection.style.display = "block";

            // KPIs filtrados apenas pelos leads do vendedor logado
            const myLeads = leads.filter(l => l.owner === currentUser.email);
            const myActive = myLeads.filter(l => l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido");

            // Mês atual
            const now = new Date();
            const myClosedThisMonth = myLeads.filter(l => {
                if (l.stage !== "Cliente Fechado") return false;
                const hist = l.stageHistory || [];
                return hist.some(h => {
                    const d = new Date(h.timestamp);
                    return h.stage === "Cliente Fechado" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });
            });

            const myRevenue = proposals
                .filter(p => (p.status === "Ganho" || p.status === "Cliente Fechado") && p.ownerEmail === currentUser.email)
                .reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

            // Preencher KPIs
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl("seller-leads-total", myLeads.length);
            setEl("seller-active-negotiations", myActive.length);
            setEl("seller-closed-month", myClosedThisMonth.length);
            setEl("seller-revenue", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(myRevenue));

            // Meta mensal — buscar meta do store ou usar R$ 30.000 padrão
            const goals = JSON.parse(localStorage.getItem("comercial_goals")) || [];
            const myGoal = goals.find(g => g.ownerEmail === currentUser.email && g.period === "monthly") || { target: 30000 };
            const goalTarget = myGoal.target || 30000;
            const goalPct = Math.min(100, Math.round((myRevenue / goalTarget) * 100));

            const goalBar = document.getElementById("seller-goal-bar");
            if (goalBar) setTimeout(() => { goalBar.style.width = `${goalPct}%`; }, 100);
            setEl("seller-goal-label", `${goalPct}% atingido`);
            const goalTargetEl = document.getElementById("seller-goal-target");
            if (goalTargetEl) goalTargetEl.textContent = `Meta: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(goalTarget)}`;

            // Saudação personalizada
            const hour = now.getHours();
            const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
            const firstName = currentUser.name.split(" ")[0];
            setEl("seller-greeting-text", `${greet}, ${firstName}! 👋`);
            setEl("seller-greeting-sub", `Você tem ${myActive.length} lead${myActive.length !== 1 ? "s" : ""} em aberto. Bora fechar negócio!`);

            // Pipeline por etapa
            renderSellerPipeline(myLeads);

            // Tarefas do dia
            renderSellerDailyTasks(currentUser.email);
            setupDailyTaskEvents(currentUser.email);

            // Leads sem contato
            renderSellerLeadsNoContact(myActive);

            // IA
            renderSellerAIRecommendations();

            // Ações rápidas
            setupSellerQuickActions();

            // Notificações push de novos leads atribuídos
            checkAndNotifyNewLeads(currentUser.email, myLeads);

        } else {
            // =====================================================================
            // DASHBOARD GERENTE / ADMIN (EXECUTIVO)
            // =====================================================================
            if (execSection) execSection.style.display = "block";
            if (sellerSection) sellerSection.style.display = "none";

            const execLeadsCounter = document.getElementById("exec-leads-total");
            if (execLeadsCounter) execLeadsCounter.textContent = leads.length;

            const execRevCounter = document.getElementById("exec-revenue");
            if (execRevCounter) {
                execRevCounter.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenue);
            }

            const execConvCounter = document.getElementById("exec-conversion");
            if (execConvCounter) execConvCounter.textContent = `${conversion}%`;
        }

    } catch (e) {
        console.error("Erro ao atualizar contadores do dashboard:", e);
    }
}

// Pipeline mini-kanban por etapa
function renderSellerPipeline(myLeads) {
    const container = document.getElementById("seller-pipeline-stages");
    if (!container) return;

    const stages = ["Contato", "Lead Gerado", "Lead Qualificado", "Proposta Enviada", "Negociação", "Cliente Fechado"];
    const stageColors = { "Contato": "#94a3b8", "Lead Gerado": "#6366f1", "Lead Qualificado": "#f59e0b", "Proposta Enviada": "#3b82f6", "Negociação": "#f97316", "Cliente Fechado": "#10b981" };

    container.innerHTML = stages.map(stage => {
        const count = myLeads.filter(l => l.stage === stage).length;
        const color = stageColors[stage] || "var(--primary)";
        return `
            <div style="flex: 1; min-width: 110px; text-align: center; padding: 14px 10px; border-radius: 10px; background: var(--bg-surface); border: 1px solid var(--border-color);">
                <div style="font-size: 22px; font-weight: 800; color: ${color}; margin-bottom: 4px;">${count}</div>
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; line-height: 1.3;">${stage}</div>
                <div style="margin-top: 8px; height: 3px; border-radius: 2px; background: ${color}; opacity: 0.35;"></div>
            </div>
        `;
    }).join("");
}

// Tarefas diárias (armazenadas em localStorage por usuário)
function renderSellerDailyTasks(userEmail) {
    const container = document.getElementById("seller-daily-tasks");
    if (!container) return;

    const key = `seller_tasks_${userEmail}`;
    const todayKey = new Date().toLocaleDateString("pt-BR");
    let tasks = JSON.parse(localStorage.getItem(key) || "[]");

    // Zerar tarefas de outro dia
    tasks = tasks.filter(t => t.date === todayKey);
    localStorage.setItem(key, JSON.stringify(tasks));

    if (tasks.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 16px 0;">Nenhuma tarefa para hoje. Adicione uma!</p>`;
        return;
    }

    const priorityBadge = p => {
        if (p === "high") return `<span style="background: rgba(220,38,38,0.1); color: #dc2626; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-right: 4px;">ALTA</span>`;
        if (p === "low") return `<span style="background: rgba(22,163,74,0.1); color: #16a34a; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-right: 4px;">BAIXA</span>`;
        return "";
    };

    container.innerHTML = tasks.map((t, i) => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); transition: all 0.2s; ${t.done ? "opacity: 0.5;" : ""}">
            <input type="checkbox" id="task-${i}" ${t.done ? "checked" : ""} onchange="window.toggleDailyTask('${userEmail}', ${i})"
                style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; flex-shrink: 0;">
            <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                ${priorityBadge(t.priority)}
                ${t.assignedBy ? `<span style="background: rgba(99,102,241,0.1); color: var(--primary); padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 700; border: 1px solid rgba(99,102,241,0.25);">GESTOR</span>` : ""}
                <label for="task-${i}" style="font-size: 13px; cursor: pointer; text-decoration: ${t.done ? "line-through" : "none"}; color: var(--text-primary);">${t.text}</label>
            </div>
            <button onclick="window.deleteDailyTask('${userEmail}', ${i})" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px; display: flex;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    `).join("");
}

function setupDailyTaskEvents(userEmail) {
    const addBtn = document.getElementById("btn-add-task");
    const taskForm = document.getElementById("new-task-form");
    const taskInput = document.getElementById("new-task-input");
    const saveBtn = document.getElementById("btn-save-task");

    if (addBtn && taskForm) {
        addBtn.onclick = () => {
            taskForm.style.display = taskForm.style.display === "none" ? "flex" : "none";
            if (taskForm.style.display === "flex") taskInput?.focus();
        };
    }

    if (saveBtn && taskInput) {
        const save = () => {
            const text = taskInput.value.trim();
            if (!text) return;
            const key = `seller_tasks_${userEmail}`;
            const today = new Date().toLocaleDateString("pt-BR");
            const tasks = JSON.parse(localStorage.getItem(key) || "[]").filter(t => t.date === today);
            tasks.push({ text, done: false, date: today });
            localStorage.setItem(key, JSON.stringify(tasks));
            taskInput.value = "";
            taskForm.style.display = "none";
            renderSellerDailyTasks(userEmail);
        };
        saveBtn.onclick = save;
        taskInput.onkeydown = (e) => { if (e.key === "Enter") save(); };
    }

    window.toggleDailyTask = (email, idx) => {
        const key = `seller_tasks_${email}`;
        const today = new Date().toLocaleDateString("pt-BR");
        const tasks = JSON.parse(localStorage.getItem(key) || "[]").filter(t => t.date === today);
        if (tasks[idx]) tasks[idx].done = !tasks[idx].done;
        localStorage.setItem(key, JSON.stringify(tasks));
        renderSellerDailyTasks(email);
    };

    window.deleteDailyTask = (email, idx) => {
        const key = `seller_tasks_${email}`;
        const today = new Date().toLocaleDateString("pt-BR");
        const tasks = JSON.parse(localStorage.getItem(key) || "[]").filter(t => t.date === today);
        tasks.splice(idx, 1);
        localStorage.setItem(key, JSON.stringify(tasks));
        renderSellerDailyTasks(email);
    };
}

// Notificação push: detecta novos leads atribuídos desde o último check
function checkAndNotifyNewLeads(userEmail, myLeads) {
    const lastCheckKey = `seller_last_check_${userEmail}`;
    const lastCheck = localStorage.getItem(lastCheckKey) ? new Date(localStorage.getItem(lastCheckKey)) : new Date(0);
    const now = new Date();

    const newLeads = myLeads.filter(l => {
        const created = new Date(l.createdAt || 0);
        return created > lastCheck;
    });

    if (newLeads.length > 0) {
        // Notificação nativa do navegador
        Notifications.sendNativeNotification(
            `🎉 ${newLeads.length} novo${newLeads.length > 1 ? "s lead" : " lead"} atribuído!`,
            `${newLeads.map(l => l.company).join(", ")} — Vellia CRM`
        );
        // Adicionar ao painel de notificações interno
        newLeads.forEach(l => {
            Notifications.addItem({
                id: `new-lead-${l.id}`,
                type: "lead",
                title: "Novo Lead Atribuído!",
                message: `${l.company} foi atribuído para você.`,
                timestamp: new Date().toISOString()
            });
        });
    }

    localStorage.setItem(lastCheckKey, now.toISOString());
}



// Auxiliar: Renderizar recomendações inteligentes da IA
function renderSellerAIRecommendations() {
    const container = document.getElementById("seller-ai-recommendations");
    const cardWrapper = document.getElementById("seller-ai-recommendations-card");
    if (!container) return;

    const ctx = analyzeContext();
    const recommendations = [];

    // 1. Propostas em Risco (Churn)
    if (ctx.atRiskProps && ctx.atRiskProps.length > 0) {
        ctx.atRiskProps.slice(0, 2).forEach(p => {
            recommendations.push({
                type: "danger",
                icon: "⚠️",
                title: "Proposta em Risco",
                desc: `A proposta de <strong>${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(p.value || 0)}</strong> para a <strong>${p.company}</strong> está com risco de perda elevado.`,
                actionText: "Ajustar Negociação",
                onClick: `window.location.hash = '#proposals';`
            });
        });
    }

    // 2. Leads Frios (Sem contato há 14 dias ou mais)
    if (ctx.coldLeads && ctx.coldLeads.length > 0) {
        ctx.coldLeads.slice(0, 2).forEach(l => {
            const hist = l.stageHistory || [];
            const last = hist.length ? new Date(hist[hist.length - 1].timestamp) : new Date(0);
            const days = Math.round((ctx.now - last.getTime()) / ctx.ONE_DAY);
            recommendations.push({
                type: "warning",
                icon: "🧊",
                title: "Reatar Contato",
                desc: `A empresa <strong>${l.company}</strong> está sem contato há <strong>${days} dias</strong>. Envie um WhatsApp!`,
                actionText: "Falar com Lead",
                onClick: `window.location.hash = '#crm'; setTimeout(() => import('./crm.js').then(m => m.CRM.openLeadDrawer('${l.id}')), 100);`
            });
        });
    }

    // 3. Leads Quentes (Lead Scoring Alto)
    if (ctx.scoredLeads && ctx.scoredLeads.length > 0) {
        const topQuentes = ctx.scoredLeads.filter(l => l._score >= 70);
        topQuentes.slice(0, 2).forEach(l => {
            recommendations.push({
                type: "success",
                icon: "🔥",
                title: "Oportunidade Quente",
                desc: `<strong>${l.company}</strong> tem score de engajamento alto (<strong>${l._score} pts</strong>). Proponha fechamento!`,
                actionText: "Tentar Fechar",
                onClick: `window.location.hash = '#crm'; setTimeout(() => import('./crm.js').then(m => m.CRM.openLeadDrawer('${l.id}')), 100);`
            });
        });
    }

    if (recommendations.length === 0) {
        if (cardWrapper) cardWrapper.style.display = "none";
        return;
    } else {
        if (cardWrapper) cardWrapper.style.display = "block";
    }

    container.innerHTML = recommendations.map(rec => `
        <div class="ai-recommendation-item type-${rec.type}" style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid var(--${rec.type === 'danger' ? 'danger' : rec.type === 'warning' ? 'warning' : 'success'}); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
            <div style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px;">
                <div style="font-size: 20px; padding: 6px; background: var(--bg-app); border-radius: var(--radius-sm);">${rec.icon}</div>
                <div>
                    <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 3px;">${rec.title}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${rec.desc}</div>
                </div>
            </div>
            <button class="btn btn-outline" style="font-size: 11px; padding: 6px 12px; height: auto; align-self: flex-end;" onclick="${rec.onClick}">
                ${rec.actionText} &rarr;
            </button>
        </div>
    `).join("");
}

// Auxiliar: Renderizar leads sem contato recente
function renderSellerLeadsNoContact(activeLeads) {
    const container = document.getElementById("seller-leads-no-contact");
    if (!container) return;

    // Calcular dias sem contato para cada lead ativo
    const leadsWithTime = activeLeads.map(lead => {
        let lastDate = new Date();
        if (lead.interactions && lead.interactions.length > 0) {
            const sorted = [...lead.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            lastDate = new Date(sorted[0].timestamp);
        } else if (lead.stageHistory && lead.stageHistory.length > 0) {
            const sorted = [...lead.stageHistory].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            lastDate = new Date(sorted[0].timestamp);
        }
        const diffTime = Math.abs(new Date() - lastDate);
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return { lead, days };
    });

    // Ordenar decrescente (mais dias sem contato primeiro)
    leadsWithTime.sort((a, b) => b.days - a.days);

    if (leadsWithTime.length === 0) {
        container.innerHTML = `
            <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0;">
                Tudo em dia! Sem leads pendentes de contato.
            </div>
        `;
        return;
    }

    // Mostrar os top 3 leads
    container.innerHTML = leadsWithTime.slice(0, 3).map(item => {
        let timeColor = "var(--text-muted)";
        if (item.days >= 7) timeColor = "var(--danger)";
        else if (item.days >= 3) timeColor = "var(--warning)";

        return `
            <div class="priorities-list-item" onclick="window.location.hash = '#crm'; setTimeout(() => import('./crm.js').then(m => m.CRM.openLeadDrawer('${item.lead.id}')), 100);">
                <div>
                    <div class="priority-title">${item.lead.company}</div>
                    <div class="priority-meta">${item.lead.contact} • Estágio: ${item.lead.stage}</div>
                </div>
                <span style="color: ${timeColor}; font-weight: 600; font-size: 12px;">
                    ⚠️ ${item.days === 0 ? 'Hoje' : `${item.days} dias s/ contato`}
                </span>
            </div>
        `;
    }).join("");
}

// Auxiliar: Sugerir atividades baseadas no estágio dos leads
function renderSellerActivities(activeLeads) {
    const container = document.getElementById("seller-upcoming-activities");
    if (!container) return;

    if (activeLeads.length === 0) {
        container.innerHTML = `
            <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0;">
                Nenhuma tarefa pendente. Cadastre novos leads para começar!
            </div>
        `;
        return;
    }

    // Gerar atividades mockadas inteligentes com base nas etapas reais dos leads ativos
    const activities = [];
    activeLeads.forEach(lead => {
        if (lead.stage === "Contato" || lead.stage === "Lead Gerado") {
            activities.push({
                leadId: lead.id,
                title: `Qualificar lead de ${lead.company}`,
                meta: `Ligar para ${lead.contact} e validar necessidades comerciais.`,
                badge: "Qualificação",
                badgeClass: "badge-info"
            });
        } else if (lead.stage === "Lead Qualificado") {
            activities.push({
                leadId: lead.id,
                title: `Elaborar proposta comercial para ${lead.company}`,
                meta: `Preparar simulação técnica/comercial para o cargo: ${lead.role || 'Contato'}.`,
                badge: "Proposta",
                badgeClass: "badge-warning"
            });
        } else if (lead.stage === "Proposta Enviada" || lead.stage === "Negociação") {
            activities.push({
                leadId: lead.id,
                title: `Follow-up de negociação com ${lead.company}`,
                meta: `Retornar contato com ${lead.contact} via WhatsApp: ${lead.whatsapp}.`,
                badge: "Negociação",
                badgeClass: "badge-warning"
            });
        }
    });

    if (activities.length === 0) {
        container.innerHTML = `
            <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0;">
                Sem atividades pendentes para os leads atuais.
            </div>
        `;
        return;
    }

    // Exibir no máximo 3 atividades
    container.innerHTML = activities.slice(0, 3).map(act => {
        return `
            <div class="priorities-list-item" onclick="window.location.hash = '#crm'; setTimeout(() => import('./crm.js').then(m => m.CRM.openLeadDrawer('${act.leadId}')), 100);">
                <div style="flex-grow: 1; padding-right: 12px;">
                    <div class="priority-title">${act.title}</div>
                    <div class="priority-meta">${act.meta}</div>
                </div>
                <span class="badge ${act.badgeClass}" style="flex-shrink: 0;">${act.badge}</span>
            </div>
        `;
    }).join("");
}

// Auxiliar: Configurar atalhos de ações rápidas
function setupSellerQuickActions() {

    // ---- Ativar Cards KPI como botões clicáveis ----
    const kpiCards = [
        { ids: ["seller-leads-total"],           route: "crm",       title: "Contatos & Leads" },
        { ids: ["seller-active-negotiations"],    route: "kanban",    title: "Funil Kanban" },
        { ids: ["seller-closed-month"],          route: "proposals", title: "Propostas & Vendas" },
        { ids: ["seller-revenue"],               route: "proposals", title: "Propostas & Vendas" },
    ];

    kpiCards.forEach(({ ids, route }) => {
        ids.forEach(id => {
            // Sobe até o card pai (div.card.stat-card)
            const el = document.getElementById(id);
            if (!el) return;
            const card = el.closest(".card, .stat-card") || el.parentElement?.parentElement;
            if (!card) return;

            // Estilo de botão interativo
            card.style.cursor = "pointer";
            card.style.transition = "transform 0.18s ease, box-shadow 0.18s ease";
            card.addEventListener("mouseenter", () => {
                card.style.transform = "translateY(-3px)";
                card.style.boxShadow = "0 8px 24px rgba(99,102,241,0.18)";
            });
            card.addEventListener("mouseleave", () => {
                card.style.transform = "";
                card.style.boxShadow = "";
            });
            card.addEventListener("click", () => {
                window.location.hash = route;
            });
        });
    });

    // ---- Botão Novo Lead (saudação + barra de ações) ----
    document.querySelectorAll("#btn-quick-new-lead").forEach(btn => {
        // Remover listeners antigos clonando o elemento
        const fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
        fresh.addEventListener("click", () => {
            import('./crm.js').then(m => {
                window.location.hash = "crm";
                setTimeout(() => m.CRM.openNewLeadModal(), 250);
            });
        });
    });

    // ---- Registrar Ligação → vai para CRM e destaca a lista ----
    const btnCall = document.getElementById("btn-quick-log-call");
    if (btnCall) {
        const fresh = btnCall.cloneNode(true);
        btnCall.parentNode.replaceChild(fresh, btnCall);
        fresh.addEventListener("click", () => {
            window.location.hash = "crm";
        });
    }

    // ---- Registrar Reunião → vai para CRM ----
    const btnMeeting = document.getElementById("btn-quick-log-meeting");
    if (btnMeeting) {
        const fresh = btnMeeting.cloneNode(true);
        btnMeeting.parentNode.replaceChild(fresh, btnMeeting);
        fresh.addEventListener("click", () => {
            window.location.hash = "crm";
        });
    }

    // ---- Atualizar Negociação → vai para Kanban ----
    const btnStage = document.getElementById("btn-quick-change-stage");
    if (btnStage) {
        const fresh = btnStage.cloneNode(true);
        btnStage.parentNode.replaceChild(fresh, btnStage);
        fresh.addEventListener("click", () => {
            window.location.hash = "kanban";
        });
    }

    // ---- Fechar Venda → vai para Kanban ----
    const btnClose = document.getElementById("btn-quick-close-sale");
    if (btnClose) {
        const fresh = btnClose.cloneNode(true);
        btnClose.parentNode.replaceChild(fresh, btnClose);
        fresh.addEventListener("click", () => {
            window.location.hash = "kanban";
        });
    }
}




// ==========================================================================
// CONFIGURAÇÃO DOS EVENT LISTENERS
// ==========================================================================

function setupEventListeners() {
    // Form de Login
    elements.loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword.value;
        
        const result = Auth.login(email, password);
        if (result.success) {
            showAppShell(result.user);
        } else {
            elements.loginErrorText.textContent = result.error;
            elements.loginError.style.display = "flex";
            elements.loginError.classList.add("animate-fade-in");
        }
    });

    // Logout
    elements.btnLogout.addEventListener("click", () => {
        Auth.logout();
    });

    // Alterar Minha Senha
    const btnChangePwd = document.getElementById("btn-change-password");
    if (btnChangePwd) {
        btnChangePwd.addEventListener("click", () => {
            import('./users.js').then(m => m.Users.openChangePasswordModal());
        });
    }

    // Alternar Tema
    elements.btnThemeToggle.addEventListener("click", () => {
        toggleTheme();
    });

    // Sidebar Hamburger (Mobile & Desktop)
    elements.menuToggleBtn.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
            elements.sidebar.classList.add("open");
            elements.sidebarOverlay.classList.add("open");
        } else {
            const wrapper = document.querySelector(".app-wrapper");
            if (wrapper) {
                wrapper.classList.toggle("sidebar-collapsed");
                // Disparar redimensionamento para ajustar gráficos após a transição
                setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
            }
        }
    });

    // Mobile Overlay Click
    elements.sidebarOverlay.addEventListener("click", () => {
        closeMobileMenu();
    });

    // Configurar Cliques de Acesso Rápido na tela de login
    elements.presetBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const email = e.currentTarget.getAttribute("data-email");
            elements.loginEmail.value = email;
            elements.loginPassword.value = "123456"; // Senha padrão das sementes
            elements.loginForm.dispatchEvent(new Event("submit"));
        });
    });

    // Roteamento SPA ao clicar na Sidebar
    elements.menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const viewName = item.getAttribute("data-view");
            window.location.hash = viewName;
        });
    });

    // Escutar mudança de Hash do Navegador para Roteamento SPA
    window.addEventListener("hashchange", () => {
        const viewName = window.location.hash.replace("#", "") || "dashboard";
        navigateTo(viewName);
    });

    // Logs view listeners
    if (elements.logSearch) {
        elements.logSearch.addEventListener("input", renderLogs);
    }
    if (elements.btnRefreshLogs) {
        elements.btnRefreshLogs.addEventListener("click", renderLogs);
    }
    if (elements.btnClearLogs) {
        elements.btnClearLogs.addEventListener("click", () => {
            if (confirm("Tem certeza que deseja apagar todos os registros de logs? Esta ação é irreversível.")) {
                Store.clearLogs();
                renderLogs();
            }
        });
    }

    // Ouvinte para os filtros de Logs
    const logFiltersContainer = document.getElementById("log-filters");
    if (logFiltersContainer) {
        logFiltersContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".log-filter-btn");
            if (btn) {
                document.querySelectorAll(".log-filter-btn").forEach(b => {
                    b.classList.remove("active");
                    b.style.border = "1px solid var(--border-color)";
                    b.style.background = "var(--bg-surface)";
                    b.style.color = "var(--text-secondary)";
                });
                btn.classList.add("active");
                btn.style.border = "1px solid var(--primary)";
                btn.style.background = "var(--primary-glow)";
                btn.style.color = "var(--primary)";
                
                window.activeLogFilter = btn.dataset.type;
                renderLogs();
            }
        });
    }

    // Ouvir disparos do simulador de WhatsApp para atualizar visões ativas
    window.addEventListener("vellia:waSent", () => {
        const currentHash = window.location.hash.replace("#", "") || "dashboard";
        if (currentHash === "dashboard") {
            const user = Auth.getCurrentUser();
            if (user && user.role === "seller") {
                updateDashboardCounters();
            } else {
                Dashboard.init();
                updateDashboardCounters();
            }
        } else if (currentHash === "performance") {
            Performance.init();
        } else if (currentHash === "team") {
            Team.init();
        } else if (currentHash === "goals") {
            Goals.init();
        }
    });
}

// Iniciar a aplicação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", initApp);
// Se o script for carregado de forma assíncrona ou em módulo, pode rodar logo:
initApp();
