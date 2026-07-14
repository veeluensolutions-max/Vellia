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
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    init() {
        this.renderLogs();
        this.bindEvents();
        this.startRealtimeEngines();

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
                this.addAgentLog("SDR Agent", active
                    ? "âœ… Ativado â€” QualificaÃ§Ã£o automÃ¡tica de leads iniciada."
                    : "â¸ï¸ Desativado â€” QualificaÃ§Ã£o em pausa.", active ? "success" : "warn");
                if (active) this.runSDRCycle(true);
            };
        }

        if (analystToggle) {
            analystToggle.checked = this.isAgentActive("analyst");
            analystToggle.onchange = () => {
                const active = analystToggle.checked;
                localStorage.setItem("agent_analyst_active", active);
                this.addAgentLog("Analyst Agent", active
                    ? "âœ… Ativado â€” Auditoria do pipeline em tempo real iniciada."
                    : "â¸ï¸ Desativado â€” ProjeÃ§Ãµes em repouso.", active ? "success" : "warn");
                if (active) this.runAnalystCycle();
            };
        }

        // BotÃ£o executar agora
        const btnRunNow = document.getElementById("btn-run-agents-now");
        if (btnRunNow) {
            btnRunNow.onclick = () => {
                this.addAgentLog("SDR Agent", "â–¶ ExecuÃ§Ã£o manual acionada.", "info");
                this.runSDRCycle(true);
                this.runAnalystCycle();
            };
        }

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
                    this.addAgentLog("Analyst Agent", `âš™ï¸ ConfiguraÃ§Ã£o salva: FrequÃªncia '${freqMap[config.frequency]}'. Nova auditoria em andamento.`, "success");
                    if (this.isAgentActive("analyst")) this.runAnalystCycle();
                }

                closeModal();
            };
        }
    }
};
