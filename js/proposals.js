import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

let activeProposalId = null;
let isSaving = false;

export const Proposals = {
    init() {
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();
        this.bindEvents();
    },

    bindEvents() {
        // Botão Nova Proposta
        const btnNew = document.getElementById("btn-new-proposal");
        if (btnNew) btnNew.addEventListener("click", () => this.openModal());

        // Fechar modal
        const btnClose = document.getElementById("btn-close-proposal-modal");
        if (btnClose) btnClose.addEventListener("click", () => this.closeModal());

        const btnCancel = document.getElementById("btn-cancel-proposal");
        if (btnCancel) btnCancel.addEventListener("click", () => this.closeModal());

        // Overlay fecha modal
        const overlay = document.getElementById("proposal-modal-overlay");
        if (overlay) overlay.addEventListener("click", () => this.closeModal());

        // Form submit
        const form = document.getElementById("new-proposal-form");
        if (form) form.addEventListener("submit", (e) => { e.preventDefault(); this.saveProposal(); });

        // Busca e filtro
        const search = document.getElementById("proposals-search");
        if (search) search.addEventListener("input", () => this.renderTable());

        const filter = document.getElementById("proposals-filter-status");
        if (filter) filter.addEventListener("change", () => this.renderTable());

        // Fechar modal de detalhes
        const btnCloseDetail = document.getElementById("btn-close-proposal-detail");
        if (btnCloseDetail) btnCloseDetail.addEventListener("click", () => this.closeDetailModal());

        const overlayDetail = document.getElementById("proposal-detail-overlay");
        if (overlayDetail) overlayDetail.addEventListener("click", () => this.closeDetailModal());

        // Ações dentro do modal de detalhes
        const btnWin = document.getElementById("btn-proposal-win");
        if (btnWin) btnWin.addEventListener("click", () => this.markWon());

        const btnLose = document.getElementById("btn-proposal-lose");
        if (btnLose) btnLose.addEventListener("click", () => this.openLossModal());

        // Modal de perda
        const btnCloseLoss = document.getElementById("btn-close-loss-modal");
        if (btnCloseLoss) btnCloseLoss.addEventListener("click", () => this.closeLossModal());

        const btnCancelLoss = document.getElementById("btn-cancel-loss");
        if (btnCancelLoss) btnCancelLoss.addEventListener("click", () => this.closeLossModal());

        const overlayLoss = document.getElementById("loss-modal-overlay");
        if (overlayLoss) overlayLoss.addEventListener("click", () => this.closeLossModal());

        const formLoss = document.getElementById("loss-form");
        if (formLoss) formLoss.addEventListener("submit", (e) => { e.preventDefault(); this.confirmLoss(); });
    },

    // ==========================================================================
    // KPI STATS
    // ==========================================================================
    renderStats() {
        const proposals = Store.getProposals();
        const total = proposals.length;
        const sent = proposals.filter(p => p.status === "Enviada").length;
        const won = proposals.filter(p => p.status === "Ganho").length;
        const lost = proposals.filter(p => p.status === "Perdido").length;
        const totalRevenue = proposals
            .filter(p => p.status === "Ganho")
            .reduce((sum, p) => sum + (p.value || 0), 0);
        const convRate = total > 0 ? Math.round((won / total) * 100) : 0;

        // Pipeline (abertas + em negocia\u00e7\u00e3o)
        const pipeline = proposals
            .filter(p => p.status === "Enviada" || p.status === "Em Negociação")
            .reduce((sum, p) => sum + (p.value || 0), 0);

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        this.setEl("prop-stat-total", total);
        this.setEl("prop-stat-sent", sent);
        this.setEl("prop-stat-won", won);
        this.setEl("prop-stat-lost", lost);
        this.setEl("prop-stat-revenue", fmt(totalRevenue));
        this.setEl("prop-stat-pipeline", fmt(pipeline));
        this.setEl("prop-stat-conv", `${convRate}%`);
    },

    setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    },

    // ==========================================================================
    // TABELA DE PROPOSTAS
    // ==========================================================================
    renderTable() {
        const tbody = document.getElementById("proposals-table-body");
        if (!tbody) return;

        const proposals = Store.getProposals();
        const search = document.getElementById("proposals-search")?.value.toLowerCase().trim() || "";
        const statusFilter = document.getElementById("proposals-filter-status")?.value || "all";

        const filtered = proposals.filter(p => {
            const matchSearch = p.company.toLowerCase().includes(search) ||
                p.title.toLowerCase().includes(search) ||
                p.contact.toLowerCase().includes(search);
            const matchStatus = statusFilter === "all" || p.status === statusFilter;
            return matchSearch && matchStatus;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">
                        Nenhuma proposta encontrada.
                    </td>
                </tr>
            `;
            return;
        }

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        tbody.innerHTML = filtered.map(p => {
            const sentDate = p.sentAt ? new Date(p.sentAt).toLocaleDateString("pt-BR") : "—";
            const validDate = p.validUntil ? new Date(p.validUntil).toLocaleDateString("pt-BR") : "—";
            const isExpired = p.validUntil && new Date(p.validUntil) < new Date() && p.status === "Enviada";

            const statusBadge = this.getStatusBadge(p.status);

            return `
                <tr data-id="${p.id}" style="cursor: pointer;">
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary);">${p.company}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${p.contact}</div>
                    </td>
                    <td style="max-width: 220px;">
                        <div style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.title}">${p.title}</div>
                    </td>
                    <td style="font-weight: 700; color: var(--success);">${fmt(p.value)}</td>
                    <td>${statusBadge}</td>
                    <td style="font-size: 12px; color: var(--text-secondary);">${sentDate}</td>
                    <td style="font-size: 12px; color: ${isExpired ? 'var(--danger)' : 'var(--text-secondary)'};">
                        ${validDate} ${isExpired ? '⚠️' : ''}
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-sm btn-outline btn-view-proposal" data-id="${p.id}" style="font-size: 11px; padding: 4px 10px;">Ver</button>
                    </td>
                </tr>
            `;
        }).join("");

        // Eventos de clique
        tbody.querySelectorAll("tr[data-id]").forEach(row => {
            row.addEventListener("click", (e) => {
                if (e.target.closest(".btn-view-proposal")) return;
                this.openDetailModal(row.getAttribute("data-id"));
            });
        });
        tbody.querySelectorAll(".btn-view-proposal").forEach(btn => {
            btn.addEventListener("click", () => this.openDetailModal(btn.getAttribute("data-id")));
        });
    },

    getStatusBadge(status) {
        const map = {
            "Enviada": `<span class="badge badge-info">Enviada</span>`,
            "Em Negociação": `<span class="badge badge-warning">Em Negociação</span>`,
            "Ganho": `<span class="badge badge-success">✅ Ganho</span>`,
            "Perdido": `<span class="badge badge-danger">❌ Perdido</span>`,
            "Cancelada": `<span class="badge" style="background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border-color);">Cancelada</span>`
        };
        return map[status] || `<span class="badge">${status}</span>`;
    },

    // ==========================================================================
    // ANÁLISE DE PERDAS
    // ==========================================================================
    renderLossAnalysis() {
        const proposals = Store.getProposals();
        const lost = proposals.filter(p => p.status === "Perdido");
        const container = document.getElementById("loss-analysis-container");
        if (!container) return;

        if (lost.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Nenhuma perda registrada ainda.</p>`;
            return;
        }

        // Agrupar por motivo de perda
        const reasonMap = {};
        lost.forEach(p => {
            const reason = p.lossReason || "Motivo não informado";
            if (!reasonMap[reason]) reasonMap[reason] = { count: 0, value: 0 };
            reasonMap[reason].count++;
            reasonMap[reason].value += p.value || 0;
        });

        // Agrupar por concorrente
        const competitorMap = {};
        lost.filter(p => p.competitor).forEach(p => {
            if (!competitorMap[p.competitor]) competitorMap[p.competitor] = 0;
            competitorMap[p.competitor]++;
        });

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const totalLostValue = lost.reduce((s, p) => s + (p.value || 0), 0);

        const reasonsHtml = Object.entries(reasonMap)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([reason, data]) => {
                const pct = Math.round((data.count / lost.length) * 100);
                return `
                    <div style="margin-bottom: 14px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${reason}</span>
                            <span style="font-size: 12px; color: var(--text-muted);">${data.count}x · ${fmt(data.value)}</span>
                        </div>
                        <div style="height: 6px; background: var(--bg-app); border-radius: 99px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: var(--danger); border-radius: 99px; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                `;
            }).join("");

        const competitorsHtml = Object.keys(competitorMap).length === 0
            ? `<p style="color: var(--text-muted); font-size: 12px;">Nenhum concorrente mapeado.</p>`
            : Object.entries(competitorMap)
                .sort((a, b) => b[1] - a[1])
                .map(([comp, count]) => `
                    <div class="priorities-list-item" style="margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--text-primary);">${comp}</span>
                        <span class="badge badge-danger">${count}x</span>
                    </div>
                `).join("");

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                <div>
                    <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 16px;">Motivos de Perda</h4>
                    ${reasonsHtml}
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between;">
                        <span style="font-size: 12px; color: var(--text-muted);">Total perdido</span>
                        <span style="font-size: 14px; font-weight: 700; color: var(--danger);">${fmt(totalLostValue)}</span>
                    </div>
                </div>
                <div>
                    <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 16px;">Concorrentes Vencedores</h4>
                    ${competitorsHtml}
                </div>
            </div>
        `;
    },

    // ==========================================================================
    // MODAL DE NOVA PROPOSTA
    // ==========================================================================
    openModal(leadData = null) {
        const form = document.getElementById("new-proposal-form");
        if (form) form.reset();

        // Pré-preencher com dados do lead se fornecido
        if (leadData) {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal("proposal-company", leadData.company || "");
            setVal("proposal-contact", leadData.contact || "");
        }

        document.getElementById("proposal-modal")?.classList.add("open");
        document.getElementById("proposal-modal-overlay").style.display = "block";
    },

    closeModal() {
        document.getElementById("proposal-modal")?.classList.remove("open");
        document.getElementById("proposal-modal-overlay").style.display = "none";
    },

    saveProposal() {
        if (isSaving) return;
        isSaving = true;

        const getVal = (id) => document.getElementById(id)?.value.trim() || "";
        const company = getVal("proposal-company");
        const contact = getVal("proposal-contact");
        const title = getVal("proposal-title");
        const value = parseFloat(getVal("proposal-value").replace(",", ".")) || 0;
        const validUntil = getVal("proposal-valid");
        const notes = getVal("proposal-notes");

        if (!company || !title || !value) {
            alert("Preencha os campos obrigatórios: Empresa, Título e Valor.");
            isSaving = false;
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const proposal = Store.addProposal({
            company,
            contact,
            title,
            value,
            status: "Enviada",
            sentAt: new Date().toISOString(),
            validUntil: validUntil ? new Date(validUntil).toISOString() : null,
            notes,
            createdBy: currentUser?.email || "sistema@vellia.com"
        });

        Audit.logStageChange(currentUser?.email, company, "Nova", "Enviada", `Proposta criada: ${title} - R$ ${value}`);

        this.closeModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        isSaving = false;
    },

    // ==========================================================================
    // MODAL DE DETALHES
    // ==========================================================================
    openDetailModal(id) {
        const proposal = Store.getProposalById(id);
        if (!proposal) return;
        activeProposalId = id;

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
        const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date() && proposal.status === "Enviada";

        this.setEl("detail-company", proposal.company);
        this.setEl("detail-contact", proposal.contact || "—");
        this.setEl("detail-title", proposal.title);
        this.setEl("detail-value", fmt(proposal.value));
        this.setEl("detail-status-badge", "");
        const statusEl = document.getElementById("detail-status-badge");
        if (statusEl) statusEl.innerHTML = this.getStatusBadge(proposal.status);
        this.setEl("detail-sent", fmtDate(proposal.sentAt));
        this.setEl("detail-valid", fmtDate(proposal.validUntil) + (isExpired ? " ⚠️ Vencida" : ""));
        this.setEl("detail-closed", proposal.closedAt ? fmtDate(proposal.closedAt) : "—");
        this.setEl("detail-competitor", proposal.competitor || "Não informado");
        this.setEl("detail-loss-reason", proposal.lossReason || "—");
        this.setEl("detail-notes", proposal.notes || "Sem observações.");

        // Mostrar/ocultar botões de ação conforme status
        const btnWin = document.getElementById("btn-proposal-win");
        const btnLose = document.getElementById("btn-proposal-lose");
        const isPending = proposal.status === "Enviada" || proposal.status === "Em Negociação";
        if (btnWin) btnWin.style.display = isPending ? "flex" : "none";
        if (btnLose) btnLose.style.display = isPending ? "flex" : "none";

        document.getElementById("proposal-detail-modal")?.classList.add("open");
        document.getElementById("proposal-detail-overlay").style.display = "block";
    },

    closeDetailModal() {
        activeProposalId = null;
        document.getElementById("proposal-detail-modal")?.classList.remove("open");
        document.getElementById("proposal-detail-overlay").style.display = "none";
    },

    // ==========================================================================
    // FECHAR VENDA (GANHO)
    // ==========================================================================
    markWon() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        Store.updateProposal(activeProposalId, {
            status: "Ganho",
            closedAt: new Date().toISOString()
        });

        const currentUser = Auth.getCurrentUser();
        Audit.logSaleWon(currentUser?.email || "sistema@vellia.com", proposal.company, `R$ ${proposal.value}`);

        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        // Notificar demais módulos
        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
    },

    // ==========================================================================
    // REGISTRAR PERDA
    // ==========================================================================
    openLossModal() {
        document.getElementById("loss-modal")?.classList.add("open");
        document.getElementById("loss-modal-overlay").style.display = "block";
        document.getElementById("loss-form")?.reset();
    },

    closeLossModal() {
        document.getElementById("loss-modal")?.classList.remove("open");
        document.getElementById("loss-modal-overlay").style.display = "none";
    },

    confirmLoss() {
        if (!activeProposalId) return;
        const lossReason = document.getElementById("loss-reason-text")?.value.trim() || "";
        const competitor = document.getElementById("loss-competitor")?.value.trim() || "";

        if (!lossReason) { alert("Informe o motivo da perda."); return; }

        const proposal = Store.getProposalById(activeProposalId);
        Store.updateProposal(activeProposalId, {
            status: "Perdido",
            closedAt: new Date().toISOString(),
            lossReason,
            competitor
        });

        const currentUser = Auth.getCurrentUser();
        Audit.logSaleLost(currentUser?.email || "sistema@vellia.com", proposal.company, lossReason);

        this.closeLossModal();
        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
    }
};
