import { analyzeContext } from "./ai.js";
import { Auth } from "./auth.js";

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
        this.requestNativePermission();
        this.generateContextualNotifications();
        this.render();
    },

    requestNativePermission() {
        if ("Notification" in window && Notification.permission === "default") {
            this.btn.addEventListener("click", () => {
                if (Notification.permission === "default") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            this.sendNativeNotification("Vellia CRM 🔔", "Notificações de Área de Trabalho ativadas com sucesso!");
                        }
                    });
                }
            }, { once: true });
        }
    },

    sendNativeNotification(title, message) {
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                new Notification(title, {
                    body: message,
                    icon: "https://velliacrm.vercel.app/favicon.ico"
                });
            } catch (err) {
                console.error("Falha ao enviar notificação nativa:", err);
            }
        }
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

        if (this.list) {
            this.list.addEventListener("click", (e) => {
                const itemEl = e.target.closest(".notif-item");
                if (itemEl) {
                    const id = itemEl.getAttribute("data-id");
                    const item = this.items.find(i => i.id === id);
                    if (item) {
                        item.read = true;
                        this.render();
                        this.closePanel();
                        
                        // Redirecionamento inteligente
                        if (id.startsWith("risk_") || id.startsWith("exp_")) {
                            const propId = id.split("_")[1];
                            window.location.hash = "#proposals";
                            setTimeout(() => {
                                const propEl = document.querySelector(`.proposal-row[data-id="${propId}"], .kanban-card[data-id="${propId}"]`);
                                if (propEl) propEl.click();
                            }, 300);
                        } else if (id === "cold_leads") {
                            window.location.hash = "#team";
                            setTimeout(() => {
                                const tabBtn = document.querySelector('.subtab-btn[data-subtab="team-forecast"]');
                                if (tabBtn) tabBtn.click();
                            }, 100);
                        }
                    }
                }
            });
        }
    },

    togglePanel() {
        const isHidden = !this.panel.style.display || this.panel.style.display === "none";
        this.panel.style.display = isHidden ? "flex" : "none";
    },

    closePanel() {
        this.panel.style.display = "none";
    },

    generateContextualNotifications() {
        const ctx = analyzeContext();
        this.items = [];
        const currentUser = Auth.getCurrentUser();
        const sentNotifications = JSON.parse(sessionStorage.getItem("sent_native_notifications") || "[]");
        let updated = false;

        const addNotification = (item) => {
            this.items.push(item);
            if (!sentNotifications.includes(item.id)) {
                this.sendNativeNotification(item.title, item.message);
                sentNotifications.push(item.id);
                updated = true;
            }
        };

        // Filtrar contexto conforme permissão e responsabilidade do vendedor
        let relevantRiskProps = ctx.atRiskProps || [];
        let relevantExpiringProps = ctx.expiringProps || [];
        let relevantColdLeads = ctx.coldLeads || [];

        if (currentUser && currentUser.role === "seller") {
            relevantRiskProps = relevantRiskProps.filter(p => p.createdBy === currentUser.email || p.ownerEmail === currentUser.email);
            relevantExpiringProps = relevantExpiringProps.filter(p => p.createdBy === currentUser.email || p.ownerEmail === currentUser.email);
            relevantColdLeads = relevantColdLeads.filter(l => l.owner === currentUser.email);
        }

        if (relevantRiskProps.length > 0) {
            relevantRiskProps.forEach(p => {
                addNotification({
                    id: 'risk_' + p.id,
                    title: "Risco de Churn Elevado ⚠️",
                    message: `A proposta da ${p.company} apresenta alto risco de perda.`,
                    type: "danger",
                    read: false,
                    timestamp: new Date()
                });
            });
        }

        if (relevantExpiringProps.length > 0) {
            relevantExpiringProps.forEach(p => {
                if (!this.items.find(i => i.id === 'risk_' + p.id)) {
                    addNotification({
                        id: 'exp_' + p.id,
                        title: "Proposta Vencendo ⏳",
                        message: `A proposta para ${p.company} vencerá em menos de 7 dias.`,
                        type: "warning",
                        read: false,
                        timestamp: new Date()
                    });
                }
            });
        }

        if (relevantColdLeads.length > 0) {
            addNotification({
                id: 'cold_leads',
                title: "Leads Esfriando ❄️",
                message: currentUser && currentUser.role === "seller" 
                    ? `Você tem ${relevantColdLeads.length} leads sem contato há mais de 14 dias.`
                    : `Existem ${relevantColdLeads.length} leads esfriando na equipe comercial.`,
                type: "info",
                read: false,
                timestamp: new Date()
            });
        }

        if (updated) {
            sessionStorage.setItem("sent_native_notifications", JSON.stringify(sentNotifications));
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

        const formatTime = (ts) => {
            if (!ts) return "Agora";
            const diff = Date.now() - new Date(ts).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return "Agora mesmo";
            if (mins < 60) return `Há ${mins} min`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `Há ${hours} h`;
            return new Date(ts).toLocaleDateString("pt-BR");
        };

        this.list.innerHTML = this.items.map(item => `
            <div class="notif-item ${item.read ? '' : 'unread'}" data-id="${item.id}" style="cursor: pointer;">
                <div class="notif-icon ${item.type}">
                    ${this.getIcon(item.type)}
                </div>
                <div class="notif-content">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                        <h4>${item.title}</h4>
                        <span class="notif-time">${formatTime(item.timestamp)}</span>
                    </div>
                    <p style="margin-top: 3px;">${item.message}</p>
                </div>
            </div>
        `).join("");
    },

    getIcon(type) {
        if (type === "danger") return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        if (type === "warning") return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        if (type === "lead") return '🎉';
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    },

    // Adicionar item de notificação programaticamente (ex: novos leads para vendedor)
    addItem(item) {
        // Evitar duplicatas por ID
        if (this.items.find(i => i.id === item.id)) return;
        this.items.unshift({ ...item, read: false });
        this.render();
    }
};

