/**
 * Vellia AI — Lead Score & Next Best Action Engine
 * Integracao Gemini 2.0 + Engine Heuristico Fallback de Alta Precisao
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const LeadAIScore = {
    getApiKey() {
        return localStorage.getItem("vellia_gemini_api_key") || 
               localStorage.getItem("gemini_api_key") || 
               "";
    },

    setApiKey(key) {
        if (key) {
            localStorage.setItem("vellia_gemini_api_key", key.trim());
        } else {
            localStorage.removeItem("vellia_gemini_api_key");
        }
    },

    calculateRuleBasedScore(lead) {
        let score = 30;
        const reasons = [];
        let nextAction = "";

        const stageScores = {
            "Cliente Fechado": 100,
            "Negociação": 82,
            "Proposta Enviada": 68,
            "Lead Qualificado": 52,
            "Lead Gerado": 35,
            "Contato": 20,
            "Cliente Perdido": 5
        };

        if (stageScores[lead.stage] !== undefined) {
            score = stageScores[lead.stage];
            reasons.push(`Estagio do lead: "${lead.stage}"`);
        }

        const interactions = lead.interactions || [];
        const now = Date.now();
        const ONE_DAY = 1000 * 60 * 60 * 24;

        if (interactions.length > 0) {
            score += Math.min(interactions.length * 3, 15);

            const lastInter = interactions[interactions.length - 1];
            const lastDate = new Date(lastInter.timestamp || lastInter.date || Date.now());
            const daysDiff = (now - lastDate.getTime()) / ONE_DAY;

            if (daysDiff <= 3) {
                score += 10;
                reasons.push("Engajamento recente nos ultimos 3 dias");
            } else if (daysDiff > 14 && lead.stage !== "Cliente Fechado" && lead.stage !== "Cliente Perdido") {
                score -= 15;
                reasons.push("Lead sem contato ha mais de 14 dias");
            }
        }

        const proposals = Store.getProposals ? Store.getProposals().filter(p => p.leadId === lead.id || (p.company && p.company.toLowerCase() === (lead.company || "").toLowerCase())) : [];
        if (proposals.length > 0) {
            const openProp = proposals.find(p => p.status === "Enviada" || p.status === "Em Negociação");
            const wonProp = proposals.find(p => p.status === "Ganho");
            if (wonProp) score = Math.max(score, 95);
            else if (openProp) {
                score += 10;
                reasons.push(`Possui proposta ativa de R$ ${Number(openProp.value || 0).toLocaleString('pt-BR')}`);
            }
        }

        if (lead.stage === "Cliente Fechado") score = 100;
        else if (lead.stage === "Cliente Perdido") score = 5;
        else score = Math.max(10, Math.min(95, score));

        let label = "";
        if (score >= 70) {
            label = "Alta Probabilidade";
            nextAction = `Agendar reuniao de fechamento ou enviar minuta de contrato. Lead aquecido com alto interesse.`;
        } else if (score >= 40) {
            label = "Media Probabilidade";
            if (lead.stage === "Proposta Enviada") {
                nextAction = `Fazer follow-up focado em tirar duvidas da proposta comercial e reforcar diferenciais tecnicos.`;
            } else {
                nextAction = `Aprofundar a qualificacao tecnica e enviar caso de sucesso para acelerar a tomada de decisao.`;
            }
        } else {
            label = "Baixa Probabilidade / Risco";
            nextAction = `Retomar contato via mensagem direta oferecendo um diagnostico inicial gratuito para reativar o interesse.`;
        }

        const summary = `Lead em ${lead.stage} com ${interactions.length} interacao(oes) registradas. ${reasons.join(". ")}.`;

        return {
            score,
            label,
            nextAction,
            summary,
            source: "Heuristica Vellia Engine"
        };
    },

    async analyzeWithGemini(lead) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return this.calculateRuleBasedScore(lead);
        }

        const proposals = Store.getProposals ? Store.getProposals().filter(p => p.leadId === lead.id || p.company === lead.company) : [];
        const interactionsSummary = (lead.interactions || []).slice(-10).map(i => `- [${i.timestamp?.split("T")[0] || "Data N/A"}] (${i.type}): ${i.description || i.notes || ""}`).join("\n");

        const prompt = `Voce e um especialista em vendas B2B e IA SDR para o Vellia CRM. Analise o lead abaixo e gere uma pontuacao de probabilidade de fechamento (0 a 100%), o rotulo de status, o resumo executivo e a proxima melhor acao comercial.

DADOS DO LEAD:
- Empresa: ${lead.company}
- Contato: ${lead.contact} (${lead.role || "Cargo nao informado"})
- Estagio Atual: ${lead.stage}
- Segmento: ${lead.segment || "Geral"} | Origem: ${lead.source || "Geral"}
- Propostas: ${proposals.map(p => `R$ ${p.value} (${p.status})`).join(", ") || "Nenhuma proposta"}
- Historico de Interacoes Recentes:
${interactionsSummary || "Nenhuma interacao recente"}

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "score": 85,
  "label": "Alta Probabilidade",
  "summary": "Resumo analitico curto em 2 linhas",
  "nextAction": "Proxima acao recomendada altamente pratica para o vendedor"
}`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);

            const data = await res.json();
            const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const jsonMatch = textResp.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    score: Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
                    label: parsed.label || "Analisado por IA",
                    summary: parsed.summary || "Analise concluida com sucesso.",
                    nextAction: parsed.nextAction || "Fazer follow-up com o cliente.",
                    source: "Gemini 2.0 AI"
                };
            }
        } catch (err) {
            console.warn("[AIScore] Falha na API Gemini, usando engine fallback:", err.message);
        }

        return this.calculateRuleBasedScore(lead);
    },

    async getLeadScore(lead, forceRefresh = false) {
        if (!lead || !lead.id) return this.calculateRuleBasedScore(lead || {});

        const cacheKey = `vellia_ai_score_${lead.id}`;
        if (!forceRefresh) {
            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey));
                if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
                    return cached.data;
                }
            } catch (e) {}
        }

        const scoreData = await this.analyzeWithGemini(lead);
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: scoreData
            }));

            if (lead.aiScore !== scoreData.score) {
                lead.aiScore = scoreData.score;
                Store.updateLead(lead.id, { aiScore: scoreData.score }, "sistema@vellia.com");
                window.dispatchEvent(new CustomEvent("vellia:agentScoreUpdated", { detail: { leadId: lead.id, score: scoreData.score } }));
            }
        } catch (e) {}

        return scoreData;
    },

    async render(lead) {
        const container = document.getElementById("ai-score-widget");
        if (!container) return;

        container.innerHTML = `
            <div style="background: rgba(24, 119, 242, 0.05); border: 1px solid rgba(24, 119, 242, 0.2); border-radius: 12px; padding: 14px 16px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:16px;">🤖</span>
                        <span style="font-size:13px; font-weight:700; color:var(--text-primary);">Vellia AI Lead Intelligence</span>
                    </div>
                    <span style="font-size:11px; color:var(--text-muted);">Analisando dados...</span>
                </div>
                <div style="width:100%; height:6px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                    <div style="width:40%; height:100%; background:linear-gradient(90deg, #1877F2, #8b5cf6); border-radius:99px; animation: pulse 1.5s infinite;"></div>
                </div>
            </div>
        `;

        const res = await this.getLeadScore(lead);

        let badgeBg = "rgba(16, 185, 129, 0.15)";
        let badgeColor = "#10b981";
        let badgeBorder = "rgba(16, 185, 129, 0.3)";
        let gradStart = "#10b981";
        let gradEnd = "#059669";
        let emoji = "🟢";

        if (res.score < 40) {
            badgeBg = "rgba(239, 68, 68, 0.15)";
            badgeColor = "#ef4444";
            badgeBorder = "rgba(239, 68, 68, 0.3)";
            gradStart = "#ef4444";
            gradEnd = "#dc2626";
            emoji = "🔴";
        } else if (res.score < 70) {
            badgeBg = "rgba(245, 158, 11, 0.15)";
            badgeColor = "#f59e0b";
            badgeBorder = "rgba(245, 158, 11, 0.3)";
            gradStart = "#f59e0b";
            gradEnd = "#d97706";
            emoji = "🟡";
        }

        const apiKey = this.getApiKey();
        const sourceBadge = apiKey ? `⚡ Gemini 2.0 AI` : `🧠 Smart Rules Engine`;

        container.innerHTML = `
            <div style="background: var(--bg-card, #1e293b); border: 1px solid var(--border-color, #334155); border-radius: 12px; padding: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:18px;">🤖</span>
                        <div>
                            <div style="font-weight:700; font-size:13.5px; color:var(--text-primary);">Probabilidade de Fechamento</div>
                            <div style="font-size:10.5px; color:var(--text-muted);">${sourceBadge}</div>
                        </div>
                    </div>
                    <span style="background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder}; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                        ${emoji} ${res.score}% · ${res.label}
                    </span>
                </div>

                <div style="margin-bottom:14px;">
                    <div style="width:100%; height:8px; background:var(--bg-app, #0f172a); border-radius:99px; overflow:hidden; border:1px solid var(--border-color);">
                        <div style="width:${res.score}%; height:100%; background:linear-gradient(90deg, ${gradStart}, ${gradEnd}); border-radius:99px; transition: width 0.8s ease;"></div>
                    </div>
                </div>

                <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px; background:rgba(255,255,255,0.02); padding:10px 12px; border-radius:8px; border-left:3px solid ${badgeColor};">
                    ${res.summary}
                </div>

                <div style="background:rgba(24, 119, 242, 0.06); border:1px dashed rgba(24, 119, 242, 0.3); border-radius:8px; padding:10px 12px; margin-bottom:12px;">
                    <div style="font-size:11px; font-weight:700; color:#1877F2; text-transform:uppercase; margin-bottom:3px; display:flex; align-items:center; gap:4px;">
                        📌 Próxima Ação Sugerida
                    </div>
                    <div style="font-size:12px; color:var(--text-primary); font-weight:500; line-height:1.4;">
                        ${res.nextAction}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button id="btn-reanalyze-ai-score" class="btn btn-sm" style="font-size:11px; padding:5px 12px; border-radius:6px; background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                        🔄 Reanalisar com IA
                    </button>
                    <button id="btn-config-gemini-key" class="btn btn-sm" style="font-size:11px; padding:5px 10px; border-radius:6px; background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                        ${apiKey ? "⚙️ Chave IA Configurada" : "🔑 Configurar Chave Gemini"}
                    </button>
                </div>
            </div>
        `;

        const btnReanalyze = document.getElementById("btn-reanalyze-ai-score");
        if (btnReanalyze) {
            btnReanalyze.addEventListener("click", async () => {
                btnReanalyze.disabled = true;
                btnReanalyze.textContent = "⏳ Analisando...";
                await this.getLeadScore(lead, true);
                this.render(lead);
            });
        }

        const btnKey = document.getElementById("btn-config-gemini-key");
        if (btnKey) {
            btnKey.addEventListener("click", () => {
                const current = this.getApiKey();
                const input = prompt("Insira sua chave de API do Gemini (Google AI Studio):\n(Deixe em branco para usar a engine heurística)", current);
                if (input !== null) {
                    this.setApiKey(input);
                    alert(input.trim() ? "✅ Chave Gemini configurada com sucesso!" : "ℹ️ Usando Engine Heuristico Vellia.");
                    this.render(lead);
                }
            });
        }
    }
};
