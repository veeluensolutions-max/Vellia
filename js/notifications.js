import { analyzeContext } from "./ai.js";

export const Notifications = {
    panel: null,
    btn: null,
    badge: null,
    list: null,
    markAllBtn: null,
    items: [],

    init() {
        this.panel = document.getElementById("notifications-panel");
        this.btn = document.getElementById("btn-notifications");
        this.badge = document.getElementById("notif-badge");
        this.list = document.getElementById("notif-list");
        this.markAllBtn = document.getElementById("btn-mark-all-read");

        if (!this.panel || !this.btn) return;

        this.bindEvents();
        this.generateContextualNotifications();
        this.render();
    },

    bindEvents() {
        this.btn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        document.addEventListener("click", (e) => {
            if (this.panel.style.display === "flex" && !this.panel.contains(e.target) && e.target !== this.btn) {
                this.closePanel();
            }
        });

        if (this.markAllBtn) {
            this.markAllBtn.addEventListener("click", () => {
                this.items.forEach(item => item.read = true);
                this.render();
            });
        }
    },

    togglePanel() {
        const isHidden = this.panel.style.display === "none";
        this.panel.style.display = isHidden ? "flex" : "none";
    },

    closePanel() {
        this.panel.style.display = "none";
    },

    generateContextualNotifications() {
        const ctx = analyzeContext();
        this.items = [];

        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) {
            ctx.atRiskProps.forEach(p => {
                this.items.push({
                    id: 'risk_' + p.id,
                    title: "Risco de Churn Elevado",
                    message: `A proposta da ${p.company} apresenta alto risco de perda.`,
                    type: "danger",
                    read: false,
                    timestamp: new Date()
                });
            });
        }

        if (ctx.expiringProps && ctx.expiringProps.length > 0) {
            ctx.expiringProps.forEach(p => {
                if (!this.items.find(i => i.id === 'risk_' + p.id)) {
                    this.items.push({
                        id: 'exp_' + p.id,
                        title: "Proposta Vencendo",
                        message: `A proposta para ${p.company} vencerá em menos de 7 dias.`,
                        type: "warning",
                        read: false,
                        timestamp: new Date()
                    });
                }
            });
        }

        if (ctx.coldLeads && ctx.coldLeads.length > 0) {
            this.items.push({
                id: 'cold_leads',
                title: "Leads Esfriando",
                message: `Você tem ${ctx.coldLeads.length} leads sem contato há mais de 14 dias.`,
                type: "info",
                read: false,
                timestamp: new Date()
            });
        }
    },

    render() {
        if (!this.list || !this.badge) return;

        const unreadCount = this.items.filter(i => !i.read).length;

        if (unreadCount > 0) {
            this.badge.textContent = unreadCount;
            this.badge.style.display = "flex";
        } else {
            this.badge.style.display = "none";
        }

        if (this.items.length === 0) {
            this.list.innerHTML = `<div class="notif-empty">Nenhum alerta inteligente no momento. 🎉</div>`;
            return;
        }

        this.list.innerHTML = this.items.map(item => `
            <div class="notif-item ${item.read ? '' : 'unread'}" data-id="${item.id}">
                <div class="notif-icon ${item.type}">
                    ${this.getIcon(item.type)}
                </div>
                <div class="notif-content">
                    <h4>${item.title}</h4>
                    <p>${item.message}</p>
                    <span class="notif-time">Agora mesmo</span>
                </div>
            </div>
        `).join("");
    },

    getIcon(type) {
        if (type === "danger") return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        if (type === "warning") return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
};
