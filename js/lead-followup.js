/**
 * Vellia CRM - Módulo de Gestão & Follow-up de Leads (Foco Comercial / Mika)
 * Automação de WhatsApp em 1 clique, Fila de Atendimento Prioritário e Higienização de Dados
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Toast } from "./toast.js";
import { CNPJService } from "./cnpj-service.js";

// Mapeamento enriquecido de CNPJ e dados das grandes empresas da carteira
const KNOWN_COMPANIES_ENRICHMENT = {
    "MASTERBOI": { cnpj: "03.999.642/0001-44", segment: "Alimentação / Frigorífico" },
    "BIOSFERA SOLUCOES AMBIENTAIS": { cnpj: "08.570.643/0001-52", segment: "Consultoria Ambiental" },
    "BAUMINAS LOG": { cnpj: "14.184.256/0001-42", segment: "Transportes" },
    "G.M. CONSULTORIA": { cnpj: "10.456.892/0001-83", segment: "Consultoria" },
    "SIKA S A": { cnpj: "61.127.368/0001-72", segment: "Indústria Química" },
    "ADIMAX - INDUSTRIA E COMERCIO DE ALIMENTOS LTDA.": { cnpj: "04.833.041/0001-09", segment: "Alimentação / Pet Food" },
    "BAUMINAS QUIMICA N/NE LTDA": { cnpj: "07.218.428/0001-49", segment: "Indústria Química" },
    "NOTARO ALIMENTOS LTDA": { cnpj: "08.406.848/0001-57", segment: "Alimentação / Avicultura" },
    "ALPARGATAS S.A.": { cnpj: "61.079.114/0001-92", segment: "Indústria Têxtil / Calçados" },
    "NOVATEC CONSTRUCOES E EMPREENDIMENTOS LTDA": { cnpj: "03.968.140/0001-07", segment: "Construção Civil" },
    "CLEAN OCEAN": { cnpj: "18.392.401/0001-94", segment: "Gestão Ambiental" },
    "PROJECAO AMBIENTAL ENGENHARIA GESTAO E CONSULTORIA LTDA": { cnpj: "22.846.541/0001-02", segment: "Engenharia Ambiental" },
    "PREVSEGUR CONSULTORIA E ASSESSORIA DE SEGURANCA E SAUDE": { cnpj: "13.882.109/0001-65", segment: "Segurança do Trabalho" },
    "PEPSICO AMACOCO BEBIDAS DO BRASIL LTDA": { cnpj: "00.997.550/0001-05", segment: "Alimentação / Bebidas" },
    "BRASMIX": { cnpj: "10.636.568/0001-08", segment: "Construção Civil / Concreto" },
    "SALMERON ENERGIA RENOVAVEL E PROTECAO AO CLIMA NORDESTE LTDA": { cnpj: "37.955.940/0001-77", segment: "Energia Renovável" },
    "SCOF-SERVICOS COMPLEMENTARES DE OPERACOES FERROVIARIAS S.A.": { cnpj: "05.419.006/0001-38", segment: "Transportes / Ferroviário" },
    "PALHA BRANCA AGROINDUSTRIAL": { cnpj: "07.891.234/0001-19", segment: "Agroindústria" },
    "GEOCORR AMBIENTAL": { cnpj: "19.452.883/0001-72", segment: "Consultoria Ambiental" },
    "DAFRUTA": { cnpj: "05.158.077/0001-05", segment: "Alimentação / Bebidas" },
    "DEXCO S.A": { cnpj: "97.837.181/0001-47", segment: "Indústria / Materiais de Construção" },
    "CERAMICA BOA VISTA": { cnpj: "06.291.844/0001-33", segment: "Construção Civil / Cerâmica" },
    "DBM MINERAIS LTDA": { cnpj: "08.192.834/0001-20", segment: "Mineração" },
    "BENTONORTH MINERAIS LTDA": { cnpj: "11.782.901/0001-55", segment: "Mineração" },
    "BIOTA PROJETOS E CONSULTORIA AMBIENTAL": { cnpj: "09.341.228/0001-64", segment: "Consultoria Ambiental" },
    "USINA UTINGA": { cnpj: "12.247.989/0001-04", segment: "Indústria Sucroalcooleira" }
};

export const LeadFollowup = {
    activeSeller: "mika@vellia.com",

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const btnHub = document.getElementById("btn-open-followup-hub");
        if (btnHub) {
            btnHub.addEventListener("click", () => this.openFollowupModal());
        }

        const btnSanitize = document.getElementById("btn-sanitize-leads");
        if (btnSanitize) {
            btnSanitize.addEventListener("click", () => this.sanitizeAndEnrichLeads());
        }

        const modalClose = document.getElementById("btn-close-followup-modal");
        const modalCancel = document.getElementById("btn-cancel-followup-modal");
        const overlay = document.getElementById("followup-modal-overlay");

        if (modalClose) modalClose.addEventListener("click", () => this.closeFollowupModal());
        if (modalCancel) modalCancel.addEventListener("click", () => this.closeFollowupModal());
        if (overlay) overlay.addEventListener("click", () => this.closeFollowupModal());

        // Eventos de tabs dentro do modal
        const tabs = document.querySelectorAll(".followup-tab-btn");
        tabs.forEach(tab => {
            tab.addEventListener("click", (e) => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                const targetCategory = tab.getAttribute("data-category");
                this.renderModalList(targetCategory);
            });
        });
    },

    /**
     * Limpa, valida e normaliza telefones brasileiros para o padrão (DD) 9XXXX-XXXX e 55DD9XXXXXXXX
     */
    cleanAndFormatPhone(rawPhone, dddFallback = "81") {
        if (!rawPhone) return { formatted: "", whatsapp: "", valid: false, isMobile: false, digits: "" };

        let digits = rawPhone.toString().replace(/\D/g, "");

        if (digits.startsWith("55") && digits.length >= 12) {
            digits = digits.substring(2);
        }

        // 8 dígitos de celular sem DDD e sem o 9
        if (digits.length === 8 && /^[6-9]/.test(digits)) {
            digits = dddFallback + "9" + digits;
        }
        // 8 dígitos fixo sem DDD
        else if (digits.length === 8 && /^[2-5]/.test(digits)) {
            digits = dddFallback + digits;
        }
        // 9 dígitos de celular sem DDD
        else if (digits.length === 9 && digits.startsWith("9")) {
            digits = dddFallback + digits;
        }
        // 10 dígitos (DDD + 8 dígitos móvel sem o 9 na frente)
        else if (digits.length === 10 && /^\d{2}[6-9]/.test(digits)) {
            const ddd = digits.substring(0, 2);
            const num = digits.substring(2);
            digits = ddd + "9" + num;
        }

        let formatted = "";
        let whatsapp = "";
        let isMobile = false;

        if (digits.length === 11) {
            isMobile = true;
            formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
            whatsapp = `55${digits}`;
        } else if (digits.length === 10) {
            isMobile = false;
            formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
            whatsapp = `55${digits}`;
        } else {
            formatted = rawPhone;
            whatsapp = digits.length >= 8 ? `55${digits}` : "";
        }

        return {
            raw: rawPhone,
            digits,
            formatted,
            whatsapp,
            isMobile,
            valid: digits.length === 10 || digits.length === 11
        };
    },

    /**
     * Calcula métricas e divide leads do vendedor por prioridade
     */
    getSellerLeads(sellerEmail = null) {
        const currentUser = Auth.getCurrentUser();
        const targetEmail = sellerEmail || (currentUser?.role === "seller" ? currentUser.email : "mika@vellia.com");
        
        const leads = Store.getLeads().filter(l => l.owner === targetEmail || (l.owner && l.owner.toLowerCase().includes("mika")));
        const now = new Date();

        const enriched = leads.map(l => {
            const phoneInfo = this.cleanAndFormatPhone(l.whatsapp || l.phone);
            
            let lastDate = new Date(l.createdAt || now);
            if (l.interactions && l.interactions.length > 0) {
                const sorted = [...l.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                lastDate = new Date(sorted[0].timestamp);
            }
            const daysNoContact = Math.floor(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
            const minutesSLA = Math.floor(Math.abs(now - lastDate) / (1000 * 60));

            return {
                ...l,
                phoneInfo,
                daysNoContact,
                minutesSLA,
                lastContactDate: lastDate
            };
        });

        const urgent = enriched.filter(l => 
            (l.stage === "Negociação" || l.stage === "Proposta Enviada" || l.stage === "Lead Gerado") && 
            (l.daysNoContact >= 3 || l.minutesSLA >= 60)
        );

        const activeOpportunities = enriched.filter(l => 
            l.stage === "Negociação" || l.stage === "Proposta Enviada"
        );

        const newLeads = enriched.filter(l => 
            l.stage === "Lead Gerado" || l.stage === "Contato"
        );

        const closedClients = enriched.filter(l => 
            l.stage === "Cliente Fechado"
        );

        return {
            sellerEmail: targetEmail,
            total: enriched.length,
            leads: enriched,
            urgent,
            activeOpportunities,
            newLeads,
            closedClients
        };
    },

    /**
     * Gera templates de mensagem personalizados com base na etapa do lead
     */
    getMessageTemplates(lead, sellerName = "Mika") {
        const contact = (lead.contact || "Prezado(a)").split(" ")[0];
        const company = lead.company || "sua empresa";

        return {
            proposta: {
                id: "proposta",
                label: "📄 Follow-up de Proposta",
                badge: "Proposta",
                color: "#3b82f6",
                text: `Olá ${contact}, tudo bem? Aqui é a ${sellerName} da Vellia Soluções Ambientais! 🌱\n\nPassando para acompanhar a proposta comercial que preparamos para a ${company}. Você teve a oportunidade de avaliar? Caso tenha alguma dúvida técnica sobre os laudos ou queira alinhar prazos e condições, estou à disposição!`
            },
            fechamento: {
                id: "fechamento",
                label: "⚡ Reta Final / Fechamento",
                badge: "Negociação",
                color: "#8b5cf6",
                text: `Olá ${contact}! Tudo bem? Sou a ${sellerName} da Vellia.\n\nEstamos fechando o cronograma de inspeções e monitoramentos dos nossos engenheiros para esta quinzena. Gostaria de verificar se podemos formalizar o pedido da ${company} para garantir sua data prioritária!`
            },
            primeiro_contato: {
                id: "primeiro_contato",
                label: "👋 Primeiro Contato & Apresentação",
                badge: "Novo Lead",
                color: "#10b981",
                text: `Olá ${contact}, tudo bem? Aqui é a ${sellerName}, consultora técnica da Vellia Soluções Ambientais.\n\nRecebi sua solicitação referente à ${company}. Gostaria de entender melhor suas demandas ambientais atuais para enviar a solução mais ágil e com o melhor custo-benefício. Podemos conversar 5 minutinhos?`
            },
            reativacao: {
                id: "reativacao",
                label: "⚠️ Reengajamento (+3 dias)",
                badge: "Atrasado",
                color: "#ef4444",
                text: `Olá ${contact}, como você está?\n\nPassando para saber se o projeto da ${company} ainda está no seu radar. Seguimos com total interesse em atendê-los na Vellia com excelência e conformidade regulatória. Tem previsão de quando podemos retomar nosso alinhamento?`
            },
            pos_venda: {
                id: "pos_venda",
                label: "🔄 Pós-Venda & Renovação",
                badge: "Cliente Fechado",
                color: "#059669",
                text: `Olá ${contact}! Tudo bem? Aqui é a ${sellerName} da Vellia Soluções Ambientais.\n\nPassando para saber como estão as operações e os laudos aí na ${company}! Lembramos que estamos à disposição para renovações de licenças, ensaios isocinéticos ou qualquer novo monitoramento. Um grande abraço!`
            }
        };
    },

    /**
     * Dispara WhatsApp em 1 clique, abrindo link e registrando interação automática no histórico do CRM
     */
    sendQuickWhatsApp(leadId, templateKey = "proposta") {
        const lead = Store.getLeadById(leadId);
        if (!lead) {
            Toast.show("Lead não encontrado.", "error");
            return;
        }

        const phoneInfo = this.cleanAndFormatPhone(lead.whatsapp || lead.phone);
        if (!phoneInfo.whatsapp || !phoneInfo.valid) {
            Toast.show(`Número de telefone de ${lead.company} inválido ou incompleto: ${lead.whatsapp || lead.phone || 'Sem número'}.`, "warning");
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const sellerName = currentUser?.name?.split(" ")[0] || "Mika";
        const templates = this.getMessageTemplates(lead, sellerName);
        const selectedTpl = templates[templateKey] || templates.proposta;

        const encodedMessage = encodeURIComponent(selectedTpl.text);
        const waUrl = `https://wa.me/${phoneInfo.whatsapp}?text=${encodedMessage}`;

        // Registrar no histórico do lead
        const userEmail = currentUser?.email || lead.owner || "mika@vellia.com";
        const interactionDesc = `WhatsApp de Follow-up enviado (${selectedTpl.label}) para ${lead.contact || lead.company} (${phoneInfo.formatted}): "${selectedTpl.text.substring(0, 100)}..."`;

        Store.addLeadInteraction(leadId, userEmail, {
            type: "WhatsApp",
            description: interactionDesc
        });

        // Abrir WhatsApp Web / App
        window.open(waUrl, "_blank");

        Toast.show(`WhatsApp aberto para ${lead.company}! Interação gravada no histórico.`, "success");

        // Atualizar listagem e modal
        if (window.CRM?.renderLeadsTable) {
            window.CRM.renderLeadsTable();
        }
        this.renderModalList();
    },

    /**
     * Higieniza e enriquece os leads do vendedor (ou da base toda)
     */
    async sanitizeAndEnrichLeads() {
        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser?.email || "mika@vellia.com";
        
        Toast.show("Iniciando higienização de telefones e enriquecimento de CNPJ...", "info");

        const leads = Store.getLeads();
        let updatedCount = 0;
        let enrichedCnpjCount = 0;

        leads.forEach(l => {
            let changed = false;
            const updatePayload = {};

            // 1. Higienizar telefone e WhatsApp
            const rawPhone = l.whatsapp || l.phone;
            const cleaned = this.cleanAndFormatPhone(rawPhone);
            if (cleaned.valid && (l.whatsapp !== cleaned.formatted || !l.whatsapp)) {
                updatePayload.whatsapp = cleaned.formatted;
                updatePayload.phone = cleaned.formatted;
                changed = true;
            }

            // 2. Enriquecer CNPJ se estiver vazio ou undefined
            const compNameUpper = (l.company || "").trim().toUpperCase();
            const knownMatch = KNOWN_COMPANIES_ENRICHMENT[compNameUpper];
            
            if (knownMatch && (!l.cnpj || l.cnpj === "undefined" || l.cnpj.trim().length < 11)) {
                updatePayload.cnpj = knownMatch.cnpj;
                if (!l.segment || l.segment === "Outros") {
                    updatePayload.segment = knownMatch.segment;
                }
                enrichedCnpjCount++;
                changed = true;
            }

            if (changed) {
                Store.updateLead(l.id, updatePayload, userEmail);
                updatedCount++;
            }
        });

        Toast.show(`Higienização concluída! ${updatedCount} leads atualizados e ${enrichedCnpjCount} CNPJs enriquecidos.`, "success");

        if (window.CRM?.renderLeadsTable) {
            window.CRM.renderLeadsTable();
        }
        this.updatePillCounter();
        this.renderModalList();
    },

    /**
     * Atualiza o contador da pílula de follow-up da Mika no CRM
     */
    updatePillCounter() {
        const stats = this.getSellerLeads();
        const pillCount = document.getElementById("pill-count-mika");
        if (pillCount) {
            pillCount.textContent = stats.total;
        }

        const urgentCount = document.getElementById("followup-urgent-count");
        if (urgentCount) urgentCount.textContent = stats.urgent.length;

        const oppsCount = document.getElementById("followup-opps-count");
        if (oppsCount) oppsCount.textContent = stats.activeOpportunities.length;

        const newCount = document.getElementById("followup-new-count");
        if (newCount) newCount.textContent = stats.newLeads.length;

        const closedCount = document.getElementById("followup-closed-count");
        if (closedCount) closedCount.textContent = stats.closedClients.length;
    },

    /**
     * Abre o modal com a Fila de Atendimento Prioritário
     */
    openFollowupModal(sellerEmail = null) {
        const modal = document.getElementById("followup-modal");
        const overlay = document.getElementById("followup-modal-overlay");
        if (!modal || !overlay) return;

        this.updatePillCounter();
        this.renderModalList("urgent");

        modal.style.display = "block";
        overlay.style.display = "block";
    },

    closeFollowupModal() {
        const modal = document.getElementById("followup-modal");
        const overlay = document.getElementById("followup-modal-overlay");
        if (modal) modal.style.display = "none";
        if (overlay) overlay.style.display = "none";
    },

    /**
     * Renderiza os cards de leads prioritários dentro do modal
     */
    renderModalList(category = "urgent") {
        const container = document.getElementById("followup-leads-list");
        if (!container) return;

        const stats = this.getSellerLeads();
        let targetList = [];

        if (category === "urgent") targetList = stats.urgent.length > 0 ? stats.urgent : stats.activeOpportunities;
        else if (category === "opportunities") targetList = stats.activeOpportunities;
        else if (category === "new") targetList = stats.newLeads;
        else if (category === "closed") targetList = stats.closedClients;
        else targetList = stats.leads;

        if (targetList.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
                    <div style="font-weight: 600; font-size: 15px; color: var(--text-primary);">Nenhum lead pendente nesta categoria!</div>
                    <div style="font-size: 13px; margin-top: 4px;">Todos os contatos estão em dia. Excelente trabalho!</div>
                </div>
            `;
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const sellerName = currentUser?.name?.split(" ")[0] || "Mika";

        container.innerHTML = targetList.map(lead => {
            const phoneInfo = lead.phoneInfo || this.cleanAndFormatPhone(lead.whatsapp || lead.phone);
            const templates = this.getMessageTemplates(lead, sellerName);
            
            // Escolher o melhor template padrão para este lead
            let defaultTplKey = "proposta";
            if (lead.stage === "Lead Gerado" || lead.stage === "Contato") defaultTplKey = "primeiro_contato";
            else if (lead.stage === "Cliente Fechado") defaultTplKey = "pos_venda";
            else if (lead.daysNoContact >= 3) defaultTplKey = "reativacao";
            else if (lead.stage === "Negociação") defaultTplKey = "fechamento";

            const defaultTpl = templates[defaultTplKey];

            return `
                <div class="followup-lead-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s, box-shadow 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <div style="width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg, var(--primary) 0%, #0d9488 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0;">
                                ${(lead.company || "L").substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 700; font-size: 14.5px; color: var(--text-primary);">${lead.company}</div>
                                <div style="font-size: 12.5px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                                    <span>👤 ${lead.contact || "Sem contato"}</span>
                                    <span>•</span>
                                    <span style="font-weight: 500; color: var(--text-secondary);">${phoneInfo.formatted || lead.phone || lead.whatsapp || "Sem telefone"}</span>
                                    ${lead.cnpj ? `<span>•</span><span style="font-family: monospace; font-size: 11px;">CNPJ: ${CNPJService.formatCNPJ(lead.cnpj)}</span>` : ""}
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="badge" style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: rgba(59,130,246,0.1); color: #2563eb; border: 1px solid rgba(59,130,246,0.2);">
                                ${lead.stage}
                            </span>
                            ${lead.daysNoContact >= 3 && lead.stage !== "Cliente Fechado" ? `
                                <span style="font-size: 11px; font-weight: 700; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                                    ⚠️ ${lead.daysNoContact}d sem contato
                                </span>
                            ` : `
                                <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); background: var(--bg-hover); padding: 3px 8px; border-radius: 6px;">
                                    ${lead.daysNoContact === 0 ? "Hoje" : `${lead.daysNoContact}d atrás`}
                                </span>
                            `}
                        </div>
                    </div>

                    <!-- Pré-visualização da Mensagem de Follow-up -->
                    <div style="background: var(--bg-hover); border-left: 3px solid ${defaultTpl.color}; border-radius: 0 8px 8px 0; padding: 10px 14px; font-size: 12.5px; line-height: 1.45; color: var(--text-primary);">
                        <div style="font-weight: 700; font-size: 11px; color: ${defaultTpl.color}; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${defaultTpl.label}
                        </div>
                        <div style="white-space: pre-wrap; font-style: italic;">"${defaultTpl.text}"</div>
                    </div>

                    <!-- Barra de Ações Rápidas -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; pt: 4px;">
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button class="btn btn-sm btn-outline btn-tpl-option" data-id="${lead.id}" data-tpl="proposta" style="font-size: 11px; padding: 4px 8px;">📄 Proposta</button>
                            <button class="btn btn-sm btn-outline btn-tpl-option" data-id="${lead.id}" data-tpl="fechamento" style="font-size: 11px; padding: 4px 8px;">⚡ Fechamento</button>
                            <button class="btn btn-sm btn-outline btn-tpl-option" data-id="${lead.id}" data-tpl="reativacao" style="font-size: 11px; padding: 4px 8px;">⚠️ Reativar</button>
                            <button class="btn btn-sm btn-outline btn-tpl-option" data-id="${lead.id}" data-tpl="pos_venda" style="font-size: 11px; padding: 4px 8px;">🔄 Pós-Venda</button>
                        </div>

                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-sm btn-outline" onclick="window.CRM?.openLeadDrawer('${lead.id}')" style="font-size: 12px; font-weight: 600;">
                                Ver Ficha
                            </button>
                            <button class="btn btn-sm btn-primary btn-quick-wa-action" data-id="${lead.id}" data-tpl="${defaultTplKey}" style="background: #25d366; border-color: #25d366; color: white; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                <span>Enviar WhatsApp</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Eventos nos botões de disparo de WhatsApp do modal
        container.querySelectorAll(".btn-quick-wa-action").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const tpl = btn.getAttribute("data-tpl") || "proposta";
                this.sendQuickWhatsApp(id, tpl);
            });
        });

        // Eventos de troca de template nos botões de opções rápidas
        container.querySelectorAll(".btn-tpl-option").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const tpl = btn.getAttribute("data-tpl");
                this.sendQuickWhatsApp(id, tpl);
            });
        });
    }
};

window.LeadFollowup = LeadFollowup;
