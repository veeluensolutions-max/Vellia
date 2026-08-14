import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const Contracts = {
    _eventsBound: false,

    init() {
        if (!this._eventsBound) {
            this.bindEvents();
            this._eventsBound = true;
        }
        this.checkRenewals();
        this.renderTable();
    },

    bindEvents() {
        const btnNewContract = document.getElementById("btn-new-contract");
        const btnCloseModal = document.getElementById("btn-close-contract-modal");
        const btnCancelContract = document.getElementById("btn-cancel-contract");
        const contractForm = document.getElementById("contract-form");
        const searchInput = document.getElementById("contracts-search");
        const filterStatus = document.getElementById("contracts-filter-status");

        if (btnNewContract) btnNewContract.addEventListener("click", () => this.openModal());
        if (btnCloseModal) btnCloseModal.addEventListener("click", () => this.closeModal());
        if (btnCancelContract) btnCancelContract.addEventListener("click", () => this.closeModal());
        
        if (contractForm) {
            contractForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveContract();
            });
        }

        if (searchInput) searchInput.addEventListener("input", () => this.renderTable());
        if (filterStatus) filterStatus.addEventListener("change", () => this.renderTable());
    },

    checkRenewals() {
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        const contracts = Store.getContracts().filter(c => c.workspace === activeCompany && (c.status === "Ativo" || c.status === "Vencendo"));
        const today = new Date();
        
        contracts.forEach(c => {
            if (c.endDate) {
                const end = new Date(c.endDate);
                const diffTime = end - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Mudar status para 'Vencendo'
                if (diffDays <= c.warningDays && c.status === "Ativo") {
                    Store.updateContract(c.id, { status: "Vencendo" });
                    
                    // Criar tarefa comercial para o vendedor, se não existir
                    const userTasks = Store.getTasks ? Store.getTasks(c.owner) : [];
                    const taskText = `Renovar contrato ${c.number} (vence em ${diffDays} dias)`;
                    
                    if (!userTasks.some(t => t.text === taskText && !t.done)) {
                        userTasks.push({
                            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            workspace: c.workspace,
                            owner: c.owner,
                            text: taskText,
                            date: new Date().toISOString().split("T")[0],
                            priority: "Alta",
                            done: false,
                            assignedBy: "sistema@vellia.com"
                        });
                        if (Store.saveTasks) Store.saveTasks(c.owner, userTasks);
                    }
                }
            }
        });
    },

    openModal(contractId = null) {
        const modal = document.getElementById("modal-contract");
        const form = document.getElementById("contract-form");
        const title = document.getElementById("modal-contract-title");
        const leadSelect = document.getElementById("contract-lead-id");

        if (!modal || !form) return;

        const overlay = document.getElementById("contract-modal-overlay");
        if (overlay) overlay.style.display = "block";
        modal.classList.add("open");

        form.reset();
        document.getElementById("contract-id").value = "";

        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        
        leadSelect.innerHTML = `<option value="">Selecione o Cliente / Lead</option>`;
        leads.filter(l => (l.workspace || "Veeluen Solutions") === activeCompany).forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.id;
            opt.textContent = `${l.company} - ${l.contact}`;
            leadSelect.appendChild(opt);
        });

        if (contractId) {
            title.textContent = "Editar Contrato";
            const contract = Store.getContractById(contractId);
            if (contract) {
                document.getElementById("contract-id").value = contract.id;
                document.getElementById("contract-lead-id").value = contract.leadId;
                document.getElementById("contract-number").value = contract.number;
                document.getElementById("contract-status").value = contract.status;
                document.getElementById("contract-total-value").value = contract.totalValue;
                document.getElementById("contract-recurring-value").value = contract.recurringValue;
                document.getElementById("contract-start-date").value = contract.startDate || "";
                document.getElementById("contract-end-date").value = contract.endDate || "";
                document.getElementById("contract-auto-renew").checked = contract.autoRenew;
                document.getElementById("contract-notes").value = contract.notes || "";
            }
        } else {
            title.textContent = "Novo Contrato";
            document.getElementById("contract-number").value = `CT-${new Date().getFullYear()}-...`;
        }

        modal.style.display = "block";
    },

    closeModal() {
        const modal = document.getElementById("modal-contract");
        const overlay = document.getElementById("contract-modal-overlay");
        if (overlay) overlay.style.display = "none";
        if (modal) modal.classList.remove("open");
    },

    saveContract() {
        const user = Auth.getCurrentUser();
        const id = document.getElementById("contract-id").value;
        const data = {
            leadId: document.getElementById("contract-lead-id").value,
            status: document.getElementById("contract-status").value,
            totalValue: parseFloat(document.getElementById("contract-total-value").value) || 0,
            recurringValue: parseFloat(document.getElementById("contract-recurring-value").value) || 0,
            startDate: document.getElementById("contract-start-date").value,
            endDate: document.getElementById("contract-end-date").value,
            autoRenew: document.getElementById("contract-auto-renew").checked,
            notes: document.getElementById("contract-notes").value
        };

        if (id) {
            Store.updateContract(id, data, user ? user.email : 'sistema@vellia.com');
        } else {
            data.createdBy = user ? user.email : 'sistema@vellia.com';
            data.owner = data.createdBy;
            Store.addContract(data);
        }

        this.closeModal();
        this.renderTable();
    },

    renewContract(contractId) {
        if (!confirm("Deseja iniciar a renovação deste contrato? Um novo contrato será gerado e o atual ficará com status 'Renovado'.")) return;
        
        const c = Store.getContractById(contractId);
        if (!c) return;

        Store.updateContract(c.id, { status: "Renovado" });

        const user = Auth.getCurrentUser();
        let nextStart = "";
        let nextEnd = "";

        if (c.endDate) {
            const dateEnd = new Date(c.endDate);
            dateEnd.setDate(dateEnd.getDate() + 1);
            nextStart = dateEnd.toISOString().split("T")[0];
            dateEnd.setFullYear(dateEnd.getFullYear() + 1);
            nextEnd = dateEnd.toISOString().split("T")[0];
        }

        const newC = Store.addContract({
            leadId: c.leadId,
            proposalId: c.proposalId,
            status: "Em formalização",
            totalValue: c.totalValue,
            recurringValue: c.recurringValue,
            periodicity: c.periodicity,
            startDate: nextStart,
            endDate: nextEnd,
            autoRenew: c.autoRenew,
            warningDays: c.warningDays,
            owner: c.owner,
            createdBy: user ? user.email : "sistema@vellia.com",
            notes: `Renovação originada do contrato ${c.number}`
        });

        // Copiar serviços associados, se existirem
        const oldServices = Store.getServicesForContract(c.id);
        if (oldServices.length > 0) {
            const allServices = Store.getContractServices();
            oldServices.forEach(s => {
                const ns = { ...s, contractId: newC.id };
                allServices.push(ns);
                if (Store.upsert) {
                    Store.upsert("comercial_contract_services", ns);
                }
            });
            localStorage.setItem("comercial_contract_services", JSON.stringify(allServices));
        }

        this.renderTable();
        alert(`O contrato ${newC.number} foi criado e está "Em formalização".`);
        this.openModal(newC.id);
    },

    renderTable() {
        const tbody = document.getElementById("contracts-table-body");
        if (!tbody) return;

        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        let contracts = Store.getContracts().filter(c => c.workspace === activeCompany);
        
        // Calcular KPIs (Receita Recorrente e Valor Total Ativo)
        const activeOrWarning = contracts.filter(c => c.status === "Ativo" || c.status === "Vencendo");
        const countActive = activeOrWarning.length;
        const totalMrr = activeOrWarning.reduce((sum, c) => sum + (c.recurringValue || 0), 0);
        const totalTcv = activeOrWarning.reduce((sum, c) => sum + (c.totalValue || 0), 0);

        const elCount = document.getElementById("contract-stat-active");
        const elMrr = document.getElementById("contract-stat-mrr");
        const elTcv = document.getElementById("contract-stat-tcv");
        
        if (elCount) elCount.textContent = countActive;
        if (elMrr) elMrr.textContent = `R$ ${totalMrr.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if (elTcv) elTcv.textContent = `R$ ${totalTcv.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const searchInput = document.getElementById("contracts-search");
        const filterStatus = document.getElementById("contracts-filter-status");

        const term = searchInput ? searchInput.value.toLowerCase() : "";
        const statusVal = filterStatus ? filterStatus.value : "all";

        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);

        contracts = contracts.filter(c => {
            if (statusVal !== "all" && c.status !== statusVal) return false;
            
            const lead = leads.find(l => l.id === c.leadId);
            const leadName = lead ? `${lead.company} ${lead.contact}`.toLowerCase() : "";
            
            if (term && !c.number.toLowerCase().includes(term) && !leadName.includes(term)) {
                return false;
            }
            return true;
        });

        tbody.innerHTML = "";

        if (contracts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum contrato encontrado.</td></tr>`;
            return;
        }

        contracts.forEach(c => {
            const lead = leads.find(l => l.id === c.leadId);
            const leadDisplay = lead ? `${lead.company}` : 'Desconhecido';
            
            let statusBadge = "badge-gray";
            if (c.status === "Ativo") statusBadge = "badge-green";
            else if (c.status === "Em formalização" || c.status === "Aguardando assinatura") statusBadge = "badge-blue";
            else if (c.status === "Vencendo" || c.status === "Suspenso") statusBadge = "badge-yellow";
            else if (c.status === "Encerrado" || c.status === "Cancelado" || c.status === "Renovado") statusBadge = "badge-red";

            let actionButtons = `
                <button class="btn-icon" onclick="window.Contracts.openModal('${c.id}')" title="Editar Contrato">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            `;
            
            // Mostrar botão de renovar se estiver Ativo ou Vencendo
            if (c.status === "Ativo" || c.status === "Vencendo") {
                actionButtons += `
                <button class="btn-icon" style="color: var(--primary);" onclick="window.Contracts.renewContract('${c.id}')" title="Renovar Contrato">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                `;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600;">${c.number}</td>
                <td>${leadDisplay}</td>
                <td>R$ ${c.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td>R$ ${c.recurringValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td>${c.startDate ? new Date(c.startDate).toLocaleDateString('pt-BR') : '-'} até ${c.endDate ? new Date(c.endDate).toLocaleDateString('pt-BR') : '-'}</td>
                <td><span class="badge ${statusBadge}">${c.status}</span></td>
                <td style="display: flex; gap: 8px;">
                    ${actionButtons}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
};

window.Contracts = Contracts;
