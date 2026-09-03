import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { CRM } from "./crm.js";

export const CommandPalette = {
    isOpen: false,
    selectedIndex: 0,
    currentItems: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Atalho de Teclado Global: Ctrl + K ou Cmd + K
        window.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
                e.preventDefault();
                if (this.isOpen) {
                    this.close();
                } else if (Auth.isAuthenticated()) {
                    this.open();
                }
                return;
            }

            if (e.key === "Escape" && this.isOpen) {
                e.preventDefault();
                this.close();
                return;
            }

            if (!this.isOpen) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                this.navigate(1);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                this.navigate(-1);
            } else if (e.key === "Enter") {
                e.preventDefault();
                this.executeSelected();
            }
        });

        // Trigger no Header
        const triggerBtn = document.getElementById("btn-command-palette-trigger");
        if (triggerBtn) {
            triggerBtn.addEventListener("click", () => {
                if (Auth.isAuthenticated()) this.open();
            });
        }

        // Input de Busca
        const input = document.getElementById("cmd-palette-input");
        if (input) {
            input.addEventListener("input", (e) => {
                this.render(e.target.value.trim());
            });
        }

        // Fechar ao clicar no overlay
        const overlay = document.getElementById("cmd-palette-overlay");
        if (overlay) {
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    this.close();
                }
            });
        }
    },

    open() {
        const overlay = document.getElementById("cmd-palette-overlay");
        const input = document.getElementById("cmd-palette-input");
        if (!overlay || !input) return;

        this.isOpen = true;
        overlay.style.display = "flex";
        input.value = "";
        this.selectedIndex = 0;
        this.render("");

        setTimeout(() => input.focus(), 50);
    },

    close() {
        const overlay = document.getElementById("cmd-palette-overlay");
        if (!overlay) return;

        this.isOpen = false;
        overlay.style.display = "none";
    },

    navigate(direction) {
        if (!this.currentItems || this.currentItems.length === 0) return;
        this.selectedIndex = (this.selectedIndex + direction + this.currentItems.length) % this.currentItems.length;
        this.updateSelection();
    },

    updateSelection() {
        const resultsContainer = document.getElementById("cmd-palette-results");
        if (!resultsContainer) return;

        const itemEls = resultsContainer.querySelectorAll(".cmd-item");
        itemEls.forEach((el, idx) => {
            if (idx === this.selectedIndex) {
                el.classList.add("active");
                el.scrollIntoView({ block: "nearest", behavior: "smooth" });
            } else {
                el.classList.remove("active");
            }
        });
    },

    executeSelected() {
        if (this.currentItems && this.currentItems[this.selectedIndex]) {
            const item = this.currentItems[this.selectedIndex];
            this.close();
            if (typeof item.action === "function") {
                item.action();
            }
        }
    },

    getDefaultActions() {
        const actions = [
            {
                id: "act-new-lead",
                category: "Ações Rápidas",
                title: "Novo Lead / Contato",
                subtitle: "Cadastrar cliente no funil de vendas",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
                badge: "Criar",
                action: () => {
                    if (window.navigateTo) window.navigateTo("crm");
                    setTimeout(() => {
                        const btnAdd = document.getElementById("btn-add-lead");
                        if (btnAdd) btnAdd.click();
                    }, 200);
                }
            },
            {
                id: "act-vision-scanner",
                category: "Inteligência & IA",
                title: "Scanner IA de Documentos & Laudos",
                subtitle: "Escanear laudo, proposta concorrente ou cartão de visita",
                icon: `<span style="font-size:16px;">📷</span>`,
                badge: "Visão IA",
                action: () => {
                    if (window.VisionOCR) window.VisionOCR.openModal();
                }
            },
            {
                id: "act-new-proposal",
                category: "Ações Rápidas",
                title: "Gerar Proposta Comercial",
                subtitle: "Criar novo orçamento com margem e desconto",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
                badge: "Vendas",
                action: () => {
                    if (window.navigateTo) window.navigateTo("proposals");
                    setTimeout(() => {
                        const btn = document.getElementById("btn-new-proposal");
                        if (btn) btn.click();
                    }, 200);
                }
            },
            {
                id: "act-toggle-theme",
                category: "Ações Rápidas",
                title: "Alternar Tema (Claro / Escuro)",
                subtitle: "Trocar entre o visual Clean Light e Deep Dark",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
                badge: "Visual",
                action: () => {
                    const btnTheme = document.getElementById("btn-theme-toggle");
                    if (btnTheme) btnTheme.click();
                }
            },
            {
                id: "act-switch-company",
                category: "Ações Rápidas",
                title: "Alternar Empresa Ativa",
                subtitle: "Alternar entre Veeluen Solutions e Excelência Ambiental",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
                badge: "Workspace",
                action: () => {
                    const select = document.getElementById("workspace-select");
                    if (select) {
                        const nextVal = select.value === "Veeluen Solutions" ? "Excelência Ambiental" : "Veeluen Solutions";
                        select.value = nextVal;
                        if (window.switchCompany) window.switchCompany(nextVal);
                    }
                }
            },
            {
                id: "nav-dashboard",
                category: "Navegação",
                title: "Dashboard Geral & Métricas",
                subtitle: "Visão 360º de faturamento, metas e conversões",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
                badge: "Ir",
                action: () => { if (window.navigateTo) window.navigateTo("dashboard"); }
            },
            {
                id: "nav-crm",
                category: "Navegação",
                title: "Funil de Vendas (Kanban)",
                subtitle: "Pipeline dinâmico de negociações e oportunidades",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg>`,
                badge: "Ir",
                action: () => { if (window.navigateTo) window.navigateTo("crm"); }
            },
            {
                id: "nav-ai",
                category: "Navegação",
                title: "Agentes & Inteligência IA",
                subtitle: "Atendimento automático, guru de vendas e análises",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 11H4a1 1 0 0 1 0-2h.07A8 8 0 0 1 11 4.07V4a1 1 0 0 1 2 0v.07A8 8 0 0 1 19.93 11H20a1 1 0 0 1 0 2h-.07A8 8 0 0 1 13 16.93z"/></svg>`,
                badge: "Ir",
                action: () => { if (window.navigateTo) window.navigateTo("ai-agents"); }
            },
            {
                id: "nav-contracts",
                category: "Navegação",
                title: "Contratos & Pós-Venda",
                subtitle: "Gestão de renovações, faturamento recorrente e cross-selling",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
                badge: "Ir",
                action: () => { if (window.navigateTo) window.navigateTo("contracts"); }
            },
            {
                id: "nav-calendar",
                category: "Navegação",
                title: "Agenda Comercial & Visitas",
                subtitle: "Compromissos, reuniões e vistorias agendadas",
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
                badge: "Ir",
                action: () => { if (window.navigateTo) window.navigateTo("calendar"); }
            }
        ];

        return actions;
    },

    searchLeads(query) {
        const queryLower = query.toLowerCase();
        let leads = [];
        try {
            leads = Store.getLeads() || [];
        } catch (e) {
            leads = [];
        }

        return leads
            .filter(l => {
                const name = (l.name || "").toLowerCase();
                const phone = (l.phone || "").toLowerCase();
                const company = (l.company || "").toLowerCase();
                const stage = (l.stage || "").toLowerCase();
                return name.includes(queryLower) || phone.includes(queryLower) || company.includes(queryLower) || stage.includes(queryLower);
            })
            .slice(0, 8)
            .map(lead => ({
                id: `lead-${lead.id}`,
                category: "Leads & Oportunidades",
                title: lead.name || "Sem Nome",
                subtitle: `${lead.company ? lead.company + " • " : ""}${lead.phone || ""} [${lead.stage || "Contato"}]`,
                icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
                badge: lead.stage || "Lead",
                action: () => {
                    if (window.navigateTo) window.navigateTo("crm");
                    setTimeout(() => {
                        if (CRM && typeof CRM.openLeadDrawer === "function") {
                            CRM.openLeadDrawer(lead.id);
                        } else if (CRM && typeof CRM.openLeadModal === "function") {
                            CRM.openLeadModal(lead.id);
                        }
                    }, 250);
                }
            }));
    },

    render(query = "") {
        const resultsContainer = document.getElementById("cmd-palette-results");
        if (!resultsContainer) return;

        let items = [];
        const defaultActions = this.getDefaultActions();

        if (!query) {
            items = defaultActions;
        } else {
            const queryLower = query.toLowerCase();
            const filteredActions = defaultActions.filter(a =>
                a.title.toLowerCase().includes(queryLower) ||
                a.subtitle.toLowerCase().includes(queryLower) ||
                a.category.toLowerCase().includes(queryLower)
            );
            const leadItems = this.searchLeads(query);
            items = [...filteredActions, ...leadItems];
        }

        this.currentItems = items;
        this.selectedIndex = 0;

        if (items.length === 0) {
            resultsContainer.innerHTML = `
                <div class="cmd-empty-state">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <p>Nenhum resultado encontrado para "<strong>${query}</strong>"</p>
                    <span>Tente buscar pelo nome do cliente, telefone ou ação.</span>
                </div>
            `;
            return;
        }

        // Agrupar por categorias
        const categories = {};
        items.forEach((item, index) => {
            if (!categories[item.category]) categories[item.category] = [];
            categories[item.category].push({ ...item, globalIndex: index });
        });

        let html = "";
        Object.keys(categories).forEach(cat => {
            html += `<div class="cmd-category-title">${cat}</div>`;
            categories[cat].forEach(item => {
                const isSelected = item.globalIndex === this.selectedIndex;
                html += `
                    <div class="cmd-item ${isSelected ? "active" : ""}" data-index="${item.globalIndex}">
                        <div class="cmd-item-icon">${item.icon}</div>
                        <div class="cmd-item-info">
                            <div class="cmd-item-title">${item.title}</div>
                            <div class="cmd-item-subtitle">${item.subtitle}</div>
                        </div>
                        <span class="cmd-item-badge">${item.badge}</span>
                    </div>
                `;
            });
        });

        resultsContainer.innerHTML = html;

        // Clique direto nos itens
        const itemEls = resultsContainer.querySelectorAll(".cmd-item");
        itemEls.forEach(el => {
            el.addEventListener("click", () => {
                const idx = parseInt(el.getAttribute("data-index"), 10);
                this.selectedIndex = idx;
                this.executeSelected();
            });
            el.addEventListener("mouseenter", () => {
                const idx = parseInt(el.getAttribute("data-index"), 10);
                this.selectedIndex = idx;
                this.updateSelection();
            });
        });
    }
};
