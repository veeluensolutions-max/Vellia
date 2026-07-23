/**
 * Vellia — Inspection Notification Scheduler
 * Detecta automaticamente inspecoes vencendo em 90/60/30 dias e
 * dispara alertas no sistema de notificacoes sem acao manual.
 */

const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";

const NOTIFIED_KEY  = "vellia_insp_notified_ids";
const LAST_RUN_KEY  = "vellia_insp_last_check";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const InspectionScheduler = {

    async fetchLeads() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.warn("[InspectionScheduler] Falha ao buscar leads do Supabase, usando cache:", err.message);
            try {
                return JSON.parse(localStorage.getItem("comercial_leads")) || [];
            } catch (e) {
                return [];
            }
        }
    },

    daysUntil(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr + "T12:00:00");
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    },

    formatDate(dateStr) {
        if (!dateStr) return "N/A";
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y}`;
    },

    getAlertType(daysRemaining) {
        if (daysRemaining < 0)   return "expired";
        if (daysRemaining <= 30) return "urgent";
        if (daysRemaining <= 60) return "critical";
        if (daysRemaining <= 90) return "warning";
        return null;
    },

    async scanExpiringInspections() {
        const leads = await this.fetchLeads();
        const alerts = [];

        leads.forEach(lead => {
            if (!lead.interactions || !Array.isArray(lead.interactions)) return;

            lead.interactions.forEach(item => {
                if (item.type !== "Inspecao" && item.type !== "Inspe\u00e7\u00e3o") return;
                if (item.meta?.notified === true) return;

                const execDate  = item.meta?.executionDate || item.timestamp?.split("T")[0];
                let expiryDate  = item.meta?.expiryDate;

                if (!expiryDate && execDate) {
                    const d = new Date(execDate + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    expiryDate = d.toISOString().split("T")[0];
                }

                if (!expiryDate) return;

                const daysRemaining = this.daysUntil(expiryDate);
                const alertType     = this.getAlertType(daysRemaining);
                if (!alertType) return;

                alerts.push({
                    inspectionId  : item.id,
                    leadId        : lead.id,
                    company       : lead.company || "Empresa",
                    contact       : lead.contact || "Cliente",
                    phone         : lead.whatsapp || lead.phone || "",
                    serviceName   : item.meta?.serviceName || "Vistoria",
                    executionDate : execDate,
                    expiryDate    : expiryDate,
                    daysRemaining : daysRemaining,
                    alertType     : alertType,
                    notes         : item.meta?.notes || ""
                });
            });
        });

        const priority = { expired: 0, urgent: 1, critical: 2, warning: 3 };
        return alerts.sort((a, b) => priority[a.alertType] - priority[b.alertType]);
    },

    async runDailyCheck(force = false) {
        if (!force) {
            const lastRun = localStorage.getItem(LAST_RUN_KEY);
            if (lastRun) {
                const lastRunDate = new Date(lastRun).toDateString();
                if (lastRunDate === new Date().toDateString()) {
                    console.log("[InspectionScheduler] Verificacao ja realizada hoje. Pulando.");
                    return;
                }
            }
        }

        console.log("[InspectionScheduler] Iniciando varredura de inspecoes vencendo...");
        const alerts = await this.scanExpiringInspections();

        let notifiedIds = [];
        try {
            notifiedIds = JSON.parse(sessionStorage.getItem(NOTIFIED_KEY) || "[]");
        } catch (e) {}

        let newAlertCount = 0;

        const labelMap = {
            expired  : { emoji: "VENCIDA",  label: "Vencida" },
            urgent   : { emoji: "URGENTE",  label: "Urgente (<=30 dias)" },
            critical : { emoji: "CRITICO",  label: "Critico (<=60 dias)" },
            warning  : { emoji: "ATENCAO",  label: "Atencao (<=90 dias)" }
        };

        alerts.forEach(alert => {
            const notifId = `insp_alert_${alert.inspectionId}`;
            if (notifiedIds.includes(notifId)) return;

            const cfg = labelMap[alert.alertType];
            const urgencyText = alert.daysRemaining < 0
                ? `Vencida ha ${Math.abs(alert.daysRemaining)} dias`
                : `Vence em ${alert.daysRemaining} dias`;

            window.dispatchEvent(new CustomEvent("vellia:inspectionAlert", {
                detail: {
                    ...alert,
                    notifId,
                    alertLabel  : cfg.label,
                    urgencyText,
                    formattedExpiry: this.formatDate(alert.expiryDate)
                }
            }));

            notifiedIds.push(notifId);
            newAlertCount++;
        });

        sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedIds));
        localStorage.setItem(LAST_RUN_KEY, new Date().toISOString());

        if (newAlertCount > 0) {
            console.log(`[InspectionScheduler] ${newAlertCount} alerta(s) de inspecao gerados.`);
        } else {
            console.log("[InspectionScheduler] Nenhuma nova inspecao vencendo nos proximos 90 dias.");
        }
    },

    schedulePeriodicCheck() {
        setTimeout(() => this.runDailyCheck(), 3000);
        setInterval(() => this.runDailyCheck(true), CHECK_INTERVAL_MS);
    },

    async markAsNotified(leadId, inspectionId) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${leadId}&select=interactions`,
                { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
            );
            if (!res.ok) return false;
            const [lead] = await res.json();
            if (!lead) return false;

            const updatedInteractions = (lead.interactions || []).map(item => {
                if (item.id === inspectionId) {
                    return { ...item, meta: { ...item.meta, notified: true, notifiedAt: new Date().toISOString() } };
                }
                return item;
            });

            const patchRes = await fetch(
                `${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${leadId}`,
                {
                    method: "PATCH",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": `Bearer ${SUPABASE_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ interactions: updatedInteractions })
                }
            );

            if (patchRes.ok) {
                try {
                    let localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
                    const idx = localLeads.findIndex(l => l && l.id === leadId);
                    if (idx !== -1) {
                        localLeads[idx].interactions = updatedInteractions;
                        localStorage.setItem("comercial_leads", JSON.stringify(localLeads));
                    }
                } catch(e) {}
                return true;
            }
        } catch (err) {
            console.warn("[InspectionScheduler] Erro ao marcar como notificado:", err.message);
        }
        return false;
    }
};
