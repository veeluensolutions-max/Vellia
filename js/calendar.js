/**
 * Vellia — Agenda & Calendário Visual de Vistorias e Reuniões
 * Módulo de agendamento interativo com visão mensal/semanal e integração com Leads, Tarefas e Inspeções.
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const Calendar = {
    currentDate: new Date(),
    selectedDateStr: null,
    filterType: "all",
    filterStatus: "all",

    init() {
        this.render();
        this.bindEvents();
    },

    // ─── Obter todos os eventos compilados do sistema ────────────────────────────
    getEvents() {
        const events = [];
        const leads = Store.getLeads();
        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "";

        // 1. Inspeções e Vistorias
        leads.forEach(lead => {
            if (lead.interactions && Array.isArray(lead.interactions)) {
                lead.interactions.forEach(item => {
                    if (item.type === "Inspeção" || item.type === "Inspecao") {
                        const dateStr = item.meta?.executionDate || item.timestamp?.split("T")[0];
                        if (dateStr) {
                            events.push({
                                id: item.id || `insp_${Math.random()}`,
                                leadId: lead.id,
                                company: lead.company,
                                title: `📋 Vistoria: ${item.meta?.serviceName || "Inspeção Técnica"}`,
                                date: dateStr,
                                time: "09:00",
                                type: "inspecao",
                                status: "concluido",
                                notes: item.meta?.notes || item.description || "",
                                contact: lead.contact,
                                phone: lead.whatsapp || lead.phone
                            });
                        }

                        // Evento de Vencimento
                        const expiryStr = item.meta?.expiryDate;
                        if (expiryStr) {
                            events.push({
                                id: `expiry_${item.id}`,
                                leadId: lead.id,
                                company: lead.company,
                                title: `⚠️ Vencimento: ${item.meta?.serviceName || "Inspeção"}`,
                                date: expiryStr,
                                time: "12:00",
                                type: "vencimento",
                                status: "agendado",
                                notes: `Vencimento do laudo técnico de ${lead.company}`,
                                contact: lead.contact,
                                phone: lead.whatsapp || lead.phone
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
                            title: `⏰ Follow-up: ${lead.company}`,
                            date: dPart,
                            time: tPart ? tPart.substring(0, 5) : "14:00",
                            type: "followup",
                            status: f.done ? "concluido" : "agendado",
                            notes: f.note || "",
                            contact: lead.contact,
                            phone: lead.whatsapp || lead.phone
                        });
                    }
                });
            }
        });

        // 3. Compromissos Personalizados da Agenda
        try {
            const customEvents = JSON.parse(localStorage.getItem("vellia_calendar_events")) || [];
            customEvents.forEach(e => events.push(e));
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

        // Aplicar filtros
        const filteredEvents = allEvents.filter(e => {
            const matchType = this.filterType === "all" || e.type === this.filterType;
            const matchStatus = this.filterStatus === "all" || e.status === this.filterStatus;
            return matchType && matchStatus;
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

                return `
                    <div class="calendar-event-pill" style="background:${badgeBg}; color:#fff;" title="${ev.title}">
                        ${ev.title}
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

        // Métricas
        const monthEvents = filteredEvents.filter(e => e.date && e.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
        const totalCount = monthEvents.length;
        const inspecaoCount = monthEvents.filter(e => e.type === "inspecao").length;
        const pendingCount = monthEvents.filter(e => e.status === "agendado").length;
        const doneCount = monthEvents.filter(e => e.status === "concluido").length;

        container.innerHTML = `
            <!-- Top Controls -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <h3 style="font-size:18px; font-weight:800; color:var(--text-primary); margin:0;">
                        📅 Agenda & Vistorias — ${monthNames[month]} ${year}
                    </h3>
                    <div style="display:flex; gap:4px;">
                        <button id="btn-cal-prev" class="btn btn-outline" style="padding:4px 10px; font-size:12px;">◀ Anterior</button>
                        <button id="btn-cal-today" class="btn btn-outline" style="padding:4px 10px; font-size:12px;">Hoje</button>
                        <button id="btn-cal-next" class="btn btn-outline" style="padding:4px 10px; font-size:12px;">Próximo ▶</button>
                    </div>
                </div>

                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <select id="cal-filter-type" class="filter-control" style="height:36px; padding:4px 10px; font-size:12px;">
                        <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>Todos os Tipos</option>
                        <option value="inspecao" ${this.filterType === 'inspecao' ? 'selected' : ''}>📋 Vistorias Técnicas</option>
                        <option value="followup" ${this.filterType === 'followup' ? 'selected' : ''}>⏰ Follow-ups</option>
                        <option value="vencimento" ${this.filterType === 'vencimento' ? 'selected' : ''}>⚠️ Vencimentos</option>
                        <option value="reuniao" ${this.filterType === 'reuniao' ? 'selected' : ''}>💼 Reuniões</option>
                    </select>

                    <button id="btn-open-new-event-modal" class="btn btn-primary" style="gap:6px; display:inline-flex; align-items:center;">
                        <span>➕ Agendar Vistoria / Evento</span>
                    </button>
                </div>
            </div>

            <!-- Cards KPI Rápidos -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:20px;">
                <div class="card stat-card" style="padding:14px; border-left:4px solid #1877F2;">
                    <div style="font-size:11px; font-weight:700; color:var(--text-muted);">Compromissos no Mês</div>
                    <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-top:2px;">${totalCount}</div>
                </div>
                <div class="card stat-card" style="padding:14px; border-left:4px solid #10b981;">
                    <div style="font-size:11px; font-weight:700; color:var(--text-muted);">Vistorias Técnicas</div>
                    <div style="font-size:22px; font-weight:800; color:#10b981; margin-top:2px;">${inspecaoCount}</div>
                </div>
                <div class="card stat-card" style="padding:14px; border-left:4px solid #f59e0b;">
                    <div style="font-size:11px; font-weight:700; color:var(--text-muted);">Pendentes</div>
                    <div style="font-size:22px; font-weight:800; color:#f59e0b; margin-top:2px;">${pendingCount}</div>
                </div>
                <div class="card stat-card" style="padding:14px; border-left:4px solid #8b5cf6;">
                    <div style="font-size:11px; font-weight:700; color:var(--text-muted);">Concluídos</div>
                    <div style="font-size:22px; font-weight:800; color:#8b5cf6; margin-top:2px;">${doneCount}</div>
                </div>
            </div>

            <!-- Grade do Calendário -->
            <div class="calendar-grid-wrapper card" style="padding:16px;">
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

        const eventsHtml = dayEvents.length === 0 ? `
            <div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">
                Nenhum compromisso agendado para o dia ${formattedDate}.
            </div>
        ` : dayEvents.map(ev => `
            <div style="background:var(--bg-body); border:1px solid var(--border-color); border-left:4px solid ${ev.type === 'inspecao' ? '#10b981' : (ev.type === 'vencimento' ? '#ef4444' : '#1877F2')}; border-radius:8px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <div style="font-weight:700; font-size:13.5px; color:var(--text-primary);">${ev.title}</div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                        🏢 ${ev.company} ${ev.contact ? `• Contato: ${ev.contact}` : ''} • 🕒 ${ev.time || 'Horário comercial'}
                    </div>
                    ${ev.notes ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">📝 ${ev.notes}</div>` : ''}
                </div>
                <div style="display:flex; gap:6px;">
                    ${ev.phone ? `<a href="https://wa.me/${ev.phone.replace(/\D/g,'')}" target="_blank" class="btn btn-sm" style="background:#25d366; color:#fff; font-size:11px; padding:4px 8px; font-weight:700; border:none; text-decoration:none; border-radius:6px;">💬 WhatsApp</a>` : ''}
                    ${ev.leadId ? `<button onclick="window.location.hash='#crm'; setTimeout(()=>window.openLeadDrawerFromExt('${ev.leadId}'),300)" class="btn btn-outline btn-sm" style="font-size:11px; padding:4px 8px;">🔍 Ver Lead</button>` : ''}
                </div>
            </div>
        `).join("");

        panel.innerHTML = `
            <div class="card" style="padding:18px 22px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <h4 style="font-weight:700; font-size:14px; color:var(--text-primary); margin:0;">
                        📋 Compromissos de ${formattedDate} (${dayEvents.length})
                    </h4>
                    <button class="btn btn-outline btn-sm" onclick="document.getElementById('calendar-day-detail-panel').style.display='none'">Fechar</button>
                </div>
                <div>${eventsHtml}</div>
            </div>
        `;
        panel.style.display = "block";
    },

    bindEvents() {
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

        const typeFilter = document.getElementById("cal-filter-type");
        if (typeFilter) {
            typeFilter.onchange = (e) => {
                this.filterType = e.target.value;
                this.render();
            };
        }

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
    },

    openNewEventModal() {
        const title = prompt("Título da Vistoria ou Compromisso:");
        if (!title || !title.trim()) return;

        const company = prompt("Empresa / Cliente:") || "Cliente";
        const dateStr = prompt("Data (AAAA-MM-DD):", this.selectedDateStr || new Date().toISOString().split("T")[0]);
        if (!dateStr) return;

        const newEvent = {
            id: `evt_${Date.now()}`,
            title: `📋 ${title}`,
            company: company,
            date: dateStr.trim(),
            time: "10:00",
            type: "inspecao",
            status: "agendado",
            notes: "Agendado via Agenda Vellia"
        };

        try {
            const customEvents = JSON.parse(localStorage.getItem("vellia_calendar_events")) || [];
            customEvents.push(newEvent);
            localStorage.setItem("vellia_calendar_events", JSON.stringify(customEvents));
            alert("✅ Compromisso agendado na Agenda!");
            this.selectedDateStr = dateStr.trim();
            this.render();
        } catch (e) {}
    }
};
