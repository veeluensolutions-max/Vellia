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
import { VelliaAI } from "./ai.js";
import { Notifications } from "./notifications.js";
import { DataExport } from "./export.js";
import { Team } from "./team.js";
import { Performance } from "./performance.js";
import { WhatsApp } from "./whatsapp.js";
import { Pricing } from "./pricing.js";

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
    presetBtns: document.querySelectorAll(".preset-btn"),
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
            isVisible = viewName !== "logs";
        } else if (role === "seller") {
            // Vendedor vê CRM, Kanban, Propostas, Metas, IA. Não vê Logs, Serviços e Forecast.
            isVisible = !["logs", "services", "forecast"].includes(viewName);
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
    
    // Filtragem
    const filteredLogs = logs.filter(log => {
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
            statusBadge = '<span class="badge badge-success">Sucesso</span>';
        } else if (log.status === "WARN") {
            statusBadge = '<span class="badge badge-warning">Aviso</span>';
        } else if (log.status === "ERROR") {
            statusBadge = '<span class="badge badge-danger">Erro</span>';
        }

        return `
            <tr>
                <td style="font-weight: 500; font-family: monospace;">${formattedDate}</td>
                <td><strong style="color: var(--text-secondary);">${log.userEmail}</strong></td>
                <td><span class="badge badge-info" style="font-family: monospace; letter-spacing: 0px;">${log.action}</span></td>
                <td style="color: var(--text-secondary); max-width: 400px; word-break: break-word;">${log.details}</td>
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

        // Alternar visualização por cargo
        if (currentUser.role === "seller") {
            if (execSection) execSection.style.display = "none";
            if (sellerSection) sellerSection.style.display = "block";

            // Dashboard do Vendedor (Operacional)
            const activeNegotiations = leads.filter(l => l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido");
            
            const activeNegCounter = document.getElementById("seller-active-negotiations");
            if (activeNegCounter) activeNegCounter.textContent = activeNegotiations.length;

            const sellerRevCounter = document.getElementById("seller-revenue");
            if (sellerRevCounter) {
                sellerRevCounter.textContent = new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                }).format(revenue);
            }

            // Exemplo de meta (faturamento simulado, meta de R$ 30.000,00)
            const goalPct = revenue >= 30000 ? 100 : Math.round((revenue / 30000) * 100);
            const sellerGoalCounter = document.getElementById("seller-goal-percentage");
            if (sellerGoalCounter) sellerGoalCounter.textContent = `${goalPct}%`;

            // Carregar Leads Sem Contato Recente
            renderSellerLeadsNoContact(activeNegotiations);

            // Carregar Atividades do Dia (Gargalos baseados nas etapas do Lead)
            renderSellerActivities(activeNegotiations);
            
            // Configurar Ações Rápidas do Vendedor
            setupSellerQuickActions();

        } else {
            // Dashboard Gerente / Admin (Executivo)
            if (execSection) execSection.style.display = "block";
            if (sellerSection) sellerSection.style.display = "none";

            const execLeadsCounter = document.getElementById("exec-leads-total");
            if (execLeadsCounter) execLeadsCounter.textContent = leads.length;

            const execRevCounter = document.getElementById("exec-revenue");
            if (execRevCounter) {
                execRevCounter.textContent = new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL"
                }).format(revenue);
            }

            const execConvCounter = document.getElementById("exec-conversion");
            if (execConvCounter) execConvCounter.textContent = `${conversion}%`;
        }
        
    } catch (e) {
        console.error("Erro ao atualizar contadores do dashboard:", e);
    }
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
            <div class="priorities-list-item" onclick="import('./crm.js').then(m => m.CRM.openLeadDrawer('${item.lead.id}'))">
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
            <div class="priorities-list-item" onclick="import('./crm.js').then(m => m.CRM.openLeadDrawer('${act.leadId}'))">
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
    const actions = {
        btnQuickNewLead: document.getElementById("btn-quick-new-lead"),
        btnQuickLogCall: document.getElementById("btn-quick-log-call"),
        btnQuickLogMeeting: document.getElementById("btn-quick-log-meeting"),
        btnQuickChangeStage: document.getElementById("btn-quick-change-stage"),
        btnQuickCloseSale: document.getElementById("btn-quick-close-sale")
    };

    if (actions.btnQuickNewLead) {
        actions.btnQuickNewLead.addEventListener("click", () => {
            import('./crm.js').then(m => m.CRM.openNewLeadModal());
        });
    }

    const redirectToCRM = () => {
        window.location.hash = "crm";
        setTimeout(() => alert("Selecione o lead desejado na tabela abaixo para abrir os detalhes e efetuar a ação."), 300);
    };

    if (actions.btnQuickLogCall) actions.btnQuickLogCall.addEventListener("click", redirectToCRM);
    if (actions.btnQuickLogMeeting) actions.btnQuickLogMeeting.addEventListener("click", redirectToCRM);
    if (actions.btnQuickChangeStage) actions.btnQuickChangeStage.addEventListener("click", redirectToCRM);
    
    if (actions.btnQuickCloseSale) {
        actions.btnQuickCloseSale.addEventListener("click", () => {
            window.location.hash = "kanban";
            setTimeout(() => alert("Arraste o lead desejado para a coluna 'Cliente Fechado' para consolidar a venda!"), 300);
        });
    }
}

// ==========================================================================
// TEMA (DARK/LIGHT MODE)
// ==========================================================================

function setupTheme() {
    const savedTheme = localStorage.getItem("vellia_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("vellia_theme", newTheme);
}

// ==========================================================================
// CONFIGURAÇÃO DOS EVENT LISTENERS
// ==========================================================================

function setupEventListeners() {
    // Form de Login
    elements.loginForm.addEventListener("submit", () => {
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
