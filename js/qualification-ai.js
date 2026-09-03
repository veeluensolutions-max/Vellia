/**
 * Vellia CRM — Qualificação Automática BANT / SPIN Selling & Hub de Objeções IA
 * Suporta Gemini 2.5 Flash + Engine Heurístico Local Especializado em Vendas B2B
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { CNPJService } from "./cnpj-service.js";
import { Toast } from "./toast.js";

export const QualificationAI = {
    getApiKey() {
        return localStorage.getItem("vellia_gemini_api_key") || 
               localStorage.getItem("gemini_api_key") || 
               "";
    },

    /**
     * Calcula a qualificação BANT do lead usando regras heurísticas avançadas de vendas B2B
     */
    calculateLocalBANT(lead) {
        if (!lead) return null;

        // 1. BUDGET (Orçamento)
        let budgetScore = 40;
        let budgetDesc = "Orçamento em validação.";
        let budgetBadge = "Em Definição";
        let budgetColor = "#f59e0b";

        const estimatedVal = parseFloat(lead.estimatedValue) || 0;
        const proposals = Store.getProposals ? Store.getProposals().filter(p => p.leadId === lead.id || (p.company && p.company.toLowerCase() === (lead.company || "").toLowerCase())) : [];
        const hasProposal = proposals.length > 0;
        const maxProposalVal = proposals.reduce((max, p) => Math.max(max, parseFloat(p.value) || 0), 0);

        if (maxProposalVal >= 20000 || estimatedVal >= 20000) {
            budgetScore = 95;
            budgetDesc = `Capacidade alta: Proposta/Valor estimado de R$ ${(maxProposalVal || estimatedVal).toLocaleString('pt-BR')}.`;
            budgetBadge = "Orçamento Alto";
            budgetColor = "#10b981";
        } else if (maxProposalVal >= 5000 || estimatedVal >= 5000) {
            budgetScore = 75;
            budgetDesc = `Orçamento alinhado: R$ ${(maxProposalVal || estimatedVal).toLocaleString('pt-BR')}.`;
            budgetBadge = "Orçamento Médio";
            budgetColor = "#10b981";
        } else if (lead.cnpj) {
            budgetScore = 60;
            budgetDesc = "Empresa com CNPJ ativo e cadastro validado na Receita.";
            budgetBadge = "CNPJ Validado";
            budgetColor = "#6366f1";
        } else {
            budgetScore = 35;
            budgetDesc = "Orçamento ainda não declarado ou perfil inicial.";
            budgetBadge = "Não Mapeado";
            budgetColor = "#ef4444";
        }

        // 2. AUTHORITY (Autoridade do Decisor)
        let authorityScore = 30;
        let authorityDesc = "Cargo não informado.";
        let authorityBadge = "Contato Operacional";
        let authorityColor = "#64748b";

        const roleLower = (lead.role || "").toLowerCase();
        const contactLower = (lead.contact || "").toLowerCase();

        const cLevelKeywords = ["diretor", "diretora", "ceo", "sócio", "socio", "proprietário", "proprietario", "dono", "dona", "presidente", "vice-presidente", "vp", "gerente geral", "founder", "co-founder"];
        const managerKeywords = ["gerente", "coordenador", "coordenadora", "supervisor", "supervisora", "head", "gestor", "gestora", "responsável", "engenheiro chefe"];

        if (cLevelKeywords.some(kw => roleLower.includes(kw) || contactLower.includes(kw))) {
            authorityScore = 95;
            authorityDesc = `Contato é decisor final direto (${lead.role || "C-Level/Sócio"}).`;
            authorityBadge = "Decisor Final (C-Level)";
            authorityColor = "#10b981";
        } else if (managerKeywords.some(kw => roleLower.includes(kw) || contactLower.includes(kw))) {
            authorityScore = 70;
            authorityDesc = `Contato tem forte influência na compra (${lead.role || "Gerência/Coordenação"}).`;
            authorityBadge = "Influenciador Chave";
            authorityColor = "#6366f1";
        } else if (lead.contact && lead.contact !== "Sem contato") {
            authorityScore = 50;
            authorityDesc = `Contato inicial cadastrado: ${lead.contact} (${lead.role || "Intermediário"}).`;
            authorityBadge = "Intermediário";
            authorityColor = "#f59e0b";
        } else {
            authorityScore = 25;
            authorityDesc = "Sem decisor mapeado no cadastro.";
            authorityBadge = "Não Mapeado";
            authorityColor = "#ef4444";
        }

        // 3. NEED (Necessidade / Dores)
        let needScore = 50;
        let needDesc = "Necessidade padrão de mercado.";
        let needBadge = "Média Aderência";
        let needColor = "#f59e0b";

        const notesLower = (lead.notes || "").toLowerCase();
        const segmentLower = (lead.segment || "").toLowerCase();
        const urgentKeywords = ["urgente", "laudo", "multa", "fiscalização", "interdição", "parada", "quebra", "inspeção", "manutenção corretiva", "vencendo", "emergencial"];
        const complianceKeywords = ["conformidade", "nr", "adequação", "engenharia", "laudo técnico", "preventiva", "contrato", "melhoria"];

        if (urgentKeywords.some(kw => notesLower.includes(kw))) {
            needScore = 95;
            needDesc = "Dor crítica identificada: Demanda urgente/corretiva nas observações.";
            needBadge = "Dor Crítica / Urgente";
            needColor = "#ef4444";
        } else if (complianceKeywords.some(kw => notesLower.includes(kw) || segmentLower.includes(kw))) {
            needScore = 80;
            needDesc = `Forte aderência ao setor de ${lead.segment || 'serviços técnicos'} e conformidade.`;
            needBadge = "Alta Aderência";
            needColor = "#10b981";
        } else if (lead.notes && lead.notes.length > 20) {
            needScore = 65;
            needDesc = "Contexto operacional descrito com detalhes no histórico.";
            needBadge = "Demanda Identificada";
            needColor = "#6366f1";
        } else {
            needScore = 40;
            needDesc = "Necessidade técnica ainda em fase de diagnóstico exploratório.";
            needBadge = "Exploratório";
            needColor = "#f59e0b";
        }

        // 4. TIMING (Tempo de Fechamento / Urgência)
        let timingScore = 50;
        let timingDesc = "Tempo padrão do ciclo comercial.";
        let timingBadge = "Médio Prazo (15-30d)";
        let timingColor = "#f59e0b";

        if (lead.stage === "Negociação" || lead.stage === "Proposta Enviada") {
            timingScore = 90;
            timingDesc = `Fase avançada (${lead.stage}). Janela ideal de fechamento em até 7 dias.`;
            timingBadge = "Imediato (< 7 dias)";
            timingColor = "#10b981";
        } else if (lead.stage === "Lead Qualificado") {
            timingScore = 70;
            timingDesc = "Lead qualificado. Pronto para envio de proposta comercial.";
            timingBadge = "Curto Prazo (7-15d)";
            timingColor = "#6366f1";
        } else if (lead.stage === "Cliente Fechado") {
            timingScore = 100;
            timingDesc = "Negócio fechado e ativo.";
            timingBadge = "Fechado";
            timingColor = "#10b981";
        } else if (lead.stage === "Cliente Perdido") {
            timingScore = 10;
            timingDesc = "Oportunidade encerrada temporariamente.";
            timingBadge = "Perdido";
            timingColor = "#64748b";
        } else {
            timingScore = 45;
            timingDesc = "Etapa inicial. Necessita de cadência ativa de qualificação.";
            timingBadge = "Em Aberto";
            timingColor = "#f59e0b";
        }

        // Score Global BANT Ponderado (B: 25%, A: 30%, N: 25%, T: 20%)
        const globalBANT = Math.round((budgetScore * 0.25) + (authorityScore * 0.30) + (needScore * 0.25) + (timingScore * 0.20));

        // Diagnóstico SPIN Selling
        const spin = {
            situacao: `Empresa ${lead.company} atuando no segmento de ${lead.segment || 'Serviços/Indústria'}. Contato principal: ${lead.contact || 'Decisor'} (${lead.role || 'Cargo a validar'}). Localização: ${lead.city || 'Regional'}/${lead.state || 'BR'}.`,
            perguntaSituacao: `"Como está estruturada a sua rotina atual de inspeções e manutenção na ${lead.company}?"`,
            
            problema: needScore >= 70 ? "Riscos de paradas não programadas, custos ocultos de manutenção e necessidade de laudos técnicos atualizados." : "Falta de previsibilidade nos custos operacionais e dependência de ações corretivas.",
            perguntaProblema: `"Qual tem sido o maior desafio operacional da sua equipe hoje em relação a prazos e conformidade técnica?"`,
            
            implicacao: "Paradas de máquinas ou inconformidades técnicas podem acarretar multas de órgãos reguladores, perda de produtividade diária e custos emergenciais 3x mais caros.",
            perguntaImplicacao: `"Caso ocorra uma interrupção inesperada no próximo mês, qual seria o impacto financeiro e de entrega para os seus clientes?"`,
            
            necessidadeSolucao: "Implementar um plano preventivo com laudos certificados, atendimento prioritário e garantia técnica da Vellia, reduzindo custos em até 30%.",
            perguntaFechamento: `"Se conseguirmos garantir conformidade técnica total e resposta prioritária com um cronograma pré-definido, podemos formalizar a proposta esta semana?"`
        };

        return {
            globalScore: globalBANT,
            budget: { score: budgetScore, desc: budgetDesc, badge: budgetBadge, color: budgetColor },
            authority: { score: authorityScore, desc: authorityDesc, badge: authorityBadge, color: authorityColor },
            need: { score: needScore, desc: needDesc, badge: needBadge, color: needColor },
            timing: { score: timingScore, desc: timingDesc, badge: timingBadge, color: timingColor },
            spin,
            source: "Vellia AI Heuristics"
        };
    },

    /**
     * Executa análise BANT e SPIN completa via API Gemini ou Fallback
     */
    async analyzeLead(lead, forceRefresh = false) {
        if (!lead || !lead.id) return null;

        const cacheKey = `vellia_bant_spin_${lead.id}`;
        if (!forceRefresh) {
            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey));
                if (cached && (Date.now() - cached.timestamp < 12 * 60 * 60 * 1000)) {
                    return cached.data;
                }
            } catch (e) {}
        }

        const localData = this.calculateLocalBANT(lead);
        const apiKey = this.getApiKey();

        if (apiKey) {
            try {
                const proposals = Store.getProposals ? Store.getProposals().filter(p => p.leadId === lead.id || p.company === lead.company) : [];
                const prompt = `Você é um diretor de vendas B2B e especialista nas metodologias BANT (Budget, Authority, Need, Timing) e SPIN Selling.
Analise os dados do Lead e gere a qualificação precisa.

DADOS:
- Empresa: ${lead.company}
- Contato: ${lead.contact} (${lead.role || "Cargo não informado"})
- CNPJ: ${lead.cnpj || "Não informado"}
- Segmento: ${lead.segment || "Geral"} | Estágio: ${lead.stage}
- Valor Estimado: R$ ${lead.estimatedValue || 0}
- Propostas: ${proposals.map(p => `R$ ${p.value} (${p.status})`).join(", ") || "Nenhuma"}
- Observações/Histórico: ${lead.notes || "Sem observações"}

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "globalScore": 85,
  "budget": { "score": 80, "desc": "Orçamento compatível com porte da empresa", "badge": "Orçamento Alto", "color": "#10b981" },
  "authority": { "score": 90, "desc": "Contato é decisor C-Level", "badge": "Decisor Final", "color": "#10b981" },
  "need": { "score": 85, "desc": "Demanda urgente identificada", "badge": "Dor Crítica", "color": "#ef4444" },
  "timing": { "score": 80, "desc": "Fechamento previsto em 7 dias", "badge": "Curto Prazo", "color": "#10b981" },
  "spin": {
    "situacao": "Contexto sucinto do cliente",
    "perguntaSituacao": "Pergunta de situação para o vendedor fazer",
    "problema": "Gargalo ou dor principal",
    "perguntaProblema": "Pergunta de problema matadora",
    "implicacao": "Custo de não resolver e riscos",
    "perguntaImplicacao": "Pergunta de implicação",
    "necessidadeSolucao": "Solução ideal Vellia",
    "perguntaFechamento": "Pergunta de fechamento comercial"
  }
}`;

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    const match = text.match(/\{[\s\S]*\}/);
                    if (match) {
                        const parsed = JSON.parse(match[0]);
                        parsed.source = "Gemini 2.5 Flash";
                        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: parsed }));
                        return parsed;
                    }
                }
            } catch (err) {
                console.warn("[QualificationAI] Erro ao consultar Gemini, usando fallback local:", err);
            }
        }

        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: localData }));
        return localData;
    },

    /**
     * Renderiza o Widget de Qualificação BANT & SPIN no Drawer do Lead
     */
    async renderDrawerQualification(lead) {
        const container = document.getElementById("drawer-bant-spin-container");
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">🎯</span>
                    <span style="font-size: 13px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">
                        Matriz de Qualificação BANT & SPIN
                    </span>
                </div>
                <button type="button" id="btn-refresh-bant" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px;">
                    🔄 Recalcular IA
                </button>
            </div>
            <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: center; min-height: 80px;">
                <span style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
                    Processando matriz BANT & metodologia SPIN...
                </span>
            </div>
        `;

        const bantData = await this.analyzeLead(lead);
        if (!bantData) return;

        const globalScore = bantData.globalScore || 50;
        let scoreBg = "#10b981";
        if (globalScore < 45) scoreBg = "#ef4444";
        else if (globalScore < 70) scoreBg = "#f59e0b";

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">🎯</span>
                    <span style="font-size: 13px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">
                        Matriz de Qualificação BANT & SPIN
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge" style="background: ${scoreBg}20; color: ${scoreBg}; border: 1px solid ${scoreBg}50; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px;">
                        BANT Score: ${globalScore}%
                    </span>
                    <button type="button" id="btn-refresh-bant" class="btn btn-outline btn-sm" title="Recalcular com IA" style="font-size: 11px; padding: 2px 7px; border-radius: 6px;">
                        🔄
                    </button>
                </div>
            </div>

            <!-- Grid 4 Pilares BANT -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                <!-- Budget -->
                <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">💰 Budget (Orçamento)</span>
                        <span style="font-size: 11px; font-weight: 800; color: ${bantData.budget.color};">${bantData.budget.score}%</span>
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">${bantData.budget.badge}</div>
                    <div style="font-size: 10.5px; color: var(--text-muted); line-height: 1.3;">${bantData.budget.desc}</div>
                </div>

                <!-- Authority -->
                <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">👑 Authority (Poder)</span>
                        <span style="font-size: 11px; font-weight: 800; color: ${bantData.authority.color};">${bantData.authority.score}%</span>
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">${bantData.authority.badge}</div>
                    <div style="font-size: 10.5px; color: var(--text-muted); line-height: 1.3;">${bantData.authority.desc}</div>
                </div>

                <!-- Need -->
                <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">🎯 Need (Necessidade)</span>
                        <span style="font-size: 11px; font-weight: 800; color: ${bantData.need.color};">${bantData.need.score}%</span>
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">${bantData.need.badge}</div>
                    <div style="font-size: 10.5px; color: var(--text-muted); line-height: 1.3;">${bantData.need.desc}</div>
                </div>

                <!-- Timing -->
                <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">⏱️ Timing (Urgência)</span>
                        <span style="font-size: 11px; font-weight: 800; color: ${bantData.timing.color};">${bantData.timing.score}%</span>
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">${bantData.timing.badge}</div>
                    <div style="font-size: 10.5px; color: var(--text-muted); line-height: 1.3;">${bantData.timing.desc}</div>
                </div>
            </div>

            <!-- Diagnóstico SPIN Selling Accordion / Box -->
            <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 11.5px; font-weight: 800; color: var(--primary); text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                        💡 Roteiro de Perguntas Consultivas (SPIN Selling)
                    </span>
                    <span style="font-size: 10px; color: var(--text-muted);">${bantData.source || 'IA Vellia'}</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11.5px;">
                    <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <strong style="color: #3b82f6;">S (Situação):</strong> ${bantData.spin.perguntaSituacao}
                    </div>
                    <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 6px; border-left: 3px solid #f59e0b;">
                        <strong style="color: #f59e0b;">P (Problema):</strong> ${bantData.spin.perguntaProblema}
                    </div>
                    <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 6px; border-left: 3px solid #ef4444;">
                        <strong style="color: #ef4444;">I (Implicação):</strong> ${bantData.spin.perguntaImplicacao}
                    </div>
                    <div style="padding: 6px 8px; background: var(--bg-surface); border-radius: 6px; border-left: 3px solid #10b981;">
                        <strong style="color: #10b981;">N (Fechamento):</strong> ${bantData.spin.perguntaFechamento}
                    </div>
                </div>
            </div>
        `;

        // Bind evento de recalcular
        const btnRefresh = container.querySelector("#btn-refresh-bant");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", () => {
                Toast.show("Recalculando qualificação com IA...", "info");
                this.analyzeLead(lead, true).then(() => this.renderDrawerQualification(lead));
            });
        }
    },

    /**
     * Gera os 3 contornos estratégicos para uma objeção específica
     */
    async generateObjectionStrategy(lead, objectionText) {
        const currentUser = Auth.getCurrentUser();
        const sellerName = currentUser?.name || "Consultor Vellia";
        const companyName = lead.company || "sua empresa";
        const contactName = lead.contact || "cliente";

        const apiKey = this.getApiKey();

        if (apiKey) {
            try {
                const prompt = `Você é um mentor especialista em Vendas B2B e Contorno de Objeções Consultivas (estilo Sandler Selling / SPIN).
O lead é: "${companyName}" (${lead.segment || 'Serviços/Indústria'}), contato "${contactName}".
O cliente apresentou a seguinte objeção: "${objectionText}".

Gere uma resposta estruturada ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "objection": "${objectionText}",
  "roiAngle": "Argumento focado em Retorno sobre Investimento, prevenção de perdas e custos de inação.",
  "empathyAngle": "Técnica Feel-Felt-Found (compreensão empática sem confronto e redirecionamento de foco).",
  "closingQuestion": "Pergunta matadora e pontual para manter o controle e avançar para o próximo passo.",
  "whatsappReady": "Texto pronto, humanizado e formatado com quebras e emojis para ser enviado pelo WhatsApp pelo vendedor ${sellerName}."
}`;

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    const match = text.match(/\{[\s\S]*\}/);
                    if (match) {
                        return JSON.parse(match[0]);
                    }
                }
            } catch (e) {
                console.warn("[QualificationAI] Falha na API Gemini para objeção, usando motor local:", e);
            }
        }

        // Heurística local de alta precisão para objeções comerciais clássicas
        const objLower = objectionText.toLowerCase();

        if (objLower.includes("caro") || objLower.includes("orçamento") || objLower.includes("preco") || objLower.includes("preço") || objLower.includes("desconto")) {
            return {
                objection: objectionText,
                roiAngle: `O custo de uma única parada técnica ou autuação fiscal não programada na ${companyName} costuma ser de 3x a 5x o valor investido neste serviço preventivo.`,
                empathyAngle: `Compreendo perfeitamente a cautela com fluxo de caixa. A maioria dos nossos clientes parceiros também avaliava o custo inicial, até perceberem a economia gerada em manutenções corretivas no primeiro trimestre.`,
                closingQuestion: `Se conseguirmos flexibilizar as condições de pagamento em parcelas que caibam no orçamento deste mês, conseguimos dar início na próxima semana?`,
                whatsappReady: `Olá ${contactName}, entendo perfeitamente a sua preocupação com o investimento. 💡\n\nNosso objetivo na Vellia é justamente blindar a operação da ${companyName} contra custos de paradas emergenciais e retrabalho, que costumam ser até 4x mais caros.\n\nPodemos escalonar o cronograma de pagamento para facilitar a aprovação interna. Que tal alinharmos 5 minutinhos hoje para ajustarmos essa condição?`
            };
        }

        if (objLower.includes("analisar") || objLower.includes("retorno") || objLower.includes("pensar") || objLower.includes("depois")) {
            return {
                objection: objectionText,
                roiAngle: `Manter a proposta ativa por muito tempo sem validação técnica congela a agenda de atendimento e adia os ganhos de produtividade da ${companyName}.`,
                empathyAngle: `Faz todo sentido você querer analisar com calma. Para que você tenha todas as informações em mãos, qual é o ponto principal da proposta que você gostaria de aprofundar?`,
                closingQuestion: `Qual seria uma boa data até quinta-feira para tirarmos eventuais dúvidas técnicas e decidirmos os próximos passos?`,
                whatsappReady: `Olá ${contactName}, tudo bem? Perfeito, faz todo sentido analisar com critério! 🤝\n\nPara te ajudar nessa avaliação interna na ${companyName}, qual foi o ponto ou dúvida que mais chamou sua atenção na proposta?\n\nPosso te ligar rapidamente amanhã às 10h ou 14h apenas para tirar dúvidas pontuais?`
            };
        }

        if (objLower.includes("outro fornecedor") || objLower.includes("já temos") || objLower.includes("concorrente") || objLower.includes("parceiro")) {
            return {
                objection: objectionText,
                roiAngle: `Ter uma segunda opção homologada traz poder de barganha e segurança de continuidade caso o fornecedor atual tenha atrasos ou indisponibilidade técnica.`,
                empathyAngle: `Excelente que você já possui um parceiro! Nossa intenção não é substituir contratos consolidados, mas sim ser uma opção estratégica para demandas com SLA crítico e tecnologia de ponta.`,
                closingQuestion: `Você estaria aberto a rodar um projeto piloto ou comparar nosso dimensionamento técnico sem nenhum compromisso financeiro?`,
                whatsappReady: `Excelente saber que vocês já contam com fornecedor, ${contactName}! 👏\n\nNão queremos romper parcerias existentes, mas sim oferecer à ${companyName} uma opção de contingência homologada e com atendimento prioritário.\n\nQue tal realizarmos uma cotação/dimensionamento piloto comparativo sem nenhum compromisso para você testar nossa agilidade?`
            };
        }

        if (objLower.includes("diretoria") || objLower.includes("sócio") || objLower.includes("socio") || objLower.includes("aprovar") || objLower.includes("comitê")) {
            return {
                objection: objectionText,
                roiAngle: `Apresentar um resumo executivo com foco em ROI e redução de riscos facilita a aprovação imediata pela diretoria sem travar em burocracias.`,
                empathyAngle: `Totalmente compreensível. O processo decisório da diretoria exige clareza de retorno financeiro e segurança jurídica/técnica.`,
                closingQuestion: `Gostaria que eu preparasse um resumo executivo de 1 página ou participasse de uma reunião rápida de 10 min com os sócios para defender o projeto com você?`,
                whatsappReady: `Com certeza, ${contactName}! Sei bem como a diretoria prioriza previsibilidade e segurança nos investimentos da ${companyName}. 📑\n\nPosso preparar um resumo executivo de 1 página focado exclusivamente no ROI e nos ganhos operacionais para te apoiar nessa apresentação interna. O que acha?`
            };
        }

        // Genérico inteligente
        return {
            objection: objectionText,
            roiAngle: `Resolver este ponto agora impede custos acumulados e coloca a operação da ${companyName} à frente dos concorrentes em termos de eficiência.`,
            empathyAngle: `Entendo o seu ponto de vista e é uma consideração muito válida.`,
            closingQuestion: `Qual seria a principal condição ou ajuste necessário para darmos início ainda este mês?`,
            whatsappReady: `Olá ${contactName}, compreendo perfeitamente o seu ponto sobre "${objectionText}".\n\nNosso compromisso na Vellia é adaptar a solução para a realidade exata da ${companyName}.\n\nQual seria o principal ajuste que tornaria esse projeto 100% viável para darmos o primeiro passo juntos?`
        };
    },

    /**
     * Renderiza o Hub de Contorno de Objeções no Drawer do Lead
     */
    renderObjectionHub(lead) {
        const container = document.getElementById("drawer-objection-hub-container");
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">🛡️</span>
                    <span style="font-size: 13px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">
                        Hub de Contorno de Objeções IA
                    </span>
                </div>
                <span class="badge" style="background: rgba(99, 102, 241, 0.12); color: var(--primary); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px;">
                    Respostas em 1 Clique
                </span>
            </div>

            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px;">
                Selecione a objeção apresentada pelo cliente para gerar estratégias prontas e script WhatsApp:
            </div>

            <!-- Pílulas de Objeções Frequentes -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;" id="objection-quick-chips">
                <button type="button" class="btn btn-outline btn-sm obj-chip" data-objection="Está muito caro / Acima do orçamento" style="font-size: 11px; padding: 4px 9px; border-radius: 20px; background: var(--bg-body);">
                    💸 Está muito caro
                </button>
                <button type="button" class="btn btn-outline btn-sm obj-chip" data-objection="Vou avaliar internamente e retorno depois" style="font-size: 11px; padding: 4px 9px; border-radius: 20px; background: var(--bg-body);">
                    ⏳ Vou avaliar e retorno
                </button>
                <button type="button" class="btn btn-outline btn-sm obj-chip" data-objection="Já temos outro fornecedor parceiro" style="font-size: 11px; padding: 4px 9px; border-radius: 20px; background: var(--bg-body);">
                    🏢 Já temos fornecedor
                </button>
                <button type="button" class="btn btn-outline btn-sm obj-chip" data-objection="Preciso aprovar com a diretoria / outros sócios" style="font-size: 11px; padding: 4px 9px; border-radius: 20px; background: var(--bg-body);">
                    👥 Preciso aprovar com diretoria
                </button>
                <button type="button" class="btn btn-outline btn-sm obj-chip" data-objection="Não é o momento / Faremos no próximo semestre" style="font-size: 11px; padding: 4px 9px; border-radius: 20px; background: var(--bg-body);">
                    📅 Não é o momento
                </button>
            </div>

            <!-- Input de Objeção Personalizada -->
            <div style="display: flex; gap: 6px; margin-bottom: 12px;">
                <input type="text" id="custom-objection-input" class="form-control" placeholder="Ou digite outra objeção..." style="height: 34px; font-size: 12px; border-radius: 6px; flex: 1;">
                <button type="button" id="btn-solve-custom-obj" class="btn btn-primary" style="height: 34px; font-size: 11.5px; padding: 0 12px; border-radius: 6px; white-space: nowrap; font-weight: 700;">
                    Resolver ⚡
                </button>
            </div>

            <!-- Painel de Resultado da Objeção -->
            <div id="objection-response-panel" style="display: none; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-top: 10px;">
                <!-- Preenchido via JS -->
            </div>
        `;

        // Eventos dos chips
        container.querySelectorAll(".obj-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const objText = chip.getAttribute("data-objection");
                this.handleSolveObjection(lead, objText);
            });
        });

        // Evento do custom input
        const customInput = container.querySelector("#custom-objection-input");
        const btnSolve = container.querySelector("#btn-solve-custom-obj");

        if (btnSolve && customInput) {
            btnSolve.addEventListener("click", () => {
                const text = customInput.value.trim();
                if (text) this.handleSolveObjection(lead, text);
            });
            customInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    const text = customInput.value.trim();
                    if (text) this.handleSolveObjection(lead, text);
                }
            });
        }
    },

    /**
     * Processa a resolução de uma objeção e exibe os 3 ângulos + botão WhatsApp
     */
    async handleSolveObjection(lead, objectionText) {
        const panel = document.getElementById("objection-response-panel");
        if (!panel) return;

        panel.style.display = "block";
        panel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px; color: var(--text-muted); font-size: 12px;">
                <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
                Elaborando estratégia de contorno para: <em>"${objectionText}"</em>...
            </div>
        `;

        const result = await this.generateObjectionStrategy(lead, objectionText);

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 800; color: var(--text-primary);">
                    🛡️ Estratégia: "${result.objection}"
                </span>
                <button type="button" id="btn-close-obj-panel" style="background: none; border: none; font-size: 14px; cursor: pointer; color: var(--text-muted);">✕</button>
            </div>

            <!-- 3 Ângulos Táticos -->
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px; margin-bottom: 14px;">
                <div style="background: var(--bg-surface); border-left: 3px solid #10b981; padding: 8px 10px; border-radius: 6px;">
                    <strong style="color: #10b981; display: block; margin-bottom: 2px;">💎 1. Ângulo ROI & Custo de Inação:</strong>
                    <span style="color: var(--text-secondary); line-height: 1.4;">${result.roiAngle}</span>
                </div>

                <div style="background: var(--bg-surface); border-left: 3px solid #6366f1; padding: 8px 10px; border-radius: 6px;">
                    <strong style="color: #6366f1; display: block; margin-bottom: 2px;">🤝 2. Ângulo Empatia & Reenquadramento:</strong>
                    <span style="color: var(--text-secondary); line-height: 1.4;">${result.empathyAngle}</span>
                </div>

                <div style="background: var(--bg-surface); border-left: 3px solid #f59e0b; padding: 8px 10px; border-radius: 6px;">
                    <strong style="color: #f59e0b; display: block; margin-bottom: 2px;">⚡ 3. Pergunta Matadora de Fechamento:</strong>
                    <span style="color: var(--text-secondary); line-height: 1.4;">${result.closingQuestion}</span>
                </div>
            </div>

            <!-- Script WhatsApp Pronto -->
            <div style="background: rgba(37, 211, 102, 0.08); border: 1px dashed #25d366; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11px; font-weight: 800; color: #16a34a; text-transform: uppercase;">
                        💬 Mensagem Pronta para WhatsApp
                    </span>
                    <button type="button" id="btn-copy-obj-wa" class="btn btn-outline btn-sm" style="font-size: 10.5px; padding: 2px 8px; border-radius: 4px; height: 24px;">
                        📋 Copiar
                    </button>
                </div>
                <div style="font-size: 11.5px; color: var(--text-primary); white-space: pre-wrap; line-height: 1.4;" id="obj-wa-text-content">${result.whatsappReady}</div>
            </div>

            <!-- Botões de Ação Imediata -->
            <div style="display: flex; gap: 8px;">
                <button type="button" id="btn-inject-obj-chat" class="btn btn-primary" style="flex: 1; height: 36px; font-size: 12px; font-weight: 700; background: #25d366; border-color: #25d366; color: #fff; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 6px;">
                    <span>💬</span> Usar no Chat WhatsApp Inline
                </button>
            </div>
        `;

        // Bind fechar painel
        panel.querySelector("#btn-close-obj-panel")?.addEventListener("click", () => {
            panel.style.display = "none";
        });

        // Bind copiar mensagem
        panel.querySelector("#btn-copy-obj-wa")?.addEventListener("click", () => {
            navigator.clipboard.writeText(result.whatsappReady).then(() => {
                Toast.show("Script copiado para a área de transferência!", "success");
            });
        });

        // Bind injetar no chat do Drawer
        panel.querySelector("#btn-inject-obj-chat")?.addEventListener("click", () => {
            const chatInput = document.getElementById("chat-text-input");
            const chatSection = document.getElementById("drawer-whatsapp-chat-section");
            
            if (chatInput) {
                chatInput.value = result.whatsappReady;
                if (chatSection) {
                    chatSection.style.display = "block";
                    chatSection.scrollIntoView({ behavior: "smooth" });
                }
                chatInput.focus();
                Toast.show("Mensagem injetada no chat! Basta clicar em Enviar.", "success");
            } else {
                navigator.clipboard.writeText(result.whatsappReady).then(() => {
                    Toast.show("Script copiado! Abra o WhatsApp do lead para colar.", "info");
                });
            }
        });
    }
};

// Tornar disponível globalmente
if (typeof window !== "undefined") {
    window.QualificationAI = QualificationAI;
}
