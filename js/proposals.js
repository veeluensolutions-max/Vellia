import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";
import { parseCurrency } from "./utils.js";


// Funções auxiliares à prova de fuso horário (evitam recuo de dia no Brasil GMT-3)
export function formatProposalDate(dateStr, options = null) {
    if (!dateStr) return "—";
    if (typeof dateStr === "string") {
        const clean = dateStr.trim();
        const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [_, y, m, d] = match;
            if (!options) {
                return `${d}/${m}/${y}`;
            }
            const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
            const mIdx = parseInt(m, 10) - 1;
            return `${d} de ${monthNames[mIdx] || m} de ${y}`;
        }
    }
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", options || undefined);
    } catch (e) {
        return "—";
    }
}

export function getIsoDateInput(dateVal) {
    if (!dateVal) return new Date().toISOString().split('T')[0];
    if (typeof dateVal === "string") {
        const match = dateVal.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
    try {
        const d = new Date(dateVal);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch(e) {
        return new Date().toISOString().split('T')[0];
    }
}

let activeProposalId = null;
let isSaving = false;
let currentEditingBudgetId = null;
let currentEditingLeadId = null;
let currentBudgetAttachments = [];
let currentPrintProposal = null;

export const Proposals = {
    formatProposalDate,
    getIsoDateInput,
    _eventsBound: false,
    init() {
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();
        this.populateClientsDatalist();
        if (!this._eventsBound) {
            this.bindEvents();
            this._eventsBound = true;
        }
    },

    bindEvents() {
        // Botão Nova Proposta (Abre tela completa estilo GestãoClick)
        const btnNew = document.getElementById("btn-new-proposal");
        if (btnNew) btnNew.addEventListener("click", () => this.openBudgetScreen());

        // Controles da tela GestãoClick de Orçamento
        const btnGcSubmit = document.getElementById("gc-btn-submit");
        if (btnGcSubmit) btnGcSubmit.addEventListener("click", () => this.saveBudgetProposal());

        const btnGcCancel = document.getElementById("gc-btn-cancel");
        if (btnGcCancel) btnGcCancel.addEventListener("click", () => this.closeBudgetScreen());

        const btnGcDelete = document.getElementById("gc-btn-delete");
        if (btnGcDelete) {
            btnGcDelete.addEventListener("click", () => {
                if (currentEditingBudgetId) this.deleteProposal(currentEditingBudgetId);
            });
        }

        const btnGcAddService = document.getElementById("gc-btn-add-service");
        if (btnGcAddService) btnGcAddService.addEventListener("click", () => this.addServiceRow());

        const btnGcAddProduct = document.getElementById("gc-btn-add-product");
        if (btnGcAddProduct) btnGcAddProduct.addEventListener("click", () => this.addProductRow());

        const btnGcEditNumber = document.getElementById("gc-btn-edit-number");
        if (btnGcEditNumber) {
            btnGcEditNumber.addEventListener("click", () => {
                const numInput = document.getElementById("gc-budget-number");
                if (numInput) {
                    numInput.readOnly = false;
                    numInput.classList.remove("gc-input-readonly");
                    numInput.focus();
                }
            });
        }

        const btnGcClearSeller = document.getElementById("gc-btn-clear-seller");
        if (btnGcClearSeller) {
            btnGcClearSeller.addEventListener("click", () => {
                const sellerInput = document.getElementById("gc-budget-seller");
                if (sellerInput) sellerInput.value = "";
            });
        }

        const checkGcDelivery = document.getElementById("gc-check-delivery-address");
        if (checkGcDelivery) {
            checkGcDelivery.addEventListener("change", (e) => {
                const container = document.getElementById("gc-delivery-address-container");
                if (container) container.style.display = e.target.checked ? "block" : "none";
            });
        }

        document.querySelectorAll('input[name="gc-payment-type"]').forEach(r => {
            r.addEventListener("change", (e) => {
                const container = document.getElementById("gc-installments-container");
                if (container) container.style.display = e.target.value === "parcelado" ? "block" : "none";
            });
        });

        const btnGcSelectFile = document.getElementById("gc-btn-select-file");
        const inputGcFiles = document.getElementById("gc-budget-files");
        if (btnGcSelectFile && inputGcFiles) {
            btnGcSelectFile.addEventListener("click", () => inputGcFiles.click());
            inputGcFiles.addEventListener("change", (e) => this.handleBudgetFilesUpload(e));
        }

        // Controles de Localização e Vínculo de Lead no Orçamento
        const btnOpenLeadSelector = document.getElementById("gc-btn-open-lead-selector");
        if (btnOpenLeadSelector) {
            btnOpenLeadSelector.addEventListener("click", () => this.openSelectLeadModal());
        }
        const btnFindLead = document.getElementById("gc-btn-find-lead");
        if (btnFindLead) {
            btnFindLead.addEventListener("click", () => this.openSelectLeadModal());
        }
        const btnCloseLeadSelector = document.getElementById("gc-btn-close-lead-selector");
        if (btnCloseLeadSelector) {
            btnCloseLeadSelector.addEventListener("click", () => this.closeSelectLeadModal());
        }
        const inputLeadFilter = document.getElementById("gc-lead-search-filter");
        if (inputLeadFilter) {
            inputLeadFilter.addEventListener("input", (e) => this.renderLeadSelectorList(e.target.value));
        }
        const btnUnlinkLead = document.getElementById("gc-btn-unlink-lead");
        if (btnUnlinkLead) {
            btnUnlinkLead.addEventListener("click", () => this.unlinkLeadFromBudget());
        }

        // Detecção e preenchimento inteligente ao digitar o nome ou CNPJ do cliente
        const inputClient = document.getElementById("gc-budget-client");
        if (inputClient) {
            const handleMatch = () => {
                const val = inputClient.value.trim();
                if (!val) {
                    this.unlinkLeadFromBudget();
                    return;
                }
                const leads = Store.getLeads();
                const cleanDigits = val.replace(/\D/g, "");

                // 1. Match exato por empresa / razão social
                let matched = leads.find(l => l.company && l.company.toLowerCase().trim() === val.toLowerCase());

                // 2. Match por CNPJ
                if (!matched && cleanDigits.length >= 11) {
                    matched = leads.find(l => l.cnpj && l.cnpj.replace(/\D/g, "") === cleanDigits);
                }

                // 3. Match por Nome Fantasia
                if (!matched) {
                    matched = leads.find(l => l.tradeName && l.tradeName.toLowerCase().trim() === val.toLowerCase());
                }

                // 4. Se tiver digitado pelo menos 4 caracteres e houver exatamente 1 correspondência
                if (!matched && val.length >= 4) {
                    const partials = leads.filter(l => (l.company && l.company.toLowerCase().includes(val.toLowerCase())) || (l.tradeName && l.tradeName.toLowerCase().includes(val.toLowerCase())));
                    if (partials.length === 1) {
                        matched = partials[0];
                    }
                }

                if (matched) {
                    this.applyLeadToBudget(matched);
                }
            };

            inputClient.addEventListener("change", handleMatch);
            inputClient.addEventListener("input", (e) => {
                const val = e.target.value.trim();
                const leads = Store.getLeads();
                const matched = leads.find(l => l.company && l.company.toLowerCase().trim() === val.toLowerCase());
                if (matched) {
                    this.applyLeadToBudget(matched);
                }
            });
        }

        // Busca automática de endereço pelo CEP na entrega do orçamento
        const inputDeliveryCep = document.getElementById("gc-delivery-cep");
        if (inputDeliveryCep) {
            inputDeliveryCep.addEventListener("input", async (e) => {
                let v = e.target.value.replace(/\D/g, "");
                if (v.length > 8) v = v.substring(0, 8);
                if (v.length > 5) {
                    e.target.value = `${v.substring(0, 5)}-${v.substring(5)}`;
                }
                if (v.length === 8 && typeof CNPJService !== "undefined" && typeof CNPJService.lookupCEP === "function") {
                    try {
                        const cepData = await CNPJService.lookupCEP(v);
                        if (cepData) {
                            const setIfEmpty = (id, val) => {
                                const el = document.getElementById(id);
                                if (el && val) el.value = val;
                            };
                            setIfEmpty("gc-delivery-street", cepData.street);
                            setIfEmpty("gc-delivery-neighborhood", cepData.neighborhood);
                            setIfEmpty("gc-delivery-city", cepData.city);
                            setIfEmpty("gc-delivery-state", cepData.state);
                            document.getElementById("gc-delivery-number")?.focus();
                        }
                    } catch (err) {
                        console.warn("Falha na consulta de CEP na proposta:", err);
                    }
                }
            });
        }

        ["gc-budget-freight", "gc-total-discount-cash", "gc-total-discount-pct"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("input", () => this.recalculateBudgetTotals());
        });

        // Botão Ditado por Voz IA
        const btnVoice = document.getElementById("btn-voice-dictation-proposal");
        if (btnVoice) btnVoice.addEventListener("click", () => this.startVoiceProposalDictation());

        // Botão Sincronizar Propostas com Supabase
        const btnSyncCloud = document.getElementById("btn-sync-proposals-supabase");
        if (btnSyncCloud) {
            btnSyncCloud.addEventListener("click", async () => {
                const originalHtml = btnSyncCloud.innerHTML;
                btnSyncCloud.disabled = true;
                btnSyncCloud.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                    <span>Sincronizando...</span>
                `;
                try {
                    const res = await Store.syncProposalsWithSupabase();
                    if (res && res.success) {
                        this.renderStats();
                        this.renderTable();
                        this.renderLossAnalysis();
                        alert(`☁️ Sincronização concluída com sucesso!\n\n• Total no CRM: ${res.total}\n• Baixadas da nuvem: ${res.syncedFromCloud}\n• Enviadas para nuvem: ${res.uploadedToCloud}`);
                    } else {
                        alert(`Erro ao sincronizar com o Supabase: ${res?.error || 'Falha na conexão'}`);
                    }
                } catch (e) {
                    alert(`Falha na sincronização: ${e.message}`);
                } finally {
                    btnSyncCloud.innerHTML = originalHtml;
                    btnSyncCloud.disabled = false;
                }
            });
        }

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

        // Fechar modal legado
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

        // Interatividade de Cards de Serviços e Slider de Desconto
        this.bindProposalFormInteractive();

        // Busca e filtro
        const search = document.getElementById("proposals-search");
        if (search) search.addEventListener("input", () => this.renderTable());

        const filter = document.getElementById("proposals-filter-status");
        if (filter) {
            filter.addEventListener("change", (e) => {
                const colStatus = document.getElementById("prop-col-filter-status");
                if (colStatus) colStatus.value = e.target.value;
                this.renderTable();
            });
        }

        // Filtros dinâmicos por coluna da tabela de propostas
        const colCompany = document.getElementById("prop-col-filter-company");
        const colTitle = document.getElementById("prop-col-filter-title");
        const colValue = document.getElementById("prop-col-filter-value");
        const colStatus = document.getElementById("prop-col-filter-status");
        const colSent = document.getElementById("prop-col-filter-sent");
        const colValidity = document.getElementById("prop-col-filter-validity");
        const btnClearColFilters = document.getElementById("btn-clear-prop-col-filters");

        if (colCompany) colCompany.addEventListener("input", () => this.renderTable());
        if (colTitle) colTitle.addEventListener("input", () => this.renderTable());
        if (colValue) colValue.addEventListener("change", () => this.renderTable());
        if (colStatus) {
            colStatus.addEventListener("change", (e) => {
                const topFilter = document.getElementById("proposals-filter-status");
                if (topFilter) topFilter.value = e.target.value;
                this.renderTable();
            });
        }
        if (colSent) colSent.addEventListener("input", () => this.renderTable());
        if (colValidity) colValidity.addEventListener("change", () => this.renderTable());

        if (btnClearColFilters) {
            btnClearColFilters.addEventListener("click", () => {
                if (colCompany) colCompany.value = "";
                if (colTitle) colTitle.value = "";
                if (colValue) colValue.value = "all";
                if (colStatus) colStatus.value = "all";
                if (colSent) colSent.value = "";
                if (colValidity) colValidity.value = "all";
                const topSearch = document.getElementById("proposals-search");
                if (topSearch) topSearch.value = "";
                const topFilter = document.getElementById("proposals-filter-status");
                if (topFilter) topFilter.value = "all";
                this.renderTable();
            });
        }

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

        const btnReopen = document.getElementById("btn-proposal-reopen");
        if (btnReopen) btnReopen.addEventListener("click", () => this.reopenProposal());

        const btnDeleteProp = document.getElementById("btn-proposal-delete");
        if (btnDeleteProp) btnDeleteProp.addEventListener("click", () => this.deleteProposal());

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

        // Aceite Online da Proposta
        const btnOnlineLink = document.getElementById("btn-proposal-online-link");
        if (btnOnlineLink) {
            btnOnlineLink.addEventListener("click", () => {
                if (activeProposalId) this.openOnlineApprovalView(activeProposalId);
            });
        }

        const btnCopyLink = document.getElementById("btn-copy-approval-link");
        if (btnCopyLink) {
            btnCopyLink.addEventListener("click", () => {
                const link = `${window.location.origin}/#proposta?id=${activeProposalId}`;
                navigator.clipboard.writeText(link);
                alert("🔗 Link de Aceite Online copiado para a área de transferência:\n" + link);
            });
        }

        const btnConfirmApproval = document.getElementById("btn-confirm-online-approval");
        if (btnConfirmApproval) {
            btnConfirmApproval.addEventListener("click", () => this.confirmOnlineProposalApproval());
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

        // Botões de Impressão e PDF com Papel Timbrado Profissional
        const btnGcPrint = document.getElementById("gc-btn-print");
        if (btnGcPrint) {
            btnGcPrint.addEventListener("click", () => this.openPrintPreview());
        }

        const btnPropPrint = document.getElementById("btn-proposal-print");
        if (btnPropPrint) {
            btnPropPrint.addEventListener("click", () => {
                if (activeProposalId) this.openPrintPreview(activeProposalId);
            });
        }

        const btnPrintModalTrigger = document.getElementById("btn-print-modal-trigger");
        if (btnPrintModalTrigger) {
            btnPrintModalTrigger.addEventListener("click", () => this.printActiveProposalDocument());
        }

        const btnPrintModalDownload = document.getElementById("btn-print-modal-download");
        if (btnPrintModalDownload) {
            btnPrintModalDownload.addEventListener("click", () => {
                this.exportProposalToPDF(currentPrintProposal?.id || currentPrintProposal);
            });
        }

        const btnClosePrintModal = document.getElementById("btn-close-proposal-print");
        if (btnClosePrintModal) {
            btnClosePrintModal.addEventListener("click", () => this.closePrintPreview());
        }

        const btnGenDocs = document.getElementById("btn-proposal-generate-docs");
        if (btnGenDocs) {
            btnGenDocs.addEventListener("click", () => this.generateDocsFromProposal());
        }
    },

    // ==========================================================================
    // CONTROLE DE ACESSO A ORÇAMENTOS
    // ==========================================================================
    getFilteredProposalsForUser() {
        let proposals = Store.getProposals() || [];
        const currentUser = Auth.getCurrentUser();
        const role = (currentUser?.role || "").toLowerCase().trim();
        const isAdmin = role === "admin" || role === "manager" || role === "gerente";

        if (!isAdmin && currentUser) {
            const userEmail = (currentUser.email || "").toLowerCase().trim();
            const userName = (currentUser.name || "").toLowerCase().trim();
            const userLeads = (Store.getLeads() || []).filter(l => {
                const owner = (l.owner || "").toLowerCase().trim();
                const createdBy = (l.createdBy || "").toLowerCase().trim();
                return owner === userEmail || createdBy === userEmail;
            });
            const allowedLeadIds = new Set(userLeads.map(l => String(l.id)));
            const allowedCompanies = new Set(userLeads.map(l => (l.company || "").toLowerCase().trim()));

            proposals = proposals.filter(p => {
                const author = (p.authorEmail || p.createdBy || "").toLowerCase().trim();
                const seller = (p.seller || "").toLowerCase().trim();
                const company = (p.company || "").toLowerCase().trim();
                const leadId = p.leadId ? String(p.leadId) : "";

                return author === userEmail ||
                       seller === userName ||
                       (leadId && allowedLeadIds.has(leadId)) ||
                       (company && allowedCompanies.has(company));
            });
        }
        return proposals;
    },

    // ==========================================================================
    // KPI STATS
    // ==========================================================================
    renderStats() {
        const proposals = this.getFilteredProposalsForUser();
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

        const proposals = this.getFilteredProposalsForUser();
        const search = document.getElementById("proposals-search")?.value.toLowerCase().trim() || "";
        const statusFilter = document.getElementById("proposals-filter-status")?.value || "all";

        // Filtros específicos por coluna
        const colCompany = (document.getElementById("prop-col-filter-company")?.value || "").toLowerCase().trim();
        const colTitle = (document.getElementById("prop-col-filter-title")?.value || "").toLowerCase().trim();
        const colValueRange = document.getElementById("prop-col-filter-value")?.value || "all";
        const colStatus = document.getElementById("prop-col-filter-status")?.value || "all";
        const colSent = (document.getElementById("prop-col-filter-sent")?.value || "").toLowerCase().trim();
        const colValidity = document.getElementById("prop-col-filter-validity")?.value || "all";

        const todayMs = new Date().setHours(0, 0, 0, 0);

        const filtered = proposals.filter(p => {
            const company = (p.company || "").toLowerCase();
            const contact = (p.contact || "").toLowerCase();
            const title = (p.title || "").toLowerCase();
            const status = p.status || "";

            // Busca geral superior (se preenchida)
            if (search) {
                const matchSearch = company.includes(search) || title.includes(search) || contact.includes(search);
                if (!matchSearch) return false;
            }

            // Status geral superior
            const normalizedStatus = status === "Aguardando Agendamento" ? "Ganho" : status;
            if (statusFilter !== "all" && normalizedStatus !== statusFilter && status !== statusFilter) {
                return false;
            }

            // 1. Coluna Empresa / Contato
            if (colCompany) {
                const matchCompany = company.includes(colCompany) || contact.includes(colCompany);
                if (!matchCompany) return false;
            }

            // 2. Coluna Título da Proposta
            if (colTitle) {
                if (!title.includes(colTitle)) return false;
            }

            // 3. Coluna Valor (Faixas de valores)
            if (colValueRange !== "all") {
                const val = parseFloat(p.value) || 0;
                if (colValueRange === "0-5k" && !(val <= 5000)) return false;
                if (colValueRange === "5k-15k" && !(val > 5000 && val <= 15000)) return false;
                if (colValueRange === "15k-50k" && !(val > 15000 && val <= 50000)) return false;
                if (colValueRange === "50k+" && !(val > 50000)) return false;
            }

            // 4. Coluna Status
            if (colStatus !== "all" && normalizedStatus !== colStatus && status !== colStatus) {
                return false;
            }

            // 5. Coluna Enviada em
            if (colSent) {
                const sentStr = p.sentAt ? formatProposalDate(p.sentAt) : "";
                const rawSent = (p.sentAt || "").toLowerCase();
                if (!sentStr.toLowerCase().includes(colSent) && !rawSent.includes(colSent)) {
                    return false;
                }
            }

            // 6. Coluna Válida até (Prazo e vencimento)
            if (colValidity !== "all") {
                if (!p.validUntil) return false;
                const validDate = new Date(p.validUntil);
                const diffMs = validDate.getTime() - todayMs;
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                if (colValidity === "valid") {
                    if (diffDays < 0) return false;
                } else if (colValidity === "expired") {
                    if (diffDays >= 0) return false;
                } else if (colValidity === "7d") {
                    if (diffDays < 0 || diffDays > 7) return false;
                } else if (colValidity === "15d") {
                    if (diffDays < 0 || diffDays > 15) return false;
                } else if (colValidity === "30d") {
                    if (diffDays < 0 || diffDays > 30) return false;
                }
            }

            return true;
        });

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const tfoot = document.getElementById("proposals-table-foot");

        const totalCount = filtered.length;
        const allCount = proposals.length;
        const totalValue = filtered.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
        const avgValue = totalCount > 0 ? (totalValue / totalCount) : 0;

        if (tfoot) {
            if (totalCount === 0) {
                tfoot.innerHTML = `
                    <tr style="background: var(--bg-app, #F8FAFC); border-top: 2px solid var(--border-color, #E2E8F0); font-size: 13px;">
                        <td colspan="7" style="padding: 12px 16px; color: var(--text-muted); text-align: center; font-size: 12px;">
                            <span>📊 Total Filtrado: <strong>0 propostas</strong> (${allCount} cadastradas no total) | Valor Total: <strong>R$ 0,00</strong></span>
                        </td>
                    </tr>
                `;
            } else {
                // Status breakdown
                const statusCounts = {};
                filtered.forEach(p => {
                    const rawSt = p.status || "Outro";
                    const st = rawSt === "Aguardando Agendamento" ? "Ganho" : rawSt;
                    statusCounts[st] = (statusCounts[st] || 0) + 1;
                });

                const statusBadgesHtml = Object.entries(statusCounts)
                    .map(([st, cnt]) => `<span style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-color, #CBD5E1); padding: 2.5px 8px; border-radius: 6px; color: var(--text-secondary, #475569);"><strong style="color: var(--text-primary, #1E293B);">${cnt}</strong> ${st}</span>`)
                    .join("");

                tfoot.innerHTML = `
                    <tr style="background: var(--bg-app, #F8FAFC); border-top: 2px solid var(--border-color, #E2E8F0); font-size: 13px;">
                        <td style="padding: 12px 14px; font-weight: 700; color: var(--text-primary);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 15px;">📊</span>
                                <span>Total Filtrado:</span>
                                <span class="badge" style="background: rgba(37,99,235,0.12); color: #2563EB; font-weight: 700; border-radius: 6px; padding: 3px 8px; font-size: 11.5px; border: 1px solid rgba(37,99,235,0.25);">
                                    ${totalCount} ${totalCount === 1 ? 'proposta' : 'propostas'} ${totalCount !== allCount ? `(de ${allCount})` : ''}
                                </span>
                            </div>
                        </td>
                        <td style="padding: 12px 14px; color: var(--text-secondary); font-size: 12px;">
                            Ticket Médio: <strong style="color: var(--text-primary); font-size: 13px;">${fmt(avgValue)}</strong>
                        </td>
                        <td style="padding: 12px 14px; font-weight: 800; color: #10B981; font-size: 15px;">
                            ${fmt(totalValue)}
                        </td>
                        <td colspan="4" style="padding: 12px 14px; text-align: right;">
                            <div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; font-size: 11.5px;">
                                ${statusBadgesHtml}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">
                        Nenhuma proposta encontrada para os filtros aplicados.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const sentDate = p.sentAt ? formatProposalDate(p.sentAt) : "—";
            const validDate = p.validUntil ? formatProposalDate(p.validUntil) : "—";
            const isExpired = p.validUntil && new Date(p.validUntil) < new Date() && p.status === "Enviada";

            const statusBadge = this.getStatusBadge(p.status);
            const isWonStatus = ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status);
            const isLostStatus = p.status === "Perdido";

            return `
                <tr data-id="${p.id}" style="cursor: pointer;">
                    <td style="min-width: 180px;">
                        <div class="table-company-cell">
                            <div class="table-avatar">${(p.company || 'P').substring(0, 2).toUpperCase()}</div>
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 13.5px; line-height: 1.25;">${p.company}</div>
                                <div style="font-size: 11.5px; color: var(--text-muted);">${p.contact || '—'}</div>
                            </div>
                        </div>
                    </td>
                    <td style="max-width: 220px;">
                        <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.title}">${p.title}</div>
                    </td>
                    <td style="font-weight: 700; color: var(--text-primary); font-size: 13.5px;">${fmt(p.value)}</td>
                    <td>${statusBadge}</td>
                    <td style="font-size: 12px; color: var(--text-secondary);">${sentDate}</td>
                    <td style="font-size: 12px; color: ${isExpired ? 'var(--danger)' : 'var(--text-secondary)'};">
                        ${validDate} ${isExpired ? '⚠️' : ''}
                    </td>
                    <td style="text-align: right; white-space: nowrap;" onclick="event.stopPropagation();">
                        <div style="display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end;">
                            ${!isWonStatus ? `
                                <button type="button" class="btn btn-sm btn-outline btn-row-win-proposal" data-id="${p.id}" style="font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 6px; color: #059669; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);" title="Marcar proposta como Ganha">
                                    ✓ Ganho
                                </button>
                            ` : ''}
                            ${!isLostStatus ? `
                                <button type="button" class="btn btn-sm btn-outline btn-row-lose-proposal" data-id="${p.id}" style="font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 6px; color: #DC2626; border-color: rgba(220, 38, 38, 0.38); background: rgba(220, 38, 38, 0.06);" title="${isWonStatus ? 'Informar que a proposta foi perdida (reverter venda caso a empresa desista)' : 'Informar que a proposta foi perdida'}">
                                    ✕ ${isWonStatus ? 'Proposta Perdida' : 'Perdida'}
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm btn-outline btn-row-reopen-proposal" data-id="${p.id}" style="font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 6px; color: #D97706; border-color: rgba(217, 119, 6, 0.38); background: rgba(217, 119, 6, 0.08);" title="Reverter proposta perdida para Em Negociação">
                                    🔄 Reabrir
                                </button>
                            `}
                            <button type="button" class="btn btn-sm btn-outline btn-view-proposal" data-id="${p.id}" style="font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: 6px;" title="Visualizar detalhes">Ver</button>
                            <button type="button" class="btn btn-sm btn-outline btn-row-edit-proposal" data-id="${p.id}" style="font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; color: var(--primary); border-color: rgba(99, 102, 241, 0.35); background: rgba(99, 102, 241, 0.06); display: inline-flex; align-items: center; gap: 4px;" title="Editar orçamento">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Editar
                            </button>
                            <button type="button" class="btn btn-sm btn-outline btn-row-delete-proposal" data-id="${p.id}" style="font-size: 12px; font-weight: 600; padding: 4px 9px; border-radius: 6px; color: #DC2626; border-color: rgba(220, 38, 38, 0.35); background: rgba(220, 38, 38, 0.06); display: inline-flex; align-items: center; gap: 4px;" title="Excluir proposta">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Excluir
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // Eventos de clique
        tbody.querySelectorAll("tr[data-id]").forEach(row => {
            row.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                this.openDetailModal(row.getAttribute("data-id"));
            });
        });
        tbody.querySelectorAll(".btn-view-proposal").forEach(btn => {
            btn.addEventListener("click", () => this.openDetailModal(btn.getAttribute("data-id")));
        });
        tbody.querySelectorAll(".btn-row-win-proposal").forEach(btn => {
            btn.addEventListener("click", () => {
                activeProposalId = btn.getAttribute("data-id");
                this.openWinModal();
            });
        });
        tbody.querySelectorAll(".btn-row-lose-proposal").forEach(btn => {
            btn.addEventListener("click", () => {
                activeProposalId = btn.getAttribute("data-id");
                this.openLossModal(activeProposalId);
            });
        });
        tbody.querySelectorAll(".btn-row-reopen-proposal").forEach(btn => {
            btn.addEventListener("click", () => {
                activeProposalId = btn.getAttribute("data-id");
                this.reopenProposal(activeProposalId);
            });
        });
        tbody.querySelectorAll(".btn-row-edit-proposal").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                this.openBudgetScreen(id);
            });
        });
        tbody.querySelectorAll(".btn-row-delete-proposal").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                this.deleteProposal(id);
            });
        });
    },

    getStatusBadge(status) {
        const map = {
            "Enviada": `<span class="badge" style="background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">Enviada</span>`,
            "Em Negociação": `<span class="badge" style="background: #FAF5FF; color: #7C3AED; border: 1px solid #E9D5FF; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">Em Negociação</span>`,
            "Ganho": `<span class="badge" style="background: #ECFDF5; color: #16A36A; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">● Ganho</span>`,
            "Aguardando Agendamento": `<span class="badge" style="background: #ECFDF5; color: #16A36A; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">● Ganho</span>`,
            "Agendada": `<span class="badge" style="background: #ECFDF5; color: #16A36A; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">🗓️ Agendada</span>`,
            "Perdido": `<span class="badge" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">● Perdido</span>`,
            "Cancelada": `<span class="badge" style="background: #F3F4F6; color: #4B5563; border: 1px solid #E5E7EB; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">Cancelada</span>`
        };
        return map[status] || `<span class="badge" style="background: #F3F4F6; color: #4B5563; border: 1px solid #E5E7EB; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 3px 8px;">${status}</span>`;
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


    bindProposalFormInteractive() {
        const cardsContainer = document.getElementById("proposal-service-cards");
        const serviceSelect = document.getElementById("proposal-service");
        const titleInput = document.getElementById("proposal-title");
        const baseValInput = document.getElementById("proposal-base-value");
        const discountSlider = document.getElementById("proposal-discount-range");

        if (cardsContainer) {
            cardsContainer.addEventListener("click", (e) => {
                const card = e.target.closest(".service-choice-card");
                if (!card) return;

                cardsContainer.querySelectorAll(".service-choice-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");

                const service = card.getAttribute("data-service");
                const defaultTitle = card.getAttribute("data-title");

                if (serviceSelect && service) {
                    serviceSelect.value = service;
                }
                if (titleInput && defaultTitle) {
                    titleInput.value = defaultTitle;
                }
            });
        }

        if (baseValInput) {
            baseValInput.addEventListener("input", () => this.updatePricingSummary());
        }

        if (discountSlider) {
            discountSlider.addEventListener("input", () => this.updatePricingSummary());
        }
    },

    updatePricingSummary() {
        const baseValInput = document.getElementById("proposal-base-value");
        const discountSlider = document.getElementById("proposal-discount-range");
        const discountBadge = document.getElementById("proposal-discount-badge");
        const summaryBase = document.getElementById("summary-base-val");
        const summaryDiscount = document.getElementById("summary-discount-val");
        const summaryFinal = document.getElementById("summary-final-val");
        const hiddenValue = document.getElementById("proposal-value");

        const baseVal = parseFloat(baseValInput?.value) || 0;
        const discountPct = parseInt(discountSlider?.value) || 0;

        const discountAmount = baseVal * (discountPct / 100);
        const finalVal = Math.max(0, baseVal - discountAmount);

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        if (discountBadge) {
            discountBadge.textContent = discountPct === 0 ? "0% de Desconto (Tabela)" : `${discountPct}% de Desconto`;
        }

        if (summaryBase) summaryBase.textContent = fmt(baseVal);
        if (summaryDiscount) summaryDiscount.textContent = discountPct === 0 ? "R$ 0,00 (0%)" : `- ${fmt(discountAmount)} (${discountPct}%)`;
        if (summaryFinal) summaryFinal.textContent = fmt(finalVal);
        if (hiddenValue) hiddenValue.value = finalVal.toFixed(2);
    },

    // ==========================================================================
    // TELA DE ORÇAMENTOS E PROPOSTAS ESTILO GESTÃOCLICK (IDÊNTICA)
    // ==========================================================================
    populateClientsDatalist() {
        const datalist = document.getElementById("gc-clients-datalist");
        if (!datalist) return;
        const leads = Store.getLeads();
        const proposals = Store.getProposals();
        const seen = new Set();
        const options = [];

        // Prioridade para Leads cadastrados no CRM
        leads.forEach(l => {
            if (l.company && !seen.has(l.company.trim().toLowerCase())) {
                seen.add(l.company.trim().toLowerCase());
                const contactStr = l.contact ? ` • ${l.contact}` : '';
                const cityStr = l.city ? ` (${l.city}/${l.state || ''})` : '';
                options.push(`<option value="${l.company}">${l.company}${contactStr}${cityStr}</option>`);
            }
        });

        // Propostas anteriores
        proposals.forEach(p => {
            if (p.company && !seen.has(p.company.trim().toLowerCase())) {
                seen.add(p.company.trim().toLowerCase());
                options.push(`<option value="${p.company}">${p.company}</option>`);
            }
        });

        datalist.innerHTML = options.join("");
    },

    applyLeadToBudget(lead) {
        if (!lead) return;
        currentEditingLeadId = lead.id;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        // 1. Dados Básicos do Cliente
        setVal("gc-budget-client", lead.company || "");
        setVal("gc-budget-attention", lead.contact || "");

        // 2. Vendedor / Responsável
        const currentUser = Auth.getCurrentUser();
        let sellerName = currentUser?.name || "San Charles";
        if (lead.owner) {
            const allUsers = Store.getUsers ? Store.getUsers() : [];
            const ownerUser = allUsers.find(u => u.email === lead.owner);
            if (ownerUser) sellerName = ownerUser.name || ownerUser.email;
        }
        setVal("gc-budget-seller", sellerName);

        // 3. Canal de Venda inteligente baseado na Origem do lead
        if (lead.source) {
            const s = lead.source.toLowerCase();
            let channel = "Presencial";
            if (s.includes("whatsapp")) channel = "WhatsApp";
            else if (s.includes("telefone") || s.includes("ligação")) channel = "Telefone";
            else if (s.includes("email") || s.includes("e-mail")) channel = "E-mail";
            else if (s.includes("indicação") || s.includes("indicacao")) channel = "Indicação";
            else if (s.includes("google") || s.includes("meta") || s.includes("site") || s.includes("web")) channel = "Site Institucional";
            setVal("gc-budget-channel", channel);
        }

        // 4. Endereço Completo de Entrega
        const checkDelivery = document.getElementById("gc-check-delivery-address");
        const containerDelivery = document.getElementById("gc-delivery-address-container");
        const hasAddress = !!(lead.cep || lead.street || lead.address || lead.city || lead.state);
        if (checkDelivery) checkDelivery.checked = hasAddress;
        if (containerDelivery) containerDelivery.style.display = hasAddress ? "block" : "none";

        if (hasAddress) {
            const formattedCep = lead.cep ? (typeof CNPJService !== "undefined" && CNPJService.formatCEP ? CNPJService.formatCEP(lead.cep) : lead.cep) : "";
            setVal("gc-delivery-cep", formattedCep);
            setVal("gc-delivery-street", lead.street || lead.address || "");
            setVal("gc-delivery-number", lead.number || "");
            setVal("gc-delivery-neighborhood", lead.neighborhood || "");
            setVal("gc-delivery-city", lead.city || "");
            setVal("gc-delivery-state", lead.state || "");
        }

        // 5. Notas internas ricas com todos os dados do lead
        const details = [];
        if (lead.contact) details.push(`Contato: ${lead.contact}${lead.role ? ` (${lead.role})` : ''}`);
        if (lead.whatsapp) details.push(`WhatsApp: ${lead.whatsapp}`);
        if (lead.phone) details.push(`Telefone: ${lead.phone}`);
        if (lead.phone2) details.push(`Telefone 2: ${lead.phone2}`);
        if (lead.email) details.push(`E-mail: ${lead.email}`);
        if (lead.cnpj) details.push(`CNPJ: ${typeof CNPJService !== "undefined" && CNPJService.formatCNPJ ? CNPJService.formatCNPJ(lead.cnpj) : lead.cnpj}`);
        if (lead.segment || lead.source) details.push(`Segmento / Origem: ${lead.segment || ''} (${lead.source || ''})`);
        if (lead.city || lead.state) details.push(`Localização: ${lead.city || '-'} / ${lead.state || '-'}`);
        if (lead.address) details.push(`Endereço Cadastral: ${lead.address}`);
        if (lead.notes) details.push(`\nObservações do Lead:\n${lead.notes}`);
        setVal("gc-budget-internal-notes", details.join("\n"));

        // 6. Atualizar descrição padrão do serviço caso esteja vazia ou genérica
        const serviceDetailInput = document.querySelector("#gc-services-tbody input.gc-input-detail");
        if (serviceDetailInput && (!serviceDetailInput.value || serviceDetailInput.value === "Atendimento técnico e operacional")) {
            serviceDetailInput.value = `Atendimento especializado para ${lead.company}`;
        }

        // 7. Badge visual de confirmação do lead vinculado
        const badge = document.getElementById("gc-lead-badge-info");
        const badgeText = document.getElementById("gc-lead-badge-text");
        if (badge && badgeText) {
            const cnpjFmt = lead.cnpj ? (typeof CNPJService !== "undefined" && CNPJService.formatCNPJ ? ` • ${CNPJService.formatCNPJ(lead.cnpj)}` : ` • ${lead.cnpj}`) : '';
            const contactFmt = lead.contact ? ` • ${lead.contact}` : '';
            badgeText.textContent = `Lead vinculado: ${lead.company}${contactFmt}${cnpjFmt}`;
            badge.style.display = "flex";
        }

        this.showBudgetToast(`Lead "${lead.company}" localizado! Dados preenchidos na proposta.`);
    },

    unlinkLeadFromBudget() {
        currentEditingLeadId = null;
        const badge = document.getElementById("gc-lead-badge-info");
        if (badge) badge.style.display = "none";
    },

    openSelectLeadModal() {
        const modal = document.getElementById("gc-lead-selector-modal");
        const overlay = document.getElementById("modal-overlay");
        if (!modal) return;

        this.renderLeadSelectorList("");
        modal.classList.add("open");
        modal.style.display = "flex";
        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";
        if (overlay) {
            overlay.classList.add("open");
            overlay.style.display = "block";
            overlay.style.opacity = "1";
        }

        const filterInput = document.getElementById("gc-lead-search-filter");
        if (filterInput) {
            filterInput.value = "";
            setTimeout(() => filterInput.focus(), 80);
        }
    },

    closeSelectLeadModal() {
        const modal = document.getElementById("gc-lead-selector-modal");
        const overlay = document.getElementById("modal-overlay");
        if (modal) {
            modal.classList.remove("open");
            modal.style.display = "none";
            modal.style.opacity = "";
            modal.style.pointerEvents = "";
        }
        if (overlay && !document.getElementById("new-lead-modal")?.classList.contains("open") && !document.getElementById("edit-lead-modal")?.classList.contains("open")) {
            overlay.classList.remove("open");
            overlay.style.display = "none";
        }
    },

    renderLeadSelectorList(filter = "") {
        const listEl = document.getElementById("gc-lead-selector-list");
        if (!listEl) return;

        const leads = Store.getLeads();
        const q = filter.toLowerCase().trim();
        const cleanQ = q.replace(/\D/g, "");

        const filtered = leads.filter(l => {
            if (!q) return true;
            if (l.company && l.company.toLowerCase().includes(q)) return true;
            if (l.contact && l.contact.toLowerCase().includes(q)) return true;
            if (l.city && l.city.toLowerCase().includes(q)) return true;
            if (l.state && l.state.toLowerCase().includes(q)) return true;
            if (l.segment && l.segment.toLowerCase().includes(q)) return true;
            if (l.tradeName && l.tradeName.toLowerCase().includes(q)) return true;
            if (cleanQ && l.cnpj && l.cnpj.includes(cleanQ)) return true;
            if (cleanQ && l.whatsapp && l.whatsapp.includes(cleanQ)) return true;
            return false;
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">Nenhum lead encontrado com o termo informado.</div>`;
            return;
        }

        listEl.innerHTML = filtered.slice(0, 30).map(l => {
            const cnpjStr = l.cnpj ? (typeof CNPJService !== "undefined" && CNPJService.formatCNPJ ? CNPJService.formatCNPJ(l.cnpj) : l.cnpj) : "";
            const locationStr = [l.city, l.state].filter(Boolean).join(" - ");
            return `
                <div class="gc-lead-select-item" data-id="${l.id}" style="padding: 10px 14px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--bg-surface, #ffffff); transition: all 0.15s ease;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 700; font-size: 13.5px; color: var(--text-primary, #0f172a);">${l.company || 'Sem Empresa'}</span>
                            <span class="badge" style="font-size: 10px; padding: 2px 6px;">${l.stage || 'Contato'}</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: var(--text-muted, #64748b); margin-top: 3px;">
                            ${l.contact ? `<span>👤 <strong>${l.contact}</strong></span>` : ''}
                            ${cnpjStr ? `<span>📄 ${cnpjStr}</span>` : ''}
                            ${locationStr ? `<span>📍 ${locationStr}</span>` : ''}
                            ${l.whatsapp ? `<span>💬 ${l.whatsapp}</span>` : ''}
                        </div>
                    </div>
                    <button type="button" class="btn btn-primary" style="height: 28px; padding: 0 10px; font-size: 11px; border-radius: 6px; flex-shrink: 0;">
                        Selecionar
                    </button>
                </div>
            `;
        }).join("");

        listEl.querySelectorAll(".gc-lead-select-item").forEach(item => {
            item.addEventListener("click", () => {
                const id = item.getAttribute("data-id");
                const lead = Store.getLeadById(id);
                if (lead) {
                    this.applyLeadToBudget(lead);
                    this.closeSelectLeadModal();
                }
            });
            item.addEventListener("mouseenter", () => {
                item.style.borderColor = "var(--primary, #3b82f6)";
                item.style.background = "rgba(59, 130, 246, 0.04)";
            });
            item.addEventListener("mouseleave", () => {
                item.style.borderColor = "var(--border-color, #e2e8f0)";
                item.style.background = "var(--bg-surface, #ffffff)";
            });
        });
    },

    showBudgetToast(msg) {
        if (window.Toast && typeof window.Toast.show === "function") {
            window.Toast.show(msg, "success");
            return;
        }
        const old = document.getElementById("gc-budget-quick-toast");
        if (old) old.remove();
        const toast = document.createElement("div");
        toast.id = "gc-budget-quick-toast";
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 99999;
            background: var(--bg-card, #1e293b); color: var(--text-primary, #f1f5f9);
            border: 1px solid rgba(16,185,129,0.4); border-left: 4px solid #10b981;
            border-radius: 10px; padding: 12px 18px; font-size: 13px; font-weight: 600;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 8px;
            font-family: 'Inter', sans-serif; animation: vellia-slide-in 0.3s ease;
        `;
        toast.innerHTML = `<span>✅</span><span>${msg}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    openBudgetScreen(proposalId = null, leadData = null, suggestedService = null, suggestedPrice = 0, initialPayload = null) {
        currentEditingBudgetId = proposalId;
        currentBudgetAttachments = [];

        const titleEl = document.getElementById("gc-title-action");
        const breadcrumbEl = document.getElementById("gc-breadcrumb-action");
        const submitBtn = document.getElementById("gc-btn-submit");
        const deleteBtn = document.getElementById("gc-btn-delete");

        if (deleteBtn) {
            deleteBtn.style.display = proposalId ? "inline-flex" : "none";
        }

        this.populateClientsDatalist();

        if (proposalId) {
            const proposal = Store.getProposalById(proposalId);
            if (!proposal) return;

            if (titleEl) titleEl.textContent = "Editar orçamento";
            if (breadcrumbEl) breadcrumbEl.textContent = "Editar";
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Salvar alterações</span>
                `;
            }

            // Preenchimento dos dados do GestãoClick
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
            setVal("gc-budget-number", proposal.budgetNumber || proposal.id.slice(-4));
            setVal("gc-budget-client", proposal.company || "");
            setVal("gc-budget-seller", proposal.seller || proposal.createdBy || Auth.getCurrentUser()?.name || "San Charles");
            setVal("gc-budget-date", getIsoDateInput(proposal.sentAt));
            setVal("gc-budget-delivery-date", getIsoDateInput(proposal.deliveryDate || proposal.sentAt));
            setVal("gc-budget-attention", proposal.contact || "");
            setVal("gc-budget-validity", proposal.validityText || "10 dias");
            setVal("gc-budget-channel", proposal.channel || "Presencial");
            setVal("gc-budget-cost-center", proposal.costCenter || "");
            setVal("gc-budget-intro", proposal.intro || `A VEELUEN Solutions é uma empresa com mais de 12 anos no mercado que atua nas áreas de engenharia e meio ambiente.\n• Ampla atuação em indústrias e construção civil.\n• Está presente em Pernambuco com operação em regiões do Brasil.\n• Seus profissionais possuem 20 anos de mercado nacional, além de amplo conhecimento em diversos ramos da engenharia.`);
            setVal("gc-budget-tech-desc", proposal.techDescription || "");
            setVal("gc-budget-freight", (proposal.freight || 0).toFixed(2));
            setVal("gc-budget-carrier", proposal.carrier || "");
            setVal("gc-budget-notes", proposal.notes || `Previsão de entrega:\nA combinar.\nCondições de pagamento:\n50% + 50%.`);
            setVal("gc-budget-internal-notes", proposal.internalNotes || "");

            // Serviços
            const servicesTbody = document.getElementById("gc-services-tbody");
            if (servicesTbody) servicesTbody.innerHTML = "";
            if (Array.isArray(proposal.servicesList) && proposal.servicesList.length > 0) {
                proposal.servicesList.forEach(s => this.addServiceRow(s));
            } else {
                this.addServiceRow({
                    service: proposal.service || "Licenciamento Ambiental",
                    details: proposal.title || "",
                    qty: 1,
                    price: proposal.value || 0
                });
            }

            // Produtos
            const productsTbody = document.getElementById("gc-products-tbody");
            if (productsTbody) productsTbody.innerHTML = "";
            if (Array.isArray(proposal.productsList) && proposal.productsList.length > 0) {
                proposal.productsList.forEach(p => this.addProductRow(p));
            }

            // Endereço de entrega
            const checkDelivery = document.getElementById("gc-check-delivery-address");
            const containerDelivery = document.getElementById("gc-delivery-address-container");
            if (proposal.deliveryAddress) {
                if (checkDelivery) checkDelivery.checked = true;
                if (containerDelivery) containerDelivery.style.display = "block";
                setVal("gc-delivery-cep", proposal.deliveryAddress.cep);
                setVal("gc-delivery-street", proposal.deliveryAddress.street);
                setVal("gc-delivery-number", proposal.deliveryAddress.number);
                setVal("gc-delivery-neighborhood", proposal.deliveryAddress.neighborhood);
                setVal("gc-delivery-city", proposal.deliveryAddress.city);
                setVal("gc-delivery-state", proposal.deliveryAddress.state);
            } else {
                if (checkDelivery) checkDelivery.checked = false;
                if (containerDelivery) containerDelivery.style.display = "none";
            }

            // Condições de pagamento
            const checkPayment = document.getElementById("gc-check-generate-payment");
            if (checkPayment) checkPayment.checked = proposal.generatePayment !== false;
            const isParcelado = proposal.paymentType === "parcelado";
            const radioParcelado = document.querySelector('input[name="gc-payment-type"][value="parcelado"]');
            const radioVista = document.querySelector('input[name="gc-payment-type"][value="vista"]');
            if (isParcelado && radioParcelado) radioParcelado.checked = true;
            else if (radioVista) radioVista.checked = true;
            const containerInst = document.getElementById("gc-installments-container");
            if (containerInst) containerInst.style.display = isParcelado ? "block" : "none";

            // Anexos
            currentBudgetAttachments = Array.isArray(proposal.attachments) ? [...proposal.attachments] : [];
            this.renderBudgetAttachments();

            // Atualizar badge de lead se vinculado
            const linkedLead = proposal.leadId ? Store.getLeadById(proposal.leadId) : Store.getLeads().find(l => l.company && l.company.toLowerCase().trim() === (proposal.company || "").toLowerCase().trim());
            const badge = document.getElementById("gc-lead-badge-info");
            const badgeText = document.getElementById("gc-lead-badge-text");
            if (linkedLead && badge && badgeText) {
                currentEditingLeadId = linkedLead.id;
                badgeText.textContent = `Lead vinculado: ${linkedLead.company}${linkedLead.contact ? ' • ' + linkedLead.contact : ''}`;
                badge.style.display = "flex";
            } else if (badge) {
                badge.style.display = "none";
            }

        } else {
            // Novo Orçamento
            if (titleEl) titleEl.textContent = "Adicionar orçamento";
            if (breadcrumbEl) breadcrumbEl.textContent = "Adicionar";
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Cadastrar</span>
                `;
            }

            const proposals = Store.getProposals();
            const nextNumber = 358 + proposals.length;
            const currentUser = Auth.getCurrentUser();
            const todayStr = new Date().toISOString().split('T')[0];

            // Tratar leadData se passado como ID ou Objeto
            if (typeof leadData === "string") {
                leadData = Store.getLeadById(leadData);
            }
            currentEditingLeadId = leadData?.id || null;

            // Identificar vendedor logado (prioritário se for vendedor) ou responsável pelo lead
            const currentRole = (currentUser?.role || "").toLowerCase().trim();
            let sellerName = currentUser?.name || "San Charles";
            if (currentRole !== "seller" && currentRole !== "vendedor" && leadData?.owner) {
                const ownerUser = Store.getUsers().find(u => u.email === leadData.owner);
                if (ownerUser) sellerName = ownerUser.name;
            }

            // Detectar melhor canal com base na origem do lead
            let defaultChannel = "Presencial";
            if (leadData?.source) {
                const s = leadData.source.toLowerCase();
                if (s.includes("whatsapp")) defaultChannel = "WhatsApp";
                else if (s.includes("telefone") || s.includes("ligação")) defaultChannel = "Telefone";
                else if (s.includes("email") || s.includes("e-mail")) defaultChannel = "E-mail";
                else if (s.includes("indicação") || s.includes("indicacao")) defaultChannel = "Indicação";
                else if (s.includes("google") || s.includes("meta") || s.includes("site") || s.includes("web")) defaultChannel = "Site Institucional";
            }

            // Montar notas internas ricas com todos os dados do lead
            let leadInternalNotes = "";
            if (leadData) {
                const details = [];
                if (leadData.contact) details.push(`Contato: ${leadData.contact}${leadData.role ? ` (${leadData.role})` : ''}`);
                if (leadData.whatsapp) details.push(`WhatsApp: ${leadData.whatsapp}`);
                if (leadData.phone2) details.push(`Telefone 2: ${leadData.phone2}`);
                if (leadData.email) details.push(`E-mail: ${leadData.email}`);
                if (leadData.cnpj) details.push(`CNPJ: ${leadData.cnpj}`);
                if (leadData.segment || leadData.source) details.push(`Origem / Segmento: ${leadData.segment || ''} (${leadData.source || ''})`);
                if (leadData.city || leadData.state) details.push(`Localização: ${leadData.city || '-'} / ${leadData.state || '-'}`);
                if (leadData.notes) details.push(`\nObservações do Lead:\n${leadData.notes}`);
                leadInternalNotes = details.join("\n");
            }

            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
            setVal("gc-budget-number", nextNumber);
            setVal("gc-budget-client", leadData?.company || initialPayload?.company || "");
            setVal("gc-budget-seller", sellerName);
            setVal("gc-budget-date", todayStr);
            setVal("gc-budget-delivery-date", todayStr);
            setVal("gc-budget-attention", leadData?.contact || initialPayload?.contact || "");
            setVal("gc-budget-validity", initialPayload?.validityText || "10 dias");
            setVal("gc-budget-channel", defaultChannel);
            setVal("gc-budget-cost-center", "");
            setVal("gc-budget-intro", initialPayload?.intro || `A VEELUEN Solutions é uma empresa com mais de 12 anos no mercado que atua nas áreas de engenharia e meio ambiente.\n• Ampla atuação em indústrias e construção civil.\n• Está presente em Pernambuco com operação em regiões do Brasil.\n• Seus profissionais possuem 20 anos de mercado nacional, além de amplo conhecimento em diversos ramos da engenharia.`);
            setVal("gc-budget-tech-desc", initialPayload?.techDescription || "");
            setVal("gc-budget-freight", "0.00");
            setVal("gc-budget-carrier", "");
            setVal("gc-budget-notes", initialPayload?.notes || `Previsão de entrega:\nA combinar.\nCondições de pagamento:\n50% + 50%.`);
            setVal("gc-budget-internal-notes", leadInternalNotes);

            // Serviços
            const servicesTbody = document.getElementById("gc-services-tbody");
            if (servicesTbody) servicesTbody.innerHTML = "";
            this.addServiceRow({
                service: suggestedService || (leadData?.service || "Licenciamento Ambiental"),
                details: initialPayload?.serviceDetails || (leadData?.company ? `Atendimento especializado para ${leadData.company}` : "Atendimento técnico e operacional"),
                qty: 1,
                price: (suggestedPrice !== null && suggestedPrice !== undefined && suggestedPrice > 0) ? suggestedPrice : 0
            });

            // Produtos
            const productsTbody = document.getElementById("gc-products-tbody");
            if (productsTbody) productsTbody.innerHTML = "";

            // Entrega
            const checkDelivery = document.getElementById("gc-check-delivery-address");
            const containerDelivery = document.getElementById("gc-delivery-address-container");
            const hasLocation = !!(leadData?.city || leadData?.state || leadData?.address || leadData?.street || leadData?.cep);
            if (checkDelivery) checkDelivery.checked = hasLocation;
            if (containerDelivery) containerDelivery.style.display = hasLocation ? "block" : "none";
            if (hasLocation) {
                setVal("gc-delivery-cep", leadData?.cep || "");
                setVal("gc-delivery-street", leadData?.street || leadData?.address || "");
                setVal("gc-delivery-number", leadData?.number || "");
                setVal("gc-delivery-neighborhood", leadData?.neighborhood || "");
                setVal("gc-delivery-city", leadData?.city || "");
                setVal("gc-delivery-state", leadData?.state || "");
            }

            // Pagamento
            const checkPayment = document.getElementById("gc-check-generate-payment");
            if (checkPayment) checkPayment.checked = true;
            const radioVista = document.querySelector('input[name="gc-payment-type"][value="vista"]');
            if (radioVista) radioVista.checked = true;
            const containerInst = document.getElementById("gc-installments-container");
            if (containerInst) containerInst.style.display = "none";

            currentBudgetAttachments = [];
            this.renderBudgetAttachments();

            // Ativar ou desativar badge de vínculo
            if (leadData) {
                this.applyLeadToBudget(leadData);
            } else {
                this.unlinkLeadFromBudget();
            }
        }

        // Alternar visualização para tela cheia de orçamento
        const listContainer = document.getElementById("proposals-list-container");
        const budgetView = document.getElementById("gestaoclick-budget-view");
        if (listContainer) listContainer.style.display = "none";
        if (budgetView) budgetView.style.display = "block";

        this.recalculateBudgetTotals();
        window.scrollTo({ top: 0, behavior: "smooth" });
    },

    closeBudgetScreen() {
        const listContainer = document.getElementById("proposals-list-container");
        const budgetView = document.getElementById("gestaoclick-budget-view");
        const deleteBtn = document.getElementById("gc-btn-delete");
        if (deleteBtn) deleteBtn.style.display = "none";
        if (budgetView) budgetView.style.display = "none";
        if (listContainer) listContainer.style.display = "block";
        currentEditingBudgetId = null;
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();
    },

    openModal(leadData = null, suggestedService = null, suggestedPrice = 0) {
        this.openBudgetScreen(null, leadData, suggestedService, suggestedPrice);
    },

    closeModal() {
        this.closeBudgetScreen();
    },

    addServiceRow(item = {}) {
        const tbody = document.getElementById("gc-services-tbody");
        if (!tbody) return;

        const row = document.createElement("tr");
        row.className = "gc-item-row";
        row.innerHTML = `
            <td class="gc-col-item">
                <input type="text" class="gc-input gc-item-name" placeholder="Digite para buscar" value="${item.service || ''}">
            </td>
            <td class="gc-col-details">
                <input type="text" class="gc-input gc-item-details" placeholder="" value="${item.details || ''}">
            </td>
            <td class="gc-col-qty">
                <input type="number" min="1" step="1" class="gc-input gc-item-qty" value="${item.qty || 1}">
            </td>
            <td class="gc-col-price">
                <input type="number" min="0" step="0.01" class="gc-input gc-item-price" placeholder="0,00" value="${item.price || ''}">
            </td>
            <td class="gc-col-discount">
                <div class="gc-discount-combo">
                    <input type="number" min="0" step="0.01" class="gc-input gc-item-discount-val" placeholder="0,00" value="${item.discountVal || ''}">
                    <select class="gc-select gc-item-discount-type">
                        <option value="R$" ${item.discountType === 'R$' || !item.discountType ? 'selected' : ''}>R$</option>
                        <option value="%" ${item.discountType === '%' ? 'selected' : ''}>%</option>
                    </select>
                </div>
            </td>
            <td class="gc-col-subtotal">
                <input type="text" class="gc-input gc-input-readonly gc-item-subtotal" value="0,00" readonly>
            </td>
            <td class="gc-col-action">
                <button type="button" class="gc-btn-delete-row" title="Remover item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </td>
        `;

        row.querySelectorAll(".gc-item-qty, .gc-item-price, .gc-item-discount-val, .gc-item-discount-type").forEach(el => {
            el.addEventListener("input", () => this.recalculateBudgetTotals());
            el.addEventListener("change", () => this.recalculateBudgetTotals());
        });

        row.querySelector(".gc-btn-delete-row")?.addEventListener("click", () => {
            row.remove();
            this.recalculateBudgetTotals();
        });

        tbody.appendChild(row);
        this.recalculateBudgetTotals();
    },

    addProductRow(item = {}) {
        const tbody = document.getElementById("gc-products-tbody");
        if (!tbody) return;

        const row = document.createElement("tr");
        row.className = "gc-item-row";
        row.innerHTML = `
            <td class="gc-col-item">
                <input type="text" class="gc-input gc-item-name" placeholder="Digite para buscar" value="${item.product || ''}">
            </td>
            <td class="gc-col-details">
                <input type="text" class="gc-input gc-item-details" placeholder="" value="${item.details || ''}">
            </td>
            <td class="gc-col-qty">
                <input type="number" min="1" step="1" class="gc-input gc-item-qty" value="${item.qty || 1}">
            </td>
            <td class="gc-col-price">
                <input type="number" min="0" step="0.01" class="gc-input gc-item-price" placeholder="0,00" value="${item.price || ''}">
            </td>
            <td class="gc-col-discount">
                <div class="gc-discount-combo">
                    <input type="number" min="0" step="0.01" class="gc-input gc-item-discount-val" placeholder="0,00" value="${item.discountVal || ''}">
                    <select class="gc-select gc-item-discount-type">
                        <option value="R$" ${item.discountType === 'R$' || !item.discountType ? 'selected' : ''}>R$</option>
                        <option value="%" ${item.discountType === '%' ? 'selected' : ''}>%</option>
                    </select>
                </div>
            </td>
            <td class="gc-col-subtotal">
                <input type="text" class="gc-input gc-input-readonly gc-item-subtotal" value="0,00" readonly>
            </td>
            <td class="gc-col-action">
                <button type="button" class="gc-btn-delete-row" title="Remover item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </td>
        `;

        row.querySelectorAll(".gc-item-qty, .gc-item-price, .gc-item-discount-val, .gc-item-discount-type").forEach(el => {
            el.addEventListener("input", () => this.recalculateBudgetTotals());
            el.addEventListener("change", () => this.recalculateBudgetTotals());
        });

        row.querySelector(".gc-btn-delete-row")?.addEventListener("click", () => {
            row.remove();
            this.recalculateBudgetTotals();
        });

        tbody.appendChild(row);
        this.recalculateBudgetTotals();
    },

    recalculateBudgetTotals() {
        const fmt = (v) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

        let totalServices = 0;
        document.querySelectorAll("#gc-services-tbody .gc-item-row").forEach(row => {
            const qty = parseFloat(row.querySelector(".gc-item-qty")?.value) || 0;
            const price = parseFloat(row.querySelector(".gc-item-price")?.value) || 0;
            const discVal = parseFloat(row.querySelector(".gc-item-discount-val")?.value) || 0;
            const discType = row.querySelector(".gc-item-discount-type")?.value || "R$";

            const raw = qty * price;
            const discount = discType === "%" ? raw * (discVal / 100) : discVal;
            const subtotal = Math.max(0, raw - discount);

            const subtotalInput = row.querySelector(".gc-item-subtotal");
            if (subtotalInput) subtotalInput.value = fmt(subtotal);
            totalServices += subtotal;
        });

        let totalProducts = 0;
        document.querySelectorAll("#gc-products-tbody .gc-item-row").forEach(row => {
            const qty = parseFloat(row.querySelector(".gc-item-qty")?.value) || 0;
            const price = parseFloat(row.querySelector(".gc-item-price")?.value) || 0;
            const discVal = parseFloat(row.querySelector(".gc-item-discount-val")?.value) || 0;
            const discType = row.querySelector(".gc-item-discount-type")?.value || "R$";

            const raw = qty * price;
            const discount = discType === "%" ? raw * (discVal / 100) : discVal;
            const subtotal = Math.max(0, raw - discount);

            const subtotalInput = row.querySelector(".gc-item-subtotal");
            if (subtotalInput) subtotalInput.value = fmt(subtotal);
            totalProducts += subtotal;
        });

        const freight = parseCurrency(document.getElementById("gc-budget-freight")?.value);
        const discCash = parseCurrency(document.getElementById("gc-total-discount-cash")?.value);
        const discPct = parseFloat(document.getElementById("gc-total-discount-pct")?.value) || 0;

        const subtotalSum = totalServices + totalProducts + freight;
        const discountTotal = discCash + (subtotalSum * (discPct / 100));
        const finalTotal = Math.max(0, subtotalSum - discountTotal);

        const elProd = document.getElementById("gc-total-products");
        const elServ = document.getElementById("gc-total-services");
        const elFinal = document.getElementById("gc-total-final");

        if (elProd) elProd.value = fmt(totalProducts);
        if (elServ) elServ.value = fmt(totalServices);
        if (elFinal) elFinal.value = fmt(finalTotal);
    },

    handleBudgetFilesUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (f.size > 5 * 1024 * 1024) {
                alert(`O arquivo "${f.name}" ultrapassa o tamanho máximo permitido de 5Mb.`);
                continue;
            }
            currentBudgetAttachments.push({
                name: f.name,
                size: f.size,
                type: f.type
            });
        }
        this.renderBudgetAttachments();
    },

    renderBudgetAttachments() {
        const list = document.getElementById("gc-attachments-list");
        if (!list) return;

        if (currentBudgetAttachments.length === 0) {
            list.innerHTML = "";
            return;
        }

        list.innerHTML = currentBudgetAttachments.map((att, idx) => `
            <span class="gc-attachment-badge">
                📎 ${att.name} (${(att.size / 1024).toFixed(0)} KB)
                <button type="button" data-idx="${idx}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; margin-left:4px;">✖</button>
            </span>
        `).join("");

        list.querySelectorAll("button[data-idx]").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-idx"));
                currentBudgetAttachments.splice(idx, 1);
                this.renderBudgetAttachments();
            });
        });
    },

    saveBudgetProposal() {
        if (isSaving) return;
        isSaving = true;

        try {
            const getVal = (id) => document.getElementById(id)?.value.trim() || "";

            const company = getVal("gc-budget-client");
            const budgetNumber = getVal("gc-budget-number");
            const seller = getVal("gc-budget-seller");
            const date = getVal("gc-budget-date");
            const deliveryDate = getVal("gc-budget-delivery-date");
            const contact = getVal("gc-budget-attention");
            const validityText = getVal("gc-budget-validity");
            const channel = getVal("gc-budget-channel");
            const costCenter = getVal("gc-budget-cost-center");
            const intro = getVal("gc-budget-intro");
            const techDescription = getVal("gc-budget-tech-desc");
            const freight = parseCurrency(getVal("gc-budget-freight"));
            const carrier = getVal("gc-budget-carrier");
            const notes = getVal("gc-budget-notes");
            const internalNotes = getVal("gc-budget-internal-notes");

            // Itens de serviços
            const servicesList = [];
            document.querySelectorAll("#gc-services-tbody .gc-item-row").forEach(row => {
                const service = row.querySelector(".gc-item-name")?.value.trim() || "";
                const details = row.querySelector(".gc-item-details")?.value.trim() || "";
                const qty = parseFloat(row.querySelector(".gc-item-qty")?.value) || 1;
                const price = parseFloat(row.querySelector(".gc-item-price")?.value) || 0;
                const discountVal = parseFloat(row.querySelector(".gc-item-discount-val")?.value) || 0;
                const discountType = row.querySelector(".gc-item-discount-type")?.value || "R$";
                const subtotalStr = row.querySelector(".gc-item-subtotal")?.value.replace(/\./g, "").replace(",", ".") || "0";
                const subtotal = parseFloat(subtotalStr) || 0;

                if (service) {
                    servicesList.push({ service, details, qty, price, discountVal, discountType, subtotal });
                }
            });

            // Itens de produtos
            const productsList = [];
            document.querySelectorAll("#gc-products-tbody .gc-item-row").forEach(row => {
                const product = row.querySelector(".gc-item-name")?.value.trim() || "";
                const details = row.querySelector(".gc-item-details")?.value.trim() || "";
                const qty = parseFloat(row.querySelector(".gc-item-qty")?.value) || 1;
                const price = parseFloat(row.querySelector(".gc-item-price")?.value) || 0;
                const discountVal = parseFloat(row.querySelector(".gc-item-discount-val")?.value) || 0;
                const discountType = row.querySelector(".gc-item-discount-type")?.value || "R$";
                const subtotalStr = row.querySelector(".gc-item-subtotal")?.value.replace(/\./g, "").replace(",", ".") || "0";
                const subtotal = parseFloat(subtotalStr) || 0;

                if (product) {
                    productsList.push({ product, details, qty, price, discountVal, discountType, subtotal });
                }
            });

            const totalFinalStr = document.getElementById("gc-total-final")?.value.replace(/\./g, "").replace(",", ".") || "0";
            const finalValue = parseFloat(totalFinalStr) || 0;

            if (!company) {
                alert("Preencha o campo obrigatório: Cliente.");
                return;
            }

            if (servicesList.length === 0 && productsList.length === 0) {
                alert("Adicione pelo menos um serviço ou produto ao orçamento.");
                return;
            }

            const mainService = servicesList[0]?.service || (productsList[0]?.product || "Consultoria Técnica");
            const title = `Orçamento #${budgetNumber} - ${mainService}`;

            // Endereço de entrega
            let deliveryAddress = null;
            if (document.getElementById("gc-check-delivery-address")?.checked) {
                deliveryAddress = {
                    cep: getVal("gc-delivery-cep"),
                    street: getVal("gc-delivery-street"),
                    number: getVal("gc-delivery-number"),
                    neighborhood: getVal("gc-delivery-neighborhood"),
                    city: getVal("gc-delivery-city"),
                    state: getVal("gc-delivery-state")
                };
            }

            const generatePayment = document.getElementById("gc-check-generate-payment")?.checked;
            const paymentType = document.querySelector('input[name="gc-payment-type"]:checked')?.value || "vista";

            const currentUser = Auth.getCurrentUser();

            // Sincronizar e Notificar Lead
            const leads = Store.getLeads();
            const targetLead = currentEditingLeadId 
                ? (Store.getLeadById(currentEditingLeadId) || leads.find(l => l.id === currentEditingLeadId))
                : leads.find(l => l.company && company && l.company.toLowerCase().trim() === company.toLowerCase().trim());

            if (currentEditingBudgetId) {
                // Obter proposta existente para preservar campos e atualizar datas corretamente
                const existingProp = Store.getProposalById(currentEditingBudgetId) || {};

                // Tratar data de emissão/envio (sentAt) fixando às 12:00 UTC para evitar desvio de fuso horário (-3h no Brasil)
                let finalSentAt = existingProp.sentAt || new Date().toISOString();
                if (date) {
                    finalSentAt = `${date}T12:00:00.000Z`;
                }

                // Tratar validade (validUntil) com base no prazo de validade (ex: 10 dias)
                let finalValidUntil = existingProp.validUntil;
                if (date) {
                    const daysMatch = (validityText || "10 dias").match(/\d+/);
                    const days = daysMatch ? parseInt(daysMatch[0], 10) : 10;
                    const parts = date.split("-");
                    if (parts.length === 3) {
                        const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
                        baseDate.setDate(baseDate.getDate() + days);
                        finalValidUntil = baseDate.toISOString();
                    }
                }

                // Edição
                const updatedProposal = {
                    company,
                    contact,
                    title,
                    service: mainService,
                    value: finalValue,
                    sentAt: finalSentAt,
                    validUntil: finalValidUntil,
                    budgetNumber,
                    seller,
                    deliveryDate,
                    validityText,
                    channel,
                    costCenter,
                    intro,
                    techDescription,
                    freight,
                    carrier,
                    deliveryAddress,
                    generatePayment,
                    paymentType,
                    servicesList,
                    productsList,
                    attachments: [...currentBudgetAttachments],
                    notes,
                    internalNotes
                };

                if (existingProp.workspace) {
                    updatedProposal.workspace = existingProp.workspace;
                }
                if (targetLead && targetLead.workspace) {
                    updatedProposal.workspace = targetLead.workspace;
                }

                Store.updateProposal(currentEditingBudgetId, updatedProposal, currentUser ? currentUser.email : "sistema@vellia.com");
                Audit.logStageChange(currentUser?.email, company, "Atualização", "Orçamento", `Orçamento #${budgetNumber} atualizado: R$ ${finalValue}`);
                alert(`Orçamento #${budgetNumber} atualizado com sucesso na nuvem!`);
            } else {
                // Nova proposta
                const newProposal = {
                    leadId: targetLead ? targetLead.id : (currentEditingLeadId || null),
                    workspace: targetLead ? targetLead.workspace : undefined,
                    company,
                    contact,
                    title,
                    service: mainService,
                    value: finalValue,
                    status: "Enviada",
                    sentAt: date ? `${date}T12:00:00.000Z` : new Date().toISOString(),
                    validUntil: (() => {
                        const daysMatch = (validityText || "10 dias").match(/\d+/);
                        const days = daysMatch ? parseInt(daysMatch[0], 10) : 10;
                        if (date) {
                            const parts = date.split("-");
                            if (parts.length === 3) {
                                const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
                                baseDate.setDate(baseDate.getDate() + days);
                                return baseDate.toISOString();
                            }
                        }
                        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                    })(),
                    budgetNumber,
                    seller,
                    deliveryDate,
                    validityText,
                    channel,
                    costCenter,
                    intro,
                    techDescription,
                    freight,
                    carrier,
                    deliveryAddress,
                    generatePayment,
                    paymentType,
                    servicesList,
                    productsList,
                    attachments: [...currentBudgetAttachments],
                    notes,
                    internalNotes,
                    createdBy: currentUser?.email || "sistema@vellia.com"
                };

                const created = Store.addProposal(newProposal);
                Audit.logStageChange(currentUser?.email, company, "Nova", "Enviada", `Orçamento #${budgetNumber} criado: ${title} - R$ ${finalValue}`);

                if (targetLead) {
                    // Atualizar estágio do lead para "Proposta Enviada" caso esteja em fase inicial
                    const earlyStages = ["Sem Contato", "Contato Realizado", "Diagnóstico", "Lead Qualificado", "Novo"];
                    if (earlyStages.includes(targetLead.stage)) {
                        Store.updateLeadStage(targetLead.id, "Proposta Enviada", currentUser?.email || "sistema@vellia.com", `Orçamento #${budgetNumber} gerado`);
                    }
                    if (typeof window.WhatsApp?.sendAutomatedMessage === "function") {
                        window.WhatsApp.sendAutomatedMessage(targetLead.id, "proposal", { proposalId: created.id });
                    }
                }

                alert(`Orçamento #${budgetNumber} cadastrado e salvo com sucesso na nuvem!`);
            }

            this.closeBudgetScreen();
        } catch (err) {
            console.error("❌ [saveBudgetProposal] Erro ao salvar proposta:", err);
            alert("Ocorreu um erro ao salvar o orçamento: " + (err.message || err));
        } finally {
            isSaving = false;
        }
    },

    saveProposal() {
        this.saveBudgetProposal();
    },

    // ==========================================================================
    // MODAL DE DETALHES
    // ==========================================================================
    openDetailModal(id) {
        const proposal = Store.getProposalById(id);
        if (!proposal) return;
        activeProposalId = id;

        const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const fmtDate = (d) => d ? formatProposalDate(d, { day: "2-digit", month: "long", year: "numeric" }) : "—";
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

        // Mostrar/ocultar botões de ação conforme status (com reversibilidade total)
        const btnWin = document.getElementById("btn-proposal-win");
        const btnWinLabel = document.getElementById("btn-proposal-win-label");
        const btnLose = document.getElementById("btn-proposal-lose");
        const btnLoseLabel = document.getElementById("btn-proposal-lose-label");
        const btnReopen = document.getElementById("btn-proposal-reopen");
        const btnWa = document.getElementById("btn-proposal-wa");

        const isPending = proposal.status === "Enviada" || proposal.status === "Em Negociação";
        const isWon = ["Ganho", "Aguardando Agendamento", "Agendada"].includes(proposal.status);
        const isLost = proposal.status === "Perdido";

        if (btnWin) {
            btnWin.style.display = isWon ? "none" : "flex";
            if (btnWinLabel) btnWinLabel.textContent = isLost ? "Reverter para Ganho" : "Marcar como Ganho";
        }
        if (btnLose) {
            btnLose.style.display = isLost ? "none" : "flex";
            if (btnLoseLabel) btnLoseLabel.textContent = isWon ? "Proposta Perdida (Reverter Venda)" : "Proposta Perdida";
        }
        if (btnReopen) {
            btnReopen.style.display = !isPending ? "flex" : "none";
        }
        if (btnWa) btnWa.style.display = isPending ? "flex" : "none";

        const modalEl = document.getElementById("proposal-detail-modal");
        if (modalEl) {
            modalEl.classList.add("open");
        }
        const overlayEl = document.getElementById("proposal-detail-overlay");
        if (overlayEl) {
            overlayEl.style.display = "block";
            overlayEl.classList.add("open");
        }
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
        const modalEl = document.getElementById("proposal-detail-modal");
        if (modalEl) {
            modalEl.classList.remove("open");
        }
        const overlayEl = document.getElementById("proposal-detail-overlay");
        if (overlayEl) {
            overlayEl.style.display = "none";
            overlayEl.classList.remove("open");
        }
        activeProposalId = null;
    },

    // ==========================================================================
    // EDIÇÃO DE PROPOSTA
    // ==========================================================================
    openEditProposalModal(id = null) {
        const targetId = id || activeProposalId;
        if (!targetId) return;
        this.closeDetailModal();
        this.openBudgetScreen(targetId);
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
            value: parseCurrency(document.getElementById("edit-prop-value").value),
            validUntil: validUntil ? `${validUntil}T12:00:00.000Z` : null,
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
    // EXCLUSÃO DE PROPOSTA
    // ==========================================================================
    async deleteProposal(id = null) {
        const targetId = id || activeProposalId || currentEditingBudgetId;
        if (!targetId) return;

        const proposal = Store.getProposalById(targetId);
        const proposalName = proposal ? (proposal.title || proposal.company || targetId) : targetId;

        const confirmMsg = `Tem certeza que deseja excluir a proposta:\n"${proposalName}"?\n\nEsta ação não poderá ser desfeita e removerá a proposta do sistema e da nuvem.`;
        if (!confirm(confirmMsg)) {
            return;
        }

        const user = Auth.getCurrentUser();
        const userEmail = user ? user.email : "sistema@vellia.com";

        Store.deleteProposal(targetId, userEmail);

        if (activeProposalId === targetId) {
            this.closeDetailModal();
        }

        if (currentEditingBudgetId === targetId) {
            this.closeBudgetScreen();
        }

        activeProposalId = null;
        currentEditingBudgetId = null;

        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        alert("Proposta excluída com sucesso!");
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

        const winModal = document.getElementById("win-modal");
        if (winModal) winModal.classList.add("open");
        const winOverlay = document.getElementById("win-modal-overlay");
        if (winOverlay) {
            winOverlay.style.display = "block";
            winOverlay.classList.add("open");
        }
    },

    closeWinModal() {
        const winModal = document.getElementById("win-modal");
        if (winModal) winModal.classList.remove("open");
        const winOverlay = document.getElementById("win-modal-overlay");
        if (winOverlay) {
            winOverlay.style.display = "none";
            winOverlay.classList.remove("open");
        }
    },

    confirmWin() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        const service = document.getElementById("win-service").value;
        const finalValue = parseCurrency(document.getElementById("win-value").value) || proposal.value;
        const executionDate = document.getElementById("win-execution").value;
        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser?.email || "sistema@vellia.com";

        Store.updateProposal(activeProposalId, {
            status: "Ganho",
            service: service,
            value: finalValue,
            executionDate: executionDate || null,
            closedAt: document.getElementById("win-date").value || new Date().toISOString(),
            lossReason: "",
            competitor: ""
        }, userEmail);

        // Sincronizar Lead correspondente para "Cliente Fechado"
        const leads = Store.getLeads ? Store.getLeads() : [];
        const targetLead = proposal.leadId
            ? Store.getLeadById(proposal.leadId)
            : leads.find(l => l.company && proposal.company && l.company.toLowerCase().trim() === proposal.company.toLowerCase().trim());
        if (targetLead && targetLead.stage !== "Cliente Fechado") {
            Store.updateLeadStage(targetLead.id, "Cliente Fechado", userEmail, `Proposta ganha: R$ ${finalValue}`);
        }

        Audit.logSaleWon(userEmail, proposal.company, `R$ ${finalValue}`);

        this.closeWinModal();
        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        // Notificar demais módulos (sem solicitar contrato)
        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
        if (window.Toast && typeof window.Toast.show === "function") {
            window.Toast.show("Proposta marcada como Ganha com sucesso!", "success");
        }
    },

    // ==========================================================================
    // REGISTRAR PERDA (INCLUSIVE REVERSÃO DE VENDA CASO A EMPRESA DESISTA)
    // ==========================================================================
    openLossModal(proposalId = null) {
        if (proposalId) activeProposalId = proposalId;
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);

        const lossModal = document.getElementById("loss-modal");
        if (lossModal) lossModal.classList.add("open");
        const lossOverlay = document.getElementById("loss-modal-overlay");
        if (lossOverlay) {
            lossOverlay.style.display = "block";
            lossOverlay.classList.add("open");
        }
        document.getElementById("loss-form")?.reset();

        const wasWon = proposal && ["Ganho", "Aguardando Agendamento", "Agendada"].includes(proposal.status);
        const reasonInput = document.getElementById("loss-reason-text");
        if (reasonInput && wasWon && !reasonInput.value) {
            reasonInput.value = "Desistência do cliente após fechamento";
        }
    },

    closeLossModal() {
        const lossModal = document.getElementById("loss-modal");
        if (lossModal) lossModal.classList.remove("open");
        const lossOverlay = document.getElementById("loss-modal-overlay");
        if (lossOverlay) {
            lossOverlay.style.display = "none";
            lossOverlay.classList.remove("open");
        }
    },

    confirmLoss() {
        if (!activeProposalId) return;
        const lossReason = document.getElementById("loss-reason-text")?.value.trim() || "";
        const competitor = document.getElementById("loss-competitor")?.value.trim() || "";
        const extraNotes = document.getElementById("loss-notes")?.value.trim() || "";

        if (!lossReason) { alert("Informe o motivo da perda ou desistência."); return; }

        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser?.email || "sistema@vellia.com";
        const mergedNotes = extraNotes
            ? `${proposal.notes ? proposal.notes + "\n\n" : ""}[Registro de Perda/Desistência]: ${extraNotes}`
            : (proposal.notes || "");

        Store.updateProposal(activeProposalId, {
            status: "Perdido",
            closedAt: new Date().toISOString(),
            lossReason,
            competitor,
            notes: mergedNotes
        }, userEmail);

        // Reverter Lead correspondente para "Cliente Perdido" caso estivesse fechado
        const leads = Store.getLeads ? Store.getLeads() : [];
        const targetLead = proposal.leadId
            ? Store.getLeadById(proposal.leadId)
            : leads.find(l => l.company && proposal.company && l.company.toLowerCase().trim() === proposal.company.toLowerCase().trim());
        if (targetLead && targetLead.stage !== "Cliente Perdido") {
            Store.updateLeadStage(targetLead.id, "Cliente Perdido", userEmail, `Proposta marcada como perdida/desistência: ${lossReason}`);
        }

        Audit.logSaleLost(userEmail, proposal.company, lossReason);

        this.closeLossModal();
        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
        if (window.Toast && typeof window.Toast.show === "function") {
            window.Toast.show("Proposta marcada como Perdida e status revertido com sucesso.", "info");
        }
    },

    reopenProposal(proposalId = null) {
        const targetId = proposalId || activeProposalId;
        if (!targetId) return;
        const proposal = Store.getProposalById(targetId);
        if (!proposal) return;

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser?.email || "sistema@vellia.com";

        Store.updateProposal(targetId, {
            status: "Em Negociação",
            closedAt: null,
            lossReason: "",
            competitor: ""
        }, userEmail);

        const leads = Store.getLeads ? Store.getLeads() : [];
        const targetLead = proposal.leadId
            ? Store.getLeadById(proposal.leadId)
            : leads.find(l => l.company && proposal.company && l.company.toLowerCase().trim() === proposal.company.toLowerCase().trim());
        if (targetLead && (targetLead.stage === "Cliente Fechado" || targetLead.stage === "Cliente Perdido")) {
            Store.updateLeadStage(targetLead.id, "Negociação", userEmail, "Proposta reaberta para Em Negociação.");
        }

        this.closeDetailModal();
        this.renderStats();
        this.renderTable();
        this.renderLossAnalysis();

        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
        if (window.Toast && typeof window.Toast.show === "function") {
            window.Toast.show("Proposta revertida para 'Em Negociação'!", "success");
        }
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

    async exportProposalToPDF(idOrProp) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            if (window.LazyLoader) {
                await window.LazyLoader.ensureJsPDF();
            }
        }
        const jsPDFLib = window.jspdf;
        if (!jsPDFLib || !jsPDFLib.jsPDF) {
            this.printActiveProposalDocument();
            return;
        }
        const { jsPDF } = jsPDFLib;

        let proposal = null;
        if (typeof idOrProp === "object" && idOrProp !== null) {
            proposal = idOrProp;
        } else if (idOrProp) {
            proposal = Store.getProposalById(idOrProp);
        }
        if (!proposal) {
            proposal = this.getLiveBudgetFormData();
        }
        if (!proposal || !proposal.company) {
            alert("Proposta ou orçamento não encontrado para exportação.");
            return;
        }

        const leads = Store.getLeads() || [];
        const lead = leads.find(l => (l.company || "").toLowerCase() === (proposal.company || "").toLowerCase());

        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const pageW = 210;
        const pageH = 297;

        const BRAND_COLOR = [30, 64, 175];
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
        const propNum = proposal.budgetNumber || (proposal.id ? proposal.id.substring(0, 8).toUpperCase() : "001");
        doc.text(`Orçamento Nº: ${propNum}   •   Status: ${(proposal.status || "Em Elaboração").toUpperCase()}`, 48, 28);

        // 2. METADATA & CLIENT CARDS
        let y = 52;
        
        // Client Card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, y, 88, 38, 3, 3, "FD");
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
        doc.setFillColor(...GREEN_COLOR);
        doc.rect(108, y, 3, 38, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_COLOR);
        doc.text("CONDIÇÕES COMERCIAIS", 115, y + 8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GRAY_COLOR);
        doc.text(`Data de Emissão: ${formatProposalDate(proposal.sentAt || proposal.date)}`, 115, y + 16);
        doc.text(`Validade: ${proposal.validityText || (proposal.validUntil ? formatProposalDate(proposal.validUntil) : "10 dias")}`, 115, y + 22);
        const mainServiceName = proposal.servicesList?.[0]?.service || proposal.service || "Serviço Técnico Especializado";
        doc.text(`Serviço: ${mainServiceName.substring(0, 32)}`, 115, y + 28);
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
        doc.text("Detalhamento do Escopo e Itens", 20, y + 4.5);
        
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        
        const introText = proposal.intro ? `Apresentação:\n${proposal.intro}\n\n` : "";
        let itemsText = "";
        if (proposal.servicesList && proposal.servicesList.length > 0) {
            itemsText += "Serviços Inclusos:\n" + proposal.servicesList.map((s, idx) => `  ${idx + 1}. ${s.service} (Qtd: ${s.qty}) - R$ ${parseFloat(s.subtotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${s.details ? '\n     ' + s.details : ''}`).join("\n") + "\n\n";
        }
        if (proposal.productsList && proposal.productsList.length > 0) {
            itemsText += "Produtos / Materiais:\n" + proposal.productsList.map((p, idx) => `  ${idx + 1}. ${p.product} (Qtd: ${p.qty}) - R$ ${parseFloat(p.subtotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n") + "\n\n";
        }
        const notesText = introText + itemsText + (proposal.notes || "Condições padrão conforme acordado.");
        const lines = doc.splitTextToSize(notesText, pageW - 28);
        
        for (const line of lines) {
            if (y > pageH - 45) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, 14, y);
            y += 5.5;
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

        doc.line(14, sigY, 14 + sigW, sigY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...DARK_COLOR);
        doc.text("Veeluen Solutions / Excelência", 14, sigY + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_COLOR);
        doc.text("Responsável Técnico / Comercial", 14, sigY + 9);

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
        doc.save(`Proposta_${safeName}_${propNum}.pdf`);
    },

    // ==========================================================================
    // SISTEMA DE IMPRESSÃO & MODELO PROFISSIONAL TIMBRADO (A4 / PDF)
    // ==========================================================================
    getCompanyBranding(workspaceName) {
        const ws = (workspaceName || localStorage.getItem("activeCompany") || "Veeluen Solutions").toLowerCase();
        const isExcelencia = ws.includes("excel") || ws.includes("ambiental");

        if (isExcelencia) {
            return {
                name: "EXCELÊNCIA AMBIENTAL",
                legalName: "Excelência Assessoria e Engenharia Ambiental Ltda.",
                tagline: "Consultoria, Licenciamento & Gestão Ambiental Estratégica",
                cnpj: "38.124.908/0001-12",
                address: "Av. Gov. Agamenon Magalhães, 2615 • Recife / PE",
                phone: "(81) 98155-8002",
                email: "contato@excelenciaambiental.com.br",
                website: "www.excelenciaambiental.com.br",
                primaryColor: "#059669",
                secondaryColor: "#065f46",
                accentLight: "#ecfdf5",
                badgeText: "EA",
                sigTitle: "Excelência Ambiental — Diretoria Técnica"
            };
        }

        return {
            name: "VEELUEN SOLUTIONS",
            legalName: "Veeluen Solutions Engenharia e Meio Ambiente Ltda.",
            tagline: "Engenharia, Soluções Ambientais & Gestão Integrada",
            cnpj: "42.891.244/0001-38",
            address: "Recife / Pernambuco • Atuação e Operações em Todo o Brasil",
            phone: "(81) 99658-1000 / (81) 3035-3500",
            email: "comercial@veeluen.ai",
            website: "www.veeluen.ai",
            primaryColor: "#1e40af",
            secondaryColor: "#1e3a8a",
            accentLight: "#eff6ff",
            badgeText: "VS",
            sigTitle: "Veeluen Solutions — Engenharia & Comercial"
        };
    },

    getLiveBudgetFormData() {
        const getVal = (id) => document.getElementById(id)?.value?.trim() || "";
        const budgetNumber = getVal("gc-budget-number") || "001";
        const company = getVal("gc-budget-client") || "Cliente Não Informado";
        const seller = getVal("gc-budget-seller") || (Auth.getCurrentUser()?.name || "Consultor Técnico");
        const date = getVal("gc-budget-date") || new Date().toISOString().split("T")[0];
        const deliveryDate = getVal("gc-budget-delivery-date") || "";
        const contact = getVal("gc-budget-attention") || "";
        const validityText = getVal("gc-budget-validity") || "10 dias";
        const channel = getVal("gc-budget-channel") || "";
        const costCenter = getVal("gc-budget-cost-center") || "";
        const intro = getVal("gc-budget-intro") || "";
        const techDescription = getVal("gc-budget-tech-desc") || "";
        const freight = parseCurrency(getVal("gc-budget-freight"));
        const carrier = getVal("gc-budget-carrier") || "";
        const notes = getVal("gc-budget-notes") || "";
        const internalNotes = getVal("gc-budget-internal-notes") || "";

        const servicesList = [];
        document.querySelectorAll("#gc-services-tbody .gc-item-row").forEach(row => {
            const service = row.querySelector(".gc-item-name")?.value.trim() || "";
            const details = row.querySelector(".gc-item-details")?.value.trim() || "";
            const qty = parseFloat(row.querySelector(".gc-item-qty")?.value) || 1;
            const price = parseFloat(row.querySelector(".gc-item-price")?.value) || 0;
            const discountVal = parseFloat(row.querySelector(".gc-item-discount-val")?.value) || 0;
            const discountType = row.querySelector(".gc-item-discount-type")?.value || "R$";
            const subtotalStr = row.querySelector(".gc-item-subtotal")?.value.replace(/\./g, "").replace(",", ".") || "0";
            const subtotal = parseFloat(subtotalStr) || 0;
            if (service || price > 0) {
                servicesList.push({ service, details, qty, price, discountVal, discountType, subtotal });
            }
        });

        const productsList = [];
        document.querySelectorAll("#gc-products-tbody .gc-item-row").forEach(row => {
            const product = row.querySelector(".gc-item-name")?.value.trim() || "";
            const details = row.querySelector(".gc-item-details")?.value.trim() || "";
            const qty = parseFloat(row.querySelector(".gc-item-qty")?.value) || 1;
            const price = parseFloat(row.querySelector(".gc-item-price")?.value) || 0;
            const discountVal = parseFloat(row.querySelector(".gc-item-discount-val")?.value) || 0;
            const discountType = row.querySelector(".gc-item-discount-type")?.value || "R$";
            const subtotalStr = row.querySelector(".gc-item-subtotal")?.value.replace(/\./g, "").replace(",", ".") || "0";
            const subtotal = parseFloat(subtotalStr) || 0;
            if (product || price > 0) {
                productsList.push({ product, details, qty, price, discountVal, discountType, subtotal });
            }
        });

        const totalFinalStr = document.getElementById("gc-total-final")?.value.replace(/\./g, "").replace(",", ".") || "0";
        const finalValue = parseFloat(totalFinalStr) || 0;

        let deliveryAddress = null;
        if (document.getElementById("gc-check-delivery-address")?.checked) {
            deliveryAddress = {
                cep: getVal("gc-delivery-cep"),
                street: getVal("gc-delivery-street"),
                number: getVal("gc-delivery-number"),
                neighborhood: getVal("gc-delivery-neighborhood"),
                city: getVal("gc-delivery-city"),
                state: getVal("gc-delivery-state")
            };
        }

        const paymentType = document.querySelector('input[name="gc-payment-type"]:checked')?.value || "vista";
        const activeWs = localStorage.getItem("activeCompany") || "Veeluen Solutions";

        return {
            id: currentEditingBudgetId || `ORC-${Date.now().toString(36).toUpperCase()}`,
            budgetNumber,
            company,
            contact,
            seller,
            sentAt: date,
            date,
            deliveryDate,
            validityText,
            channel,
            costCenter,
            intro,
            techDescription,
            freight,
            carrier,
            notes,
            internalNotes,
            servicesList,
            productsList,
            deliveryAddress,
            paymentType,
            value: finalValue,
            status: "Em Elaboração",
            workspace: activeWs
        };
    },

    openPrintPreview(proposalIdOrData = null) {
        let prop = null;
        if (typeof proposalIdOrData === "object" && proposalIdOrData !== null) {
            prop = proposalIdOrData;
        } else if (proposalIdOrData) {
            prop = Store.getProposalById(proposalIdOrData);
        }

        if (!prop) {
            prop = this.getLiveBudgetFormData();
        }

        currentPrintProposal = prop;

        const sheetWrapper = document.getElementById("print-sheet-wrapper");
        if (sheetWrapper) {
            sheetWrapper.innerHTML = this.buildProposalPrintBodyHTML(prop);
        }

        const subtitleEl = document.getElementById("print-modal-subtitle");
        if (subtitleEl) {
            const num = prop.budgetNumber || (prop.id ? prop.id.substring(0, 8).toUpperCase() : "001");
            subtitleEl.textContent = `Orçamento / Proposta Nº ${num} • Cliente: ${prop.company || 'Geral'}`;
        }

        const modal = document.getElementById("modal-proposal-print");
        if (modal) {
            modal.classList.add("open");
        }
    },

    closePrintPreview() {
        const modal = document.getElementById("modal-proposal-print");
        if (modal) {
            modal.classList.remove("open");
        }
    },

    printActiveProposalDocument() {
        let prop = currentPrintProposal;
        if (!prop) {
            prop = this.getLiveBudgetFormData();
        }
        if (!prop) {
            alert("Nenhuma proposta carregada para impressão.");
            return;
        }

        const html = this.buildProposalPrintHTML(prop);
        const printWin = window.open("", "_blank", "width=920,height=850,menubar=no,toolbar=no,location=no,status=no");
        if (!printWin) {
            alert("O navegador bloqueou a janela pop-up. Por favor, permita pop-ups para imprimir diretamente.");
            return;
        }

        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
    },

    buildProposalPrintBodyHTML(prop) {
        const brand = this.getCompanyBranding(prop.workspace);
        const fmtCur = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v) || 0);

        // Buscar dados complementares do Lead se disponíveis
        const leads = Store.getLeads() || [];
        const lead = leads.find(l => (l.company || "").toLowerCase() === (prop.company || "").toLowerCase()) || {};

        const propNumber = prop.budgetNumber || (prop.id ? prop.id.substring(0, 8).toUpperCase() : "001");
        const emitDate = formatProposalDate(prop.sentAt || prop.date || new Date().toISOString());
        const validity = prop.validityText || (prop.validUntil ? formatProposalDate(prop.validUntil) : "10 dias úteis");
        const sellerName = prop.seller || (Auth.getCurrentUser()?.name || "Consultor Técnico");

        // Montar linhas de serviços
        let servicesList = prop.servicesList || [];
        if (servicesList.length === 0 && (prop.service || prop.value)) {
            servicesList = [{
                service: prop.service || "Prestação de Serviços Técnicos Especializados",
                details: prop.notes ? prop.notes.substring(0, 150) : "Serviços de engenharia e consultoria ambiental conforme escopo.",
                qty: 1,
                price: prop.value || 0,
                discountVal: 0,
                subtotal: prop.value || 0
            }];
        }

        let servicesRowsHTML = "";
        let totalServicesVal = 0;
        servicesList.forEach((s, idx) => {
            const qty = parseFloat(s.qty) || 1;
            const price = parseFloat(s.price) || 0;
            const subtotal = parseFloat(s.subtotal !== undefined ? s.subtotal : qty * price) || 0;
            totalServicesVal += subtotal;

            servicesRowsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                    <td style="padding: 10px 12px; text-align: center; color: #64748b; font-weight: 600;">${String(idx + 1).padStart(2, '0')}</td>
                    <td style="padding: 10px 12px;">
                        <strong style="color: #0f172a; display: block; font-size: 13.5px;">${s.service || 'Serviço'}</strong>
                        ${s.details ? `<span style="font-size: 12px; color: #475569; display: block; margin-top: 3px; line-height: 1.4;">${s.details.replace(/\n/g, '<br>')}</span>` : ''}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; color: #1e293b; font-weight: 600;">${qty}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #1e293b;">${fmtCur(price)}</td>
                    <td style="padding: 10px 12px; text-align: right; color: #0f172a; font-weight: 700;">${fmtCur(subtotal)}</td>
                </tr>
            `;
        });

        // Montar linhas de produtos (se houver)
        const productsList = prop.productsList || [];
        let productsRowsHTML = "";
        let totalProductsVal = 0;
        if (productsList.length > 0) {
            productsList.forEach((p, idx) => {
                const qty = parseFloat(p.qty) || 1;
                const price = parseFloat(p.price) || 0;
                const subtotal = parseFloat(p.subtotal !== undefined ? p.subtotal : qty * price) || 0;
                totalProductsVal += subtotal;

                productsRowsHTML += `
                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
                        <td style="padding: 10px 12px; text-align: center; color: #64748b; font-weight: 600;">${String(idx + 1).padStart(2, '0')}</td>
                        <td style="padding: 10px 12px;">
                            <strong style="color: #0f172a; display: block; font-size: 13.5px;">${p.product || 'Produto'}</strong>
                            ${p.details ? `<span style="font-size: 12px; color: #475569; display: block; margin-top: 3px;">${p.details}</span>` : ''}
                        </td>
                        <td style="padding: 10px 12px; text-align: center; color: #1e293b; font-weight: 600;">${qty}</td>
                        <td style="padding: 10px 12px; text-align: right; color: #1e293b;">${fmtCur(price)}</td>
                        <td style="padding: 10px 12px; text-align: right; color: #0f172a; font-weight: 700;">${fmtCur(subtotal)}</td>
                    </tr>
                `;
            });
        }

        // Endereço de entrega / local de execução
        const delivery = prop.deliveryAddress || (lead.city || lead.state ? {
            street: lead.street || lead.address || "",
            number: lead.number || "",
            neighborhood: lead.neighborhood || "",
            city: lead.city || "",
            state: lead.state || "",
            cep: lead.cep || ""
        } : null);

        let deliveryHTML = "";
        if (delivery && (delivery.city || delivery.street || delivery.cep)) {
            const line = [
                delivery.street ? `${delivery.street}${delivery.number ? ', nº ' + delivery.number : ''}` : '',
                delivery.neighborhood,
                delivery.city ? `${delivery.city}${delivery.state ? '/' + delivery.state : ''}` : '',
                delivery.cep ? `CEP: ${delivery.cep}` : ''
            ].filter(Boolean).join(" • ");

            deliveryHTML = `
                <div style="margin-top: 18px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">Local de Prestação / Endereço de Entrega</span>
                    <span style="font-size: 13px; color: #1e293b; font-weight: 500;">📍 ${line}</span>
                </div>
            `;
        }

        const totalFinal = prop.value || (totalServicesVal + totalProductsVal + (prop.freight || 0));

        return `
            <div class="proposal-print-document" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; max-width: 800px; margin: 0 auto;">
                
                <!-- 1. CABEÇALHO TIMBRADO -->
                <div style="border-bottom: 2px solid ${brand.primaryColor}; padding-bottom: 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
                    <div style="display: flex; align-items: flex-start; gap: 14px;">
                        <div style="width: 52px; height: 52px; border-radius: 12px; background: ${brand.primaryColor}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; letter-spacing: -1px; box-shadow: 0 4px 10px rgba(0,0,0,0.12);">
                            ${brand.badgeText}
                        </div>
                        <div>
                            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: ${brand.primaryColor}; letter-spacing: -0.3px;">${brand.name}</h1>
                            <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">${brand.tagline}</p>
                            <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #64748b;">
                                CNPJ: <strong>${brand.cnpj}</strong> • ${brand.address}
                            </p>
                            <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">
                                Tel: ${brand.phone} • E-mail: ${brand.email}
                            </p>
                        </div>
                    </div>

                    <div style="text-align: right; min-width: 210px; background: ${brand.accentLight}; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.06);">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: ${brand.secondaryColor}; letter-spacing: 0.5px;">Proposta Comercial</div>
                        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">Nº ${propNumber}</div>
                        <div style="font-size: 11.5px; color: #475569; margin-top: 4px;">Data: <strong>${emitDate}</strong></div>
                        <div style="font-size: 11.5px; color: #475569;">Validade: <strong>${validity}</strong></div>
                    </div>
                </div>

                <!-- 2. DADOS DO CLIENTE & RESPONSÁVEL -->
                <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-bottom: 22px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Cliente Proponente</div>
                        <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${prop.company || '—'}</div>
                        <div style="font-size: 12.5px; color: #334155;"><strong>Aos cuidados de:</strong> ${prop.contact || lead.contact || 'Diretoria / Responsável'}</div>
                        ${lead.cnpj ? `<div style="font-size: 12px; color: #64748b;">CNPJ: ${lead.cnpj}</div>` : ''}
                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                            ${lead.email ? `E-mail: ${lead.email}` : ''} ${lead.whatsapp || lead.phone ? `• Tel: ${lead.whatsapp || lead.phone}` : ''}
                        </div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Responsável Comercial</div>
                        <div style="font-size: 14.5px; font-weight: 700; color: #0f172a;">${sellerName}</div>
                        <div style="font-size: 12px; color: #475569; margin-top: 2px;">Departamento Técnico e Comercial</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Canal: ${prop.channel || 'Venda Direta'}</div>
                    </div>
                </div>

                <!-- 3. APRESENTAÇÃO / INTRODUÇÃO -->
                ${prop.intro ? `
                    <div style="margin-bottom: 22px; padding: 14px 18px; border-left: 3px solid ${brand.primaryColor}; background: #fdfdfd; border-radius: 0 8px 8px 0; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${brand.primaryColor}; letter-spacing: 0.5px; margin-bottom: 6px;">Apresentação Institucional</div>
                        <div style="font-size: 12.5px; color: #334155; line-height: 1.6; white-space: pre-line;">${prop.intro}</div>
                    </div>
                ` : ''}

                <!-- 4. TABELA DE SERVIÇOS -->
                <div style="margin-bottom: 22px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
                            1. Serviços e Escopo de Fornecimento
                        </h3>
                        <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">Valores em Moeda Nacional (BRL)</span>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;">
                                <th style="padding: 10px 12px; width: 44px; text-align: center;">Item</th>
                                <th style="padding: 10px 12px; text-align: left;">Descrição do Serviço / Escopo</th>
                                <th style="padding: 10px 12px; width: 60px; text-align: center;">Qtd</th>
                                <th style="padding: 10px 12px; width: 110px; text-align: right;">Unitário</th>
                                <th style="padding: 10px 12px; width: 120px; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${servicesRowsHTML}
                        </tbody>
                    </table>
                </div>

                <!-- 5. TABELA DE PRODUTOS / MATERIAIS (SE HOUVER) -->
                ${productsList.length > 0 ? `
                    <div style="margin-bottom: 22px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <h3 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">
                                2. Produtos, Peças ou Materiais Inclusos
                            </h3>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                            <thead>
                                <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;">
                                    <th style="padding: 10px 12px; width: 44px; text-align: center;">Item</th>
                                    <th style="padding: 10px 12px; text-align: left;">Descrição do Produto / Material</th>
                                    <th style="padding: 10px 12px; width: 60px; text-align: center;">Qtd</th>
                                    <th style="padding: 10px 12px; width: 110px; text-align: right;">Unitário</th>
                                    <th style="padding: 10px 12px; width: 120px; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productsRowsHTML}
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <!-- 6. DETALHES TÉCNICOS / ESPECIFICAÇÃO -->
                ${prop.techDescription ? `
                    <div style="margin-bottom: 22px; padding: 14px 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Especificações Técnicas e Metodologia</div>
                        <div style="font-size: 12.5px; color: #334155; line-height: 1.5; white-space: pre-line;">${prop.techDescription}</div>
                    </div>
                ` : ''}

                ${deliveryHTML}

                <!-- 7. RESUMO FINANCEIRO E CONDIÇÕES -->
                <div style="margin-top: 22px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; align-items: start;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">Condições Comerciais & Pagamento</div>
                        <div style="font-size: 12.5px; color: #334155; line-height: 1.6; white-space: pre-line;">
                            ${prop.notes || 'Previsão de entrega: A combinar com o cliente.\nCondições de pagamento: 50% na aprovação + 50% na conclusão.\nImpostos inclusos na proposta.'}
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 2px solid ${brand.primaryColor}; border-radius: 10px; padding: 16px 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: ${brand.primaryColor}; letter-spacing: 0.5px; margin-bottom: 10px;">Resumo do Investimento</div>
                        
                        <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #475569; margin-bottom: 5px;">
                            <span>Subtotal Serviços:</span>
                            <span style="font-weight: 600;">${fmtCur(totalServicesVal || prop.value)}</span>
                        </div>

                        ${totalProductsVal > 0 ? `
                            <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #475569; margin-bottom: 5px;">
                                <span>Subtotal Produtos:</span>
                                <span style="font-weight: 600;">${fmtCur(totalProductsVal)}</span>
                            </div>
                        ` : ''}

                        ${prop.freight ? `
                            <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #475569; margin-bottom: 5px;">
                                <span>Frete / Logística:</span>
                                <span style="font-weight: 600;">${fmtCur(prop.freight)}</span>
                            </div>
                        ` : ''}

                        <div style="border-top: 1px dashed #cbd5e1; margin: 10px 0; padding-top: 10px; display: flex; justify-content: space-between; align-items: baseline;">
                            <span style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Investimento Total:</span>
                            <span style="font-size: 20px; font-weight: 900; color: ${brand.primaryColor};">${fmtCur(totalFinal)}</span>
                        </div>
                    </div>
                </div>

                <!-- 8. ASSINATURAS E ACEITE (DE ACORDO) -->
                <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; page-break-inside: avoid;">
                    <div style="text-align: center;">
                        <div style="border-bottom: 1.5px solid #0f172a; width: 85%; margin: 0 auto 8px auto;"></div>
                        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${brand.name}</div>
                        <div style="font-size: 11px; color: #64748b;">${sellerName} • Responsável Comercial</div>
                    </div>

                    <div style="text-align: center;">
                        <div style="border-bottom: 1.5px solid #0f172a; width: 85%; margin: 0 auto 8px auto;"></div>
                        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${prop.company || 'Aceite do Cliente'}</div>
                        <div style="font-size: 11px; color: #64748b;">De Acordo / Assinatura do Contratante</div>
                        <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">Data do Aceite: ____/____/________</div>
                    </div>
                </div>

                <!-- 9. RODAPÉ DE PÁGINA -->
                <div style="margin-top: 30px; padding-top: 12px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8;">
                    <span>Documento Comercial Oficial • ${brand.legalName}</span>
                    <span>Vellia CRM — Inteligência e Gestão Comercial</span>
                </div>
            </div>
        `;
    },

    buildProposalPrintHTML(prop) {
        const brand = this.getCompanyBranding(prop.workspace);
        const bodyContent = this.buildProposalPrintBodyHTML(prop);

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Proposta Comercial #${prop.budgetNumber || '001'} - ${prop.company || 'Cliente'}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
            margin: 12mm 15mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        body {
            font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 10px;
            background: #ffffff;
            color: #0f172a;
        }
        .proposal-print-document {
            width: 100%;
        }
        @media print {
            body {
                padding: 0;
            }
            .no-print {
                display: none !important;
            }
            tr {
                page-break-inside: avoid;
            }
            table {
                page-break-inside: auto;
            }
        }
        @media screen {
            body {
                background: #525659;
                display: flex;
                justify-content: center;
                padding: 30px 10px;
            }
            .proposal-print-document {
                background: #ffffff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                padding: 40px;
                border-radius: 4px;
            }
        }
    </style>
</head>
<body>
    ${bodyContent}
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 300);
        };
    </script>
</body>
</html>`;
    },

    openOnlineApprovalView(proposalId) {
        const proposal = Store.getProposalById(proposalId);
        if (!proposal) return;

        activeProposalId = proposalId;

        const overlay = document.getElementById("proposal-online-approval-overlay");
        const modal = document.getElementById("modal-proposal-online-approval");

        if (!modal || !overlay) return;

        const compTitle = document.getElementById("approval-company-title");
        const propTitle = document.getElementById("approval-proposal-title");
        const contactName = document.getElementById("approval-contact-name");
        const totalVal = document.getElementById("approval-total-value");
        const notesBody = document.getElementById("approval-notes-body");
        const statusBanner = document.getElementById("approval-status-banner");
        const btnConfirm = document.getElementById("btn-confirm-online-approval");

        if (compTitle) compTitle.textContent = proposal.company || "Empresa Cliente";
        if (propTitle) propTitle.textContent = proposal.title || "Proposta Comercial";
        if (contactName) contactName.textContent = `${proposal.contact || 'Responsável'} • ${proposal.company}`;
        if (totalVal) totalVal.textContent = (parseFloat(proposal.value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        if (notesBody) notesBody.textContent = proposal.notes || "Escopo técnico e comercial padrão conforme alinhado com o cliente.";

        if (proposal.status === "Ganho") {
            if (statusBanner) {
                statusBanner.style.background = "rgba(16, 185, 129, 0.12)";
                statusBanner.style.borderColor = "rgba(16, 185, 129, 0.3)";
                statusBanner.style.color = "#10b981";
                statusBanner.innerHTML = "🟢 <strong>PROPOSTA ACEITA E ASSINADA DIGITALMENTE COM SUCESSO!</strong>";
            }
            if (btnConfirm) {
                btnConfirm.disabled = true;
                btnConfirm.textContent = "✓ Proposta Já Assinada";
                btnConfirm.style.opacity = "0.7";
            }
        } else {
            if (statusBanner) {
                statusBanner.style.background = "rgba(245, 158, 11, 0.1)";
                statusBanner.style.borderColor = "rgba(245, 158, 11, 0.3)";
                statusBanner.style.color = "#d97706";
                statusBanner.innerHTML = "⏳ Esta proposta aguarda a validação e assinatura digital do cliente.";
            }
            if (btnConfirm) {
                btnConfirm.disabled = false;
                btnConfirm.textContent = "✅ Aceitar e Assinar Digitalmente";
                btnConfirm.style.opacity = "1";
            }
        }

        overlay.style.display = "block";
        modal.style.display = "block";
    },

    confirmOnlineProposalApproval() {
        if (!activeProposalId) return;
        const proposal = Store.getProposalById(activeProposalId);
        if (!proposal) return;

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        // 1. Atualizar proposta para Ganho
        proposal.status = "Ganho";
        proposal.wonAt = new Date().toISOString();
        Store.saveProposals();

        // 2. Atualizar Lead correspondente no CRM para Cliente Fechado
        const leads = Store.getLeads();
        const matchingLead = leads.find(l => l.company.toLowerCase() === proposal.company.toLowerCase());
        if (matchingLead) {
            matchingLead.stage = "Cliente Fechado";
            matchingLead.updatedAt = new Date().toISOString();
            Store.addLeadInteraction(matchingLead.id, userEmail, {
                type: "Reunião",
                description: `🎉 Proposta Comercial de R$ ${proposal.value} aceita e assinada digitalmente via Aceite Online.`
            });
            Store.saveLeads();
            window.dispatchEvent(new CustomEvent("vellia:leadsUpdated"));
        }

        // 3. Registrar Log de Auditoria
        Audit.logLeadUpdate(userEmail, proposal.company, `Proposta comercial (R$ ${proposal.value}) aceita online via Assinatura Digital.`);

        // 4. Notificar Central de Alertas
        window.dispatchEvent(new CustomEvent("vellia:aiNotification", {
            detail: {
                id: `proposal_win_${Date.now()}`,
                title: `🎉 Nova Venda Fechada!`,
                message: `A empresa ${proposal.company} acabou de assinar digitalmente a proposta no valor de R$ ${proposal.value}.`,
                type: "success"
            }
        }));

        this.renderStats();
        this.renderTable();

        this.openOnlineApprovalView(activeProposalId);
        alert(`🎉 Parabéns! Proposta da empresa ${proposal.company} aceita e assinada digitalmente com sucesso!\n\nStatus atualizado para GANHO e Lead convertido no CRM.`);
    },

    startVoiceProposalDictation() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("A API de Ditado de Voz (SpeechRecognition) não é suportada por este navegador. Recomendamos usar o Google Chrome ou Microsoft Edge.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "pt-BR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let toast = document.createElement("div");
        toast.id = "voice-dictation-banner";
        toast.style.cssText = `
            position: fixed; top: 25px; left: 50%; transform: translateX(-50%); z-index: 99999;
            background: linear-gradient(135deg, #1e1b4b, #312e81); border: 2px solid #818cf8;
            color: #fff; padding: 14px 24px; border-radius: 99px; box-shadow: 0 10px 40px rgba(99,102,241,0.5);
            display: flex; align-items: center; gap: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 13.5px; font-weight: 700; animation: pulse 1.5s infinite alternate;
        `;
        toast.innerHTML = `
            <span style="font-size: 18px;">🔴</span>
            <span>Escutando... Fale os detalhes da proposta (ex: "Proposta para Empresa X, serviço Y, valor 10 mil")</span>
        `;
        document.body.appendChild(toast);

        recognition.start();

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            if (toast) {
                toast.innerHTML = `<span>🧠 Processando via IA Gemini 2.5 Flash: "${transcript}"</span>`;
            }

            try {
                const prompt = `
Você é um assistente de CRM de vendas.
Extraia os dados da proposta comercial contidos na seguinte transcrição de áudio:

TRANSCRIÇÃO: "${transcript}"

Responda ESTRITAMENTE em formato JSON com o seguinte schema (sem markdown ou texto adicional):
{
  "company": "Nome da empresa ou cliente mencionado",
  "serviceTitle": "Título do serviço ou produto",
  "value": 0000,
  "notes": "Resumo dos pontos importantes"
}
`;

                const userApiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key");
                let res;

                if (userApiKey && userApiKey.trim()) {
                    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
                    res = await fetch(directUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });
                } else {
                    res = await fetch("/api/gemini-proxy", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "gemini-2.5-flash",
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    });
                }

                if (res.ok) {
                    const data = await res.json();
                    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                    const parsed = JSON.parse(rawText);

                    if (parsed) {
                        this.openModal();
                        setTimeout(() => {
                            const compInput = document.getElementById("proposal-company");
                            const valInput = document.getElementById("proposal-value");
                            const titleInput = document.getElementById("proposal-title");
                            const notesInput = document.getElementById("proposal-notes");

                            if (compInput && parsed.company) compInput.value = parsed.company;
                            if (valInput && parsed.value) valInput.value = parsed.value;
                            if (titleInput && parsed.serviceTitle) titleInput.value = parsed.serviceTitle;
                            if (notesInput && parsed.notes) notesInput.value = parsed.notes;

                            alert("✨ Formulário de proposta preenchido via ditado por voz!");
                        }, 200);
                    }
                }
            } catch (err) {
                console.error("Erro na extração de áudio via IA:", err);
                alert(`Transcrição capturada: "${transcript}". Abrindo formulário...`);
                this.openModal();
            } finally {
                if (toast) toast.remove();
            }
        };

        recognition.onerror = (e) => {
            console.error("Erro no reconhecimento de voz:", e);
            if (toast) toast.remove();
            alert("Não foi possível capturar o áudio. Por favor, verifique a permissão do microfone.");
        };

        recognition.onend = () => {
            setTimeout(() => {
                if (toast && toast.parentElement) toast.remove();
            }, 3000);
        };
    },

    async translateProposalAI(proposalId, targetLang = "en") {
        const id = proposalId || activeProposalId;
        if (!id) return;

        const proposal = Store.getProposalById(id);
        if (!proposal) return;

        const titleEl = document.getElementById("detail-title");
        const notesEl = document.getElementById("detail-notes");

        if (targetLang === "pt") {
            if (titleEl) titleEl.textContent = proposal.title || "Proposta Comercial";
            if (notesEl) notesEl.textContent = proposal.notes || "-";
            return;
        }

        const langName = targetLang === "en" ? "Inglês (English - US)" : "Espanhol (Español)";
        if (notesEl) notesEl.textContent = `🤖 Traduzindo proposta para ${langName} via Gemini 2.5 Flash... Aguarde...`;

        const prompt = `
Você é um Tradutor Corporativo Executivo B2B.
Traduz a seguinte proposta comercial para o idioma ${langName}.

PROPOSTA ORIGINAL:
Título: "${proposal.title}"
Empresa: "${proposal.company}"
Valor: "R$ ${proposal.value}"
Observações/Escopo Técnico: "${proposal.notes || ''}"

Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "translatedTitle": "Título traduzido",
  "translatedNotes": "Observações e escopo traduzidos em tom executivo",
  "formattedCurrency": "Valor em moeda internacional equivalente (ex: USD $X.XXX ou EUR €X.XXX)"
}
`;

        try {
            const userApiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key");
            let res;

            if (userApiKey && userApiKey.trim()) {
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
                res = await fetch(directUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
            } else {
                res = await fetch("/api/gemini-proxy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "gemini-2.5-flash",
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
            }

            if (res.ok) {
                const data = await res.json();
                let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(rawText);

                if (parsed) {
                    if (titleEl && parsed.translatedTitle) titleEl.textContent = `[${targetLang.toUpperCase()}] ${parsed.translatedTitle}`;
                    if (notesEl && parsed.translatedNotes) notesEl.textContent = `${parsed.translatedNotes}\n\n🌐 Value: ${parsed.formattedCurrency}`;
                }
            }
        } catch (e) {
            console.error("Erro na tradução multilíngue:", e);
            alert("Erro ao realizar tradução por IA. Tente novamente em instantes.");
        }
    }
};

window.Proposals = Proposals;
