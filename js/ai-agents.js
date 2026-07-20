import { Store } from "./store.js";
import { Auth } from "./auth.js";

// ===========================================================================
// VELLIA AI AGENTS â€” Motor de ExecuÃ§Ã£o Real
// ===========================================================================

export const AIAgents = {
    _sdrInterval: null,
    _analystInterval: null,
    _agentEmail: "agent@vellia.ai",

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // INIT
    init() {
        this.renderLogs();
        this.bindEvents();
        this.startRealtimeEngines();
        this.renderGuruFiles();
        this.loadIcpProfile();
        this.updateContextChecklist();
        this.renderStrategyHistory();
        this.loadManualStrategy();
        this.renderMonthlyComparisonPanel();

        // Configurar PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor função global para salvar ICP
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown(latestStrategy);
                container.style.display = "block";
            }
        }

        // Escutar eventos globais de novos leads e propostas
        window.addEventListener("vellia:leadAdded",       (e) => this.onLeadAdded(e.detail));
        window.addEventListener("vellia:proposalUpdated", ()  => this.runAnalystCycle());
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // MOTORES PERIÃ“DICOS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    startRealtimeEngines() {
        clearInterval(this._sdrInterval);
        this._sdrInterval = setInterval(() => {
            if (this.isAgentActive("sdr")) this.runSDRCycle(false);
        }, 30_000);

        clearInterval(this._analystInterval);
        this._analystInterval = setInterval(() => {
            if (this.isAgentActive("analyst")) this.runAnalystCycle();
        }, 60_000);

        // Rodar ciclo inicial ao abrir a aba
        if (this.isAgentActive("sdr"))      this.runSDRCycle(false);
        if (this.isAgentActive("analyst"))  this.runAnalystCycle();
    },

    isAgentActive(id) {
        return localStorage.getItem(`agent_${id}_active`) !== "false";
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // REAGIR A NOVO LEAD
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    onLeadAdded(lead) {
        if (!this.isAgentActive("sdr")) return;
        const score = this.scoreLead(lead);
        Store.updateLead(lead.id, { aiScore: score }, this._agentEmail);

        const priority = score >= 75 ? "ðŸ”¥ ALTA" : score >= 45 ? "âš¡ MÃ‰DIA" : "â„ï¸ BAIXA";
        this.addAgentLog(
            "SDR Agent",
            `Novo lead detectado: ${lead.company} â€” Score ${score}/100 (Prioridade ${priority}). ${this.sdrRecommendation(score, lead)}`,
            score >= 75 ? "success" : score >= 45 ? "info" : "warn"
        );

        window.dispatchEvent(new CustomEvent("vellia:agentScoreUpdated", { detail: { leadId: lead.id, score } }));
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // CICLO SDR â€” QualificaÃ§Ã£o de Todos os Leads
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    runSDRCycle(verbose = true) {
        const leads = Store.getLeads();
        if (leads.length === 0) {
            if (verbose) this.addAgentLog("SDR Agent", "Nenhum lead cadastrado para qualificar.", "info");
            return;
        }

        let scored = 0;
        const highPriority = [];
        const coldLeads = [];
        const now = Date.now();

        leads.forEach(lead => {
            const score = this.scoreLead(lead);
            Store.updateLead(lead.id, { aiScore: score }, this._agentEmail);
            scored++;

            if (score >= 75) highPriority.push({ ...lead, aiScore: score });

            // Detectar leads sem contato
            const lastInteraction = lead.interactions?.slice(-1)[0];
            if (lastInteraction) {
                const daysSince = (now - new Date(lastInteraction.timestamp)) / (1000 * 60 * 60 * 24);
                if (daysSince >= 5) coldLeads.push(lead);
            } else {
                coldLeads.push(lead);
            }
        });

        this.addAgentLog("SDR Agent", `Ciclo completo: ${scored} lead(s) qualificado(s). ${highPriority.length} de alta prioridade.`, "success");

        if (highPriority.length > 0) {
            const top = highPriority.sort((a, b) => b.aiScore - a.aiScore)[0];
            this.addAgentLog("SDR Agent", `ðŸ”¥ Lead prioritÃ¡rio: ${top.company} (Score ${top.aiScore}/100) â€” ${this.sdrRecommendation(top.aiScore, top)}`, "success");
        }

        if (coldLeads.length > 0) {
            const names = coldLeads.slice(0, 3).map(l => l.company).join(", ");
            this.addAgentLog("SDR Agent", `â„ï¸ ${coldLeads.length} lead(s) sem contato recente: ${names}${coldLeads.length > 3 ? ` e +${coldLeads.length - 3}` : ""}. Recomendado reengajamento.`, "warn");
        }

        window.dispatchEvent(new CustomEvent("vellia:agentScoreUpdated", { detail: { all: true } }));
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // CICLO ANALYST â€” Auditoria do Pipeline
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    runAnalystCycle() {
        const proposals = Store.getProposals();
        if (proposals.length === 0) {
            this.addAgentLog("Analyst Agent", "Nenhuma proposta no pipeline para analisar.", "info");
            return;
        }

        const fmt  = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
        const now  = new Date();
        const open = proposals.filter(p => ["Enviada", "Em NegociaÃ§Ã£o"].includes(p.status));
        const won  = proposals.filter(p => p.status === "Ganho");
        const totalOpen = open.reduce((s, p) => s + (p.value || 0), 0);
        const totalWon  = won.reduce((s, p) => s + (p.value || 0), 0);
        const convRate  = proposals.length > 0 ? Math.round((won.length / proposals.length) * 100) : 0;

        const expiringSoon = open.filter(p => {
            if (!p.validUntil) return false;
            const diff = (new Date(p.validUntil) - now) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
        });

        this.addAgentLog(
            "Analyst Agent",
            `Pipeline auditado: ${open.length} abertas (${fmt(totalOpen)}), taxa de conversÃ£o ${convRate}%, ${won.length} ganhas (${fmt(totalWon)}).`,
            "success"
        );

        if (expiringSoon.length > 0) {
            const valueRisk = expiringSoon.reduce((s, p) => s + (p.value || 0), 0);
            const names = expiringSoon.slice(0, 2).map(p => p.company).join(", ");
            this.addAgentLog("Analyst Agent", `âš ï¸ ${expiringSoon.length} proposta(s) vence(m) em 7 dias â€” ${fmt(valueRisk)} em risco: ${names}${expiringSoon.length > 2 ? ` e +${expiringSoon.length - 2}` : ""}. Priorize o fechamento!`, "warn");
        }

        if (convRate < 30 && proposals.length >= 3) {
            this.addAgentLog("Analyst Agent", `ðŸ“‰ Taxa de conversÃ£o em ${convRate}% â€” abaixo do esperado. Revise abordagens e motivos de perda.`, "warn");
        } else if (convRate >= 60) {
            this.addAgentLog("Analyst Agent", `ðŸ† Taxa de conversÃ£o excelente: ${convRate}%! PadrÃ£o acima da mÃ©dia de mercado.`, "success");
        }
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ALGORITMO DE SCORE SDR (0â€“100)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    scoreLead(lead) {
        let score = 0;

        // EstÃ¡gio do funil (+40 pts mÃ¡x)
        const stageScores = { "Contato": 10, "Qualificado": 20, "ReuniÃ£o Marcada": 30, "Proposta Enviada": 35, "NegociaÃ§Ã£o": 40 };
        score += stageScores[lead.stage] || 5;

        // Completude do cadastro (+20 pts)
        if (lead.company)  score += 4;
        if (lead.contact)  score += 3;
        if (lead.phone || lead.whatsapp) score += 4;
        if (lead.email)    score += 3;
        if (lead.segment && lead.segment !== "Outros") score += 3;
        if (lead.city)     score += 3;

        // InteraÃ§Ãµes (+20 pts)
        const intCount = lead.interactions?.length || 0;
        if (intCount >= 1)  score += 5;
        if (intCount >= 3)  score += 5;
        if (intCount >= 6)  score += 5;
        if (intCount >= 10) score += 5;

        // Segmento de alto valor (+10 pts)
        const highValue = ["Tecnologia", "IndÃºstria", "SaÃºde", "EducaÃ§Ã£o", "ConstruÃ§Ã£o"];
        if (highValue.includes(lead.segment)) score += 10;

        // RecÃªncia â€” interaÃ§Ã£o nos Ãºltimos 3 dias (+10 pts)
        if (intCount > 0) {
            const daysSince = (Date.now() - new Date(lead.interactions.slice(-1)[0].timestamp)) / (1000 * 60 * 60 * 24);
            if (daysSince <= 3) score += 10;
        }

        return Math.min(100, score);
    },

    sdrRecommendation(score, lead) {
        const config   = JSON.parse(localStorage.getItem("agent_sdr_config") || '{"tone":"formal"}');
        const toneMap  = { formal: "formal", casual: "informal", technical: "tÃ©cnica" };
        const tone     = toneMap[config.tone] || "formal";
        if (score >= 75) return `Enviar proposta em abordagem ${tone} imediatamente.`;
        if (score >= 50) return `Agendar reuniÃ£o de descoberta no tom ${tone}.`;
        if (score >= 30) return `Enviar conteÃºdo de valor para nutrir o relacionamento.`;
        return `Lead frio â€” tentar reengajamento por WhatsApp.`;
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // LOG ENGINE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    addAgentLog(agentName, text, status = "info") {
        const logs = JSON.parse(localStorage.getItem("ai_agents_logs") || "[]");
        logs.unshift({ timestamp: new Date().toISOString(), agent: agentName, text, status });
        localStorage.setItem("ai_agents_logs", JSON.stringify(logs.slice(0, 50)));
        this.renderLogs();
    },

    renderLogs() {
        const container = document.getElementById("ai-agents-log-container");
        if (!container) return;

        const logs = JSON.parse(localStorage.getItem("ai_agents_logs") || "[]");

        if (logs.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Nenhuma aÃ§Ã£o dos agentes ainda. Ative-os para comeÃ§ar.</p>`;
            return;
        }

        const badgeStyle = s => {
            if (s === "success") return "background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25);";
            if (s === "warn")    return "background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.25);";
            return "background: rgba(99, 102, 241, 0.12); color: #6366f1; border: 1px solid rgba(99,102,241,0.25);";
        };

        const agentIcon = a => {
            if (a.includes("SDR"))        return "ðŸ¤–";
            if (a.includes("Copywriter")) return "âœï¸";
            if (a.includes("Analyst"))    return "ðŸ“ˆ";
            return "âš¡";
        };

        container.innerHTML = logs.map(l => `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 14px; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border-color); gap: 12px;">
                <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0;">
                    <span style="font-size: 16px; flex-shrink: 0;">${agentIcon(l.agent)}</span>
                    <div style="min-width: 0;">
                        <span style="font-size: 10px; font-weight: 700; ${badgeStyle(l.status)} padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">${l.agent}</span>
                        <p style="font-size: 13px; color: var(--text-primary); margin: 0; line-height: 1.5;">${l.text}</p>
                    </div>
                </div>
                <span style="font-size: 11px; color: var(--text-muted); flex-shrink: 0;">${new Date(l.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
        `).join("");

        // Atualizar "Ãºltima aÃ§Ã£o" nos cards
        const lastSdr     = logs.find(l => l.agent === "SDR Agent")?.text      || "Aguardando ativaÃ§Ã£o.";
        const lastCopy    = logs.find(l => l.agent === "Copywriter Agent")?.text || "Aguardando ativaÃ§Ã£o.";
        const lastAnalyst = logs.find(l => l.agent === "Analyst Agent")?.text   || "Aguardando ativaÃ§Ã£o.";

        const sdrActEl     = document.getElementById("agent-sdr-last-action");
        const copyActEl    = document.getElementById("agent-copy-last-action");
        const analystActEl = document.getElementById("agent-analyst-last-action");

        if (sdrActEl)     sdrActEl.textContent     = lastSdr;
        if (copyActEl)    copyActEl.textContent     = lastCopy;
        if (analystActEl) analystActEl.textContent  = lastAnalyst;
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // BIND EVENTS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    bindEvents() {
        const sdrToggle     = document.getElementById("agent-sdr-toggle");
        const analystToggle = document.getElementById("agent-analyst-toggle");

        if (sdrToggle) {
            sdrToggle.checked = this.isAgentActive("sdr");
            sdrToggle.onchange = () => {
                const active = sdrToggle.checked;
                localStorage.setItem("agent_sdr_active", active);
                const txt = active ? "SDR Agent Ativado - Qualificacao automatica de leads iniciada." : "SDR Agent Desativado - Qualificacao em pausa.";
                const status = active ? "success" : "warn";
                this.addAgentLog("SDR Agent", txt, status);
                if (active) this.runSDRCycle(true);
            };
        }

        if (analystToggle) {
            analystToggle.checked = this.isAgentActive("analyst");
            analystToggle.onchange = () => {
                const active = analystToggle.checked;
                localStorage.setItem("agent_analyst_active", active);
                const txt = active ? "Analyst Agent Ativado - Auditoria do pipeline em tempo real iniciada." : "Analyst Agent Desativado - Projecoes em repouso.";
                const status = active ? "success" : "warn";
                this.addAgentLog("Analyst Agent", txt, status);
                if (active) this.runAnalystCycle();
            };
        }

        // Botão executar agora
        const btnRunNow = document.getElementById("btn-run-agents-now");
        if (btnRunNow) {
            btnRunNow.onclick = () => {
                this.addAgentLog("SDR Agent", "▶ Execução manual acionada.", "info");
                this.runSDRCycle(true);
                this.runAnalystCycle();
            };
        }

        // --- GURU AGENT BINDINGS ---
        const guruToggle = document.getElementById("agent-guru-toggle");
        if (guruToggle) {
            guruToggle.checked = this.isAgentActive("guru");
            guruToggle.onchange = () => {
                const active = guruToggle.checked;
                localStorage.setItem("agent_guru_active", active);
                this.addAgentLog("Guru de Estratégias", active
                    ? "✅ Ativado — Planejamento estratégico semanal disponível."
                    : "⏸️ Desativado — Planejamentos pausados.", active ? "success" : "warn");
            };
        }

        const user = Auth.getCurrentUser();
        const btnOpenGuru = document.getElementById("btn-open-guru-panel");
        const btnCloseGuru = document.getElementById("btn-close-guru-panel");
        const guruPanel = document.getElementById("guru-strategic-panel");

        if (btnOpenGuru) {
            if (user && user.role !== "admin") {
                btnOpenGuru.disabled = true;
                btnOpenGuru.textContent = "Apenas Administrador";
                btnOpenGuru.style.background = "var(--text-muted)";
                btnOpenGuru.style.borderColor = "var(--text-muted)";
            } else {
                btnOpenGuru.onclick = () => {
                    if (guruPanel) guruPanel.style.display = "block";
                    guruPanel.scrollIntoView({ behavior: "smooth" });
                };
            }
        }

        if (btnCloseGuru && guruPanel) {
            btnCloseGuru.onclick = () => {
                guruPanel.style.display = "none";
            };
        }

        // Upload Dropzone
        const dropzone = document.getElementById("guru-upload-dropzone");
        const fileInput = document.getElementById("guru-file-input");

        if (dropzone && fileInput) {
            dropzone.onclick = () => fileInput.click();

            dropzone.ondragover = (e) => {
                e.preventDefault();
                dropzone.style.borderColor = "#8b5cf6";
                dropzone.style.background = "rgba(139,92,246,0.05)";
            };

            dropzone.ondragleave = () => {
                dropzone.style.borderColor = "rgba(139,92,246,0.3)";
                dropzone.style.background = "var(--bg-surface)";
            };

            dropzone.ondrop = (e) => {
                e.preventDefault();
                dropzone.style.borderColor = "rgba(139,92,246,0.3)";
                dropzone.style.background = "var(--bg-surface)";
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.handleGuruFileUpload(e.dataTransfer.files[0]);
                }
            };

            fileInput.onchange = () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    Array.from(fileInput.files).forEach(f => this.handleGuruFileUpload(f));
                }
            };
        }

        // Strategy Buttons
        const btnGenStrategy = document.getElementById("btn-generate-weekly-strategy");
        if (btnGenStrategy) {
            btnGenStrategy.onclick = () => this.generateWeeklyStrategy();
        }

        const btnAccept = document.getElementById("btn-accept-strategy");
        if (btnAccept) {
            btnAccept.onclick = () => this.openTaskDistributionModal();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

        const btnExportPdf = document.getElementById("btn-export-guru-pdf");
        if (btnExportPdf) {
            btnExportPdf.onclick = () => this.exportStrategyPDF();
        }

        const btnOpenScripts = document.getElementById("btn-open-guru-scripts");
        if (btnOpenScripts) {
            btnOpenScripts.onclick = () => this.openSalesScriptsModal();
        }

        // Botões do Planejamento Manual
        const btnSaveManual = document.getElementById("btn-save-manual-strategy");
        if (btnSaveManual) {
            btnSaveManual.onclick = () => this.saveManualStrategy();
        }

        const btnDistributeManual = document.getElementById("btn-distribute-manual-strategy");
        if (btnDistributeManual) {
            btnDistributeManual.onclick = () => this.openManualTaskDistributionModal();
        }

        const btnExportManualPdf = document.getElementById("btn-export-manual-pdf");
        if (btnExportManualPdf) {
            btnExportManualPdf.onclick = () => this.exportManualStrategyPDF();
        }

        // Eventos do Painel Comparativo Anual / Mensal
        const btnUpdateComp = document.getElementById("btn-update-comparison");
        if (btnUpdateComp) {
            btnUpdateComp.onclick = () => this.renderMonthlyComparisonPanel();
        }

        const selYear = document.getElementById("comp-select-year");
        const selMonthA = document.getElementById("comp-select-month-a");
        const selMonthB = document.getElementById("comp-select-month-b");

        [selYear, selMonthA, selMonthB].forEach(sel => {
            if (sel) sel.onchange = () => this.renderMonthlyComparisonPanel();
        });

        const btnExpCompPdf = document.getElementById("btn-export-comparison-pdf");
        if (btnExpCompPdf) {
            btnExpCompPdf.onclick = () => this.exportMonthlyComparisonPDF();
        }

        const btnExpCompCsv = document.getElementById("btn-export-comparison-csv");
        if (btnExpCompCsv) {
            btnExpCompCsv.onclick = () => this.exportMonthlyComparisonCSV();
        }

        // Modais do Guru: Eventos de Fechamento e Ações
        this._bindGuruModalEvents();

        // Expor para o escopo global do window para deletar arquivos ou interações
        window.deleteGuruFile = (idx) => this.deleteGuruFile(idx);

        this._bindConfigModal();
    },

    _bindConfigModal() {
        const btnSdr      = document.getElementById("btn-config-agent-sdr");
        const btnCopy     = document.getElementById("btn-config-agent-copy");
        const btnAnalyst  = document.getElementById("btn-config-agent-analyst");
        const modalOverlay = document.getElementById("agent-config-overlay");
        const modal        = document.getElementById("agent-config-modal");
        const form         = document.getElementById("agent-config-form");
        const titleEl      = document.getElementById("agent-config-title");
        const agentIdInput = document.getElementById("agent-config-id");
        const closeBtn     = document.getElementById("btn-close-agent-config-modal");
        const cancelBtn    = document.getElementById("btn-cancel-agent-config");

        const closeModal = () => {
            if (modalOverlay) modalOverlay.style.display = "none";
            if (modal) modal.classList.remove("open");
        };

        if (closeBtn)  closeBtn.onclick  = closeModal;
        if (cancelBtn) cancelBtn.onclick = closeModal;

        const showConfigModal = (agentId) => {
            if (!agentIdInput || !modal || !modalOverlay) return;
            agentIdInput.value = agentId;
            document.querySelectorAll(".config-fields-group").forEach(el => el.style.display = "none");

            if (agentId === "sdr") {
                titleEl.innerHTML = "<span>ðŸ¤–</span> Configurar SDR Agent (Vellin)";
                document.getElementById("config-fields-sdr").style.display = "block";
                const c = JSON.parse(localStorage.getItem("agent_sdr_config") || '{"approach":"quick","tone":"formal","delay":"1"}');
                document.getElementById("sdr-approach").value = c.approach;
                document.getElementById("sdr-tone").value     = c.tone;
                document.getElementById("sdr-delay").value    = c.delay;
            } else if (agentId === "copy") {
                titleEl.innerHTML = "<span>âœï¸</span> Configurar Copywriter Agent";
                document.getElementById("config-fields-copy").style.display = "block";
                const c = JSON.parse(localStorage.getItem("agent_copy_config") || '{"style":"persuasive","length":"medium"}');
                document.getElementById("copy-style").value  = c.style;
                document.getElementById("copy-length").value = c.length;
            } else if (agentId === "analyst") {
                titleEl.innerHTML = "<span>ðŸ“ˆ</span> Configurar Analyst Agent";
                document.getElementById("config-fields-analyst").style.display = "block";
                const c = JSON.parse(localStorage.getItem("agent_analyst_config") || '{"frequency":"daily","forecast":"realistic"}');
                document.getElementById("analyst-frequency").value     = c.frequency;
                document.getElementById("analyst-forecast-type").value = c.forecast;
            }

            modalOverlay.style.display = "block";
            modal.classList.add("open");
        };

        if (btnSdr)     btnSdr.onclick     = () => showConfigModal("sdr");
        if (btnCopy)    btnCopy.onclick    = () => showConfigModal("copy");
        if (btnAnalyst) btnAnalyst.onclick = () => showConfigModal("analyst");

        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const agentId = agentIdInput.value;

                if (agentId === "sdr") {
                    const config = { approach: document.getElementById("sdr-approach").value, tone: document.getElementById("sdr-tone").value, delay: document.getElementById("sdr-delay").value };
                    localStorage.setItem("agent_sdr_config", JSON.stringify(config));
                    const approachMap = { quick: "QualificaÃ§Ã£o RÃ¡pida", consultative: "Consultiva", direct: "Direta" };
                    this.addAgentLog("SDR Agent", `âš™ï¸ ConfiguraÃ§Ã£o salva: Abordagem '${approachMap[config.approach]}', tom '${config.tone}'. Reagendando ciclo.`, "success");
                    if (this.isAgentActive("sdr")) this.runSDRCycle(false);
                } else if (agentId === "copy") {
                    const config = { style: document.getElementById("copy-style").value, length: document.getElementById("copy-length").value };
                    localStorage.setItem("agent_copy_config", JSON.stringify(config));
                    const styleMap = { persuasive: "Persuasivo", technical: "TÃ©cnico", concise: "Direto ao Ponto" };
                    this.addAgentLog("Copywriter Agent", `âš™ï¸ ConfiguraÃ§Ã£o salva: Estilo '${styleMap[config.style]}'.`, "success");
                } else if (agentId === "analyst") {
                    const config = { frequency: document.getElementById("analyst-frequency").value, forecast: document.getElementById("analyst-forecast-type").value };
                    localStorage.setItem("agent_analyst_config", JSON.stringify(config));
                    const freqMap = { hourly: "Tempo Real", daily: "DiÃ¡rio", weekly: "Semanal" };
                    this.addAgentLog("Analyst Agent", `âš™ï¸  ConfiguraÃ§Ã£o salva: FrequÃªncia '${freqMap[config.frequency]}'. Nova auditoria em andamento.`, "success");
                    if (this.isAgentActive("analyst")) this.runAnalystCycle();
                }

                 closeModal();
            };
        }
    },

    // --- GURU HELPER METHODS ---

    saveIcpProfile() {
        const icp = {
            segment:  document.getElementById('icp-segment')?.value  || '',
            size:     document.getElementById('icp-size')?.value     || '',
            role:     document.getElementById('icp-role')?.value     || '',
            location: document.getElementById('icp-location')?.value || '',
            budget:   document.getElementById('icp-budget')?.value   || '',
            pain:     document.getElementById('icp-pain')?.value     || ''
        };
        localStorage.setItem('guru_icp_profile', JSON.stringify(icp));
        this.updateContextChecklist();
        this.addAgentLog('Guru de Estratégias', `Perfil ICP salvo: ${icp.segment || 'Segmento não definido'} — ${icp.role || 'Cargo não definido'}`, 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
            set('icp-segment', icp.segment); set('icp-size', icp.size); set('icp-role', icp.role);
            set('icp-location', icp.location); set('icp-budget', icp.budget); set('icp-pain', icp.pain);
        } catch(e) {}
    },

    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpOk   = icp && (icp.segment || icp.role || icp.pain);
        const $ = id => document.getElementById(id);
        if ($('guru-ctx-icp-icon'))   $('guru-ctx-icp-icon').textContent   = icpOk         ? '🟢' : '⚪';
        if ($('guru-ctx-docs-icon'))  $('guru-ctx-docs-icon').textContent  = files.length  ? '🟢' : '⚪';
        if ($('guru-ctx-history-icon')) $('guru-ctx-history-icon').textContent = history.length ? '🟢' : '⚪';
        if ($('guru-ctx-docs-count')) $('guru-ctx-docs-count').textContent = files.length;
        if ($('guru-ctx-history-count')) $('guru-ctx-history-count').textContent = history.length;
    },

    _renderMarkdown(text) {
        return text
            .replace(/\[TAREFA_VENDEDOR:[^\]]+\]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;margin:0 0 12px">$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6">•</span><span>$1</span></div>')
            .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    },

    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = ['application/json','.json','.txt','.csv'].some(t => file.type === t || file.name.endsWith(t));
        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = `Carregando ${file.name}...`;
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';
                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const tc   = await page.getTextContent();
                    fullText  += `\n--- Página ${i} ---\n${tc.items.map(it => it.str).join(' ')}`;
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = `Extraindo página ${i} de ${totalPages}...`;
                }
                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const idx   = files.findIndex(f => f.name === file.name);
                const data  = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (idx !== -1) files[idx] = data; else files.push(data);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', `PDF extraído: ${file.name} (${totalPages} páginas)`, 'success');
                this.renderGuruFiles(); this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                this.addAgentLog('Guru de Estratégias', `Erro ao ler PDF: ${file.name}`, 'warn');
            }
        } else if (isText) {
            const reader = new FileReader();
            reader.onload = e => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const idx   = files.findIndex(f => f.name === file.name);
                const data  = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (idx !== -1) files[idx] = data; else files.push(data);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', `Arquivo carregado: ${file.name}`, 'success');
                this.renderGuruFiles(); this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário — adicione as informações relevantes nas Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', `Arquivo registrado: ${file.name}`, 'warn');
            this.renderGuruFiles(); this.updateContextChecklist();
        }
    },

    renderGuruFiles() {
        const container = document.getElementById("guru-files-list");
        if (!container) return;
        
        const files = JSON.parse(localStorage.getItem("guru_files") || "[]");
        if (files.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px 0; margin: 0;">Nenhum arquivo carregado.</p>`;
            return;
        }
        
        container.innerHTML = files.map((f, idx) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <span>📄</span>
                    <span style="font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${f.name}</span>
                    <span style="color: var(--text-muted); font-size: 10px;">(${(f.size/1024).toFixed(1)} KB)</span>
                </div>
                <button onclick="window.deleteGuruFile(${idx})" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 14px; padding: 0 4px; display: flex; align-items: center;">&times;</button>
            </div>
        `).join("");
    },

    deleteGuruFile(idx) {
        const files = JSON.parse(localStorage.getItem("guru_files") || "[]");
        const removed = files.splice(idx, 1)[0];
        localStorage.setItem("guru_files", JSON.stringify(files));
        if (removed) {
            this.addAgentLog("Guru de Estratégias", `Arquivo removido da Base: ${removed.name}`, "warn");
        }
        this.renderGuruFiles();
    },

    async generateWeeklyStrategy() {
        const btnGen    = document.getElementById('btn-generate-weekly-strategy');
        const container = document.getElementById('guru-strategy-result-container');
        const textEl    = document.getElementById('guru-strategy-text');
        if (!btnGen || !container || !textEl) return;

        btnGen.disabled = true;
        btnGen.innerHTML = '<span>⏳</span> Analisando ICP, documentos e leads...';

        try {
            const leads   = Store.getLeads();
            const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
            const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
            const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
            const notes   = document.getElementById('guru-notes-input')?.value || '';

            const docsCtx = files.length
                ? files.map(f => `=== ${f.name} (${f.source === 'pdf_extracted' ? f.pages + ' págs' : f.type}) ===\n${(f.content||'').substring(0,10000)}`).join('\n\n')
                : 'Nenhum documento carregado.';

            const icpCtx = Object.values(icp||{}).some(v=>v)
                ? `- Segmento-alvo: ${icp.segment||'N/D'}\n- Porte: ${icp.size||'N/D'}\n- Cargo decisor: ${icp.role||'N/D'}\n- Localização: ${icp.location||'N/D'}\n- Orçamento/ticket: ${icp.budget||'N/D'}\n- Dores que resolve: ${icp.pain||'N/D'}`
                : 'ICP não configurado — estratégia será genérica. Configure o Perfil do Cliente Ideal para melhores resultados.';

            const leadsCtx = leads.length
                ? leads.slice(0,30).map(l => `• ${l.company} | ${l.contact} | ${l.role||'-'} | ${l.segment||'-'} | ${l.stage}`).join('\n')
                : 'Sem leads no CRM.';

            const histCtx = history.length
                ? `Últimas ${Math.min(history.length,3)} estratégias (NÃO repita estas táticas):\n` + history.slice(0,3).map((h,i) => `[${i+1}. ${h.date}]: ${h.summary}`).join('\n')
                : 'Sem histórico anterior.';

            const prompt = `Você é o GURU DE ESTRATÉGIAS COMERCIAIS do VelliaCRM — consultor sênior em prospecção ativa, outbound B2B/B2C e social selling.

Gere um PLANEJAMENTO SEMANAL DE CAPTAÇÃO ultra-específico baseado nos dados abaixo.

═══ 🎯 PERFIL DO CLIENTE IDEAL (ICP) ═══
${icpCtx}

═══ 📁 BASE DE CONHECIMENTO (documentos reais) ═══
${docsCtx}

═══ 📋 LEADS ATUAIS NO CRM ═══
${leadsCtx}

═══ 📝 ANOTAÇÕES DO GESTOR ═══
${notes || 'Sem anotações.'}

═══ 🕐 HISTÓRICO (não repetir) ═══
${histCtx}

## 🎯 Foco Estratégico da Semana
Qual subperfil do ICP atacar e por quê (cite dados dos documentos quando disponíveis).

## 📍 Onde os Leads Estão & Como Chegar
Canais exatos: grupos LinkedIn/WhatsApp, eventos, regiões, horários. Seja específico.

## 💬 Scripts de Abordagem
Script WhatsApp e Script LinkedIn/E-mail — personalizados para o cargo e dor do ICP.

## 📊 Análise do Pipeline Atual
O que os leads no CRM indicam como oportunidade para esta semana.

## ✅ Tarefas para os Vendedores
3 a 5 ações práticas e objetivas com contexto suficiente para execução imediata.

Ao final, adicione OBRIGATORIAMENTE:
[TAREFA_VENDEDOR: <texto completo da tarefa>]

Crie 3 a 4 tags [TAREFA_VENDEDOR: ...]. Escreva de forma motivadora e comercial.`;

            const res = await fetch('/api/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }

            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';

            textEl.innerHTML = this._renderMarkdown(strategyText);
            localStorage.setItem('guru_latest_suggested_strategy', strategyText);

            // Gerar resumo para histórico
            const lines = strategyText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
            localStorage.setItem('guru_pending_summary', lines.slice(0,3).join(' ').substring(0,200) + '...');

            container.style.display = 'block';
            this.addAgentLog('Guru de Estratégias', `Planejamento gerado com ${files.length} doc(s) e ICP configurado.`, 'success');

        } catch(err) {
            console.error('Erro estratégia:', err);
            this.addAgentLog('Guru de Estratégias', `Erro: ${err.message}`, 'warn');
            textEl.innerHTML = `<p style='color:var(--danger);padding:12px;background:rgba(239,68,68,0.08);border-radius:8px'>⚠️ Erro: ${err.message}</p>`;
            container.style.display = 'block';
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = '<span>✨</span> Gerar Estratégia da Semana';
        }
    },

    acceptStrategy() {
        const latestStrategy = localStorage.getItem('guru_latest_suggested_strategy');
        if (!latestStrategy) return;

        localStorage.setItem('active_weekly_strategy', latestStrategy);

        // Salvar no histórico
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const summary = localStorage.getItem('guru_pending_summary') || latestStrategy.substring(0,150) + '...';
        history.unshift({ date: new Date().toLocaleDateString('pt-BR'), summary, icp: JSON.parse(localStorage.getItem('guru_icp_profile') || '{}') });
        if (history.length > 5) history.splice(5);
        localStorage.setItem('guru_strategy_history', JSON.stringify(history));
        localStorage.removeItem('guru_pending_summary');

        // Extrair e distribuir tarefas
        const regex = /\[TAREFA_VENDEDOR:\s*(.*?)\]/g;
        const tasks = []; let m;
        while ((m = regex.exec(latestStrategy)) !== null) { if (m[1]) tasks.push(m[1].trim()); }

        const sellers = Store.getUsers().filter(u => u.role === 'seller');
        const today   = new Date().toLocaleDateString('pt-BR');
        sellers.forEach(seller => {
            const sellerTasks = Store.getTasks(seller.email);
            tasks.forEach(t => sellerTasks.unshift({ id: `task_${Date.now()}_${Math.random().toString(36).substr(2,4)}`, text: t, priority: 'high', done: false, date: today, assignedBy: 'agent@vellia.ai' }));
            Store.saveTasks(seller.email, sellerTasks);
        });

        this.addAgentLog('Guru de Estratégias', `Planejamento aceito. ${tasks.length} tarefa(s) para ${sellers.length} vendedor(es).`, 'success');
        alert(`✅ Planejamento ativado!\n${tasks.length} tarefa(s) atribuída(s) com prioridade Alta para ${sellers.length} vendedor(es).`);
        Store.addLog('admin@vellia.com', 'GURU_STRATEGY_ACCEPTED', `Planejamento aceito. ${tasks.length} tarefas atribuídas.`, 'SUCCESS');

        const container = document.getElementById('guru-strategy-result-container');
        if (container) container.style.display = 'none';
        const guruPanel = document.getElementById('guru-strategic-panel');
        if (guruPanel) guruPanel.style.display = 'none';

        this.renderStrategyHistory();
        this.updateContextChecklist();
        window.dispatchEvent(new CustomEvent('vellia:waSent'));
    },

    rejectStrategy() {
        localStorage.removeItem('guru_latest_suggested_strategy');
        localStorage.removeItem('guru_pending_summary');
        this.addAgentLog('Guru de Estratégias', 'Sugestão descartada pelo Administrador.', 'warn');
        const container = document.getElementById('guru-strategy-result-container');
        if (container) container.style.display = 'none';
        Store.addLog('admin@vellia.com', 'GURU_STRATEGY_REJECTED', 'Planejamento descartado.', 'WARN');
        alert('Sugestão de planejamento descartada.');
    },

    renderStrategyHistory() {
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const section = document.getElementById('guru-history-section');
        const list    = document.getElementById('guru-history-list');
        if (!section || !list) return;
        if (!history.length) { section.style.display = 'none'; return; }
        section.style.display = 'block';
        list.innerHTML = history.map((h,i) =>
            `<div style="padding:12px;background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:12px;font-weight:700;">📅 Semana de ${h.date}</span>
                    <span style="font-size:10px;color:var(--text-muted);background:rgba(139,92,246,0.1);padding:2px 8px;border-radius:99px;">Planejamento #${history.length-i}</span>
                </div>
                ${h.icp?.segment ? `<div style="font-size:11px;color:#8b5cf6;margin-bottom:4px;">🎯 ICP: ${h.icp.segment}${h.icp.role ? ' — '+h.icp.role : ''}</div>` : ''}
                <p style="font-size:12px;color:var(--text-secondary);margin:0;">${h.summary}</p>
            </div>`
        ).join('');
    },

    // =========================================================================
    // NOVOS RECURSOS GURU: EXPORTAÇÃO PDF, TAREFAS INTERATIVAS & SCRIPTS DE VENDAS
    // =========================================================================

    _bindGuruModalEvents() {
        // Modal de Tarefas
        const tasksOverlay = document.getElementById("guru-tasks-modal-overlay");
        const btnCloseTasks = document.getElementById("btn-close-guru-tasks-modal");
        const btnCancelTasks = document.getElementById("btn-cancel-guru-tasks");
        const btnConfirmTasks = document.getElementById("btn-confirm-guru-tasks");
        const btnAddTask = document.getElementById("btn-add-custom-guru-task");

        const closeTasksModal = () => { if (tasksOverlay) tasksOverlay.style.display = "none"; };

        if (btnCloseTasks) btnCloseTasks.onclick = closeTasksModal;
        if (btnCancelTasks) btnCancelTasks.onclick = closeTasksModal;
        if (btnConfirmTasks) btnConfirmTasks.onclick = () => this.confirmGuruTasks();
        if (btnAddTask) btnAddTask.onclick = () => this.addCustomGuruTaskRow();

        // Modal de Scripts
        const scriptsOverlay = document.getElementById("guru-scripts-modal-overlay");
        const btnCloseScripts = document.getElementById("btn-close-guru-scripts-modal");
        const btnCopyScript = document.getElementById("btn-copy-guru-script");
        const btnSendWa = document.getElementById("btn-send-guru-script-wa");
        const btnRegen = document.getElementById("btn-regenerate-guru-script");

        const tabWa = document.getElementById("tab-script-wa");
        const tabEmail = document.getElementById("tab-script-email");
        const tabObjections = document.getElementById("tab-script-objections");

        const closeScriptsModal = () => { if (scriptsOverlay) scriptsOverlay.style.display = "none"; };

        if (btnCloseScripts) btnCloseScripts.onclick = closeScriptsModal;
        if (btnCopyScript) btnCopyScript.onclick = () => this.copyGuruScript();
        if (btnSendWa) btnSendWa.onclick = () => this.sendGuruScriptWhatsApp();
        if (btnRegen) btnRegen.onclick = () => this.generateFreshScriptVariation();

        const setActiveTab = (btn, tabName) => {
            [tabWa, tabEmail, tabObjections].forEach(t => t?.classList.remove("active"));
            btn?.classList.add("active");
            this.renderGuruScriptContent(tabName);
        };

        if (tabWa) tabWa.onclick = () => setActiveTab(tabWa, "wa");
        if (tabEmail) tabEmail.onclick = () => setActiveTab(tabEmail, "email");
        if (tabObjections) tabObjections.onclick = () => setActiveTab(tabObjections, "objections");
    },

    exportStrategyPDF() {
        const strategyText = localStorage.getItem("guru_latest_suggested_strategy");
        if (!strategyText) {
            alert("Nenhum planejamento disponível para exportar em PDF.");
            return;
        }

        if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
            alert("Biblioteca jsPDF não carregada. Por favor recarregue a página.");
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "mm", format: "a4" });
            const icp = JSON.parse(localStorage.getItem("guru_icp_profile") || "{}");
            const today = new Date().toLocaleDateString("pt-BR");

            // Top Banner
            doc.setFillColor(139, 92, 246);
            doc.rect(0, 0, 210, 24, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.text("VELLIA CRM — Planejamento Estratégico Semanal", 14, 15);

            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.text(`Data: ${today}  |  Elaborado por: Guru de Estratégias IA`, 14, 20.5);

            let y = 32;

            // Box do ICP
            if (icp && (icp.segment || icp.role || icp.pain)) {
                doc.setFillColor(245, 243, 255);
                doc.roundedRect(14, y, 182, 22, 3, 3, "F");
                doc.setDrawColor(221, 214, 254);
                doc.roundedRect(14, y, 182, 22, 3, 3, "D");

                doc.setTextColor(109, 40, 217);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.text("TARGET ESTRATÉGICO (ICP):", 18, y + 6);

                doc.setTextColor(51, 65, 85);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                const icpLine = `Segmento: ${icp.segment || "Geral"}  |  Decisor: ${icp.role || "Todos"}  |  Porte: ${icp.size || "Qualquer"}`;
                doc.text(icpLine, 18, y + 11.5);
                const painLine = `Dor Principal: ${icp.pain || "Produtividade e Vendas"}`;
                doc.text(painLine.substring(0, 95), 18, y + 16.5);
                y += 28;
            }

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 41, 59);

            const cleanText = strategyText.replace(/\[TAREFA_VENDEDOR:\s*(.*?)\]/g, "");
            const lines = cleanText.split("\n");

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) {
                    y += 2.5;
                    return;
                }

                if (trimmed.startsWith("# ")) {
                    y += 3.5;
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(12);
                    doc.setTextColor(124, 58, 237);
                    doc.text(trimmed.replace(/^#\s*/, ""), 14, y);
                    y += 6;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9.5);
                    doc.setTextColor(30, 41, 59);
                } else if (trimmed.startsWith("## ")) {
                    y += 3;
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10.5);
                    doc.setTextColor(109, 40, 217);
                    doc.text(trimmed.replace(/^##\s*/, ""), 14, y);
                    y += 5.5;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(30, 41, 59);
                } else {
                    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
                    const content = trimmed.replace(/^[-•]\s*/, "");
                    const prefix = isBullet ? "• " : "";

                    const wrapped = doc.splitTextToSize(prefix + content.replace(/\*\*(.*?)\*\*/g, "$1"), 180);
                    wrapped.forEach(wLine => {
                        if (y > 272) { doc.addPage(); y = 20; }
                        doc.text(wLine, 14, y);
                        y += 4.5;
                    });
                }
            });

            // Footer
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(`VelliaCRM — Documento de Inteligência Comercial  |  Página ${i} de ${totalPages}`, 105, 290, { align: "center" });
            }

            doc.save(`VelliaCRM_Estrategia_${today.replace(/\//g, "-")}.pdf`);
            this.addAgentLog("Guru de Estratégias", "Relatório de planejamento exportado em PDF.", "success");
        } catch(err) {
            console.error("Erro exportar PDF:", err);
            alert(`Erro ao gerar PDF: ${err.message}`);
        }
    },

    openTaskDistributionModal() {
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (!latestStrategy) {
            alert("Nenhuma estratégia gerada no momento. Clique em 'Gerar Estratégia da Semana' primeiro.");
            return;
        }

        const overlay = document.getElementById("guru-tasks-modal-overlay");
        const listContainer = document.getElementById("guru-tasks-list-container");
        const globalSelect = document.getElementById("guru-global-seller-select");
        if (!overlay || !listContainer) return;

        // Preencher seletor global de vendedores
        const users = Store.getUsers();
        const sellers = users.filter(u => u.role === "seller" || u.role === "admin" || u.role === "manager");

        if (globalSelect) {
            globalSelect.innerHTML = `<option value="all">⚡ Todos os Vendedores (Distribuir igualmente)</option>` +
                sellers.map(s => `<option value="${s.email}">${s.name} (${s.email})</option>`).join("");
        }

        // Extrair tarefas da estratégia
        const regex = /\[TAREFA_VENDEDOR:\s*(.*?)\]/g;
        const tasks = []; let m;
        while ((m = regex.exec(latestStrategy)) !== null) {
            if (m[1]) tasks.push(m[1].trim());
        }

        // Se não houver tags [TAREFA_VENDEDOR], tentar buscar de bullets sob o título Tarefas
        if (tasks.length === 0) {
            const lines = latestStrategy.split("\n");
            let isTaskSection = false;
            lines.forEach(l => {
                if (l.toLowerCase().includes("tarefa") || l.toLowerCase().includes("ações")) isTaskSection = true;
                else if (l.startsWith("#")) isTaskSection = false;
                else if (isTaskSection && (l.trim().startsWith("-") || l.trim().startsWith("•"))) {
                    const text = l.replace(/^[-•]\s*/, "").trim();
                    if (text) tasks.push(text);
                }
            });
        }

        if (tasks.length === 0) {
            tasks.push("Prospectar 10 novos leads alinhados ao ICP nas redes profissionais");
            tasks.push("Realizar follow-up com os leads parados há mais de 5 dias no pipeline");
            tasks.push("Apresentar os novos scripts de abordagem na reunião semanal de vendas");
        }

        this._tempGuruTasks = tasks.map((t, idx) => ({
            id: `gtask_${Date.now()}_${idx}`,
            text: t,
            assignedTo: "all",
            priority: "high",
            date: new Date().toLocaleDateString("pt-BR")
        }));

        this.renderTaskDistributionList();
        overlay.style.display = "flex";
    },

    renderTaskDistributionList() {
        const container = document.getElementById("guru-tasks-list-container");
        const globalSelect = document.getElementById("guru-global-seller-select");
        if (!container) return;

        const users = Store.getUsers();
        const sellers = users.filter(u => u.role === "seller" || u.role === "admin" || u.role === "manager");

        const sellerOptionsHtml = (selected) =>
            `<option value="all" ${selected === "all" ? "selected" : ""}>Todos os Vendedores</option>` +
            sellers.map(s => `<option value="${s.email}" ${s.email === selected ? "selected" : ""}>${s.name}</option>`).join("");

        container.innerHTML = this._tempGuruTasks.map((t, idx) => `
            <div class="guru-task-item" data-idx="${idx}">
                <div class="guru-task-header">
                    <span style="font-size: 11px; font-weight: 700; background: rgba(139,92,246,0.12); color: #8b5cf6; padding: 2px 8px; border-radius: 4px;">Ação #${idx + 1}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select onchange="window.updateGuruTaskField(${idx}, 'priority', this.value)" style="height: 28px; font-size: 11px; padding: 0 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-app); color: var(--text-primary);">
                            <option value="high" ${t.priority === "high" ? "selected" : ""}>🔴 Alta Prioridade</option>
                            <option value="medium" ${t.priority === "medium" ? "selected" : ""}>🟡 Média Prioridade</option>
                            <option value="low" ${t.priority === "low" ? "selected" : ""}>🟢 Normal</option>
                        </select>
                        <select onchange="window.updateGuruTaskField(${idx}, 'assignedTo', this.value)" style="height: 28px; font-size: 11px; padding: 0 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-app); color: var(--text-primary);">
                            ${sellerOptionsHtml(t.assignedTo)}
                        </select>
                        <button type="button" onclick="window.removeGuruTaskRow(${idx})" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px; padding: 0 4px;">&times;</button>
                    </div>
                </div>
                <input type="text" class="guru-task-input" value="${t.text.replace(/"/g, '&quot;')}" onchange="window.updateGuruTaskField(${idx}, 'text', this.value)" placeholder="Descreva a tarefa prática..." />
            </div>
        `).join("");

        window.updateGuruTaskField = (idx, field, val) => {
            if (this._tempGuruTasks[idx]) this._tempGuruTasks[idx][field] = val;
        };

        window.removeGuruTaskRow = (idx) => {
            this._tempGuruTasks.splice(idx, 1);
            this.renderTaskDistributionList();
        };

        if (globalSelect) {
            globalSelect.onchange = () => {
                const val = globalSelect.value;
                this._tempGuruTasks.forEach(t => t.assignedTo = val);
                this.renderTaskDistributionList();
            };
        }
    },

    addCustomGuruTaskRow() {
        if (!this._tempGuruTasks) this._tempGuruTasks = [];
        this._tempGuruTasks.push({
            id: `gtask_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
            text: "Nova ação de prospecção recomendada...",
            assignedTo: "all",
            priority: "high",
            date: new Date().toLocaleDateString("pt-BR")
        });
        this.renderTaskDistributionList();
    },

    confirmGuruTasks() {
        if (!this._tempGuruTasks || this._tempGuruTasks.length === 0) {
            alert("Nenhuma tarefa para distribuir.");
            return;
        }

        const sellers = Store.getUsers().filter(u => u.role === "seller" || u.role === "admin" || u.role === "manager");
        const today = new Date().toLocaleDateString("pt-BR");
        let countAssigned = 0;

        this._tempGuruTasks.forEach(task => {
            if (!task.text.trim()) return;

            if (task.assignedTo === "all") {
                sellers.forEach(s => {
                    const sellerTasks = Store.getTasks(s.email);
                    sellerTasks.unshift({
                        id: `task_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
                        text: task.text,
                        priority: task.priority,
                        done: false,
                        date: today,
                        assignedBy: "Guru de Estratégias IA"
                    });
                    Store.saveTasks(s.email, sellerTasks);
                    countAssigned++;
                });
            } else {
                const sellerTasks = Store.getTasks(task.assignedTo);
                sellerTasks.unshift({
                    id: `task_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
                    text: task.text,
                    priority: task.priority,
                    done: false,
                    date: today,
                    assignedBy: "Guru de Estratégias IA"
                });
                Store.saveTasks(task.assignedTo, sellerTasks);
                countAssigned++;
            }
        });

        // Salvar a estratégia atual no histórico
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            localStorage.setItem("active_weekly_strategy", latestStrategy);
            const history = JSON.parse(localStorage.getItem("guru_strategy_history") || "[]");
            const summary = localStorage.getItem("guru_pending_summary") || latestStrategy.substring(0, 150) + "...";
            history.unshift({
                date: today,
                summary,
                icp: JSON.parse(localStorage.getItem("guru_icp_profile") || "{}")
            });
            if (history.length > 5) history.splice(5);
            localStorage.setItem("guru_strategy_history", JSON.stringify(history));
        }

        this.addAgentLog("Guru de Estratégias", `Planejamento aprovado. ${this._tempGuruTasks.length} ações distribuídas (${countAssigned} atribuições).`, "success");
        Store.addLog("admin@vellia.com", "GURU_STRATEGY_DISTRIBUTED", `${countAssigned} tarefas criadas via Guru.`, "SUCCESS");

        alert(`✅ Sucesso! ${countAssigned} tarefa(s) foram criadas e atribuídas à equipe.`);

        const overlay = document.getElementById("guru-tasks-modal-overlay");
        if (overlay) overlay.style.display = "none";
        const container = document.getElementById("guru-strategy-result-container");
        if (container) container.style.display = "none";

        this.renderStrategyHistory();
        this.updateContextChecklist();
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
    },

    openSalesScriptsModal() {
        const overlay = document.getElementById("guru-scripts-modal-overlay");
        const label = document.getElementById("guru-script-target-label");
        if (!overlay) return;

        const icp = JSON.parse(localStorage.getItem("guru_icp_profile") || "{}");
        if (label) {
            label.textContent = `ICP Alvo: ${icp.segment || "Geral"} ${icp.role ? " (" + icp.role + ")" : ""}`;
        }

        const tabWa = document.getElementById("tab-script-wa");
        if (tabWa) {
            document.querySelectorAll("#guru-scripts-modal .btn-outline").forEach(b => b.classList.remove("active"));
            tabWa.classList.add("active");
        }

        this.renderGuruScriptContent("wa");
        overlay.style.display = "flex";
    },

    renderGuruScriptContent(tab) {
        const area = document.getElementById("guru-script-content-area");
        if (!area) return;

        const icp = JSON.parse(localStorage.getItem("guru_icp_profile") || "{}");
        const segment = icp.segment || "seu segmento";
        const role = icp.role || "Decisor";
        const pain = icp.pain || "otimizar processos e aumentar resultados";

        this._currentScriptTab = tab;

        if (tab === "wa") {
            const scriptWa = `Olá, {Nome}! Tudo bem?\n\nVi que você atua na área de **${segment}** como **${role}**. Recentemente ajudamos empresas do seu setor a solucionar **${pain}** em menos de 30 dias.\n\nVocê teria 5 minutos nesta quinta-feira para conversarmos sobre como aplicar essa estratégia na {Empresa}?`;
            this._currentScriptText = scriptWa;
            area.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <span style="font-weight: 700; color: #25d366;">💬 Abordagem Direta via WhatsApp (Cold Outreach)</span>
                    <span style="font-size: 11px; color: var(--text-muted);">Pronto para envio</span>
                </div>
                <div style="white-space: pre-wrap; font-family: monospace; font-size: 12.5px; background: var(--bg-app); padding: 14px; border-radius: 6px; border: 1px dashed var(--border-color);">${scriptWa}</div>
            `;
        } else if (tab === "email") {
            const scriptEmail = `Assunto: Estratégia para ${pain} na {Empresa}\n\nOlá, {Nome},\n\nAcompanho o trabalho da {Empresa} no mercado de ${segment} e notei que um dos principais desafios dos executivos de ${role} hoje é justamente ${pain}.\n\nNo VelliaCRM, estruturamos um método comprovado que reduz em até 40% o ciclo de vendas e melhora a conversão das equipes comerciais.\n\nSeria viável alinharmos uma breve apresentação de 15 min esta semana?\n\nAtenciosamente,\n{Seu_Nome}\nVellia CRM`;
            this._currentScriptText = scriptEmail;
            area.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <span style="font-weight: 700; color: var(--primary-light);">✉️ Modelo de E-mail / Conexão LinkedIn</span>
                    <span style="font-size: 11px; color: var(--text-muted);">Cadência Inbound/Outbound</span>
                </div>
                <div style="white-space: pre-wrap; font-family: monospace; font-size: 12.5px; background: var(--bg-app); padding: 14px; border-radius: 6px; border: 1px dashed var(--border-color);">${scriptEmail}</div>
            `;
        } else if (tab === "objections") {
            const scriptObj = `🛡️ QUEBRA DE OBJEÇÕES FREQUENTES (${segment})\n\n1. Objeção: "Já uso outro sistema/solução"\n➔ Resposta: "Perfeito! A maioria dos nossos clientes de ${segment} também utilizava outra ferramenta antes. O que eles viram no Vellia de diferencial foi a IA integrada que prevê fechamentos. Posso te mostrar em 3 minutos como isso se complementa ao que você já tem?"\n\n2. Objeção: "Não tenho orçamento agora"\n➔ Resposta: "Compreendo perfeitamente, {Nome}. Exatamente por isso a solução se paga nas primeiras 2 semanas ao evitar a perda de propostas quentes. Que tal avaliarmos uma demonstração sem compromisso para o próximo trimestre?"`;
            this._currentScriptText = scriptObj;
            area.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <span style="font-weight: 700; color: #8b5cf6;">🛡️ Matriz de Contorno de Objeções</span>
                    <span style="font-size: 11px; color: var(--text-muted);">Treinamento de equipe</span>
                </div>
                <div style="white-space: pre-wrap; font-size: 12.5px; background: var(--bg-app); padding: 14px; border-radius: 6px; border: 1px dashed var(--border-color);">${scriptObj}</div>
            `;
        }
    },

    copyGuruScript() {
        if (!this._currentScriptText) return;
        navigator.clipboard.writeText(this._currentScriptText).then(() => {
            alert("📋 Script copiado para a área de transferência com sucesso!");
        }).catch(() => {
            alert("Não foi possível copiar automaticamente.");
        });
    },

    sendGuruScriptWhatsApp() {
        if (!this._currentScriptText) return;
        const encoded = encodeURIComponent(this._currentScriptText);
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
    },

    async generateFreshScriptVariation() {
        const area = document.getElementById("guru-script-content-area");
        if (!area) return;

        area.innerHTML = `<p style="text-align:center; padding: 30px 0; color: #8b5cf6;">✨ Gerando variação inteligente com a IA...</p>`;

        const icp = JSON.parse(localStorage.getItem("guru_icp_profile") || "{}");
        const prompt = `Gere uma nova variação persuasiva de script comercial de vendas (${this._currentScriptTab || 'wa'}) para o segmento ${icp.segment || 'geral'} com foco no cargo ${icp.role || 'decisor'} para resolver a dor ${icp.pain || 'vendas'}. Retorne apenas a mensagem formatada de forma concisa e direta.`;

        try {
            const res = await fetch("/api/gemini-proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }] })
            });

            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    this._currentScriptText = text;
                    area.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                            <span style="font-weight: 700; color: #8b5cf6;">✨ Variação Gerada via IA Gemini</span>
                        </div>
                        <div style="white-space: pre-wrap; font-family: monospace; font-size: 12.5px; background: var(--bg-app); padding: 14px; border-radius: 6px; border: 1px dashed var(--border-color);">${text}</div>
                    `;
                    return;
                }
            }
        } catch(e) {}

        this.renderGuruScriptContent(this._currentScriptTab || "wa");
    },

    // =========================================================================
    // PLANEJAMENTO ESTRATÉGICO MANUAL DO GESTOR
    // =========================================================================

    loadManualStrategy() {
        const input = document.getElementById("guru-manual-strategy-input");
        if (!input) return;
        const saved = localStorage.getItem("guru_manual_strategy");
        if (saved) {
            input.value = saved;
            const badge = document.getElementById("manual-strategy-status-badge");
            if (badge) {
                badge.textContent = "💾 Rascunho Carregado";
                badge.style.color = "var(--primary-light)";
            }
        }
    },

    saveManualStrategy() {
        const input = document.getElementById("guru-manual-strategy-input");
        const badge = document.getElementById("manual-strategy-status-badge");
        if (!input) return;

        const val = input.value.trim();
        localStorage.setItem("guru_manual_strategy", val);

        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (badge) {
            badge.textContent = `✅ Salvo às ${time}`;
            badge.style.color = "var(--success)";
        }

        this.addAgentLog("Guru de Estratégias", "Planejamento estratégico manual salvo pelo Gestor.", "success");
        Store.addLog("admin@vellia.com", "GURU_MANUAL_STRATEGY_SAVED", "Planejamento manual salvo pelo gestor.", "SUCCESS");
    },

    openManualTaskDistributionModal() {
        const input = document.getElementById("guru-manual-strategy-input");
        if (!input || !input.value.trim()) {
            alert("Por favor, digite ou cole o seu planejamento manual no campo de texto antes de distribuir.");
            input?.focus();
            return;
        }

        const text = input.value.trim();
        // Salvar automaticamente ao clicar em distribuir
        this.saveManualStrategy();

        const overlay = document.getElementById("guru-tasks-modal-overlay");
        const listContainer = document.getElementById("guru-tasks-list-container");
        const globalSelect = document.getElementById("guru-global-seller-select");
        if (!overlay || !listContainer) return;

        // Preencher seletor global de vendedores
        const users = Store.getUsers();
        const sellers = users.filter(u => u.role === "seller" || u.role === "admin" || u.role === "manager");

        if (globalSelect) {
            globalSelect.innerHTML = `<option value="all">⚡ Todos os Vendedores (Distribuir igualmente)</option>` +
                sellers.map(s => `<option value="${s.email}">${s.name} (${s.email})</option>`).join("");
        }

        // Extrair tarefas do texto manual
        const tasks = [];

        // 1. Procurar tags [TAREFA_VENDEDOR: ...]
        const tagRegex = /\[TAREFA_VENDEDOR:\s*(.*?)\]/g;
        let m;
        while ((m = tagRegex.exec(text)) !== null) {
            if (m[1]) tasks.push(m[1].trim());
        }

        // 2. Se não houver tags, buscar tópicos de lista (- , • , * , 1.) ou linhas não-vazias
        if (tasks.length === 0) {
            const lines = text.split("\n");
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*") || /^\d+\./.test(trimmed)) {
                    const taskText = trimmed.replace(/^([-•*]|\d+\.)\s*/, "").trim();
                    if (taskText) tasks.push(taskText);
                } else if (trimmed && !trimmed.startsWith("#") && !trimmed.toLowerCase().startsWith("foco") && !trimmed.toLowerCase().startsWith("meta")) {
                    if (trimmed.length > 5 && trimmed.length < 200) {
                        tasks.push(trimmed);
                    }
                }
            });
        }

        // Se ainda assim não houver tarefas separadas, usar o texto principal
        if (tasks.length === 0) {
            tasks.push(text.substring(0, 150));
        }

        this._tempGuruTasks = tasks.map((t, idx) => ({
            id: `gtask_manual_${Date.now()}_${idx}`,
            text: t,
            assignedTo: "all",
            priority: "high",
            date: new Date().toLocaleDateString("pt-BR")
        }));

        this.renderTaskDistributionList();
        overlay.style.display = "flex";
    },

    exportManualStrategyPDF() {
        const input = document.getElementById("guru-manual-strategy-input");
        const text = input ? input.value.trim() : "";
        if (!text) {
            alert("Nenhum planejamento manual preenchido para exportar em PDF.");
            return;
        }

        if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
            alert("Biblioteca jsPDF não carregada. Por favor recarregue a página.");
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "mm", format: "a4" });
            const today = new Date().toLocaleDateString("pt-BR");

            // Top Banner
            doc.setFillColor(139, 92, 246);
            doc.rect(0, 0, 210, 24, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.text("VELLIA CRM — Planejamento Estratégico do Gestor", 14, 15);

            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.text(`Data: ${today}  |  Elaborado por: Gestor / Administrador`, 14, 20.5);

            let y = 34;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);

            const lines = text.split("\n");

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) {
                    y += 2.5;
                    return;
                }

                if (trimmed.startsWith("# ")) {
                    y += 3.5;
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(12);
                    doc.setTextColor(124, 58, 237);
                    doc.text(trimmed.replace(/^#\s*/, ""), 14, y);
                    y += 6;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9.5);
                    doc.setTextColor(30, 41, 59);
                } else {
                    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ");
                    const content = trimmed.replace(/^[-•*]\s*/, "");
                    const prefix = isBullet ? "• " : "";

                    const wrapped = doc.splitTextToSize(prefix + content.replace(/\*\*(.*?)\*\*/g, "$1"), 180);
                    wrapped.forEach(wLine => {
                        if (y > 272) { doc.addPage(); y = 20; }
                        doc.text(wLine, 14, y);
                        y += 4.5;
                    });
                }
            });

            // Footer
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(`VelliaCRM — Documento Estratégico da Gestão  |  Página ${i} de ${totalPages}`, 105, 290, { align: "center" });
            }

            doc.save(`VelliaCRM_Planejamento_Manual_${today.replace(/\//g, "-")}.pdf`);
            this.addAgentLog("Guru de Estratégias", "Planejamento manual exportado em PDF.", "success");
        } catch(err) {
            console.error("Erro exportar PDF manual:", err);
            alert(`Erro ao gerar PDF: ${err.message}`);
        }
    },

    // =========================================================================
    // PAINEL DE COMPARATIVO MENSAL E HISTÓRICO ANUAL
    // =========================================================================

    renderMonthlyComparisonPanel() {
        const yearSelect = document.getElementById("comp-select-year");
        const monthASelect = document.getElementById("comp-select-month-a");
        const monthBSelect = document.getElementById("comp-select-month-b");
        const cardsGrid = document.getElementById("comp-metrics-cards-grid");
        const tableBody = document.getElementById("comp-annual-table-body");

        if (!cardsGrid || !tableBody) return;

        const year = yearSelect ? Number(yearSelect.value) : new Date().getFullYear();
        const monthA = monthASelect ? Number(monthASelect.value) : (new Date().getMonth() + 1);
        const monthB = monthBSelect ? Number(monthBSelect.value) : (monthA > 1 ? monthA - 1 : 12);

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const fmtBrl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

        const comp = Store.compareMonths(year, monthA, year, monthB);
        const { monthA: mA, monthB: mB, diff } = comp;

        // Render Cards Comparativos
        const renderBadge = (pctVal, isDiffPts = false) => {
            const isPos = pctVal > 0;
            const isZero = pctVal === 0;
            const color = isPos ? "#10b981" : isZero ? "var(--text-muted)" : "#ef4444";
            const bg = isPos ? "rgba(16,185,129,0.12)" : isZero ? "var(--bg-app)" : "rgba(239,68,68,0.12)";
            const icon = isPos ? "▲" : isZero ? "•" : "▼";
            const label = isDiffPts ? `${isPos ? "+" : ""}${pctVal}% pts` : `${isPos ? "+" : ""}${pctVal}%`;
            return `<span style="font-size: 11px; font-weight: 700; color: ${color}; background: ${bg}; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">${icon} ${label}</span>`;
        };

        cardsGrid.innerHTML = `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">💰 Faturamento</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 6px 0 4px;">${fmtBrl(mA.revenue)}</div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 11px; color: var(--text-muted);">${monthNames[monthB - 1]}: ${fmtBrl(mB.revenue)}</span>
                    ${renderBadge(diff.revenuePct)}
                </div>
            </div>

            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">🏆 Vendas Fechadas</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 6px 0 4px;">${mA.wonCount} propostas</div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 11px; color: var(--text-muted);">${monthNames[monthB - 1]}: ${mB.wonCount}</span>
                    ${renderBadge(diff.wonPct)}
                </div>
            </div>

            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">🎯 Leads Qualificados</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 6px 0 4px;">${mA.leadsQualified} leads</div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 11px; color: var(--text-muted);">${monthNames[monthB - 1]}: ${mB.leadsQualified}</span>
                    ${renderBadge(diff.leadsPct)}
                </div>
            </div>

            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">⚡ Tarefas Concluídas</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 6px 0 4px;">${mA.completedTasks} ações</div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 11px; color: var(--text-muted);">${monthNames[monthB - 1]}: ${mB.completedTasks}</span>
                    ${renderBadge(diff.tasksPct)}
                </div>
            </div>

            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">📈 Taxa de Conversão</div>
                <div style="font-size: 18px; font-weight: 800; color: #8b5cf6; margin: 6px 0 4px;">${mA.conversionRate}%</div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 11px; color: var(--text-muted);">${monthNames[monthB - 1]}: ${mB.conversionRate}%</span>
                    ${renderBadge(diff.conversionDiff, true)}
                </div>
            </div>
        `;

        // Render Tabela de Evolução Anual
        const annualData = Store.getAnnualOverview(year);
        tableBody.innerHTML = annualData.months.map((m, idx) => {
            const isSelectedA = (idx + 1) === monthA;
            const isSelectedB = (idx + 1) === monthB;
            const bg = isSelectedA ? "rgba(139,92,246,0.1)" : isSelectedB ? "rgba(99,102,241,0.06)" : "transparent";
            const badgeTag = isSelectedA ? `<span style="font-size: 10px; background: #8b5cf6; color: white; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">Mês A</span>` :
                             isSelectedB ? `<span style="font-size: 10px; background: #6366f1; color: white; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">Mês B</span>` : "";

            return `
                <tr style="background: ${bg}; border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px; font-weight: 700; color: var(--text-primary);">${monthNames[idx]} ${badgeTag}</td>
                    <td style="padding: 10px; font-weight: 600; color: var(--text-primary);">${fmtBrl(m.revenue)}</td>
                    <td style="padding: 10px;">${m.wonCount} / ${m.proposalsCount}</td>
                    <td style="padding: 10px;">${m.leadsQualified}</td>
                    <td style="padding: 10px;">${m.completedTasks}</td>
                    <td style="padding: 10px;">${m.strategiesCount}</td>
                    <td style="padding: 10px; font-weight: 700; color: #8b5cf6;">${m.conversionRate}%</td>
                </tr>
            `;
        }).join("");
    },

    exportMonthlyComparisonPDF() {
        const yearSelect = document.getElementById("comp-select-year");
        const monthASelect = document.getElementById("comp-select-month-a");
        const monthBSelect = document.getElementById("comp-select-month-b");

        const year = yearSelect ? Number(yearSelect.value) : new Date().getFullYear();
        const monthA = monthASelect ? Number(monthASelect.value) : (new Date().getMonth() + 1);
        const monthB = monthBSelect ? Number(monthBSelect.value) : (monthA > 1 ? monthA - 1 : 12);

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const fmtBrl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

        if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
            alert("Biblioteca jsPDF não carregada. Recarregue a página.");
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: "mm", format: "a4" });
            const today = new Date().toLocaleDateString("pt-BR");

            // Header Banner
            doc.setFillColor(139, 92, 246);
            doc.rect(0, 0, 210, 24, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("VELLIA CRM — Relatório Comparativo de Desempenho", 14, 15);

            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.text(`Ano ${year}: ${monthNames[monthA - 1]} vs ${monthNames[monthB - 1]}  |  Emissão: ${today}`, 14, 20.5);

            let y = 32;

            const comp = Store.compareMonths(year, monthA, year, monthB);
            const { monthA: mA, monthB: mB, diff } = comp;

            // Box resumo de comparação
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, y, 182, 38, 3, 3, "F");
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, y, 182, 38, 3, 3, "D");

            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text(`COMPARATIVO DIRETO: ${monthNames[monthA - 1].toUpperCase()} vs ${monthNames[monthB - 1].toUpperCase()}`, 18, y + 8);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            doc.text(`• Faturamento: ${fmtBrl(mA.revenue)} vs ${fmtBrl(mB.revenue)} (Variação: ${diff.revenuePct >= 0 ? "+" : ""}${diff.revenuePct}%)`, 18, y + 15);
            doc.text(`• Vendas Fechadas: ${mA.wonCount} propostas vs ${mB.wonCount} propostas (Variação: ${diff.wonPct >= 0 ? "+" : ""}${diff.wonPct}%)`, 18, y + 21);
            doc.text(`• Leads Qualificados: ${mA.leadsQualified} vs ${mB.leadsQualified} (Variação: ${diff.leadsPct >= 0 ? "+" : ""}${diff.leadsPct}%)`, 18, y + 27);
            doc.text(`• Tarefas Concluídas: ${mA.completedTasks} vs ${mB.completedTasks} (Variação: ${diff.tasksPct >= 0 ? "+" : ""}${diff.tasksPct}%)`, 18, y + 33);

            y += 48;

            // Tabela Anual dos 12 Meses
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(124, 58, 237);
            doc.text(`EVOLUÇÃO MÊS A MÊS DO ANO DE ${year}`, 14, y);
            y += 6;

            const annualData = Store.getAnnualOverview(year);
            const headers = [["Mês", "Faturamento", "Vendas", "Leads Qual.", "Tarefas", "Estratégias", "Conversão"]];
            const rows = annualData.months.map((m, idx) => [
                monthNames[idx],
                fmtBrl(m.revenue),
                `${m.wonCount}/${m.proposalsCount}`,
                String(m.leadsQualified),
                String(m.completedTasks),
                String(m.strategiesCount),
                `${m.conversionRate}%`
            ]);

            if (doc.autoTable) {
                doc.autoTable({
                    startY: y,
                    head: headers,
                    body: rows,
                    theme: "striped",
                    headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: "bold" },
                    styles: { fontSize: 8, cellPadding: 3 }
                });
            }

            doc.save(`VelliaCRM_Comparativo_${monthNames[monthA - 1]}_vs_${monthNames[monthB - 1]}_${year}.pdf`);
            this.addAgentLog("Guru de Estratégias", "Relatório comparativo de meses exportado em PDF.", "success");
        } catch(err) {
            console.error("Erro PDF comparativo:", err);
            alert(`Erro ao gerar PDF comparativo: ${err.message}`);
        }
    },

    exportMonthlyComparisonCSV() {
        const yearSelect = document.getElementById("comp-select-year");
        const year = yearSelect ? Number(yearSelect.value) : new Date().getFullYear();
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        const annualData = Store.getAnnualOverview(year);
        let csvContent = "data:text/csv;charset=utf-8,Mes;Faturamento_BRL;Vendas_Ganhadas;Propostas_Totais;Leads_Qualificados;Tarefas_Concluidas;Estrategias_IA;Taxa_Conversao_Pct\n";

        annualData.months.forEach((m, idx) => {
            csvContent += `${monthNames[idx]};${m.revenue};${m.wonCount};${m.proposalsCount};${m.leadsQualified};${m.completedTasks};${m.strategiesCount};${m.conversionRate}%\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `VelliaCRM_Evolucao_Anual_${year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.addAgentLog("Guru de Estratégias", "Dados comparativos exportados em CSV.", "success");
    }
};
