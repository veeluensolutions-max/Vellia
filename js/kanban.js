import { Store } from "./store.js";
import { CRM } from "./crm.js";

let draggedLeadId = null;

export const Kanban = {
    init() {
        this.renderKanban();
    },

    renderKanban() {
        let leads = Store.getLeads();
        
        // Importar Auth se não estiver importado no topo, mas podemos usar localStorage direto para evitar dependência circular se preferirmos,
        // mas Auth provavelmente está acessível. Kanban importa Auth? Não, então vamos pegar direto do localStorage ou adicionar import.
        const session = JSON.parse(localStorage.getItem("comercial_session"));
        if (session && session.role === "seller") {
            leads = leads.filter(l => l.owner === session.email);
        }
        
        // Colunas e IDs
        const columns = {
            "Contato": document.getElementById("cards-Contato"),
            "Lead Gerado": document.getElementById("cards-Lead-Gerado"),
            "Lead Qualificado": document.getElementById("cards-Lead-Qualificado"),
            "Proposta Enviada": document.getElementById("cards-Proposta-Enviada"),
            "Negociação": document.getElementById("cards-Negociacao"),
            "Cliente Fechado": document.getElementById("cards-Cliente-Fechado"),
            "Cliente Perdido": document.getElementById("cards-Cliente-Perdido")
        };

        const counters = {
            "Contato": document.getElementById("count-Contato"),
            "Lead Gerado": document.getElementById("count-Lead-Gerado"),
            "Lead Qualificado": document.getElementById("count-Lead-Qualificado"),
            "Proposta Enviada": document.getElementById("count-Proposta-Enviada"),
            "Negociação": document.getElementById("count-Negociacao"),
            "Cliente Fechado": document.getElementById("count-Cliente-Fechado"),
            "Cliente Perdido": document.getElementById("count-Cliente-Perdido")
        };

        // Limpar colunas e contadores
        Object.keys(columns).forEach(stage => {
            if (columns[stage]) columns[stage].innerHTML = "";
            if (counters[stage]) counters[stage].textContent = "0";
        });

        // Contadores locais
        const stageCounts = {
            "Contato": 0,
            "Lead Gerado": 0,
            "Lead Qualificado": 0,
            "Proposta Enviada": 0,
            "Negociação": 0,
            "Cliente Fechado": 0,
            "Cliente Perdido": 0
        };

        // Renderizar cada Lead
        leads.forEach(lead => {
            const container = columns[lead.stage];
            if (!container) return;

            // Incrementar contagem
            stageCounts[lead.stage]++;

            // Calcular dias sem contato
            let daysNoContact = 0;
            if (lead.interactions && lead.interactions.length > 0) {
                const sortedInts = [...lead.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                const diffTime = Math.abs(new Date() - new Date(sortedInts[0].timestamp));
                daysNoContact = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } else if (lead.stageHistory && lead.stageHistory.length > 0) {
                const sortedHist = [...lead.stageHistory].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                const diffTime = Math.abs(new Date() - new Date(sortedHist[0].timestamp));
                daysNoContact = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }

            const card = document.createElement("div");
            card.className = "kanban-card";
            card.setAttribute("draggable", "true");
            card.setAttribute("data-id", lead.id);

            // Ícone e estilo para dias sem contato
            let timeColor = "var(--text-muted)";
            if (daysNoContact >= 7 && lead.stage !== "Cliente Fechado" && lead.stage !== "Cliente Perdido") {
                timeColor = "var(--danger)";
            } else if (daysNoContact >= 3 && lead.stage !== "Cliente Fechado" && lead.stage !== "Cliente Perdido") {
                timeColor = "var(--warning)";
            }

            const leadProps = Store.getProposals().filter(p => p.leadId === lead.id && p.status !== "Perdido");
            const leadValue = leadProps.reduce((s, p) => s + (p.value || 0), 0);
            
            const users = Store.getUsers();
            const ownerUser = users.find(u => u.email === lead.owner);
            const avatar = ownerUser ? ownerUser.avatar : "U";
            const ownerName = ownerUser ? ownerUser.name : "Indefinido";

            // Prioridade dinâmica baseada no valor ou segmento
            let priority = "Baixa";
            let priorityClass = "badge-info"; 
            if (leadValue > 15000 || lead.segment === "Tecnologia") {
                priority = "Alta";
                priorityClass = "badge-danger";
            } else if (leadValue > 5000 || lead.segment === "Construção Civil") {
                priority = "Média";
                priorityClass = "badge-warning";
            }

            const fmtVal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(leadValue);

            card.innerHTML = `
                <div class="kanban-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <span class="badge ${priorityClass}" style="font-size: 9px; padding: 2px 6px; border-radius: 99px;">${priority}</span>
                    <div class="user-avatar" style="width: 22px; height: 22px; font-size: 9px; font-weight: 700; margin-left: auto;" title="Responsável: ${ownerName}">
                        ${avatar}
                    </div>
                </div>
                <div class="kanban-card-company">${lead.company}</div>
                <div class="kanban-card-contact">${lead.contact} • <span style="font-size:11px; color:var(--text-muted);">${lead.role || 'Sem cargo'}</span></div>
                
                ${leadValue > 0 ? `
                <div class="kanban-card-value" style="font-size: 13px; font-weight: 800; color: var(--success); margin: 4px 0 2px 0;">
                    ${fmtVal}
                </div>
                ` : ""}
                
                <div class="kanban-card-details" style="margin-top: 4px;">
                    <span class="kanban-card-tag">${lead.segment}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="kanban-card-time" style="color: ${timeColor}; font-weight: 500;">
                            🕒 ${daysNoContact === 0 ? 'Hoje' : `${daysNoContact}d`}
                        </span>
                        <button class="kanban-card-wa-btn" data-id="${lead.id}" onclick="event.stopPropagation(); window.WhatsApp?.openModalForLead('${lead.id}')" style="background: none; border: none; cursor: pointer; color: #25d366; display: flex; align-items: center; justify-content: center; padding: 2px;" title="Enviar WhatsApp">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </button>
                    </div>
                </div>
            `;

            // Clique para detalhes
            card.addEventListener("click", () => {
                CRM.openLeadDrawer(lead.id);
            });

            // Eventos de arrastar
            card.addEventListener("dragstart", (e) => this.handleDragStart(e, lead.id));
            card.addEventListener("dragend", (e) => this.handleDragEnd(e));

            container.appendChild(card);
        });

        // Atualizar contadores no topo das colunas
        Object.keys(counters).forEach(stage => {
            if (counters[stage]) {
                counters[stage].textContent = stageCounts[stage];
            }
        });

        // Configurar zonas de Drop (containers de cards de cada coluna)
        Object.keys(columns).forEach(stage => {
            const container = columns[stage];
            if (!container) return;

            container.addEventListener("dragover", (e) => this.handleDragOver(e));
            container.addEventListener("dragenter", (e) => this.handleDragEnter(e, container));
            container.addEventListener("dragleave", (e) => this.handleDragLeave(e, container));
            container.addEventListener("drop", (e) => this.handleDrop(e, stage, container));
        });
    },

    // ==========================================================================
    // TRATADORES DE EVENTO DRAG & DROP
    // ==========================================================================

    handleDragStart(e, leadId) {
        draggedLeadId = leadId;
        e.dataTransfer.setData("text/plain", leadId);
        e.currentTarget.classList.add("dragging");
    },

    handleDragEnd(e) {
        e.currentTarget.classList.remove("dragging");
        // Remover classe de drop em todas as colunas
        document.querySelectorAll(".kanban-col-cards").forEach(col => {
            col.classList.remove("drag-over");
        });
        draggedLeadId = null;
    },

    handleDragOver(e) {
        e.preventDefault(); // Necessário para permitir Drop
    },

    handleDragEnter(e, container) {
        e.preventDefault();
        container.classList.add("drag-over");
    },

    handleDragLeave(e, container) {
        // Verificar se está realmente saindo do container e não de um filho (card)
        if (!container.contains(e.relatedTarget)) {
            container.classList.remove("drag-over");
        }
    },

    handleDrop(e, targetStage, container) {
        e.preventDefault();
        container.classList.remove("drag-over");
        
        const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
        if (!leadId) return;

        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        // Se o estágio for o mesmo, não faz nada
        if (lead.stage === targetStage) return;

        // Registrar listener único para recarregar Kanban quando a mudança ocorrer
        const onStageChanged = () => {
            this.renderKanban();
            window.removeEventListener("vellia:stageChanged", onStageChanged);
            window.removeEventListener("vellia:stageCancelled", onStageChanged);
        };

        window.addEventListener("vellia:stageChanged", onStageChanged, { once: true });
        window.addEventListener("vellia:stageCancelled", onStageChanged, { once: true });

        // Chamar fluxo de transição com justificativa do CRM
        CRM.triggerStageChange(leadId, targetStage);
    }
};
