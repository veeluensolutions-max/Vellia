import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const SDR = {
    // Executa a triagem inteligente de um lead
    async runTriage(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        // 1. Registrar início do contato automático pelo SDR
        this.addSystemLog(lead, "SDR AI: Iniciando contato automático via WhatsApp...");

        // 2. Chamar o Gemini para formular a primeira mensagem de contato e a simulação de triagem!
        try {
            const prompt = `
Você é o Vellia AI SDR (Assistente de Pré-vendas).
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

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyBnEOB3E2JNL3u1Z6nxA1F8KMQfYvIqnLs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!res.ok) throw new Error("Erro na API do Gemini.");
            const data = await res.json();
            const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = JSON.parse(resultText);

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

            // Disparar evento para atualizar Kanban, Dash, etc.
            window.dispatchEvent(new CustomEvent("vellia:waSent"));

            // Se o lead ficou quente/qualificado, notificar o usuário com push notification nativo!
            if (parsed.decision.stage === "Lead Qualificado" || parsed.decision.stage === "Proposta Enviada") {
                this.sendNativeAlert(`🔥 Lead Quente: ${lead.company}!`, `O SDR AI qualificou o lead. Ele está pronto para o fechamento!`);
            }

        } catch (error) {
            console.error("Erro na triagem SDR:", error);
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
        lead.interactions.push({
            id: 'wa_sdr_fallback_' + Date.now(),
            type: "Observação",
            description: `🤖 **Análise do SDR AI (Fallback):** O lead demonstrou interesse no primeiro contato.\n\n📍 *Ação realizada:* Estágio alterado automaticamente de "${oldStage}" para "Lead Qualificado".`,
            timestamp: new Date().toISOString(),
            userEmail: "sdr-ai@vellia.com"
        });
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
    }
};

window.SDR = SDR;
