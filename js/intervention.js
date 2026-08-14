import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { formatCurrency, formatTimeAgo } from "./utils.js";

export const Intervention = {
    // Regras de Gatilho
    config: {
        minVal: 5000,
        stalledDays: 7
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        // Verificar as intervenções toda vez que o módulo for inicializado/dashboard carregado
        this.checkInterventions();
    },

    cacheDOM() {
        this.alertCard = document.getElementById("dashboard-intervention-alert");
        this.alertText = document.getElementById("intervention-alert-text");
        this.btnOpenModal = document.getElementById("btn-open-interventions");
        this.modal = document.getElementById("intervention-modal");
        this.btnCloseModal = document.getElementById("btn-close-intervention-modal");
        this.tableBody = document.getElementById("intervention-table-body");
    },

    bindEvents() {
        if (this.btnOpenModal) {
            this.btnOpenModal.addEventListener("click", () => this.openModal());
        }
        if (this.btnCloseModal) {
            this.btnCloseModal.addEventListener("click", () => this.closeModal());
        }
        
        // Fechar ao clicar fora
        window.addEventListener("click", (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    },

    openModal() {
        if (this.modal) {
            this.modal.classList.add("open");
            this.renderTable();
        }
    },

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove("open");
        }
    },

    // Retorna a lista de leads que necessitam de intervenção
    getPendingInterventions() {
        const allLeads = Store.getAllLeadsRaw();
        const allProposals = Store.getAllProposals ? Store.getAllProposals() : [];
        
        const stalledLeads = [];
        const now = new Date();

        allLeads.forEach(lead => {
            if (lead.deleted_at) return;
            
            // Só interessa se estiver em estágio de negociação quente
            if (lead.stage !== "Negociação" && lead.stage !== "Proposta Enviada") return;

            // Checar propostas vinculadas
            const leadProposals = allProposals.filter(p => p.leadId === lead.id && p.status === "Aberta");
            if (leadProposals.length === 0) return;

            // Achar a proposta de maior valor
            const highestProposal = leadProposals.reduce((prev, current) => {
                return (prev.value > current.value) ? prev : current;
            }, {value: 0});

            if (highestProposal.value < this.config.minVal) return; // Não atinge o gatilho de valor

            // Checar tempo de estagnação
            let lastInteractionDate = lead.created_at ? new Date(lead.created_at) : new Date();
            if (lead.interactions && lead.interactions.length > 0) {
                const sortedInteractions = [...lead.interactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                lastInteractionDate = new Date(sortedInteractions[0].timestamp);
            }

            const diffTime = Math.abs(now - lastInteractionDate);
            const daysInactive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysInactive >= this.config.stalledDays) {
                stalledLeads.push({
                    lead,
                    proposal: highestProposal,
                    daysInactive
                });
            }
        });

        return stalledLeads.sort((a, b) => b.proposal.value - a.proposal.value);
    },

    checkInterventions() {
        const currentUser = Auth.getCurrentUser();
        // Apenas diretores/admins veem os alertas
        if (!currentUser || currentUser.role !== "admin") {
            if (this.alertCard) this.alertCard.style.display = "none";
            return;
        }

        const interventions = this.getPendingInterventions();
        
        if (interventions.length > 0 && this.alertCard) {
            this.alertCard.style.display = "flex"; // Exibir banner
            if (this.alertText) {
                this.alertText.innerHTML = `<strong>${interventions.length}</strong> negociação(ões) acima de R$ 5.000 parada(s) há mais de 7 dias.`;
            }
        } else if (this.alertCard) {
            this.alertCard.style.display = "none";
        }
    },

    renderTable() {
        if (!this.tableBody) return;
        this.tableBody.innerHTML = "";
        
        const interventions = this.getPendingInterventions();
        
        if (interventions.length === 0) {
            this.tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhuma intervenção necessária no momento. Excelente trabalho!</td></tr>`;
            this.checkInterventions(); // Para ocultar o banner do dashboard também
            return;
        }

        interventions.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${item.lead.company}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${item.lead.contact || "-"}</div>
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--success);">${formatCurrency(item.proposal.value)}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${item.proposal.service || "Serviço"}</div>
                </td>
                <td>
                    <span style="color: var(--danger); font-weight: 600;">${item.daysInactive} dias</span>
                </td>
                <td>
                    <span style="font-size: 12px;">${item.lead.owner.split('@')[0]}</span>
                </td>
                <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn btn-outline btn-sm btn-cobrar" data-id="${item.lead.id}" style="font-size: 11px; padding: 4px 8px; border-color: var(--warning); color: var(--warning);">
                        Cobrar Resp.
                    </button>
                    <button class="btn btn-primary btn-sm btn-assumir" data-id="${item.lead.id}" style="font-size: 11px; padding: 4px 8px;">
                        Assumir Lead
                    </button>
                </td>
            `;
            this.tableBody.appendChild(tr);
        });

        this.bindTableActions();
    },

    bindTableActions() {
        const currentUser = Auth.getCurrentUser();
        
        document.querySelectorAll('.btn-cobrar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leadId = e.currentTarget.getAttribute('data-id');
                const lead = Store.getLeadById(leadId);
                
                // Dispara uma notificação interna no histórico do lead
                Store.addLeadInteraction(leadId, currentUser.email, {
                    type: "Alerta Interno",
                    description: `DIRETORIA: Lead estagnado. Favor retomar a negociação imediatamente.`
                });
                
                alert(`Cobrança registrada no histórico de ${lead.company}!`);
                this.renderTable();
            });
        });

        document.querySelectorAll('.btn-assumir').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(!confirm("Tem certeza que deseja transferir a posse deste Lead para você (Diretoria)?")) return;
                
                const leadId = e.currentTarget.getAttribute('data-id');
                
                // Atualiza o Owner do Lead
                Store.updateLead(leadId, { owner: currentUser.email }, currentUser.email);
                
                // Registra no histórico
                Store.addLeadInteraction(leadId, currentUser.email, {
                    type: "Transferência",
                    description: `Lead assumido pela Diretoria (${currentUser.email}).`
                });

                alert("Você assumiu a negociação!");
                this.renderTable();
            });
        });
    }
};
