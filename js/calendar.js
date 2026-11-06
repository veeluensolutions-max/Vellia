/**
 * Vellia — Agenda & Calendário Visual de Vistorias e Reuniões
 * Módulo de agendamento interativo com separação por Empresa (Veeluen Solutions / Excelência Ambiental)
 * e integração com Leads, Tarefas, Inspeções e Lembretes de WhatsApp.
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const Calendar = {
    currentDate: new Date(),
    selectedDateStr: null,
    filterType: "all",
    filterStatus: "all",
    selectedCompany: localStorage.getItem("activeCompany") || "Veeluen Solutions",

    init() {
        if (!this.selectedCompany) {
            this.selectedCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        }
        this.render();
        this.renderRemindersWidget();
        this.bindEvents();
    },

    // ─── Normalização do Nome da Empresa ─────────────────────────────────────────
    normalizeCompany(name) {
        if (!name) return "Veeluen Solutions";
        const str = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (str.includes("excelencia") || str.includes("ambiental")) {
            return "Excelência Ambiental";
        }
        return "Veeluen Solutions";
    },

    // ─── Alternar Empresa Ativa no Calendário ────────────────────────────────────
    setCompany(companyName) {
        this.selectedCompany = companyName;
        this.render();
        this.renderRemindersWidget();
    },

    // ─── Obter todos os eventos compilados do sistema ────────────────────────────
        getEvents() {
        const events = [];
        let allLeads = [];
        try {
            allLeads = (typeof Store.getAllLeadsRaw === "function" ? Store.getAllLeadsRaw() : Store.getLeads())
                .filter(l => !l.deleted_at);
        } catch(e) {
            allLeads = Store.getLeads() || [];
        }

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "";

        // 1. Inspeções e Vistorias
        allLeads.forEach(lead => {
            const leadWs = this.normalizeCompany(lead.workspace);

            if (lead.interactions && Array.isArray(lead.interactions)) {
                lead.interactions.forEach(item => {
                    if (item.type === "Inspeção" || item.type === "Inspecao") {
                        const dateStr = item.meta?.executionDate || item.timestamp?.split("T")[0];
                        if (dateStr) {
                            events.push({
                                id: item.id || `insp_${Math.random()}`,
                                leadId: lead.id,
                                company: lead.company,
                                workspace: leadWs,
                                title: `📋 Vistoria: ${item.meta?.serviceName || "Inspeção Técnica"}`,
                                date: dateStr,
                                time: "09:00",
                                type: "inspecao",
                                status: "concluido",
                                notes: item.meta?.notes || item.description || "",
                                executionDate: item.meta?.executionDate || dateStr,
                                expiryDate: item.meta?.expiryDate || "",
                                contact: lead.contact || lead.name || "",
                                phone: lead.whatsapp || lead.phone || "",
                                email: lead.email || "",
                                cnpj: lead.cnpj || "",
                                city: lead.city || "",
                                state: lead.state || "",
                                address: lead.address || "",
                                value: lead.value || 0,
                                pipelineStatus: lead.status || ""
                            });
                        }

                        // Evento de Vencimento
                        const expiryStr = item.meta?.expiryDate;
                        if (expiryStr) {
                            events.push({
                                id: `expiry_${item.id}`,
                                leadId: lead.id,
                                company: lead.company,
                                workspace: leadWs,
                                title: `⚠️ Vencimento: ${item.meta?.serviceName || "Inspeção"}`,
                                date: expiryStr,
                                time: "12:00",
                                type: "vencimento",
                                status: "agendado",
                                notes: `Vencimento do laudo técnico de ${lead.company}`,
                                executionDate: item.meta?.executionDate || "",
                                expiryDate: expiryStr,
                                contact: lead.contact || lead.name || "",
                                phone: lead.whatsapp || lead.phone || "",
                                email: lead.email || "",
                                cnpj: lead.cnpj || "",
                                city: lead.city || "",
                                state: lead.state || "",
                                address: lead.address || "",
                                value: lead.value || 0,
                                pipelineStatus: lead.status || ""
                            });
                        }
                    }
                });
            }

            // 2. Follow-ups agendados
            if (lead.followups && Array.isArray(lead.followups)) {
                lead.followups.forEach(f => {
                    if (f.scheduledAt) {
                        const [dPart, tPart] = f.scheduledAt.split("T");
                        events.push({
                            id: f.id || `fup_${Math.random()}`,
                            leadId: lead.id,
                            company: lead.company,
                            workspace: leadWs,
                            title: `⏰ Follow-up: ${lead.company}`,
                            date: dPart,
                            time: tPart ? tPart.substring(0, 5) : "14:00",
                            type: "followup",
                            status: f.done ? "concluido" : "agendado",
                            notes: f.note || "",
                            contact: lead.contact || lead.name || "",
                            phone: lead.whatsapp || lead.phone || "",
                            email: lead.email || "",
                            cnpj: lead.cnpj || "",
                            city: lead.city || "",
                            state: lead.state || "",
                            address: lead.address || "",
                            value: lead.value || 0,
                            pipelineStatus: lead.status || ""
                        });
                    }
                });
            }
        });

        // 3. Compromissos Personalizados da Agenda
        try {
            const customEvents = Store.getCalendarEvents();
            customEvents.forEach(e => {
                let ws = e.workspace;
                const matchedLead = allLeads.find(l => 
                    (e.leadId && String(l.id) === String(e.leadId)) || 
                    (l.company && e.company && l.company.toLowerCase().trim() === e.company.toLowerCase().trim())
                );
                if (!ws) {
                    ws = matchedLead ? matchedLead.workspace : "Veeluen Solutions";
                }
                events.push({
                    ...e,
                    leadId: e.leadId || (matchedLead ? matchedLead.id : null),
                    contact: e.contact || (matchedLead ? (matchedLead.contact || matchedLead.name) : ""),
                    phone: e.phone || (matchedLead ? (matchedLead.whatsapp || matchedLead.phone) : ""),
                    email: e.email || (matchedLead ? matchedLead.email : ""),
                    cnpj: e.cnpj || (matchedLead ? matchedLead.cnpj : ""),
                    city: e.city || (matchedLead ? matchedLead.city : ""),
                    state: e.state || (matchedLead ? matchedLead.state : ""),
                    address: e.address || (matchedLead ? matchedLead.address : ""),
                    value: e.value || (matchedLead ? matchedLead.value : 0),
                    pipelineStatus: matchedLead ? matchedLead.status : "",
                    workspace: this.normalizeCompany(ws)
                });
            });
        } catch (e) {}

        return events;
    },

// ─── Renderizar Interface da Agenda ──────────────────────────────────────────
    render() {
        const container = document.getElementById("calendar-view-container");
        if (!container) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const monthNames = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];

        const allEvents = this.getEvents();

        // Contagens por empresa para exibir nos botões
        const veeluenTotal = allEvents.filter(e => this.normalizeCompany(e.workspace) === "Veeluen Solutions").length;
        const excelenciaTotal = allEvents.filter(e => this.normalizeCompany(e.workspace) === "Excelência Ambiental").length;
        const grandTotal = allEvents.length;

        // Aplicar filtros: Tipo, Status e Empresa
        const filteredEvents = allEvents.filter(e => {
            const matchType = this.filterType === "all" || e.type === this.filterType;
            const matchStatus = this.filterStatus === "all" || e.status === this.filterStatus;
            const matchCompany = !this.selectedCompany || this.selectedCompany === "all" 
                || this.normalizeCompany(e.workspace) === this.normalizeCompany(this.selectedCompany);
            return matchType && matchStatus && matchCompany;
        });

        // Agrupar eventos por data YYYY-MM-DD
        const eventsByDate = {};
        filteredEvents.forEach(e => {
            if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
            eventsByDate[e.date].push(e);
        });

        const todayStr = new Date().toISOString().split("T")[0];

        // Montar grade de dias
        let dayCellsHtml = "";
        
        // Dias do mês anterior
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            dayCellsHtml += `<div class="calendar-day other-month"><span class="day-num">${dayNum}</span></div>`;
        }

        // Dias do mês atual
        for (let day = 1; day <= daysInMonth; day++) {
            const mStr = String(month + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const dateKey = `${year}-${mStr}-${dStr}`;

            const isToday = dateKey === todayStr;
            const isSelected = dateKey === this.selectedDateStr;
            const dayEvents = eventsByDate[dateKey] || [];

                        let badgesHtml = dayEvents.slice(0, 3).map(ev => {
                let badgeBg = "#1877F2";
                if (ev.type === "inspecao") badgeBg = "#10b981";
                if (ev.type === "vencimento") badgeBg = "#ef4444";
                if (ev.type === "followup") badgeBg = "#f59e0b";
                if (ev.type === "reuniao") badgeBg = "#8b5cf6";
                if (ev.status === "bloqueado") badgeBg = "#475569";
                if (ev.status === "pendente") badgeBg = "#f97316";

                const isExcelencia = this.normalizeCompany(ev.workspace) === "Excelência Ambiental";
                const companyDot = `<span style="font-size:9.5px; opacity:0.95;">${isExcelencia ? '🌿' : '🏢'}</span>`;

                return `
                    <div class="calendar-event-pill" 
                         onclick="event.stopPropagation(); window.Calendar.showEventDetails('${ev.id}')" 
                         style="background:${badgeBg}; color:#fff; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;" 
                         onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.25)';"
                         onmouseout="this.style.transform='none'; this.style.boxShadow='none';"
                         title="Clique para ver os dados do cliente agendado (${ev.company})">
                        ${companyDot} ${ev.title}
                    </div>
                `;
            }).join("");

            if (dayEvents.length > 3) {
                badgesHtml += `<div style="font-size:10px; color:var(--text-muted); font-weight:700; text-align:right;">+${dayEvents.length - 3} mais</div>`;
            }

            dayCellsHtml += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateKey}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="day-num">${day}</span>
                        ${dayEvents.length > 0 ? `<span class="event-count-badge">${dayEvents.length}</span>` : ''}
                    </div>
                    <div class="calendar-events-list">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        }

        // Preencher resto da grade para 42 células (6 semanas)
        const totalCellsSoFar = firstDayOfMonth + daysInMonth;
        const nextMonthDays = 42 - totalCellsSoFar;
        for (let day = 1; day <= nextMonthDays; day++) {
            dayCellsHtml += `<div class="calendar-day other-month"><span class="day-num">${day}</span></div>`;
        }

        // Métricas calculadas para a empresa selecionada
        const monthEvents = filteredEvents.filter(e => e.date && e.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
        const totalCount = monthEvents.length;
        const inspecaoCount = monthEvents.filter(e => e.type === "inspecao").length;
        const pendingCount = monthEvents.filter(e => e.status === "agendado").length;
        const doneCount = monthEvents.filter(e => e.status === "concluido").length;

        // Título dinâmico da empresa ativa
        const activeCompNorm = this.normalizeCompany(this.selectedCompany);
        const companyTitleHtml = this.selectedCompany === 'all'
            ? `<span style="display:inline-flex; align-items:center; gap:6px; color:#6366f1;"><span>🌐</span> Todas as Empresas</span>`
            : (activeCompNorm === 'Excelência Ambiental'
                ? `<span style="display:inline-flex; align-items:center; gap:6px; color:#10b981;"><span>🌿</span> Excelência Ambiental</span>`
                : `<span style="display:inline-flex; align-items:center; gap:6px; color:#2563eb;"><span>🏢</span> Veeluen Solutions</span>`);

        container.innerHTML = `
            <!-- Barra Superior: Alternador Oficial de Empresas da Agenda -->
            <div class="calendar-company-header-card" style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 14px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.04));">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, rgba(37,99,235,0.12), rgba(16,185,129,0.12)); display: flex; align-items: center; justify-content: center; font-size: 22px; border: 1px solid rgba(255,255,255,0.8);">
                        📅
                    </div>
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: var(--text-muted, #64748b); letter-spacing: 0.5px;">Agenda Separada por Empresa</div>
                        <div style="font-size: 16px; font-weight: 800; color: var(--text-primary, #0f172a); margin-top: 1px;">
                            ${companyTitleHtml}
                        </div>
                    </div>
                </div>

                <div class="company-filter-pills" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button type="button" class="calendar-company-pill ${this.selectedCompany !== 'all' && activeCompNorm === 'Veeluen Solutions' ? 'active-veeluen' : ''}" data-company="Veeluen Solutions" title="Ver apenas agendamentos da Veeluen Solutions">
                        <span>🏢</span> Veeluen Solutions (${veeluenTotal})
                    </button>
                    <button type="button" class="calendar-company-pill ${this.selectedCompany !== 'all' && activeCompNorm === 'Excelência Ambiental' ? 'active-excelencia' : ''}" data-company="Excelência Ambiental" title="Ver apenas agendamentos da Excelência Ambiental">
                        <span>🌿</span> Excelência Ambiental (${excelenciaTotal})
                    </button>
                    <button type="button" class="calendar-company-pill ${this.selectedCompany === 'all' ? 'active-all' : ''}" data-company="all" title="Ver todos os agendamentos unificados">
                        <span>🌐</span> Ambas (${grandTotal})
                    </button>
                </div>
            </div>

            <!-- Top Controls & Filtros em Pílulas -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <h3 style="font-size:18px; font-weight:800; color:var(--text-primary); margin:0;">
                        Agenda & Vistorias — ${monthNames[month]} ${year}
                    </h3>
                    <div style="display:flex; gap:4px;">
                        <button id="btn-cal-prev" class="btn btn-outline" style="padding:4px 10px; font-size:12px; border-radius:var(--radius-sm);">◀ Anterior</button>
                        <button id="btn-cal-today" class="btn btn-outline" style="padding:4px 10px; font-size:12px; border-radius:var(--radius-sm);">Hoje</button>
                        <button id="btn-cal-next" class="btn btn-outline" style="padding:4px 10px; font-size:12px; border-radius:var(--radius-sm);">Próximo ▶</button>
                    </div>
                </div>

                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    ${(() => {
                        if (!Auth.getCurrentUser()?.role || !['operacional', 'operacoes', 'operacao', 'admin'].includes(Auth.getCurrentUser().role.toLowerCase())) return '';
                        const dateToBlock = this.selectedDateStr || new Date().toISOString().split("T")[0];
                        const blockedEvent = allEvents.find(e => 
                            e.date === dateToBlock && 
                            e.status === "bloqueado" && 
                            (this.selectedCompany === 'all' || this.normalizeCompany(e.workspace) === activeCompNorm)
                        );
                        if (blockedEvent) {
                            return `<button onclick="window.Calendar.unlockDate('${blockedEvent.id}')" class="btn btn-outline" style="gap:6px; display:inline-flex; align-items:center; border-color:#10b981; color:#10b981;"><span>🔓 Destravar Data</span></button>`;
                        }
                        return `<button onclick="window.Calendar.blockDateModal()" class="btn btn-outline" style="gap:6px; display:inline-flex; align-items:center; border-color:#ef4444; color:#ef4444;"><span>🚫 Bloquear Data</span></button>`;
                    })()}
                    <button id="btn-open-new-event-modal" class="btn btn-primary" style="gap:6px; display:inline-flex; align-items:center; border-radius:var(--radius-md);">
                        <span>➕ Novo Agendamento</span>
                    </button>
                </div>
            </div>

            <!-- Barra de Filtros de Tipos em Pílulas -->
            <div class="calendar-pill-filters-bar" style="display:flex; gap:8px; margin-bottom:18px; overflow-x:auto; padding-bottom:4px;">
                <button class="calendar-pill-filter ${this.filterType === 'all' ? 'active' : ''}" data-type="all">🔍 Todos (${filteredEvents.length})</button>
                <button class="calendar-pill-filter ${this.filterType === 'inspecao' ? 'active' : ''}" data-type="inspecao">📋 Vistorias Técnicas</button>
                <button class="calendar-pill-filter ${this.filterType === 'followup' ? 'active' : ''}" data-type="followup">⏰ Follow-ups</button>
                <button class="calendar-pill-filter ${this.filterType === 'vencimento' ? 'active' : ''}" data-type="vencimento">⚠️ Vencimentos</button>
                <button class="calendar-pill-filter ${this.filterType === 'reuniao' ? 'active' : ''}" data-type="reuniao">💼 Reuniões</button>
            </div>

                        <!-- Cards KPI Rápidos Clicáveis -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:22px;">
                <div class="vellia-card stat-card" onclick="window.Calendar.setFilterType('all'); window.Calendar.setFilterStatus('all');" title="Clique para exibir todos os compromissos" style="padding:16px 20px; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="stat-label">Compromissos no Mês</span>
                        <span style="font-size:10px; color:var(--text-muted);">↗</span>
                    </div>
                    <span class="stat-value" style="font-size:24px; font-weight:800; color:var(--text-primary); margin-top:4px;">${totalCount}</span>
                </div>
                <div class="vellia-card stat-card" onclick="window.Calendar.setFilterType('inspecao'); window.Calendar.setFilterStatus('all');" title="Clique para filtrar vistorias técnicas" style="padding:16px 20px; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="stat-label" style="color:#059669;">Vistorias Técnicas</span>
                        <span style="font-size:10px; color:#059669;">↗</span>
                    </div>
                    <span class="stat-value" style="font-size:24px; font-weight:800; color:#059669; margin-top:4px;">${inspecaoCount}</span>
                </div>
                <div class="vellia-card stat-card" onclick="window.Calendar.setFilterStatus('agendado');" title="Clique para filtrar compromissos pendentes" style="padding:16px 20px; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="stat-label" style="color:#D97706;">Pendentes</span>
                        <span style="font-size:10px; color:#D97706;">↗</span>
                    </div>
                    <span class="stat-value" style="font-size:24px; font-weight:800; color:#D97706; margin-top:4px;">${pendingCount}</span>
                </div>
                <div class="vellia-card stat-card" onclick="window.Calendar.setFilterStatus('concluido');" title="Clique para filtrar compromissos concluídos" style="padding:16px 20px; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="stat-label" style="color:var(--primary);">Concluídos</span>
                        <span style="font-size:10px; color:var(--primary);">↗</span>
                    </div>
                    <span class="stat-value" style="font-size:24px; font-weight:800; color:var(--primary); margin-top:4px;">${doneCount}</span>
                </div>
            </div>

            <!-- Grade do Calendário -->
            <div class="calendar-grid-wrapper vellia-card" style="padding:22px; border-radius:12px;">
                <div class="calendar-weekdays-header">
                    <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                </div>
                <div class="calendar-days-grid">
                    ${dayCellsHtml}
                </div>
            </div>

            <!-- Painel de Eventos do Dia Selecionado -->
            <div id="calendar-day-detail-panel" style="margin-top:20px; display:${this.selectedDateStr ? 'block' : 'none'};">
                <!-- Preenchido via renderDayDetails() -->
            </div>
        `;

        if (this.selectedDateStr) {
            this.renderDayDetails(this.selectedDateStr, eventsByDate[this.selectedDateStr] || []);
        }

        this.bindEvents();
    },

    renderDayDetails(dateStr, dayEvents) {
        const panel = document.getElementById("calendar-day-detail-panel");
        if (!panel) return;

        const [y, m, d] = dateStr.split("-");
        const formattedDate = `${d}/${m}/${y}`;
        const activeCompLabel = this.selectedCompany === 'all' ? 'Todas as Empresas' : this.normalizeCompany(this.selectedCompany);

        const eventsHtml = dayEvents.length === 0 ? `
            <div style="color:var(--text-muted); font-size:13px; text-align:center; padding:28px 0;">
                Nenhum compromisso agendado para o dia <strong>${formattedDate}</strong> em <strong>${activeCompLabel}</strong>.
            </div>
        ` : dayEvents.map(ev => {
            const borderColor = ev.status === 'bloqueado' ? '#475569' : (ev.status === 'pendente' ? '#f97316' : (ev.type === 'inspecao' ? '#10b981' : (ev.type === 'vencimento' ? '#ef4444' : '#6366f1')));
            const typeBadge = ev.type === 'inspecao' ? '📋 Vistoria' : (ev.type === 'vencimento' ? '⚠️ Vencimento' : (ev.type === 'followup' ? '⏰ Follow-up' : '💼 Reunião'));

            const isExcelencia = this.normalizeCompany(ev.workspace) === "Excelência Ambiental";
            const companyBadge = isExcelencia
                ? `<span style="background: rgba(16, 185, 129, 0.12); color: #059669; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">🌿 Excelência Ambiental</span>`
                : `<span style="background: rgba(37, 99, 235, 0.12); color: #2563eb; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.3);">🏢 Veeluen Solutions</span>`;

            return `
            <div class="calendar-event-card-rich" onclick="window.Calendar.showEventDetails('${ev.id}')" title="Clique para ver os dados deste cliente" style="background:var(--bg-body); border:1px solid var(--border-color); border-left:4px solid ${borderColor}; border-radius:var(--radius-md); padding:14px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; transition:all var(--transition-fast); cursor:pointer;">
                <div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${companyBadge}
                        <span class="badge" style="background:${borderColor}18; color:${borderColor}; font-size:10.5px; font-weight:700; border:1px solid ${borderColor}33;">${typeBadge}</span>
                        <div style="font-weight:700; font-size:14px; color:var(--text-primary);">${ev.title}</div>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">
                        🏢 <strong>${ev.company}</strong> ${ev.contact ? `• Contato: ${ev.contact}` : ''} • 🕒 ${ev.time || 'Horário comercial'}
                    </div>
                    ${ev.notes ? `<div style="font-size:11.5px; color:var(--text-secondary); margin-top:4px; line-height:1.4;">📝 ${ev.notes}</div>` : ''}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${ev.status === 'pendente' && Auth.getCurrentUser()?.role && ['operacional', 'operacoes', 'operacao', 'admin'].includes(Auth.getCurrentUser().role.toLowerCase()) ? `
                        <button onclick="window.Calendar.approveEvent('${ev.id}')" class="btn btn-sm" style="background:#10b981; color:#fff; font-size:11px; padding:6px 10px; font-weight:700; border:none; border-radius:6px; cursor:pointer;">✅ Aprovar</button>
                        <button onclick="window.Calendar.rejectEvent('${ev.id}')" class="btn btn-sm" style="background:#ef4444; color:#fff; font-size:11px; padding:6px 10px; font-weight:700; border:none; border-radius:6px; cursor:pointer;">❌ Recusar</button>
                    ` : ''}
                    ${ev.status === 'bloqueado' && Auth.getCurrentUser()?.role && ['operacional', 'operacoes', 'operacao', 'admin'].includes(Auth.getCurrentUser().role.toLowerCase()) ? `
                        <button onclick="window.Calendar.unlockDate('${ev.id}')" class="btn btn-sm" style="background:#ef4444; color:#fff; font-size:11px; padding:6px 10px; font-weight:700; border:none; border-radius:6px; cursor:pointer;">🔓 Destravar</button>
                    ` : ''}
                    ${ev.phone ? `<a href="https://wa.me/${ev.phone.replace(/\D/g,'')}" target="_blank" class="btn btn-sm" style="background:#25d366; color:#fff; font-size:11.5px; padding:6px 12px; font-weight:700; border:none; text-decoration:none; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">💬 WhatsApp</a>` : ''}
                    <button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.Calendar.showEventDetails('${ev.id}')" style="font-size:11.5px; padding:6px 12px; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><span>👤 Ver Cliente</span></button>
                    ${ev.leadId ? `<button onclick="window.location.hash='#crm'; setTimeout(()=>window.openLeadDrawerFromExt ? window.openLeadDrawerFromExt('${ev.leadId}') : null,300)" class="btn btn-outline btn-sm" style="font-size:11.5px; padding:6px 10px; border-radius:6px;">🔍 Ver Lead</button>` : ''}
                </div>
            </div>
            `;
        }).join("");

        panel.innerHTML = `
            <div class="card" style="padding:20px 24px; border-radius:var(--radius-lg);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h4 style="font-weight:700; font-size:15px; color:var(--text-primary); margin:0;">
                        📋 Compromissos de ${formattedDate} (${dayEvents.length})
                    </h4>
                    <button class="btn btn-outline btn-sm" onclick="document.getElementById('calendar-day-detail-panel').style.display='none'">Fechar Detalhes</button>
                </div>
                <div>${eventsHtml}</div>
            </div>
        `;
        panel.style.display = "block";
    },

    bindEvents() {
        // Pílulas de Empresa (Veeluen Solutions / Excelência Ambiental / Todas)
        const companyPills = document.querySelectorAll(".calendar-company-pill");
        companyPills.forEach(pill => {
            pill.onclick = (e) => {
                e.preventDefault();
                const comp = pill.getAttribute("data-company") || "all";
                this.selectedCompany = comp;
                this.render();
                this.renderRemindersWidget();
            };
        });

        const prevBtn = document.getElementById("btn-cal-prev");
        if (prevBtn) {
            prevBtn.onclick = () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.render();
            };
        }

        const nextBtn = document.getElementById("btn-cal-next");
        if (nextBtn) {
            nextBtn.onclick = () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.render();
            };
        }

        const todayBtn = document.getElementById("btn-cal-today");
        if (todayBtn) {
            todayBtn.onclick = () => {
                this.currentDate = new Date();
                this.selectedDateStr = new Date().toISOString().split("T")[0];
                this.render();
            };
        }

        // Pílulas de filtro rápido de tipos
        const pillFilters = document.querySelectorAll(".calendar-pill-filter");
        pillFilters.forEach(pill => {
            pill.onclick = () => {
                const type = pill.getAttribute("data-type") || "all";
                this.filterType = type;
                this.render();
            };
        });

        const dayCells = document.querySelectorAll(".calendar-day:not(.other-month)");
        dayCells.forEach(cell => {
            cell.onclick = () => {
                const dateStr = cell.getAttribute("data-date");
                if (dateStr) {
                    this.selectedDateStr = dateStr;
                    this.render();
                }
            };
        });

        const btnNew = document.getElementById("btn-open-new-event-modal");
        if (btnNew) {
            btnNew.onclick = () => this.openNewEventModal();
        }

        // Eventos para fechar o modal
        const closeCalModal = () => {
            const overlay = document.getElementById("calendar-event-modal-overlay");
            const modal = document.getElementById("calendar-event-modal");
            if (modal) modal.classList.remove("open");
            setTimeout(() => {
                if (modal) modal.style.display = "none";
                if (overlay) overlay.style.display = "none";
            }, 300);
        };

        
        const calDetailOverlay = document.getElementById("calendar-event-detail-overlay");
        if (calDetailOverlay) {
            calDetailOverlay.onclick = () => this.closeEventDetailsModal();
        }
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const modal = document.getElementById("modal-calendar-event-detail");
                if (modal && modal.style.display !== "none") {
                    this.closeEventDetailsModal();
                }
            }
        });

        const btnClose = document.getElementById("btn-close-calendar-event-modal");
        if (btnClose) btnClose.onclick = closeCalModal;

        const btnCancel = document.getElementById("btn-cancel-calendar-event");
        if (btnCancel) btnCancel.onclick = closeCalModal;

        const overlay = document.getElementById("calendar-event-modal-overlay");
        if (overlay) overlay.onclick = closeCalModal;

        // Submissão do Formulário de Agendamento
        const form = document.getElementById("calendar-event-form");
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                
                const workspaceVal = document.getElementById("cal-event-workspace")?.value || (this.selectedCompany !== 'all' ? this.selectedCompany : 'Veeluen Solutions');
                const title = document.getElementById("cal-event-title").value;
                const company = document.getElementById("cal-event-lead").value;
                const dateVal = document.getElementById("cal-event-date").value;
                const timeVal = document.getElementById("cal-event-time").value;
                const typeVal = document.getElementById("cal-event-type").value;
                let statusVal = document.getElementById("cal-event-status").value;
                const notes = document.getElementById("cal-event-notes").value;
                
                const user = Auth.getCurrentUser();
                if (user && user.role && !['operacional', 'operacoes', 'operacao', 'admin'].includes(user.role.toLowerCase())) {
                    statusVal = "pendente"; // Vendedor agenda como pendente
                }

                // Validação apenas se a data estiver explicitamente bloqueada pelo administrador
                const customEventsCheck = Store.getCalendarEvents();
                const isBlocked = customEventsCheck.some(ev => 
                    ev.date === dateVal && 
                    this.normalizeCompany(ev.workspace) === this.normalizeCompany(workspaceVal) &&
                    ev.status === "bloqueado"
                );
                if (isBlocked) {
                    alert(`❌ Esta data está bloqueada para ${workspaceVal}. Por favor, escolha outra data.`);
                    return;
                }
                
                const emojiMap = {
                    inspecao: "📋",
                    followup: "⏰",
                    reuniao: "💼",
                    vencimento: "⚠️"
                };
                const emoji = emojiMap[typeVal] || "📋";

                const newEvent = {
                    id: `evt_${Date.now()}`,
                    title: `${emoji} ${title}`,
                    company: company,
                    workspace: this.normalizeCompany(workspaceVal),
                    date: dateVal,
                    time: timeVal,
                    type: typeVal,
                    status: statusVal,
                    notes: notes
                };
                
                try {
                    const customEvents = Store.getCalendarEvents();
                    customEvents.push(newEvent);
                    Store.saveCalendarEvents(customEvents);
                    alert(`✅ Compromisso agendado com sucesso para ${newEvent.workspace}!`);
                    
                    // Disparar automação de confirmação de vistoria se for tipo "inspecao"
                    if (typeVal === "inspecao" && typeof window.WhatsApp?.sendAutomatedMessage === "function") {
                        const leads = Store.getLeads();
                        const lead = leads.find(l => l.company.toLowerCase() === company.toLowerCase());
                        if (lead) {
                            window.WhatsApp.sendAutomatedMessage(lead.id, "inspection_confirm");
                        }
                    }
                    
                    closeCalModal();
                    this.selectedDateStr = dateVal;
                    if (dateVal) {
                        const [y, m] = dateVal.split("-");
                        if (y && m) {
                            this.currentDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                        }
                    }
                    if (typeof Toast !== "undefined") {
                        Toast.success("Agendamento Salvo", `Compromisso registrado com sucesso para a data ${dateVal.split('-').reverse().join('/')}!`);
                    }
                    this.render();
                    this.renderRemindersWidget();
                } catch (err) {
                    console.error("Erro ao salvar agendamento:", err);
                }
            };
        }
    },

    openNewEventModal() {
        // 1. Configurar Empresa selecionada no modal
        const wsSelect = document.getElementById("cal-event-workspace");
        const defaultCompany = this.selectedCompany && this.selectedCompany !== "all" 
            ? this.normalizeCompany(this.selectedCompany) 
            : (localStorage.getItem("activeCompany") || "Veeluen Solutions");
            
        if (wsSelect) {
            wsSelect.value = defaultCompany;
            wsSelect.onchange = () => this.populateLeadsSelect(wsSelect.value);
        }

        // 2. Popular dropdown de Leads da empresa correspondente
        this.populateLeadsSelect(defaultCompany);

        // 3. Data padrão
        const dateInput = document.getElementById("cal-event-date");
        if (dateInput) {
            dateInput.value = this.selectedDateStr || new Date().toISOString().split("T")[0];
        }

        // 4. Limpar campos
        const titleInput = document.getElementById("cal-event-title");
        if (titleInput) titleInput.value = "";
        const notesInput = document.getElementById("cal-event-notes");
        if (notesInput) notesInput.value = "";

        // 5. Exibir Modal
        const overlay = document.getElementById("calendar-event-modal-overlay");
        const modal = document.getElementById("calendar-event-modal");
        if (overlay) overlay.style.display = "block";
        if (modal) {
            modal.style.display = "flex";
            setTimeout(() => modal.classList.add("open"), 10);
        }
    },

    populateLeadsSelect(companyName) {
        const leadSelect = document.getElementById("cal-event-lead");
        if (!leadSelect) return;

        let allLeads = [];
        try {
            allLeads = (typeof Store.getAllLeadsRaw === "function" ? Store.getAllLeadsRaw() : Store.getLeads())
                .filter(l => !l.deleted_at);
        } catch(e) {
            allLeads = Store.getLeads() || [];
        }

        const filteredLeads = allLeads.filter(l => {
            if (!companyName || companyName === "all") return true;
            return this.normalizeCompany(l.workspace) === this.normalizeCompany(companyName);
        });

        leadSelect.innerHTML = `
            <option value="">-- Selecionar Cliente / Lead (${companyName || 'Todos'}) --</option>
            ${filteredLeads.map(l => `<option value="${l.company}">${l.company} (${l.contact || 'Sem contato'})</option>`).join("")}
            <option value="Cliente Geral">-- Outro Cliente (Não cadastrado) --</option>
        `;
    },

    blockDateModal() {
        const dateStr = this.selectedDateStr || new Date().toISOString().split("T")[0];
        const currentTargetCompany = this.selectedCompany && this.selectedCompany !== "all" 
            ? this.normalizeCompany(this.selectedCompany) 
            : (localStorage.getItem("activeCompany") || "Veeluen Solutions");

        const reason = prompt(`Bloquear a data ${dateStr.split('-').reverse().join('/')} para [${currentTargetCompany}]?\n\nInforme o motivo (ex: Feriado, Equipe Ocupada, Manutenção):`, "Indisponível");
        if (reason) {
            const customEvents = Store.getCalendarEvents();
            customEvents.push({
                id: `blk_${Date.now()}`,
                title: `🚫 Bloqueado: ${reason}`,
                company: "Sistema",
                workspace: currentTargetCompany,
                date: dateStr,
                time: "00:00",
                type: "reuniao",
                status: "bloqueado",
                notes: reason
            });
            Store.saveCalendarEvents(customEvents);
            alert(`✅ Data bloqueada com sucesso para ${currentTargetCompany}!`);
            this.render();
        }
    },

    approveEvent(id) {
        if(confirm("Confirmar e aprovar este agendamento?")) {
            const customEvents = Store.getCalendarEvents();
            const ev = customEvents.find(e => e.id === id);
            if(ev) {
                ev.status = "agendado";
                Store.saveCalendarEvents(customEvents);
                this.render();
            }
        }
    },

    rejectEvent(id) {
        if(confirm("Tem certeza que deseja recusar este agendamento? Ele será cancelado.")) {
            let customEvents = Store.getCalendarEvents();
            const ev = customEvents.find(e => e.id === id);
            if(ev) {
                ev.status = "recusado"; // Mantém histórico mas não bloqueia mais
                Store.saveCalendarEvents(customEvents);
                this.render();
            }
        }
    },

    unlockDate(id) {
        if(confirm("Tem certeza que deseja destravar esta data?")) {
            let customEvents = Store.getCalendarEvents();
            customEvents = customEvents.filter(e => e.id !== id);
            Store.saveCalendarEvents(customEvents);
            alert("✅ Data destravada com sucesso!");
            this.render();
        }
    },

    
    setFilterType(type) {
        this.filterType = type;
        this.render();
    },

    setFilterStatus(status) {
        this.filterStatus = status;
        this.render();
    },

    selectDateAndShow(dateStr) {
        this.selectedDateStr = dateStr;
        this.render();
        const panel = document.getElementById("calendar-day-detail-panel");
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    showEventDetails(eventId) {
        const events = this.getEvents();
        const ev = events.find(e => String(e.id) === String(eventId));
        if (!ev) {
            console.warn("Evento não encontrado:", eventId);
            return;
        }

        const modal = document.getElementById("modal-calendar-event-detail");
        const overlay = document.getElementById("calendar-event-detail-overlay");
        const body = document.getElementById("cal-event-detail-body");
        const footer = document.getElementById("cal-event-detail-footer");
        const headerTitle = document.getElementById("cal-modal-header-title");
        const headerSub = document.getElementById("cal-modal-header-sub");
        const headerIcon = document.getElementById("cal-modal-header-icon");

        if (!modal || !overlay || !body) return;

        // Ícone e cabeçalho
        const isExcelencia = this.normalizeCompany(ev.workspace) === "Excelência Ambiental";
        let icon = "📅";
        if (ev.type === "inspecao") icon = "📋";
        else if (ev.type === "vencimento") icon = "⚠️";
        else if (ev.type === "followup") icon = "⏰";
        else if (ev.type === "reuniao") icon = "💼";

        if (headerIcon) headerIcon.textContent = icon;
        if (headerTitle) headerTitle.textContent = ev.company || "Cliente Agendado";
        if (headerSub) headerSub.textContent = `${ev.title} • ${ev.workspace || 'Geral'}`;

        // Formatação de data
        let formattedDate = ev.date;
        if (ev.date) {
            const parts = ev.date.split("-");
            if (parts.length === 3) {
                const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                formattedDate = dObj.toLocaleDateString("pt-BR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
            }
        }

        const timeStr = ev.time || "Horário comercial";

        // Badges
        const companyBadge = isExcelencia
            ? `<span style="background: rgba(16, 185, 129, 0.12); color: #059669; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3); display: inline-flex; align-items: center; gap: 4px;">🌿 Excelência Ambiental</span>`
            : `<span style="background: rgba(37, 99, 235, 0.12); color: #2563eb; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(37, 99, 235, 0.3); display: inline-flex; align-items: center; gap: 4px;">🏢 Veeluen Solutions</span>`;

        let typeBadge = `<span class="badge" style="background: #6366f118; color: #6366f1; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; border: 1px solid #6366f133;">💼 Reunião Comercial</span>`;
        if (ev.type === "inspecao") {
            typeBadge = `<span class="badge" style="background: #10b98118; color: #059669; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; border: 1px solid #10b98133;">📋 Vistoria Técnica</span>`;
        } else if (ev.type === "vencimento") {
            typeBadge = `<span class="badge" style="background: #ef444418; color: #dc2626; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; border: 1px solid #ef444433;">⚠️ Vencimento de Laudo</span>`;
        } else if (ev.type === "followup") {
            typeBadge = `<span class="badge" style="background: #f59e0b18; color: #d97706; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; border: 1px solid #f59e0b33;">⏰ Follow-up</span>`;
        }

        let statusBadge = `<span class="status-pill status-risk" style="font-size: 11px; font-weight: 700;">🟡 Pendente / Agendado</span>`;
        if (ev.status === "concluido") {
            statusBadge = `<span class="status-pill status-active" style="font-size: 11px; font-weight: 700;">🟢 Concluído</span>`;
        } else if (ev.status === "bloqueado") {
            statusBadge = `<span class="status-pill status-inactive" style="font-size: 11px; font-weight: 700;">🔒 Data Bloqueada</span>`;
        }

        const cleanPhone = (ev.phone || "").replace(/\D/g, "");
        const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;
        const mailLink = ev.email ? `mailto:${ev.email}` : null;
        const formattedValue = ev.value ? `R$ ${Number(ev.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

        body.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- Tags de Status e Unidade -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${companyBadge}
                        ${typeBadge}
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <!-- CARD 1: FICHA DO CLIENTE -->
                <div style="background: var(--bg-app, #f8fafc); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>👤</span> Dados do Cliente & Contato
                    </div>
                    
                    <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
                        ${ev.company}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px;">
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Responsável / Contato:</span>
                            <strong style="font-size: 13px; color: var(--text-primary);">${ev.contact || 'Responsável não informado'}</strong>
                        </div>
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Telefone / WhatsApp:</span>
                            ${waLink 
                                ? `<a href="${waLink}" target="_blank" style="font-size: 13px; color: #16a34a; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">💬 ${ev.phone} ↗</a>`
                                : `<span style="font-size: 13px; color: var(--text-secondary);">${ev.phone || 'Não informado'}</span>`}
                        </div>
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">E-mail:</span>
                            ${mailLink
                                ? `<a href="${mailLink}" style="font-size: 13px; color: var(--primary); font-weight: 600; text-decoration: none;">✉️ ${ev.email}</a>`
                                : `<span style="font-size: 13px; color: var(--text-secondary);">${ev.email || 'Não informado'}</span>`}
                        </div>
                        ${ev.cnpj ? `
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">CNPJ:</span>
                            <span style="font-size: 12.5px; font-family: monospace; color: var(--text-secondary);">${ev.cnpj}</span>
                        </div>` : ''}
                        ${ev.address || ev.city ? `
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Localização:</span>
                            <span style="font-size: 12.5px; color: var(--text-secondary);">📍 ${ev.address || (ev.city + (ev.state ? '/' + ev.state : ''))}</span>
                        </div>` : ''}
                        ${formattedValue ? `
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Valor da Oportunidade:</span>
                            <strong style="font-size: 13.5px; color: #059669;">💰 ${formattedValue}</strong>
                        </div>` : ''}
                        ${ev.pipelineStatus ? `
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Etapa no Funil:</span>
                            <span class="status-pill status-formalizing" style="font-size: 11px;">${ev.pipelineStatus}</span>
                        </div>` : ''}
                    </div>
                </div>

                <!-- CARD 2: DADOS DO AGENDAMENTO -->
                <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>📋</span> Detalhes do Compromisso
                    </div>

                    <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">
                        ${ev.title}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px;">
                        <div style="background: var(--bg-app, #f8fafc); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">Data Marcada / Agendamento:</span>
                                    <strong id="cal-modal-display-date" style="font-size: 13px; color: var(--text-primary); font-family: monospace;">${formattedDate}</strong>
                                </div>
                                <button type="button" class="btn btn-outline" onclick="window.Calendar.toggleReschedulePanel()" style="font-size: 11px; padding: 3px 8px; border-radius: 6px; color: var(--primary); display: inline-flex; align-items: center; gap: 4px;">
                                    📅 Alterar Data
                                </button>
                            </div>
                        </div>

                        <!-- Painel Retrátil de Remarcação / Alteração de Data -->
                        <div id="cal-reschedule-box" style="display: none; background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 10px; padding: 12px 14px; margin-top: 10px;">
                            <span style="font-size: 12px; font-weight: 700; color: #3730A3; display: block; margin-bottom: 8px;">
                                📅 Remarcar ou Atualizar Data deste Compromisso:
                            </span>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                <div style="flex: 1; min-width: 150px;">
                                    <label style="font-size: 11px; color: #4338CA; display: block; margin-bottom: 2px;">Nova Data:</label>
                                    <input type="date" id="cal-new-date-input" value="${ev.date || ''}" class="form-control" style="height: 36px; font-size: 13px; background: #ffffff; border: 1px solid #A5B4FC;">
                                </div>
                                <div style="flex: 1; min-width: 120px;">
                                    <label style="font-size: 11px; color: #4338CA; display: block; margin-bottom: 2px;">Novo Horário:</label>
                                    <input type="time" id="cal-new-time-input" value="${ev.time || '10:00'}" class="form-control" style="height: 36px; font-size: 13px; background: #ffffff; border: 1px solid #A5B4FC;">
                                </div>
                                <div style="display: flex; gap: 6px; align-items: flex-end; padding-top: 16px;">
                                    <button type="button" class="btn btn-primary" onclick="window.Calendar.saveRescheduledDate('${ev.id}')" style="font-size: 12px; padding: 7px 14px; background: #4F46E5; border: none; font-weight: 700; border-radius: 6px;">
                                        💾 Salvar Nova Data
                                    </button>
                                    <button type="button" class="btn btn-outline" onclick="window.Calendar.toggleReschedulePanel()" style="font-size: 12px; padding: 7px 10px; border-radius: 6px;">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div style="background: var(--bg-app, #f8fafc); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);">
                            <span style="font-size: 11px; color: var(--text-muted); display: block;">Horário:</span>
                            <strong style="font-size: 13px; color: var(--text-primary);">⏰ ${timeStr}</strong>
                        </div>
                    </div>

                    ${ev.notes ? `
                    <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #92400E; line-height: 1.5;">
                        <strong style="display: block; margin-bottom: 2px;">📝 Observações e Escopo Técnico:</strong>
                        ${ev.notes}
                    </div>` : ''}
                </div>
            </div>
        `;

        // Rodapé de Ações
        footer.innerHTML = `
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${cleanPhone ? `
                    <button type="button" class="btn" onclick="window.Calendar.sendWhatsAppReminder('${ev.id}')" style="background: #25D366; color: #fff; font-size: 12.5px; font-weight: 700; padding: 7px 14px; border: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        💬 WhatsApp
                    </button>
                ` : ''}
                ${ev.leadId ? `
                    <button type="button" class="btn btn-outline" onclick="window.Calendar.closeEventDetailsModal(); window.location.hash='#crm'; setTimeout(()=>import('./crm.js').then(m => m.CRM.openLeadDrawer('${ev.leadId}')), 150);" style="font-size: 12.5px; padding: 7px 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        🔍 Ver no CRM
                    </button>
                ` : ''}
                ${(ev.type === 'inspecao' || ev.type === 'vencimento') ? `
                    <button type="button" class="btn btn-outline" onclick="window.Calendar.closeEventDetailsModal(); window.location.hash='#inspections';" style="font-size: 12.5px; padding: 7px 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        🔬 Ver Inspeções
                    </button>
                ` : ''}
                ${ev.status === 'agendado' ? `
                    <button type="button" class="btn btn-outline" onclick="window.Calendar.markEventDone('${ev.id}')" style="font-size: 12.5px; padding: 7px 14px; border-radius: 8px; color: #059669; border-color: #059669; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        ✓ Marcar Concluído
                    </button>
                ` : ''}
            </div>
            <button type="button" class="btn btn-secondary" onclick="window.Calendar.closeEventDetailsModal()" style="font-size: 12.5px; padding: 7px 18px; border-radius: 8px; cursor: pointer;">
                Fechar
            </button>
        `;

        modal.style.display = "flex";
        overlay.style.display = "block";
    },

    closeEventDetailsModal() {
        const modal = document.getElementById("modal-calendar-event-detail");
        const overlay = document.getElementById("calendar-event-detail-overlay");
        if (modal) modal.style.display = "none";
        if (overlay) overlay.style.display = "none";
    },

    
    toggleReschedulePanel() {
        const box = document.getElementById("cal-reschedule-box");
        if (box) {
            box.style.display = box.style.display === "none" ? "block" : "none";
        }
    },

    saveRescheduledDate(eventId) {
        const dateInput = document.getElementById("cal-new-date-input");
        const timeInput = document.getElementById("cal-new-time-input");
        if (!dateInput || !dateInput.value) {
            alert("Por favor, selecione uma data válida.");
            return;
        }

        const newDate = dateInput.value;
        const newTime = timeInput ? timeInput.value : "10:00";

        let wasUpdated = false;

        // 1. Verificar em customEvents
        const customEvents = Store.getCalendarEvents();
        const customEv = customEvents.find(e => String(e.id) === String(eventId));
        if (customEv) {
            customEv.date = newDate;
            customEv.time = newTime;
            Store.saveCalendarEvents(customEvents);
            wasUpdated = true;
        }

        // 2. Verificar em leads (interactions ou followups)
        const allLeads = (typeof Store.getAllLeadsRaw === "function" ? Store.getAllLeadsRaw() : Store.getLeads()) || [];
        
        // Tratar ID com prefixo expiry_ ou id direto
        let cleanInteractionId = eventId;
        let isExpiry = false;
        if (String(eventId).startsWith("expiry_")) {
            cleanInteractionId = String(eventId).replace("expiry_", "");
            isExpiry = true;
        }

        allLeads.forEach(lead => {
            let leadModified = false;

            // Follow-ups
            if (lead.followups && Array.isArray(lead.followups)) {
                const f = lead.followups.find(x => String(x.id) === String(eventId));
                if (f) {
                    f.scheduledAt = `${newDate}T${newTime}:00`;
                    leadModified = true;
                    wasUpdated = true;
                }
            }

            // Interações / Inspeções
            if (lead.interactions && Array.isArray(lead.interactions)) {
                const item = lead.interactions.find(i => String(i.id) === String(cleanInteractionId) || String(i.id) === String(eventId));
                if (item) {
                    if (!item.meta) item.meta = {};
                    if (isExpiry) {
                        item.meta.expiryDate = newDate;
                    } else {
                        item.meta.executionDate = newDate;
                    }
                    leadModified = true;
                    wasUpdated = true;
                }
            }

            if (leadModified) {
                const currentUser = Auth.getCurrentUser();
                if (typeof Store.updateLead === "function") {
                    Store.updateLead(lead.id, { 
                        interactions: lead.interactions, 
                        followups: lead.followups 
                    }, currentUser?.email || "sistema@vellia.com");
                }
            }
        });

        // 3. Feedback e sincronização visual
        const formattedNewDate = newDate.split('-').reverse().join('/');
        if (typeof Toast !== "undefined") {
            Toast.success("Data Atualizada!", `A nova data (${formattedNewDate}) foi salva com sucesso no sistema e no cadastro do cliente.`);
        } else {
            alert(`✅ Data atualizada com sucesso para ${formattedNewDate}!`);
        }

        // Navegar para o mês da nova data caso diferente
        const [y, m] = newDate.split("-");
        if (y && m) {
            this.currentDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        }
        this.selectedDateStr = newDate;

        this.closeEventDetailsModal();
        this.render();
        this.renderRemindersWidget();
    },

    markEventDone(eventId) {
        // Tentar atualizar evento personalizado
        const customEvents = Store.getCalendarEvents();
        const ev = customEvents.find(e => String(e.id) === String(eventId));
        if (ev) {
            ev.status = "concluido";
            Store.saveCalendarEvents(customEvents);
        } else {
            // Tentar em followups de leads
            const allLeads = Store.getLeads();
            let found = false;
            allLeads.forEach(lead => {
                if (lead.followups && Array.isArray(lead.followups)) {
                    const f = lead.followups.find(x => String(x.id) === String(eventId));
                    if (f) {
                        f.done = true;
                        found = true;
                    }
                }
            });
            if (found) {
                Store.saveLeads(allLeads);
            }
        }

        if (typeof Toast !== "undefined") {
            Toast.success("Agendamento Concluído", "Status do compromisso atualizado com sucesso!");
        }

        this.closeEventDetailsModal();
        this.render();
        this.renderRemindersWidget();
    },

    renderRemindersWidget() {
        const container = document.getElementById("calendar-reminders-widget");
        if (!container) return;

        const allEvents = this.getEvents();
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        // Filtrar lembretes pela empresa selecionada no calendário
        const upcomingEvents = allEvents.filter(e => {
            if (e.status === "cancelado" || e.status === "recusado") return false;
            const matchCompany = !this.selectedCompany || this.selectedCompany === "all" 
                || this.normalizeCompany(e.workspace) === this.normalizeCompany(this.selectedCompany);
            if (!matchCompany) return false;
            return e.date === todayStr || e.date === tomorrowStr;
        });

        const sentList = JSON.parse(localStorage.getItem("vellia_reminders_sent") || "[]");
        const activeCompLabel = this.selectedCompany === "all" ? "Todas as Empresas" : this.normalizeCompany(this.selectedCompany);

        container.innerHTML = `
            <div class="card" style="margin-bottom: 24px; padding: 20px; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 1); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); border-radius: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.12); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                            ⏰
                        </div>
                        <div>
                            <h3 style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                                Lembretes Automáticos de Agenda & Vistorias — <span style="color:var(--primary); font-size:14px;">${activeCompLabel}</span>
                            </h3>
                            <span style="font-size: 12px; color: var(--text-muted);">Compromissos e confirmações de WhatsApp previstos para hoje e amanhã</span>
                        </div>
                    </div>
                </div>

                ${upcomingEvents.length === 0 ? `
                    <div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 13px;">
                        🟢 Nenhum compromisso agendado para hoje ou amanhã em <strong>${activeCompLabel}</strong>.
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${upcomingEvents.map(ev => {
                            const isSent = sentList.includes(ev.id);
                            const isToday = ev.date === todayStr;
                            const formattedDate = ev.date ? ev.date.split("-").reverse().join("/") : "";
                            const badgeBg = isToday ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)";
                            const badgeColor = isToday ? "#ef4444" : "#d97706";
                            const dayLabel = isToday ? "HOJE" : "AMANHÃ";

                            const isExcelencia = this.normalizeCompany(ev.workspace) === "Excelência Ambiental";
                            const companyPillMini = isExcelencia 
                                ? `<span style="font-size: 10px; font-weight: 800; background: rgba(16,185,129,0.15); color: #059669; padding: 2px 6px; border-radius: 4px;">🌿 Excelência</span>`
                                : `<span style="font-size: 10px; font-weight: 800; background: rgba(37,99,235,0.15); color: #2563eb; padding: 2px 6px; border-radius: 4px;">🏢 Veeluen</span>`;

                            return `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.6); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.9); flex-wrap: wrap; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 800;">
                                            ${dayLabel} (${formattedDate})
                                        </span>
                                        ${companyPillMini}
                                        <div>
                                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${ev.title}</div>
                                            <div style="font-size: 11px; color: var(--text-muted);">${ev.company} • ${ev.contact || 'Cliente'} (${ev.time || '09:00'})</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <button type="button" class="btn btn-outline btn-sm" onclick="window.Calendar.showEventDetails('${ev.id}')" style="font-size: 11.5px; padding: 4px 10px; border-radius: 6px; font-weight: 600;">
                                            👤 Detalhes
                                        </button>
                                        <button type="button" class="btn btn-outline btn-sm" onclick="window.Calendar.sendWhatsAppReminder('${ev.id}')" style="font-size: 11.5px; padding: 4px 12px; border-color: #25d366; color: #15803d; font-weight: 700; background: rgba(37, 211, 102, 0.08);">
                                            ${isSent ? "✓ Confirmado via WA" : "💬 Enviar Lembrete WA"}
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                `}
            </div>
        `;
    },

    sendWhatsAppReminder(eventId) {
        const events = this.getEvents();
        const ev = events.find(e => e.id === eventId);
        if (!ev) return;

        const rawPhone = ev.phone || "";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedDate = ev.date ? ev.date.split("-").reverse().join("/") : "breve";

        const msg = `Olá ${ev.contact || 'tudo bem'}! Passando para confirmar nosso compromisso agendado:\n\n📌 *${ev.title}*\n🏢 *Empresa:* ${ev.company}\n📅 *Data:* ${formattedDate} às ${ev.time || '09:00'}\n\nCaso precise de qualquer ajuste de horário, por favor responda por aqui. Grande abraço! 🗓️`;

        const encoded = encodeURIComponent(msg);
        const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
        
        window.open(waUrl, "_blank");

        const sentList = JSON.parse(localStorage.getItem("vellia_reminders_sent") || "[]");
        if (!sentList.includes(eventId)) {
            sentList.push(eventId);
            localStorage.setItem("vellia_reminders_sent", JSON.stringify(sentList));
        }

        this.renderRemindersWidget();
    }
};

window.Calendar = Calendar;
