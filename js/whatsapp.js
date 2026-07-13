import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

export const WhatsApp = {
    activeLeadId: null,
    activeProposalId: null,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const btnClose = document.getElementById("btn-close-whatsapp-modal");
        const btnCancel = document.getElementById("btn-cancel-whatsapp");
        const overlay = document.getElementById("whatsapp-modal-overlay");
        const selectTemplate = document.getElementById("wa-template-select");
        const btnSimulate = document.getElementById("btn-simulate-whatsapp");
        const btnSend = document.getElementById("btn-send-whatsapp");

        if (btnClose) btnClose.addEventListener("click", () => this.closeModal());
        if (btnCancel) btnCancel.addEventListener("click", () => this.closeModal());
        if (overlay) overlay.addEventListener("click", () => this.closeModal());

        if (selectTemplate) {
            selectTemplate.addEventListener("change", () => {
                this.updateTemplateMessage();
            });
        }

        if (btnSimulate) {
            btnSimulate.addEventListener("click", () => {
                this.handleSend(true);
            });
        }

        if (btnSend) {
            btnSend.addEventListener("click", () => {
                this.handleSend(false);
            });
        }
    },

    async openModalForLead(leadId) {
        this.activeLeadId = leadId;
        this.activeProposalId = null;
        this.populateContactInfo();
        
        const select = document.getElementById("wa-template-select");
        if (select) {
            try {
                const { analyzeContext } = await import('./ai.js');
                const ctx = analyzeContext();
                const isCold = ctx.coldLeads.some(l => l.id === leadId);
                select.value = isCold ? "reengage" : "welcome";
            } catch (e) {
                select.value = "welcome";
            }
        }
        this.updateTemplateMessage();

        this.showModal();
    },

    openModalForProposal(leadId, proposalId) {
        this.activeLeadId = leadId;
        this.activeProposalId = proposalId;
        this.populateContactInfo();

        const select = document.getElementById("wa-template-select");
        if (select) select.value = "proposal";
        this.updateTemplateMessage();

        this.showModal();
    },

    populateContactInfo() {
        const lead = Store.getLeadById(this.activeLeadId);
        if (!lead) return;

        const nameEl = document.getElementById("wa-contact-name");
        const phoneEl = document.getElementById("wa-contact-phone");
        const avatarEl = document.getElementById("wa-contact-avatar");

        if (nameEl) nameEl.textContent = lead.contact || lead.company;
        if (phoneEl) phoneEl.textContent = lead.whatsapp || lead.phone || "Não cadastrado";
        if (avatarEl) avatarEl.textContent = (lead.contact || lead.company).substring(0, 1).toUpperCase();
    },

    updateTemplateMessage() {
        const lead = Store.getLeadById(this.activeLeadId);
        if (!lead) return;

        const select = document.getElementById("wa-template-select");
        const textEl = document.getElementById("wa-message-text");
        if (!select || !textEl) return;

        const currentUser = Auth.getCurrentUser();
        const sellerName = currentUser ? currentUser.name : "Consultor Vellia";
        const templateType = select.value;

        let message = "";
        
        if (templateType === "welcome") {
            message = `Olá ${lead.contact || lead.company}, tudo bem? Aqui é o ${sellerName} da Vellia. Vi seu interesse no segmento de ${lead.segment || "serviços"} e gostaria de entender como podemos ajudar a alavancar seus negócios. Qual seria o melhor dia para uma rápida conversa?`;
        } else if (templateType === "followup") {
            message = `Olá ${lead.contact || lead.company}, tudo bem? Passando para saber se conseguiu avaliar o que conversamos no nosso último contato sobre ${lead.segment || "nossos serviços"}. Fico à disposição para esclarecer qualquer dúvida comercial!`;
        } else if (templateType === "proposal" && this.activeProposalId) {
            const proposal = Store.getProposalById(this.activeProposalId);
            if (proposal) {
                const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
                message = `Olá ${lead.contact || lead.company}, tudo bem? Gostaria de saber se você teve a oportunidade de analisar a nossa proposta comercial para o serviço de ${proposal.service || "Serviço"} no valor de ${fmt(proposal.value)}. Qual é a sua previsão de retorno para darmos os próximos passos?`;
            } else {
                message = `Olá ${lead.contact || lead.company}, tudo bem? Gostaria de saber se você conseguiu analisar a proposta comercial que enviamos recentemente. Fico à disposição para negociarmos os valores e prazos!`;
            }
        } else if (templateType === "proposal") {
            message = `Olá ${lead.contact || lead.company}, tudo bem? Gostaria de saber se você conseguiu analisar a nossa proposta comercial enviada recentemente. Ficamos à disposição!`;
        } else if (templateType === "reengage") {
            message = `Olá ${lead.contact || lead.company}, como vai? Faz um tempo que não nos falamos! Gostaria de saber como estão os desafios de ${lead.segment || "negócios"} por aí e se ainda faz sentido analisarmos a solução inteligente da Vellia. Quando teria 5 minutos livres esta semana para batermos um papo rápido?`;
        }

        textEl.value = message;
    },

    showModal() {
        const modal = document.getElementById("whatsapp-modal");
        const overlay = document.getElementById("whatsapp-modal-overlay");
        if (modal) modal.classList.add("open");
        if (overlay) overlay.style.display = "block";
    },

    closeModal() {
        const modal = document.getElementById("whatsapp-modal");
        const overlay = document.getElementById("whatsapp-modal-overlay");
        if (modal) modal.classList.remove("open");
        if (overlay) overlay.style.display = "none";
        this.activeLeadId = null;
        this.activeProposalId = null;
    },

    handleSend(isSimulated) {
        const lead = Store.getLeadById(this.activeLeadId);
        if (!lead) return;

        const textEl = document.getElementById("wa-message-text");
        const messageText = textEl ? textEl.value.trim() : "";
        if (!messageText) {
            alert("Por favor, digite uma mensagem para enviar.");
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        // 1. Gravar interação na linha do tempo do Lead
        const activityDesc = `${isSimulated ? "Simulado: " : ""}Mensagem enviada por WhatsApp: "${messageText.substring(0, 60)}..."`;
        Store.addLeadInteraction(lead.id, {
            type: "WhatsApp",
            description: activityDesc
        }, userEmail);

        // 2. Gravar auditoria
        Audit.logLeadUpdate(userEmail, lead.company, `Mensagem de WhatsApp ${isSimulated ? "simulada" : "real"} enviada para ${lead.contact}.`);

        // 3. Abrir WhatsApp real se não for simulado
        if (!isSimulated) {
            let cleanPhone = (lead.whatsapp || lead.phone || "").replace(/\D/g, "");
            if (cleanPhone.length > 0) {
                if (cleanPhone.length === 11 || cleanPhone.length === 10) {
                    cleanPhone = "55" + cleanPhone;
                }
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
                window.open(waUrl, "_blank");
            } else {
                alert("Telefone inválido ou não cadastrado para este lead. Mas o envio foi simulado localmente!");
            }
        } else {
            alert(`Envio simulado com sucesso! A atividade foi registrada no histórico do lead e você ganhou +5 pontos.`);
        }

        // Fechar modal
        this.closeModal();

        // Recarregar tabelas e visualizações ativas
        const currentHash = window.location.hash.replace("#", "") || "dashboard";
        if (currentHash === "crm") {
            window.CRM?.renderLeadsTable();
            if (window.CRM?.activeLeadId === lead.id) {
                window.CRM?.openLeadDrawer(lead.id);
            }
        } else if (currentHash === "kanban") {
            window.Kanban?.init();
        } else if (currentHash === "proposals") {
            window.Proposals?.renderTable();
        }

        // Disparar evento para atualizar outros componentes (ex: ranking)
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
    }
};

window.WhatsApp = WhatsApp;
