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
            btnCancelStageReason: document.getElementById("btn-cancel-stage-reason"),
            btnEditLead: document.getElementById("btn-edit-lead"),
            btnCloseEditLead: document.getElementById("btn-close-edit-lead"),
            btnCancelEditLead: document.getElementById("btn-cancel-edit-lead"),
            editLeadForm: document.getElementById("edit-lead-form")
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

        // Modal Edição de Lead
        if (elements.btnEditLead) elements.btnEditLead.addEventListener("click", () => this.openEditLeadModal());
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
        if (elements.crmFilterStage) elements.crmFilterStage.addEventListener("change", () => this.renderLeadsTable());

        // Drawer Detalhes
        if (elements.btnCloseDrawer) elements.btnCloseDrawer.addEventListener("click", () => this.closeLeadDrawer());
        if (elements.drawerOverlay) elements.drawerOverlay.addEventListener("click", () => this.closeLeadDrawer());

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
            // Vendedor: filtra leads atribuídos a ele
            leads = leads.filter(l => l.owner === currentUser?.email);
            if (btnAiDistribute) btnAiDistribute.style.display = "none";
            if (ownerFilterGroup) ownerFilterGroup.style.display = "none";
        }

        const searchQuery = document.getElementById("crm-search")?.value.toLowerCase().trim() || "";
        const stageFilter = document.getElementById("crm-filter-stage")?.value || "all";
        const ownerFilterValue = ownerFilter?.value || "all";

        // Filtro de leads
        const filteredLeads = leads.filter(lead => {
            const matchesSearch =
                (lead.company || "").toLowerCase().includes(searchQuery) ||
                (lead.contact || "").toLowerCase().includes(searchQuery) ||
                (lead.segment || "").toLowerCase().includes(searchQuery) ||
                (lead.email || "").toLowerCase().includes(searchQuery);

            const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
            const matchesOwner = !isAdmin || ownerFilterValue === "all" || lead.owner === ownerFilterValue;

            return matchesSearch && matchesStage && matchesOwner;
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
            let stageBadgeClass = "badge-info";
            if (lead.stage === "Cliente Fechado") stageBadgeClass = "badge-success";
            else if (lead.stage === "Cliente Perdido") stageBadgeClass = "badge-danger";
            else if (lead.stage === "Negociação" || lead.stage === "Proposta Enviada") stageBadgeClass = "badge-warning";

            // Badge de Score IA (SDR Agent)
            const aiScore = lead.aiScore != null ? lead.aiScore : null;
            let scoreBadge = `<span style="font-size: 11px; color: var(--text-muted);">—</span>`;
            if (aiScore !== null) {
                let icon, color, bg;
                if (aiScore >= 75)      { icon = "🔥"; color = "#ef4444"; bg = "rgba(239,68,68,0.1)"; }
                else if (aiScore >= 45) { icon = "⚡"; color = "#f59e0b"; bg = "rgba(245,158,11,0.1)"; }
                else                   { icon = "❄️"; color = "#6366f1"; bg = "rgba(99,102,241,0.1)"; }
                scoreBadge = `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
                        <span style="font-size:9px;font-weight:700;background:${bg};color:${color};border:1px solid ${color}40;padding:2px 8px;border-radius:99px;">${icon} ${aiScore}/100</span>
                        <div style="width:50px;height:4px;background:var(--bg-app);border-radius:99px;overflow:hidden;">
                            <div style="width:${aiScore}%;height:100%;background:${color};border-radius:99px;"></div>
                        </div>
                    </div>
                `;
            }

            // Obter dados do responsável
            let ownerName = "Não atribuído";
            let ownerAvatar = "—";
            let ownerColor = "#94a3b8";
            if (lead.owner) {
                const ownerUser = Store.getUserByEmail(lead.owner);
                if (ownerUser) {
                    ownerName = ownerUser.name;
                    ownerAvatar = ownerUser.avatar;
                    ownerColor = "var(--primary)";
                } else {
                    ownerName = lead.owner.split("@")[0];
                    ownerAvatar = ownerName.substring(0, 2).toUpperCase();
                }
            }

            // Coluna de Responsável: admin vê dropdown, vendedor vê nome fixo
            const ownerCell = isAdmin
                ? `<select class="filter-control assign-owner-select" data-id="${lead.id}" style="height: 32px; font-size: 12px; min-width: 140px;" onclick="event.stopPropagation();">
                    <option value="">— Não atribuído —</option>
                    ${Store.getUsers().filter(u => u.role === "seller" || u.role === "manager" || u.role === "admin").map(s => `<option value="${s.email}" ${lead.owner === s.email ? "selected" : ""}>${s.name}</option>`).join("")}
                   </select>`
                : `<div style="display:flex;align-items:center;gap:8px;">
                     <div class="user-avatar" style="width:24px;height:24px;font-size:10px;flex-shrink:0;background:${ownerColor};">${ownerAvatar}</div>
                     <span style="font-size:13px;font-weight:500;">${ownerName}</span>
                   </div>`;

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
                    <td style="text-align:center;">${scoreBadge}</td>
                    <td onclick="event.stopPropagation();">
                        ${ownerCell}
                    </td>
                    <td style="text-align: right;" onclick="event.stopPropagation();">
                        <button class="btn btn-outline btn-wa-lead" data-id="${lead.id}" style="padding: 6px; font-size: 12px; border-color: #25d366; color: #25d366; margin-right: 6px; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; vertical-align: middle;" title="Enviar WhatsApp">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </button>
                        <button class="btn btn-outline btn-view-lead" data-id="${lead.id}" style="padding: 6px 10px; font-size: 12px; vertical-align: middle;">
                            Ver Detalhes
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
    // EDIÇÃO DE LEADS
    // ==========================================================================

    openEditLeadModal() {
        if (!activeLeadId) return;
        const lead = Store.getLeadById(activeLeadId);
        if (!lead) return;

        document.getElementById("edit-lead-id").value = lead.id;
        document.getElementById("edit-lead-company").value = lead.company;
        document.getElementById("edit-lead-contact").value = lead.contact;
        document.getElementById("edit-lead-email").value = lead.email || "";
        document.getElementById("edit-lead-whatsapp").value = lead.whatsapp || "";
        document.getElementById("edit-lead-segment").value = lead.segment || "Outros";
        document.getElementById("edit-lead-source").value = lead.source || "Outbound";

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
        const updatedData = {
            company: document.getElementById("edit-lead-company").value.trim(),
            contact: document.getElementById("edit-lead-contact").value.trim(),
            email: document.getElementById("edit-lead-email").value.trim(),
            whatsapp: document.getElementById("edit-lead-whatsapp").value.trim(),
            segment: document.getElementById("edit-lead-segment").value,
            source: document.getElementById("edit-lead-source").value
        };

        const user = Auth.getCurrentUser();
        Store.updateLead(id, updatedData, user ? user.email : "sistema@vellia.com");
        
        this.closeEditLeadModal();
        this.openLeadDrawer(id); // Reload drawer with new data
        this.renderLeadsTable(); // Update list
        alert("Lead atualizado com sucesso!");
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

        // Resetar form follow-up
        const ffContainer = document.getElementById("followup-form-container");
        const ffToggle = document.getElementById("btn-toggle-followup-form");
        if (ffContainer) ffContainer.style.display = "none";
        if (ffToggle) ffToggle.textContent = "+ Novo";

        // Exibir Drawer e Overlay
        document.getElementById("lead-drawer").classList.add("open");
        document.getElementById("drawer-overlay").style.display = "block";
    },

    closeLeadDrawer() {
        activeLeadId = null;
        document.getElementById("lead-drawer").classList.remove("open");
        document.getElementById("drawer-overlay").style.display = "none";
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

        // Abrir modal correspondente
        if (newStage === "Lead Qualificado") {
            document.getElementById("qualify-lead-form").reset();
            document.getElementById("qualify-lead-modal").classList.add("open");
        } else {
            document.getElementById("stage-reason-target-name").textContent = newStage;
            document.getElementById("stage-reason-text").value = "";
            document.getElementById("stage-reason-modal").classList.add("open");
        }
        
        document.getElementById("modal-overlay").style.display = "block";
    },

    confirmQualifyLead() {
        if (!activeLeadId || pendingStageChange !== "Lead Qualificado") return;

        const service = document.getElementById("qualify-service").value;
        const value = parseFloat(document.getElementById("qualify-value").value) || 0;
        const prob = parseInt(document.getElementById("qualify-prob").value) || 0;
        const deadline = document.getElementById("qualify-deadline").value;
        const notes = document.getElementById("qualify-notes").value.trim();

        if (!service || !value || !prob || !deadline) return;

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

        this.closeQualifyLeadModal();

        const updatedLead = Store.getLeadById(activeLeadId);
        const stageSelect = document.getElementById("drawer-change-stage");
        if (stageSelect) stageSelect.value = updatedLead.stage;

        this.renderTimeline(updatedLead);
        this.renderLeadsTable();
        pendingStageChange = null;
        window.dispatchEvent(new CustomEvent("vellia:stageChanged"));
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
    }
};
