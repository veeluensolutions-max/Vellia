import { Store } from "./store.js";
import { CRM } from "./crm.js";

let draggedLeadId = null;

export const Kanban = {
    _filtersInitialized: false,
    _dragInitialized: false,
    _listenersInitialized: false,
    _searchDebounceTimer: null,

    init() {
        CRM.init(); // Garante inicialização de modais globais e eventos do CRM
        this.initFilters();
        this.initDragAndDrop();
        this.initListeners();
        this.renderKanban();
    },

    initFilters() {
        if (this._filtersInitialized) return;

        const searchInput = document.getElementById("kanban-search");
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                clearTimeout(this._searchDebounceTimer);
                this._searchDebounceTimer = setTimeout(() => this.renderKanban(), 120);
            });
        }

        const ownerSelect = document.getElementById("kanban-filter-owner");
        const ownerGroup = document.getElementById("kanban-filter-owner-group");
        const session = JSON.parse(localStorage.getItem("comercial_session"));

        if (session && session.role !== "seller" && ownerGroup && ownerSelect) {
            ownerGroup.style.display = "block";
            const users = Store.getUsers();
            const sellers = users.filter(u => u.role === "seller" || u.role === "admin" || u.role === "manager" || u.role === "vendedor");
            
            ownerSelect.innerHTML = `<option value="all">Todos os Vendedores</option>` +
                sellers.map(s => `<option value="${s.email}">${s.name}</option>`).join("");

            ownerSelect.addEventListener("change", () => this.renderKanban());
        }

        const sortSelect = document.getElementById("kanban-filter-sort");
        if (sortSelect) {
            sortSelect.addEventListener("change", () => this.renderKanban());
        }

        this._filtersInitialized = true;
    },

    initListeners() {
        if (this._listenersInitialized) return;
        window.addEventListener("vellia:stageChanged", () => this.renderKanban());
        window.addEventListener("vellia:agentScoreUpdated", () => this.renderKanban());
        window.addEventListener("vellia:leadDeleted", () => this.renderKanban());
        window.addEventListener("vellia:leadRestored", () => this.renderKanban());
        this._listenersInitialized = true;
    },

    initDragAndDrop() {
        if (this._dragInitialized) return;

        const stageContainers = [
            { id: "cards-Contato", stage: "Contato" },
            { id: "cards-Lead-Gerado", stage: "Lead Gerado" },
            { id: "cards-Lead-Qualificado", stage: "Lead Qualificado" },
            { id: "cards-Proposta-Enviada", stage: "Proposta Enviada" },
            { id: "cards-Negociacao", stage: "Negociação" },
            { id: "cards-Cliente-Fechado", stage: "Cliente Fechado" },
            { id: "cards-Cliente-Perdido", stage: "Cliente Perdido" }
        ];

        stageContainers.forEach(({ id, stage }) => {
            const container = document.getElementById(id);
            if (!container) return;

            container.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (!container.classList.contains("drag-over")) {
                    container.classList.add("drag-over");
                }
            });

            container.addEventListener("dragenter", (e) => {
                e.preventDefault();
                container.classList.add("drag-over");
            });

            container.addEventListener("dragleave", (e) => {
                if (!container.contains(e.relatedTarget)) {
                    container.classList.remove("drag-over");
                }
            });

            container.addEventListener("drop", (e) => {
                e.preventDefault();
                container.classList.remove("drag-over");

                const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
                if (!leadId) return;

                const lead = Store.getLeadById(leadId);
                if (!lead || lead.stage === stage) return;

                // Execução direta e instantânea no CRM sem travar o Kanban
                CRM.executeDirectStageChange(leadId, stage);
            });
        });

        this._dragInitialized = true;
    },

    renderKanban() {
        let leads = Store.getLeads();
        
        const session = JSON.parse(localStorage.getItem("comercial_session"));
        if (session && session.role === "seller") {
            leads = leads.filter(l => l.owner === session.email);
        } else {
            const ownerSelect = document.getElementById("kanban-filter-owner");
            if (ownerSelect && ownerSelect.value && ownerSelect.value !== "all") {
                leads = leads.filter(l => l.owner === ownerSelect.value);
            }
        }

        // Filtro de busca por texto (Empresa, Contato, Cargo, Segmento, CNPJ)
        const searchInput = document.getElementById("kanban-search");
        const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
        if (searchQuery) {
            const cleanQueryDigits = searchQuery.replace(/\D/g, "");
            leads = leads.filter(l => {
                const comp = (l.company || "").toLowerCase();
                const cont = (l.contact || "").toLowerCase();
                const role = (l.role || "").toLowerCase();
                const seg = (l.segment || "").toLowerCase();
                const cnpj = (l.cnpj || "").toLowerCase();
                const cnpjDigits = (l.cnpj || "").replace(/\D/g, "");
                const matchesDigits = cleanQueryDigits.length >= 3 && cnpjDigits.includes(cleanQueryDigits);
                return comp.includes(searchQuery) || cont.includes(searchQuery) || role.includes(searchQuery) || seg.includes(searchQuery) || cnpj.includes(searchQuery) || matchesDigits;
            });
        }
        
        // Elementos das Colunas e Contadores
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

        const stageCounts = {
            "Contato": 0,
            "Lead Gerado": 0,
            "Lead Qualificado": 0,
            "Proposta Enviada": 0,
            "Negociação": 0,
            "Cliente Fechado": 0,
            "Cliente Perdido": 0
        };

        // Cache de dados (Executado apenas 1x fora do loop para máxima velocidade)
        const users = Store.getUsers();
        const userMap = new Map();
        users.forEach(u => {
            if (u && u.email) userMap.set(u.email, u);
        });

        const proposals = Store.getProposals();
        const leadValueMap = new Map();
        proposals.forEach(p => {
            if (p && p.leadId && p.status !== "Perdido") {
                leadValueMap.set(p.leadId, (leadValueMap.get(p.leadId) || 0) + (p.value || 0));
            }
        });

        let totalPipelineValue = 0;

        // Ordenação do Kanban
        const sortSelect = document.getElementById("kanban-filter-sort");
        const sortMode = sortSelect ? sortSelect.value : "recent-created";

        leads.sort((a, b) => {
            if (sortMode === "score-desc") {
                const scoreA = a.aiScore != null ? a.aiScore : 0;
                const scoreB = b.aiScore != null ? b.aiScore : 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
                return Store.getLeadTimestamp(b) - Store.getLeadTimestamp(a);
            }
            if (sortMode === "value-desc") {
                const valA = leadValueMap.get(a.id) || 0;
                const valB = leadValueMap.get(b.id) || 0;
                if (valB !== valA) return valB - valA;
                return Store.getLeadTimestamp(b) - Store.getLeadTimestamp(a);
            }
            if (sortMode === "company-asc") {
                return (a.company || "").localeCompare(b.company || "");
            }
            return Store.getLeadTimestamp(b) - Store.getLeadTimestamp(a);
        });

        // DocumentFragments para montagem em lote de alta performance (1 repaint por coluna)
        const fragments = {
            "Contato": document.createDocumentFragment(),
            "Lead Gerado": document.createDocumentFragment(),
            "Lead Qualificado": document.createDocumentFragment(),
            "Proposta Enviada": document.createDocumentFragment(),
            "Negociação": document.createDocumentFragment(),
            "Cliente Fechado": document.createDocumentFragment(),
            "Cliente Perdido": document.createDocumentFragment()
        };

        const now = Date.now();
        const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

        // Renderizar cada Lead
        leads.forEach(lead => {
            const stage = lead.stage;
            const fragment = fragments[stage];
            if (!fragment) return;

            stageCounts[stage]++;

            // Calcular dias sem contato
            let daysNoContact = 0;
            if (lead.interactions && lead.interactions.length > 0) {
                const sortedInts = [...lead.interactions].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                const diffTime = Math.abs(now - new Date(sortedInts[0].timestamp).getTime());
                daysNoContact = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } else if (lead.stageHistory && lead.stageHistory.length > 0) {
                const sortedHist = [...lead.stageHistory].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                const diffTime = Math.abs(now - new Date(sortedHist[0].timestamp).getTime());
                daysNoContact = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }

            const card = document.createElement("div");
            card.className = "kanban-card";
            card.setAttribute("draggable", "true");
            card.setAttribute("data-id", lead.id);

            let timeColor = "var(--text-muted)";
            if (daysNoContact >= 7 && stage !== "Cliente Fechado" && stage !== "Cliente Perdido") {
                timeColor = "var(--danger)";
            } else if (daysNoContact >= 3 && stage !== "Cliente Fechado" && stage !== "Cliente Perdido") {
                timeColor = "var(--warning)";
            }

            const leadValue = leadValueMap.get(lead.id) || 0;
            if (stage !== "Cliente Perdido") {
                totalPipelineValue += leadValue;
            }
            
            const ownerUser = userMap.get(lead.owner);
            const avatar = ownerUser ? ownerUser.avatar : "U";
            const ownerName = ownerUser ? ownerUser.name : "Indefinido";

            // Prioridade
            let priority = "Baixa";
            let priorityClass = "badge-priority-baixa"; 
            if (leadValue > 15000 || lead.segment === "Tecnologia") {
                priority = "Alta";
                priorityClass = "badge-priority-alta";
            } else if (leadValue > 5000 || lead.segment === "Construção Civil") {
                priority = "Média";
                priorityClass = "badge-priority-media";
            }

            // Score IA
            let aiScore = lead.aiScore != null ? lead.aiScore : 40;
            if (!lead.aiScore && lead.interactions) {
                const sdrInt = lead.interactions.find(i => i.description && i.description.includes("Score IA:"));
                if (sdrInt) {
                    const match = sdrInt.description.match(/Score IA:\s*(\d+)/i);
                    if (match) aiScore = parseInt(match[1]);
                }
            }

            let cardColor = "var(--primary, #6366f1)";
            let scoreIcon = "❄️", scoreLabel = "Baixa", scoreColor = "#6366f1";
            let scoreBg = "rgba(99, 102, 241, 0.12)", scoreBorder = "rgba(99, 102, 241, 0.3)";

            if (aiScore >= 75) {
                cardColor = "var(--danger, #ef4444)";
                scoreIcon = "🔥"; scoreLabel = "Alta"; scoreColor = "#ef4444";
                scoreBg = "rgba(239, 68, 68, 0.12)"; scoreBorder = "rgba(239, 68, 68, 0.3)";
            } else if (aiScore >= 45) {
                cardColor = "var(--warning, #f59e0b)";
                scoreIcon = "⚡"; scoreLabel = "Média"; scoreColor = "#f59e0b";
                scoreBg = "rgba(245, 158, 11, 0.12)"; scoreBorder = "rgba(245, 158, 11, 0.3)";
            }

            card.style.borderLeft = `3.5px solid ${cardColor}`;

            let tempBadge = "";
            if (stage !== "Cliente Fechado" && stage !== "Cliente Perdido") {
                tempBadge = `<span class="badge ai-score-badge" style="font-size: 9.5px; padding: 2px 7px; border-radius: 99px; background: ${scoreBg}; color: ${scoreColor}; border: 1px solid ${scoreBorder}; display: inline-flex; align-items: center; gap: 3px;" title="Score SDR Agent: ${aiScore}/100 — Prioridade ${scoreLabel}">${scoreIcon} <strong style='font-size:9.5px;'>${aiScore}</strong></span>`;
            }

            const fmtVal = leadValue > 0 ? currencyFmt.format(leadValue) : "";

            const scoreBarHtml = (stage !== "Cliente Fechado" && stage !== "Cliente Perdido") ? `
                <div style="margin: 2px 0 0 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <span style="font-size: 9px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;">Score IA</span>
                        <span style="font-size: 9.5px; font-weight: 800; color: ${scoreColor};">${aiScore}/100</span>
                    </div>
                    <div style="background: var(--border-color); border-radius: 99px; height: 4px; overflow: hidden;">
                        <div class="kanban-score-bar" style="width: ${aiScore}%; height: 100%; border-radius: 99px; background: linear-gradient(90deg, ${scoreColor}99, ${scoreColor});"></div>
                    </div>
                </div>
            ` : "";

            let coldLeadBanner = "";
            if (stage !== "Cliente Fechado" && stage !== "Cliente Perdido") {
                if (daysNoContact >= 7) {
                    coldLeadBanner = `
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); color: var(--danger); font-size: 10px; font-weight: 700; border-radius: 4px; padding: 4px 8px; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            Lead Frio - Retomar Contato!
                        </div>
                    `;
                } else if (daysNoContact >= 3) {
                    coldLeadBanner = `
                        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); color: var(--warning); font-size: 10px; font-weight: 700; border-radius: 4px; padding: 4px 8px; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Esfriando - Faça Contato
                        </div>
                    `;
                }
            }

            const compTitle = (lead.company && lead.company !== "null" && lead.company !== "---") ? lead.company : (lead.contact && lead.contact !== "null" ? lead.contact : "Lead sem identificação");
            const contSubtitle = (lead.contact && lead.contact !== "null" && lead.contact !== "---") ? lead.contact : "";
            const roleSubtitle = (lead.role && lead.role !== "null" && lead.role !== "---") ? lead.role : "";
            
            let contactLine = "";
            if (contSubtitle && roleSubtitle) {
                contactLine = `<div class="kanban-card-contact">${contSubtitle} • <span style="color:var(--text-muted); font-size:11px;">${roleSubtitle}</span></div>`;
            } else if (contSubtitle) {
                contactLine = `<div class="kanban-card-contact">${contSubtitle}</div>`;
            } else if (roleSubtitle) {
                contactLine = `<div class="kanban-card-contact" style="color:var(--text-muted); font-size:11px;">${roleSubtitle}</div>`;
            }

            const createdAtTs = Store.getLeadTimestamp ? Store.getLeadTimestamp(lead) : 0;
            const isRecent = createdAtTs > 0 && (now - createdAtTs) < 48 * 60 * 60 * 1000;
            const newBadge = isRecent ? `<span class="badge" style="font-size: 9px; font-weight: 700; background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); padding: 1.5px 5px; border-radius: 4px;" title="Cadastrado recentemente">✨ Novo</span>` : "";
            const regDateStr = createdAtTs > 0 ? new Date(createdAtTs).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

            card.innerHTML = `
                <div class="kanban-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <span class="badge ${priorityClass}" style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">${priority}</span>
                        ${tempBadge}
                        ${newBadge}
                    </div>
                    <div class="user-avatar" style="width: 20px; height: 20px; font-size: 9px; font-weight: 700; margin-left: auto; border: 1px solid var(--border-color); border-radius: 4px;" title="Responsável: ${ownerName}">
                        ${avatar}
                    </div>
                </div>
                <div class="kanban-card-company" style="font-size: 13.5px; font-weight: 600; color: #111827; line-height: 1.3;">${compTitle}</div>
                ${contactLine}
                
                ${leadValue > 0 ? `
                <div class="kanban-card-value" style="font-size: 13.5px; font-weight: 700; color: #111827; margin: 4px 0 2px 0;">
                    ${fmtVal}
                </div>
                ` : ""}
                
                ${scoreBarHtml}

                <div class="kanban-card-details" style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); border-top: 1px solid #F1F3F7; padding-top: 8px; margin-top: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="kanban-card-tag" style="background: #F3F4F6; border: 1px solid #E5E7EB; color: #4B5563; font-size: 10.5px; font-weight: 500; padding: 2px 6px; border-radius: 4px;">${lead.segment || 'Geral'}</span>
                        ${regDateStr ? `<span style="font-size: 10px; color: var(--text-muted);" title="Data de cadastro">📅 ${regDateStr}</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="kanban-card-time" style="color: ${timeColor}; font-size: 11px; font-weight: 500;">
                            🕒 ${daysNoContact === 0 ? 'Hoje' : `${daysNoContact}d`}
                        </span>
                        <button class="kanban-card-wa-btn" data-id="${lead.id}" onclick="event.stopPropagation(); window.WhatsApp?.openModalForLead('${lead.id}')" title="Enviar WhatsApp" style="background: none; border: none; cursor: pointer; color: #16A36A; display: flex; align-items: center; padding: 2px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </button>
                    </div>
                </div>
                ${coldLeadBanner}
            `;

            // Clique direto para detalhes do lead
            card.addEventListener("click", () => {
                CRM.openLeadDrawer(lead.id);
            });

            // Drag Start & End
            card.addEventListener("dragstart", (e) => {
                draggedLeadId = lead.id;
                e.dataTransfer.setData("text/plain", lead.id);
                e.dataTransfer.effectAllowed = "move";
                card.classList.add("dragging");
            });

            card.addEventListener("dragend", () => {
                card.classList.remove("dragging");
                document.querySelectorAll(".kanban-col-cards").forEach(col => col.classList.remove("drag-over"));
                draggedLeadId = null;
            });

            fragment.appendChild(card);
        });

        // Atualizar cada coluna no DOM em uma única operação
        Object.keys(columns).forEach(stage => {
            const container = columns[stage];
            if (!container) return;

            container.innerHTML = "";

            if (stageCounts[stage] === 0) {
                container.innerHTML = `
                    <div class="kanban-empty-column">
                        <div class="kanban-empty-icon">📭</div>
                        <span>Nenhum lead nesta etapa</span>
                    </div>
                `;
            } else {
                container.appendChild(fragments[stage]);
            }

            if (counters[stage]) {
                counters[stage].textContent = stageCounts[stage];
            }
        });

        // Atualizar resumo no topo do Kanban
        const totalLeadsEl = document.getElementById("kanban-summary-total-leads");
        if (totalLeadsEl) {
            totalLeadsEl.textContent = leads.length;
        }

        const totalValueEl = document.getElementById("kanban-summary-total-value");
        if (totalValueEl) {
            totalValueEl.textContent = currencyFmt.format(totalPipelineValue);
        }
    }
};
