import { analyzeContext } from "./ai.js";
import { Auth } from "./auth.js";
import { Store } from "./store.js";

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
        this.checkFollowupReminders();
        this.checkOverdueTasks();
        this.render();

        // Verificar follow-ups a cada 60 segundos
        setInterval(() => this.checkFollowupReminders(), 60000);
        // Verificar tarefas pendentes a cada 5 minutos
        setInterval(() => this.checkOverdueTasks(), 300000);

        // Ouvir novos comentários internos de outros usuários
        window.addEventListener("vellia:newComment", (e) => {
            const { company, commenter, commentId } = e.detail || {};
            if (!company) return;
            this.addItem({
                id: `cmt_notif_${commentId}`,
                title: `💬 Novo comentário em ${company}`,
                message: `${commenter} deixou um comentário interno neste lead.`,
                type: "info",
                read: false,
                timestamp: new Date()
            });
        });

        // Ouvir notificações de Leads recebidos do Meta Ads / Facebook / Messenger / Instagram Direct
        window.addEventListener("vellia:metaLeadReceived", (e) => {
            const { contact, company, source } = e.detail || {};
            const leadTitle = source === "Instagram Direct"
                ? "📸 Nova Mensagem Direct no Instagram!"
                : (source === "Facebook Messenger" ? "💬 Nova Mensagem no Facebook Messenger" : "🚨 Novo Lead do Meta Ads (Facebook)");
            const leadMsg = `${contact || 'Novo Lead'} (${company || 'Empresa'}) deu entrada no CRM via ${source || 'Redes Sociais'}.`;
            
            this.addItem({
                id: `meta_notif_${Date.now()}`,
                title: leadTitle,
                message: leadMsg,
                type: "lead",
                read: false,
                timestamp: new Date()
            });

            this.sendNativeNotification(leadTitle, leadMsg);
        });

        // Ouvir notificacoes originadas pelos Agentes de IA
        window.addEventListener("vellia:aiNotification", (e) => {
            const { id, title, message, type } = e.detail || {};
            if (!id || !title) return;
            this.addItem({
                id,
                title,
                message,
                type: type || "info",
                read: false,
                timestamp: new Date()
            });
            this.sendNativeNotification(title, message);
        });

        // Ouvir alertas de inspecoes vencendo (gerados pelo InspectionScheduler)
        window.addEventListener("vellia:inspectionAlert", (e) => {
            const d = e.detail || {};
            if (!d.notifId) return;

            // Tipo de notif baseado na urgencia
            const typeMap = {
                expired  : "danger",
                urgent   : "danger",
                critical : "warning",
                warning  : "info"
            };
            const notifType = typeMap[d.alertType] || "warning";

            const title = `🔔 ${d.company} — ${d.alertLabel}`;
            const message = `${d.serviceName} • Vencimento: ${d.formattedExpiry} (${d.urgencyText})`;

            this.addItem({
                id        : d.notifId,
                title,
                message,
                type      : notifType,
                read      : false,
                timestamp : new Date(),
                action    : {
                    label        : d.alertType === "expired" ? "⚡ Renovar Agora" : "💬 Notificar via WhatsApp",
                    leadId       : d.leadId,
                    inspectionId : d.inspectionId,
                    phone        : d.phone,
                    contact      : d.contact,
                    service      : d.serviceName,
                    urgencyText  : d.urgencyText,
                    expiryDate   : d.formattedExpiry
                }
            });

            // Notificacao nativa do browser para casos urgentes/vencidos
            if (d.alertType === "expired" || d.alertType === "urgent") {
                this.sendNativeNotification(
                    `🔴 Inspecao vencendo: ${d.company}`,
                    `${d.serviceName} — ${d.urgencyText}`
                );
            }
        });
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
            if (this.panel.style.display === "flex" && !this.panel.contains(e.target) && !this.btn.contains(e.target)) {
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
                // Clique no botao de acao de inspecao
                const actionBtn = e.target.closest(".notif-inspection-action");
                if (actionBtn) {
                    e.stopPropagation();
                    const leadId       = actionBtn.dataset.leadId;
                    const inspectionId = actionBtn.dataset.inspectionId;
                    const phone        = actionBtn.dataset.phone;
                    const contact      = actionBtn.dataset.contact;
                    const service      = actionBtn.dataset.service;
                    const urgencyText  = actionBtn.dataset.urgencyText;
                    const expiryDate   = actionBtn.dataset.expiryDate;

                    // Abrir notificacao de WhatsApp
                    if (phone) {
                        const phoneClean = phone.replace(/\D/g, "");
                        const msg = encodeURIComponent(
                            `Ol\u00e1, ${contact}! \ud83d\udca1\n\nPassando para te lembrar que a inspec\u00e3o anual de *${service}* ${urgencyText}.\n\nGostaria de agendar a nova vistoria? Temos hor\u00e1rios dispon\u00edveis. \u00d0\u009f\u00d0\u00b8\u00d0\u00b6\u00d1\u0083 no aguardo! \ud83d\ude0a`
                        );
                        window.open(`https://wa.me/${phoneClean}?text=${msg}`, "_blank");
                    } else {
                        // Sem telefone — navegar para a central de inspecoes
                        window.location.hash = "#inspections";
                    }

                    // Marcar notificacao como lida
                    const itemEl = actionBtn.closest(".notif-item");
                    if (itemEl) {
                        const notifId = itemEl.getAttribute("data-id");
                        const item = this.items.find(i => i.id === notifId);
                        if (item) { item.read = true; }
                    }

                    // Marcar inspecao como notificada no Supabase
                    if (leadId && inspectionId) {
                        import("./inspection-scheduler.js").then(m => {
                            m.InspectionScheduler.markAsNotified(leadId, inspectionId);
                        }).catch(() => {});
                    }

                    this.closePanel();
                    this.render();
                    return;
                }

                // Clique normal em item de notificacao
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
                                const tabBtn = document.querySelector('.subtab-btn[data-subtab="team-metas"]');
                                if (tabBtn) tabBtn.click();
                            }, 100);
                        } else if (id.startsWith("insp_alert_")) {
                            // Navegar para a central de inspecoes ao clicar numa inspecao
                            window.location.hash = "#inspections";
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

        this.list.innerHTML = this.items.map(item => {
            const actionHtml = item.action
                ? `<button
                        class="notif-inspection-action"
                        data-lead-id="${item.action.leadId || ''}"
                        data-inspection-id="${item.action.inspectionId || ''}"
                        data-phone="${item.action.phone || ''}"
                        data-contact="${item.action.contact || ''}"
                        data-service="${item.action.service || ''}"
                        data-urgency-text="${item.action.urgencyText || ''}"
                        data-expiry-date="${item.action.expiryDate || ''}"
                        style="
                            display: inline-flex; align-items: center; gap: 6px;
                            margin-top: 8px; padding: 6px 12px; border-radius: 8px;
                            background: ${item.type === 'danger' ? '#25d366' : 'rgba(37,211,102,0.12)'};
                            color: ${item.type === 'danger' ? '#fff' : '#25d366'};
                            border: 1px solid rgba(37,211,102,0.4);
                            font-size: 11.5px; font-weight: 700; cursor: pointer;
                            transition: all 0.2s; white-space: nowrap;
                        "
                        onmouseover="this.style.opacity='0.85'"
                        onmouseout="this.style.opacity='1'"
                    >${item.action.label}</button>`
                : "";

            return `
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
                        ${actionHtml}
                    </div>
                </div>
            `;
        }).join("");
    },

    getIcon(type) {
        if (type === "danger") return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        if (type === "warning") return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        if (type === "lead") return '🎉';
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    },

    addItem(item) {
        if (this.items.find(i => i.id === item.id)) return;
        this.items.unshift({ ...item, read: false });
        this.render();
    },

    checkFollowupReminders() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        const allLeads = Store.getLeads();
        const now = Date.now();
        const windowMs = 10 * 60 * 1000;
        const notifiedKey = "vellia_followup_notified";
        const notified = JSON.parse(sessionStorage.getItem(notifiedKey) || "[]");
        let changed = false;

        allLeads.forEach(lead => {
            if (!lead.followups) return;
            lead.followups.forEach(f => {
                if (f.done || f.userEmail !== currentUser.email) return;
                const scheduledMs = new Date(f.scheduledAt).getTime();
                const diff = scheduledMs - now;
                const isNearOrOverdue = diff <= windowMs && diff > -windowMs;
                if (isNearOrOverdue && !notified.includes(f.id)) {
                    const fmtDt = new Date(f.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                    const notifItem = {
                        id: `followup_${f.id}`,
                        title: `⏰ Follow-up: ${lead.company}`,
                        message: `${f.note} — ${fmtDt}`,
                        type: "warning",
                        read: false,
                        timestamp: new Date()
                    };
                    if (!this.items.find(i => i.id === notifItem.id)) {
                        this.items.unshift(notifItem);
                        this.sendNativeNotification(notifItem.title, notifItem.message);
                    }
                    notified.push(f.id);
                    changed = true;
                }
            });
        });

        if (changed) {
            sessionStorage.setItem(notifiedKey, JSON.stringify(notified));
            this.render();
        }
    },

    checkOverdueTasks() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        const today = new Date().toLocaleDateString("pt-BR");
        const storageKey = `seller_tasks_${currentUser.email}`;
        const allTasks = JSON.parse(localStorage.getItem(storageKey) || "[]");
        const notifiedKey = "vellia_task_overdue_notified";
        const notified = JSON.parse(sessionStorage.getItem(notifiedKey) || "[]");

        const managerTasks = allTasks.filter(t =>
            t.date === today &&
            !t.done &&
            t.assignedBy &&
            t.assignedBy !== currentUser.email
        );

        if (managerTasks.length === 0) return;

        const notifId = `overdue_tasks_${today}`;
        if (notified.includes(notifId)) return;

        this.addItem({
            id: notifId,
            title: `🔔 ${managerTasks.length} tarefa${managerTasks.length > 1 ? "s" : ""} pendente${managerTasks.length > 1 ? "s" : ""} hoje`,
            message: `Você ainda tem ${managerTasks.length} tarefa${managerTasks.length > 1 ? "s" : ""} atribuída${managerTasks.length > 1 ? "s" : ""} pelo gestor para concluir hoje.`,
            type: "danger",
            read: false,
            timestamp: new Date()
        });

        this.sendNativeNotification(
            `🔔 Tarefas Pendentes`,
            `Você tem ${managerTasks.length} tarefa(s) do gestor para concluir hoje!`
        );

        notified.push(notifId);
        sessionStorage.setItem(notifiedKey, JSON.stringify(notified));
    }
};
