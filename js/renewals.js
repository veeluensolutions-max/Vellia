import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";
import { COMPANY_PALETTES } from "./inspections.js";

export const Renewals = {
    _statusFilter: "priority", // priority (vencidas + alerta), vencida, alerta, valida, renovada, all
    _searchQuery: "",
    _serviceFilter: "all",
    _listenersBound: false,

    async init() {
        this.injectStyles();
        this.bindEvents();
        this.render();

        try {
            if (Store && typeof Store.syncFromSupabase === "function") {
                await Store.syncFromSupabase();
                this.render();
            }
        } catch (err) {
            console.warn("[Renewals] Aviso ao sincronizar com Supabase:", err);
        }
    },

    injectStyles() {
        if (document.getElementById("vellia-renewals-styles")) return;
        const style = document.createElement("style");
        style.id = "vellia-renewals-styles";
        style.textContent = `
            #view-renewals,
            #renewal-contact-modal {
                --ren-font-display: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                --ren-font-sans: 'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-family: var(--ren-font-sans);
                -webkit-font-smoothing: antialiased;
            }
            .ren-kpi-card {
                background: var(--bg-surface, #FFFFFF);
                border: 1px solid var(--border-color, #E2E8F0);
                border-radius: 14px;
                padding: 16px 18px;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .ren-kpi-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 3px;
                background: var(--ren-accent, #4F46E5);
            }
            .ren-kpi-card:hover,
            .ren-kpi-card.active {
                transform: translateY(-2px);
                border-color: var(--ren-accent, #4F46E5);
                box-shadow: 0 10px 24px -6px rgba(15, 23, 42, 0.08);
            }
            .ren-filter-pill {
                height: 34px;
                padding: 0 13px;
                border-radius: 99px;
                font-size: 12px;
                font-weight: 600;
                border: 1px solid var(--border-color, #E2E8F0);
                background: var(--bg-surface, #FFFFFF);
                color: var(--text-secondary, #64748B);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .ren-filter-pill:hover {
                border-color: #CBD5E1;
                color: var(--text-primary, #0F172A);
            }
            .ren-filter-pill.active {
                background: #4F46E5;
                border-color: #4F46E5;
                color: #FFFFFF;
                box-shadow: 0 3px 10px rgba(79, 70, 229, 0.22);
            }
            .ren-table-row {
                transition: background 0.15s ease;
            }
            .ren-table-row:hover {
                background: var(--bg-app, #F8FAFC);
            }
            .btn-ren-contact-primary {
                height: 34px;
                padding: 0 14px;
                border-radius: 9px;
                border: none;
                background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                color: #FFFFFF;
                font-family: var(--ren-font-sans);
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 3px 10px rgba(16, 185, 129, 0.22);
                transition: all 0.18s ease;
                white-space: nowrap;
            }
            .btn-ren-contact-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 14px rgba(16, 185, 129, 0.3);
            }
            .btn-ren-lead {
                height: 34px;
                padding: 0 12px;
                border-radius: 9px;
                border: 1px solid rgba(59, 130, 246, 0.35);
                background: rgba(59, 130, 246, 0.08);
                color: #2563EB;
                font-family: var(--ren-font-sans);
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.18s ease;
                white-space: nowrap;
            }
            .btn-ren-lead:hover {
                background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
                color: #FFFFFF;
                border-color: #2563EB;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
                transform: translateY(-1px);
            }
            .btn-ren-secondary {
                height: 34px;
                padding: 0 11px;
                border-radius: 9px;
                border: 1px solid var(--border-color, #E2E8F0);
                background: var(--bg-surface, #FFFFFF);
                color: var(--text-primary, #1E293B);
                font-family: var(--ren-font-sans);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .btn-ren-secondary:hover {
                border-color: #94A3B8;
                background: var(--bg-app, #F8FAFC);
            }
        `;
        document.head.appendChild(style);
    },

    bindEvents() {
        if (this._listenersBound) return;
        this._listenersBound = true;

        window.addEventListener("vellia:leadUpdated", () => {
            const view = document.getElementById("view-renewals");
            if (view && view.style.display !== "none") this.render();
        });
        window.addEventListener("vellia:cloudSynced", () => {
            const view = document.getElementById("view-renewals");
            if (view && view.style.display !== "none") this.render();
        });
    },

    getCompanyGradient(companyName, lead = null, itemMeta = null) {
        if (lead && (lead.companyColor || lead.color)) return lead.companyColor || lead.color;
        if (itemMeta && (itemMeta.companyColor || itemMeta.color)) return itemMeta.companyColor || itemMeta.color;
        const clean = String(companyName || "Empresa").trim().toUpperCase();
        let hash = 0;
        for (let i = 0; i < clean.length; i++) {
            hash = ((hash << 5) - hash) + clean.charCodeAt(i);
            hash |= 0;
        }
        const palettes = COMPANY_PALETTES || [{ gradient: "linear-gradient(135deg, #4F46E5, #6366F1)" }];
        return palettes[Math.abs(hash) % palettes.length].gradient;
    },

    getRenewalItems() {
        // Todos os vendedores e gestores têm acesso à base completa de clientes que possuem inspeções para renovar
        const allRawLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem("comercial_leads")) || []);
        const validLeads = allRawLeads.filter(l => l && !l.deleted_at && !(Store.isTestArtifactRecord && Store.isTestArtifactRecord(l)));

        const items = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        validLeads.forEach(lead => {
            if (!Array.isArray(lead.interactions)) return;
            const leadInspList = lead.interactions.filter(i => i && i.type === "Inspeção");
            if (leadInspList.length === 0) return;

            // Verificar última interação comercial (Ligação ou WhatsApp) feita neste lead
            const commercialInts = lead.interactions.filter(i => i && i.type !== "Inspeção" && i.timestamp);
            commercialInts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const lastComm = commercialInts[0] || null;

            leadInspList.forEach(item => {
                const executionDateStr = item.meta?.executionDate || item.timestamp?.split("T")[0] || new Date().toISOString().split("T")[0];
                let expiryDateStr = item.meta?.expiryDate;
                if (!expiryDateStr) {
                    const d = new Date(executionDateStr + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    expiryDateStr = d.toISOString().split("T")[0];
                }

                const expiryDate = new Date(expiryDateStr + "T12:00:00");
                expiryDate.setHours(0, 0, 0, 0);
                const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

                const successor = leadInspList.find(other =>
                    other.id !== item.id && (
                        other.meta?.renewedFromId === item.id ||
                        item.meta?.renewedToId === other.id
                    )
                );

                const isRenewed = Boolean(
                    item.meta?.isRenewed === true ||
                    item.meta?.status === "renovada" ||
                    item.meta?.renewedToId ||
                    successor
                );

                let status = "valida";
                if (daysRemaining < 0) {
                    status = isRenewed ? "renovada" : "vencida";
                } else if (daysRemaining <= 90) {
                    status = "alerta";
                } else {
                    status = "valida";
                }

                const contactName = (item.meta?.contact && item.meta.contact !== "Sem nome")
                    ? item.meta.contact
                    : (lead.contact || "Responsável Técnico");
                const phone = lead.whatsapp || lead.phone || lead.phone2 || item.meta?.phone || "";
                const email = lead.email || lead.email2 || item.meta?.email || "";
                const location = item.meta?.location || [lead.city, lead.state].filter(Boolean).join(" / ") || "";
                const serviceValue = parseFloat(item.meta?.serviceValue) || 4500;

                items.push({
                    id: item.id,
                    leadId: lead.id,
                    company: lead.company || "Empresa",
                    companyColor: this.getCompanyGradient(lead.company, lead, item.meta),
                    contact: contactName,
                    role: lead.role || "Responsável",
                    phone: phone,
                    email: email,
                    location: location,
                    inspectionNumber: item.meta?.inspectionNumber || item.meta?.number || "",
                    serviceName: item.meta?.serviceName || "Vistoria Técnica",
                    equipmentTag: item.meta?.equipmentTag || "",
                    serviceValue: serviceValue,
                    executionDate: executionDateStr,
                    expiryDate: expiryDateStr,
                    daysRemaining: daysRemaining,
                    status: status,
                    isRenewed: isRenewed,
                    owner: lead.owner || "sistema@vellia.com",
                    lastComm: lastComm
                });
            });
        });

        // Ordenar: 1º Vencidas (mais urgentes), 2º Críticas (< 90 dias), 3º No Prazo, 4º Já Renovadas
        const statusPriority = { vencida: 1, alerta: 2, valida: 3, renovada: 4 };
        items.sort((a, b) => {
            const pA = statusPriority[a.status] || 9;
            const pB = statusPriority[b.status] || 9;
            if (pA !== pB) return pA - pB;
            return a.daysRemaining - b.daysRemaining;
        });

        return items;
    },

    setFilter(status) {
        this._statusFilter = status;
        this.render();
    },

    setSearch(val) {
        this._searchQuery = (val || "").toLowerCase().trim();
        this.renderTableOnly();
    },

    setServiceFilter(val) {
        this._serviceFilter = val || "all";
        this.renderTableOnly();
    },

    updateSidebarBadge(items) {
        const badge = document.getElementById("menu-renewals-badge");
        if (!badge) return;
        const urgentCount = items.filter(i => i.status === "vencida" || i.status === "alerta").length;
        if (urgentCount > 0) {
            badge.textContent = urgentCount;
            badge.style.display = "inline-flex";
        } else {
            badge.style.display = "none";
        }
    },

    render() {
        const container = document.getElementById("renewals-main-container");
        if (!container) return;

        const allItems = this.getRenewalItems();
        this.updateSidebarBadge(allItems);

        const countExpired = allItems.filter(i => i.status === "vencida").length;
        const countCritical = allItems.filter(i => i.status === "alerta").length;
        const countPriority = countExpired + countCritical;
        const countValid = allItems.filter(i => i.status === "valida").length;
        const countRenewed = allItems.filter(i => i.status === "renovada").length;

        const uniqueServices = Array.from(new Set(allItems.map(i => i.serviceName).filter(Boolean))).sort();

        container.innerHTML = `
            <!-- Cabeçalho Comercial de Renovação de Inspeções -->
            <div class="vellia-card" style="padding: 22px 26px; margin-bottom: 18px; border-radius: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); flex-shrink: 0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <h2 style="margin: 0; font-family: var(--ren-font-display); font-size: 19px; font-weight: 700; color: var(--text-primary, #0F172A); letter-spacing: -0.025em;">
                                    Central Comercial de Renovação de Inspeções
                                </h2>
                                <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25);">
                                    Oportunidades da Base (${allItems.length})
                                </span>
                            </div>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary, #64748B);">
                                Acesse os clientes da base com inspeções vencidas ou próximas do vencimento e entre em contato em 1 clique para renovar.
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div style="position: relative; min-width: 270px;">
                            <input type="text" id="renewals-search-input" value="${this._searchQuery}" oninput="window.Renewals.setSearch(this.value)" placeholder="🔍 Buscar empresa, contato, serviço ou cidade..." style="width: 100%; height: 38px; padding: 0 14px; font-size: 12.5px; border-radius: 10px; border: 1px solid var(--border-color, #E2E8F0); background: var(--bg-app, #F8FAFC); color: var(--text-primary);">
                        </div>
                        <select id="renewals-service-select" onchange="window.Renewals.setServiceFilter(this.value)" style="height: 38px; padding: 0 12px; font-size: 12.5px; font-weight: 600; border-radius: 10px; border: 1px solid var(--border-color, #E2E8F0); background: var(--bg-surface, #FFFFFF); color: var(--text-primary); cursor: pointer;">
                            <option value="all" ${this._serviceFilter === 'all' ? 'selected' : ''}>Todos os Serviços / Laudos</option>
                            ${uniqueServices.map(s => `<option value="${s}" ${this._serviceFilter === s ? 'selected' : ''}>${s}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <!-- 4 KPI Cards Clicáveis -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 18px;">
                    <div class="ren-kpi-card ${this._statusFilter === 'priority' ? 'active' : ''}" style="--ren-accent: #E11D48;" onclick="window.Renewals.setFilter('priority')">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">Prioridade de Renovação</span>
                            <div style="font-family: var(--ren-font-display); font-size: 28px; font-weight: 800; color: #E11D48; line-height: 1.15; margin-top: 4px;">${countPriority}</div>
                            <span style="font-size: 11.5px; color: var(--text-muted);">Vencidas + Críticas (&lt; 90 dias)</span>
                        </div>
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(225, 29, 72, 0.1); color: #E11D48; display: flex; align-items: center; justify-content: center; font-size: 18px;">🔥</div>
                    </div>

                    <div class="ren-kpi-card ${this._statusFilter === 'vencida' ? 'active' : ''}" style="--ren-accent: #DC2626;" onclick="window.Renewals.setFilter('vencida')">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">Inspeções Vencidas</span>
                            <div style="font-family: var(--ren-font-display); font-size: 28px; font-weight: 800; color: #DC2626; line-height: 1.15; margin-top: 4px;">${countExpired}</div>
                            <span style="font-size: 11.5px; color: var(--text-muted);">Renovação imediata pendente</span>
                        </div>
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(220, 38, 38, 0.1); color: #DC2626; display: flex; align-items: center; justify-content: center; font-size: 18px;">🚨</div>
                    </div>

                    <div class="ren-kpi-card ${this._statusFilter === 'alerta' ? 'active' : ''}" style="--ren-accent: #D97706;" onclick="window.Renewals.setFilter('alerta')">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">Vencendo (&lt; 90 Dias)</span>
                            <div style="font-family: var(--ren-font-display); font-size: 28px; font-weight: 800; color: #D97706; line-height: 1.15; margin-top: 4px;">${countCritical}</div>
                            <span style="font-size: 11.5px; color: var(--text-muted);">Janela ideal de abordagem</span>
                        </div>
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(217, 119, 6, 0.1); color: #D97706; display: flex; align-items: center; justify-content: center; font-size: 18px;">⚠️</div>
                    </div>

                    <div class="ren-kpi-card ${this._statusFilter === 'valida' ? 'active' : ''}" style="--ren-accent: #059669;" onclick="window.Renewals.setFilter('valida')">
                        <div>
                            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);">Regulares / No Prazo</span>
                            <div style="font-family: var(--ren-font-display); font-size: 28px; font-weight: 800; color: #059669; line-height: 1.15; margin-top: 4px;">${countValid}</div>
                            <span style="font-size: 11.5px; color: var(--text-muted);">Mais de 90 dias de validade</span>
                        </div>
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(5, 150, 105, 0.1); color: #059669; display: flex; align-items: center; justify-content: center; font-size: 18px;">✅</div>
                    </div>
                </div>

                <!-- Pílulas de Filtro Rápido -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="ren-filter-pill ${this._statusFilter === 'priority' ? 'active' : ''}" onclick="window.Renewals.setFilter('priority')">
                        🔥 Prioridade Comercial (${countPriority})
                    </button>
                    <button type="button" class="ren-filter-pill ${this._statusFilter === 'vencida' ? 'active' : ''}" onclick="window.Renewals.setFilter('vencida')">
                        🔴 Vencidas (${countExpired})
                    </button>
                    <button type="button" class="ren-filter-pill ${this._statusFilter === 'alerta' ? 'active' : ''}" onclick="window.Renewals.setFilter('alerta')">
                        🟠 Vencendo em 90d (${countCritical})
                    </button>
                    <button type="button" class="ren-filter-pill ${this._statusFilter === 'valida' ? 'active' : ''}" onclick="window.Renewals.setFilter('valida')">
                        🟢 No Prazo (${countValid})
                    </button>
                    <button type="button" class="ren-filter-pill ${this._statusFilter === 'renovada' ? 'active' : ''}" onclick="window.Renewals.setFilter('renovada')">
                        🔄 Já Renovadas (${countRenewed})
                    </button>
                    <button type="button" class="ren-filter-pill ${this._statusFilter === 'all' ? 'active' : ''}" onclick="window.Renewals.setFilter('all')">
                        📋 Todas da Base (${allItems.length})
                    </button>
                </div>
            </div>

            <!-- Tabela de Leads com Inspeções para Renovar -->
            <div class="vellia-card" style="padding: 0; border-radius: 16px; overflow: hidden;">
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-app, #F8FAFC); border-bottom: 1px solid var(--border-color, #E2E8F0);">
                                <th style="padding: 13px 18px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Nome da Empresa & Serviço</th>
                                <th style="padding: 13px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Contato da Empresa</th>
                                <th style="padding: 13px 16px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Data de Vencimento da Inspeção</th>
                                <th style="padding: 13px 18px; text-align: right; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Ações Comerciais</th>
                            </tr>
                        </thead>
                        <tbody id="renewals-table-body">
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.renderTableOnly(allItems);
    },

    renderTableOnly(preloadedItems = null) {
        const tbody = document.getElementById("renewals-table-body");
        if (!tbody) return;

        const allItems = preloadedItems || this.getRenewalItems();
        const q = this._searchQuery;
        const sf = this._statusFilter;
        const srv = this._serviceFilter;

        const filtered = allItems.filter(item => {
            if (sf === "priority") {
                if (item.status !== "vencida" && item.status !== "alerta") return false;
            } else if (sf !== "all") {
                if (item.status !== sf) return false;
            }
            if (srv !== "all" && item.serviceName !== srv) return false;

            if (q) {
                const hay = `${item.company} ${item.contact} ${item.phone} ${item.email} ${item.serviceName} ${item.location} ${item.inspectionNumber}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="padding: 42px 20px; text-align: center; color: var(--text-muted); font-size: 13.5px;">
                        Nenhuma inspeção encontrada para este filtro. Clique em <strong>"Todas da Base"</strong> para ver todos os registros.
                    </td>
                </tr>
            `;
            return;
        }

        const fmtDateBr = (iso) => {
            if (!iso) return "—";
            const parts = iso.split("T")[0].split("-");
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
        };

        tbody.innerHTML = filtered.map(item => {
            const initials = (item.company || "EM").trim().substring(0, 2).toUpperCase();
            const expBr = fmtDateBr(item.expiryDate);
            const execBr = fmtDateBr(item.executionDate);

            let badgeHtml = "";
            let daysHtml = "";
            if (item.status === "vencida") {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: rgba(220, 38, 38, 0.1); color: #DC2626; border: 1px solid rgba(220, 38, 38, 0.25);">🔴 Vencida — Renovar</span>`;
                daysHtml = `<span style="font-size: 11.5px; font-weight: 700; color: #DC2626;">Vencida há ${Math.abs(item.daysRemaining)} dias</span>`;
            } else if (item.status === "alerta") {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: rgba(217, 119, 6, 0.12); color: #D97706; border: 1px solid rgba(217, 119, 6, 0.28);">🟠 Vence em breve</span>`;
                daysHtml = `<span style="font-size: 11.5px; font-weight: 700; color: #D97706;">Faltam ${item.daysRemaining} dias</span>`;
            } else if (item.status === "renovada") {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: rgba(37, 99, 235, 0.1); color: #2563EB; border: 1px solid rgba(37, 99, 235, 0.25);">🔄 Ciclo Renovado</span>`;
                daysHtml = `<span style="font-size: 11.5px; font-weight: 600; color: #2563EB;">Renovação emitida</span>`;
            } else {
                badgeHtml = `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: rgba(5, 150, 105, 0.1); color: #059669; border: 1px solid rgba(5, 150, 105, 0.25);">🟢 No Prazo</span>`;
                daysHtml = `<span style="font-size: 11.5px; font-weight: 600; color: #059669;">Vence em ${item.daysRemaining} dias</span>`;
            }

            const hasPhone = Boolean(item.phone && item.phone.trim());
            const lastCommStr = item.lastComm
                ? `Último contato: ${item.lastComm.type} em ${new Date(item.lastComm.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
                : "";

            return `
                <tr class="ren-table-row" style="border-bottom: 1px solid var(--border-color, #F1F5F9);">
                    <!-- Coluna 1: Nome da Empresa & Serviço -->
                    <td style="padding: 14px 18px; min-width: 260px;">
                        <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 10px; background: ${item.companyColor}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-family: var(--ren-font-display); font-weight: 700; font-size: 13px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);">
                                ${initials}
                            </div>
                            <div style="min-width: 0;">
                                <div onclick="window.CRM?.openLeadDrawer('${item.leadId}')" style="cursor: pointer; font-family: var(--ren-font-display); font-size: 14px; font-weight: 700; color: var(--text-primary, #0F172A); line-height: 1.25;" title="Clique para abrir a ficha completa da empresa">
                                    ${item.company}
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                                    <span style="font-size: 11.5px; font-weight: 600; color: #4F46E5; background: rgba(79, 70, 229, 0.08); padding: 2px 8px; border-radius: 6px;">
                                        🔬 ${item.serviceName}
                                    </span>
                                    ${item.inspectionNumber ? `<span style="font-size: 11px; font-family: monospace; color: var(--text-muted); background: var(--bg-app); padding: 1.5px 6px; border-radius: 5px; border: 1px solid var(--border-color);">${item.inspectionNumber}</span>` : ''}
                                </div>
                                ${item.location ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">📍 ${item.location}</div>` : ''}
                            </div>
                        </div>
                    </td>

                    <!-- Coluna 2: Contato da Empresa -->
                    <td style="padding: 14px 16px; min-width: 220px;">
                        <div style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary, #1E293B); display: flex; align-items: center; gap: 6px;">
                                <span>👤</span>
                                <span>${item.contact}</span>
                            </div>
                            ${hasPhone ? `
                                <div style="display: flex; align-items: center; gap: 6px; margin-top: 1px;">
                                    <span style="font-size: 12.5px; font-weight: 700; color: #059669; font-family: monospace;">📱 ${item.phone}</span>
                                    <button type="button" onclick="navigator.clipboard.writeText('${item.phone.replace(/'/g, "")}'); if(window.Toast) window.Toast.show('Telefone copiado!', 'success');" style="font-size: 10.5px; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer;" title="Copiar telefone">📋</button>
                                </div>
                            ` : `
                                <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                    <span style="font-size: 11.5px; color: #D97706; font-weight: 600;">⚠️ Sem telefone cadastrado</span>
                                    <button type="button" onclick="window.Renewals.openContactModal('${item.leadId}', '${item.id}')" style="font-size: 11px; font-weight: 700; color: #4F46E5; background: rgba(79,70,229,0.08); border: 1px solid rgba(79,70,229,0.25); border-radius: 6px; padding: 1px 7px; cursor: pointer;">+ Adicionar</button>
                                </div>
                            `}
                            ${item.email ? `<div style="font-size: 11.5px; color: var(--text-secondary);">✉️ ${item.email}</div>` : ''}
                            ${lastCommStr ? `<div style="font-size: 10.5px; color: #059669; font-weight: 600; margin-top: 2px;">✓ ${lastCommStr}</div>` : ''}
                        </div>
                    </td>

                    <!-- Coluna 3: Data que vai Vencer a Inspeção -->
                    <td style="padding: 14px 16px; min-width: 210px;">
                        <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-family: var(--ren-font-display); font-size: 14.5px; font-weight: 700; color: var(--text-primary, #0F172A);">
                                    📅 ${expBr}
                                </span>
                                ${badgeHtml}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-muted);">
                                ${daysHtml}
                                <span>&bull;</span>
                                <span>Realizada em ${execBr}</span>
                            </div>
                        </div>
                    </td>

                    <!-- Coluna 4: Botão para Contactar o Cliente e Mover para Leads -->
                    <td style="padding: 14px 18px; text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 7px;">
                            <button type="button" class="btn-ren-lead" onclick="window.Renewals.moveToLeadsAndOpenInteractions('${item.leadId}', '${item.id}')" title="Mover contato para a esteira de Leads e abrir registro de interações">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                                <span>Mover p/ Leads</span>
                            </button>

                            <button type="button" class="btn-ren-contact-primary" onclick="window.Renewals.openContactModal('${item.leadId}', '${item.id}')" title="Abordar cliente para renovação da inspeção">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                <span>Contactar Cliente</span>
                            </button>

                            <button type="button" class="btn-ren-secondary" onclick="window.Renewals.quickCallForRenewal('${item.leadId}')" title="Registrar Ligação em 2 Segundos">
                                <span>📞</span>
                                <span>Ligação</span>
                            </button>

                            <button type="button" class="btn-ren-secondary" onclick="window.Renewals.openProposalForRenewal('${item.leadId}', '${item.id}')" title="Gerar Proposta Comercial de Renovação">
                                <span>📝</span>
                                <span>Proposta</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    },

    claimLeadIfSystemOwned(leadId) {
        const curUser = Auth.getCurrentUser();
        if (!curUser || !leadId) return;
        const lead = Store.getLeadById ? Store.getLeadById(leadId) : null;
        if (!lead) return;
        const curOwner = (lead.owner || "").toLowerCase().trim();
        // Se o lead estava sem vendedor ("sistema@vellia.com" ou vazio) e um vendedor iniciou o atendimento de renovação, vincula à carteira dele
        if ((!curOwner || curOwner === "sistema@vellia.com") && (curUser.role === "seller" || curUser.role === "vendedor")) {
            Store.updateLead(leadId, { owner: curUser.email }, curUser.email);
        }
    },

    moveToLeadsAndOpenInteractions(leadId, inspectionId) {
        const curUser = Auth.getCurrentUser();
        const userEmail = (curUser?.email || "sistema@vellia.com").toLowerCase().trim();
        const userName = curUser?.name || "Consultor Comercial";

        const allItems = this.getRenewalItems();
        const item = allItems.find(i => i.id === inspectionId) || allItems.find(i => String(i.leadId) === String(leadId));

        let lead = Store.getLeadById ? Store.getLeadById(leadId) : null;
        if (!lead && item) {
            const allLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (Store.getLeads() || []);
            lead = allLeads.find(l => String(l.id) === String(leadId)) || 
                   allLeads.find(l => l.company && item.company && l.company.toLowerCase().trim() === item.company.toLowerCase().trim());
        }

        const expParts = (item?.expiryDate || "").split("T")[0].split("-");
        const expBr = expParts.length === 3 ? `${expParts[2]}/${expParts[1]}/${expParts[0]}` : (item?.expiryDate || "A vencer");
        const serviceLabel = item?.serviceName || "Inspeção Técnica";
        const inspectionNum = item?.inspectionNumber ? ` (${item.inspectionNumber})` : "";

        if (!lead && item) {
            // Criar lead caso não exista na base local
            const newLeadId = leadId || ("lead-" + Date.now());
            const newLead = {
                id: newLeadId,
                company: item.company,
                contact: item.contact,
                phone: item.phone,
                whatsapp: item.phone,
                email: item.email,
                city: item.location?.split("/")[0]?.trim() || "",
                state: item.location?.split("/")[1]?.trim() || "",
                segment: serviceLabel,
                source: "Central de Renovações",
                stage: "Contato",
                owner: userEmail,
                createdBy: userEmail,
                workspace: localStorage.getItem("activeCompany") || "Veeluen Solutions",
                interactions: [
                    {
                        id: "int-" + Date.now(),
                        type: "Nota",
                        description: `🔄 Contato importado da Central de Renovações para início de ciclo comercial. Serviço: ${serviceLabel}${inspectionNum} • Vencimento: ${expBr}. Responsável: ${userName}.`,
                        author: userEmail,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
            if (Store.addLead) {
                Store.addLead(newLead, userEmail);
            } else if (Store.createLead) {
                Store.createLead(newLead, userEmail);
            }
            lead = newLead;
        } else if (lead) {
            // Se o lead existe, garantir atribuição ao vendedor e reativar estágio para "Contato" se estiver fechado ou sem estágio
            const updates = {};
            const curOwner = (lead.owner || "").toLowerCase().trim();
            if (!curOwner || curOwner === "sistema@vellia.com" || (curUser?.role === "seller" && curOwner !== userEmail)) {
                updates.owner = userEmail;
            }

            // Se estava como Cliente Fechado, Contrato ou Perdido, reativar no funil em "Contato"
            if (!lead.stage || lead.stage === "Cliente Fechado" || lead.stage === "Contrato" || lead.stage === "Cliente Perdido") {
                updates.stage = "Contato";
            }

            if (Object.keys(updates).length > 0) {
                Store.updateLead(lead.id, updates, userEmail);
            }

            // Registrar interação de movimentação
            Store.addLeadInteraction(lead.id, userEmail, {
                type: "Nota",
                description: `🔄 Contato movimentado da Central de Renovações para a esteira comercial de Leads. Serviço a renovar: ${serviceLabel}${inspectionNum} • Vencimento da inspeção: ${expBr}. Atendimento assumido por ${userName}.`
            });
        }

        const targetLeadId = lead ? lead.id : leadId;

        // Disparar atualização para tabela e Kanban de leads
        window.dispatchEvent(new CustomEvent("vellia:leadUpdated", { detail: { leadId: targetLeadId } }));
        if (window.CRM && typeof window.CRM.renderLeadsTable === "function") {
            window.CRM.renderLeadsTable();
        }

        // 1. Navegar para a tela de Contatos & Leads
        window.location.hash = "#crm";
        const menuCrm = document.getElementById("menu-crm");
        if (menuCrm) {
            menuCrm.click();
        }

        // 2. Abrir o Drawer de detalhes do Lead com foco direto na aba de Interações
        setTimeout(() => {
            if (window.CRM && typeof window.CRM.openLeadDrawer === "function") {
                window.CRM.openLeadDrawer(targetLeadId);
                if (typeof window.CRM.switchDrawerTab === "function") {
                    window.CRM.switchDrawerTab("followup");
                }

                // Rolar suavemente até o formulário de registrar interação
                const formSection = document.getElementById("drawer-interaction-section");
                if (formSection) {
                    formSection.scrollIntoView({ behavior: "smooth", block: "center" });
                    const descInput = document.getElementById("interaction-description");
                    if (descInput) {
                        setTimeout(() => {
                            descInput.focus();
                            descInput.placeholder = `Registrar interação de renovação (${serviceLabel})...`;
                        }, 150);
                    }
                }
            }

            if (window.Toast) {
                window.Toast.show(`Lead "${lead?.company || 'Contato'}" movimentado para sua esteira! Registre sua interação abaixo.`, "success");
            }
        }, 220);
    },

    quickCallForRenewal(leadId) {
        this.claimLeadIfSystemOwned(leadId);
        const curUser = Auth.getCurrentUser();
        window.Dashboard?.openQuickCallModal(curUser?.email || "", leadId);
    },

    openProposalForRenewal(leadId, inspectionId) {
        this.claimLeadIfSystemOwned(leadId);
        const allItems = this.getRenewalItems();
        const item = allItems.find(i => i.id === inspectionId) || allItems.find(i => String(i.leadId) === String(leadId));
        const lead = Store.getLeadById ? Store.getLeadById(leadId) : null;
        if (!lead) return;

        const suggestedService = item?.serviceName || "Amostragem Isocinética de Chaminé";
        const suggestedPrice = item?.serviceValue || 4500;

        window.location.hash = "#proposals";
        setTimeout(() => {
            window.Proposals?.openBudgetScreen(null, lead, suggestedService, suggestedPrice, {
                company: lead.company,
                contact: item?.contact || lead.contact || "",
                serviceDetails: `Renovação de ${suggestedService}${item?.inspectionNumber ? ` (Ref: ${item.inspectionNumber})` : ""}`
            });
        }, 150);
    },

    openContactModal(leadId, inspectionId) {
        this.injectStyles();
        const allItems = this.getRenewalItems();
        const item = allItems.find(i => i.id === inspectionId) || allItems.find(i => String(i.leadId) === String(leadId));
        const lead = Store.getLeadById ? Store.getLeadById(leadId) : null;
        if (!item || !lead) return;

        const curUser = Auth.getCurrentUser();
        const sellerName = curUser?.name || "Consultor Comercial";
        const expParts = (item.expiryDate || "").split("T")[0].split("-");
        const expBr = expParts.length === 3 ? `${expParts[2]}/${expParts[1]}/${expParts[0]}` : item.expiryDate;

        const statusText = item.daysRemaining < 0
            ? `venceu em ${expBr}`
            : `vence em ${expBr} (daqui a ${item.daysRemaining} dias)`;

        const defaultWaMessage = `Olá ${item.contact && item.contact !== "Responsável Técnico" ? item.contact : "tudo bem"}! Aqui é ${sellerName}, da equipe comercial.\n\nIdentificamos em nosso controle técnico que *${item.serviceName}* da empresa *${item.company}* ${statusText}.\n\nGostaria de verificar com você a programação para realizarmos a renovação dentro do prazo e enviarmos a proposta comercial atualizada. Podemos alinhar por aqui ou por uma breve ligação?`;

        let modal = document.getElementById("renewal-contact-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "renewal-contact-modal";
            modal.style.cssText = "position: fixed; inset: 0; background: rgba(15, 23, 42, 0.62); backdrop-filter: blur(5px); z-index: 3150; display: flex; align-items: center; justify-content: center; padding: 16px;";
            modal.addEventListener("click", (e) => {
                if (e.target === modal) modal.style.display = "none";
            });
            document.body.appendChild(modal);
        }

        modal.style.display = "flex";
        modal.innerHTML = `
            <div style="background: var(--bg-surface, #FFFFFF); border: 1px solid var(--border-color, #E2E8F0); border-radius: 18px; width: 100%; max-width: 580px; box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.4); overflow: hidden;">
                <!-- Header -->
                <div style="padding: 16px 22px; border-bottom: 1px solid var(--border-color, #E2E8F0); display: flex; align-items: center; justify-content: space-between; background: var(--bg-app, #F8FAFC);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 11px; background: ${item.companyColor}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                            ${(item.company || "EM").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h3 style="margin: 0; font-family: var(--ren-font-display); font-size: 16px; font-weight: 700; color: var(--text-primary);">
                                Contactar Cliente para Renovação
                            </h3>
                            <span style="font-size: 12px; color: var(--text-secondary);">
                                ${item.company} &bull; Vencimento: <strong style="color: ${item.daysRemaining < 0 ? '#DC2626' : '#D97706'};">${expBr}</strong>
                            </span>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('renewal-contact-modal').style.display='none'" style="width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); font-size: 18px; color: var(--text-secondary); cursor: pointer;">&times;</button>
                </div>

                <!-- Body -->
                <div style="padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; max-height: 82vh; overflow-y: auto;">
                    <!-- Resumo do Laudo a Renovar -->
                    <div style="padding: 11px 14px; border-radius: 10px; background: rgba(79, 70, 229, 0.06); border: 1px solid rgba(79, 70, 229, 0.2); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <span style="font-size: 10.5px; font-weight: 700; color: #4F46E5; text-transform: uppercase; display: block;">Serviço / Inspeção a Renovar</span>
                            <span style="font-size: 13.5px; font-weight: 700; color: var(--text-primary);">🔬 ${item.serviceName} ${item.inspectionNumber ? `(${item.inspectionNumber})` : ''}</span>
                        </div>
                        <span style="font-size: 12px; font-weight: 700; color: ${item.daysRemaining < 0 ? '#DC2626' : '#D97706'}; background: #FFFFFF; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                            📅 Vence: ${expBr}
                        </span>
                    </div>

                    <!-- Dados de Contato da Empresa (Editáveis para atualizar na hora se necessário) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Nome do Contato na Empresa</label>
                            <input type="text" id="ren-modal-contact" class="form-control" value="${item.contact}" placeholder="Ex: Carlos / Eng. Ambiental" style="width: 100%; height: 38px; font-size: 13px; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">WhatsApp / Telefone *</label>
                            <input type="text" id="ren-modal-phone" class="form-control" value="${item.phone}" placeholder="(81) 99999-9999" style="width: 100%; height: 38px; font-size: 13px; border-radius: 8px; font-weight: 700;">
                        </div>
                    </div>

                    <!-- Mensagem Personalizada de Renovação -->
                    <div>
                        <label style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; display: block; margin-bottom: 5px;">
                            💬 Mensagem Pronta de Abordagem (WhatsApp)
                        </label>
                        <textarea id="ren-modal-wa-text" class="form-control" style="width: 100%; min-height: 115px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5; border-radius: 10px;">${defaultWaMessage}</textarea>
                    </div>

                    <!-- Ações Rápidas para o Vendedor -->
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-color);">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" id="btn-ren-modal-move-lead" class="btn-ren-lead" style="height: 38px; padding: 0 13px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                                <span>Mover p/ Leads & Interações</span>
                            </button>
                            <button type="button" id="btn-ren-modal-log-call" class="btn-ren-secondary" style="height: 38px; padding: 0 13px; border-color: rgba(16,185,129,0.4); color: #059669; font-weight: 700;">
                                📞 Registrar Ligação
                            </button>
                            <button type="button" id="btn-ren-modal-open-prop" class="btn-ren-secondary" style="height: 38px; padding: 0 13px; border-color: rgba(124,58,237,0.4); color: #6D28D9; font-weight: 700;">
                                📝 Gerar Proposta
                            </button>
                            <button type="button" id="btn-ren-modal-save-contact" class="btn-ren-secondary" style="height: 38px; padding: 0 12px;">
                                💾 Salvar Contato
                            </button>
                        </div>

                        <button type="button" id="btn-ren-modal-send-wa" class="btn-ren-contact-primary" style="height: 40px; padding: 0 18px; font-size: 13px;">
                            <span>💬 Chamar no WhatsApp</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const saveUpdatedContactInfo = () => {
            const newContact = document.getElementById("ren-modal-contact")?.value.trim() || item.contact;
            const newPhone = document.getElementById("ren-modal-phone")?.value.trim() || item.phone;
            const updates = { contact: newContact };
            if (newPhone) {
                updates.whatsapp = newPhone;
                if (!lead.phone) updates.phone = newPhone;
            }
            this.claimLeadIfSystemOwned(leadId);
            Store.updateLead(leadId, updates, curUser?.email || "sistema@vellia.com");
            return { newContact, newPhone };
        };

        const btnMoveModalLead = document.getElementById("btn-ren-modal-move-lead");
        if (btnMoveModalLead) {
            btnMoveModalLead.onclick = () => {
                saveUpdatedContactInfo();
                modal.style.display = "none";
                this.moveToLeadsAndOpenInteractions(leadId, inspectionId);
            };
        }

        document.getElementById("btn-ren-modal-save-contact").onclick = () => {
            saveUpdatedContactInfo();
            this.render();
            if (window.Toast) window.Toast.show("Dados de contato atualizados no cliente!", "success");
        };

        document.getElementById("btn-ren-modal-log-call").onclick = () => {
            saveUpdatedContactInfo();
            modal.style.display = "none";
            this.quickCallForRenewal(leadId);
        };

        document.getElementById("btn-ren-modal-open-prop").onclick = () => {
            saveUpdatedContactInfo();
            modal.style.display = "none";
            this.openProposalForRenewal(leadId, inspectionId);
        };

        document.getElementById("btn-ren-modal-send-wa").onclick = () => {
            const { newPhone } = saveUpdatedContactInfo();
            const msg = document.getElementById("ren-modal-wa-text")?.value.trim() || defaultWaMessage;
            const digits = (newPhone || "").replace(/\D/g, "");
            if (!digits) {
                alert("Por favor, preencha o número de WhatsApp / Telefone da empresa no campo acima para iniciar a conversa.");
                document.getElementById("ren-modal-phone")?.focus();
                return;
            }
            const fullNum = digits.startsWith("55") ? digits : `55${digits}`;

            // Registrar interação de contato de renovação no lead
            Store.addLeadInteraction(leadId, curUser?.email || "sistema@vellia.com", {
                type: "WhatsApp",
                description: `🔄 Abordagem de Renovação (${item.serviceName} - Venc: ${expBr}): ${msg.substring(0, 120)}...`
            });

            modal.style.display = "none";
            this.render();
            window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`, "_blank");
        };
    }
};

if (typeof window !== "undefined") {
    window.Renewals = Renewals;
}
