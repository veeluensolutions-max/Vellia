import { Store } from "./store.js";
import { Auth } from "./auth.js";

/**
 * ChurnAutopilot — Módulo de Inteligência Preditiva de Churn e Reengajamento por IA
 */
export const ChurnAutopilot = {
    initialized: false,

    // Limites de dias ociosos permitidos por etapa antes de entrar em Alerta de Churn
    STAGE_THRESHOLDS: {
        "Sem Contato": 2,
        "Contato Realizado": 3,
        "Reunião Agendada": 3,
        "Proposta Enviada": 4,
        "Em Negociação": 5,
        "Cliente Fechado": 60 // Pós-Venda
    },

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.bindEvents();
        this.renderWidget();
        
        // Escutar atualizações de leads para recalcular automaticamente
        window.addEventListener("vellia:leadsUpdated", () => this.renderWidget());
        window.addEventListener("hashchange", () => {
            if (window.location.hash === "#crm" || window.location.hash === "#kanban") {
                setTimeout(() => this.renderWidget(), 100);
            }
        });
    },

    bindEvents() {
        // Evento global para varredura manual
        window.runChurnScan = () => this.runScanAndNotify();
    },

    /**
     * Varre todos os leads e calcula o risco de churn
     */
    analyzeLeads() {
        const leads = Store.getLeads();
        const now = new Date();

        const atRiskLeads = [];

        leads.forEach(lead => {
            if (lead.stage === "Cliente Perdido" || lead.inTrash) return;

            // Determinar a data da última interação ou última atualização do lead
            let lastDate = lead.updatedAt ? new Date(lead.updatedAt) : new Date(lead.createdAt || now);
            if (lead.interactions && lead.interactions.length > 0) {
                const latestInt = lead.interactions.reduce((max, i) => {
                    const d = new Date(i.date || i.timestamp || 0);
                    return d > max ? d : max;
                }, new Date(0));
                if (latestInt.getTime() > 0) lastDate = latestInt;
            }

            const diffTime = Math.abs(now - lastDate);
            const idleDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            const threshold = this.STAGE_THRESHOLDS[lead.stage] || 4;

            if (idleDays >= threshold) {
                // Cálculo da pontuação de risco de 0 a 100%
                const overflowDays = idleDays - threshold;
                let riskScore = Math.min(100, Math.round(50 + (overflowDays * 12)));
                
                let riskLevel = "Médio";
                let riskColor = "#f59e0b"; // amarelo
                let badgeBg = "rgba(245, 158, 11, 0.12)";

                if (riskScore >= 80) {
                    riskLevel = "Crítico";
                    riskColor = "#ef4444"; // vermelho
                    badgeBg = "rgba(239, 68, 68, 0.15)";
                } else if (riskScore >= 65) {
                    riskLevel = "Alto";
                    riskColor = "#f97316"; // laranja
                    badgeBg = "rgba(249, 115, 22, 0.15)";
                }

                atRiskLeads.push({
                    ...lead,
                    idleDays,
                    threshold,
                    riskScore,
                    riskLevel,
                    riskColor,
                    badgeBg
                });
            }
        });

        // Ordenar por maior risco e maior valor estimado
        return atRiskLeads.sort((a, b) => (b.riskScore * (b.estimatedValue || 1)) - (a.riskScore * (a.estimatedValue || 1)));
    },

    /**
     * Executa a varredura e dispara alertas para a central de notificações
     */
    runScanAndNotify() {
        const atRisk = this.analyzeLeads();
        if (atRisk.length === 0) {
            alert("✨ Nenhum lead em risco de churn detectado no momento! O funil está saudável.");
            return;
        }

        const criticalCount = atRisk.filter(l => l.riskScore >= 80).length;
        const totalValue = atRisk.reduce((acc, l) => acc + (parseFloat(l.estimatedValue) || 0), 0);
        const formattedVal = totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        // Disparar evento para a Central de Notificações
        window.dispatchEvent(new CustomEvent("vellia:aiNotification", {
            detail: {
                id: `churn_scan_${Date.now()}`,
                title: `🚨 Alerta de Churn: ${atRisk.length} Leads Estagnados`,
                message: `Identificado ${formattedVal} em risco de perda. ${criticalCount} em nível crítico.`,
                type: "danger"
            }
        }));

        this.renderWidget();
        alert(`🔍 Varredura de Churn concluída!\n\n• Leads em risco: ${atRisk.length}\n• Valor acumulado: ${formattedVal}\n• Críticos: ${criticalCount}\n\nConfira as sugestões de reengajamento geradas pela IA no painel do CRM.`);
    },

    /**
     * Renderiza o Widget do Piloto Automático na interface do CRM
     */
    renderWidget() {
        const container = document.getElementById("churn-autopilot-widget");
        if (!container) return;

        const atRisk = this.analyzeLeads();
        const totalValue = atRisk.reduce((acc, l) => acc + (parseFloat(l.estimatedValue) || 0), 0);
        const formattedVal = totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        container.innerHTML = `
            <div class="card" style="margin-bottom: 24px; padding: 20px; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 1); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); border-radius: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            🛡️
                        </div>
                        <div>
                            <h3 style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                                Piloto Automático — Radar Antichurn IA
                            </h3>
                            <span style="font-size: 12px; color: var(--text-muted);">Monitoramento preditivo de estagnação e perda de oportunidade</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="window.runChurnScan()" style="font-size: 12px; padding: 6px 14px; display: flex; align-items: center; gap: 6px;">
                            ⚡ Varredura IA em Tempo Real
                        </button>
                    </div>
                </div>

                <!-- Estatísticas do Radar -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div style="background: rgba(255, 255, 255, 0.5); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.8);">
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Valor em Risco</div>
                        <div style="font-size: 20px; font-weight: 800; color: #ef4444;">${formattedVal}</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.5); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.8);">
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Leads Esfriando</div>
                        <div style="font-size: 20px; font-weight: 800; color: #f97316;">${atRisk.length} Oportunidades</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.5); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.8);">
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Nível Crítico</div>
                        <div style="font-size: 20px; font-weight: 800; color: #dc2626;">${atRisk.filter(l => l.riskScore >= 80).length} Leads</div>
                    </div>
                </div>

                <!-- Lista dos Principais Leads em Risco -->
                ${atRisk.length === 0 ? `
                    <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
                        🟢 Nenhum lead em risco detectado. Todos os contatos estão em dia!
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${atRisk.slice(0, 4).map(l => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.6); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.9); flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 10px; min-width: 200px;">
                                    <span style="font-size: 12px; padding: 3px 8px; border-radius: 6px; background: ${l.badgeBg}; color: ${l.riskColor}; font-weight: 800;">
                                        Risco ${l.riskLevel} (${l.riskScore}%)
                                    </span>
                                    <div>
                                        <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${l.company || l.contact}</div>
                                        <div style="font-size: 11px; color: var(--text-muted);">${l.stage} • ${l.idleDays} dias sem interação</div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">
                                        ${(parseFloat(l.estimatedValue) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </span>
                                    <button type="button" class="btn btn-outline btn-sm" onclick="window.ChurnAutopilot.openReengagementModal('${l.id}')" style="font-size: 11.5px; padding: 4px 10px; border-color: var(--primary); color: var(--primary);">
                                        🤖 Abordagem IA
                                    </button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Gera mensagem de reengajamento personalizada via Gemini 2.5 Flash
     */
    async generateAIReengagement(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return "Lead não encontrado.";

        const prompt = `
Você é o Vellia Copiloto, especialista em Vendas B2B e Reengajamento Comerciais.
Crie uma mensagem curta, direta e altamente persuasiva para envio via WhatsApp para reengajar o cliente a seguir:

- Nome do Contato: "${lead.contact || 'Cliente'}"
- Empresa: "${lead.company}"
- Etapa no Funil: "${lead.stage}"
- Valor Estimado da Negociação: "R$ ${lead.estimatedValue || 0}"
- Segmento: "${lead.segment || 'Geral'}"
- Histórico de Observações: "${lead.notes || 'Interesse em soluções de gestão'}"

Instruções:
1. Escreva em tom profissional, amigável, focado em resolver problemas e agregar valor.
2. Evite ser agressivo ou parecer cobrança. Mostre interesse genuíno e proponha um próximo passo simples (ex: "Tem 5 minutos essa semana?").
3. Use emojis adequados. Retorne APENAS o texto pronto da mensagem para envio por WhatsApp.
`;

        const userApiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key");

        try {
            let res;
            if (userApiKey && userApiKey.trim()) {
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
                res = await fetch(directUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
            } else {
                res = await fetch("/api/gemini-proxy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }] })
                });
            }

            if (res.ok) {
                const data = await res.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || "Olá! Gostaria de saber como estão os planos da empresa. Teria disponibilidade para conversarmos brevemente hoje?";
            }
        } catch (e) {
            console.error("Erro ao gerar mensagem de churn:", e);
        }

        // Fallback Inteligente caso falhe a chamada da API
        return `Olá, ${lead.contact || 'tudo bem'}! Como estão as coisas por aí na ${lead.company}?\n\nReparei que não nos falamos nos últimos dias sobre a proposta do ${lead.segment || 'projeto'}. Gostaria de entender se surgiu alguma dúvida ou se podemos ajustar algo para facilitar a sua decisão.\n\nTem 5 minutos para alinharmos? Abraços!`;
    },

    /**
     * Abre o modal de reengajamento rápido do lead com a mensagem da IA
     */
    async openReengagementModal(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        let modal = document.getElementById("modal-churn-reengage");
        let overlay = document.getElementById("churn-reengage-overlay");

        if (!modal) {
            // Criar elementos dinamicamente no body se não existirem
            overlay = document.createElement("div");
            overlay.id = "churn-reengage-overlay";
            overlay.className = "modal-overlay";
            overlay.style.cssText = "z-index: 1200; display: none; backdrop-filter: blur(4px);";

            modal = document.createElement("div");
            modal.id = "modal-churn-reengage";
            modal.className = "modal";
            modal.style.cssText = "z-index: 1201; max-width: 550px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 1); box-shadow: 0 20px 50px rgba(0,0,0,0.15); border-radius: 16px;";

            document.body.appendChild(overlay);
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px; font-size: 16px;">
                    <span>🛡️</span> Reengajamento IA — ${lead.company}
                </h3>
                <button type="button" class="btn-icon-close" onclick="document.getElementById('churn-reengage-overlay').style.display='none'; document.getElementById('modal-churn-reengage').classList.remove('open');">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: 16px 0;">
                <div style="background: rgba(99, 102, 241, 0.08); padding: 12px; border-radius: 10px; font-size: 12px; margin-bottom: 14px;">
                    <strong>Contato:</strong> ${lead.contact || 'N/A'} • <strong>Telefone:</strong> ${lead.phone || 'Não cadastrado'}<br>
                    <strong>Etapa:</strong> ${lead.stage} • <strong>Valor:</strong> R$ ${lead.estimatedValue || 0}
                </div>

                <label style="font-size: 12px; font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 6px;">
                    ✨ Mensagem Sugerida pelo Gemini 2.5 Flash:
                </label>

                <div id="churn-ai-text-container" style="min-height: 120px; background: var(--bg-body); border: 1px solid var(--border-color); padding: 14px; border-radius: 10px; font-size: 13px; color: var(--text-primary); white-space: pre-wrap; line-height: 1.5; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: center; height: 100px; color: var(--text-muted); gap: 8px;">
                        <span>🤖 Gerando abordagem por IA em tempo real...</span>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" class="btn btn-outline" id="btn-copy-churn-msg">
                        📋 Copiar Mensagem
                    </button>
                    <button type="button" class="btn btn-primary" id="btn-send-churn-wa" style="background: #25d366; border-color: #25d366; color: #fff;">
                        💬 Enviar no WhatsApp
                    </button>
                </div>
            </div>
        `;

        overlay.style.display = "block";
        modal.classList.add("open");

        // Gerar texto IA
        const aiMessage = await this.generateAIReengagement(lead.id);
        const container = modal.querySelector("#churn-ai-text-container");
        if (container) container.textContent = aiMessage;

        // Binds de clique
        const btnCopy = modal.querySelector("#btn-copy-churn-msg");
        const btnWa = modal.querySelector("#btn-send-churn-wa");

        if (btnCopy) {
            btnCopy.onclick = () => {
                navigator.clipboard.writeText(container.textContent);
                alert("📋 Mensagem copiada com sucesso!");
            };
        }

        if (btnWa) {
            btnWa.onclick = () => {
                const cleanPhone = (lead.phone || "").replace(/\D/g, "");
                const encodedMsg = encodeURIComponent(container.textContent);
                const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
                window.open(waUrl, "_blank");

                // Registrar interação no lead
                Store.addLeadInteraction(lead.id, Auth.getCurrentUser()?.email || "sistema@vellia.com", {
                    type: "WhatsApp",
                    description: `Reengajamento disparado via Radar Antichurn IA.`
                });
            };
        }
    }
};

window.ChurnAutopilot = ChurnAutopilot;
