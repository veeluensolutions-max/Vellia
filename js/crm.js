import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";
import { SDR } from "./sdr.js";
import { LeadAIScore } from "./ai-score.js";
import { CrossSelling } from "./cross-selling.js";
import { CNPJService } from "./cnpj-service.js";
import { QualificationAI } from "./qualification-ai.js";
import { VisionOCR } from "./vision-ocr.js";
import { Proposals } from "./proposals.js";

let activeLeadId = null;
let pendingStageChange = null;

export const CRM = {
    _eventsBound: false,
    _realtimeListenersBound: false,
    get activeLeadId() {
        return activeLeadId;
    },
    set activeLeadId(id) {
        activeLeadId = id;
    },
    init() {
        if (!this._eventsBound && !window.__velliaCrmEventsBound) {
            this.bindEvents();
            this._eventsBound = true;
            window.__velliaCrmEventsBound = true;
        }
        this.renderLeadsTable();

        if (!this._realtimeListenersBound) {
            // Atualização em tempo real ao receber leads via Meta Ads / Facebook / WhatsApp
            window.addEventListener("vellia:metaLeadReceived", () => this.renderLeadsTable());
            window.addEventListener("vellia:waSent", (e) => {
                this.renderLeadsTable();
                const targetId = e?.detail?.leadId || activeLeadId;
                if (targetId && activeLeadId && String(targetId) === String(activeLeadId)) {
                    const l = Store.getLeadById(activeLeadId);
                    if (l) {
                        this.renderTimeline(l);
                        this.renderWhatsAppChat(l);
                        this.renderFollowups(l);
                    }
                }
            });
            window.addEventListener("vellia:leadUpdated", (e) => {
                this.renderLeadsTable();
                const updatedLead = e?.detail;
                if (activeLeadId && updatedLead && String(updatedLead.id) === String(activeLeadId)) {
                    this.renderTimeline(updatedLead);
                    this.renderWhatsAppChat(updatedLead);
                    this.renderFollowups(updatedLead);
                }
            });
            window.addEventListener("vellia:leadDeleted", () => this.renderLeadsTable());
            window.addEventListener("vellia:leadRestored", () => this.renderLeadsTable());
            this._realtimeListenersBound = true;

            // Recalcular SLA de atendimento automaticamente a cada 30 segundos
            setInterval(() => {
                const crmView = document.getElementById("view-crm");
                if (crmView && crmView.style.display !== "none") {
                    this.renderLeadsTable();
                }
            }, 30000);
        }
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
            btnCancelStageReason: document.getElementById("btn-cancel-stage-reason"),
            btnEditLead: document.getElementById("btn-edit-lead"),
            btnDeleteLead: document.getElementById("btn-delete-lead"),
            btnCloseEditLead: document.getElementById("btn-close-edit-lead"),
            btnCancelEditLead: document.getElementById("btn-cancel-edit-lead"),
            editLeadForm: document.getElementById("edit-lead-form"),
            leadCnpjInput: document.getElementById("lead-cnpj"),
            btnLookupCnpj: document.getElementById("btn-lookup-cnpj"),
            editLeadCnpjInput: document.getElementById("edit-lead-cnpj"),
            btnEditLookupCnpj: document.getElementById("btn-edit-lookup-cnpj")
        };

        // Eventos de Consulta Inteligente de CNPJ (Novo Lead)
        if (elements.leadCnpjInput) {
            elements.leadCnpjInput.addEventListener("input", (e) => {
                e.target.value = CNPJService.formatCNPJ(e.target.value);
                const digits = CNPJService.cleanDigits(e.target.value);
                if (digits.length === 14) {
                    this.lookupCNPJ('new');
                }
            });
            elements.leadCnpjInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.lookupCNPJ('new');
                }
            });
        }
        if (elements.btnLookupCnpj) {
            elements.btnLookupCnpj.addEventListener("click", () => this.lookupCNPJ('new'));
        }

        // Eventos de Consulta Inteligente de CNPJ (Edição de Lead)
        if (elements.editLeadCnpjInput) {
            elements.editLeadCnpjInput.addEventListener("input", (e) => {
                e.target.value = CNPJService.formatCNPJ(e.target.value);
                const digits = CNPJService.cleanDigits(e.target.value);
                if (digits.length === 14) {
                    this.lookupCNPJ('edit');
                }
            });
            elements.editLeadCnpjInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.lookupCNPJ('edit');
                }
            });
        }
        if (elements.btnEditLookupCnpj) {
            elements.btnEditLookupCnpj.addEventListener("click", () => this.lookupCNPJ('edit'));
        }

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

        // Modal Edição de Lead
        if (elements.btnEditLead) elements.btnEditLead.addEventListener("click", () => this.openEditLeadModal());
        if (elements.btnDeleteLead) elements.btnDeleteLead.addEventListener("click", () => this.deleteLead());
        if (elements.btnCloseEditLead) elements.btnCloseEditLead.addEventListener("click", () => this.closeEditLeadModal());
        if (elements.btnCancelEditLead) elements.btnCancelEditLead.addEventListener("click", () => this.closeEditLeadModal());
        if (elements.editLeadForm) {
            elements.editLeadForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveEditLead();
            });
        }

        // Filtros e Busca
        if (elements.crmSearch) elements.crmSearch.addEventListener("input", () => this.renderLeadsTable());
        if (elements.crmFilterStage) {
            elements.crmFilterStage.addEventListener("change", (e) => {
                const colStage = document.getElementById("lead-col-filter-stage");
                if (colStage) colStage.value = e.target.value;
                this.renderLeadsTable();
            });
        }
        const topOwnerFilter = document.getElementById("crm-filter-owner");
        if (topOwnerFilter) {
            topOwnerFilter.addEventListener("change", (e) => {
                const colOwner = document.getElementById("lead-col-filter-owner");
                if (colOwner) colOwner.value = e.target.value;
                this.renderLeadsTable();
            });
        }
        const crmFilterSort = document.getElementById("crm-filter-sort");
        if (crmFilterSort) crmFilterSort.addEventListener("change", () => this.renderLeadsTable());

        // Filtros dinâmicos por coluna da tabela de leads
        const colCompany = document.getElementById("lead-col-filter-company");
        const colContact = document.getElementById("lead-col-filter-contact");
        const colInfo = document.getElementById("lead-col-filter-info");
        const colSegment = document.getElementById("lead-col-filter-segment");
        const colStage = document.getElementById("lead-col-filter-stage");
        const colScore = document.getElementById("lead-col-filter-score");
        const colOwner = document.getElementById("lead-col-filter-owner");
        const btnClearColFilters = document.getElementById("btn-clear-lead-col-filters");

        if (colCompany) colCompany.addEventListener("input", () => this.renderLeadsTable());
        if (colContact) colContact.addEventListener("input", () => this.renderLeadsTable());
        if (colInfo) colInfo.addEventListener("input", () => this.renderLeadsTable());
        if (colSegment) colSegment.addEventListener("input", () => this.renderLeadsTable());
        if (colStage) {
            colStage.addEventListener("change", (e) => {
                if (elements.crmFilterStage) elements.crmFilterStage.value = e.target.value;
                this.renderLeadsTable();
            });
        }
        if (colScore) colScore.addEventListener("change", () => this.renderLeadsTable());
        if (colOwner) {
            colOwner.addEventListener("change", (e) => {
                const topOwner = document.getElementById("crm-filter-owner");
                if (topOwner) topOwner.value = e.target.value;
                this.renderLeadsTable();
            });
        }

        if (btnClearColFilters) {
            btnClearColFilters.addEventListener("click", () => {
                if (colCompany) colCompany.value = "";
                if (colContact) colContact.value = "";
                if (colInfo) colInfo.value = "";
                if (colSegment) colSegment.value = "";
                if (colStage) colStage.value = "all";
                if (colScore) colScore.value = "all";
                if (colOwner) colOwner.value = "all";
                if (elements.crmSearch) elements.crmSearch.value = "";
                if (elements.crmFilterStage) elements.crmFilterStage.value = "all";
                const topOwner = document.getElementById("crm-filter-owner");
                if (topOwner) topOwner.value = "all";
                this.renderLeadsTable();
            });
        }

        // Pílulas de Filtros Rápidos (Pill Filters)
        const pillContainer = document.getElementById("crm-pill-filters");
        if (pillContainer && !this._pillEventsBound) {
            pillContainer.addEventListener("click", (e) => {
                const btn = e.target.closest(".crm-pill-filter");
                if (btn) {
                    pillContainer.querySelectorAll(".crm-pill-filter").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                    this.activePillFilter = btn.getAttribute("data-filter") || "all";
                    this.renderLeadsTable();
                }
            });
            this._pillEventsBound = true;
        }

        // Drawer Detalhes e Botões de Ação Rápida
        if (elements.btnCloseDrawer) elements.btnCloseDrawer.addEventListener("click", () => this.closeLeadDrawer());
        if (elements.drawerOverlay) elements.drawerOverlay.addEventListener("click", () => this.closeLeadDrawer());
        if (elements.modalOverlay) {
            elements.modalOverlay.addEventListener("click", () => {
                this.closeNewLeadModal();
                this.closeEditLeadModal();
                this.closeQualifyLeadModal?.();
                this.cancelStageChangeRequest?.();
                document.getElementById("modal-overlay").style.display = "none";
            });
        }

        // Tecla ESC fecha instantaneamente gavetas e modais evitando tela embaçada
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeLeadDrawer();
                this.closeNewLeadModal();
                this.closeEditLeadModal();
                this.closeQualifyLeadModal?.();
                this.cancelStageChangeRequest?.();
                const mOverlay = document.getElementById("modal-overlay");
                if (mOverlay) mOverlay.style.display = "none";
                const dOverlay = document.getElementById("drawer-overlay");
                if (dOverlay) dOverlay.style.display = "none";
                const uOverlay = document.getElementById("users-modal-overlay");
                if (uOverlay) uOverlay.style.display = "none";
                const udOverlay = document.getElementById("user-details-modal-overlay");
                if (udOverlay) udOverlay.style.display = "none";
            }
        });

        const btnQuickCall = document.getElementById("btn-drawer-quick-call");
        if (btnQuickCall) {
            btnQuickCall.addEventListener("click", () => {
                if (!activeLeadId) return;
                const lead = Store.getLeadById(activeLeadId);
                const cur = Auth.getCurrentUser();
                const isSeller = cur && (cur.role === "seller" || cur.role === "vendedor");
                const sellerEmail = isSeller ? cur.email : (lead?.owner || cur?.email || "");
                window.Dashboard?.openQuickCallModal(sellerEmail, activeLeadId);
            });
        }

        const btnQuickWa = document.getElementById("btn-drawer-quick-wa");
        if (btnQuickWa) {
            btnQuickWa.addEventListener("click", () => {
                if (!activeLeadId) return;
                const lead = Store.getLeadById(activeLeadId);
                if (!lead) return;
                const phone = lead.whatsapp || lead.phone;
                if (!phone) {
                    if (typeof Toast !== "undefined" && Toast?.warning) {
                        Toast.warning("Sem WhatsApp", `O lead "${lead.company}" não possui telefone ou WhatsApp cadastrado.`);
                    } else {
                        alert(`O lead "${lead.company}" não possui telefone ou WhatsApp cadastrado.`);
                    }
                    return;
                }
                window.WhatsApp?.openModalForLead(activeLeadId);
            });
        }
        const btnQuickProp = document.getElementById("btn-drawer-quick-prop");
        if (btnQuickProp) {
            btnQuickProp.addEventListener("click", () => {
                if (!activeLeadId) return;
                const lead = Store.getLeadById(activeLeadId);
                if (!lead) return;

                // 1. Fechar gaveta do lead
                this.closeLeadDrawer();

                // 2. Navegar para a tela de Propostas
                window.location.hash = "#proposals";

                // 3. Abrir o orçamento com todos os dados do lead carregados
                setTimeout(() => {
                    if (window.Proposals && typeof window.Proposals.openBudgetScreen === "function") {
                        window.Proposals.openBudgetScreen(null, lead);
                    } else if (typeof Proposals?.openBudgetScreen === "function") {
                        Proposals.openBudgetScreen(null, lead);
                    }
                }, 120);
            });
        }
        const btnCrmScanner = document.getElementById("btn-crm-scanner");
        if (btnCrmScanner) {
            btnCrmScanner.addEventListener("click", () => VisionOCR.openModal());
        }

        const btnDrawerScanner = document.getElementById("btn-drawer-quick-scanner");
        if (btnDrawerScanner) {
            btnDrawerScanner.addEventListener("click", () => VisionOCR.openModal(activeLeadId));
        }

        const btnQuickCopilot = document.getElementById("btn-drawer-quick-copilot");
        if (btnQuickCopilot) {
            btnQuickCopilot.addEventListener("click", () => {
                if (activeLeadId && window.Copilot) {
                    window.Copilot.openForLead(activeLeadId);
                }
            });
        }

        // Ouvintes de evento do Chat WhatsApp / SDR Takeover
        const btnTakeover = document.getElementById("btn-takeover-chat");
        if (btnTakeover) {
            btnTakeover.addEventListener("click", () => this.handleChatTakeover());
        }
        const btnSendChat = document.getElementById("btn-send-chat-msg");
        const inputChat = document.getElementById("chat-text-input");
        if (btnSendChat && inputChat) {
            btnSendChat.addEventListener("click", () => this.sendChatWhatsAppMessage());
            inputChat.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    this.sendChatWhatsAppMessage();
                }
            });
        }

        // Pílulas de Resposta Rápida (Templates com Variáveis)
        document.querySelectorAll(".wa-tpl-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                const tplType = pill.getAttribute("data-template");
                this.applyWaTemplate(tplType);
            });
        });

        // Botão Rascunhar com IA (Gemini)
        const btnAIDraft = document.getElementById("btn-wa-ai-draft");
        if (btnAIDraft) {
            btnAIDraft.addEventListener("click", () => this.generateWaAIDraft());
        }

        // Chips de seleção rápida de tipo de interação
        document.querySelectorAll(".interaction-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const type = chip.getAttribute("data-type");
                const selectEl = document.getElementById("interaction-type");
                if (selectEl) selectEl.value = type;

                const quickOutcomes = document.getElementById("drawer-call-quick-outcomes");
                if (quickOutcomes) {
                    quickOutcomes.style.display = type === "Ligação" ? "flex" : "none";
                }

                document.querySelectorAll(".interaction-chip").forEach(c => {
                    if (c.getAttribute("data-type") === type) {
                        c.classList.add("active");
                        c.style.borderColor = "#6366f1";
                        c.style.background = "rgba(99, 102, 241, 0.1)";
                        c.style.color = "#6366f1";
                        c.style.fontWeight = "700";
                    } else {
                        c.classList.remove("active");
                        c.style.borderColor = "var(--border-color)";
                        c.style.background = "var(--bg-card)";
                        c.style.color = "var(--text-secondary)";
                        c.style.fontWeight = "600";
                    }
                });
            });
        });

        // Registro instantâneo de ligação em 1 clique dentro da ficha do lead
        document.querySelectorAll(".drawer-instant-call-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (!activeLeadId) return;
                const outcomeText = btn.getAttribute("data-outcome");
                const currentUser = Auth.getCurrentUser();
                const lead = Store.getLeadById(activeLeadId);
                if (!currentUser || !lead || !outcomeText) return;

                Store.addLeadInteraction(activeLeadId, currentUser.email, {
                    type: "Ligação",
                    description: outcomeText
                });

                try {
                    Audit.logStageChange(currentUser.email, lead.company, lead.stage, lead.stage, `Ligação registrada: ${outcomeText}`);
                } catch (e) {}

                const updatedLead = Store.getLeadById(activeLeadId);
                this.renderTimeline(updatedLead);
                this.renderLeadsTable();

                if (window.Toast && typeof window.Toast.show === "function") {
                    window.Toast.show("Ligação registrada em tempo real!", "success");
                }
            });
        });

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

        const btnCancelQualify = document.getElementById("btn-cancel-qualify");
        if (btnCancelQualify) btnCancelQualify.addEventListener("click", () => this.cancelQualifyLeadRequest());

        const btnSkipQualify = document.getElementById("btn-skip-qualify");
        if (btnSkipQualify) {
            btnSkipQualify.addEventListener("click", () => {
                const leadId = activeLeadId;
                this.closeQualifyLeadModal();
                if (leadId) {
                    this.executeDirectStageChange(leadId, "Lead Qualificado");
                }
            });
        }

        const qualifyForm = document.getElementById("qualify-lead-form");
        if (qualifyForm) qualifyForm.addEventListener("submit", (e) => {
            e.preventDefault();
            this.confirmQualifyLead();
        });

        // Follow-up toggle
        const btnToggleFollowup = document.getElementById("btn-toggle-followup-form");
        const followupFormContainer = document.getElementById("followup-form-container");
        if (btnToggleFollowup && followupFormContainer) {
            btnToggleFollowup.addEventListener("click", () => {
                const visible = followupFormContainer.style.display !== "none";
                followupFormContainer.style.display = visible ? "none" : "block";
                btnToggleFollowup.textContent = visible ? "+ Novo" : "✕ Fechar";
                if (!visible) {
                    // Pre-fill datetime to 1 hour from now
                    const dt = new Date(Date.now() + 3600000);
                    const pad = n => String(n).padStart(2, "0");
                    const local = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
                    const inp = document.getElementById("followup-datetime");
                    if (inp) inp.value = local;
                }
            });
        }

        // Follow-up save
        const btnSaveFollowup = document.getElementById("btn-save-followup");
        if (btnSaveFollowup) btnSaveFollowup.addEventListener("click", () => this.saveFollowup());

        // Comentários internos — enviar
        const btnSendComment = document.getElementById("btn-send-comment");
        if (btnSendComment) btnSendComment.addEventListener("click", () => this.sendComment());
        // Ctrl+Enter no textarea envia comentário
        const commentInput = document.getElementById("comment-text-input");
        if (commentInput) {
            commentInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.sendComment();
                }
            });
        }

        // Inspeções do cliente
        const btnToggleInspection = document.getElementById("btn-toggle-inspection-form");
        const inspectionFormContainer = document.getElementById("inspection-form-container");
        if (btnToggleInspection && inspectionFormContainer) {
            btnToggleInspection.addEventListener("click", () => {
                const visible = inspectionFormContainer.style.display !== "none";
                inspectionFormContainer.style.display = visible ? "none" : "block";
                btnToggleInspection.textContent = visible ? "+ Registrar Nova" : "✕ Fechar";
                if (!visible) {
                    const execInput = document.getElementById("inspection-exec-date");
                    if (execInput) execInput.value = new Date().toISOString().split("T")[0];
                }
            });
        }

        const btnSaveInspection = document.getElementById("btn-save-inspection");
        if (btnSaveInspection) {
            btnSaveInspection.addEventListener("click", () => {
                this.saveLeadInspection();
            });
        }

        const btnGenDocs = document.getElementById("btn-generate-docs-proposal");
        if (btnGenDocs) {
            btnGenDocs.addEventListener("click", () => this.generateDocsProposal());
        }

        // Abas do Lead Drawer (Tabs Clean)
        document.querySelectorAll(".lead-drawer-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const tab = btn.getAttribute("data-tab");
                if (tab) this.switchDrawerTab(tab);
            });
        });

        // Pipeline Stepper (Mudança Visual de Estágio do Lead)
        document.querySelectorAll(".lead-stage-step").forEach(stepBtn => {
            stepBtn.addEventListener("click", () => {
                const stage = stepBtn.getAttribute("data-stage");
                if (stage) this.handleStageChangeRequest(stage);
            });
        });

        const btnMarkLost = document.getElementById("btn-drawer-mark-lost");
        if (btnMarkLost) {
            btnMarkLost.addEventListener("click", () => {
                const lead = Store.getLeadById(activeLeadId);
                if (lead?.stage === "Cliente Perdido") {
                    this.handleStageChangeRequest("Lead Qualificado");
                } else {
                    this.handleStageChangeRequest("Cliente Perdido");
                }
            });
        }

        // Ações de Copiar no Drawer com Toast
        const bindCopyBtn = (id, getValue, label) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const val = getValue();
                    if (!val || val === "-" || val === "Não informado") return;
                    navigator.clipboard.writeText(val);
                    if (window.Toast) Toast.info("Copiado!", `${label} copiado para a área de transferência.`);
                });
            }
        };

        bindCopyBtn("btn-copy-wa", () => Store.getLeadById(activeLeadId)?.whatsapp, "WhatsApp");
        bindCopyBtn("btn-copy-phone2", () => Store.getLeadById(activeLeadId)?.phone2, "Telefone Secundário");
        bindCopyBtn("btn-copy-email", () => Store.getLeadById(activeLeadId)?.email, "E-mail");
        bindCopyBtn("btn-copy-email2", () => Store.getLeadById(activeLeadId)?.email2, "E-mail Secundário");
        bindCopyBtn("btn-copy-cnpj", () => Store.getLeadById(activeLeadId)?.cnpj, "CNPJ");

        const btnOpenWa = document.getElementById("btn-open-wa-direct");
        if (btnOpenWa) {
            btnOpenWa.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!activeLeadId) return;
                const lead = Store.getLeadById(activeLeadId);
                const rawNum = lead?.whatsapp || lead?.phone;
                if (!rawNum) return;
                const curUser = Auth.getCurrentUser();
                Store.addLeadInteraction(activeLeadId, curUser?.email || "sistema@vellia.com", {
                    type: "WhatsApp",
                    description: `Contato direto via WhatsApp (${rawNum}) iniciado com ${lead.contact || lead.company}.`
                });
                const clean = rawNum.replace(/\D/g, "");
                const num = clean.startsWith("55") ? clean : `55${clean}`;
                window.open(`https://wa.me/${num}`, "_blank");
            });
        }

        const btnMailLink = document.getElementById("btn-mail-link");
        if (btnMailLink) {
            btnMailLink.addEventListener("click", () => {
                if (!activeLeadId) return;
                const lead = Store.getLeadById(activeLeadId);
                if (!lead || !lead.email) return;
                const curUser = Auth.getCurrentUser();
                Store.addLeadInteraction(activeLeadId, curUser?.email || "sistema@vellia.com", {
                    type: "E-mail",
                    description: `Contato via E-mail (${lead.email}) enviado para ${lead.contact || lead.company}.`
                });
            });
        }
    },

    switchDrawerTab(tabName) {
        document.querySelectorAll(".lead-drawer-tab-btn").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
        });
        document.querySelectorAll(".lead-tab-pane").forEach(pane => {
            const isActive = pane.id === `tab-pane-${tabName}`;
            pane.classList.toggle("active", isActive);
            pane.style.display = isActive ? "flex" : "none";
        });
    },

    updatePipelineStepper(currentStage) {
        const stages = [
            "Contato",
            "Lead Gerado",
            "Lead Qualificado",
            "Proposta Enviada",
            "Negociação",
            "Cliente Fechado"
        ];
        const shortLabels = {
            "Contato": "Contato",
            "Lead Gerado": "Gerado",
            "Lead Qualificado": "Qualificado",
            "Proposta Enviada": "Proposta",
            "Negociação": "Negociação",
            "Cliente Fechado": "Fechado"
        };

        const isLost = currentStage === "Cliente Perdido";
        const currentIndex = stages.indexOf(currentStage);

        document.querySelectorAll(".lead-stage-step").forEach((btn, idx) => {
            const stepStage = btn.getAttribute("data-stage");
            const label = shortLabels[stepStage] || stepStage.replace("Lead ", "");
            btn.classList.remove("active", "completed", "lost");

            if (isLost) {
                btn.innerHTML = `${idx + 1}. ${label}`;
            } else if (idx < currentIndex) {
                btn.classList.add("completed");
                btn.innerHTML = `✓ ${label}`;
            } else if (idx === currentIndex) {
                btn.classList.add("active");
                btn.innerHTML = `● ${label}`;
            } else {
                btn.innerHTML = `${idx + 1}. ${label}`;
            }
        });

        const btnLost = document.getElementById("btn-drawer-mark-lost");
        if (btnLost) {
            btnLost.textContent = isLost ? "● Reativar Lead" : "Marcar Perdido";
            btnLost.style.color = isLost ? "var(--primary)" : "#ef4444";
        }
    },

    async generateDocsProposal() {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        const btn = document.getElementById("btn-generate-docs-proposal");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Processando...";
        }

        try {
            const apiUrl = localStorage.getItem("vellia_docs_api_url") || "http://localhost:3001";
            const frontendUrl = localStorage.getItem("vellia_docs_frontend_url") || "http://localhost:3000";

            // Sincronizar o contato para garantir que ele exista no Vellia Docs
            const contactPayload = {
                contact_id: lead.id,
                name: lead.company || lead.contact || "Sem Nome",
                status: lead.stage || "Lead Qualificado",
                email: lead.email || "",
                phone: lead.phone || lead.whatsapp || "",
                contact_person: lead.contact || "",
                segment: lead.segment || ""
            };

            // 1. Verificar se existe
            const checkRes = await fetch(`${apiUrl}/v1/contacts/${lead.id}`, {
                headers: { "x-client-id": "admin@veeluen.ai" }
            });

            if (checkRes.ok) {
                // Atualizar
                await fetch(`${apiUrl}/v1/contacts/${lead.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "x-client-id": "admin@veeluen.ai"
                    },
                    body: JSON.stringify({
                        name: lead.company || lead.contact || "Sem Nome",
                        status: lead.stage || "Lead Qualificado",
                        email: lead.email || "",
                        phone: lead.phone || lead.whatsapp || "",
                        contact_person: lead.contact || "",
                        segment: lead.segment || ""
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
            const targetUrl = `${frontendUrl}/documents/new?clientId=${lead.id}`;
            window.open(targetUrl, "_blank");

        } catch (err) {
            console.error("Erro ao gerar proposta no Vellia Docs:", err);
            alert("Erro ao conectar ao Vellia Docs. Verifique se o servidor está rodando.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "📄 Gerar Proposta no Vellia Docs";
            }
        }
    },

    // ==========================================================================
    // RENDERIZAR TABELA DE LEADS
    // ==========================================================================
    
    renderLeadsTable() {
        const tableBody = document.getElementById("crm-table-body");
        if (!tableBody) return;

        let leads = Store.getLeads();
        const currentUser = Auth.getCurrentUser();
        const isAdmin = currentUser && (currentUser.role === "admin" || currentUser.role === "manager");

        // ---- Mostrar/ocultar UI exclusiva de Admin ----
        const btnAiDistribute = document.getElementById("btn-ai-distribute");
        const ownerFilterGroup = document.getElementById("crm-filter-owner-group");
        const ownerFilter = document.getElementById("crm-filter-owner");

        if (isAdmin) {
            if (btnAiDistribute) btnAiDistribute.style.display = "inline-flex";
            if (ownerFilterGroup) ownerFilterGroup.style.display = "block";

            // Popular dropdown de vendedores
            if (ownerFilter && ownerFilter.options.length <= 1) {
                const sellers = Store.getUsers().filter(u => u.role === "seller" || u.role === "manager" || u.role === "admin");
                sellers.forEach(u => {
                    const opt = document.createElement("option");
                    opt.value = u.email;
                    opt.textContent = u.name;
                    ownerFilter.appendChild(opt);
                });
            }
        } else {
            // Vendedor: filtra leads cadastrados por ele ou atribuídos a ele (case-insensitive)
            const userEmail = (currentUser?.email || "").toLowerCase().trim();
            leads = leads.filter(l => {
                const owner = (l.owner || "").toLowerCase().trim();
                const createdBy = (l.createdBy || "").toLowerCase().trim();
                return owner === userEmail || createdBy === userEmail;
            });
            if (btnAiDistribute) btnAiDistribute.style.display = "none";
            if (ownerFilterGroup) ownerFilterGroup.style.display = "none";
            const colOwnerFilter = document.getElementById("lead-col-filter-owner");
            if (colOwnerFilter) colOwnerFilter.style.display = "none";
        }

        // Popular dropdown de vendedores da coluna da tabela
        const colOwnerFilter = document.getElementById("lead-col-filter-owner");
        if (colOwnerFilter && colOwnerFilter.options.length <= 1) {
            const sellers = Store.getUsers().filter(u => u.role === "seller" || u.role === "manager" || u.role === "admin");
            sellers.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.email;
                opt.textContent = u.name || u.email;
                colOwnerFilter.appendChild(opt);
            });
        }

        const searchQuery = document.getElementById("crm-search")?.value.toLowerCase().trim() || "";
        const stageFilter = document.getElementById("crm-filter-stage")?.value || "all";
        const ownerFilterValue = ownerFilter?.value || "all";

        // Filtros específicos por coluna
        const colCompany = (document.getElementById("lead-col-filter-company")?.value || "").toLowerCase().trim();
        const colContact = (document.getElementById("lead-col-filter-contact")?.value || "").toLowerCase().trim();
        const colInfo = (document.getElementById("lead-col-filter-info")?.value || "").toLowerCase().trim();
        const colSegment = (document.getElementById("lead-col-filter-segment")?.value || "").toLowerCase().trim();
        const colStage = document.getElementById("lead-col-filter-stage")?.value || "all";
        const colScore = document.getElementById("lead-col-filter-score")?.value || "all";
        const colOwner = document.getElementById("lead-col-filter-owner")?.value || "all";

        const proposals = Store.getProposals();
        const now = new Date();

        const getLeadDaysNoContact = (lead) => {
            let lastDate = new Date(lead.createdAt || now);
            if (lead.interactions && lead.interactions.length > 0) {
                const sorted = [...lead.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                lastDate = new Date(sorted[0].timestamp);
            }
            return Math.floor(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
        };

        const getLeadMinutesSLA = (lead) => {
            let lastDate = new Date(lead.createdAt || now);
            if (lead.interactions && lead.interactions.length > 0) {
                const sorted = [...lead.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                lastDate = new Date(sorted[0].timestamp);
            }
            return Math.floor(Math.abs(now - lastDate) / (1000 * 60));
        };

        const getLeadValue = (lead) => {
            return proposals.filter(p => p.leadId === lead.id && p.status !== "Perdido").reduce((s, p) => s + (p.value || 0), 0);
        };

        // Contadores das Pílulas em tempo real
        const countAll = leads.length;
        const countHot = leads.filter(l => (l.aiScore || 0) >= 75).length;
        const countWarm = leads.filter(l => (l.aiScore || 0) >= 45 && (l.aiScore || 0) < 75).length;
        const countNoContact = leads.filter(l => getLeadDaysNoContact(l) >= 3 && l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido").length;
        const countHighValue = leads.filter(l => getLeadValue(l) >= 5000).length;
        const countSLAExpired = leads.filter(l => getLeadMinutesSLA(l) >= 15 && l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido").length;

        const setPillText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setPillText("pill-count-all", countAll);
        setPillText("pill-count-hot", countHot);
        setPillText("pill-count-warm", countWarm);
        setPillText("pill-count-nocontact", countNoContact);
        setPillText("pill-count-highvalue", countHighValue);
        setPillText("pill-count-sla", countSLAExpired);

        // Filtro de leads
        const activePill = this.activePillFilter || "all";

        const filteredLeads = leads.filter(lead => {
            const cleanQueryDigits = searchQuery.replace(/\D/g, "");
            const leadCnpjDigits = (lead.cnpj || "").replace(/\D/g, "");
            const matchesCnpj = cleanQueryDigits.length >= 3 && leadCnpjDigits.includes(cleanQueryDigits);

            const matchesSearch =
                (lead.company || "").toLowerCase().includes(searchQuery) ||
                (lead.contact || "").toLowerCase().includes(searchQuery) ||
                (lead.segment || "").toLowerCase().includes(searchQuery) ||
                (lead.email || "").toLowerCase().includes(searchQuery) ||
                (lead.cnpj && lead.cnpj.toLowerCase().includes(searchQuery)) ||
                matchesCnpj;

            const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
            const matchesOwner = !isAdmin || ownerFilterValue === "all" || lead.owner === ownerFilterValue;

            let matchesPill = true;
            if (activePill === "hot") {
                matchesPill = (lead.aiScore || 0) >= 75;
            } else if (activePill === "warm") {
                matchesPill = (lead.aiScore || 0) >= 45 && (lead.aiScore || 0) < 75;
            } else if (activePill === "nocontact") {
                matchesPill = getLeadDaysNoContact(lead) >= 3 && lead.stage !== "Cliente Fechado" && lead.stage !== "Cliente Perdido";
            } else if (activePill === "highvalue") {
                matchesPill = getLeadValue(lead) >= 5000;
            } else if (activePill === "sla-expired") {
                matchesPill = getLeadMinutesSLA(lead) >= 15 && lead.stage !== "Cliente Fechado" && lead.stage !== "Cliente Perdido";
            }

            if (!matchesSearch || !matchesStage || !matchesOwner || !matchesPill) {
                return false;
            }

            // 1. Coluna Empresa
            if (colCompany) {
                const comp = (lead.company || "").toLowerCase();
                const cnpj = (lead.cnpj || "").toLowerCase();
                if (!comp.includes(colCompany) && !cnpj.includes(colCompany)) {
                    return false;
                }
            }

            // 2. Coluna Contato / Cargo
            if (colContact) {
                const cont = (lead.contact || "").toLowerCase();
                const role = (lead.role || lead.cargo || "").toLowerCase();
                if (!cont.includes(colContact) && !role.includes(colContact)) {
                    return false;
                }
            }

            // 3. Coluna Contato Info (Email / Telefone / WhatsApp)
            if (colInfo) {
                const email = (lead.email || "").toLowerCase();
                const phone = (lead.phone || "").replace(/\D/g, "");
                const cleanInfoDigits = colInfo.replace(/\D/g, "");
                const matchesPhone = cleanInfoDigits.length >= 2 && phone.includes(cleanInfoDigits);
                if (!email.includes(colInfo) && !matchesPhone) {
                    return false;
                }
            }

            // 4. Coluna Segmento / Origem
            if (colSegment) {
                const seg = (lead.segment || "").toLowerCase();
                const src = (lead.source || "").toLowerCase();
                if (!seg.includes(colSegment) && !src.includes(colSegment)) {
                    return false;
                }
            }

            // 5. Coluna Estágio Atual
            if (colStage !== "all" && lead.stage !== colStage) {
                return false;
            }

            // 6. Coluna Score IA
            if (colScore !== "all") {
                const score = lead.aiScore != null ? lead.aiScore : 0;
                if (colScore === "hot" && !(score >= 75)) return false;
                if (colScore === "warm" && !(score >= 45 && score < 75)) return false;
                if (colScore === "cold" && !(score < 45)) return false;
            }

            // 7. Coluna Responsável
            if (colOwner !== "all" && lead.owner !== colOwner) {
                return false;
            }

            return true;
        });

        // Ordenação inteligente dos leads (padrão: cadastrados mais recentes no topo)
        const sortSelect = document.getElementById("crm-filter-sort");
        const sortMode = sortSelect ? sortSelect.value : "recent-created";

        filteredLeads.sort((a, b) => {
            if (sortMode === "score-desc") {
                const scoreA = a.aiScore != null ? a.aiScore : 0;
                const scoreB = b.aiScore != null ? b.aiScore : 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
                return Store.getLeadTimestamp(b) - Store.getLeadTimestamp(a);
            }
            if (sortMode === "sla-desc") {
                const slaA = getLeadMinutesSLA(a);
                const slaB = getLeadMinutesSLA(b);
                if (slaB !== slaA) return slaB - slaA;
                return Store.getLeadTimestamp(b) - Store.getLeadTimestamp(a);
            }
            if (sortMode === "company-asc") {
                return (a.company || "").localeCompare(b.company || "");
            }
            // Padrão: "recent-created" (cadastrados mais recentes no topo)
            return Store.getLeadTimestamp(b) - Store.getLeadTimestamp(a);
        });

        if (filteredLeads.length === 0) {
            tableBody.innerHTML = `
                            <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        Nenhum lead ou contato encontrado para a pesquisa.
                    </td>
                </tr>
            `;
            return;
        }

        // Montar lista de vendedores para o select inline (admin)
        const sellers = isAdmin ? Store.getUsers().filter(u => u.role === "seller" || u.role === "manager" || u.role === "admin") : [];
        const sellerOptions = sellers.map(s => `<option value="${s.email}">${s.name}</option>`).join("");

        // Rerrenderizar quando SDR Agent atualizar scores
        if (!this._scoreListenerBound) {
            window.addEventListener("vellia:agentScoreUpdated", () => this.renderLeadsTable());
            this._scoreListenerBound = true;
        }

        tableBody.innerHTML = filteredLeads.map(lead => {
            let stageBadgeClass = "badge-stage-contato";
            if (lead.stage === "Contato") stageBadgeClass = "badge-stage-contato";
            else if (lead.stage === "Lead Gerado") stageBadgeClass = "badge-stage-lead-gerado";
            else if (lead.stage === "Lead Qualificado") stageBadgeClass = "badge-stage-lead-qualificado";
            else if (lead.stage === "Proposta Enviada") stageBadgeClass = "badge-stage-proposta-enviada";
            else if (lead.stage === "Negociação") stageBadgeClass = "badge-stage-negociacao";
            else if (lead.stage === "Cliente Fechado") stageBadgeClass = "badge-stage-cliente-fechado";
            else if (lead.stage === "Cliente Perdido") stageBadgeClass = "badge-stage-cliente-perdido";

            // Badge de Score IA (SDR Agent)
            let aiScore = lead.aiScore != null ? lead.aiScore : null;
            if (aiScore === null && lead.interactions) {
                const sdrInt = lead.interactions.find(i => i.description && i.description.includes("Score IA:"));
                if (sdrInt) {
                    const match = sdrInt.description.match(/Score IA:\s*(\d+)/i);
                    if (match) {
                        aiScore = parseInt(match[1]);
                    }
                }
            }
            let scoreBadge = `<span style="font-size: 11px; color: var(--text-muted);">—</span>`;
            if (aiScore !== null) {
                let icon, color, bg, gradStart, gradEnd;
                if (aiScore >= 75)      { icon = "🔥"; color = "#ef4444"; bg = "rgba(239,68,68,0.1)"; gradStart = "#f43f5e"; gradEnd = "#e11d48"; }
                else if (aiScore >= 45) { icon = "⚡"; color = "#f59e0b"; bg = "rgba(245,158,11,0.1)"; gradStart = "#fbbf24"; gradEnd = "#f59e0b"; }
                else                   { icon = "❄️"; color = "#3b82f6"; bg = "rgba(59,130,246,0.1)"; gradStart = "#60a5fa"; gradEnd = "#3b82f6"; }
                scoreBadge = `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                        <span style="font-size:10px;font-weight:700;background:${bg};color:${color};border:1px solid ${color}30;padding:2px 8px;border-radius:99px;display:inline-flex;align-items:center;gap:3px;">${icon} ${aiScore}/100</span>
                        <div style="width:60px;height:5px;background:var(--border-color);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.06);">
                            <div style="width:${aiScore}%;height:100%;background:linear-gradient(90deg, ${gradStart}, ${gradEnd});border-radius:99px;"></div>
                        </div>
                    </div>
                `;
            }

            // Obter dados do responsável
            let ownerName = "Não atribuído";
            let ownerAvatar = "—";
            let ownerColor = "#94a3b8";
            if (lead.owner && typeof lead.owner === "string") {
                const ownerUser = Store.getUserByEmail(lead.owner);
                if (ownerUser) {
                    ownerName = ownerUser.name || "Não atribuído";
                    ownerAvatar = ownerUser.avatar || "—";
                    ownerColor = "var(--primary)";
                } else {
                    const parts = lead.owner.split("@");
                    ownerName = parts[0] || "Não atribuído";
                    ownerAvatar = typeof ownerName === "string" ? ownerName.substring(0, 2).toUpperCase() : "—";
                }
            }

            // Coluna de Responsável: admin vê dropdown, vendedor vê nome fixo
            const ownerCell = isAdmin
                ? `<select class="filter-control assign-owner-select" data-id="${lead.id}" style="height: 32px; font-size: 12px; min-width: 140px;" onclick="event.stopPropagation();">
                    <option value="">— Não atribuído —</option>
                    ${Store.getUsers().filter(u => u && (u.role === "seller" || u.role === "manager" || u.role === "admin")).map(s => `<option value="${s.email || ''}" ${lead.owner === s.email ? "selected" : ""}>${s.name || s.email || ''}</option>`).join("")}
                   </select>`
                : `<div style="display:flex;align-items:center;gap:8px;">
                     <div class="user-avatar" style="width:24px;height:24px;font-size:10px;flex-shrink:0;background:${ownerColor};">${ownerAvatar}</div>
                     <span style="font-size:13px;font-weight:500;">${ownerName}</span>
                   </div>`;

            // Dados de data de cadastro e destaque para novos cadastros
            const createdAtTs = Store.getLeadTimestamp ? Store.getLeadTimestamp(lead) : 0;
            const isRecent = createdAtTs > 0 && (Date.now() - createdAtTs) < 48 * 60 * 60 * 1000;
            const dateStr = createdAtTs > 0 ? new Date(createdAtTs).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
            const recentBadge = isRecent ? `<span class="badge" style="font-size: 9.5px; font-weight: 700; background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); padding: 1.5px 6px; border-radius: 99px; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;" title="Lead cadastrado recentemente (${dateStr})">✨ Novo</span>` : "";

            return `
                <tr class="clickable-row" data-id="${lead.id}">
                    <td style="min-width: 180px;">
                        <div class="table-company-cell">
                            <div class="table-avatar">${(lead.company || 'L').substring(0, 2).toUpperCase()}</div>
                            <div>
                                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                                    <span style="font-weight: 600; color: var(--text-primary); font-size: 13.5px; line-height: 1.25;">${lead.company}</span>
                                    ${recentBadge}
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                                    ${lead.cnpj ? `<span style="font-size: 11px; font-family: monospace; color: var(--text-muted); font-weight: 500;">${CNPJService.formatCNPJ(lead.cnpj)}</span>` : ''}
                                    <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 500;" title="Data de cadastro">📅 ${dateStr}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${lead.contact}</div>
                        <div style="font-size: 11.5px; color: var(--text-muted);">${lead.role || 'Sem cargo'}</div>
                    </td>
                    <td>
                        <div style="font-size: 12.5px; color: var(--text-primary);">${lead.email || '—'}</div>
                        <div style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-top: 1px;">${lead.whatsapp || lead.phone || '—'}</div>
                    </td>
                    <td>
                        <span style="font-size: 12.5px; font-weight: 500; color: var(--text-primary);">${lead.segment}</span>
                        <div style="font-size: 11px; color: var(--text-muted);">Canal: ${lead.source}</div>
                    </td>
                    <td>
                        <span class="badge ${stageBadgeClass}" style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px;">${lead.stage}</span>
                        <div style="margin-top: 4px;">
                            ${(() => {
                                const m = getLeadMinutesSLA(lead);
                                if (lead.stage === "Cliente Fechado" || lead.stage === "Cliente Perdido") return "";
                                if (m < 15) return `<span style="font-size: 10px; font-weight: 600; background: #ECFDF5; color: #16A36A; border: 1px solid #A7F3D0; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">⏱️ ${m}m SLA</span>`;
                                if (m <= 60) return `<span style="font-size: 10px; font-weight: 600; background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">⏱️ ${m}m Alerta</span>`;
                                const h = Math.floor(m / 60);
                                return `<span style="font-size: 10px; font-weight: 600; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; padding: 1.5px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">🚨 ${h}h+ Atrasado</span>`;
                            })()}
                        </div>
                    </td>
                    <td style="text-align:center;">${scoreBadge}</td>
                    <td onclick="event.stopPropagation();">
                        ${ownerCell}
                    </td>
                    <td style="text-align: right; white-space: nowrap;" onclick="event.stopPropagation();">
                        ${(() => {
                            const callCount = (lead.interactions || []).filter(i => {
                                const t = (i?.type || "").toLowerCase();
                                return t === "ligação" || t === "ligacao" || t.includes("liga") || t.includes("call");
                            }).length;
                            return `
                            <button class="btn btn-outline btn-call-lead" data-id="${lead.id}" style="padding: 0 9px; font-size: 11.5px; font-weight: 700; border-color: rgba(16, 185, 129, 0.45); background: rgba(16, 185, 129, 0.08); color: #059669; margin-right: 5px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 30px; border-radius: 6px; vertical-align: middle;" title="Registrar Ligação em 2 Segundos">
                                <span>📞</span>
                                <span>Ligação${callCount > 0 ? ` (${callCount})` : ''}</span>
                            </button>`;
                        })()}
                        <button class="btn btn-outline btn-wa-lead" data-id="${lead.id}" style="padding: 0; font-size: 12px; border-color: #25d366; color: #25d366; margin-right: 6px; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 6px; vertical-align: middle;" title="Enviar WhatsApp">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </button>
                        <button class="btn btn-outline btn-view-lead" data-id="${lead.id}" style="padding: 5px 11px; font-size: 12px; font-weight: 600; border-radius: 6px; vertical-align: middle;">
                            Detalhes
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Eventos de clique para linha e botões
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

        tableBody.querySelectorAll(".btn-wa-lead").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                window.WhatsApp?.openModalForLead(id);
            });
        });

        tableBody.querySelectorAll(".btn-call-lead").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const lead = Store.getLeadById(id);
                const cur = Auth.getCurrentUser();
                const sellerEmail = (cur?.role === "seller" ? cur.email : (lead?.owner || cur?.email || ""));
                window.Dashboard?.openQuickCallModal(sellerEmail, id);
            });
        });

        // Evento de atribuição manual de dono (admin)
        tableBody.querySelectorAll(".assign-owner-select").forEach(sel => {
            sel.addEventListener("change", () => {
                const leadId = sel.getAttribute("data-id");
                const newOwner = sel.value;
                this.assignLeadOwner(leadId, newOwner);
            });
        });

        // Evento do filtro de dono (admin)
        if (ownerFilter) {
            ownerFilter.removeEventListener("change", ownerFilter._handler);
            ownerFilter._handler = () => this.renderLeadsTable();
            ownerFilter.addEventListener("change", ownerFilter._handler);
        }

        // Botão Distribuição IA
        if (btnAiDistribute) {
            btnAiDistribute.removeEventListener("click", btnAiDistribute._handler);
            btnAiDistribute._handler = () => this.runAiDistribution();
            btnAiDistribute.addEventListener("click", btnAiDistribute._handler);
        }
    },

    assignLeadOwner(leadId, newOwnerEmail) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        const oldOwner = lead.owner || "Não atribuído";

        // Registrar na timeline do lead
        const updatedInteractions = [...(lead.interactions || []), {
            id: "assign_" + Date.now(),
            type: "Observação",
            description: `👤 Lead redirecionado de "${oldOwner}" para "${newOwnerEmail || 'Não atribuído'}" pelo Administrador.`,
            timestamp: new Date().toISOString(),
            userEmail: Auth.getCurrentUser()?.email || "admin@vellia.com"
        }];

        // Usar Store.updateLead para persistir localmente E no Supabase
        Store.updateLead(leadId, {
            owner: newOwnerEmail || null,
            interactions: updatedInteractions
        }, Auth.getCurrentUser()?.email || "admin@vellia.com");

        Store.addLog(
            Auth.getCurrentUser()?.email || "admin@vellia.com",
            "LEAD_ASSIGNED",
            `Lead "${lead.company}" atribuído a "${newOwnerEmail}".`,
            "SUCCESS"
        );

        // Feedback visual no select
        const sel = document.querySelector(`.assign-owner-select[data-id="${leadId}"]`);
        if (sel) {
            sel.style.borderColor = "var(--success)";
            sel.style.color = "var(--success)";
            setTimeout(() => {
                sel.style.borderColor = "";
                sel.style.color = "";
            }, 1500);
        }
    },

    async runAiDistribution() {
        const btn = document.getElementById("btn-ai-distribute");
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = `<span style="animation: spin 1s linear infinite; display:inline-block;">⏳</span> Distribuindo...`;

        try {
            // Pequeno delay para feedback visual premium
            await new Promise(resolve => setTimeout(resolve, 800));

            const leads = Store.getLeads();
            const sellers = Store.getUsers().filter(u => u.role === "seller");

            if (sellers.length === 0) {
                alert("Nenhum vendedor cadastrado para distribuição.");
                return;
            }

            // Leads não atribuídos
            const unassignedLeads = leads.filter(l => !l.owner || l.owner === "sistema@vellia.com" || l.owner === "sdr-ai@vellia.com");

            if (unassignedLeads.length === 0) {
                alert("Todos os leads já estão atribuídos a um responsável!");
                return;
            }

            // Contar leads ativos atuais por vendedor
            const sellerLoads = sellers.map(s => {
                const activeCount = leads.filter(l => l.owner === s.email && l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido").length;
                return {
                    email: s.email,
                    activeCount: activeCount
                };
            });

            let count = 0;
            // Distribuir de forma equilibrada (quem tiver menos leads ativos ganha o lead)
            unassignedLeads.forEach(lead => {
                // Ordenar vendedores por carga ativa de forma ascendente
                sellerLoads.sort((a, b) => a.activeCount - b.activeCount);
                
                // Atribui o lead para o vendedor mais disponível (primeiro da lista)
                const chosenSeller = sellerLoads[0];
                this.assignLeadOwner(lead.id, chosenSeller.email);
                
                // Incrementa a carga simulada do vendedor para o próximo loop
                chosenSeller.activeCount++;
                count++;
            });

            this.renderLeadsTable();
            alert(`✅ Distribuição Inteligente concluída! ${count} lead(s) distribuído(s) de forma equilibrada entre os vendedores.`);

        } catch (err) {
            console.error("Erro na distribuição inteligente:", err);
            alert("❌ Erro ao executar distribuição inteligente. Tente novamente.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> 🤖 Distribuição IA`;
        }
    },


    // ==========================================================================
    // CONSULTA E ENRIQUECIMENTO AUTOMÁTICO DE CNPJ (RECEITA / BRASILAPI)
    // ==========================================================================

    async lookupCNPJ(type = 'new') {
        const inputId = type === 'new' ? 'lead-cnpj' : 'edit-lead-cnpj';
        const statusId = type === 'new' ? 'lead-cnpj-status' : 'edit-lead-cnpj-status';
        const btnIconId = type === 'new' ? 'btn-lookup-cnpj-icon' : 'btn-edit-lookup-cnpj-icon';
        const btnTextId = type === 'new' ? 'btn-lookup-cnpj-text' : 'btn-edit-lookup-cnpj-text';

        const input = document.getElementById(inputId);
        const statusEl = document.getElementById(statusId);
        const btnIcon = document.getElementById(btnIconId);
        const btnText = document.getElementById(btnTextId);

        const rawValue = input?.value || '';
        const digits = CNPJService.cleanDigits(rawValue);

        if (digits.length !== 14) {
            if (statusEl) {
                statusEl.textContent = '❌ CNPJ deve ter 14 dígitos.';
                statusEl.style.color = '#ef4444';
            }
            alert('Por favor, informe um CNPJ completo com 14 dígitos.');
            return;
        }

        // Feedback de carregamento
        if (statusEl) {
            statusEl.textContent = '🔄 Consultando Receita Federal / BrasilAPI...';
            statusEl.style.color = 'var(--primary)';
        }
        if (btnIcon) btnIcon.textContent = '⏳';
        if (btnText) btnText.textContent = 'Consultando...';

        try {
            const data = await CNPJService.fetchCompanyByCNPJ(digits);

            // Preencher os campos conforme o tipo (new ou edit)
            const prefix = type === 'new' ? 'lead-' : 'edit-lead-';

            const setVal = (field, val) => {
                const el = document.getElementById(prefix + field);
                if (el && val) el.value = val;
            };

            setVal('company', data.companyName);
            if (data.contactName) setVal('contact', data.contactName);
            if (data.contactRole) setVal('role', data.contactRole);
            if (data.email) setVal('email', data.email);
            if (data.phone) setVal('phone', data.phone);
            if (data.whatsapp) setVal('whatsapp', data.whatsapp);
            if (data.phone2) setVal('phone2', data.phone2);
            if (data.city) setVal('city', data.city);
            if (data.state) setVal('state', data.state);
            if (data.segment) setVal('segment', data.segment);

            // Observações enriquecidas com dados cadastrais
            const notesEl = document.getElementById(prefix + 'notes');
            if (notesEl) {
                const currentNotes = notesEl.value.trim();
                const enrichmentNotes = `[Dados Cadastrais Receita Federal]\nRazão Social: ${data.razaoSocial}\nSituação: ${data.situacaoCadastral} (${data.dataSituacao || 'Ativa'})\nEndereço: ${data.address}\nCNAE: ${data.cnaeDescription || data.cnaeCode || 'N/A'}${data.capitalSocial ? `\nCapital Social: ${data.capitalSocial}` : ''}${data.porte ? `\nPorte: ${data.porte}` : ''}`;
                
                if (!currentNotes) {
                    notesEl.value = enrichmentNotes;
                } else if (!currentNotes.includes("Dados Cadastrais Receita Federal")) {
                    notesEl.value = `${currentNotes}\n\n${enrichmentNotes}`;
                }
            }

            input.value = data.cnpjFormatted;

            if (statusEl) {
                statusEl.textContent = `✅ ${data.razaoSocial} (${data.situacaoCadastral})`;
                statusEl.style.color = '#10b981';
            }

            // Toast de sucesso
            const toast = document.createElement("div");
            toast.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 99999;
                background: var(--bg-card, #1e293b);
                border: 1px solid rgba(16, 185, 129, 0.4);
                border-left: 4px solid #10b981;
                border-radius: 12px;
                padding: 14px 20px;
                display: flex; align-items: center; gap: 12px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.3);
                font-family: 'Inter', sans-serif;
                animation: vellia-slide-in 0.3s ease;
                min-width: 300px;
            `;
            toast.innerHTML = `
                <span style="font-size: 22px;">⚡</span>
                <div>
                    <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Lead Enriquecido com Sucesso!</div>
                    <div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">${data.companyName} (${data.situacaoCadastral})</div>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);

        } catch (err) {
            console.error("Erro ao consultar CNPJ:", err);
            if (statusEl) {
                statusEl.textContent = `❌ ${err.message}`;
                statusEl.style.color = '#ef4444';
            }
            alert(`Não foi possível obter os dados do CNPJ:\n${err.message}`);
        } finally {
            if (btnIcon) btnIcon.textContent = '🔍';
            if (btnText) btnText.textContent = type === 'new' ? 'Buscar Dados' : 'Sincronizar';
        }
    },

    // ==========================================================================
    // EDIÇÃO DE LEADS
    // ==========================================================================

    openEditLeadModal() {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        document.getElementById("edit-lead-id").value    = lead.id;
        const cnpjInput = document.getElementById("edit-lead-cnpj");
        if (cnpjInput) cnpjInput.value = lead.cnpj ? CNPJService.formatCNPJ(lead.cnpj) : "";
        const cnpjStatus = document.getElementById("edit-lead-cnpj-status");
        if (cnpjStatus) {
            cnpjStatus.textContent = lead.cnpj ? "CNPJ cadastrado" : "Sincronize com a Receita Federal";
            cnpjStatus.style.color = "var(--text-muted)";
        }

        document.getElementById("edit-lead-company").value = lead.company || "";
        document.getElementById("edit-lead-contact").value = lead.contact || "";
        document.getElementById("edit-lead-role").value    = lead.role || "";
        document.getElementById("edit-lead-email").value   = lead.email || "";
        document.getElementById("edit-lead-whatsapp").value = lead.whatsapp || "";
        document.getElementById("edit-lead-phone").value   = lead.phone || "";
        document.getElementById("edit-lead-phone2").value  = lead.phone2 || "";
        document.getElementById("edit-lead-email2").value  = lead.email2 || "";
        document.getElementById("edit-lead-notes").value   = lead.notes || "";
        document.getElementById("edit-lead-city").value    = lead.city || "";
        document.getElementById("edit-lead-state").value   = lead.state || "";
        document.getElementById("edit-lead-segment").value = lead.segment || "Outros";
        document.getElementById("edit-lead-source").value  = lead.source || "Outbound";

        document.getElementById("edit-lead-modal").classList.add("open");
        document.getElementById("modal-overlay").style.display = "block";
    },

    closeEditLeadModal() {
        document.getElementById("edit-lead-modal").classList.remove("open");
        // Only close modal-overlay, preserve drawer-overlay if drawer is open
        if (!document.getElementById("new-lead-modal").classList.contains("open") && 
            !document.getElementById("stage-reason-modal").classList.contains("open")) {
            document.getElementById("modal-overlay").style.display = "none";
        }
    },

    saveEditLead() {
        const id = document.getElementById("edit-lead-id").value;
        if (!id) return;

        const updatedData = {
            cnpj     : CNPJService.cleanDigits(document.getElementById("edit-lead-cnpj")?.value || ""),
            company  : document.getElementById("edit-lead-company").value.trim(),
            contact  : document.getElementById("edit-lead-contact").value.trim(),
            role     : document.getElementById("edit-lead-role").value.trim(),
            email    : document.getElementById("edit-lead-email").value.trim(),
            whatsapp : document.getElementById("edit-lead-whatsapp").value.trim(),
            phone    : document.getElementById("edit-lead-phone").value.trim(),
            phone2   : document.getElementById("edit-lead-phone2").value.trim(),
            email2   : document.getElementById("edit-lead-email2").value.trim(),
            notes    : document.getElementById("edit-lead-notes").value.trim(),
            city     : document.getElementById("edit-lead-city").value.trim(),
            state    : document.getElementById("edit-lead-state").value.trim().toUpperCase(),
            segment  : document.getElementById("edit-lead-segment").value,
            source   : document.getElementById("edit-lead-source").value
        };

        if (!updatedData.company || !updatedData.contact) {
            alert("Empresa e nome do contato são obrigatórios.");
            return;
        }

        const user = Auth.getCurrentUser();
        Store.updateLead(id, updatedData, user ? user.email : "sistema@vellia.com");
        
        this.closeEditLeadModal();
        this.openLeadDrawer(id);
        this.renderLeadsTable();

        // Toast de sucesso
        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            background: var(--bg-card, #1e293b);
            border: 1px solid rgba(16,185,129,0.4);
            border-left: 4px solid #10b981;
            border-radius: 12px;
            padding: 14px 20px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            animation: vellia-slide-in 0.3s ease;
            min-width: 280px;
        `;
        toast.innerHTML = `
            <span style="font-size: 20px;">✅</span>
            <div>
                <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Contato atualizado!</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">${updatedData.company} — ${updatedData.contact}</div>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    },

    async deleteLead() {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        const confirmDelete = confirm(`Mover o lead da empresa "${lead.company}" para a lixeira?\n\nEle ficará disponível por 30 dias e poderá ser restaurado. Administradores e gerentes podem excluí-lo definitivamente.`);
        if (!confirmDelete) return;

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        // Registrar na auditoria ANTES de mover
        Store.addLog(userEmail, "LEAD_TRASHED", `Lead "${lead.company}" (Contato: ${lead.contact}) movido para a lixeira por ${currentUser?.name || userEmail}.`, "SUCCESS");

        // Mover para lixeira (não exclui permanentemente)
        Store.moveToTrash(activeLeadId, userEmail);

        // Toast de aviso
        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            background: var(--bg-card, #1e293b);
            border: 1px solid rgba(239,68,68,0.4);
            border-left: 4px solid #ef4444;
            border-radius: 12px;
            padding: 14px 20px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            animation: vellia-slide-in 0.3s ease;
            min-width: 280px;
        `;
        toast.innerHTML = `
            <span style="font-size: 20px;">🗑️</span>
            <div>
                <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Lead movido para a lixeira</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">${lead.company} — disponível por 30 dias.</div>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);

        // Fechar gaveta
        this.closeLeadDrawer();

        // Disparar evento global para atualizar a UI do app (CRM, Kanban, Dashboard, etc.)
        window.dispatchEvent(new CustomEvent("vellia:leadDeleted", { detail: { leadId: activeLeadId } }));
    },
    // ==========================================================================
    // CONTROLE DE DRAWERS (DETALHES DO LEAD)
    // ==========================================================================
    
    openScannerFromDrawer() {
        if (window.VisionOCR) {
            window.VisionOCR.openModal(activeLeadId);
        }
    },

    openLeadDrawer(id) {
        if (!this._eventsBound && !window.__velliaCrmEventsBound) {
            this.bindEvents();
            this._eventsBound = true;
            window.__velliaCrmEventsBound = true;
        }
        const lead = Store.getLeadById(id);
        if (!lead) return;

        const currentUser = Auth.getCurrentUser();
        const role = (currentUser?.role || "").toLowerCase().trim();
        const isAdmin = role === "admin" || role === "manager" || role === "gerente";

        if (!isAdmin && currentUser) {
            const userEmail = (currentUser.email || "").toLowerCase().trim();
            const owner = (lead.owner || "").toLowerCase().trim();
            const createdBy = (lead.createdBy || "").toLowerCase().trim();
            if (owner !== userEmail && createdBy !== userEmail) {
                alert("Acesso Negado: Você só pode visualizar leads cadastrados por você.");
                return;
            }
        }

        activeLeadId = id;

        // Atualizar avatar e cabeçalho visual
        const avatarEl = document.getElementById("drawer-lead-avatar");
        if (avatarEl) {
            avatarEl.textContent = (lead.company || "L").charAt(0).toUpperCase();
            const colors = [
                "linear-gradient(135deg, #6366f1, #3b82f6)",
                "linear-gradient(135deg, #ec4899, #8b5cf6)",
                "linear-gradient(135deg, #10b981, #059669)",
                "linear-gradient(135deg, #f59e0b, #d97706)"
            ];
            const charCode = (lead.company || "A").charCodeAt(0);
            avatarEl.style.background = colors[charCode % colors.length];
        }

        const subtitleEl = document.getElementById("drawer-lead-subtitle");
        if (subtitleEl) {
            subtitleEl.textContent = `${lead.contact || "Sem contato"} • ${lead.role || lead.segment || "Lead"}`;
        }

        const tempBadge = document.getElementById("drawer-lead-temp-badge");
        if (tempBadge) {
            const score = typeof lead.score === "number" ? lead.score : (lead.aiScore || 70);
            if (score >= 75 || lead.stage === "Negociação" || lead.stage === "Proposta Enviada") {
                tempBadge.textContent = "🔥 Quente (" + score + ")";
                tempBadge.style.background = "rgba(239, 68, 68, 0.12)";
                tempBadge.style.color = "#ef4444";
                tempBadge.style.borderColor = "rgba(239, 68, 68, 0.25)";
            } else if (score >= 45 || lead.stage === "Lead Qualificado") {
                tempBadge.textContent = "⚡ Morno (" + score + ")";
                tempBadge.style.background = "rgba(245, 158, 11, 0.12)";
                tempBadge.style.color = "#f59e0b";
                tempBadge.style.borderColor = "rgba(245, 158, 11, 0.25)";
            } else {
                tempBadge.textContent = "❄️ Frio (" + score + ")";
                tempBadge.style.background = "rgba(100, 116, 139, 0.12)";
                tempBadge.style.color = "#64748b";
                tempBadge.style.borderColor = "rgba(100, 116, 139, 0.25)";
            }
        }

        // Atualizar campos do Drawer
        document.getElementById("drawer-lead-company").textContent = lead.company;
        document.getElementById("drawer-lead-contact").textContent = lead.contact;
        document.getElementById("drawer-lead-role").textContent = lead.role || "Não preenchido";
        document.getElementById("drawer-lead-email").textContent = lead.email || "Não informado";
        document.getElementById("drawer-lead-email2").textContent = lead.email2 || "Não informado";
        document.getElementById("drawer-lead-whatsapp").textContent = lead.whatsapp || "Não informado";
        document.getElementById("drawer-lead-phone2").textContent = lead.phone2 || "Não informado";
        document.getElementById("drawer-lead-notes").textContent = lead.notes || "Sem observações.";
        document.getElementById("drawer-lead-location").textContent = `${lead.city || "-"} / ${lead.state || "-"}`;
        document.getElementById("drawer-lead-source").textContent = `${lead.segment} (${lead.source})`;

        const cnpjEl = document.getElementById("drawer-lead-cnpj");
        if (cnpjEl) {
            cnpjEl.innerHTML = lead.cnpj 
                ? `<span style="font-family: monospace; font-weight: 600; color: var(--primary);">${CNPJService.formatCNPJ(lead.cnpj)}</span>` 
                : "Não informado";
        }

        // Configurar select de estágios e Stepper Visual
        const stageSelect = document.getElementById("drawer-change-stage");
        if (stageSelect) {
            stageSelect.value = lead.stage;
        }
        this.updatePipelineStepper(lead.stage);
        this.switchDrawerTab("followup");

        // Parsear dados estruturados da Receita Federal se existirem em notes
        const rfContainer = document.getElementById("drawer-rf-structured-data");
        const rfBadge = document.getElementById("drawer-rf-status-badge");
        const notesEl = document.getElementById("drawer-lead-notes");

        if (lead.notes && lead.notes.includes("[Dados Cadastrais Receita Federal]")) {
            const lines = lead.notes.split("\n");
            let razaoSocial = "";
            let situacao = "ATIVA";
            let endereco = "";
            let cnae = "";
            let porte = "";
            let manualNotes = [];

            let inRfBlock = false;
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.includes("[Dados Cadastrais Receita Federal]")) {
                    inRfBlock = true;
                    return;
                }
                if (inRfBlock) {
                    if (trimmed.startsWith("Razão Social:")) razaoSocial = trimmed.replace("Razão Social:", "").trim();
                    else if (trimmed.startsWith("Situação:")) situacao = trimmed.replace("Situação:", "").trim();
                    else if (trimmed.startsWith("Endereço:")) endereco = trimmed.replace("Endereço:", "").trim();
                    else if (trimmed.startsWith("CNAE:")) cnae = trimmed.replace("CNAE:", "").trim();
                    else if (trimmed.startsWith("Porte:")) porte = trimmed.replace("Porte:", "").trim();
                    else if (trimmed.length > 0 && !trimmed.includes(":")) {
                        inRfBlock = false;
                        manualNotes.push(line);
                    }
                } else if (trimmed.length > 0) {
                    manualNotes.push(line);
                }
            });

            if (rfBadge) {
                const isAtiva = situacao.toUpperCase().includes("ATIVA");
                rfBadge.textContent = situacao || "ATIVA";
                rfBadge.style.background = isAtiva ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)";
                rfBadge.style.color = isAtiva ? "#10b981" : "#ef4444";
            }

            if (rfContainer) {
                rfContainer.innerHTML = `
                    ${razaoSocial ? `
                    <div style="background: var(--bg-app); padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block;">Razão Social</span>
                        <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${razaoSocial}</span>
                    </div>` : ''}
                    ${cnae ? `
                    <div style="background: var(--bg-app); padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block;">CNAE / Atividade</span>
                        <span style="font-size: 12.5px; font-weight: 600; color: var(--text-secondary);">${cnae}</span>
                    </div>` : ''}
                    ${endereco ? `
                    <div style="background: var(--bg-app); padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block;">Endereço Cadastrado</span>
                        <span style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${endereco}</span>
                    </div>` : ''}
                `;
            }

            if (notesEl) {
                const cleanedNotes = manualNotes.join("\n").trim();
                notesEl.textContent = cleanedNotes || "Nenhuma observação manual.";
            }
        } else {
            if (rfContainer) {
                rfContainer.innerHTML = `
                    <div style="font-size: 12px; color: var(--text-muted); padding: 8px; text-align: center;">
                        Consulte o CNPJ na edição do lead para carregar dados oficiais da Receita Federal.
                    </div>
                `;
            }
            if (notesEl) {
                notesEl.textContent = lead.notes || "Sem observações.";
            }
        }

        // Visibilidade de telefone 2 e email 2
        const rowPhone2 = document.getElementById("row-phone2-container");
        if (rowPhone2) rowPhone2.style.display = lead.phone2 ? "flex" : "none";

        const rowEmail2 = document.getElementById("row-email2-container");
        if (rowEmail2) rowEmail2.style.display = lead.email2 ? "flex" : "none";

        const mailLink = document.getElementById("btn-mail-link");
        if (mailLink && lead.email) {
            mailLink.href = `mailto:${lead.email}`;
        }

        // Renderizar Linha do Tempo
        this.renderTimeline(lead);

        // Renderizar Follow-ups
        this.renderFollowups(lead);

        // Renderizar Comentários
        this.renderComments(lead);

        // Exibir e Renderizar Chat Integrado se aplicável
        const hasWa = lead.whatsapp || lead.phone || lead.source === "Meta Ads" || lead.source === "WhatsApp";
        const chatSection = document.getElementById("drawer-whatsapp-chat-section");
        if (chatSection) {
            chatSection.style.display = hasWa ? "block" : "none";
            if (hasWa) {
                this.renderWhatsAppChat(lead);
                this.updateChatUIState(lead);
            }
        }

        // Renderizar Widget de AI Lead Score
        LeadAIScore.render(lead);

        // Renderizar Matriz BANT / SPIN Selling e Hub de Objeções IA
        QualificationAI.renderDrawerQualification(lead);
        QualificationAI.renderObjectionHub(lead);

        // Renderizar Widget de Cadência SDR
        SDR.renderCadenceWidget(lead.id);

        // Resetar form follow-up
        const ffContainer = document.getElementById("followup-form-container");
        const ffToggle = document.getElementById("btn-toggle-followup-form");
        if (ffContainer) ffContainer.style.display = "none";
        if (ffToggle) ffToggle.textContent = "+ Novo";

        // Inicializar e Renderizar Inspeções do Cliente (oculto para vendedores)
        const drawerInspectionsSec = document.getElementById("drawer-inspections-section");
        const isSellerRole = role === "seller" || role === "vendedor";
        if (drawerInspectionsSec) {
            drawerInspectionsSec.style.display = isSellerRole ? "none" : "flex";
        }
        const serviceSelect = document.getElementById("inspection-service-select");
        if (serviceSelect && !isSellerRole) {
            const services = Store.getServices();
            serviceSelect.innerHTML = services.map(s => `<option value="${s.name}">${s.name}</option>`).join("") || `<option value="Vistoria Geral">Vistoria Geral</option>`;
        }
        const btnToggleInspection = document.getElementById("btn-toggle-inspection-form");
        const inspectionFormContainer = document.getElementById("inspection-form-container");
        if (btnToggleInspection) btnToggleInspection.textContent = "+ Registrar Nova";
        if (inspectionFormContainer) inspectionFormContainer.style.display = "none";
        
        if (!isSellerRole) {
            this.renderDrawerInspections(lead);
        }

        // Avaliar sugestões de Cross-Selling
        CrossSelling.evaluateLead(id);

        // Exibir Drawer e Overlay
        const drawerEl = document.getElementById("lead-drawer");
        if (drawerEl) drawerEl.classList.add("open");
        const overlayEl = document.getElementById("drawer-overlay");
        if (overlayEl) {
            overlayEl.style.display = "block";
            overlayEl.classList.add("open");
        }
    },

    closeLeadDrawer() {
        activeLeadId = null;
        const drawerEl = document.getElementById("lead-drawer");
        if (drawerEl) drawerEl.classList.remove("open");
        const overlayEl = document.getElementById("drawer-overlay");
        if (overlayEl) {
            overlayEl.style.display = "none";
            overlayEl.classList.remove("open");
        }
        this.renderLeadsTable();
    },

    // ==========================================================================
    // FOLLOW-UP LEMBRETES
    // ==========================================================================

    saveFollowup() {
        if (!activeLeadId) return;
        const dtInput = document.getElementById("followup-datetime");
        const noteInput = document.getElementById("followup-note");
        if (!dtInput || !dtInput.value) {
            alert("Por favor, selecione a data e hora do follow-up.");
            return;
        }
        const currentUser = Auth.getCurrentUser();
        const lead = Store.getLeadById(activeLeadId);
        if (!lead || !currentUser) return;

        const followups = lead.followups || [];
        const newFollowup = {
            id: `fu_${Date.now()}`,
            scheduledAt: new Date(dtInput.value).toISOString(),
            note: noteInput?.value.trim() || "Follow-up agendado",
            userEmail: currentUser.email,
            done: false,
            notified: false
        };
        followups.push(newFollowup);
        Store.updateLead(activeLeadId, { followups }, currentUser.email);

        // Reset form
        dtInput.value = "";
        if (noteInput) noteInput.value = "";
        document.getElementById("followup-form-container").style.display = "none";
        document.getElementById("btn-toggle-followup-form").textContent = "+ Novo";

        const updatedLead = Store.getLeadById(activeLeadId);
        this.renderFollowups(updatedLead);
    },

    deleteFollowup(followupId) {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;
        const currentUser = Auth.getCurrentUser();
        const followups = (lead.followups || []).filter(f => f.id !== followupId);
        Store.updateLead(activeLeadId, { followups }, currentUser?.email);
        const updatedLead = Store.getLeadById(activeLeadId);
        this.renderFollowups(updatedLead);
    },

    renderFollowups(lead) {
        const container = document.getElementById("followup-list-container");
        if (!container) return;
        const followups = (lead.followups || []).filter(f => !f.done);
        if (followups.length === 0) {
            container.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 6px 0; font-style: italic;">Nenhum follow-up agendado.</div>`;
            return;
        }
        followups.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
        const now = Date.now();
        container.innerHTML = followups.map(f => {
            const dt = new Date(f.scheduledAt);
            const isPast = dt.getTime() < now;
            const isSoon = !isPast && (dt.getTime() - now) < 3600000;
            const fmtDt = dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
            const colorBar = isPast ? "#ef4444" : isSoon ? "#f59e0b" : "#3b82f6";
            const statusLabel = isPast ? "⚠️ Atrasado" : isSoon ? "⏰ Em breve" : "📅 Agendado";

            // Google Calendar URL builder
            const gcalStart = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            const gcalEnd = new Date(dt.getTime() + 30 * 60000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
            const gcalTitle = encodeURIComponent(`Follow-up: ${lead.company} — ${f.note}`);
            const gcalDetails = encodeURIComponent(`Lead: ${lead.company}\nContato: ${lead.contact || ""}\nObservação: ${f.note}`);
            const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}`;

            return `
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--bg-surface); border-left: 3px solid ${colorBar}; margin-bottom: 6px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">${f.note}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${fmtDt} &nbsp;•&nbsp; <span style="color:${colorBar}; font-weight:600;">${statusLabel}</span></div>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${f.userEmail}</div>
                    </div>
                    <div style="display: flex; gap: 4px; flex-shrink: 0; align-items: center;">
                        <a href="${gcalUrl}" target="_blank" rel="noopener" title="Exportar para Google Calendar"
                           style="display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: 1px solid rgba(59,130,246,0.3); background: rgba(59,130,246,0.07); color: #2563eb; text-decoration: none; transition: all 0.2s;"
                           onmouseover="this.style.background='rgba(59,130,246,0.15)'" onmouseout="this.style.background='rgba(59,130,246,0.07)'">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </a>
                        <button onclick="window.CRMDeleteFollowup('${f.id}')" title="Remover lembrete" style="display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; background: none; border: none; cursor: pointer; color: var(--text-muted); transition: all 0.2s;"
                            onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-muted)'">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>`;
        }).join("");

        window.CRMDeleteFollowup = (id) => this.deleteFollowup(id);
    },

    // ==========================================================================
    // COMENTÁRIOS INTERNOS
    // ==========================================================================

    sendComment() {
        if (!activeLeadId) return;
        const input = document.getElementById("comment-text-input");
        const text = input?.value.trim();
        if (!text) return;
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        const comment = Store.addLeadComment(activeLeadId, currentUser.email, text);
        if (!comment) return;
        input.value = "";

        const lead = Store.getLeadById(activeLeadId);
        this.renderComments(lead);

        // Notificar outros usuários envolvidos no lead
        const leadData = Store.getLeadById(activeLeadId);
        if (leadData && leadData.owner && leadData.owner !== currentUser.email) {
            // Se o comentário é do admin/gerente, notificar o vendedor dono do lead
            window.dispatchEvent(new CustomEvent("vellia:newComment", {
                detail: { leadId: activeLeadId, company: leadData.company, commenter: currentUser.name || currentUser.email, commentId: comment.id }
            }));
        }
    },

    renderComments(lead) {
        const container = document.getElementById("drawer-comments-list");
        const badge = document.getElementById("comments-unread-badge");
        if (!container) return;

        const comments = lead.comments || [];
        const currentUser = Auth.getCurrentUser();
        const currentEmail = currentUser?.email || "";

        // Count unread
        const unreadCount = comments.filter(c => !c.readBy || !c.readBy.includes(currentEmail)).length;
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? "inline-block" : "none";
        }

        // Mark all as read for current user
        let needsUpdate = false;
        comments.forEach(c => {
            if (!c.readBy) c.readBy = [];
            if (!c.readBy.includes(currentEmail)) {
                c.readBy.push(currentEmail);
                needsUpdate = true;
            }
        });
        if (needsUpdate && activeLeadId) {
            Store.updateLead(activeLeadId, { comments }, currentEmail);
        }

        if (comments.length === 0) {
            container.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 8px 0; font-style: italic; text-align: center;">Nenhum comentário ainda. Seja o primeiro! 💬</div>`;
            return;
        }

        // Role colors
        const roleColor = { admin: "#7c3aed", manager: "#1d4ed8", seller: "#059669" };
        const roleBg   = { admin: "rgba(124,58,237,0.08)", manager: "rgba(29,78,216,0.08)", seller: "rgba(5,150,105,0.08)" };
        const users = Store.getUsers();

        const sorted = [...comments].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        container.innerHTML = sorted.map(c => {
            const isMine = c.userEmail === currentEmail;
            const u = users.find(u => u.email === c.userEmail);
            const roleKey = u?.role || "seller";
            const color = roleColor[roleKey] || "#6b7280";
            const bg = roleBg[roleKey] || "rgba(107,114,128,0.08)";
            const avatarText = (u?.avatar || c.userEmail.substring(0, 2)).toUpperCase();
            const displayName = u?.name || c.userEmail;
            const roleName = { admin: "Admin", manager: "Gerente", seller: "Vendedor" }[roleKey] || roleKey;
            const fmtDt = new Date(c.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

            return `
                <div style="display: flex; gap: 8px; ${isMine ? "flex-direction: row-reverse;" : ""}">
                    <div style="
                        width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
                        background: ${color}; display: flex; align-items: center; justify-content: center;
                        font-size: 10px; font-weight: 800; color: #fff; margin-top: 4px;
                    ">${avatarText}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; gap: 6px; align-items: baseline; margin-bottom: 4px; ${isMine ? "justify-content: flex-end;" : ""}">
                            <span style="font-size: 11px; font-weight: 700; color: ${color};">${displayName}</span>
                            <span style="font-size: 10px; background: ${bg}; color: ${color}; padding: 1px 6px; border-radius: 10px; font-weight: 600;">${roleName}</span>
                            <span style="font-size: 10px; color: var(--text-muted);">${fmtDt}</span>
                        </div>
                        <div style="
                            background: ${isMine ? bg : "var(--bg-surface)"};
                            border: 1px solid ${isMine ? color + "33" : "var(--border-color)"};
                            border-radius: ${isMine ? "12px 4px 12px 12px" : "4px 12px 12px 12px"};
                            padding: 8px 12px; font-size: 12.5px; color: var(--text-primary);
                            line-height: 1.5; word-break: break-word;
                        ">${c.text.replace(/\n/g, "<br>")}</div>
                    </div>
                </div>`;
        }).join("");

        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
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

        const iconMap = {
            "Ligação": "📞",
            "WhatsApp": "💬",
            "E-mail": "✉️",
            "Reunião": "👥",
            "Visita": "🚗",
            "Observação": "📝",
            "stage-change": "🔄"
        };

        timelineContainer.innerHTML = timelineItems.map(item => {
            const formattedDate = item.timestamp.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });

            const icon = item.type === "stage-change" ? iconMap["stage-change"] : (iconMap[item.intType] || "📌");
            const markerClass = item.type === "stage-change" 
                ? "stage-change" 
                : `interaction-${(item.intType || "Outros").replace(" ", "-")}`;

            return `
                <div class="timeline-item ${markerClass}">
                    <div class="timeline-marker" title="${item.title}">${icon}</div>
                    <div class="timeline-card">
                        <div class="timeline-header">
                            <span class="timeline-author">${item.user || "Sistema"}</span>
                            <span>${formattedDate}</span>
                        </div>
                        <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-primary); font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <span>${item.title}</span>
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
        
        // Feedback visual no botão
        const btnSubmit = document.getElementById("btn-submit-interaction");
        if (btnSubmit) {
            const origHTML = btnSubmit.innerHTML;
            btnSubmit.innerHTML = `<span>✓ Registrado!</span>`;
            btnSubmit.style.background = "#10b981";
            setTimeout(() => {
                btnSubmit.innerHTML = origHTML;
                btnSubmit.style.background = "";
            }, 1600);
        }

        const updatedLead = Store.getLeadById(activeLeadId);
        this.renderTimeline(updatedLead);
    },

    triggerStageChange(leadId, newStage) {
        activeLeadId = leadId;
        this.handleStageChangeRequest(newStage);
    },

    executeDirectStageChange(leadId, newStage, reason = "") {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        let currentUser = null;
        try {
            currentUser = (typeof Auth !== "undefined" && Auth.getCurrentUser) ? Auth.getCurrentUser() : null;
        } catch(e) {}
        if (!currentUser) {
            try {
                currentUser = JSON.parse(sessionStorage.getItem("comercial_session") || localStorage.getItem("comercial_session") || "null");
            } catch(e) {}
        }
        if (!currentUser) {
            currentUser = { email: lead.owner || "vendedor@vellia.com", name: "Vendedor", role: "seller" };
        }

        const oldStage = lead.stage;
        const finalReason = reason || (oldStage === "Lead Gerado" && newStage === "Contato"
            ? "Lead retornado para a etapa Contato no Kanban."
            : `Transição de etapa para ${newStage}.`);

        // Efetivar mudança no banco
        Store.updateLeadStage(leadId, newStage, currentUser.email, finalReason);

        // Registrar no log de auditoria operacional
        try {
            Audit.logStageChange(currentUser.email, lead.company, oldStage, newStage, finalReason);
        } catch(e) {}

        // Se for Cliente Fechado, registrar vitória comercial
        if (newStage === "Cliente Fechado") {
            try {
                Audit.logSaleWon(currentUser.email, lead.company, "Sob Consulta (Ver Propostas)");
            } catch(e) {}
        }

        // Atualizar dropdown do drawer se for o lead ativo
        const updatedLead = Store.getLeadById(leadId);
        const stageSelect = document.getElementById("drawer-change-stage");
        if (stageSelect && activeLeadId === leadId) {
            stageSelect.value = updatedLead.stage;
        }

        if (activeLeadId === leadId) {
            this.renderTimeline(updatedLead);
            this.updatePipelineStepper(updatedLead.stage);
        }
        this.renderLeadsTable();

        // Notificar ouvintes (Kanban, dashboard, etc.)
        window.dispatchEvent(new CustomEvent("vellia:stageChanged", { detail: { leadId, oldStage, newStage } }));

        // Sugestão de Follow-up via WhatsApp
        if (newStage !== "Cliente Perdido") {
            this.showWhatsAppFollowupSuggestion(leadId, newStage);
        }

        // Toast de confirmação visual
        if (window.Toast && typeof window.Toast.show === "function") {
            window.Toast.show({
                type: "success",
                title: "Funil Atualizado",
                message: `${lead.company || 'Lead'} agora está em "${newStage}".`,
                duration: 2500
            });
        }
    },

    handleStageChangeRequest(newStage) {
        if (!activeLeadId) return;

        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        // Se o estágio for igual ao atual, ignore
        if (lead.stage === newStage) return;

        // Armazenar temporariamente para confirmação
        pendingStageChange = newStage;

        // Qualificação estruturada (estimativa de valor/probabilidade/serviço)
        if (newStage === "Lead Qualificado") {
            const form = document.getElementById("qualify-lead-form");
            if (form) form.reset();
            
            // Pré-preenchimento inteligente para não travar o usuário
            const srvEl = document.getElementById("qualify-service");
            if (srvEl) {
                const seg = lead.segment || "";
                let matched = false;
                for (let i = 0; i < srvEl.options.length; i++) {
                    if (srvEl.options[i].value && (srvEl.options[i].value.includes(seg) || seg.includes(srvEl.options[i].value))) {
                        srvEl.selectedIndex = i;
                        matched = true;
                        break;
                    }
                }
                if (!matched) srvEl.value = "Consultorias Técnicas";
            }
            const valEl = document.getElementById("qualify-value");
            if (valEl) valEl.value = (lead.qualification && lead.qualification.estimatedValue) || 10000;
            const deadEl = document.getElementById("qualify-deadline");
            if (deadEl) {
                const d = new Date(Date.now() + 30 * 86400000);
                deadEl.value = d.toISOString().split("T")[0];
            }
            const probEl = document.getElementById("qualify-prob");
            if (probEl) {
                probEl.value = 50;
                probEl.style.setProperty("--pct", "50%");
                const b = document.getElementById("qualify-prob-badge");
                if (b) b.textContent = "50%";
            }

            document.getElementById("qualify-lead-modal").classList.add("open");
            document.getElementById("modal-overlay").style.display = "block";
            return;
        }

        // Cliente Perdido exige justificativa de perda/churn
        if (newStage === "Cliente Perdido") {
            document.getElementById("stage-reason-target-name").textContent = newStage;
            document.getElementById("stage-reason-text").value = "";
            document.getElementById("stage-reason-modal").classList.add("open");
            document.getElementById("modal-overlay").style.display = "block";
            return;
        }

        // Demais etapas operacionais (Contato, Lead Gerado, Proposta Enviada, Negociação, Cliente Fechado)
        // executam transição direta sem travar o usuário
        this.executeDirectStageChange(activeLeadId, newStage);
        pendingStageChange = null;
    },

    confirmQualifyLead() {
        if (!activeLeadId || pendingStageChange !== "Lead Qualificado") return;

        const service = document.getElementById("qualify-service")?.value || "Consultorias Técnicas";
        const value = parseFloat(document.getElementById("qualify-value")?.value) || 0;
        const prob = parseInt(document.getElementById("qualify-prob")?.value) || 50;
        const deadline = document.getElementById("qualify-deadline")?.value || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
        const notes = document.getElementById("qualify-notes")?.value.trim() || "";

        const lead = Store.getLeadById(activeLeadId);
        const currentUser = Auth.getCurrentUser();
        if (!lead || !currentUser) return;

        const oldStage = lead.stage;

        // Salva os dados de qualificação no lead
        Store.updateLead(activeLeadId, {
            qualification: {
                service,
                estimatedValue: value,
                probability: prob,
                deadline,
                notes
            }
        }, currentUser.email);

        const reason = `Lead qualificado para serviço: ${service}. Valor Est: R$ ${value}. Probabilidade: ${prob}%. Prazo: ${deadline}. ${notes}`;

        Store.updateLeadStage(activeLeadId, pendingStageChange, currentUser.email, reason);
        Audit.logStageChange(currentUser.email, lead.company, oldStage, pendingStageChange, reason);

        const targetStage = pendingStageChange;
        const currentLeadId = activeLeadId;

        this.closeQualifyLeadModal();

        const updatedLead = Store.getLeadById(currentLeadId);
        const stageSelect = document.getElementById("drawer-change-stage");
        if (stageSelect) stageSelect.value = updatedLead.stage;

        this.renderTimeline(updatedLead);
        this.updatePipelineStepper(updatedLead.stage);
        this.renderLeadsTable();
        pendingStageChange = null;
        window.dispatchEvent(new CustomEvent("vellia:stageChanged"));

        // Sugestão Inteligente de Follow-up via WhatsApp
        this.showWhatsAppFollowupSuggestion(currentLeadId, targetStage);
    },

    cancelQualifyLeadRequest() {
        if (activeLeadId) {
            const lead = Store.getLeadById(activeLeadId);
            const stageSelect = document.getElementById("drawer-change-stage");
            if (lead && stageSelect) stageSelect.value = lead.stage;
        }
        this.closeQualifyLeadModal();
        window.dispatchEvent(new CustomEvent("vellia:stageCancelled"));
    },

    closeQualifyLeadModal() {
        document.getElementById("qualify-lead-modal").classList.remove("open");
        document.getElementById("modal-overlay").style.display = "none";
        pendingStageChange = null;
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
        const targetStage = pendingStageChange;
        const currentLeadId = activeLeadId;

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

        // Sugestão Inteligente de Follow-up via WhatsApp
        if (targetStage !== "Cliente Perdido") {
            this.showWhatsAppFollowupSuggestion(currentLeadId, targetStage);
        }
    },

    showWhatsAppFollowupSuggestion(leadId, targetStage) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        const templateMap = {
            "Lead Qualificado": "welcome",
            "Proposta Enviada": "proposal",
            "Negociação": "closing_urgency",
            "Cliente Fechado": "post_sales"
        };

        const templateType = templateMap[targetStage] || "followup";

        const oldToast = document.getElementById("wa-followup-toast");
        if (oldToast) oldToast.remove();

        const toast = document.createElement("div");
        toast.id = "wa-followup-toast";
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 99999;
            background: var(--bg-card, #1e293b);
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-left: 4px solid #10b981;
            border-radius: 12px;
            padding: 14px 18px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.35);
            font-family: 'Inter', sans-serif;
            animation: vellia-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            max-width: 380px;
            display: flex; flex-direction: column; gap: 10px;
        `;

        toast.innerHTML = `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 22px;">💬</span>
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Estágio: ${targetStage}</div>
                        <div style="font-size: 11.5px; color: var(--text-muted, #94a3b8); margin-top: 2px;">Deseja enviar WhatsApp para <strong>${lead.contact || lead.company}</strong>?</div>
                    </div>
                </div>
                <button type="button" id="btn-close-wa-followup-toast" style="background: none; border: none; font-size: 16px; cursor: pointer; color: var(--text-muted); padding: 0;">✕</button>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 2px;">
                <button type="button" id="btn-dismiss-wa-followup" class="btn btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11.5px; border-radius: 6px;">Agora não</button>
                <button type="button" id="btn-open-wa-followup" class="btn btn-primary" style="height: 28px; padding: 0 12px; font-size: 11.5px; border-radius: 6px; background: #10b981; border-color: #10b981; display: flex; align-items: center; gap: 5px;">
                    <span>📲</span> Abrir WhatsApp
                </button>
            </div>
        `;

        document.body.appendChild(toast);

        const dismiss = () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            toast.style.transition = "all 0.25s ease";
            setTimeout(() => toast.remove(), 250);
        };

        toast.querySelector("#btn-close-wa-followup-toast")?.addEventListener("click", dismiss);
        toast.querySelector("#btn-dismiss-wa-followup")?.addEventListener("click", dismiss);
        toast.querySelector("#btn-open-wa-followup")?.addEventListener("click", () => {
            dismiss();
            if (window.WhatsApp) {
                window.WhatsApp.openModalForLead(leadId);
                const select = document.getElementById("wa-template-select");
                if (select) {
                    select.value = templateType;
                    window.WhatsApp.updateTemplateMessage();
                }
            }
        });

        setTimeout(() => {
            if (document.body.contains(toast)) dismiss();
        }, 9000);
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
    
    openNewLeadModal(prefillData = null) {
        document.getElementById("new-lead-form").reset();
        if (prefillData) {
            if (prefillData.service) {
                const notesEl = document.getElementById("lead-notes");
                if (notesEl) {
                    notesEl.value = "🎯 Lead direcionado via Guia de Serviços:\n" +
                        "• Serviço: " + prefillData.service + "\n" +
                        "• Unidade: " + (prefillData.company || "") + "\n" +
                        "• Referência de Preço: " + (prefillData.priceRef || "") + "\n\n" +
                        (prefillData.notes || "");
                }
            }
            if (prefillData.segment) {
                const segEl = document.getElementById("lead-segment");
                if (segEl) segEl.value = prefillData.segment;
            }
            if (prefillData.source) {
                const srcEl = document.getElementById("lead-source");
                if (srcEl) srcEl.value = prefillData.source;
            }
        }
        const statusEl = document.getElementById("lead-cnpj-status");
        if (statusEl) {
            statusEl.textContent = "Digite o CNPJ para auto-completar";
            statusEl.style.color = "var(--text-muted)";
        }
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

        const cnpj = CNPJService.cleanDigits(getVal("lead-cnpj"));
        const company = getVal("lead-company");
        const contact = getVal("lead-contact");
        const role = getVal("lead-role");
        const email = getVal("lead-email");
        const phone = getVal("lead-phone");
        const whatsapp = getVal("lead-whatsapp");
        const phone2 = getVal("lead-phone2");
        const email2 = getVal("lead-email2");
        const notes = getVal("lead-notes");
        const city = getVal("lead-city");
        const state = getVal("lead-state");
        const segment = getVal("lead-segment");
        const source = getVal("lead-source");
        let stage = getVal("lead-stage-init");

        if (!company || !contact || !whatsapp) {
            alert("Por favor, preencha todos os campos obrigatórios (*).");
            this.isSaving = false;
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";
        const userRole = currentUser ? currentUser.role : "seller";

        // Preservar estágio selecionado (padrão Contato caso não especificado)
        if (!stage) {
            stage = "Contato";
        }

        // Salvar lead
        const newLead = Store.addLead({
            cnpj,
            company,
            contact,
            role,
            email,
            phone,
            whatsapp,
            phone2,
            email2,
            notes,
            city,
            state,
            segment,
            source,
            stage,
            stageHistory: [
                {
                    stage,
                    userEmail,
                    timestamp: new Date().toISOString(),
                    reason: `Cadastro inicial do lead via formulário.`
                }
            ]
        }, userEmail);

        // Registrar na auditoria
        Audit.logStageChange(userEmail, company, "Nenhum (Novo)", stage, "Cadastro de lead no sistema.");

        // Fechar e recarregar
        this.closeNewLeadModal();
        this.renderLeadsTable();

        // Disparar automação de boas-vindas
        if (typeof window.WhatsApp?.sendAutomatedMessage === "function") {
            window.WhatsApp.sendAutomatedMessage(newLead.id, "welcome");
        }
        
        // Atualizar contadores
        const dashboardView = document.getElementById("view-dashboard");
        if (dashboardView && dashboardView.style.display !== "none") {
            window.dispatchEvent(new HashChangeEvent("hashchange")); // Força atualização se estiver na tela do dashboard
        }

        this.isSaving = false;
    },

    renderWhatsAppChat(lead) {
        const chatContainer = document.getElementById("chat-message-history");
        if (!chatContainer) return;
        
        chatContainer.innerHTML = "";
        
        const interactions = lead.interactions || [];
        
        // Filtrar e parsear interações de WhatsApp
        const waInteractions = interactions.filter(i => i.type === "WhatsApp");
        
        if (waInteractions.length === 0) {
            chatContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; margin-top: 40px;">Nenhuma mensagem trocada via WhatsApp ainda.</div>`;
            return;
        }
        
        const appendBubble = (sender, text, type, timestamp) => {
            const bubbleWrapper = document.createElement("div");
            bubbleWrapper.style.display = "flex";
            bubbleWrapper.style.flexDirection = "column";
            bubbleWrapper.style.alignItems = type === "outgoing" ? "flex-end" : "flex-start";
            bubbleWrapper.style.width = "100%";
            bubbleWrapper.style.marginBottom = "4px";
            
            const nameEl = document.createElement("span");
            nameEl.style.fontSize = "10px";
            nameEl.style.fontWeight = "600";
            nameEl.style.color = "var(--text-muted)";
            nameEl.style.marginBottom = "2px";
            nameEl.textContent = sender;
            
            const bubble = document.createElement("div");
            bubble.style.maxWidth = "80%";
            bubble.style.padding = "8px 12px";
            bubble.style.borderRadius = "12px";
            bubble.style.lineHeight = "1.4";
            bubble.style.wordBreak = "break-word";
            bubble.style.fontSize = "13px";
            
            if (type === "outgoing") {
                bubble.style.background = "var(--primary)";
                bubble.style.color = "#ffffff";
                bubble.style.borderBottomRightRadius = "2px";
            } else {
                bubble.style.background = "var(--bg-app)";
                bubble.style.color = "var(--text-primary)";
                bubble.style.borderBottomLeftRadius = "2px";
                bubble.style.border = "1px solid var(--border-color)";
            }
            
            bubble.textContent = text;
            
            const timeEl = document.createElement("span");
            timeEl.style.fontSize = "9px";
            timeEl.style.color = "var(--text-muted)";
            timeEl.style.marginTop = "2px";
            timeEl.textContent = timestamp ? new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
            
            bubbleWrapper.appendChild(nameEl);
            bubbleWrapper.appendChild(bubble);
            bubbleWrapper.appendChild(timeEl);
            
            chatContainer.appendChild(bubbleWrapper);
        };
        
        waInteractions.forEach(interaction => {
            const desc = interaction.description;
            
            if (desc.includes("Conversa de Triagem SDR AI:")) {
                const lines = desc.split("\n\n");
                lines.forEach(line => {
                    if (line.includes("SDR AI*:")) {
                        const text = line.substring(line.indexOf("SDR AI*:") + 8).trim().replace(/^\*/, "").replace(/\*$/, "");
                        appendBubble("SDR AI (🤖)", text, "outgoing", interaction.timestamp);
                    } else if (line.includes("*:")) {
                        const sender = line.substring(line.indexOf("*") + 1, line.indexOf("*:", line.indexOf("*") + 1));
                        const text = line.substring(line.indexOf("*:") + 2).trim();
                        appendBubble(sender, text, "incoming", interaction.timestamp);
                    }
                });
            } else if (desc.includes("Mensagem enviada via WhatsApp:")) {
                const text = desc.replace("💬 **Mensagem enviada via WhatsApp:**", "").trim();
                appendBubble("Você (Humano)", text, "outgoing", interaction.timestamp);
            } else if (desc.includes("Mensagem recebida via WhatsApp:")) {
                const text = desc.replace("💬 **Mensagem recebida via WhatsApp:**", "").trim();
                appendBubble(lead.contact || "Lead", text, "incoming", interaction.timestamp);
            } else if (desc.includes("Mensagem recebida via WhatsApp API:")) {
                const text = desc.replace("Mensagem recebida via WhatsApp API:", "").trim().replace(/^"/, "").replace(/"$/, "");
                appendBubble(lead.contact || "Lead", text, "incoming", interaction.timestamp);
            } else if (desc.startsWith("💬")) {
                const text = desc.replace(/^💬\s*/, "").trim();
                appendBubble(lead.contact || "Lead", text, "incoming", interaction.timestamp);
            } else {
                appendBubble("Sistema", desc, "incoming", interaction.timestamp);
            }
        });
        
        // Rolar até o fim
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
    },

    updateChatUIState(lead) {
        const badge = document.getElementById("chat-sdr-status-badge");
        const btnTakeover = document.getElementById("btn-takeover-chat");
        const inputContainer = document.getElementById("chat-input-container");
        const activeAlert = document.getElementById("chat-sdr-active-alert");
        
        if (!badge || !btnTakeover || !inputContainer || !activeAlert) return;
        
        if (lead.sdrPaused) {
            badge.textContent = "SDR AI Pausado";
            badge.style.background = "#fee2e2";
            badge.style.color = "#dc2626";
            
            btnTakeover.innerHTML = "🤖 Devolver p/ AI";
            btnTakeover.style.borderColor = "var(--success)";
            btnTakeover.style.color = "var(--success)";
            
            inputContainer.style.display = "flex";
            activeAlert.style.display = "none";
        } else {
            badge.textContent = "SDR AI Ativo";
            badge.style.background = "#e0f2fe";
            badge.style.color = "#0284c7";
            
            btnTakeover.innerHTML = "🤝 Assumir";
            btnTakeover.style.borderColor = "var(--primary)";
            btnTakeover.style.color = "var(--primary)";
            
            inputContainer.style.display = "none";
            activeAlert.style.display = "block";
        }
    },

    handleChatTakeover() {
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;
        
        const isPaused = !lead.sdrPaused;
        lead.sdrPaused = isPaused;
        
        Store.updateLead(lead.id, { sdrPaused: isPaused });
        
        const user = Auth.getCurrentUser();
        Audit.logConfigChange(user?.email || "sistema@vellia.com", "SDR_TAKEOVER_TOGGLE", `Vendedor ${user?.name} alterou controle do lead ${lead.company} para ${isPaused ? "HUMANO" : "SDR AI"}.`);
        
        this.updateChatUIState(lead);
        this.renderTimeline(lead);
    },

    sendChatWhatsAppMessage() {
        const input = document.getElementById("chat-text-input");
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;
        
        const user = Auth.getCurrentUser();
        const userEmail = user?.email || "sistema@vellia.com";
        
        Store.addLeadInteraction(lead.id, userEmail, {
            type: "WhatsApp",
            description: `💬 **Mensagem enviada via WhatsApp:** ${text}`
        });
        
        input.value = "";
        
        const updatedLead = Store.getLeadById(activeLeadId);
        this.renderWhatsAppChat(updatedLead);
        this.renderTimeline(updatedLead);
        
        if (updatedLead.sdrPaused) {
            setTimeout(() => {
                if (activeLeadId !== updatedLead.id) return;
                
                const replies = [
                    "Perfeito! Obrigado pelas informações. Vou analisar e te retorno.",
                    "Opa! Ótimo, muito obrigado pelo retorno rápido.",
                    "Entendido, faz todo sentido. Poderia me enviar a proposta por e-mail também?",
                    "Certo. Vocês têm algum caso de sucesso no meu segmento para eu dar uma olhada?"
                ];
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                
                Store.addLeadInteraction(updatedLead.id, "sistema@vellia.com", {
                    type: "WhatsApp",
                    description: `💬 **Mensagem recebida via WhatsApp:** ${randomReply}`
                });
                
                const refreshedLead = Store.getLeadById(activeLeadId);
                this.renderWhatsAppChat(refreshedLead);
                this.renderTimeline(refreshedLead);
            }, 2000);
        }
    },

    applyWaTemplate(tplType) {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        const input = document.getElementById("chat-text-input");
        if (!input) return;

        const currentUser = Auth.getCurrentUser();
        const sellerName = currentUser ? currentUser.name : "Consultor Vellia";
        const contactName = lead.contact || lead.company || "Cliente";
        const valStr = lead.estimatedValue ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.estimatedValue) : "R$ 0,00";

        let text = "";
        if (tplType === "welcome") {
            text = `Olá ${contactName}! Tudo bem? Aqui é o ${sellerName} da Vellia. Vi seu interesse para a empresa ${lead.company} e gostaria de entender melhor como podemos te ajudar no segmento de ${lead.segment || 'serviços'}. Qual o melhor horário para conversarmos?`;
        } else if (tplType === "proposal") {
            text = `Olá ${contactName}! Acabei de preparar a proposta comercial para a ${lead.company} no valor de ${valStr}. Fico à disposição para tirarmos qualquer dúvida!`;
        } else if (tplType === "followup") {
            text = `Olá ${contactName}, tudo bem? Passando para saber se você conseguiu analisar a nossa apresentação para a ${lead.company} e se podemos agendar um breve alinhamento esta semana.`;
        }

        input.value = text;
        input.focus();
    },

    async generateWaAIDraft() {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        const input = document.getElementById("chat-text-input");
        const btnAI = document.getElementById("btn-wa-ai-draft");
        if (!input) return;

        const originalText = btnAI ? btnAI.textContent : "";
        if (btnAI) {
            btnAI.textContent = "🤖 Gerando...";
            btnAI.disabled = true;
        }

        const prompt = `
Você é o Vellia Copiloto. Crie uma mensagem muito prática e objetiva para o vendedor enviar via WhatsApp para o lead a seguir:

- Contato: "${lead.contact || lead.company}"
- Empresa: "${lead.company}"
- Etapa Atual: "${lead.stage}"
- Valor Estimado: "R$ ${lead.estimatedValue || 0}"
- Segmento: "${lead.segment || 'Geral'}"

Instruções: Retorne APENAS o texto curto pronto da mensagem em tom amigável e focado em vendas (máximo 300 caracteres). Use emojis adequados.
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
                    body: JSON.stringify({ model: "gemini-2.5-flash", contents: [{ parts: [{ text: prompt }] }] })
                });
            }

            if (res.ok) {
                const data = await res.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (aiText) {
                    input.value = aiText.trim();
                }
            }
        } catch (e) {
            console.error("Erro ao rascunhar mensagem IA:", e);
        } finally {
            if (btnAI) {
                btnAI.textContent = originalText;
                btnAI.disabled = false;
            }
            input.focus();
        }
    },

    renderDrawerInspections(lead) {
        const container = document.getElementById("drawer-inspections-list");
        if (!container) return;

        const inspections = (lead.interactions || []).filter(i => i.type === "Inspeção");
        if (inspections.length === 0) {
            container.innerHTML = `
                <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px; border: 1px dashed var(--border-color); border-radius: 6px;">
                    Nenhuma inspeção registrada para este cliente.
                </div>
            `;
            return;
        }

        const formatDate = (dateStr) => {
            if (!dateStr) return "N/A";
            const parts = dateStr.split("-");
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        container.innerHTML = inspections.map(item => {
            const serviceName = item.meta?.serviceName || "Vistoria Geral";
            const execDate = item.meta?.executionDate || item.timestamp?.split("T")[0];
            let expiryDate = item.meta?.expiryDate;
            if (!expiryDate && execDate) {
                const date = new Date(execDate + "T12:00:00");
                date.setFullYear(date.getFullYear() + 1);
                expiryDate = date.toISOString().split("T")[0];
            }

            // Prazos e status
            const today = new Date();
            today.setHours(0,0,0,0);
            const expDate = new Date(expiryDate + "T12:00:00");
            expDate.setHours(0,0,0,0);
            const diff = expDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(diff / (1000 * 3600 * 24));

            let statusBadge = "";
            let remainingText = "";
            let showNotify = false;

            if (daysRemaining < 0) {
                statusBadge = `<span style="font-size: 9px; font-weight:700; color:#dc2626; background:#fee2e2; border:1px solid #fca5a5; padding: 2px 6px; border-radius: 4px; display:inline-block;">🔴 Vencido</span>`;
                remainingText = `Vencido há ${Math.abs(daysRemaining)} dias`;
                showNotify = true;
            } else if (daysRemaining <= 90) {
                statusBadge = `<span style="font-size: 9px; font-weight:700; color:#d97706; background:#fef3c7; border:1px solid #fcd34d; padding: 2px 6px; border-radius: 4px; display:inline-block; animation: pulse 2s infinite;"> 🟠 Crítico</span>`;
                remainingText = `Vence em ${daysRemaining} dias`;
                showNotify = true;
            } else {
                statusBadge = `<span style="font-size: 9px; font-weight:700; color:#16a34a; background:#dcfce7; border:1px solid #86efac; padding: 2px 6px; border-radius: 4px; display:inline-block;">🟢 Válido</span>`;
                remainingText = `Vence em ${daysRemaining} dias`;
            }

            const notifyBtn = showNotify 
                ? `<button class="btn btn-sm btn-success" style="background:#25d366; color:white; border:none; border-radius:6px; font-size:10px; cursor:pointer; font-weight:700; padding:4px 8px;" onclick="window.sendInspectionNotification('${lead.id}', '${item.id}')">💬 Alerta</button>`
                : "";

            const deleteBtn = `<button class="btn btn-sm" style="color:#ef4444; border:1px solid #fca5a5; background:#fff5f5; border-radius:6px; font-size:10px; cursor:pointer; font-weight:700; padding:4px 8px; margin-left:4px;" onclick="window.deleteInspection('${lead.id}', '${item.id}')" title="Excluir Inspeção">🗑️</button>`;

            return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div>
                            <strong style="color: var(--text-primary); font-size: 13px;">${serviceName}</strong>
                            ${item.meta?.inspectionNumber ? `<div style="margin-top:2px;"><span style="font-size:10px; font-family:monospace; font-weight:700; background:rgba(99,102,241,0.1); color:#4338ca; padding:1px 5px; border-radius:4px; border:1px solid rgba(99,102,241,0.2);">${item.meta.inspectionNumber}</span></div>` : ''}
                        </div>
                        ${statusBadge}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 11px;">
                        <div>
                            <span>Execução: ${formatDate(execDate)}</span><br>
                            <span>Vencimento: <strong>${formatDate(expiryDate)}</strong></span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="display:block; text-align:right; margin-bottom:4px;">${remainingText}</span>
                            <div style="display: flex; align-items: center;">
                                ${notifyBtn}
                                ${deleteBtn}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    },

    saveLeadInspection() {
        if (!activeLeadId) return;

        const serviceSelect = document.getElementById("inspection-service-select");
        const execInput = document.getElementById("inspection-exec-date");
        const expInput = document.getElementById("inspection-expiry-date");
        const notesInput = document.getElementById("inspection-notes");

        if (!execInput || !execInput.value) {
            alert("Por favor, preencha a data de execução da inspeção.");
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser?.email || "sistema@vellia.com";
        const serviceName = serviceSelect.value;
        const execDate = execInput.value;
        let expiryDate = expInput.value;

        if (!expiryDate) {
            const date = new Date(execDate + "T12:00:00");
            date.setFullYear(date.getFullYear() + 1);
            expiryDate = date.toISOString().split("T")[0];
        }

        const notes = notesInput ? notesInput.value.trim() : "";

        const interaction = {
            id: `insp_${Date.now()}`,
            type: "Inspeção",
            description: `📋 **Inspeção Realizada:** ${serviceName}\n📅 **Executado em:** ${execDate}\n⚠️ **Vencimento:** ${expiryDate}\n📝 **Notas:** ${notes || "Sem observações"}`,
            timestamp: new Date().toISOString(),
            userEmail,
            meta: {
                serviceName,
                executionDate: execDate,
                expiryDate,
                notes
            }
        };

        const lead = Store.getLeadById(activeLeadId);
        if (lead) {
            lead.interactions = lead.interactions || [];
            lead.interactions.push(interaction);
            
            Store.updateLead(lead.id, { interactions: lead.interactions }, userEmail);

            // Limpar formulário
            execInput.value = "";
            if (expInput) expInput.value = "";
            if (notesInput) notesInput.value = "";
            
            const formContainer = document.getElementById("inspection-form-container");
            const btnToggle = document.getElementById("btn-toggle-inspection-form");
            if (formContainer) formContainer.style.display = "none";
            if (btnToggle) btnToggle.textContent = "+ Registrar Nova";

            const updatedLead = Store.getLeadById(activeLeadId);
            this.renderDrawerInspections(updatedLead);
            this.renderTimeline(updatedLead);

            // Disparar sincronização local para atualizar a visualização central de inspeções
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
        }
    },

    // ==========================================================================
    // IMPORTAÇÃO DE LEADS A PARTIR DE PLANILHAS EXCEL (.XLSX, .XLS, .CSV)
    // ==========================================================================
    _excelState: {
        workbook: null,
        sheetNames: [],
        activeSheet: "",
        headers: [],
        rawRows: [],
        mapping: {},
        parsedLeads: [],
        fileName: ""
    },

    openExcelImportModal() {
        // Carregar SheetJS em background para leitura imediata
        window.LazyLoader?.ensureXLSX?.().catch(() => {});

        const curUser = Auth.getCurrentUser() || { email: "admin@vellia.com", name: "Administrador", role: "admin" };
        const role = (curUser.role || "").toLowerCase().trim();
        const isAdminOrManager = role === "admin" || role === "manager" || role === "gerente";
        const allUsers = (Store.getUsers ? Store.getUsers() : []).filter(u => u && (u.role === "seller" || u.role === "vendedor" || u.role === "manager" || u.role === "admin"));
        const sellersOnly = allUsers.filter(u => u.role === "seller" || u.role === "vendedor");

        let modal = document.getElementById("modal-import-excel-leads");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "modal-import-excel-leads";
            modal.style.cssText = "position: fixed; inset: 0; z-index: 99998; background: rgba(15, 23, 42, 0.62); backdrop-filter: blur(5px); display: none; align-items: center; justify-content: center; padding: 16px;";
            modal.addEventListener("click", (e) => {
                if (e.target === modal) this.closeExcelImportModal();
            });
            document.body.appendChild(modal);
        }

        // Resetar estado
        this._excelState = {
            workbook: null,
            sheetNames: [],
            activeSheet: "",
            headers: [],
            rawRows: [],
            mapping: {},
            parsedLeads: [],
            fileName: ""
        };

        modal.innerHTML = `
            <div style="background: var(--bg-surface, #FFFFFF); border-radius: 18px; width: 100%; max-width: 1040px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35); border: 1px solid var(--border-color, #E2E8F0); overflow: hidden; font-family: 'Inter', system-ui, sans-serif;">
                <!-- Header -->
                <div style="padding: 18px 24px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #FFFFFF; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 11px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(255,255,255,0.28);">
                            📊
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #FFFFFF; font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; letter-spacing: -0.01em;">
                                Importar Leads de Planilha Excel
                            </h3>
                            <p style="margin: 2px 0 0 0; font-size: 12.5px; color: rgba(255,255,255,0.88);">
                                Carregue arquivos <strong>.xlsx, .xls ou .csv</strong> com mapeamento inteligente de colunas e prevenção de duplicados.
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button type="button" id="btn-download-excel-template" style="background: rgba(255,255,255,0.16); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.35); border-radius: 9px; padding: 7px 13px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;">
                            📥 Baixar Planilha Modelo (.xlsx)
                        </button>
                        <button type="button" id="btn-close-excel-import" style="background: rgba(255,255,255,0.16); border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; color: #FFFFFF; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Body Scrollable -->
                <div style="padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; flex: 1;">
                    <!-- 1. Zona de Upload + Configurações Padrão -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                        <!-- Dropzone -->
                        <div id="excel-dropzone" style="border: 2px dashed rgba(16, 185, 129, 0.45); background: rgba(16, 185, 129, 0.04); border-radius: 14px; padding: 22px 18px; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                            <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv,.tsv" style="display: none;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(16, 185, 129, 0.12); color: #059669; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                                📂
                            </div>
                            <div id="excel-file-label" style="font-size: 14px; font-weight: 700; color: var(--text-primary, #0F172A);">
                                Clique para selecionar ou arraste sua planilha aqui
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted, #64748B);">
                                Suporta planilhas do Microsoft Excel (<strong>.xlsx, .xls</strong>) e <strong>.csv</strong>
                            </div>
                            <div id="excel-sheet-selector-wrap" style="display: none; margin-top: 8px; width: 100%; max-width: 280px;" onclick="event.stopPropagation();">
                                <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px; text-align: left;">Aba da Planilha:</label>
                                <select id="excel-sheet-select" class="form-control" style="height: 34px; font-size: 12.5px; padding: 4px 10px;"></select>
                            </div>
                        </div>

                        <!-- Configurações de Destino no CRM -->
                        <div style="border: 1px solid var(--border-color, #E2E8F0); background: var(--bg-app, #F8FAFC); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 11px;">
                            <div style="font-size: 12px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.04em;">
                                ⚙️ Configurações da Importação
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Responsável pelos Leads</label>
                                    <select id="excel-default-owner" class="form-control" style="height: 36px; font-size: 12.5px; padding: 4px 10px;" ${!isAdminOrManager ? 'disabled' : ''}>
                                        <option value="${curUser.email}">${curUser.name} (Meu Usuário)</option>
                                        ${isAdminOrManager && sellersOnly.length > 1 ? `<option value="__ROUND_ROBIN__">🤖 Distribuir igualmente entre vendedores (${sellersOnly.length})</option>` : ''}
                                        ${isAdminOrManager ? allUsers.filter(u => u.email !== curUser.email).map(u => `<option value="${u.email}">${u.name} (${u.role === 'seller' ? 'Vendedor' : u.role})</option>`).join("") : ''}
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Etapa Inicial no Funil</label>
                                    <select id="excel-default-stage" class="form-control" style="height: 36px; font-size: 12.5px; padding: 4px 10px;">
                                        <option value="Contato" selected>1. Contato</option>
                                        <option value="Lead Gerado">2. Lead Gerado</option>
                                        <option value="Lead Qualificado">3. Lead Qualificado</option>
                                        <option value="Proposta Enviada">4. Proposta Enviada</option>
                                        <option value="Negociação">5. Negociação</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Segmento Padrão</label>
                                    <select id="excel-default-segment" class="form-control" style="height: 36px; font-size: 12.5px; padding: 4px 10px;">
                                        <option value="Outros" selected>Outros</option>
                                        <option value="Indústria">Indústria</option>
                                        <option value="Construção Civil">Construção Civil</option>
                                        <option value="Agronegócio">Agronegócio</option>
                                        <option value="Energia">Energia</option>
                                        <option value="Comércio">Comércio</option>
                                        <option value="Serviços">Serviços</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">Origem Padrão</label>
                                    <input type="text" id="excel-default-source" class="form-control" value="Planilha Excel" style="height: 36px; font-size: 12.5px; padding: 4px 10px;">
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 2px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-primary); cursor: pointer; font-weight: 600;">
                                    <input type="checkbox" id="excel-skip-duplicates" checked style="width: 15px; height: 15px; accent-color: #059669;">
                                    <span>Desmarcar automaticamente empresas/CNPJs que já existem no CRM</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); cursor: pointer;">
                                    <input type="checkbox" id="excel-append-extra-cols" checked style="width: 15px; height: 15px; accent-color: #059669;">
                                    <span>Salvar colunas extras da planilha dentro das Observações do Lead</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Mapeamento Inteligente de Colunas (Exibido após carregar planilha) -->
                    <div id="excel-mapping-section" style="display: none; border: 1px solid var(--border-color, #E2E8F0); border-radius: 14px; padding: 16px; background: var(--bg-surface, #FFFFFF);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                            <div style="font-size: 12.5px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                                <span>🧭 Mapeamento Automático de Colunas</span>
                                <span style="font-size: 11px; font-weight: 600; color: #059669; background: rgba(16,185,129,0.1); padding: 2px 8px; border-radius: 6px;">Ajuste se necessário</span>
                            </div>
                            <span style="font-size: 11.5px; color: var(--text-muted);">Relacione as colunas da sua planilha com os campos do Vellia CRM</span>
                        </div>
                        <div id="excel-mapping-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 10px;"></div>
                    </div>

                    <!-- 3. Pré-visualização dos Leads -->
                    <div id="excel-preview-section" style="display: none; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="font-size: 13.5px; font-weight: 800; color: var(--text-primary);">📋 Pré-visualização dos Leads</span>
                                <span id="excel-stat-total" style="font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #EFF6FF; color: #2563EB;">0 na planilha</span>
                                <span id="excel-stat-selected" style="font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #ECFDF5; color: #059669;">0 selecionados</span>
                                <span id="excel-stat-duplicates" style="font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #FFFBEB; color: #D97706;">0 já existentes</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                Marque ou desmarque as linhas que deseja importar
                            </div>
                        </div>

                        <div style="border: 1px solid var(--border-color, #E2E8F0); border-radius: 12px; overflow: hidden; max-height: 310px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left;">
                                <thead style="background: var(--bg-app, #F8FAFC); position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color, #E2E8F0);">
                                    <tr>
                                        <th style="padding: 10px 12px; width: 36px; text-align: center;">
                                            <input type="checkbox" id="excel-check-all" checked style="width: 15px; height: 15px; accent-color: #059669; cursor: pointer;">
                                        </th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">Empresa / Cliente</th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">Contato</th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">Telefone / WhatsApp</th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">E-mail</th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">CNPJ</th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">Cidade/UF</th>
                                        <th style="padding: 10px 12px; font-weight: 700; color: var(--text-secondary);">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="excel-preview-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding: 14px 24px; background: var(--bg-app, #F8FAFC); border-top: 1px solid var(--border-color, #E2E8F0); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div id="excel-import-status-msg" style="font-size: 12.5px; color: var(--text-secondary); font-weight: 500;">
                        Selecione uma planilha Excel (.xlsx, .xls ou .csv) para visualizar os leads antes de importar.
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button type="button" id="btn-cancel-excel-import" class="btn btn-outline" style="height: 38px; padding: 0 16px; font-size: 13px;">
                            Cancelar
                        </button>
                        <button type="button" id="btn-confirm-excel-import" class="btn btn-primary" disabled style="height: 38px; padding: 0 20px; font-size: 13px; font-weight: 700; background: #059669; border-color: #059669; display: inline-flex; align-items: center; gap: 8px; opacity: 0.55; cursor: not-allowed;">
                            <span>✅ Importar Leads para o CRM</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = "flex";

        // Eventos do modal
        document.getElementById("btn-close-excel-import")?.addEventListener("click", () => this.closeExcelImportModal());
        document.getElementById("btn-cancel-excel-import")?.addEventListener("click", () => this.closeExcelImportModal());
        document.getElementById("btn-download-excel-template")?.addEventListener("click", () => this.downloadExcelTemplate());
        document.getElementById("btn-confirm-excel-import")?.addEventListener("click", () => this.confirmExcelImport());

        const dropzone = document.getElementById("excel-dropzone");
        const fileInput = document.getElementById("excel-file-input");

        if (dropzone && fileInput) {
            dropzone.addEventListener("click", (e) => {
                if (e.target.closest("#excel-sheet-selector-wrap")) return;
                fileInput.click();
            });
            dropzone.addEventListener("dragover", (e) => {
                e.preventDefault();
                dropzone.style.borderColor = "#059669";
                dropzone.style.background = "rgba(16, 185, 129, 0.12)";
            });
            dropzone.addEventListener("dragleave", () => {
                dropzone.style.borderColor = "rgba(16, 185, 129, 0.45)";
                dropzone.style.background = "rgba(16, 185, 129, 0.04)";
            });
            dropzone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropzone.style.borderColor = "rgba(16, 185, 129, 0.45)";
                dropzone.style.background = "rgba(16, 185, 129, 0.04)";
                const file = e.dataTransfer?.files?.[0];
                if (file) this.handleExcelFileSelected(file);
            });
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files?.[0];
                if (file) this.handleExcelFileSelected(file);
            });
        }

        document.getElementById("excel-sheet-select")?.addEventListener("change", (e) => {
            this.loadExcelSheetByName(e.target.value);
        });

        ["excel-default-stage", "excel-default-segment", "excel-default-source", "excel-skip-duplicates", "excel-append-extra-cols"].forEach(id => {
            document.getElementById(id)?.addEventListener("change", () => {
                if (this._excelState.rawRows.length > 0) {
                    this.rebuildExcelParsedLeads();
                    this.renderExcelImportPreview();
                }
            });
        });
    },

    closeExcelImportModal() {
        const modal = document.getElementById("modal-import-excel-leads");
        if (modal) modal.style.display = "none";
    },

    async downloadExcelTemplate() {
        const sampleRows = [
            {
                "Empresa": "Indústria Metalúrgica Modelo Ltda",
                "Contato": "Carlos Eduardo",
                "Cargo": "Gerente de SGI",
                "Telefone / WhatsApp": "(81) 99876-5432",
                "E-mail": "carlos@metalurgicamodelo.com.br",
                "CNPJ": "12.345.678/0001-90",
                "Cidade": "Recife",
                "UF": "PE",
                "Segmento": "Indústria",
                "Origem": "Planilha Excel",
                "Etapa": "Contato",
                "Observações": "Interesse em Licenciamento Ambiental e NR-13"
            },
            {
                "Empresa": "Construtora Horizonte S/A",
                "Contato": "Fernanda Lima",
                "Cargo": "Engenheira Ambiental",
                "Telefone / WhatsApp": "(81) 99123-4567",
                "E-mail": "fernanda@construtorahorizonte.com.br",
                "CNPJ": "98.765.432/0001-10",
                "Cidade": "Jaboatão dos Guararapes",
                "UF": "PE",
                "Segmento": "Construção Civil",
                "Origem": "Planilha Excel",
                "Etapa": "Contato",
                "Observações": "Solicitou orçamento para monitoramento ambiental"
            }
        ];

        try {
            const XLSX = await window.LazyLoader?.ensureXLSX?.();
            if (XLSX) {
                const ws = XLSX.utils.json_to_sheet(sampleRows);
                ws["!cols"] = [
                    { wch: 34 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
                    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 6 },
                    { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 42 }
                ];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Modelo Leads Vellia");
                XLSX.writeFile(wb, "Modelo_Importacao_Leads_Vellia_CRM.xlsx");
                return;
            }
        } catch (e) {
            console.warn("Fallback CSV para planilha modelo:", e);
        }

        // Fallback CSV com BOM UTF-8 (abre direto no Excel em português com separador ;)
        const headers = Object.keys(sampleRows[0]);
        const csvLines = [
            headers.join(";"),
            ...sampleRows.map(r => headers.map(h => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(";"))
        ];
        const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Modelo_Importacao_Leads_Vellia_CRM.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },

    async handleExcelFileSelected(file) {
        const labelEl = document.getElementById("excel-file-label");
        const statusMsg = document.getElementById("excel-import-status-msg");
        if (labelEl) labelEl.textContent = `⏳ Lendo arquivo "${file.name}"...`;
        if (statusMsg) statusMsg.textContent = `Processando planilha "${file.name}"...`;

        this._excelState.fileName = file.name;
        const ext = (file.name.split(".").pop() || "").toLowerCase();

        try {
            let XLSX = window.XLSX;
            if (!XLSX) {
                try {
                    XLSX = await window.LazyLoader?.ensureXLSX?.();
                } catch (e) {
                    XLSX = null;
                }
            }

            if (XLSX && (ext === "xlsx" || ext === "xls" || ext === "csv" || ext === "tsv")) {
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
                this._excelState.workbook = wb;
                this._excelState.sheetNames = wb.SheetNames || [];

                const sheetWrap = document.getElementById("excel-sheet-selector-wrap");
                const sheetSelect = document.getElementById("excel-sheet-select");
                if (sheetWrap && sheetSelect) {
                    if (this._excelState.sheetNames.length > 1) {
                        sheetWrap.style.display = "block";
                        sheetSelect.innerHTML = this._excelState.sheetNames.map(n => `<option value="${n}">${n}</option>`).join("");
                    } else {
                        sheetWrap.style.display = "none";
                    }
                }

                const firstSheet = this._excelState.sheetNames[0];
                if (!firstSheet) throw new Error("A planilha não possui abas válidas.");
                this.loadExcelSheetByName(firstSheet);
            } else {
                // Fallback nativo para arquivos CSV / TSV
                const text = await file.text();
                const matrix = this.parseCsvTextFallback(text);
                this.extractRowsFromSheetMatrix(matrix);
            }

            if (labelEl) {
                labelEl.innerHTML = `<span style="color: #059669;">✅ ${file.name}</span> <span style="font-size: 12px; font-weight: 500; color: var(--text-muted);">(${this._excelState.rawRows.length} linhas detectadas — clique para trocar)</span>`;
            }
        } catch (err) {
            console.error("Erro ao ler planilha:", err);
            if (labelEl) labelEl.textContent = `❌ Falha ao ler "${file.name}". Clique para tentar outro arquivo.`;
            alert(`Não foi possível processar o arquivo "${file.name}":\n${err.message || err}`);
        }
    },

    loadExcelSheetByName(sheetName) {
        const wb = this._excelState.workbook;
        const XLSX = window.XLSX;
        if (!wb || !XLSX) return;
        this._excelState.activeSheet = sheetName;
        const ws = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
        this.extractRowsFromSheetMatrix(matrix);
    },

    parseCsvTextFallback(text) {
        const clean = (text || "").replace(/^\uFEFF/, "");
        const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        const firstLine = lines[0];
        const semiCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const sep = tabCount > semiCount && tabCount > commaCount ? "\t" : (semiCount >= commaCount ? ";" : ",");

        return lines.map(line => {
            const cells = [];
            let cur = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === sep && !inQuotes) {
                    cells.push(cur.trim());
                    cur = "";
                } else {
                    cur += ch;
                }
            }
            cells.push(cur.trim());
            return cells;
        });
    },

    extractRowsFromSheetMatrix(matrix) {
        if (!Array.isArray(matrix) || matrix.length === 0) {
            throw new Error("A planilha selecionada está vazia.");
        }

        // Encontrar a melhor linha de cabeçalho (entre as 10 primeiras linhas)
        const headerKeywords = ["empresa", "cliente", "razao", "fantasia", "nome", "contato", "telefone", "whatsapp", "celular", "fone", "email", "e-mail", "cnpj", "cidade", "uf", "estado", "segmento", "cargo", "observa"];
        let bestHeaderIdx = 0;
        let bestScore = -1;

        const maxScan = Math.min(matrix.length, 10);
        for (let i = 0; i < maxScan; i++) {
            const row = matrix[i];
            if (!Array.isArray(row)) continue;
            const nonEmpty = row.filter(c => String(c ?? "").trim().length > 0);
            if (nonEmpty.length === 0) continue;
            let score = nonEmpty.length;
            nonEmpty.forEach(cell => {
                const norm = String(cell).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (headerKeywords.some(kw => norm.includes(kw))) {
                    score += 5;
                }
            });
            if (score > bestScore) {
                bestScore = score;
                bestHeaderIdx = i;
            }
        }

        const rawHeaderRow = matrix[bestHeaderIdx] || [];
        const headers = [];
        const colIndices = [];

        rawHeaderRow.forEach((cell, colIdx) => {
            const name = String(cell ?? "").trim() || `Coluna ${colIdx + 1}`;
            // Verificar se a coluna tem algum dado nas linhas abaixo ou cabeçalho explícito
            const hasDataBelow = matrix.slice(bestHeaderIdx + 1).some(r => Array.isArray(r) && String(r[colIdx] ?? "").trim().length > 0);
            if (String(cell ?? "").trim().length > 0 || hasDataBelow) {
                headers.push(name);
                colIndices.push(colIdx);
            }
        });

        const dataRows = [];
        for (let r = bestHeaderIdx + 1; r < matrix.length; r++) {
            const rowArr = matrix[r];
            if (!Array.isArray(rowArr)) continue;
            const rowObj = {};
            let nonEmptyCells = 0;
            headers.forEach((h, idx) => {
                const val = String(rowArr[colIndices[idx]] ?? "").trim();
                rowObj[h] = val;
                if (val.length > 0) nonEmptyCells++;
            });
            if (nonEmptyCells > 0) {
                dataRows.push(rowObj);
            }
        }

        if (dataRows.length === 0) {
            throw new Error("Nenhum registro de lead foi encontrado abaixo do cabeçalho da planilha.");
        }

        this._excelState.headers = headers;
        this._excelState.rawRows = dataRows;
        this._excelState.mapping = this.autoDetectExcelColumnMapping(headers);

        this.renderExcelColumnMappingUI();
        this.rebuildExcelParsedLeads();
        this.renderExcelImportPreview();
    },

    autoDetectExcelColumnMapping(headers) {
        const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const used = new Set();

        const findBestHeader = (patterns) => {
            for (const pat of patterns) {
                const exact = headers.find(h => !used.has(h) && norm(h) === pat);
                if (exact) { used.add(exact); return exact; }
            }
            for (const pat of patterns) {
                const partial = headers.find(h => !used.has(h) && norm(h).includes(pat));
                if (partial) { used.add(partial); return partial; }
            }
            return "";
        };

        const mapping = {
            company: findBestHeader(["empresa", "razao social", "nome fantasia", "cliente", "organizacao", "companhia", "estabelecimento", "unidade"]),
            contact: findBestHeader(["contato", "responsavel", "decisor", "nome do contato", "pessoa", "representante", "solicitante", "nome"]),
            phone: findBestHeader(["telefone / whatsapp", "whatsapp", "telefone", "celular", "fone", "tel", "contato telefonico", "numero"]),
            phone2: findBestHeader(["telefone 2", "fone 2", "tel 2", "fixo", "segundo telefone"]),
            email: findBestHeader(["e-mail", "email", "correio", "mail"]),
            cnpj: findBestHeader(["cnpj", "cpf/cnpj", "documento", "cpf"]),
            role: findBestHeader(["cargo", "funcao", "departamento", "setor"]),
            city: findBestHeader(["cidade", "municipio", "localidade"]),
            state: findBestHeader(["uf", "estado"]),
            segment: findBestHeader(["segmento", "ramo", "atividade", "vertical", "area"]),
            source: findBestHeader(["origem", "fonte", "canal"]),
            stage: findBestHeader(["etapa", "estagio", "fase", "status"]),
            notes: findBestHeader(["observacoes", "observacao", "obs", "notas", "historico", "comentarios", "servico", "descricao", "detalhes"])
        };

        // Se não achou coluna "Empresa", mas achou "Contato" (ex: planilha com apenas coluna "Nome" ou a 1ª coluna da planilha)
        if (!mapping.company && headers.length > 0) {
            mapping.company = mapping.contact || headers[0];
        }

        return mapping;
    },

    renderExcelColumnMappingUI() {
        const sec = document.getElementById("excel-mapping-section");
        const grid = document.getElementById("excel-mapping-grid");
        if (!sec || !grid) return;

        sec.style.display = "block";
        const headers = this._excelState.headers;
        const mapping = this._excelState.mapping;

        const fields = [
            { key: "company", label: "🏢 Empresa / Cliente *" },
            { key: "contact", label: "👤 Contato / Responsável" },
            { key: "phone", label: "📞 Telefone / WhatsApp" },
            { key: "email", label: "✉️ E-mail" },
            { key: "cnpj", label: "🪪 CNPJ / Documento" },
            { key: "role", label: "💼 Cargo" },
            { key: "city", label: "📍 Cidade" },
            { key: "state", label: "🗺️ UF / Estado" },
            { key: "segment", label: "🏷️ Segmento" },
            { key: "notes", label: "📝 Observações" }
        ];

        grid.innerHTML = fields.map(f => `
            <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 3px;">${f.label}</label>
                <select class="form-control excel-col-map-select" data-field="${f.key}" style="height: 34px; font-size: 12px; padding: 4px 8px;">
                    <option value="">— Não mapear —</option>
                    ${headers.map(h => `<option value="${h.replace(/"/g, '&quot;')}" ${mapping[f.key] === h ? "selected" : ""}>${h}</option>`).join("")}
                </select>
            </div>
        `).join("");

        grid.querySelectorAll(".excel-col-map-select").forEach(sel => {
            sel.addEventListener("change", (e) => {
                const field = e.target.getAttribute("data-field");
                this._excelState.mapping[field] = e.target.value;
                this.rebuildExcelParsedLeads();
                this.renderExcelImportPreview();
            });
        });
    },

    rebuildExcelParsedLeads() {
        const { rawRows, headers, mapping } = this._excelState;
        const defaultStage = document.getElementById("excel-default-stage")?.value || "Contato";
        const defaultSegment = document.getElementById("excel-default-segment")?.value || "Outros";
        const defaultSource = document.getElementById("excel-default-source")?.value.trim() || "Planilha Excel";
        const skipDuplicates = document.getElementById("excel-skip-duplicates")?.checked !== false;
        const appendExtraCols = document.getElementById("excel-append-extra-cols")?.checked !== false;

        const existingLeads = Store.getLeads ? Store.getLeads() : [];
        const existingCompanies = new Set(existingLeads.map(l => (l.company || "").toLowerCase().trim()).filter(Boolean));
        const existingCnpjs = new Set(existingLeads.map(l => String(l.cnpj || "").replace(/\D/g, "")).filter(d => d.length >= 11));

        const mappedHeadersSet = new Set(Object.values(mapping).filter(Boolean));

        const parsed = [];
        rawRows.forEach((row, idx) => {
            const getCol = (key) => (mapping[key] && row[mapping[key]]) ? String(row[mapping[key]]).trim() : "";

            let company = getCol("company");
            let contact = getCol("contact");
            if (!company && contact) {
                company = contact;
            }
            if (!company) return; // Ignorar linha completamente sem identificação

            const phone = getCol("phone");
            const phone2 = getCol("phone2");
            const email = getCol("email");
            const rawCnpj = getCol("cnpj");
            const cleanCnpjDigits = rawCnpj.replace(/\D/g, "");
            const cnpjFormatted = cleanCnpjDigits.length === 14 ? CNPJService.formatCNPJ(cleanCnpjDigits) : rawCnpj;
            const role = getCol("role");
            const city = getCol("city");
            const state = getCol("state").toUpperCase().slice(0, 2);
            const segment = getCol("segment") || defaultSegment;
            const source = getCol("source") || defaultSource;

            // Mapear etapa caso exista na planilha
            const rawStage = getCol("stage").toLowerCase();
            let stage = defaultStage;
            if (rawStage) {
                if (rawStage.includes("fechado") || rawStage.includes("ganho")) stage = "Cliente Fechado";
                else if (rawStage.includes("negocia")) stage = "Negociação";
                else if (rawStage.includes("proposta") || rawStage.includes("orcamento") || rawStage.includes("orçamento")) stage = "Proposta Enviada";
                else if (rawStage.includes("qualificado")) stage = "Lead Qualificado";
                else if (rawStage.includes("gerado") || rawStage.includes("novo")) stage = "Lead Gerado";
                else if (rawStage.includes("perdido")) stage = "Cliente Perdido";
            }

            let notesParts = [];
            const baseNotes = getCol("notes");
            if (baseNotes) notesParts.push(baseNotes);

            if (appendExtraCols) {
                const extras = [];
                headers.forEach(h => {
                    if (!mappedHeadersSet.has(h)) {
                        const val = String(row[h] ?? "").trim();
                        if (val) extras.push(`${h}: ${val}`);
                    }
                });
                if (extras.length > 0) {
                    notesParts.push(`[Dados da Planilha]: ${extras.join(" | ")}`);
                }
            }

            const isDuplicate = existingCompanies.has(company.toLowerCase().trim()) ||
                                (cleanCnpjDigits.length >= 11 && existingCnpjs.has(cleanCnpjDigits));

            parsed.push({
                _rowIndex: idx,
                selected: skipDuplicates ? !isDuplicate : true,
                isDuplicate,
                company,
                contact: contact || "Responsável",
                role,
                phone,
                whatsapp: phone,
                phone2,
                email,
                cnpj: cleanCnpjDigits || rawCnpj,
                cnpjDisplay: cnpjFormatted,
                city,
                state,
                segment,
                source,
                stage,
                notes: notesParts.join("\n")
            });
        });

        this._excelState.parsedLeads = parsed;
    },

    renderExcelImportPreview() {
        const previewSec = document.getElementById("excel-preview-section");
        const tbody = document.getElementById("excel-preview-tbody");
        const statTotal = document.getElementById("excel-stat-total");
        const statSelected = document.getElementById("excel-stat-selected");
        const statDuplicates = document.getElementById("excel-stat-duplicates");
        const btnConfirm = document.getElementById("btn-confirm-excel-import");
        const statusMsg = document.getElementById("excel-import-status-msg");
        const checkAll = document.getElementById("excel-check-all");

        if (!previewSec || !tbody) return;

        const list = this._excelState.parsedLeads;
        previewSec.style.display = "flex";

        const updateCounters = () => {
            const total = list.length;
            const selectedCount = list.filter(item => item.selected).length;
            const dupCount = list.filter(item => item.isDuplicate).length;

            if (statTotal) statTotal.textContent = `${total} na planilha`;
            if (statSelected) statSelected.textContent = `${selectedCount} selecionados para importar`;
            if (statDuplicates) statDuplicates.textContent = `${dupCount} já existentes no CRM`;

            if (btnConfirm) {
                btnConfirm.disabled = selectedCount === 0;
                btnConfirm.style.opacity = selectedCount === 0 ? "0.55" : "1";
                btnConfirm.style.cursor = selectedCount === 0 ? "not-allowed" : "pointer";
                btnConfirm.innerHTML = `<span>✅ Importar ${selectedCount} ${selectedCount === 1 ? "Lead" : "Leads"} para o CRM</span>`;
            }
            if (statusMsg) {
                statusMsg.innerHTML = selectedCount > 0
                    ? `Pronto para importar <strong>${selectedCount}</strong> lead(s) diretamente para o Vellia CRM e sincronizar com o Supabase.`
                    : `Nenhum lead selecionado para importação.`;
            }
            if (checkAll) {
                checkAll.checked = total > 0 && selectedCount === total;
            }
        };

        tbody.innerHTML = list.map((item, idx) => `
            <tr style="border-bottom: 1px solid var(--border-color, #E2E8F0); background: ${item.isDuplicate ? 'rgba(245, 158, 11, 0.04)' : 'transparent'};">
                <td style="padding: 9px 12px; text-align: center;">
                    <input type="checkbox" class="excel-row-check" data-idx="${idx}" ${item.selected ? "checked" : ""} style="width: 15px; height: 15px; accent-color: #059669; cursor: pointer;">
                </td>
                <td style="padding: 9px 12px; font-weight: 700; color: var(--text-primary);">${item.company}</td>
                <td style="padding: 9px 12px; color: var(--text-secondary);">${item.contact}${item.role ? ` <span style="font-size:11px; color:var(--text-muted);">(${item.role})</span>` : ""}</td>
                <td style="padding: 9px 12px; color: var(--text-secondary); font-family: monospace;">${item.phone || "—"}</td>
                <td style="padding: 9px 12px; color: var(--text-secondary);">${item.email || "—"}</td>
                <td style="padding: 9px 12px; color: var(--text-secondary); font-family: monospace;">${item.cnpjDisplay || "—"}</td>
                <td style="padding: 9px 12px; color: var(--text-secondary);">${item.city || "—"}${item.state ? `/${item.state}` : ""}</td>
                <td style="padding: 9px 12px;">
                    ${item.isDuplicate
                        ? `<span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A;">⚠️ Já existe</span>`
                        : `<span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;">✓ Novo</span>`
                    }
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll(".excel-row-check").forEach(chk => {
            chk.addEventListener("change", (e) => {
                const i = parseInt(e.target.getAttribute("data-idx"), 10);
                if (list[i]) list[i].selected = e.target.checked;
                updateCounters();
            });
        });

        if (checkAll) {
            checkAll.onclick = (e) => {
                const checked = e.target.checked;
                list.forEach(item => { item.selected = checked; });
                tbody.querySelectorAll(".excel-row-check").forEach(chk => { chk.checked = checked; });
                updateCounters();
            };
        }

        updateCounters();
    },

    async confirmExcelImport() {
        const selectedLeads = (this._excelState.parsedLeads || []).filter(item => item.selected);
        if (selectedLeads.length === 0) return;

        const btnConfirm = document.getElementById("btn-confirm-excel-import");
        if (btnConfirm) {
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = `<span>⏳ Importando ${selectedLeads.length} leads...</span>`;
        }

        try {
            const curUser = Auth.getCurrentUser() || { email: "admin@vellia.com", name: "Administrador", role: "admin" };
            const ownerSetting = document.getElementById("excel-default-owner")?.value || curUser.email;
            const sellersOnly = (Store.getUsers ? Store.getUsers() : []).filter(u => u && (u.role === "seller" || u.role === "vendedor"));

            const payloads = selectedLeads.map((item, idx) => {
                let assignedOwner = ownerSetting;
                if (ownerSetting === "__ROUND_ROBIN__" && sellersOnly.length > 0) {
                    assignedOwner = sellersOnly[idx % sellersOnly.length].email;
                }
                return {
                    company: item.company,
                    contact: item.contact,
                    role: item.role,
                    phone: item.phone,
                    whatsapp: item.whatsapp,
                    phone2: item.phone2,
                    email: item.email,
                    cnpj: item.cnpj,
                    city: item.city,
                    state: item.state,
                    segment: item.segment,
                    source: item.source,
                    stage: item.stage,
                    notes: item.notes,
                    owner: assignedOwner,
                    createdBy: assignedOwner
                };
            });

            const created = await Store.addLeadsBulk(payloads, curUser.email);

            this.closeExcelImportModal();
            this.renderLeadsTable();
            if (window.Kanban && typeof window.Kanban.renderBoard === "function") {
                window.Kanban.renderBoard();
            }
            if (window.Dashboard && typeof window.Dashboard.renderManagerDailyProductivity === "function") {
                window.Dashboard.renderManagerDailyProductivity();
            }

            if (window.Toast && typeof window.Toast.show === "function") {
                window.Toast.show({
                    type: "success",
                    title: "Importação Concluída!",
                    message: `${created.length} lead(s) importado(s) da planilha Excel com sucesso.`,
                    duration: 4000
                });
            } else {
                alert(`✅ Importação concluída! ${created.length} lead(s) foram adicionados ao CRM.`);
            }
        } catch (err) {
            console.error("Erro na importação de leads via Excel:", err);
            alert("Ocorreu um erro ao importar os leads: " + (err.message || err));
            if (btnConfirm) {
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = `<span>✅ Importar ${selectedLeads.length} Leads para o CRM</span>`;
            }
        }
    }
};

window.openLeadDrawerFromExt = (id) => CRM.openLeadDrawer(id);

