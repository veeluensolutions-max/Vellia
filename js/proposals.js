import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

let activeProposalId = null;
let isSaving = false;

export const Proposals = {
    _eventsBound: false,
    init() {
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();
        if (!this._eventsBound) {
            this.bindEvents();
            this._eventsBound = true;
        }
    },

    bindEvents() {
        // Botão Nova Proposta
        const btnNew = document.getElementById("btn-new-proposal");
        if (btnNew) btnNew.addEventListener("click", () => this.openModal());

        // Botão Exportar PDF
        const btnExportPDF = document.getElementById("btn-export-pdf-report");
        if (btnExportPDF) {
            btnExportPDF.addEventListener("click", () => {
                const currentUser = Auth.getCurrentUser();
                if (currentUser) {
                    import("./report.js").then(m => {
                        m.generatePerformancePDF(currentUser.email);
                    });
                }
            });
        }

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
        if (btnWin) btnWin.addEventListener("click", () => this.openWinModal());

        const btnLose = document.getElementById("btn-proposal-lose");
        if (btnLose) btnLose.addEventListener("click", () => this.openLossModal());

        const btnWa = document.getElementById("btn-proposal-wa");
        if (btnWa) {
            btnWa.addEventListener("click", () => {
                if (!activeProposalId) return;
                const proposal = Store.getProposalById(activeProposalId);
                if (!proposal) return;
                
                const leads = Store.getLeads();
                const lead = leads.find(l => l.company.toLowerCase() === proposal.company.toLowerCase());
                
                if (lead) {
                    this.closeDetailModal();
                    window.WhatsApp?.openModalForProposal(lead.id, proposal.id);
                } else {
                    alert("Aviso: Nenhum contato associado a esta empresa para puxar telefone.");
                }
            });
        }

        // Modal de perda
        const btnCloseLoss = document.getElementById("btn-close-loss-modal");
        if (btnCloseLoss) btnCloseLoss.addEventListener("click", () => this.closeLossModal());

        const btnCancelLoss = document.getElementById("btn-cancel-loss");
        if (btnCancelLoss) btnCancelLoss.addEventListener("click", () => this.closeLossModal());

        const overlayLoss = document.getElementById("loss-modal-overlay");
        if (overlayLoss) overlayLoss.addEventListener("click", () => this.closeLossModal());

        const formLoss = document.getElementById("loss-form");
        if (formLoss) formLoss.addEventListener("submit", (e) => { e.preventDefault(); this.confirmLoss(); });

        // Modal de ganho
        const btnCloseWin = document.getElementById("btn-close-win-modal");
        if (btnCloseWin) btnCloseWin.addEventListener("click", () => this.closeWinModal());

        const btnCancelWin = document.getElementById("btn-cancel-win");
        if (btnCancelWin) btnCancelWin.addEventListener("click", () => this.closeWinModal());

        const overlayWin = document.getElementById("win-modal-overlay");
        if (overlayWin) overlayWin.addEventListener("click", () => this.closeWinModal());

        const formWin = document.getElementById("win-form");
        if (formWin) formWin.addEventListener("submit", (e) => { e.preventDefault(); this.confirmWin(); });

        // Modal Edição de Proposta
        const btnEditProp = document.getElementById("btn-edit-proposal");
        if (btnEditProp) btnEditProp.addEventListener("click", () => this.openEditProposalModal());

        const btnCloseEditProp = document.getElementById("btn-close-edit-proposal");
        if (btnCloseEditProp) btnCloseEditProp.addEventListener("click", () => this.closeEditProposalModal());

        const btnCancelEditProp = document.getElementById("btn-cancel-edit-proposal");
        if (btnCancelEditProp) btnCancelEditProp.addEventListener("click", () => this.closeEditProposalModal());

        const editPropForm = document.getElementById("edit-proposal-form");
        if (editPropForm) editPropForm.addEventListener("submit", (e) => { e.preventDefault(); this.saveEditProposal(); });

        // Botões de Geração de Proposta por IA
        const btnGenAI = document.getElementById("btn-generate-proposal-notes-ai");
        if (btnGenAI) btnGenAI.addEventListener("click", () => this.generateProposalNotesAI("new"));

        const btnGenEditAI = document.getElementById("btn-generate-edit-notes-ai");
        if (btnGenEditAI) btnGenEditAI.addEventListener("click", () => this.generateProposalNotesAI("edit"));

        // Botão Exportar PDF da Proposta
        const btnPropPdf = document.getElementById("btn-proposal-pdf");
        if (btnPropPdf) {
            btnPropPdf.addEventListener("click", () => {
                if (activeProposalId) this.exportProposalToPDF(activeProposalId);
            });
        }

        const btnGenDocs = document.getElementById("btn-proposal-generate-docs");
        if (btnGenDocs) {
            btnGenDocs.addEventListener("click", () => this.generateDocsFromProposal());
        }
    },

    // ==========================================================================
    // KPI STATS
    // ==========================================================================
    renderStats() {
        const proposals = Store.getProposals();
        const total = proposals.length;
        const sent = proposals.filter(p => p.status === "Enviada").length;
        const won = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).length;
        const lost = proposals.filter(p => p.status === "Perdido").length;
        const totalRevenue = proposals
            .filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status))
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
            "Aguardando Agendamento": `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">⏳ Aguardando Agendamento</span>`,
            "Agendada": `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">🗓️ Agendada</span>`,
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

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
        const totalLostValue = lost.reduce((s, p) => s + (p.value || 0), 0);

        // Atualizar KPIs do header
        const kpiValue = document.getElementById("loss-total-value");
        const kpiCount = document.getElementById("loss-total-count");
        if (kpiValue) kpiValue.textContent = fmt(totalLostValue);
        if (kpiCount) kpiCount.textContent = lost.length;

        if (lost.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 40px 0;">Nenhuma perda registrada ainda. Registre a primeira perda para visualizar insights.</p>`;
            const kpiReason = document.getElementById("loss-top-reason");
            if (kpiReason) kpiReason.textContent = "—";
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

        // Top reason KPI
        const sortedReasons = Object.entries(reasonMap).sort((a, b) => b[1].count - a[1].count);
        const kpiReason = document.getElementById("loss-top-reason");
        if (kpiReason && sortedReasons.length > 0) {
            kpiReason.textContent = sortedReasons[0][0];
        }

        // ── Gerar HTML com canvas + listagem de detalhes ───────────────────────
        const hasCompetitors = Object.keys(competitorMap).length > 0;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                <!-- Gráfico Doughnut: Motivos -->
                <div>
                    <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 16px;">Motivos de Perda</h4>
                    <div style="position: relative; height: 220px;">
                        <canvas id="chart-loss-reasons-doughnut"></canvas>
                    </div>
                </div>
                <!-- Gráfico Bar: Concorrentes -->
                <div>
                    <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 16px;">Concorrentes Vencedores</h4>
                    <div style="position: relative; height: 220px;">
                        <canvas id="chart-loss-competitors-bar" ${!hasCompetitors ? 'style="display:none;"' : ''}></canvas>
                        ${!hasCompetitors ? `<p style="color: var(--text-muted); font-size: 13px; padding: 60px 0; text-align: center;">Nenhum concorrente mapeado ainda.</p>` : ''}
                    </div>
                </div>
            </div>

            <!-- Listagem detalhada por motivo -->
            <div>
                <h4 style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 14px;">Detalhamento por Motivo</h4>
                ${sortedReasons.map(([reason, data]) => {
                    const pct = Math.round((data.count / lost.length) * 100);
                    return `
                        <div style="margin-bottom: 14px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span style="font-size: 13px; color: var(--text-primary); font-weight: 600;">${reason}</span>
                                <span style="font-size: 12px; color: var(--text-muted);">${data.count} negócio(s) · ${fmt(data.value)} · ${pct}%</span>
                            </div>
                            <div style="height: 7px; background: var(--bg-app); border-radius: 99px; overflow: hidden;">
                                <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 99px; transition: width 0.6s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;

        // ── Renderizar Chart.js: Doughnut de motivos ───────────────────────────
        requestAnimationFrame(() => {
            const ctxD = document.getElementById("chart-loss-reasons-doughnut")?.getContext("2d");
            if (ctxD) {
                const colors = ["#ef4444","#f97316","#eab308","#8b5cf6","#06b6d4","#10b981","#ec4899"];
                new Chart(ctxD, {
                    type: "doughnut",
                    data: {
                        labels: sortedReasons.map(([r]) => r),
                        datasets: [{
                            data: sortedReasons.map(([, d]) => d.count),
                            backgroundColor: colors.slice(0, sortedReasons.length),
                            borderWidth: 2,
                            borderColor: "var(--bg-surface)"
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
                        },
                        cutout: "60%"
                    }
                });
            }

            // ── Renderizar Chart.js: Horizontal bar de concorrentes ────────────
            if (hasCompetitors) {
                const ctxB = document.getElementById("chart-loss-competitors-bar")?.getContext("2d");
                if (ctxB) {
                    const compEntries = Object.entries(competitorMap).sort((a, b) => b[1] - a[1]);
                    new Chart(ctxB, {
                        type: "bar",
                        data: {
                            labels: compEntries.map(([c]) => c),
                            datasets: [{
                                label: "Negócios Perdidos",
                                data: compEntries.map(([, n]) => n),
                                backgroundColor: "#6366f1",
                                borderRadius: 4
                            }]
                        },
                        options: {
                            indexAxis: "y",
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { beginAtZero: true, ticks: { precision: 0 } }
                            }
                        }
                    });
                }
            }
        });
    },


    // ==========================================================================
    // MODAL DE NOVA PROPOSTA
    // ==========================================================================
    openModal(leadData = null, suggestedService = null) {
        const form = document.getElementById("new-proposal-form");
        if (form) form.reset();

        // Se passarem uma string como leadData, tentar buscar o objeto na store
        if (typeof leadData === 'string') {
            leadData = window.Store ? window.Store.getLeadById(leadData) : null;
        }

        // Pré-preencher com dados do lead se fornecido
        if (leadData) {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal("proposal-company", leadData.company || "");
            setVal("proposal-contact", leadData.contact || "");
        }
        
        if (suggestedService) {
            const el = document.getElementById("proposal-service");
            if (el) el.value = suggestedService;
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
        const service = getVal("proposal-service");
        const value = parseFloat(getVal("proposal-value").replace(",", ".")) || 0;
        const validUntil = getVal("proposal-valid");
        const notes = getVal("proposal-notes");

        const filesInput = document.getElementById("proposal-files");
        const attachments = [];
        if (filesInput && filesInput.files) {
            for (let i = 0; i < filesInput.files.length; i++) {
                attachments.push({
                    name: filesInput.files[i].name,
                    size: filesInput.files[i].size,
                    type: filesInput.files[i].type
                });
            }
        }

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
            service,
            value,
            status: "Enviada",
            sentAt: new Date().toISOString(),
            validUntil: validUntil ? new Date(validUntil).toISOString() : null,
            notes,
            attachments,
            createdBy: currentUser?.email || "sistema@vellia.com"
        });

        Audit.logStageChange(currentUser?.email, company, "Nova", "Enviada", `Proposta criada: ${title} - R$ ${value}`);

        this.closeModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        // Disparar automação de proposta enviada
        const leads = Store.getLeads();
        const lead = leads.find(l => l.company.toLowerCase() === company.toLowerCase());
        if (lead && typeof window.WhatsApp?.sendAutomatedMessage === "function") {
            window.WhatsApp.sendAutomatedMessage(lead.id, "proposal", { proposalId: proposal.id });
        }

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
        this.setEl("detail-service", proposal.service || "—");
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
        const btnWa = document.getElementById("btn-proposal-wa");
        const isPending = proposal.status === "Enviada" || proposal.status === "Em Negociação";
        if (btnWin) btnWin.style.display = isPending ? "flex" : "none";
        if (btnLose) btnLose.style.display = isPending ? "flex" : "none";
        if (btnWa) btnWa.style.display = isPending ? "flex" : "none";

        document.getElementById("proposal-detail-modal")?.classList.add("open");
        document.getElementById("proposal-detail-overlay").style.display = "block";
    },

    async generateDocsFromProposal() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        const btn = document.getElementById("btn-proposal-generate-docs");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Processando...";
        }

        try {
            const apiUrl = localStorage.getItem("vellia_docs_api_url") || "http://localhost:3001";
            const frontendUrl = localStorage.getItem("vellia_docs_frontend_url") || "http://localhost:3000";

            // Encontrar lead correspondente
            const leads = Store.getLeads();
            const lead = leads.find(l => l.company.toLowerCase() === proposal.company.toLowerCase());

            // Usar o id do lead se existir, senão usar o id da própria proposta
            const contactId = lead ? lead.id : `prop_${proposal.id}`;
            const name = proposal.company || "Sem Nome";
            const contactPerson = proposal.contact || "";

            // Sincronizar o contato para garantir que ele exista no Vellia Docs
            const contactPayload = {
                contact_id: contactId,
                name: name,
                status: "Lead Qualificado",
                email: "",
                phone: "",
                contact_person: contactPerson,
                segment: proposal.service || ""
            };

            // 1. Verificar se existe
            const checkRes = await fetch(`${apiUrl}/v1/contacts/${contactId}`, {
                headers: { "x-client-id": "admin@veeluen.ai" }
            });

            if (checkRes.ok) {
                // Atualizar
                await fetch(`${apiUrl}/v1/contacts/${contactId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-client-id": "admin@veeluen.ai"
                    },
                    body: JSON.stringify({
                        name: name,
                        contact_person: contactPerson,
                        segment: proposal.service || ""
                    })
                });
            } else {
                // Criar
                await fetch(`${apiUrl}/v1/contacts`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-client-id": "admin@veeluen.ai"
                    },
                    body: JSON.stringify(contactPayload)
                });
            }

            // 2. Abrir o Vellia Docs na tela de criação de propostas com o clientId
            const targetUrl = `${frontendUrl}/documents/new?clientId=${contactId}`;
            window.open(targetUrl, "_blank");

        } catch (err) {
            console.error("Erro ao gerar proposta no Vellia Docs:", err);
            alert("Erro ao conectar ao Vellia Docs. Verifique se o servidor está rodando.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "📄 Gerar no Vellia Docs";
            }
        }
    },

    closeDetailModal() {
        document.getElementById("proposal-detail-modal")?.classList.remove("open");
        document.getElementById("proposal-detail-overlay").style.display = "none";
        activeProposalId = null;
    },

    // ==========================================================================
    // EDIÇÃO DE PROPOSTA
    // ==========================================================================
    openEditProposalModal() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        document.getElementById("edit-proposal-id").value = proposal.id;
        document.getElementById("edit-prop-number").value = proposal.id;
        document.getElementById("edit-prop-service").value = proposal.service || "";
        document.getElementById("edit-prop-title").value = proposal.title || "";
        document.getElementById("edit-prop-value").value = proposal.value || 0;
        
        if (proposal.validUntil) {
            document.getElementById("edit-prop-valid").value = new Date(proposal.validUntil).toISOString().split('T')[0];
        } else {
            document.getElementById("edit-prop-valid").value = "";
        }
        
        document.getElementById("edit-prop-notes").value = proposal.notes || "";

        document.getElementById("edit-proposal-modal").classList.add("open");
        document.getElementById("modal-overlay").style.display = "block";
    },

    closeEditProposalModal() {
        document.getElementById("edit-proposal-modal").classList.remove("open");
        document.getElementById("modal-overlay").style.display = "none";
    },

    saveEditProposal() {
        const id = document.getElementById("edit-proposal-id").value;
        const validUntil = document.getElementById("edit-prop-valid").value;

        const updatedData = {
            title: document.getElementById("edit-prop-title").value.trim(),
            service: document.getElementById("edit-prop-service").value,
            value: parseFloat(document.getElementById("edit-prop-value").value) || 0,
            validUntil: validUntil ? new Date(validUntil).toISOString() : null,
            notes: document.getElementById("edit-prop-notes").value.trim()
        };

        const user = Auth.getCurrentUser();
        Store.updateProposal(id, updatedData, user ? user.email : "sistema@vellia.com");
        
        this.closeEditProposalModal();
        this.openDetailModal(id); // Recarregar detalhes
        this.renderStats();
        this.renderTable();
        alert("Proposta atualizada com sucesso!");
    },

    // ==========================================================================
    // AÇÕES DE STATUS
    // ==========================================================================
    openWinModal() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        document.getElementById("win-form").reset();
        
        const serviceEl = document.getElementById("win-service");
        if (serviceEl && proposal.service) {
            serviceEl.value = proposal.service;
        }

        const valueEl = document.getElementById("win-value");
        if (valueEl) {
            valueEl.value = proposal.value;
        }

        const dateEl = document.getElementById("win-date");
        if (dateEl) {
            dateEl.value = new Date().toISOString().split('T')[0];
        }

        document.getElementById("win-modal").classList.add("open");
        document.getElementById("win-modal-overlay").style.display = "block";
    },

    closeWinModal() {
        document.getElementById("win-modal")?.classList.remove("open");
        document.getElementById("win-modal-overlay").style.display = "none";
    },

    confirmWin() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        const service = document.getElementById("win-service").value;
        const finalValue = parseFloat(document.getElementById("win-value").value) || proposal.value;
        const executionDate = document.getElementById("win-execution").value;

        Store.updateProposal(activeProposalId, {
            status: "Aguardando Agendamento",
            service: service,
            value: finalValue,
            executionDate: executionDate || null,
            closedAt: document.getElementById("win-date").value || new Date().toISOString()
        });

        const currentUser = Auth.getCurrentUser();
        Audit.logSaleWon(currentUser?.email || "sistema@vellia.com", proposal.company, `R$ ${finalValue}`);

        this.closeWinModal();
        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        // Notificar demais módulos
        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));

        // Integração com Fase 2 - Contratos
        if (confirm("Parabéns pelo fechamento! Deseja gerar o Contrato para este cliente agora?")) {
            window.location.hash = "#contracts";
            setTimeout(() => {
                if (window.Contracts) {
                    window.Contracts.openModal();
                    document.getElementById("contract-lead-id").value = proposal.leadId;
                    document.getElementById("contract-total-value").value = finalValue;
                }
            }, 300);
        }
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
        const notes = document.getElementById("loss-notes")?.value.trim() || "";

        if (!lossReason) { alert("Informe o motivo da perda."); return; }

        const proposal = Store.getProposalById(activeProposalId);
        Store.updateProposal(activeProposalId, {
            status: "Perdido",
            closedAt: new Date().toISOString(),
            lossReason,
            competitor,
            notes
        });

        const currentUser = Auth.getCurrentUser();
        Audit.logSaleLost(currentUser?.email || "sistema@vellia.com", proposal.company, lossReason);

        this.closeLossModal();
        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
    },

    async generateProposalNotesAI(target) {
        const isEdit = target === "edit";
        let company = "";
        let contact = "";
        let service = "";
        let value = "";
        let notesTextarea = null;
        let btn = null;

        if (isEdit) {
            if (!activeProposalId) return;
            const proposal = Store.getProposalById(activeProposalId);
            if (!proposal) return;
            company = proposal.company;
            contact = proposal.contact;
            service = document.getElementById("edit-prop-service").value;
            value = document.getElementById("edit-prop-value").value;
            notesTextarea = document.getElementById("edit-prop-notes");
            btn = document.getElementById("btn-generate-edit-notes-ai");
        } else {
            company = document.getElementById("proposal-company").value.trim();
            contact = document.getElementById("proposal-contact").value.trim();
            service = document.getElementById("proposal-service").value;
            value = document.getElementById("proposal-value").value;
            notesTextarea = document.getElementById("proposal-notes");
            btn = document.getElementById("btn-generate-proposal-notes-ai");
        }

        if (!company || !service) {
            alert("Por favor, preencha a Empresa e o Serviço antes de gerar o escopo.");
            return;
        }

        const originalBtnText = btn.innerHTML;
        btn.innerHTML = `<span style="font-size: 11px;">Gerando...</span>`;
        btn.disabled = true;

        try {
            const prompt = `Escreva uma proposta comercial formal e persuasiva de venda de serviço para o cliente.
- Empresa do Cliente: ${company}
- Contato do Cliente: ${contact || 'Responsável'}
- Serviço a ser prestado: ${service}
- Valor sugerido: ${value ? 'R$ ' + value : 'A combinar'}

Estruture a proposta em tópicos curtos e objetivos:
1. Introdução / Boas-vindas
2. Desafios comuns e solução proposta
3. Escopo do serviço e entregáveis principais
4. Condições comerciais e próximos passos

Seja profissional, direto e use uma linguagem persuasiva focada em fechamento comercial. Retorne APENAS o texto da proposta em formato limpo, sem cabeçalhos do tipo "Aqui está a proposta..." ou rodapés de IA.`;

            const res = await fetch(`/api/gemini-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro ao gerar proposta.";
            
            notesTextarea.value = text;
        } catch (err) {
            console.error("Erro ao gerar proposta com IA:", err);
            alert("Não foi possível gerar a proposta com a IA. Tente novamente.");
        } finally {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    },

    exportProposalToPDF(id) {
        const jsPDFLib = window.jspdf;
        if (!jsPDFLib || !jsPDFLib.jsPDF) {
            alert("Biblioteca jsPDF não carregada. Recarregue a página e tente novamente.");
            return;
        }
        const { jsPDF } = jsPDFLib;

        const proposal = Store.getProposalById(id);
        if (!proposal) {
            alert("Proposta não encontrada.");
            return;
        }

        const leads = Store.getLeads();
        const lead = leads.find(l => l.company.toLowerCase() === proposal.company.toLowerCase());

        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const pageW = 210;
        const pageH = 297;

        const BRAND_COLOR = [59, 130, 246];
        const DARK_COLOR  = [15, 23, 42];
        const GRAY_COLOR  = [100, 116, 139];
        const WHITE       = [255, 255, 255];
        const GREEN_COLOR = [16, 185, 129];

        // 1. HEADER BANNER
        doc.setFillColor(...DARK_COLOR);
        doc.rect(0, 0, pageW, 40, "F");

        // Brand Logo
        doc.setFillColor(...BRAND_COLOR);
        doc.roundedRect(14, 10, 26, 20, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...WHITE);
        doc.text("Vellia", 17, 22);
        doc.setFontSize(7);
        doc.text("CRM", 31, 22);

        // Title and sub info
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(...WHITE);
        doc.text("PROPOSTA COMERCIAL", 48, 19);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Proposta Nº: ${proposal.id.substring(0, 8).toUpperCase()}   •   Status: ${proposal.status.toUpperCase()}`, 48, 28);

        // 2. METADATA & CLIENT CARDS
        let y = 52;
        
        // Client Card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, y, 88, 38, 3, 3, "FD");
        // Accent Left
        doc.setFillColor(...BRAND_COLOR);
        doc.rect(14, y, 3, 38, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_COLOR);
        doc.text("CLIENTE PROPONENTE", 21, y + 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...DARK_COLOR);
        doc.text(proposal.company || "—", 21, y + 17);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GRAY_COLOR);
        doc.text(`Contato: ${proposal.contact || "—"}`, 21, y + 25);
        if (lead) {
            doc.text(`Tel: ${lead.whatsapp || lead.phone || "—"}`, 21, y + 31);
        }

        // Proposal Info Card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(108, y, 88, 38, 3, 3, "FD");
        // Accent Left
        doc.setFillColor(...GREEN_COLOR);
        doc.rect(108, y, 3, 38, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_COLOR);
        doc.text("CONDIÇÕES COMERCIAIS", 115, y + 8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GRAY_COLOR);
        doc.text(`Data de Emissão: ${proposal.sentAt ? new Date(proposal.sentAt).toLocaleDateString("pt-BR") : "—"}`, 115, y + 16);
        doc.text(`Válida até: ${proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString("pt-BR") : "A combinar"}`, 115, y + 22);
        doc.text(`Serviço: ${proposal.service || "Serviço Técnico"}`, 115, y + 28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...GREEN_COLOR);
        const fmtVal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(proposal.value || 0);
        doc.text(`Valor Total: ${fmtVal}`, 115, y + 34);

        // 3. SCOPE & NOTES SECTION
        y = 100;
        doc.setFillColor(...BRAND_COLOR);
        doc.rect(14, y, 3, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...DARK_COLOR);
        doc.text("Detalhamento do Escopo e Observações", 20, y + 4.5);
        
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85); // Slate 700
        
        const notesText = proposal.notes || "Nenhuma observação ou escopo específico anexado.";
        const lines = doc.splitTextToSize(notesText, pageW - 28);
        
        for (const line of lines) {
            if (y > pageH - 45) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, 14, y);
            y += 6; // line spacing
        }

        // 4. SIGNATURES
        if (y > pageH - 55) {
            doc.addPage();
            y = 30;
        } else {
            y += 20;
        }

        const sigW = 75;
        const sigY = y + 15;

        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);

        // Proponente
        doc.line(14, sigY, 14 + sigW, sigY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...DARK_COLOR);
        doc.text("Vellia Comercial & Engenharia", 14, sigY + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_COLOR);
        doc.text("Responsável Técnico/Vendas", 14, sigY + 9);

        // Cliente
        doc.line(pageW - 14 - sigW, sigY, pageW - 14, sigY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...DARK_COLOR);
        doc.text(proposal.company || "O Cliente", pageW - 14 - sigW, sigY + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_COLOR);
        doc.text("Aceito e De Acordo", pageW - 14 - sigW, sigY + 9);

        // 5. FOOTER STYLING
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            
            // Draw a bottom accent line or full banner
            doc.setFillColor(...DARK_COLOR);
            doc.rect(0, pageH - 12, pageW, 12, "F");
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("Vellia CRM — Sistema Comercial Inteligente  •  Documento confidencial", 14, pageH - 4.5);
            
            doc.setTextColor(...WHITE);
            doc.text(`Página ${i} de ${totalPages}`, pageW - 28, pageH - 4.5);
        }

        const safeName = (proposal.company || "Cliente").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").substring(0, 20);
        doc.save(`Proposta_${safeName}_${proposal.id.substring(0, 8)}.pdf`);
    }
};
