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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
            const leads     = Store.getLeads();
            const files     = JSON.parse(localStorage.getItem('guru_files') || '[]');
            const icp       = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
            const history   = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
            const notes     = document.getElementById('guru-notes-input')?.value || '';

            // Contexto dos documentos
            const docsContext = files.length > 0
                ? files.map(f => '=== DOCUMENTO: ' + f.name + ' (' + (f.source === 'pdf_extracted' ? f.pages + ' págs extraídas' : f.type) + ') ===\n' + (f.content || '').substring(0, 10000)).join('\n\n')
                : 'Nenhum documento carregado.';

            // Perfil ICP
            const icpContext = (icp && Object.values(icp).some(v => v))
                ? '- Segmento-alvo: ' + (icp.segment || 'N/D') + '\n' +
                  '- Porte da empresa: ' + (icp.size || 'N/D') + '\n' +
                  '- Cargo do tomador de decisão: ' + (icp.role || 'N/D') + '\n' +
                  '- Localização preferencial: ' + (icp.location || 'N/D') + '\n' +
                  '- Faixa de orçamento/ticket: ' + (icp.budget || 'N/D') + '\n' +
                  '- Principais dores que resolve: ' + (icp.pain || 'N/D')
                : 'ICP não configurado — estratégia será genérica.';

            // Leads CRM
            const leadsSummary = leads.length > 0
                ? leads.slice(0, 30).map(l => '• ' + l.company + ' | ' + l.contact + ' | ' + (l.role||'-') + ' | ' + (l.segment||'-') + ' | ' + l.stage).join('\n')
                : 'Nenhum lead no CRM.';

            // Histórico
            const historyContext = history.length > 0
                ? 'Últimas ' + Math.min(history.length,3) + ' estratégias (NÃO repita estas táticas):\n' +
                  history.slice(0,3).map((h,i) => '[Semana ' + (i+1) + ' - ' + h.date + ']: ' + h.summary).join('\n')
                : 'Sem histórico de estratégias anteriores.';

            const prompt = `Você é o GURU DE ESTRATÉGIAS COMERCIAIS do VelliaCRM — um consultor sênior especializado em prospecção ativa, outbound B2B/B2C e social selling.

Sua missão: gerar um PLANEJAMENTO SEMANAL DE CAPTAÇÃO DE LEADS ultra-específico, baseado nos dados reais fornecidos abaixo.

═══════════════════════════════════════
🎯 PERFIL DO CLIENTE IDEAL (ICP)
═══════════════════════════════════════
${icpContext}

═══════════════════════════════════════
📁 BASE DE CONHECIMENTO (documentos enviados)
═══════════════════════════════════════
${docsContext}

═══════════════════════════════════════
📋 LEADS ATUAIS NO CRM
═══════════════════════════════════════
${leadsSummary}

═══════════════════════════════════════
📝 ANOTAÇÕES ADICIONAIS DO GESTOR
═══════════════════════════════════════
${notes || 'Nenhuma anotação adicional.'}

═══════════════════════════════════════
🕐 HISTÓRICO (NÃO REPITA ESTAS TÁTICAS)
═══════════════════════════════════════
${historyContext}

═══════════════════════════════════════
GERE O PLANO ESTRATÉGICO SEMANAL:
═══════════════════════════════════════
Crie um plano COMPLETO, ESPECÍFICO e ACIONÁVEL. Baseie CADA recomendação nos documentos e no ICP fornecidos.

## 🎯 Foco Estratégico da Semana
Descreva exatamente qual subperfil do ICP atacar esta semana e por quê (cite dados dos documentos se disponíveis).

## 📍 Onde os Leads Estão & Como Chegar
Liste os canais exatos onde esse perfil de cliente está (grupos LinkedIn, eventos, associações, regiões, horários). Seja específico.

## 💬 Scripts de Abordagem
Crie 2 scripts prontos para uso: um para WhatsApp e um para LinkedIn/e-mail. Personalize para o cargo e dor do ICP.

## 📊 Análise do Pipeline Atual
Comente o que os leads no CRM indicam sobre oportunidades desta semana.

## ✅ Tarefas da Semana para os Vendedores
Liste de 3 a 5 ações práticas e objetivas. Seja específico (ex: "Enviar mensagem X para 10 empresas do segmento Y na cidade Z").

Ao final, adicione OBRIGATORIAMENTE as tags no formato exato:
[TAREFA_VENDEDOR: <texto completo da tarefa com contexto suficiente para o vendedor executar>]

Crie entre 3 e 4 tags [TAREFA_VENDEDOR: ...]. Escreva de forma motivadora, direta e comercial.`;

            const res = await fetch('/api/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || 'HTTP ' + res.status);
            }

            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';

            textEl.innerHTML = this._renderMarkdown(strategyText);
            localStorage.setItem('guru_latest_suggested_strategy', strategyText);

            // Resumo para histórico
            const lines = strategyText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
            localStorage.setItem('guru_pending_summary', lines.slice(0, 3).join(' ').substring(0, 200) + '...');

            container.style.display = 'block';
            this.addAgentLog('Guru de Estratégias', 'Planejamento gerado com ' + files.length + ' doc(s) e ICP configurado.', 'success');

        } catch(err) {
            console.error('Erro ao gerar estratégia:', err);
            this.addAgentLog('Guru de Estratégias', 'Erro ao gerar planejamento: ' + err.message, 'warn');
            textEl.innerHTML = "<p style='color:var(--danger);padding:12px;background:rgba(239,68,68,0.08);border-radius:8px'>⚠️ Erro: " + err.message + "</p>";
            container.style.display = 'block';
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = '<span>✨</span> Gerar Estratégia da Semana';
        }
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
        const btnGen = document.getElementById("btn-generate-weekly-strategy");
        const container = document.getElementById("guru-strategy-result-container");
        const textEl = document.getElementById("guru-strategy-text");
        
        if (!btnGen || !container || !textEl) return;
        
        btnGen.disabled = true;
        btnGen.innerHTML = `<span>⏳</span> Analisando dados & Gerando Planejamento...`;
        
        try {
            const leads = Store.getLeads();
            const proposals = Store.getProposals();
            const files = JSON.parse(localStorage.getItem("guru_files") || "[]");
            const notes = document.getElementById("guru-notes-input")?.value || "";
            
            const fileContexts = files.map(f => `Arquivo: ${f.name}\nConteúdo:\n${f.content}`).join("\n\n");
            const leadsSummary = leads.map(l => `- Empresa: ${l.company}, Contato: ${l.contact}, Cargo: ${l.role || "Não informado"}, Cidade: ${l.city || "Não informada"}, Segmento: ${l.segment || "Outros"}, Estágio: ${l.stage}`).join("\n");
            
            const prompt = `
Você é o Guru de Estratégias Semanais do VelliaCRM, um especialista em captação ativa de leads e planejamento comercial.
Sua missão é sugerir estratégias de captação orgânica e ativa (outbound, social selling, indicações) baseadas nos dados fornecidos pela empresa, permitindo que os vendedores captem leads além do tráfego pago.

DADOS DA EMPRESA (BASE DE CONHECIMENTO CARREGADA):
${fileContexts}

ANOTAÇÕES DE COMPORTAMENTO ADICIONAIS:
${notes}

LEADS ATUAIS NO CRM:
${leadsSummary}

Crie um plano estratégico prático para a semana atual em formato Markdown legível e atraente. O plano DEVE conter as seguintes seções estruturadas:
1. **Foco Estratégico da Semana** (Qual o público ideal a atacar e por quê).
2. **Onde os Leads Estão & Como Chegar** (Canais como LinkedIn, Instagram, Grupos, eventos específicos baseados no comportamento).
3. **Script de Abordagem Sugerido** (Mensagem prática de exemplo para WhatsApp ou E-mail).
4. **Tarefas Práticas Sugeridas para a Equipe de Vendas** (Crie de 3 a 5 tarefas objetivas e detalhadas para atribuir aos vendedores).

ATENÇÃO: No final do texto, adicione uma linha especial no formato exato:
[TAREFA_VENDEDOR: <Instrução da tarefa a ser cadastrada no sistema>]
Exemplo:
[TAREFA_VENDEDOR: Prospectar 5 novas empresas do segmento de Saúde no LinkedIn e enviar script de abordagem]
[TAREFA_VENDEDOR: Fazer follow-up com os leads parados no estágio de Contato há mais de 3 dias]

Crie de 2 a 4 tags de [TAREFA_VENDEDOR: ...] no final para que o CRM possa extraí-las e delegá-las automaticamente para os vendedores ativos se o administrador aceitar.
Escreva de forma motivadora, comercial e direta.
`;
            
            const res = await fetch(`/api/gemini-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }]
                })
            });
            
            if (!res.ok) throw new Error("Erro na API do Gemini");
            
            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, tive um problema ao me conectar com a inteligência do Gemini.";
            
            textEl.innerHTML = strategyText
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\n- (.*?)/g, "<br>• $1")
                .replace(/\[TAREFA_VENDEDOR:[^\]]+\]/g, ""); // Clean raw tags from visual preview
                
            localStorage.setItem("guru_latest_suggested_strategy", strategyText);
            
            container.style.display = "block";
            this.addAgentLog("Guru de Estratégias", "Nova estratégia semanal gerada com sucesso.", "success");
            
        } catch (err) {
            console.error("Erro ao gerar estratégia semanal:", err);
            this.addAgentLog("Guru de Estratégias", "Erro ao gerar estratégia semanal no Gemini.", "warn");
            textEl.innerHTML = "<p style='color: var(--danger);'>Ocorreu um erro ao gerar a estratégia com a IA. Por favor, tente novamente ou verifique sua conexão.</p>";
            container.style.display = "block";
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = `<span>✨</span> Gerar Estratégias da Semana`;
        }
    },


    acceptStrategy() {
        const latestStrategy = localStorage.getItem('guru_latest_suggested_strategy');
        if (!latestStrategy) return;

        localStorage.setItem('active_weekly_strategy', latestStrategy);

        // Salvar no histórico
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const summary = localStorage.getItem('guru_pending_summary') || latestStrategy.substring(0, 150) + '...';
        history.unshift({ date: new Date().toLocaleDateString('pt-BR'), summary, icp: JSON.parse(localStorage.getItem('guru_icp_profile') || '{}') });
        if (history.length > 5) history.splice(5);
        localStorage.setItem('guru_strategy_history', JSON.stringify(history));
        localStorage.removeItem('guru_pending_summary');

        // Extrair e distribuir tarefas
        const regex = /[TAREFA_VENDEDOR:s*(.*?)]/g;
        const tasks = [];
        let match;
        while ((match = regex.exec(latestStrategy)) !== null) { if (match[1]) tasks.push(match[1].trim()); }

        const sellers = Store.getUsers().filter(u => u.role === 'seller');
        const today   = new Date().toLocaleDateString('pt-BR');

        sellers.forEach(seller => {
            const sellerTasks = Store.getTasks(seller.email);
            tasks.forEach(taskText => {
                sellerTasks.unshift({ id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), text: taskText, priority: 'high', done: false, date: today, assignedBy: 'agent@vellia.ai' });
            });
            Store.saveTasks(seller.email, sellerTasks);
        });

        this.addAgentLog('Guru de Estratégias', 'Planejamento aceito. ' + tasks.length + ' tarefa(s) para ' + sellers.length + ' vendedor(es).', 'success');
        alert('✅ Planejamento ativado!\n' + tasks.length + ' tarefa(s) atribuída(s) com prioridade Alta.');
        Store.addLog('admin@vellia.com', 'GURU_STRATEGY_ACCEPTED', 'Planejamento aceito. ' + tasks.length + ' tarefas atribuídas.', 'SUCCESS');

        const container = document.getElementById('guru-strategy-result-container');
        if (container) container.style.display = 'none';
        const guruPanel = document.getElementById('guru-strategic-panel');
        if (guruPanel) guruPanel.style.display = 'none';

        this.renderStrategyHistory();
        this.updateContextChecklist();
        window.dispatchEvent(new CustomEvent('vellia:waSent'));
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
            const leads     = Store.getLeads();
            const files     = JSON.parse(localStorage.getItem('guru_files') || '[]');
            const icp       = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
            const history   = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
            const notes     = document.getElementById('guru-notes-input')?.value || '';

            // Contexto dos documentos
            const docsContext = files.length > 0
                ? files.map(f => '=== DOCUMENTO: ' + f.name + ' (' + (f.source === 'pdf_extracted' ? f.pages + ' págs extraídas' : f.type) + ') ===\n' + (f.content || '').substring(0, 10000)).join('\n\n')
                : 'Nenhum documento carregado.';

            // Perfil ICP
            const icpContext = (icp && Object.values(icp).some(v => v))
                ? '- Segmento-alvo: ' + (icp.segment || 'N/D') + '\n' +
                  '- Porte da empresa: ' + (icp.size || 'N/D') + '\n' +
                  '- Cargo do tomador de decisão: ' + (icp.role || 'N/D') + '\n' +
                  '- Localização preferencial: ' + (icp.location || 'N/D') + '\n' +
                  '- Faixa de orçamento/ticket: ' + (icp.budget || 'N/D') + '\n' +
                  '- Principais dores que resolve: ' + (icp.pain || 'N/D')
                : 'ICP não configurado — estratégia será genérica.';

            // Leads CRM
            const leadsSummary = leads.length > 0
                ? leads.slice(0, 30).map(l => '• ' + l.company + ' | ' + l.contact + ' | ' + (l.role||'-') + ' | ' + (l.segment||'-') + ' | ' + l.stage).join('\n')
                : 'Nenhum lead no CRM.';

            // Histórico
            const historyContext = history.length > 0
                ? 'Últimas ' + Math.min(history.length,3) + ' estratégias (NÃO repita estas táticas):\n' +
                  history.slice(0,3).map((h,i) => '[Semana ' + (i+1) + ' - ' + h.date + ']: ' + h.summary).join('\n')
                : 'Sem histórico de estratégias anteriores.';

            const prompt = `Você é o GURU DE ESTRATÉGIAS COMERCIAIS do VelliaCRM — um consultor sênior especializado em prospecção ativa, outbound B2B/B2C e social selling.

Sua missão: gerar um PLANEJAMENTO SEMANAL DE CAPTAÇÃO DE LEADS ultra-específico, baseado nos dados reais fornecidos abaixo.

═══════════════════════════════════════
🎯 PERFIL DO CLIENTE IDEAL (ICP)
═══════════════════════════════════════
${icpContext}

═══════════════════════════════════════
📁 BASE DE CONHECIMENTO (documentos enviados)
═══════════════════════════════════════
${docsContext}

═══════════════════════════════════════
📋 LEADS ATUAIS NO CRM
═══════════════════════════════════════
${leadsSummary}

═══════════════════════════════════════
📝 ANOTAÇÕES ADICIONAIS DO GESTOR
═══════════════════════════════════════
${notes || 'Nenhuma anotação adicional.'}

═══════════════════════════════════════
🕐 HISTÓRICO (NÃO REPITA ESTAS TÁTICAS)
═══════════════════════════════════════
${historyContext}

═══════════════════════════════════════
GERE O PLANO ESTRATÉGICO SEMANAL:
═══════════════════════════════════════
Crie um plano COMPLETO, ESPECÍFICO e ACIONÁVEL. Baseie CADA recomendação nos documentos e no ICP fornecidos.

## 🎯 Foco Estratégico da Semana
Descreva exatamente qual subperfil do ICP atacar esta semana e por quê (cite dados dos documentos se disponíveis).

## 📍 Onde os Leads Estão & Como Chegar
Liste os canais exatos onde esse perfil de cliente está (grupos LinkedIn, eventos, associações, regiões, horários). Seja específico.

## 💬 Scripts de Abordagem
Crie 2 scripts prontos para uso: um para WhatsApp e um para LinkedIn/e-mail. Personalize para o cargo e dor do ICP.

## 📊 Análise do Pipeline Atual
Comente o que os leads no CRM indicam sobre oportunidades desta semana.

## ✅ Tarefas da Semana para os Vendedores
Liste de 3 a 5 ações práticas e objetivas. Seja específico (ex: "Enviar mensagem X para 10 empresas do segmento Y na cidade Z").

Ao final, adicione OBRIGATORIAMENTE as tags no formato exato:
[TAREFA_VENDEDOR: <texto completo da tarefa com contexto suficiente para o vendedor executar>]

Crie entre 3 e 4 tags [TAREFA_VENDEDOR: ...]. Escreva de forma motivadora, direta e comercial.`;

            const res = await fetch('/api/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || 'HTTP ' + res.status);
            }

            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';

            textEl.innerHTML = this._renderMarkdown(strategyText);
            localStorage.setItem('guru_latest_suggested_strategy', strategyText);

            // Resumo para histórico
            const lines = strategyText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
            localStorage.setItem('guru_pending_summary', lines.slice(0, 3).join(' ').substring(0, 200) + '...');

            container.style.display = 'block';
            this.addAgentLog('Guru de Estratégias', 'Planejamento gerado com ' + files.length + ' doc(s) e ICP configurado.', 'success');

        } catch(err) {
            console.error('Erro ao gerar estratégia:', err);
            this.addAgentLog('Guru de Estratégias', 'Erro ao gerar planejamento: ' + err.message, 'warn');
            textEl.innerHTML = "<p style='color:var(--danger);padding:12px;background:rgba(239,68,68,0.08);border-radius:8px'>⚠️ Erro: " + err.message + "</p>";
            container.style.display = 'block';
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = '<span>✨</span> Gerar Estratégia da Semana';
        }
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
        const btnGen = document.getElementById("btn-generate-weekly-strategy");
        const container = document.getElementById("guru-strategy-result-container");
        const textEl = document.getElementById("guru-strategy-text");
        
        if (!btnGen || !container || !textEl) return;
        
        btnGen.disabled = true;
        btnGen.innerHTML = `<span>⏳</span> Analisando dados & Gerando Planejamento...`;
        
        try {
            const leads = Store.getLeads();
            const proposals = Store.getProposals();
            const files = JSON.parse(localStorage.getItem("guru_files") || "[]");
            const notes = document.getElementById("guru-notes-input")?.value || "";
            
            const fileContexts = files.map(f => `Arquivo: ${f.name}\nConteúdo:\n${f.content}`).join("\n\n");
            const leadsSummary = leads.map(l => `- Empresa: ${l.company}, Contato: ${l.contact}, Cargo: ${l.role || "Não informado"}, Cidade: ${l.city || "Não informada"}, Segmento: ${l.segment || "Outros"}, Estágio: ${l.stage}`).join("\n");
            
            const prompt = `
Você é o Guru de Estratégias Semanais do VelliaCRM, um especialista em captação ativa de leads e planejamento comercial.
Sua missão é sugerir estratégias de captação orgânica e ativa (outbound, social selling, indicações) baseadas nos dados fornecidos pela empresa, permitindo que os vendedores captem leads além do tráfego pago.

DADOS DA EMPRESA (BASE DE CONHECIMENTO CARREGADA):
${fileContexts}

ANOTAÇÕES DE COMPORTAMENTO ADICIONAIS:
${notes}

LEADS ATUAIS NO CRM:
${leadsSummary}

Crie um plano estratégico prático para a semana atual em formato Markdown legível e atraente. O plano DEVE conter as seguintes seções estruturadas:
1. **Foco Estratégico da Semana** (Qual o público ideal a atacar e por quê).
2. **Onde os Leads Estão & Como Chegar** (Canais como LinkedIn, Instagram, Grupos, eventos específicos baseados no comportamento).
3. **Script de Abordagem Sugerido** (Mensagem prática de exemplo para WhatsApp ou E-mail).
4. **Tarefas Práticas Sugeridas para a Equipe de Vendas** (Crie de 3 a 5 tarefas objetivas e detalhadas para atribuir aos vendedores).

ATENÇÃO: No final do texto, adicione uma linha especial no formato exato:
[TAREFA_VENDEDOR: <Instrução da tarefa a ser cadastrada no sistema>]
Exemplo:
[TAREFA_VENDEDOR: Prospectar 5 novas empresas do segmento de Saúde no LinkedIn e enviar script de abordagem]
[TAREFA_VENDEDOR: Fazer follow-up com os leads parados no estágio de Contato há mais de 3 dias]

Crie de 2 a 4 tags de [TAREFA_VENDEDOR: ...] no final para que o CRM possa extraí-las e delegá-las automaticamente para os vendedores ativos se o administrador aceitar.
Escreva de forma motivadora, comercial e direta.
`;
            
            const res = await fetch(`/api/gemini-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }]
                })
            });
            
            if (!res.ok) throw new Error("Erro na API do Gemini");
            
            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, tive um problema ao me conectar com a inteligência do Gemini.";
            
            textEl.innerHTML = strategyText
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\n- (.*?)/g, "<br>• $1")
                .replace(/\[TAREFA_VENDEDOR:[^\]]+\]/g, ""); // Clean raw tags from visual preview
                
            localStorage.setItem("guru_latest_suggested_strategy", strategyText);
            
            container.style.display = "block";
            this.addAgentLog("Guru de Estratégias", "Nova estratégia semanal gerada com sucesso.", "success");
            
        } catch (err) {
            console.error("Erro ao gerar estratégia semanal:", err);
            this.addAgentLog("Guru de Estratégias", "Erro ao gerar estratégia semanal no Gemini.", "warn");
            textEl.innerHTML = "<p style='color: var(--danger);'>Ocorreu um erro ao gerar a estratégia com a IA. Por favor, tente novamente ou verifique sua conexão.</p>";
            container.style.display = "block";
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = `<span>✨</span> Gerar Estratégias da Semana`;
        }
    },

    acceptStrategy() {
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (!latestStrategy) return;
        
        // Save as active strategy
        localStorage.setItem("active_weekly_strategy", latestStrategy);
        
        // Extract seller tasks from tags
        const regex = /\[TAREFA_VENDEDOR:\s*(.*?)\]/g;
        const tasks = [];
        let match;
        while ((match = regex.exec(latestStrategy)) !== null) {
            if (match[1]) tasks.push(match[1].trim());
        }
        
        // Distribute tasks to all sellers
        const sellers = Store.getUsers().filter(u => u.role === "seller");
        const today = new Date().toLocaleDateString("pt-BR");
        
        let assignedCount = 0;
        sellers.forEach(seller => {
            const sellerTasks = Store.getTasks(seller.email);
            tasks.forEach(taskText => {
                sellerTasks.unshift({
                    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    text: taskText,
                    priority: "high",
                    done: false,
                    date: today,
                    assignedBy: "agent@vellia.ai"
                });
                assignedCount++;
            });
            Store.saveTasks(seller.email, sellerTasks);
        });
        
        this.addAgentLog("Guru de Estratégias", `Estratégia semanal aceita pelo Administrador. ${tasks.length} tarefas atribuídas para ${sellers.length} vendedores.`, "success");
        
        // Show success alert
        alert(`Planejamento ativado! ${tasks.length} tarefas foram atribuídas com prioridade Alta para cada vendedor.`);
        
        // Log action
        Store.addLog("admin@vellia.com", "GURU_STRATEGY_ACCEPTED", `Administrador aceitou o planejamento estratégico da semana. Atribuídas ${tasks.length} tarefas.`, "SUCCESS");
        
        // Hide strategic panel and strategy preview
        const container = document.getElementById("guru-strategy-result-container");
        if (container) container.style.display = "none";
        
        const guruPanel = document.getElementById("guru-strategic-panel");
        if (guruPanel) guruPanel.style.display = "none";
        
        // Dispatch event to refresh views/dashboard
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
    },


    rejectStrategy() {
        localStorage.removeItem('guru_latest_suggested_strategy');
        localStorage.removeItem('guru_pending_summary');
        this.addAgentLog('Guru de Estratégias', 'Sugestão descartada pelo Administrador.', 'warn');
        const container = document.getElementById('guru-strategy-result-container');
        if (container) container.style.display = 'none';
        Store.addLog('admin@vellia.com', 'GURU_STRATEGY_REJECTED', 'Administrador descartou o planejamento.', 'WARN');
        alert('Sugestão de planejamento descartada.');
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
            const leads     = Store.getLeads();
            const files     = JSON.parse(localStorage.getItem('guru_files') || '[]');
            const icp       = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
            const history   = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
            const notes     = document.getElementById('guru-notes-input')?.value || '';

            // Contexto dos documentos
            const docsContext = files.length > 0
                ? files.map(f => '=== DOCUMENTO: ' + f.name + ' (' + (f.source === 'pdf_extracted' ? f.pages + ' págs extraídas' : f.type) + ') ===\n' + (f.content || '').substring(0, 10000)).join('\n\n')
                : 'Nenhum documento carregado.';

            // Perfil ICP
            const icpContext = (icp && Object.values(icp).some(v => v))
                ? '- Segmento-alvo: ' + (icp.segment || 'N/D') + '\n' +
                  '- Porte da empresa: ' + (icp.size || 'N/D') + '\n' +
                  '- Cargo do tomador de decisão: ' + (icp.role || 'N/D') + '\n' +
                  '- Localização preferencial: ' + (icp.location || 'N/D') + '\n' +
                  '- Faixa de orçamento/ticket: ' + (icp.budget || 'N/D') + '\n' +
                  '- Principais dores que resolve: ' + (icp.pain || 'N/D')
                : 'ICP não configurado — estratégia será genérica.';

            // Leads CRM
            const leadsSummary = leads.length > 0
                ? leads.slice(0, 30).map(l => '• ' + l.company + ' | ' + l.contact + ' | ' + (l.role||'-') + ' | ' + (l.segment||'-') + ' | ' + l.stage).join('\n')
                : 'Nenhum lead no CRM.';

            // Histórico
            const historyContext = history.length > 0
                ? 'Últimas ' + Math.min(history.length,3) + ' estratégias (NÃO repita estas táticas):\n' +
                  history.slice(0,3).map((h,i) => '[Semana ' + (i+1) + ' - ' + h.date + ']: ' + h.summary).join('\n')
                : 'Sem histórico de estratégias anteriores.';

            const prompt = `Você é o GURU DE ESTRATÉGIAS COMERCIAIS do VelliaCRM — um consultor sênior especializado em prospecção ativa, outbound B2B/B2C e social selling.

Sua missão: gerar um PLANEJAMENTO SEMANAL DE CAPTAÇÃO DE LEADS ultra-específico, baseado nos dados reais fornecidos abaixo.

═══════════════════════════════════════
🎯 PERFIL DO CLIENTE IDEAL (ICP)
═══════════════════════════════════════
${icpContext}

═══════════════════════════════════════
📁 BASE DE CONHECIMENTO (documentos enviados)
═══════════════════════════════════════
${docsContext}

═══════════════════════════════════════
📋 LEADS ATUAIS NO CRM
═══════════════════════════════════════
${leadsSummary}

═══════════════════════════════════════
📝 ANOTAÇÕES ADICIONAIS DO GESTOR
═══════════════════════════════════════
${notes || 'Nenhuma anotação adicional.'}

═══════════════════════════════════════
🕐 HISTÓRICO (NÃO REPITA ESTAS TÁTICAS)
═══════════════════════════════════════
${historyContext}

═══════════════════════════════════════
GERE O PLANO ESTRATÉGICO SEMANAL:
═══════════════════════════════════════
Crie um plano COMPLETO, ESPECÍFICO e ACIONÁVEL. Baseie CADA recomendação nos documentos e no ICP fornecidos.

## 🎯 Foco Estratégico da Semana
Descreva exatamente qual subperfil do ICP atacar esta semana e por quê (cite dados dos documentos se disponíveis).

## 📍 Onde os Leads Estão & Como Chegar
Liste os canais exatos onde esse perfil de cliente está (grupos LinkedIn, eventos, associações, regiões, horários). Seja específico.

## 💬 Scripts de Abordagem
Crie 2 scripts prontos para uso: um para WhatsApp e um para LinkedIn/e-mail. Personalize para o cargo e dor do ICP.

## 📊 Análise do Pipeline Atual
Comente o que os leads no CRM indicam sobre oportunidades desta semana.

## ✅ Tarefas da Semana para os Vendedores
Liste de 3 a 5 ações práticas e objetivas. Seja específico (ex: "Enviar mensagem X para 10 empresas do segmento Y na cidade Z").

Ao final, adicione OBRIGATORIAMENTE as tags no formato exato:
[TAREFA_VENDEDOR: <texto completo da tarefa com contexto suficiente para o vendedor executar>]

Crie entre 3 e 4 tags [TAREFA_VENDEDOR: ...]. Escreva de forma motivadora, direta e comercial.`;

            const res = await fetch('/api/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || 'HTTP ' + res.status);
            }

            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';

            textEl.innerHTML = this._renderMarkdown(strategyText);
            localStorage.setItem('guru_latest_suggested_strategy', strategyText);

            // Resumo para histórico
            const lines = strategyText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
            localStorage.setItem('guru_pending_summary', lines.slice(0, 3).join(' ').substring(0, 200) + '...');

            container.style.display = 'block';
            this.addAgentLog('Guru de Estratégias', 'Planejamento gerado com ' + files.length + ' doc(s) e ICP configurado.', 'success');

        } catch(err) {
            console.error('Erro ao gerar estratégia:', err);
            this.addAgentLog('Guru de Estratégias', 'Erro ao gerar planejamento: ' + err.message, 'warn');
            textEl.innerHTML = "<p style='color:var(--danger);padding:12px;background:rgba(239,68,68,0.08);border-radius:8px'>⚠️ Erro: " + err.message + "</p>";
            container.style.display = 'block';
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = '<span>✨</span> Gerar Estratégia da Semana';
        }
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
        const btnGen = document.getElementById("btn-generate-weekly-strategy");
        const container = document.getElementById("guru-strategy-result-container");
        const textEl = document.getElementById("guru-strategy-text");
        
        if (!btnGen || !container || !textEl) return;
        
        btnGen.disabled = true;
        btnGen.innerHTML = `<span>⏳</span> Analisando dados & Gerando Planejamento...`;
        
        try {
            const leads = Store.getLeads();
            const proposals = Store.getProposals();
            const files = JSON.parse(localStorage.getItem("guru_files") || "[]");
            const notes = document.getElementById("guru-notes-input")?.value || "";
            
            const fileContexts = files.map(f => `Arquivo: ${f.name}\nConteúdo:\n${f.content}`).join("\n\n");
            const leadsSummary = leads.map(l => `- Empresa: ${l.company}, Contato: ${l.contact}, Cargo: ${l.role || "Não informado"}, Cidade: ${l.city || "Não informada"}, Segmento: ${l.segment || "Outros"}, Estágio: ${l.stage}`).join("\n");
            
            const prompt = `
Você é o Guru de Estratégias Semanais do VelliaCRM, um especialista em captação ativa de leads e planejamento comercial.
Sua missão é sugerir estratégias de captação orgânica e ativa (outbound, social selling, indicações) baseadas nos dados fornecidos pela empresa, permitindo que os vendedores captem leads além do tráfego pago.

DADOS DA EMPRESA (BASE DE CONHECIMENTO CARREGADA):
${fileContexts}

ANOTAÇÕES DE COMPORTAMENTO ADICIONAIS:
${notes}

LEADS ATUAIS NO CRM:
${leadsSummary}

Crie um plano estratégico prático para a semana atual em formato Markdown legível e atraente. O plano DEVE conter as seguintes seções estruturadas:
1. **Foco Estratégico da Semana** (Qual o público ideal a atacar e por quê).
2. **Onde os Leads Estão & Como Chegar** (Canais como LinkedIn, Instagram, Grupos, eventos específicos baseados no comportamento).
3. **Script de Abordagem Sugerido** (Mensagem prática de exemplo para WhatsApp ou E-mail).
4. **Tarefas Práticas Sugeridas para a Equipe de Vendas** (Crie de 3 a 5 tarefas objetivas e detalhadas para atribuir aos vendedores).

ATENÇÃO: No final do texto, adicione uma linha especial no formato exato:
[TAREFA_VENDEDOR: <Instrução da tarefa a ser cadastrada no sistema>]
Exemplo:
[TAREFA_VENDEDOR: Prospectar 5 novas empresas do segmento de Saúde no LinkedIn e enviar script de abordagem]
[TAREFA_VENDEDOR: Fazer follow-up com os leads parados no estágio de Contato há mais de 3 dias]

Crie de 2 a 4 tags de [TAREFA_VENDEDOR: ...] no final para que o CRM possa extraí-las e delegá-las automaticamente para os vendedores ativos se o administrador aceitar.
Escreva de forma motivadora, comercial e direta.
`;
            
            const res = await fetch(`/api/gemini-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }]
                })
            });
            
            if (!res.ok) throw new Error("Erro na API do Gemini");
            
            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, tive um problema ao me conectar com a inteligência do Gemini.";
            
            textEl.innerHTML = strategyText
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\n- (.*?)/g, "<br>• $1")
                .replace(/\[TAREFA_VENDEDOR:[^\]]+\]/g, ""); // Clean raw tags from visual preview
                
            localStorage.setItem("guru_latest_suggested_strategy", strategyText);
            
            container.style.display = "block";
            this.addAgentLog("Guru de Estratégias", "Nova estratégia semanal gerada com sucesso.", "success");
            
        } catch (err) {
            console.error("Erro ao gerar estratégia semanal:", err);
            this.addAgentLog("Guru de Estratégias", "Erro ao gerar estratégia semanal no Gemini.", "warn");
            textEl.innerHTML = "<p style='color: var(--danger);'>Ocorreu um erro ao gerar a estratégia com a IA. Por favor, tente novamente ou verifique sua conexão.</p>";
            container.style.display = "block";
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = `<span>✨</span> Gerar Estratégias da Semana`;
        }
    },


    acceptStrategy() {
        const latestStrategy = localStorage.getItem('guru_latest_suggested_strategy');
        if (!latestStrategy) return;

        localStorage.setItem('active_weekly_strategy', latestStrategy);

        // Salvar no histórico
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const summary = localStorage.getItem('guru_pending_summary') || latestStrategy.substring(0, 150) + '...';
        history.unshift({ date: new Date().toLocaleDateString('pt-BR'), summary, icp: JSON.parse(localStorage.getItem('guru_icp_profile') || '{}') });
        if (history.length > 5) history.splice(5);
        localStorage.setItem('guru_strategy_history', JSON.stringify(history));
        localStorage.removeItem('guru_pending_summary');

        // Extrair e distribuir tarefas
        const regex = /[TAREFA_VENDEDOR:s*(.*?)]/g;
        const tasks = [];
        let match;
        while ((match = regex.exec(latestStrategy)) !== null) { if (match[1]) tasks.push(match[1].trim()); }

        const sellers = Store.getUsers().filter(u => u.role === 'seller');
        const today   = new Date().toLocaleDateString('pt-BR');

        sellers.forEach(seller => {
            const sellerTasks = Store.getTasks(seller.email);
            tasks.forEach(taskText => {
                sellerTasks.unshift({ id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), text: taskText, priority: 'high', done: false, date: today, assignedBy: 'agent@vellia.ai' });
            });
            Store.saveTasks(seller.email, sellerTasks);
        });

        this.addAgentLog('Guru de Estratégias', 'Planejamento aceito. ' + tasks.length + ' tarefa(s) para ' + sellers.length + ' vendedor(es).', 'success');
        alert('✅ Planejamento ativado!\n' + tasks.length + ' tarefa(s) atribuída(s) com prioridade Alta.');
        Store.addLog('admin@vellia.com', 'GURU_STRATEGY_ACCEPTED', 'Planejamento aceito. ' + tasks.length + ' tarefas atribuídas.', 'SUCCESS');

        const container = document.getElementById('guru-strategy-result-container');
        if (container) container.style.display = 'none';
        const guruPanel = document.getElementById('guru-strategic-panel');
        if (guruPanel) guruPanel.style.display = 'none';

        this.renderStrategyHistory();
        this.updateContextChecklist();
        window.dispatchEvent(new CustomEvent('vellia:waSent'));
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
            const leads     = Store.getLeads();
            const files     = JSON.parse(localStorage.getItem('guru_files') || '[]');
            const icp       = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
            const history   = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
            const notes     = document.getElementById('guru-notes-input')?.value || '';

            // Contexto dos documentos
            const docsContext = files.length > 0
                ? files.map(f => '=== DOCUMENTO: ' + f.name + ' (' + (f.source === 'pdf_extracted' ? f.pages + ' págs extraídas' : f.type) + ') ===\n' + (f.content || '').substring(0, 10000)).join('\n\n')
                : 'Nenhum documento carregado.';

            // Perfil ICP
            const icpContext = (icp && Object.values(icp).some(v => v))
                ? '- Segmento-alvo: ' + (icp.segment || 'N/D') + '\n' +
                  '- Porte da empresa: ' + (icp.size || 'N/D') + '\n' +
                  '- Cargo do tomador de decisão: ' + (icp.role || 'N/D') + '\n' +
                  '- Localização preferencial: ' + (icp.location || 'N/D') + '\n' +
                  '- Faixa de orçamento/ticket: ' + (icp.budget || 'N/D') + '\n' +
                  '- Principais dores que resolve: ' + (icp.pain || 'N/D')
                : 'ICP não configurado — estratégia será genérica.';

            // Leads CRM
            const leadsSummary = leads.length > 0
                ? leads.slice(0, 30).map(l => '• ' + l.company + ' | ' + l.contact + ' | ' + (l.role||'-') + ' | ' + (l.segment||'-') + ' | ' + l.stage).join('\n')
                : 'Nenhum lead no CRM.';

            // Histórico
            const historyContext = history.length > 0
                ? 'Últimas ' + Math.min(history.length,3) + ' estratégias (NÃO repita estas táticas):\n' +
                  history.slice(0,3).map((h,i) => '[Semana ' + (i+1) + ' - ' + h.date + ']: ' + h.summary).join('\n')
                : 'Sem histórico de estratégias anteriores.';

            const prompt = `Você é o GURU DE ESTRATÉGIAS COMERCIAIS do VelliaCRM — um consultor sênior especializado em prospecção ativa, outbound B2B/B2C e social selling.

Sua missão: gerar um PLANEJAMENTO SEMANAL DE CAPTAÇÃO DE LEADS ultra-específico, baseado nos dados reais fornecidos abaixo.

═══════════════════════════════════════
🎯 PERFIL DO CLIENTE IDEAL (ICP)
═══════════════════════════════════════
${icpContext}

═══════════════════════════════════════
📁 BASE DE CONHECIMENTO (documentos enviados)
═══════════════════════════════════════
${docsContext}

═══════════════════════════════════════
📋 LEADS ATUAIS NO CRM
═══════════════════════════════════════
${leadsSummary}

═══════════════════════════════════════
📝 ANOTAÇÕES ADICIONAIS DO GESTOR
═══════════════════════════════════════
${notes || 'Nenhuma anotação adicional.'}

═══════════════════════════════════════
🕐 HISTÓRICO (NÃO REPITA ESTAS TÁTICAS)
═══════════════════════════════════════
${historyContext}

═══════════════════════════════════════
GERE O PLANO ESTRATÉGICO SEMANAL:
═══════════════════════════════════════
Crie um plano COMPLETO, ESPECÍFICO e ACIONÁVEL. Baseie CADA recomendação nos documentos e no ICP fornecidos.

## 🎯 Foco Estratégico da Semana
Descreva exatamente qual subperfil do ICP atacar esta semana e por quê (cite dados dos documentos se disponíveis).

## 📍 Onde os Leads Estão & Como Chegar
Liste os canais exatos onde esse perfil de cliente está (grupos LinkedIn, eventos, associações, regiões, horários). Seja específico.

## 💬 Scripts de Abordagem
Crie 2 scripts prontos para uso: um para WhatsApp e um para LinkedIn/e-mail. Personalize para o cargo e dor do ICP.

## 📊 Análise do Pipeline Atual
Comente o que os leads no CRM indicam sobre oportunidades desta semana.

## ✅ Tarefas da Semana para os Vendedores
Liste de 3 a 5 ações práticas e objetivas. Seja específico (ex: "Enviar mensagem X para 10 empresas do segmento Y na cidade Z").

Ao final, adicione OBRIGATORIAMENTE as tags no formato exato:
[TAREFA_VENDEDOR: <texto completo da tarefa com contexto suficiente para o vendedor executar>]

Crie entre 3 e 4 tags [TAREFA_VENDEDOR: ...]. Escreva de forma motivadora, direta e comercial.`;

            const res = await fetch('/api/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || 'HTTP ' + res.status);
            }

            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta da IA.';

            textEl.innerHTML = this._renderMarkdown(strategyText);
            localStorage.setItem('guru_latest_suggested_strategy', strategyText);

            // Resumo para histórico
            const lines = strategyText.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
            localStorage.setItem('guru_pending_summary', lines.slice(0, 3).join(' ').substring(0, 200) + '...');

            container.style.display = 'block';
            this.addAgentLog('Guru de Estratégias', 'Planejamento gerado com ' + files.length + ' doc(s) e ICP configurado.', 'success');

        } catch(err) {
            console.error('Erro ao gerar estratégia:', err);
            this.addAgentLog('Guru de Estratégias', 'Erro ao gerar planejamento: ' + err.message, 'warn');
            textEl.innerHTML = "<p style='color:var(--danger);padding:12px;background:rgba(239,68,68,0.08);border-radius:8px'>⚠️ Erro: " + err.message + "</p>";
            container.style.display = 'block';
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = '<span>✨</span> Gerar Estratégia da Semana';
        }
    },
t { Store } from "./store.js";
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

        // Configurar worker do PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Expor funções globais
        window.saveIcpProfile = () => this.saveIcpProfile();

        // Exibir estratégia cached se houver
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (latestStrategy) {
            const container = document.getElementById("guru-strategy-result-container");
            const textEl = document.getElementById("guru-strategy-text");
            if (container && textEl) {
                textEl.innerHTML = this._renderMarkdown ? this._renderMarkdown(latestStrategy) : latestStrategy;
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
                if (fileInput.files && fileInput.files[0]) {
                    this.handleGuruFileUpload(fileInput.files[0]);
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
            btnAccept.onclick = () => this.acceptStrategy();
        }

        const btnReject = document.getElementById("btn-reject-strategy");
        if (btnReject) {
            btnReject.onclick = () => this.rejectStrategy();
        }

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

    // Salvar Perfil ICP
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
        this.addAgentLog('Guru de Estratégias', 'Perfil ICP salvo: ' + (icp.segment || 'Segmento não definido') + ' — ' + (icp.role || 'Cargo não definido'), 'success');
        const btn = document.querySelector('[onclick="window.saveIcpProfile()"]');
        if (btn) { btn.textContent = '✅ Perfil ICP Salvo!'; setTimeout(() => { btn.textContent = '💾 Salvar Perfil ICP'; }, 2000); }
    },

    // Carregar ICP salvo nos campos
    loadIcpProfile() {
        const saved = localStorage.getItem('guru_icp_profile');
        if (!saved) return;
        try {
            const icp = JSON.parse(saved);
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('icp-segment',  icp.segment);
            setVal('icp-size',     icp.size);
            setVal('icp-role',     icp.role);
            setVal('icp-location', icp.location);
            setVal('icp-budget',   icp.budget);
            setVal('icp-pain',     icp.pain);
        } catch(e) {}
    },

    // Atualizar checklist de contexto
    updateContextChecklist() {
        const files   = JSON.parse(localStorage.getItem('guru_files') || '[]');
        const icp     = JSON.parse(localStorage.getItem('guru_icp_profile') || '{}');
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const icpFilled = icp && (icp.segment || icp.role || icp.pain);

        const icpIcon   = document.getElementById('guru-ctx-icp-icon');
        const docsIcon  = document.getElementById('guru-ctx-docs-icon');
        const histIcon  = document.getElementById('guru-ctx-history-icon');
        const docsCount = document.getElementById('guru-ctx-docs-count');
        const histCount = document.getElementById('guru-ctx-history-count');

        if (icpIcon)   icpIcon.textContent  = icpFilled       ? '🟢' : '⚪';
        if (docsIcon)  docsIcon.textContent  = files.length > 0 ? '🟢' : '⚪';
        if (histIcon)  histIcon.textContent  = history.length > 0 ? '🟢' : '⚪';
        if (docsCount) docsCount.textContent = files.length;
        if (histCount) histCount.textContent = history.length;
    },

    // Renderizador básico de Markdown para HTML
    _renderMarkdown(text) {
        return text
            .replace(/[TAREFA_VENDEDOR:[^]]+]/g, '')
            .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;color:var(--text-primary);margin:16px 0 6px">$1</h4>')
            .replace(/^## (.+)$/gm,  '<h3 style="font-size:15px;font-weight:800;color:#8b5cf6;margin:20px 0 8px">$1</h3>')
            .replace(/^# (.+)$/gm,   '<h2 style="font-size:17px;font-weight:900;color:var(--text-primary);margin:0 0 12px">$1</h2>')
            .replace(/**(.+?)**/g, '<strong>$1</strong>')
            .replace(/*(.+?)*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#8b5cf6;flex-shrink:0">•</span><span>$1</span></div>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
            .replace(/
{2,}/g, '<br><br>')
            .replace(/
/g, '<br>');
    },

    // Upload real de PDF com PDF.js
    async handleGuruFileUpload(file) {
        const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isText = file.type === 'application/json' || file.name.endsWith('.json')
                    || file.name.endsWith('.txt') || file.name.endsWith('.csv');

        const progressEl  = document.getElementById('guru-pdf-progress');
        const progressBar = document.getElementById('guru-pdf-progress-bar');
        const progressLbl = document.getElementById('guru-pdf-progress-label');

        if (isPdf && typeof pdfjsLib !== 'undefined') {
            if (progressEl) progressEl.style.display = 'block';
            if (progressBar) progressBar.style.width = '5%';
            if (progressLbl) progressLbl.textContent = 'Carregando ' + file.name + '...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += '
--- Página ' + i + ' ---
' + textContent.items.map(item => item.str).join(' ');
                    if (progressBar) progressBar.style.width = Math.round((i / totalPages) * 100) + '%';
                    if (progressLbl) progressLbl.textContent = 'Extraindo página ' + i + ' de ' + totalPages + '...';
                }

                if (progressEl) { progressEl.style.display = 'none'; if (progressBar) progressBar.style.width = '0%'; }

                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: fullText.trim(), pages: totalPages, source: 'pdf_extracted', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'PDF extraído: ' + file.name + ' (' + totalPages + ' páginas)', 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            } catch(err) {
                if (progressEl) progressEl.style.display = 'none';
                console.error('Erro PDF.js:', err);
                this.addAgentLog('Guru de Estratégias', 'Erro ao extrair PDF: ' + file.name, 'warn');
            }

        } else if (isText) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
                const existingIdx = files.findIndex(f => f.name === file.name);
                const fileData = { name: file.name, size: file.size, type: file.type, content: e.target.result, source: 'text', date: new Date().toISOString() };
                if (existingIdx !== -1) files[existingIdx] = fileData; else files.push(fileData);
                localStorage.setItem('guru_files', JSON.stringify(files));
                this.addAgentLog('Guru de Estratégias', 'Arquivo carregado: ' + file.name, 'success');
                this.renderGuruFiles();
                this.updateContextChecklist();
            };
            reader.readAsText(file);
        } else {
            const files = JSON.parse(localStorage.getItem('guru_files') || '[]');
            files.push({ name: file.name, size: file.size, type: file.type, content: '[Arquivo binário - adicione o conteúdo relevante no campo de Anotações Adicionais]', source: 'binary', date: new Date().toISOString() });
            localStorage.setItem('guru_files', JSON.stringify(files));
            this.addAgentLog('Guru de Estratégias', 'Arquivo registrado: ' + file.name, 'warn');
            this.renderGuruFiles();
            this.updateContextChecklist();
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
        const btnGen = document.getElementById("btn-generate-weekly-strategy");
        const container = document.getElementById("guru-strategy-result-container");
        const textEl = document.getElementById("guru-strategy-text");
        
        if (!btnGen || !container || !textEl) return;
        
        btnGen.disabled = true;
        btnGen.innerHTML = `<span>⏳</span> Analisando dados & Gerando Planejamento...`;
        
        try {
            const leads = Store.getLeads();
            const proposals = Store.getProposals();
            const files = JSON.parse(localStorage.getItem("guru_files") || "[]");
            const notes = document.getElementById("guru-notes-input")?.value || "";
            
            const fileContexts = files.map(f => `Arquivo: ${f.name}\nConteúdo:\n${f.content}`).join("\n\n");
            const leadsSummary = leads.map(l => `- Empresa: ${l.company}, Contato: ${l.contact}, Cargo: ${l.role || "Não informado"}, Cidade: ${l.city || "Não informada"}, Segmento: ${l.segment || "Outros"}, Estágio: ${l.stage}`).join("\n");
            
            const prompt = `
Você é o Guru de Estratégias Semanais do VelliaCRM, um especialista em captação ativa de leads e planejamento comercial.
Sua missão é sugerir estratégias de captação orgânica e ativa (outbound, social selling, indicações) baseadas nos dados fornecidos pela empresa, permitindo que os vendedores captem leads além do tráfego pago.

DADOS DA EMPRESA (BASE DE CONHECIMENTO CARREGADA):
${fileContexts}

ANOTAÇÕES DE COMPORTAMENTO ADICIONAIS:
${notes}

LEADS ATUAIS NO CRM:
${leadsSummary}

Crie um plano estratégico prático para a semana atual em formato Markdown legível e atraente. O plano DEVE conter as seguintes seções estruturadas:
1. **Foco Estratégico da Semana** (Qual o público ideal a atacar e por quê).
2. **Onde os Leads Estão & Como Chegar** (Canais como LinkedIn, Instagram, Grupos, eventos específicos baseados no comportamento).
3. **Script de Abordagem Sugerido** (Mensagem prática de exemplo para WhatsApp ou E-mail).
4. **Tarefas Práticas Sugeridas para a Equipe de Vendas** (Crie de 3 a 5 tarefas objetivas e detalhadas para atribuir aos vendedores).

ATENÇÃO: No final do texto, adicione uma linha especial no formato exato:
[TAREFA_VENDEDOR: <Instrução da tarefa a ser cadastrada no sistema>]
Exemplo:
[TAREFA_VENDEDOR: Prospectar 5 novas empresas do segmento de Saúde no LinkedIn e enviar script de abordagem]
[TAREFA_VENDEDOR: Fazer follow-up com os leads parados no estágio de Contato há mais de 3 dias]

Crie de 2 a 4 tags de [TAREFA_VENDEDOR: ...] no final para que o CRM possa extraí-las e delegá-las automaticamente para os vendedores ativos se o administrador aceitar.
Escreva de forma motivadora, comercial e direta.
`;
            
            const res = await fetch(`/api/gemini-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }]
                })
            });
            
            if (!res.ok) throw new Error("Erro na API do Gemini");
            
            const data = await res.json();
            const strategyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, tive um problema ao me conectar com a inteligência do Gemini.";
            
            textEl.innerHTML = strategyText
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\n- (.*?)/g, "<br>• $1")
                .replace(/\[TAREFA_VENDEDOR:[^\]]+\]/g, ""); // Clean raw tags from visual preview
                
            localStorage.setItem("guru_latest_suggested_strategy", strategyText);
            
            container.style.display = "block";
            this.addAgentLog("Guru de Estratégias", "Nova estratégia semanal gerada com sucesso.", "success");
            
        } catch (err) {
            console.error("Erro ao gerar estratégia semanal:", err);
            this.addAgentLog("Guru de Estratégias", "Erro ao gerar estratégia semanal no Gemini.", "warn");
            textEl.innerHTML = "<p style='color: var(--danger);'>Ocorreu um erro ao gerar a estratégia com a IA. Por favor, tente novamente ou verifique sua conexão.</p>";
            container.style.display = "block";
        } finally {
            btnGen.disabled = false;
            btnGen.innerHTML = `<span>✨</span> Gerar Estratégias da Semana`;
        }
    },

    acceptStrategy() {
        const latestStrategy = localStorage.getItem("guru_latest_suggested_strategy");
        if (!latestStrategy) return;
        
        // Save as active strategy
        localStorage.setItem("active_weekly_strategy", latestStrategy);
        
        // Extract seller tasks from tags
        const regex = /\[TAREFA_VENDEDOR:\s*(.*?)\]/g;
        const tasks = [];
        let match;
        while ((match = regex.exec(latestStrategy)) !== null) {
            if (match[1]) tasks.push(match[1].trim());
        }
        
        // Distribute tasks to all sellers
        const sellers = Store.getUsers().filter(u => u.role === "seller");
        const today = new Date().toLocaleDateString("pt-BR");
        
        let assignedCount = 0;
        sellers.forEach(seller => {
            const sellerTasks = Store.getTasks(seller.email);
            tasks.forEach(taskText => {
                sellerTasks.unshift({
                    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    text: taskText,
                    priority: "high",
                    done: false,
                    date: today,
                    assignedBy: "agent@vellia.ai"
                });
                assignedCount++;
            });
            Store.saveTasks(seller.email, sellerTasks);
        });
        
        this.addAgentLog("Guru de Estratégias", `Estratégia semanal aceita pelo Administrador. ${tasks.length} tarefas atribuídas para ${sellers.length} vendedores.`, "success");
        
        // Show success alert
        alert(`Planejamento ativado! ${tasks.length} tarefas foram atribuídas com prioridade Alta para cada vendedor.`);
        
        // Log action
        Store.addLog("admin@vellia.com", "GURU_STRATEGY_ACCEPTED", `Administrador aceitou o planejamento estratégico da semana. Atribuídas ${tasks.length} tarefas.`, "SUCCESS");
        
        // Hide strategic panel and strategy preview
        const container = document.getElementById("guru-strategy-result-container");
        if (container) container.style.display = "none";
        
        const guruPanel = document.getElementById("guru-strategic-panel");
        if (guruPanel) guruPanel.style.display = "none";
        
        // Dispatch event to refresh views/dashboard
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
    },

    rejectStrategy() {
        localStorage.removeItem("guru_latest_suggested_strategy");
        this.addAgentLog("Guru de Estratégias", "Sugestão de planejamento estratégico descartada pelo Administrador.", "warn");
        
        const container = document.getElementById("guru-strategy-result-container");
        if (container) container.style.display = "none";
        
        Store.addLog("admin@vellia.com", "GURU_STRATEGY_REJECTED", "Administrador descartou o planejamento estratégico sugerido pela IA.", "WARN");
        
        alert("Sugestão de planejamento estratégico descartada.");
    }

    renderStrategyHistory() {
        const history = JSON.parse(localStorage.getItem('guru_strategy_history') || '[]');
        const section = document.getElementById('guru-history-section');
        const list    = document.getElementById('guru-history-list');
        if (!section || !list) return;
        if (history.length === 0) { section.style.display = 'none'; return; }
        section.style.display = 'block';
        list.innerHTML = history.map((h, i) =>
            '<div style="padding:12px;background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-sm);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<span style="font-size:12px;font-weight:700;color:var(--text-primary)">📅 Semana de ' + h.date + '</span>' +
            '<span style="font-size:10px;color:var(--text-muted);background:rgba(139,92,246,0.1);padding:2px 8px;border-radius:99px;">Planejamento #' + (history.length - i) + '</span>' +
            '</div>' +
            (h.icp && h.icp.segment ? '<div style="font-size:11px;color:#8b5cf6;margin-bottom:4px;">🎯 ICP: ' + h.icp.segment + (h.icp.role ? ' — ' + h.icp.role : '') + '</div>' : '') +
            '<p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5;">' + h.summary + '</p>' +
            '</div>'
        ).join('');
    }

};
