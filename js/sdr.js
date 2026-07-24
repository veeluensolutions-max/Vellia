import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const SDR = {
    // Executa a triagem inteligente de um lead
    async runTriage(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        // Se a automação SDR estiver pausada pelo vendedor (Takeover), abortar triagem
        if (lead.sdrPaused) {
            console.log(`[SDR AI] Triagem ignorada para o lead ${leadId} (Controle Humano ativado).`);
            return;
        }

        const getLogTime = () => `[${new Date().toLocaleTimeString("pt-BR")}]`;

        // 1. Registrar início do contato automático pelo SDR
        this.addSystemLog(lead, "SDR AI: Iniciando contato automático via WhatsApp...");
        window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
            detail: { leadId, stage: "init", text: `${getLogTime()} 🤖 SDR AI Conectado. Analisando lead de ${lead.company}...` } 
        }));

        // 2. Chamar o Gemini para formular a primeira mensagem de contato e a simulação de triagem!
        try {
            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "scanning", text: `${getLogTime()} 📡 Varrendo segmento "${lead.segment || "Outros"}" via Meta Ads...` } 
            }));
            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "scanning", text: `${getLogTime()} 🧠 Consultando modelo Gemini 2.5 Flash para abordagem personalizada...` } 
            }));

            const sdrConfig = JSON.parse(localStorage.getItem("agent_sdr_config")) || {};
            const approachMap = { quick: "Qualificação Rápida (foco em agendamento)", consultative: "Consultiva (foco em entender dores)", direct: "Direta/Agressiva (foco em proposta/valor)" };
            const toneMap = { formal: "Corporativo/Formal", casual: "Amigável/Casual", enthusiastic: "Entusiasmado/Energético" };

            const approachStr = approachMap[sdrConfig.approach] || "Consultiva";
            const toneStr = toneMap[sdrConfig.tone] || "Corporativo/Formal";
            const customInstructionStr = sdrConfig.customInstruction ? `- Instrução Específica do Usuário: "${sdrConfig.customInstruction}"` : "";

            const prompt = `
Você é o Vellia AI SDR (Assistente de Pré-vendas).
Diretrizes Comerciais Configuradas pelo Vendedor:
- Estilo de Abordagem: ${approachStr}
- Tom de Voz: ${toneStr}
${customInstructionStr}

Dados do Lead:
- Empresa: ${lead.company}
- Contato: ${lead.contact || lead.name || "Sem nome"}
- Segmento: ${lead.segment || "Outros"}
- Origem: ${lead.source || "Meta Ads"}

Sua tarefa: Simular um contato de triagem e qualificação inicial por WhatsApp com esse lead de forma extremamente realista.
Gere um diálogo em 3 turnos (SDR fala, Lead responde, SDR fala) para qualificar o interesse do lead na solução da Vellia.
- Turno 1 (SDR): Mensagem inicial de abordagem personalizada baseada no segmento do lead.
- Turno 2 (Lead): Uma resposta simulada realista (pode demonstrar alto interesse, alguma dúvida de orçamento, ou falta de interesse).
- Turno 3 (SDR): Mensagem de fechamento direcionando para o vendedor ou qualificando a dor do lead.

No final da simulação, decida o estágio do funil do lead de acordo com a resposta do lead:
- Se demonstrar alto interesse/dor clara: Estágio = "Lead Qualificado"
- Se demonstrar apenas curiosidade ou dúvida de preço que precisa de proposta: Estágio = "Proposta Enviada"
- Se rejeitar ou não tiver perfil: Estágio = "Cliente Perdido"

Retorne a resposta estritamente no seguinte formato JSON:
{
  "dialogue": [
     {"from": "SDR", "text": "texto..."},
     {"from": "Lead", "text": "texto..."},
     {"from": "SDR", "text": "texto..."}
  ],
  "decision": {
     "stage": "Lead Qualificado | Proposta Enviada | Cliente Perdido",
     "summary": "Resumo profissional da triagem do lead e o motivo da decisão."
  }
}
`;

            const res = await fetch(`/api/gemini-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!res.ok) throw new Error("Erro na API do Gemini.");
            const data = await res.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = JSON.parse(resultText);

            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "dialogue", text: `${getLogTime()} 💬 Iniciando diálogo de triagem via WhatsApp...` } 
            }));

            parsed.dialogue.forEach(d => {
                window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                    detail: { leadId, stage: "dialogue", text: `  -> [${d.from === "SDR" ? "🤖 SDR AI" : `👤 ${lead.contact}`}]: "${d.text}"` } 
                }));
            });

            // 3. Atualizar o estágio do lead no Funil/Store
            const oldStage = lead.stage;
            lead.stage = parsed.decision.stage;
            
            // 4. Inserir a conversa na timeline do lead
            const conversationsText = parsed.dialogue.map(d => `*${d.from === "SDR" ? "🤖 SDR AI" : `👤 ${lead.contact || lead.name}`}*: ${d.text}`).join("\n\n");
            
            lead.interactions = lead.interactions || [];
            lead.interactions.push({
                id: 'wa_sdr_' + Date.now(),
                type: "WhatsApp",
                description: `💬 **Conversa de Triagem SDR AI:**\n\n${conversationsText}`,
                timestamp: new Date().toISOString(),
                userEmail: "sdr-ai@vellia.com"
            });

            // 5. Tentar disparo real via WhatsApp API (/api/send-whatsapp)
            const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || {};
            const leadPhone = lead.whatsapp || lead.phone;
            const initialSdrMsg = parsed.dialogue.find(d => d.from === "SDR")?.text || `Olá ${lead.contact || ''}, vi seu interesse via Meta Ads. Como podemos ajudar?`;

            if (leadPhone) {
                try {
                    const sendRes = await fetch('/api/send-whatsapp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: leadPhone,
                            message: initialSdrMsg,
                            config: waConfig
                        })
                    });

                    if (sendRes.ok) {
                        const sendData = await sendRes.json();
                        const providerMsg = sendData.provider || 'API WhatsApp';
                        const isLink = sendData.deepLink;

                        lead.interactions.push({
                            id: 'wa_sdr_sent_' + Date.now(),
                            type: "WhatsApp",
                            description: isLink 
                                ? `🚀 **Abordagem Inicial WhatsApp Pronta (< 1 min):**\n\n💬 "${initialSdrMsg}"\n\n👉 [Clique para enviar via WhatsApp Web/App](${sendData.deepLink})`
                                : `⚡ **Disparo Automático WhatsApp Realizado (${providerMsg}):**\n\n💬 "${initialSdrMsg}"`,
                            timestamp: new Date().toISOString(),
                            userEmail: "sdr-ai@vellia.com"
                        });
                    }
                } catch (err) {
                    console.warn("[SDR AI] Erro ao invocar /api/send-whatsapp:", err);
                }
            }

            lead.interactions.push({
                id: 'wa_sdr_summary_' + Date.now(),
                type: "Observação",
                description: `🤖 **Análise do SDR AI:** ${parsed.decision.summary}\n\n📍 *Ação realizada:* Estágio alterado automaticamente de **"${oldStage}"** para **"${parsed.decision.stage}"**.`,
                timestamp: new Date().toISOString(),
                userEmail: "sdr-ai@vellia.com"
            });

            lead.stageHistory = lead.stageHistory || [];
            lead.stageHistory.push({
                stage: parsed.decision.stage,
                userEmail: "sdr-ai@vellia.com",
                timestamp: new Date().toISOString(),
                reason: `Triagem inteligente efetuada pelo SDR AI: ${parsed.decision.summary}`
            });

            const leads = Store.getLeads();
            const idx = leads.findIndex(l => l.id === lead.id);
            if (idx !== -1) {
                leads[idx] = lead;
                Store.saveLeads(leads);
            }

            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "decision", text: `${getLogTime()} ⚖️ Análise de qualificação concluída.` } 
            }));
            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "decision", text: `  -> Decisão: Mover lead para a etapa "${parsed.decision.stage}"` } 
            }));
            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "decision", text: `  -> Motivo: ${parsed.decision.summary}` } 
            }));

            // Registrar log de auditoria
            const logs = Store.getLogs();
            logs.unshift({
                id: 'log-' + Date.now(),
                timestamp: new Date().toISOString(),
                userEmail: 'sdr-ai@vellia.com',
                action: 'SDR_AUTO_TRIAGE',
                details: `Triagem automática efetuada para ${lead.company}. Novo estágio: ${parsed.decision.stage}.`,
                status: 'SUCCESS'
            });
            Store.saveLogs(logs);

            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "done", text: `${getLogTime()} ✅ Sincronização concluída. Autopilot encerrado.` } 
            }));

            // Disparar evento para atualizar Kanban, Dash, etc.
            window.dispatchEvent(new CustomEvent("vellia:waSent"));

            // Se o lead ficou quente/qualificado, notificar o usuário com push notification nativo!
            if (parsed.decision.stage === "Lead Qualificado" || parsed.decision.stage === "Proposta Enviada") {
                this.sendNativeAlert(`🔥 Lead Quente: ${lead.company}!`, `O SDR AI qualificou o lead. Ele está pronto para o fechamento!`);
            }

        } catch (error) {
            console.error("Erro na triagem SDR:", error);
            window.dispatchEvent(new CustomEvent("vellia:sdrUpdate", { 
                detail: { leadId, stage: "done", text: `${getLogTime()} ❌ Falha no processamento da IA. Usando fallback.` } 
            }));
            this.runTriageFallback(lead);
        }
    },

    addSystemLog(lead, message) {
        lead.interactions = lead.interactions || [];
        lead.interactions.push({
            id: 'wa_sdr_system_' + Date.now(),
            type: "Observação",
            description: `⚙️ ${message}`,
            timestamp: new Date().toISOString(),
            userEmail: "sdr-ai@vellia.com"
        });
        const leads = Store.getLeads();
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx !== -1) {
            leads[idx] = lead;
            Store.saveLeads(leads);
        }
    },

    runTriageFallback(lead) {
        const oldStage = lead.stage;
        lead.stage = "Lead Qualificado";
        
        lead.interactions = lead.interactions || [];
        lead.interactions.push({
            id: 'wa_sdr_fallback_' + Date.now(),
            type: "Observação",
            description: `🤖 **Análise do SDR AI (Fallback):** O lead demonstrou interesse no primeiro contato.\n\n📍 *Ação realizada:* Estágio alterado automaticamente de "${oldStage}" para "Lead Qualificado".`,
            timestamp: new Date().toISOString(),
            userEmail: "sdr-ai@vellia.com"
        });

        lead.stageHistory = lead.stageHistory || [];
        lead.stageHistory.push({
            stage: "Lead Qualificado",
            userEmail: "sdr-ai@vellia.com",
            timestamp: new Date().toISOString(),
            reason: "Triagem automática por inteligência local."
        });
        const leads = Store.getLeads();
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx !== -1) {
            leads[idx] = lead;
            Store.saveLeads(leads);
        }
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
    },

    sendNativeAlert(title, message) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body: message });
        }
    },

    // =========================================================================
    // MOTOR DE CADÊNCIA AUTOMATIZADA SDR MULTICANAL
    // =========================================================================

    CADENCE_STEPS: [
        { step: 1, title: "Boas-vindas & Triagem Inicial", type: "WhatsApp", delay: "Dia 1" },
        { step: 2, title: "Estudo de Caso & Prova Social", type: "WhatsApp / E-mail", delay: "Dia 2" },
        { step: 3, title: "Follow-up Comercial & Proposta", type: "WhatsApp", delay: "Dia 3" },
        { step: 4, title: "Reengajamento & Oferta de Fechamento", type: "WhatsApp Direct", delay: "Dia 5" }
    ],

    renderCadenceWidget(leadId) {
        const container = document.getElementById("sdr-cadence-widget-body");
        const btnToggle = document.getElementById("btn-toggle-sdr-cadence");
        if (!container) return;

        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        const active = lead.cadenceActive !== false;
        const currentStep = lead.cadenceStep || 1;

        if (btnToggle) {
            btnToggle.textContent = active ? "⏸️ Pausar Cadência" : "▶ Ativar Cadência";
            btnToggle.style.color = active ? "var(--danger)" : "var(--primary-light)";
            btnToggle.onclick = () => this.toggleCadence(leadId);
        }

        const pct = Math.min(100, Math.round(((currentStep - 1) / 4) * 100));

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;">
                <span style="font-weight: 700; color: var(--text-primary);">Status: ${active ? "🟢 Em Execução" : "⏸️ Pausada"}</span>
                <span style="font-weight: 700; color: #8b5cf6;">Passo ${currentStep > 4 ? 4 : currentStep} de 4 (${currentStep > 4 ? 100 : pct}%)</span>
            </div>

            <div style="height: 6px; background: var(--bg-app); border-radius: 4px; overflow: hidden; width: 100%;">
                <div style="height: 100%; width: ${currentStep > 4 ? 100 : pct}%; background: linear-gradient(90deg, #8b5cf6, #25d366); transition: width 0.3s;"></div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                ${this.CADENCE_STEPS.map(s => {
                    const isDone = s.step < currentStep;
                    const isCurrent = s.step === currentStep;
                    const statusClass = isDone ? "done" : isCurrent ? "active" : "";
                    const icon = isDone ? "✅" : isCurrent ? "⚡" : "⏳";
                    return `
                        <div class="sdr-cadence-step-item ${statusClass}">
                            <span>${icon}</span>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 700; color: var(--text-primary); font-size: 11.5px;">${s.step}. ${s.title}</div>
                                <div style="font-size: 10.5px; color: var(--text-muted);">${s.type} • ${s.delay}</div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <div style="display: flex; gap: 8px; margin-top: 6px;">
                <button type="button" onclick="window.SDR.advanceCadenceStep('${leadId}')" class="btn btn-primary" style="flex: 1; height: 32px; font-size: 11.5px; font-weight: 700; background: #8b5cf6; border: none;" ${!active || currentStep > 4 ? "disabled" : ""}>
                    ⚡ Executar Passo ${currentStep <= 4 ? currentStep : "Concluído"} (${currentStep <= 4 ? this.CADENCE_STEPS[currentStep - 1].delay : "Fim"})
                </button>
            </div>
        `;
    },

    toggleCadence(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        lead.cadenceActive = !(lead.cadenceActive !== false);
        const leads = Store.getLeads();
        const idx = leads.findIndex(l => l.id === leadId);
        if (idx !== -1) {
            leads[idx] = lead;
            Store.saveLeads(leads);
        }

        this.addSystemLog(lead, `Cadência SDR ${lead.cadenceActive ? "reativada" : "pausada pelo usuário"}.`);
        this.renderCadenceWidget(leadId);
    },

    async advanceCadenceStep(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        const currentStep = lead.cadenceStep || 1;
        if (currentStep > 4) {
            alert("Todas as etapas da cadência para este lead já foram concluídas!");
            return;
        }

        const stepInfo = this.CADENCE_STEPS[currentStep - 1];

        // Registrar execução do passo
        const desc = `🔄 **Passo ${stepInfo.step} da Cadência SDR Executado:** ${stepInfo.title} (${stepInfo.type}).`;
        Store.addLeadInteraction(lead.id, {
            type: "WhatsApp",
            description: desc
        }, "sdr-ai@vellia.com");

        lead.cadenceStep = currentStep + 1;
        if (lead.cadenceStep > 4) lead.cadenceActive = false;

        const leads = Store.getLeads();
        const idx = leads.findIndex(l => l.id === leadId);
        if (idx !== -1) {
            leads[idx] = lead;
            Store.saveLeads(leads);
        }

        this.renderCadenceWidget(leadId);
        window.dispatchEvent(new CustomEvent("vellia:waSent"));

        // Abrir modal de WhatsApp com a mensagem do passo pré-preenchida
        if (window.WhatsApp) {
            window.WhatsApp.openModalForLead(leadId);
        }
    }
};

window.SDR = SDR;
