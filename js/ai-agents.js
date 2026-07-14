import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const AIAgents = {
    init() {
        this.renderLogs();
        this.bindEvents();
    },

    bindEvents() {
        const sdrToggle = document.getElementById("agent-sdr-toggle");
        const analystToggle = document.getElementById("agent-analyst-toggle");

        if (sdrToggle) {
            sdrToggle.onchange = () => {
                const active = sdrToggle.checked;
                localStorage.setItem("agent_sdr_active", active);
                this.addAgentLog("SDR Agent", active ? "Ativado - Iniciando monitoramento de novos leads." : "Desativado - Monitoramento em pausa.", active ? "success" : "warn");
            };
            // Set initial state
            sdrToggle.checked = localStorage.getItem("agent_sdr_active") !== "false";
        }

        if (analystToggle) {
            analystToggle.onchange = () => {
                const active = analystToggle.checked;
                localStorage.setItem("agent_analyst_active", active);
                this.addAgentLog("Analyst Agent", active ? "Ativado - Auditoria de funil em tempo real." : "Desativado - Projeções preditivas em repouso.", active ? "success" : "warn");
            };
            analystToggle.checked = localStorage.getItem("agent_analyst_active") !== "false";
        }
    },

    addAgentLog(agentName, text, status = "info") {
        const logs = JSON.parse(localStorage.getItem("ai_agents_logs") || "[]");
        logs.unshift({
            timestamp: new Date().toISOString(),
            agent: agentName,
            text,
            status
        });
        // Limit to 20 logs
        localStorage.setItem("ai_agents_logs", JSON.stringify(logs.slice(0, 20)));
        this.renderLogs();
    },

    renderLogs() {
        const container = document.getElementById("ai-agents-log-container");
        if (!container) return;

        // Seed initial logs if empty
        let logs = JSON.parse(localStorage.getItem("ai_agents_logs") || "[]");
        if (logs.length === 0) {
            logs = [
                { timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), agent: "SDR Agent", text: "Triagem concluída: Lead EPEC qualificado com score 90.", status: "success" },
                { timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), agent: "Copywriter Agent", text: "Proposta gerada automaticamente para o cliente Creative Media.", status: "info" },
                { timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), agent: "Analyst Agent", text: "Análise preditiva concluída: Probabilidade de bater a meta é de 78%.", status: "success" },
                { timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), agent: "SDR Agent", text: "Mensagem automática enviada via WhatsApp para reengajar San Charles.", status: "info" }
            ];
            localStorage.setItem("ai_agents_logs", JSON.stringify(logs));
        }

        const badgeColor = s => {
            if (s === "success") return "rgba(16, 185, 129, 0.1); color: #10b981;";
            if (s === "warn") return "rgba(239, 68, 68, 0.1); color: #ef4444;";
            return "rgba(59, 130, 246, 0.1); color: #3b82f6;";
        };

        container.innerHTML = logs.map(l => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 10px; font-weight: 700; background: ${badgeColor(l.status)} padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${l.agent}</span>
                    <span style="font-size: 13px; color: var(--text-primary);">${l.text}</span>
                </div>
                <span style="font-size: 11px; color: var(--text-muted);">${new Date(l.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
        `).join("");

        // Update card status labels dynamically
        const lastSdr = logs.find(l => l.agent === "SDR Agent")?.text || "Sem ações recentes.";
        const lastCopy = logs.find(l => l.agent === "Copywriter Agent")?.text || "Sem ações recentes.";
        const lastAnalyst = logs.find(l => l.agent === "Analyst Agent")?.text || "Sem ações recentes.";

        const sdrActEl = document.getElementById("agent-sdr-last-action");
        const copyActEl = document.getElementById("agent-copy-last-action");
        const analystActEl = document.getElementById("agent-analyst-last-action");

        if (sdrActEl) sdrActEl.textContent = lastSdr;
        if (copyActEl) copyActEl.textContent = lastCopy;
        if (analystActEl) analystActEl.textContent = lastAnalyst;
    }
};
