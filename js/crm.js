import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

let activeLeadId = null;
let pendingStageChange = null;

export const CRM = {
    init() {
        this.bindEvents();
        this.renderLeadsTable();
    },

    bindEvents() {
        const elements = {
            btnNewLead: document.getElementById("btn-new-lead"),
            btnCloseLeadModal: document.getElementById("btn-close-lead-modal"),
            btnCancelLead: document.getElementById("btn-cancel-lead"),
            newLeadForm: document.getElementById("new-lead-form"),
            crmSearch: document.getElementById("crm-search"),
            crmFilterStage: document.getElementById("crm-filter-stage"),
            btnCloseDrawer: document.getElementById("btn-close-drawer"),
            drawerOverlay: document.getElementById("drawer-overlay"),
            modalOverlay: document.getElementById("modal-overlay"),
            drawerInteractionForm: document.getElementById("drawer-interaction-form"),
            drawerChangeStage: document.getElementById("drawer-change-stage"),
            stageReasonForm: document.getElementById("stage-reason-form"),
            btnCancelStageReason: document.getElementById("btn-cancel-stage-reason")
        };

        // Modal Novo Lead
        if (elements.btnNewLead) elements.btnNewLead.addEventListener("click", () => this.openNewLeadModal());
        if (elements.btnCloseLeadModal) elements.btnCloseLeadModal.addEventListener("click", () => this.closeNewLeadModal());
        if (elements.btnCancelLead) elements.btnCancelLead.addEventListener("click", () => this.closeNewLeadModal());
        if (elements.newLeadForm) {
            elements.newLeadForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveNewLead();
            });
        }

        // Filtros e Busca
        if (elements.crmSearch) elements.crmSearch.addEventListener("input", () => this.renderLeadsTable());
        if (elements.crmFilterStage) elements.crmFilterStage.addEventListener("change", () => this.renderLeadsTable());

        // Drawer Detalhes
        if (elements.btnCloseDrawer) elements.btnCloseDrawer.addEventListener("click", () => this.closeLeadDrawer());
        if (elements.drawerOverlay) elements.drawerOverlay.addEventListener("click", () => this.closeLeadDrawer());

        // Submissão de Interações
        if (elements.drawerInteractionForm) {
            elements.drawerInteractionForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.submitInteraction();
            });
        }

        // Alteração de Estágio Comercial
        if (elements.drawerChangeStage) {
            elements.drawerChangeStage.addEventListener("change", (e) => {
                this.handleStageChangeRequest(e.target.value);
            });
        }

        // Modal Justificativa de Estágio
        if (elements.stageReasonForm) {
            elements.stageReasonForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.confirmStageChange();
            });
        }
        if (elements.btnCancelStageReason) {
            elements.btnCancelStageReason.addEventListener("click", () => this.cancelStageChangeRequest());
        }
    },

    // ==========================================================================
    // RENDERIZAR TABELA DE LEADS
    // ==========================================================================
    
    renderLeadsTable() {
        const tableBody = document.getElementById("crm-table-body");
        if (!tableBody) return;

        const leads = Store.getLeads();
        const searchQuery = document.getElementById("crm-search")?.value.toLowerCase().trim() || "";
        const stageFilter = document.getElementById("crm-filter-stage")?.value || "all";

        // Filtro de leads
        const filteredLeads = leads.filter(lead => {
            const matchesSearch = 
                lead.company.toLowerCase().includes(searchQuery) ||
                lead.contact.toLowerCase().includes(searchQuery) ||
                lead.segment.toLowerCase().includes(searchQuery) ||
                lead.email.toLowerCase().includes(searchQuery);

            const matchesStage = stageFilter === "all" || lead.stage === stageFilter;

            return matchesSearch && matchesStage;
        });

        if (filteredLeads.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        Nenhum lead ou contato encontrado para a pesquisa.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredLeads.map(lead => {
            let stageBadgeClass = "badge-info";
            if (lead.stage === "Cliente Fechado") stageBadgeClass = "badge-success";
            else if (lead.stage === "Cliente Perdido") stageBadgeClass = "badge-danger";
            else if (lead.stage === "Negociação" || lead.stage === "Proposta Enviada") stageBadgeClass = "badge-warning";

            // Formatar último contato
            let lastContact = "Nenhuma interação registrada";
            if (lead.interactions && lead.interactions.length > 0) {
                // Ordenar por data mais recente
                const sortedInts = [...lead.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                const latest = sortedInts[0];
                lastContact = `${latest.type} em ${new Date(latest.timestamp).toLocaleDateString("pt-BR")}`;
            }

            return `
                <tr class="clickable-row" data-id="${lead.id}">
                    <td><strong>${lead.company}</strong></td>
                    <td>
                        <div style="font-weight: 600;">${lead.contact}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${lead.role || 'Sem cargo'}</div>
                    </td>
                    <td>
                        <div style="font-size: 13px;">${lead.email || 'N/D'}</div>
                        <div style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">${lead.whatsapp || lead.phone || 'N/D'}</div>
                    </td>
                    <td>
                        <span style="font-size: 13px;">${lead.segment}</span>
                        <div style="font-size: 11px; color: var(--text-muted);">Canal: ${lead.source}</div>
                    </td>
                    <td>
                        <span class="badge ${stageBadgeClass}">${lead.stage}</span>
                    </td>
                    <td style="text-align: right;" onclick="event.stopPropagation();">
                        <button class="btn btn-outline btn-view-lead" data-id="${lead.id}" style="padding: 6px 10px; font-size: 12px;">
                            Ver Detalhes
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Adicionar eventos de clique para linha e botão de detalhes
        tableBody.querySelectorAll("tr").forEach(row => {
            row.addEventListener("click", () => {
                const id = row.getAttribute("data-id");
                this.openLeadDrawer(id);
            });
        });

        tableBody.querySelectorAll(".btn-view-lead").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                this.openLeadDrawer(id);
            });
        });
    },

    // ==========================================================================
    // CONTROLE DE DRAWERS (DETALHES DO LEAD)
    // ==========================================================================
    
    openLeadDrawer(id) {
        const lead = Store.getLeadById(id);
        if (!lead) return;

        activeLeadId = id;

        // Atualizar campos do Drawer
        document.getElementById("drawer-lead-company").textContent = lead.company;
        document.getElementById("drawer-lead-contact").textContent = lead.contact;
        document.getElementById("drawer-lead-role").textContent = lead.role || "Não preenchido";
        document.getElementById("drawer-lead-email").textContent = lead.email || "Não informado";
        document.getElementById("drawer-lead-whatsapp").textContent = lead.whatsapp || "Não informado";
        document.getElementById("drawer-lead-location").textContent = `${lead.city || "-"} / ${lead.state || "-"}`;
        document.getElementById("drawer-lead-source").textContent = `${lead.segment} (${lead.source})`;

        // Configurar select de estágios
        const stageSelect = document.getElementById("drawer-change-stage");
        if (stageSelect) {
            stageSelect.value = lead.stage;
        }

        // Renderizar Linha do Tempo
        this.renderTimeline(lead);

        // Exibir Drawer e Overlay
        document.getElementById("lead-drawer").classList.add("open");
        document.getElementById("drawer-overlay").style.display = "block";
    },

    closeLeadDrawer() {
        activeLeadId = null;
        document.getElementById("lead-drawer").classList.remove("open");
        document.getElementById("drawer-overlay").style.display = "none";
        this.renderLeadsTable(); // Atualizar tabela por segurança
    },

    // ==========================================================================
    // LINHA DO TEMPO (TIMELINE DE ATIVIDADES)
    // ==========================================================================
    
    renderTimeline(lead) {
        const timelineContainer = document.getElementById("drawer-timeline");
        if (!timelineContainer) return;

        // Mesclar interações e histórico de estágios em um único fluxo cronológico
        const timelineItems = [];

        // Adicionar interações
        if (lead.interactions) {
            lead.interactions.forEach(int => {
                timelineItems.push({
                    type: "interaction",
                    intType: int.type,
                    title: `Registro de ${int.type}`,
                    description: int.description,
                    timestamp: new Date(int.timestamp),
                    user: int.userEmail
                });
            });
        }

        // Adicionar histórico de etapas
        if (lead.stageHistory) {
            lead.stageHistory.forEach(hist => {
                timelineItems.push({
                    type: "stage-change",
                    title: `Estágio alterado para: ${hist.stage}`,
                    description: hist.reason || "Sem observações.",
                    timestamp: new Date(hist.timestamp),
                    user: hist.userEmail
                });
            });
        }

        // Ordenar do mais novo para o mais antigo (Decrescente)
        timelineItems.sort((a, b) => b.timestamp - a.timestamp);

        if (timelineItems.length === 0) {
            timelineContainer.innerHTML = `
                <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">
                    Nenhuma atividade registrada na linha do tempo.
                </div>
            `;
            return;
        }

        timelineContainer.innerHTML = timelineItems.map(item => {
            const formattedDate = item.timestamp.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

            const markerClass = item.type === "stage-change" 
                ? "stage-change" 
                : `interaction-${item.intType.replace(" ", "-")}`;

            return `
                <div class="timeline-item ${markerClass}">
                    <div class="timeline-marker"></div>
                    <div class="timeline-card">
                        <div class="timeline-header">
                            <span class="timeline-author">${item.user}</span>
                            <span>${formattedDate}</span>
                        </div>
                        <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-primary); font-size: 12px;">
                            ${item.title}
                        </div>
                        <div class="timeline-body">${item.description}</div>
                    </div>
                </div>
            `;
        }).join("");
    },

    // ==========================================================================
    // REGISTRAR INTERAÇÃO
    // ==========================================================================
    
    submitInteraction() {
        const typeEl = document.getElementById("interaction-type");
        const descEl = document.getElementById("interaction-desc");
        
        if (!typeEl || !descEl || !activeLeadId) return;

        const type = typeEl.value;
        const description = descEl.value.trim();

        if (!description) return;

        const currentUser = Auth.getCurrentUser();
        const lead = Store.getLeadById(activeLeadId);
        
        if (!currentUser || !lead) return;

        // Registrar
        Store.addLeadInteraction(activeLeadId, currentUser.email, { type, description });
        
        // Log de Auditoria
        Audit.logStageChange(currentUser.email, lead.company, lead.stage, lead.stage, `Registrou nova interação: ${type} - ${description.substring(0, 30)}...`);

        // Limpar campo e recarregar timeline
        descEl.value = "";
        
        const updatedLead = Store.getLeadById(activeLeadId);
        this.renderTimeline(updatedLead);
    },

    triggerStageChange(leadId, newStage) {
        activeLeadId = leadId;
        this.handleStageChangeRequest(newStage);
    },

    handleStageChangeRequest(newStage) {
        if (!activeLeadId) return;

        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        // Se o estágio for igual ao atual, ignore
        if (lead.stage === newStage) return;

        // Armazenar temporariamente para confirmação
        pendingStageChange = newStage;

        // Abrir Modal de Justificativa
        document.getElementById("stage-reason-target-name").textContent = newStage;
        document.getElementById("stage-reason-text").value = "";
        
        document.getElementById("stage-reason-modal").classList.add("open");
        document.getElementById("modal-overlay").style.display = "block";
    },

    confirmStageChange() {
        const reasonEl = document.getElementById("stage-reason-text");
        if (!reasonEl || !activeLeadId || !pendingStageChange) return;

        const reason = reasonEl.value.trim();
        if (!reason) return;

        const lead = Store.getLeadById(activeLeadId);
        const currentUser = Auth.getCurrentUser();

        if (!lead || !currentUser) return;

        const oldStage = lead.stage;

        // Efetivar mudança no banco
        Store.updateLeadStage(activeLeadId, pendingStageChange, currentUser.email, reason);

        // Registrar no log de auditoria operacional
        Audit.logStageChange(currentUser.email, lead.company, oldStage, pendingStageChange, reason);

        // Se for Cliente Fechado ou Perdido, gerar logs específicos adicionais
        if (pendingStageChange === "Cliente Fechado") {
            Audit.logSaleWon(currentUser.email, lead.company, "Sob Consulta (Ver Propostas)");
        } else if (pendingStageChange === "Cliente Perdido") {
            Audit.logSaleLost(currentUser.email, lead.company, reason);
        }

        // Fechar modal de justificativa
        this.closeStageReasonModal();

        // Recarregar drawer e tabelas
        const updatedLead = Store.getLeadById(activeLeadId);
        
        // Atualizar dropdown do drawer
        const stageSelect = document.getElementById("drawer-change-stage");
        if (stageSelect) stageSelect.value = updatedLead.stage;

        this.renderTimeline(updatedLead);
        this.renderLeadsTable();

        // Limpar variáveis
        pendingStageChange = null;

        // Notificar outros módulos (ex: Kanban) que o estágio foi alterado
        window.dispatchEvent(new CustomEvent("vellia:stageChanged"));
    },

    cancelStageChangeRequest() {
        // Reverter select do drawer para o estágio original do lead
        if (activeLeadId) {
            const lead = Store.getLeadById(activeLeadId);
            const stageSelect = document.getElementById("drawer-change-stage");
            if (lead && stageSelect) stageSelect.value = lead.stage;
        }
        this.closeStageReasonModal();
        // Notificar o Kanban que a mudança foi cancelada
        window.dispatchEvent(new CustomEvent("vellia:stageCancelled"));
    },

    closeStageReasonModal() {
        document.getElementById("stage-reason-modal").classList.remove("open");
        // Fechar overlay se o modal do lead também não estiver aberto (o do lead usa drawer-overlay, o modal usa modal-overlay)
        document.getElementById("modal-overlay").style.display = "none";
        pendingStageChange = null;
    },

    // ==========================================================================
    // MODAL DE CADASTRO DE NOVO LEAD
    // ==========================================================================
    
    openNewLeadModal() {
        document.getElementById("new-lead-form").reset();
        document.getElementById("new-lead-modal").classList.add("open");
        document.getElementById("modal-overlay").style.display = "block";
    },

    closeNewLeadModal() {
        document.getElementById("new-lead-modal").classList.remove("open");
        document.getElementById("modal-overlay").style.display = "none";
    },

    saveNewLead() {
        if (this.isSaving) return;
        this.isSaving = true;

        const getVal = (id) => document.getElementById(id)?.value.trim() || "";

        const company = getVal("lead-company");
        const contact = getVal("lead-contact");
        const role = getVal("lead-role");
        const email = getVal("lead-email");
        const phone = getVal("lead-phone");
        const whatsapp = getVal("lead-whatsapp");
        const city = getVal("lead-city");
        const state = getVal("lead-state");
        const segment = getVal("lead-segment");
        const source = getVal("lead-source");
        const stage = getVal("lead-stage-init");

        if (!company || !contact || !whatsapp) {
            alert("Por favor, preencha todos os campos obrigatórios (*).");
            this.isSaving = false;
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        // Salvar lead
        const newLead = Store.addLead({
            company,
            contact,
            role,
            email,
            phone,
            whatsapp,
            city,
            state,
            segment,
            source,
            stage,
            userEmail,
            stageHistory: [
                {
                    stage,
                    userEmail,
                    timestamp: new Date().toISOString(),
                    reason: `Cadastro inicial do lead via formulário.`
                }
            ]
        });

        // Registrar na auditoria
        Audit.logStageChange(userEmail, company, "Nenhum (Novo)", stage, "Cadastro de lead no sistema.");

        // Fechar e recarregar
        this.closeNewLeadModal();
        this.renderLeadsTable();
        
        // Atualizar contadores
        const dashboardView = document.getElementById("view-dashboard");
        if (dashboardView && dashboardView.style.display !== "none") {
            window.dispatchEvent(new HashChangeEvent("hashchange")); // Força atualização se estiver na tela do dashboard
        }

        this.isSaving = false;
    }
};
