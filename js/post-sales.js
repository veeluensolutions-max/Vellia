import { Store } from "./store.js";
import { formatTimeAgo } from "./utils.js";
import { Auth } from "./auth.js";
import { CRM } from "./crm.js"; // To open the interaction drawer

export const PostSales = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.render();
    },

    cacheDOM() {
        this.tableBody = document.querySelector("#post-sales-table tbody");
        this.searchInput = document.getElementById("post-sales-search");
        this.filterSelect = document.getElementById("post-sales-filter");
        
        this.statTotal = document.getElementById("ps-stat-total");
        this.statActive = document.getElementById("ps-stat-active");
        this.statRisk = document.getElementById("ps-stat-risk");
        this.statInactive = document.getElementById("ps-stat-inactive");
    },

    bindEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener("input", () => this.render());
        }
        if (this.filterSelect) {
            this.filterSelect.addEventListener("change", () => this.render());
        }
    },

    getClosedClients() {
        // Obter todos os leads
        const allLeads = Store.getAllLeadsRaw();
        // Filtrar apenas os que estão no estágio "Cliente Fechado" e não foram deletados
        return allLeads.filter(l => l.stage === "Cliente Fechado" && !l.deleted_at);
    },

    calculateInactivity(lead) {
        let lastInteractionDate = null;
        let daysInactive = 0;

        // Procurar a última interação válida no array interactions
        if (lead.interactions && lead.interactions.length > 0) {
            // Ordenar por data decrescente
            const sortedInteractions = [...lead.interactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            lastInteractionDate = new Date(sortedInteractions[0].timestamp);
        } else if (lead.created_at) {
            // Se não tem interações, usar a data de criação
            lastInteractionDate = new Date(lead.created_at);
        }

        if (lastInteractionDate) {
            const now = new Date();
            const diffTime = Math.abs(now - lastInteractionDate);
            daysInactive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        let relationshipStatus = "Ativo";
        let statusColor = "var(--success)";
        
        if (daysInactive >= 90) {
            relationshipStatus = "Inativo";
            statusColor = "var(--danger)";
        } else if (daysInactive >= 60) {
            relationshipStatus = "Em Risco";
            statusColor = "var(--warning)";
        }

        return {
            daysInactive,
            lastDate: lastInteractionDate,
            status: relationshipStatus,
            color: statusColor
        };
    },

    render() {
        if (!this.tableBody) return;

        const clients = this.getClosedClients();
        const searchTerm = (this.searchInput.value || "").toLowerCase();
        const filterVal = this.filterSelect.value || "all";

        let totalCount = 0;
        let activeCount = 0;
        let riskCount = 0;
        let inactiveCount = 0;

        // Pre-process clients with inactivity data
        const processedClients = clients.map(client => {
            return {
                ...client,
                inactivity: this.calculateInactivity(client)
            };
        });

        // Filter clients based on search and status
        const filteredClients = processedClients.filter(client => {
            const matchesSearch = client.company.toLowerCase().includes(searchTerm) || 
                                  (client.contact && client.contact.toLowerCase().includes(searchTerm));
            
            let matchesFilter = true;
            if (filterVal === "ativo") matchesFilter = client.inactivity.status === "Ativo";
            if (filterVal === "risco") matchesFilter = client.inactivity.status === "Em Risco";
            if (filterVal === "inativo") matchesFilter = client.inactivity.status === "Inativo";

            return matchesSearch && matchesFilter;
        });

        // Calculate stats (based on all clients, not just filtered ones, so dashboard is accurate)
        processedClients.forEach(client => {
            totalCount++;
            if (client.inactivity.status === "Ativo") activeCount++;
            else if (client.inactivity.status === "Em Risco") riskCount++;
            else if (client.inactivity.status === "Inativo") inactiveCount++;
        });

        // Update stats UI
        if (this.statTotal) this.statTotal.textContent = totalCount;
        if (this.statActive) this.statActive.textContent = activeCount;
        if (this.statRisk) this.statRisk.textContent = riskCount;
        if (this.statInactive) this.statInactive.textContent = inactiveCount;

        // Render table
        this.tableBody.innerHTML = "";

        if (filteredClients.length === 0) {
            this.tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum cliente encontrado com os filtros atuais.</td></tr>`;
            return;
        }

        // Sort clients (most inactive first)
        filteredClients.sort((a, b) => b.inactivity.daysInactive - a.inactivity.daysInactive);

        filteredClients.forEach(client => {
            const tr = document.createElement("tr");
            
            const formattedDate = client.inactivity.lastDate 
                ? new Date(client.inactivity.lastDate).toLocaleDateString('pt-BR') 
                : "Desconhecida";

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${client.company}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${client.contact || "-"}</div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div class="avatar" style="width: 24px; height: 24px; font-size: 10px;">${client.owner.substring(0, 2).toUpperCase()}</div>
                        <span style="font-size: 12px;">${client.owner.split('@')[0]}</span>
                    </div>
                </td>
                <td>${formattedDate}</td>
                <td><strong>${client.inactivity.daysInactive}</strong> dias</td>
                <td>
                    <span class="badge" style="background-color: ${client.inactivity.color}20; color: ${client.inactivity.color}; border: 1px solid ${client.inactivity.color};">
                        ${client.inactivity.status}
                    </span>
                </td>
                <td style="text-align: right;">
                    <button class="btn btn-outline btn-sm btn-contact" data-id="${client.id}" style="font-size: 11px; padding: 4px 8px; border-color: var(--primary); color: var(--primary);">
                        Registrar Contato
                    </button>
                </td>
            `;

            this.tableBody.appendChild(tr);
        });

        // Add event listeners to "Registrar Contato" buttons
        document.querySelectorAll('.btn-contact').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leadId = e.currentTarget.getAttribute('data-id');
                // Pular para a view do CRM e abrir os detalhes do lead para interação
                window.location.hash = "#crm";
                setTimeout(() => {
                    CRM.openLeadDrawer(leadId);
                }, 300);
            });
        });
    }
};
