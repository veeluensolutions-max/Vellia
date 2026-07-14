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

        // Botões de configuração individual
        const btnSdr = document.getElementById("btn-config-agent-sdr");
        const btnCopy = document.getElementById("btn-config-agent-copy");
        const btnAnalyst = document.getElementById("btn-config-agent-analyst");

        const modalOverlay = document.getElementById("agent-config-overlay");
        const modal = document.getElementById("agent-config-modal");
        const form = document.getElementById("agent-config-form");
        const titleEl = document.getElementById("agent-config-title");
        const agentIdInput = document.getElementById("agent-config-id");

        const closeBtn = document.getElementById("btn-close-agent-config-modal");
        const cancelBtn = document.getElementById("btn-cancel-agent-config");

        const closeModal = () => {
            modalOverlay.style.display = "none";
            modal.classList.remove("open");
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;

        const showConfigModal = (agentId) => {
            agentIdInput.value = agentId;
            document.querySelectorAll(".config-fields-group").forEach(el => el.style.display = "none");

            if (agentId === "sdr") {
                titleEl.innerHTML = "<span>🤖</span> Configurar SDR Agent (Vellin)";
                document.getElementById("config-fields-sdr").style.display = "block";
                const sdrConfig = JSON.parse(localStorage.getItem("agent_sdr_config") || '{"approach":"quick","tone":"formal","delay":"1"}');
                document.getElementById("sdr-approach").value = sdrConfig.approach;
                document.getElementById("sdr-tone").value = sdrConfig.tone;
                document.getElementById("sdr-delay").value = sdrConfig.delay;
            } else if (agentId === "copy") {
                titleEl.innerHTML = "<span>✍️</span> Configurar Copywriter Agent";
                document.getElementById("config-fields-copy").style.display = "block";
                const copyConfig = JSON.parse(localStorage.getItem("agent_copy_config") || '{"style":"persuasive","length":"medium"}');
                document.getElementById("copy-style").value = copyConfig.style;
                document.getElementById("copy-length").value = copyConfig.length;
            } else if (agentId === "analyst") {
                titleEl.innerHTML = "<span>📈</span> Configurar Analyst Agent";
                document.getElementById("config-fields-analyst").style.display = "block";
                const analystConfig = JSON.parse(localStorage.getItem("agent_analyst_config") || '{"frequency":"daily","forecast":"realistic"}');
                document.getElementById("analyst-frequency").value = analystConfig.frequency;
                document.getElementById("analyst-forecast-type").value = analystConfig.forecast;
            }

            modalOverlay.style.display = "block";
            modal.classList.add("open");
        };

        if (btnSdr) btnSdr.onclick = () => showConfigModal("sdr");
        if (btnCopy) btnCopy.onclick = () => showConfigModal("copy");
        if (btnAnalyst) btnAnalyst.onclick = () => showConfigModal("analyst");

        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const agentId = agentIdInput.value;

                if (agentId === "sdr") {
                    const config = {
                        approach: document.getElementById("sdr-approach").value,
                        tone: document.getElementById("sdr-tone").value,
                        delay: document.getElementById("sdr-delay").value
                    };
                    localStorage.setItem("agent_sdr_config", JSON.stringify(config));
                    const approachMap = { quick: "Qualificação Rápida", consultative: "Consultiva", direct: "Direta" };
                    this.addAgentLog("SDR Agent", `Configurações salvas: Abordagem definida para '${approachMap[config.approach]}'.`, "success");
                } else if (agentId === "copy") {
                    const config = {
                        style: document.getElementById("copy-style").value,
                        length: document.getElementById("copy-length").value
                    };
                    localStorage.setItem("agent_copy_config", JSON.stringify(config));
                    const styleMap = { persuasive: "Persuasivo", technical: "Técnico", concise: "Direto ao Ponto" };
                    this.addAgentLog("Copywriter Agent", `Configurações salvas: Estilo de redação alterado para '${styleMap[config.style]}'.`, "success");
                } else if (agentId === "analyst") {
                    const config = {
                        frequency: document.getElementById("analyst-frequency").value,
                        forecast: document.getElementById("analyst-forecast-type").value
                    };
                    localStorage.setItem("agent_analyst_config", JSON.stringify(config));
                    const freqMap = { hourly: "Tempo Real", daily: "Diário", weekly: "Semanal" };
                    this.addAgentLog("Analyst Agent", `Configurações salvas: Frequência de auditoria definida para '${freqMap[config.frequency]}'.`, "success");
                }

                alert("Configurações do agente salvas com sucesso!");
                closeModal();
            };
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
