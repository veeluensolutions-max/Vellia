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
    activeTab: "all",

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
            const detail = e.detail || {};
            const { contact, company, source, leadId } = detail;
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
            this.showNewLeadToast(detail);
        });

        // Ouvir criação de novos leads manuais/web
        window.addEventListener("vellia:leadAdded", (e) => {
            const detail = e.detail || {};
            if (detail.lead) {
                this.showNewLeadToast({
                    id: detail.lead.id,
                    leadId: detail.lead.id,
                    contact: detail.lead.contact,
                    company: detail.lead.company,
                    source: detail.lead.source || "Manual / Web"
                });
            }
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
                id: d.notifId,
                title,
                message,
                type: notifType,
                read: false,
                timestamp: new Date(),
                action: {
                    label: d.isCritical ? "⚡ Disparar WhatsApp Urgente" : "💬 Contatar Cliente",
                    leadId: d.leadId,
                    inspectionId: d.inspectionId,
                    phone: d.phone,
                    contact: d.contact,
                    service: d.serviceName,
                    urgencyText: d.urgencyText,
                    expiryDate: d.formattedExpiry
                }
            });

            // Alerta nativo se critico
            if (d.isCritical) {
                this.sendNativeNotification(title, message);
            }
        });
    },

    requestNativePermission() {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    },

    sendNativeNotification(title, message) {
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                new Notification(title, {
                    body: message,
                    icon: "/favicon.ico"
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

        // Abas do painel de notificações
        const tabContainer = document.getElementById("notif-tabs");
        if (tabContainer) {
            tabContainer.addEventListener("click", (e) => {
                const tabBtn = e.target.closest(".notif-tab-btn");
                if (!tabBtn) return;
                tabContainer.querySelectorAll(".notif-tab-btn").forEach(b => {
                    b.classList.remove("active");
                    b.style.color = "var(--text-muted)";
                    b.style.borderBottom = "none";
                });
                tabBtn.classList.add("active");
                tabBtn.style.color = "var(--primary)";
                tabBtn.style.borderBottom = "2px solid var(--primary)";
                this.activeTab = tabBtn.getAttribute("data-tab") || "all";
                this.render();
            });
        }

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
                this.showToastAlert(item.title, item.message, item.type);
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

        // Atualizar contadores das abas
        const tabs = document.querySelectorAll(".notif-tab-btn");
        tabs.forEach(tab => {
            const t = tab.getAttribute("data-tab");
            if (t === "all") tab.textContent = `Todas (${this.items.length})`;
            if (t === "unread") tab.textContent = `Não Lidas (${unreadCount})`;
        });

        const displayedItems = this.activeTab === "unread" 
            ? this.items.filter(i => !i.read) 
            : this.items;

        if (displayedItems.length === 0) {
            this.list.innerHTML = `<div class="notif-empty" style="padding: 30px 20px; text-align: center; color: var(--text-muted); font-size: 13px;">${this.activeTab === 'unread' ? 'Nenhuma notificação não lida! 🎉' : 'Nenhum alerta inteligente no momento.'}</div>`;
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

        this.list.innerHTML = displayedItems.map(item => {
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

    showToastAlert(title, message, type) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.style.position = "fixed";
            container.style.top = "20px";
            container.style.right = "20px";
            container.style.zIndex = "99999";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "10px";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.style.background = "rgba(15, 23, 42, 0.9)";
        toast.style.backdropFilter = "blur(12px)";
        toast.style.border = "1px solid rgba(255, 255, 255, 0.08)";
        toast.style.borderRadius = "12px";
        toast.style.padding = "14px 18px";
        toast.style.minWidth = "280px";
        toast.style.maxWidth = "360px";
        toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.25)";
        toast.style.color = "#ffffff";
        toast.style.display = "flex";
        toast.style.alignItems = "flex-start";
        toast.style.gap = "12px";
        toast.style.transform = "translateX(120%)";
        toast.style.transition = "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease";
        toast.style.opacity = "0";

        let icon = "🔔";
        let accentColor = "#6366f1";
        if (type === "danger") {
            accentColor = "#ef4444";
            icon = "🚨";
        } else if (type === "warning") {
            accentColor = "#f59e0b";
            icon = "⚠️";
        } else if (type === "lead") {
            accentColor = "#10b981";
            icon = "🎉";
        }

        toast.style.borderLeft = `4px solid ${accentColor}`;

        toast.innerHTML = `
            <div style="font-size: 18px; line-height: 1; margin-top: 1px;">${icon}</div>
            <div style="flex-grow: 1;">
                <h5 style="margin: 0; font-size: 13px; font-weight: 700; color: #ffffff; text-align: left;">${title}</h5>
                <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #cbd5e1; line-height: 1.4; text-align: left;">${message}</p>
            </div>
            <button style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 0; line-height: 1; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#94a3b8'">×</button>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = "translateX(0)";
            toast.style.opacity = "1";
        });

        const closeToast = () => {
            toast.style.transform = "translateX(120%)";
            toast.style.opacity = "0";
            setTimeout(() => {
                toast.remove();
            }, 350);
        };

        toast.querySelector("button").onclick = closeToast;

        setTimeout(closeToast, 5000);
    },

    addItem(item) {
        if (this.items.find(i => i.id === item.id)) return;
        this.items.unshift({ ...item, read: false });
        this.render();
        this.showToastAlert(item.title, item.message, item.type);
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
    },

    playLeadChime() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = "sine";
                osc.frequency.value = freq;
                
                const startTime = ctx.currentTime + (idx * 0.08);
                const duration = 0.25;
                
                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
            });
        } catch (e) {
            console.warn("Sintetizador de áudio não suportado ou bloqueado:", e);
        }
    },

    showNewLeadToast(detail = {}) {
        this.playLeadChime();

        const oldToast = document.getElementById("vellia-new-lead-toast");
        if (oldToast) oldToast.remove();

        const toast = document.createElement("div");
        toast.id = "vellia-new-lead-toast";
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.2); border-left: 4px solid #22c55e;
            border-radius: 14px; padding: 14px 18px; min-width: 320px; max-width: 400px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 8px;
            animation: vellia-slide-in 0.4s cubic-bezier(0.4,0,0.2,1); font-family: 'Inter', sans-serif; color: #fff;
        `;

        const contactName = detail.contact || detail.company || "Novo Lead";
        const companyName = detail.company || "Empresa";
        const sourceName = detail.source || "Meta Ads / Web";
        const leadId = detail.leadId || detail.id;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px;">🚨</span>
                    <span style="font-size: 11px; font-weight: 800; background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 2px 8px; border-radius: 999px; text-transform: uppercase;">
                        NOVO LEAD (${sourceName})
                    </span>
                </div>
                <button type="button" class="btn-close-toast" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;">&times;</button>
            </div>
            <div>
                <div style="font-weight: 800; font-size: 14px; color: #f8fafc; margin-bottom: 2px;">${companyName}</div>
                <div style="font-size: 12px; color: #cbd5e1;">Contato: ${contactName}</div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                <button type="button" class="btn-attend-lead-action" style="background: linear-gradient(135deg, #22c55e, #16a34a); border: none; color: #fff; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px; cursor: pointer;">
                    ⚡ Atender Lead Agora
                </button>
            </div>
        `;

        document.body.appendChild(toast);

        const btnClose = toast.querySelector(".btn-close-toast");
        if (btnClose) btnClose.onclick = () => toast.remove();

        const btnAttend = toast.querySelector(".btn-attend-lead-action");
        if (btnAttend) {
            btnAttend.onclick = () => {
                toast.remove();
                if (leadId && window.CRM) {
                    window.location.hash = "#crm";
                    setTimeout(() => window.CRM.openLeadDrawer(leadId), 150);
                }
            };
        }

        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 10000);
    }
};
