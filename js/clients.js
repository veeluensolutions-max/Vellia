/**
 * Vellia CRM - Módulo de Gestão de Clientes & Histórico Comercial (Estilo GestãoClick)
 * Permite visualizar a carteira completa de clientes, dados cadastrais, CNPJ/CPF
 * e histórico consolidado 360º de todos os orçamentos e propostas emitidas.
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";
import { CNPJService } from "./cnpj-service.js";

export const Clients = {
    _eventsBound: false,
    _currentFilterStatus: "all",
    _currentSearchQuery: "",
    _currentSellerFilter: "all",
    _activeClientDetailId: null,

    init() {
        this.closeHistoryModal();
        this.closeClientModal();
        this.renderStats();
        this.renderTable();
        this.populateSellerFilter();

        if (!this._eventsBound) {
            this.bindEvents();
            this._eventsBound = true;
        }
    },

    bindEvents() {
        // Busca em tempo real
        const searchInput = document.getElementById("clients-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this._currentSearchQuery = e.target.value.toLowerCase().trim();
                this.renderTable();
            });
        }

        // Filtro por Situação
        const statusFilter = document.getElementById("clients-status-filter");
        if (statusFilter) {
            statusFilter.addEventListener("change", (e) => {
                this._currentFilterStatus = e.target.value;
                this.renderTable();
            });
        }

        // Filtro por Vendedor
        const sellerFilter = document.getElementById("clients-seller-filter");
        if (sellerFilter) {
            sellerFilter.addEventListener("change", (e) => {
                this._currentSellerFilter = e.target.value;
                this.renderTable();
            });
        }

        // Botão Novo Cliente
        const btnNewClient = document.getElementById("btn-new-client");
        if (btnNewClient) {
            btnNewClient.addEventListener("click", () => this.openClientModal());
        }

        // Botão Exportar Excel
        const btnExportClients = document.getElementById("btn-export-clients");
        if (btnExportClients) {
            btnExportClients.addEventListener("click", () => this.exportToCSV());
        }

        // Auto-busca CNPJ no modal de cliente
        const btnCnpjSearch = document.getElementById("btn-client-cnpj-search");
        const cnpjInput = document.getElementById("client-form-cnpj");
        if (btnCnpjSearch && cnpjInput) {
            btnCnpjSearch.addEventListener("click", () => this.lookupCNPJ(cnpjInput.value));
            cnpjInput.addEventListener("blur", () => {
                if (cnpjInput.value && CNPJService.cleanDigits(cnpjInput.value).length === 14) {
                    this.lookupCNPJ(cnpjInput.value);
                }
            });
            cnpjInput.addEventListener("input", (e) => {
                e.target.value = CNPJService.formatCNPJ(e.target.value);
            });
        }

        // Submissão do formulário de cliente
        const clientForm = document.getElementById("client-form");
        if (clientForm) {
            clientForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveClient();
            });
        }

        // Eventos reativos do sistema para sincronização automática
        const refreshHandler = () => {
            const clientsView = document.getElementById("view-clients");
            if (clientsView && clientsView.style.display !== "none") {
                this.renderStats();
                this.renderTable();
                if (this._activeClientDetailId) {
                    this.renderHistoryModalContent(this._activeClientDetailId);
                }
            }
        };

        window.addEventListener("vellia:leadAdded", refreshHandler);
        window.addEventListener("vellia:leadUpdated", refreshHandler);
        window.addEventListener("vellia:proposalUpdated", refreshHandler);
        window.addEventListener("storage", refreshHandler);
    },

    /**
     * Retorna a lista unificada de clientes enriquecida com o histórico comercial
     */
    getClientsList() {
        const leads = Store.getLeads() || [];
        const proposals = Store.getProposals() || [];

        return leads.map(lead => {
            // Vincula propostas pelo leadId OU pelo nome exato da empresa
            const clientProposals = proposals.filter(p => {
                if (p.leadId && String(p.leadId) === String(lead.id)) return true;
                if (p.company && lead.company && p.company.trim().toLowerCase() === lead.company.trim().toLowerCase()) return true;
                return false;
            });

            // Ordena propostas da mais recente para a mais antiga
            clientProposals.sort((a, b) => new Date(b.createdAt || b.sentAt || 0) - new Date(a.createdAt || a.sentAt || 0));

            const totalProposals = clientProposals.length;
            const totalValue = clientProposals.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);
            
            const wonProposals = clientProposals.filter(p => {
                const st = (p.status || "").toLowerCase();
                return st === "ganho" || st === "ganha" || st === "aprovada" || st === "aprovado" || st === "fechado";
            });
            const wonValue = wonProposals.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);

            const pendingProposals = clientProposals.filter(p => {
                const st = (p.status || "").toLowerCase();
                return st === "enviada" || st === "em_analise" || st === "negociacao" || st === "aberta" || st === "rascunho";
            });

            // Determina a situação comercial do cliente
            let situacao = "Novo";
            let situacaoClass = "badge-novo";

            if (wonProposals.length > 0) {
                situacao = "Ativo (Cliente)";
                situacaoClass = "badge-ativo";
            } else if (pendingProposals.length > 0) {
                situacao = "Em Negociação";
                situacaoClass = "badge-negociacao";
            } else if (totalProposals > 0) {
                situacao = "Proposta Recusada";
                situacaoClass = "badge-recusada";
            }

            return {
                id: lead.id,
                company: lead.company || "Sem Razão Social",
                tradeName: lead.tradeName || "",
                contact: lead.contact || "Responsável não informado",
                role: lead.role || "",
                cnpj: lead.cnpj || lead.document || "",
                phone: lead.phone || lead.whatsapp || "",
                whatsapp: lead.whatsapp || lead.phone || "",
                email: lead.email || "",
                city: lead.city || "",
                state: lead.state || "",
                segment: lead.segment || "Geral",
                stage: lead.stage || "lead",
                owner: lead.owner || "Não atribuído",
                createdAt: lead.createdAt || lead.dateAdded || new Date().toISOString(),
                situacao,
                situacaoClass,
                proposals: clientProposals,
                totalProposals,
                totalValue,
                wonProposalsCount: wonProposals.length,
                wonValue,
                pendingCount: pendingProposals.length
            };
        });
    },

    /**
     * Renderiza os cards de KPI no topo da visão de Clientes
     */
    renderStats() {
        const clients = this.getClientsList();
        const totalClients = clients.length;
        const activeClients = clients.filter(c => c.wonProposalsCount > 0).length;
        const totalProposalsCount = clients.reduce((sum, c) => sum + c.totalProposals, 0);
        const totalWonValue = clients.reduce((sum, c) => sum + c.wonValue, 0);
        const totalInNegotiation = clients.reduce((sum, c) => sum + (c.totalValue - c.wonValue), 0);

        const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        const elTotal = document.getElementById("stat-total-clients");
        const elActive = document.getElementById("stat-active-clients");
        const elProposals = document.getElementById("stat-total-client-proposals");
        const elWon = document.getElementById("stat-total-won-value");

        if (elTotal) elTotal.textContent = totalClients;
        if (elActive) elActive.textContent = `${activeClients} (${totalClients ? Math.round((activeClients / totalClients) * 100) : 0}%)`;
        if (elProposals) elProposals.textContent = totalProposalsCount;
        if (elWon) elWon.textContent = fmt(totalWonValue);
    },

    /**
     * Preenche o filtro de vendedores com os responsáveis da carteira
     */
    populateSellerFilter() {
        const filter = document.getElementById("clients-seller-filter");
        if (!filter) return;

        const users = Store.getUsers() || [];
        const sellers = users.filter(u => {
            const role = (u.role || "").toLowerCase();
            return role === "seller" || role === "vendedor";
        });

        filter.innerHTML = `
            <option value="all">Todos os Vendedores</option>
            ${sellers.map(s => `<option value="${s.email}">${s.name}</option>`).join("")}
        `;
    },

    /**
     * Renderiza a tabela de clientes estilo GestãoClick
     */
    renderTable() {
        const tbody = document.getElementById("clients-table-body");
        const counterEl = document.getElementById("clients-count-badge");
        if (!tbody) return;

        let clients = this.getClientsList();

        // Filtro por Busca
        if (this._currentSearchQuery) {
            const q = this._currentSearchQuery;
            clients = clients.filter(c => 
                c.company.toLowerCase().includes(q) ||
                (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
                (c.cnpj && c.cnpj.toLowerCase().includes(q)) ||
                (c.contact && c.contact.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q))
            );
        }

        // Filtro por Situação
        if (this._currentFilterStatus !== "all") {
            if (this._currentFilterStatus === "ativo") {
                clients = clients.filter(c => c.wonProposalsCount > 0);
            } else if (this._currentFilterStatus === "negociacao") {
                clients = clients.filter(c => c.pendingCount > 0);
            } else if (this._currentFilterStatus === "novo") {
                clients = clients.filter(c => c.totalProposals === 0);
            }
        }

        // Filtro por Vendedor
        if (this._currentSellerFilter !== "all") {
            clients = clients.filter(c => c.owner === this._currentSellerFilter);
        }

        if (counterEl) {
            counterEl.textContent = `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`;
        }

        if (clients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
                        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                        <div style="font-weight: 700; font-size: 15px; color: var(--text-primary); margin-bottom: 4px;">Nenhum cliente encontrado</div>
                        <p style="font-size: 13px; margin: 0 0 16px;">Tente alterar os filtros de busca ou cadastre um novo cliente.</p>
                        <button type="button" class="btn btn-primary" onclick="window.Clients.openClientModal()" style="font-size: 12px; padding: 8px 16px;">
                            + Adicionar Primeiro Cliente
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        tbody.innerHTML = clients.map(client => {
            const docFormatted = client.cnpj ? CNPJService.formatCNPJ(client.cnpj) : '<span style="color:var(--text-muted); font-size:12px;">Não informado</span>';
            const phoneFormatted = client.phone || '<span style="color:var(--text-muted); font-size:12px;">-</span>';
            const cleanPhone = (client.whatsapp || client.phone || "").replace(/\D/g, "");

            // Badge de propostas
            let propBadge = '';
            if (client.totalProposals === 0) {
                propBadge = `<span class="client-prop-pill client-prop-zero" onclick="window.Clients.openNewProposalForClient('${client.id}')" title="Clique para gerar orçamento">+ Criar Orçamento</span>`;
            } else {
                propBadge = `
                    <div class="client-prop-summary" onclick="window.Clients.openClientHistory('${client.id}')" title="Ver histórico completo de orçamentos">
                        <span class="client-prop-pill client-prop-has">
                            📄 ${client.totalProposals} ${client.totalProposals === 1 ? 'proposta' : 'propostas'}
                        </span>
                        <span class="client-prop-val">${fmt(client.totalValue)}</span>
                    </div>
                `;
            }

            return `
                <tr class="client-row" data-id="${client.id}">
                    <td class="client-cell-name">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="client-avatar">
                                ${client.company.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <a href="javascript:void(0)" onclick="window.Clients.openClientHistory('${client.id}')" class="client-name-link">
                                    ${client.company}
                                </a>
                                <div class="client-subtext">
                                    ${client.contact}${client.role ? ` • ${client.role}` : ''}
                                    ${client.city ? ` • ${client.city}/${client.state}` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="client-cell-doc">
                        <div class="client-doc-box">
                            <span>${docFormatted}</span>
                        </div>
                    </td>
                    <td class="client-cell-status">
                        <span class="client-status-badge ${client.situacaoClass}">
                            ${client.situacao}
                        </span>
                    </td>
                    <td class="client-cell-phone">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span>${phoneFormatted}</span>
                            ${cleanPhone ? `
                                <a href="https://wa.me/55${cleanPhone}" target="_blank" class="client-btn-wa" title="Conversar no WhatsApp">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.133-.521-1.615-.668-2.651-2.316-2.731-2.424-.08-.108-.655-.873-.655-1.664 0-.791.411-1.181.558-1.341.144-.16.315-.2.42-.2.106 0 .211.002.304.006.098.005.228-.037.357.273.134.321.458 1.119.498 1.201.04.081.066.178.013.285-.054.108-.081.175-.162.271-.081.096-.17.214-.243.288-.081.082-.165.171-.071.333.095.161.42 692.902 1.12 1.487 1.326.541.229.863.303 1.025.343.162.04.257-.038.351-.148.095-.108.405-.472.513-.634.108-.162.216-.135.364-.081.148.054.945.446 1.107.527.162.081.27.121.311.189.04.068.04.391-.104.796z"/></svg>
                                </a>
                            ` : ''}
                        </div>
                    </td>
                    <td class="client-cell-proposals">
                        ${propBadge}
                    </td>
                    <td class="client-cell-actions">
                        <div class="client-actions-group">
                            <button type="button" class="btn-gc-action btn-gc-view" onclick="window.Clients.openClientHistory('${client.id}')" title="Visualizar Histórico Completo de Orçamentos e Propostas">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </button>
                            <button type="button" class="btn-gc-action btn-gc-edit" onclick="window.Clients.openClientModal('${client.id}')" title="Editar Cadastro do Cliente">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button type="button" class="btn-gc-action btn-gc-delete" onclick="window.Clients.deleteClient('${client.id}')" title="Excluir Cliente">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    },

    /**
     * Abre a Visão 360º com o Histórico Completo de Orçamentos e Propostas do Cliente
     */
    openClientHistory(clientId) {
        this._activeClientDetailId = clientId;
        const modal = document.getElementById("modal-client-history");
        if (!modal) return;

        this.renderHistoryModalContent(clientId);
        modal.classList.add("open");
        modal.style.display = "flex";
    },

    renderHistoryModalContent(clientId) {
        const clients = this.getClientsList();
        const client = clients.find(c => String(c.id) === String(clientId));
        if (!client) return;

        const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const formatDate = (iso) => {
            if (!iso) return "-";
            try {
                return new Date(iso).toLocaleDateString("pt-BR");
            } catch(e) {
                return iso;
            }
        };

        // Preenche dados do topo do modal
        const titleEl = document.getElementById("client-history-modal-title");
        const docEl = document.getElementById("client-history-modal-doc");
        const metaEl = document.getElementById("client-history-modal-meta");
        const statsEl = document.getElementById("client-history-stats-container");
        const listEl = document.getElementById("client-history-proposals-list");
        const btnNewProp = document.getElementById("btn-client-history-new-proposal");

        if (titleEl) titleEl.textContent = client.company;
        if (docEl) {
            docEl.innerHTML = `
                <span style="font-weight: 700; color: var(--text-primary);">${client.cnpj ? CNPJService.formatCNPJ(client.cnpj) : 'Sem CNPJ'}</span>
                ${client.tradeName ? ` • <span style="color:var(--text-secondary);">${client.tradeName}</span>` : ''}
            `;
        }

        if (metaEl) {
            metaEl.innerHTML = `
                <span>👤 <strong>Contato:</strong> ${client.contact}</span>
                <span>📞 <strong>Telefone:</strong> ${client.phone || '-'}</span>
                <span>✉️ <strong>E-mail:</strong> ${client.email || '-'}</span>
                <span>📍 <strong>Local:</strong> ${client.city ? `${client.city}/${client.state}` : '-'}</span>
            `;
        }

        if (btnNewProp) {
            btnNewProp.onclick = () => this.openNewProposalForClient(client.id);
        }

        // Stats do Cliente
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="client-stat-box">
                    <span class="client-stat-label">Total em Propostas</span>
                    <span class="client-stat-value">${fmt(client.totalValue)}</span>
                    <span class="client-stat-sub">${client.totalProposals} ${client.totalProposals === 1 ? 'orçamento emitido' : 'orçamentos emitidos'}</span>
                </div>
                <div class="client-stat-box">
                    <span class="client-stat-label">Total Fechado (Ganhos)</span>
                    <span class="client-stat-value" style="color: #059669;">${fmt(client.wonValue)}</span>
                    <span class="client-stat-sub">${client.wonProposalsCount} vendas aprovadas</span>
                </div>
                <div class="client-stat-box">
                    <span class="client-stat-label">Em Negociação</span>
                    <span class="client-stat-value" style="color: #2563eb;">${client.pendingCount}</span>
                    <span class="client-stat-sub">propostas aguardando</span>
                </div>
                <div class="client-stat-box">
                    <span class="client-stat-label">Taxa de Conversão</span>
                    <span class="client-stat-value" style="color: #d97706;">
                        ${client.totalProposals > 0 ? Math.round((client.wonProposalsCount / client.totalProposals) * 100) : 0}%
                    </span>
                    <span class="client-stat-sub">aprovação histórica</span>
                </div>
            `;
        }

        // Tabela de Histórico de Propostas / Orçamentos
        if (listEl) {
            if (client.proposals.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; background: rgba(248, 250, 252, 0.6); border-radius: 14px; border: 1px dashed var(--border-color); margin-top: 16px;">
                        <div style="font-size: 32px; margin-bottom: 8px;">📑</div>
                        <h4 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px;">Nenhum orçamento emitido para este cliente ainda</h4>
                        <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 16px;">Gere a primeira proposta comercial com itens, serviços e condições de pagamento.</p>
                        <button type="button" class="btn btn-primary" onclick="window.Clients.openNewProposalForClient('${client.id}')">
                            + Gerar Primeiro Orçamento
                        </button>
                    </div>
                `;
            } else {
                listEl.innerHTML = `
                    <div class="table-responsive" style="margin-top: 16px;">
                        <table class="custom-table" style="width: 100%; font-size: 13px;">
                            <thead>
                                <tr>
                                    <th style="width: 100px;">Código</th>
                                    <th>Objeto / Título da Proposta</th>
                                    <th>Data Emissão</th>
                                    <th>Validade</th>
                                    <th>Vendedor</th>
                                    <th>Valor</th>
                                    <th>Situação</th>
                                    <th style="text-align: right;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${client.proposals.map(p => {
                                    const st = (p.status || "").toLowerCase();
                                    let badgeCls = "badge-negociacao";
                                    let label = "Em Análise";

                                    if (st === "ganho" || st === "ganha" || st === "aprovada" || st === "fechado") {
                                        badgeCls = "badge-ativo";
                                        label = "Aprovada / Ganho";
                                    } else if (st === "perdido" || st === "perdida" || st === "recusada") {
                                        badgeCls = "badge-recusada";
                                        label = "Recusada";
                                    } else if (st === "enviada") {
                                        badgeCls = "badge-enviada";
                                        label = "Enviada ao Cliente";
                                    } else if (st === "rascunho") {
                                        badgeCls = "badge-novo";
                                        label = "Rascunho";
                                    }

                                    return `
                                        <tr>
                                            <td style="font-weight: 700; color: var(--primary);">#${p.id}</td>
                                            <td>
                                                <div style="font-weight: 700; color: var(--text-primary);">${p.title || 'Orçamento de Serviços'}</div>
                                                ${p.notes ? `<div style="font-size: 11px; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.notes}</div>` : ''}
                                            </td>
                                            <td>${formatDate(p.createdAt || p.sentAt)}</td>
                                            <td>${formatDate(p.validUntil)}</td>
                                            <td><span style="font-size: 12px; color: var(--text-secondary);">${p.createdBy || 'Comercial'}</span></td>
                                            <td style="font-weight: 800; color: var(--text-primary);">${fmt(parseFloat(p.value) || 0)}</td>
                                            <td>
                                                <span class="client-status-badge ${badgeCls}">
                                                    ${label}
                                                </span>
                                            </td>
                                            <td style="text-align: right;">
                                                <div style="display: flex; gap: 6px; justify-content: flex-end;">
                                                    <button type="button" class="btn-gc-action btn-gc-view" onclick="window.Clients.viewProposalDetails('${p.id}')" title="Visualizar / Editar Proposta Completa">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button type="button" class="btn-gc-action btn-gc-pdf" onclick="window.Clients.downloadProposalPDF('${p.id}')" title="Gerar PDF do Orçamento">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }
    },

    closeHistoryModal() {
        const modal = document.getElementById("modal-client-history");
        if (modal) {
            modal.classList.remove("open");
            modal.style.display = "none";
        }
        this._activeClientDetailId = null;
    },

    /**
     * Inicia a criação de um novo orçamento/proposta pré-vinculado a este cliente
     */
    openNewProposalForClient(clientId) {
        this.closeHistoryModal();
        const clients = this.getClientsList();
        const client = clients.find(c => String(c.id) === String(clientId));
        if (!client) return;

        // Redireciona para a view de Propostas e abre o formulário GestãoClick
        window.location.hash = "#proposals";
        setTimeout(() => {
            import("./proposals.js").then(m => {
                m.Proposals.openBudgetScreen(null, {
                    id: client.id,
                    company: client.company,
                    contact: client.contact,
                    phone: client.phone,
                    email: client.email,
                    cnpj: client.cnpj,
                    city: client.city,
                    state: client.state
                });
            });
        }, 150);
    },

    /**
     * Abre os detalhes ou edição de uma proposta específica
     */
    viewProposalDetails(proposalId) {
        this.closeHistoryModal();
        window.location.hash = "#proposals";
        setTimeout(() => {
            import("./proposals.js").then(m => {
                m.Proposals.openBudgetScreen(proposalId);
            });
        }, 150);
    },

    /**
     * Baixa o PDF de uma proposta diretamente
     */
    downloadProposalPDF(proposalId) {
        import("./pdf-generator.js").then(m => {
            if (m.PDFGenerator && m.PDFGenerator.generateProposalPDF) {
                m.PDFGenerator.generateProposalPDF(proposalId);
            } else {
                this.viewProposalDetails(proposalId);
            }
        }).catch(() => {
            this.viewProposalDetails(proposalId);
        });
    },

    /**
     * Abre o modal de cadastro ou edição de cliente
     */
    openClientModal(clientId = null) {
        const modal = document.getElementById("modal-client-form");
        const form = document.getElementById("client-form");
        const titleEl = document.getElementById("client-modal-title");
        if (!modal || !form) return;

        form.reset();
        document.getElementById("client-form-id").value = "";

        if (clientId) {
            if (titleEl) titleEl.textContent = "Editar Dados do Cliente";
            const clients = this.getClientsList();
            const client = clients.find(c => String(c.id) === String(clientId));
            if (client) {
                document.getElementById("client-form-id").value = client.id;
                document.getElementById("client-form-company").value = client.company || "";
                document.getElementById("client-form-trade").value = client.tradeName || "";
                document.getElementById("client-form-cnpj").value = client.cnpj ? CNPJService.formatCNPJ(client.cnpj) : "";
                document.getElementById("client-form-contact").value = client.contact || "";
                document.getElementById("client-form-role").value = client.role || "";
                document.getElementById("client-form-phone").value = client.phone || "";
                document.getElementById("client-form-whatsapp").value = client.whatsapp || "";
                document.getElementById("client-form-email").value = client.email || "";
                document.getElementById("client-form-city").value = client.city || "";
                document.getElementById("client-form-state").value = client.state || "";
                document.getElementById("client-form-segment").value = client.segment || "Geral";
            }
        } else {
            if (titleEl) titleEl.textContent = "Novo Cliente / Empresa";
        }

        modal.classList.add("open");
        modal.style.display = "flex";
    },

    closeClientModal() {
        const modal = document.getElementById("modal-client-form");
        if (modal) {
            modal.classList.remove("open");
            modal.style.display = "none";
        }
    },

    /**
     * Consulta automática de CNPJ via Receita Federal
     */
    async lookupCNPJ(cnpj) {
        const clean = CNPJService.cleanDigits(cnpj);
        if (clean.length !== 14) return;

        const btnSearch = document.getElementById("btn-client-cnpj-search");
        if (btnSearch) {
            btnSearch.disabled = true;
            btnSearch.innerHTML = "<span>Buscando...</span>";
        }

        try {
            const data = await CNPJService.fetchCompanyData(clean);
            if (data) {
                if (data.companyName) document.getElementById("client-form-company").value = data.companyName;
                if (data.tradeName) document.getElementById("client-form-trade").value = data.tradeName;
                if (data.phone) document.getElementById("client-form-phone").value = data.phone;
                if (data.email) document.getElementById("client-form-email").value = data.email;
                if (data.city) document.getElementById("client-form-city").value = data.city;
                if (data.state) document.getElementById("client-form-state").value = data.state;
                if (data.cnaeText) document.getElementById("client-form-segment").value = data.cnaeText.substring(0, 40);
                
                // Notificação de sucesso
                import("./toast.js").then(m => m.Toast.success("Dados preenchidos com sucesso via Receita Federal!"));
            }
        } catch(e) {
            console.error("Erro ao consultar CNPJ:", e);
        } finally {
            if (btnSearch) {
                btnSearch.disabled = false;
                btnSearch.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar Receita`;
            }
        }
    },

    /**
     * Salva ou atualiza os dados do cliente
     */
    saveClient() {
        const id = document.getElementById("client-form-id").value;
        const company = document.getElementById("client-form-company").value.trim();
        const tradeName = document.getElementById("client-form-trade").value.trim();
        const cnpj = CNPJService.cleanDigits(document.getElementById("client-form-cnpj").value);
        const contact = document.getElementById("client-form-contact").value.trim();
        const role = document.getElementById("client-form-role").value.trim();
        const phone = document.getElementById("client-form-phone").value.trim();
        const whatsapp = document.getElementById("client-form-whatsapp").value.trim() || phone;
        const email = document.getElementById("client-form-email").value.trim();
        const city = document.getElementById("client-form-city").value.trim();
        const state = document.getElementById("client-form-state").value.trim();
        const segment = document.getElementById("client-form-segment").value.trim() || "Geral";

        if (!company) {
            alert("Por favor, preencha o Nome ou Razão Social do cliente.");
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const clientData = {
            company,
            tradeName,
            cnpj,
            contact,
            role,
            phone,
            whatsapp,
            email,
            city,
            state,
            segment,
            owner: currentUser ? currentUser.email : "admin@vellia.com"
        };

        if (id) {
            Store.updateLead(id, clientData);
            import("./toast.js").then(m => m.Toast.success("Cadastro do cliente atualizado com sucesso!"));
        } else {
            Store.addLead({
                ...clientData,
                stage: "lead",
                source: "Gestão de Clientes"
            });
            import("./toast.js").then(m => m.Toast.success("Cliente cadastrado com sucesso!"));
        }

        this.closeClientModal();
        this.renderStats();
        this.renderTable();
    },

    /**
     * Exclusão de cliente
     */
    deleteClient(clientId) {
        const clients = this.getClientsList();
        const client = clients.find(c => String(c.id) === String(clientId));
        const name = client ? client.company : "este cliente";

        if (confirm(`Deseja realmente remover ${name}? Todas as propostas associadas permanecerão no histórico de auditoria.`)) {
            Store.deleteLead(clientId);
            import("./toast.js").then(m => m.Toast.info("Cliente removido com sucesso."));
            this.renderStats();
            this.renderTable();
        }
    },

    /**
     * Exportação da carteira para CSV
     */
    exportToCSV() {
        const clients = this.getClientsList();
        if (clients.length === 0) {
            alert("Nenhum cliente para exportar.");
            return;
        }

        const headers = ["Razão Social", "Nome Fantasia", "CNPJ/CPF", "Contato", "Telefone", "E-mail", "Cidade", "UF", "Situação", "Qtd Propostas", "Total Orçado (R$)", "Total Fechado (R$)"];
        const rows = clients.map(c => [
            `"${(c.company || '').replace(/"/g, '""')}"`,
            `"${(c.tradeName || '').replace(/"/g, '""')}"`,
            `"${c.cnpj || ''}"`,
            `"${(c.contact || '').replace(/"/g, '""')}"`,
            `"${c.phone || ''}"`,
            `"${c.email || ''}"`,
            `"${c.city || ''}"`,
            `"${c.state || ''}"`,
            `"${c.situacao}"`,
            c.totalProposals,
            c.totalValue.toFixed(2),
            c.wonValue.toFixed(2)
        ]);

        const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Clientes_Vellia_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// Exposição global para chamadas inline no HTML
window.Clients = Clients;
