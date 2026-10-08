import { Store } from "./store.js";
import { PDFGenerator } from "./pdf-generator.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";

export const Inspections = {
    async init() {
        // Inicializar listeners e modal imediatamente para resposta instantânea ao clique
        this.setupChecklistModal();
        this.setupListeners();
        this.render();

        try {
            // Buscar todos os leads atualizados do Supabase
            const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            });
            if (res.ok) {
                const freshLeads = await res.json();
                if (Array.isArray(freshLeads) && freshLeads.length > 0) {
                    // Mesclar com leads locais preservando qualquer dado local extra
                    let localLeads = [];
                    try { localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || []; } catch(e) {}
                    const merged = freshLeads.map(remote => {
                        const local = localLeads.find(l => l && l.id === remote.id);
                        return local ? { ...local, ...remote } : remote;
                    });
                    localStorage.setItem("comercial_leads", JSON.stringify(merged));
                    console.log(`✅ [Inspections] ${merged.length} leads sincronizados do Supabase.`);
                    this.render();
                }
            }
        } catch (err) {
            console.warn("[Inspections] Falha ao sincronizar com Supabase, usando cache local:", err.message);
        }
    },

    getInspections() {
        const currentUser = Auth.getCurrentUser();
        const isOperacional = currentUser && ["operacional", "operacoes", "operacao"].includes(currentUser.role?.toLowerCase());
        const allRawLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem("comercial_leads")) || []);
        
        // Operacional ou acesso a Ambas acessam inspeções completas de todos os clientes ativos
        const leads = (isOperacional || currentUser?.companyAccess === "Ambas")
            ? allRawLeads.filter(l => !l.deleted_at)
            : Store.getLeads();
        const inspections = [];

        leads.forEach(lead => {
            if (lead.interactions && Array.isArray(lead.interactions)) {
                // Obter todas as inspeções deste lead para cruzamento de ciclos e renovações
                const leadInspList = lead.interactions.filter(i => i.type === "Inspeção");

                leadInspList.forEach(item => {
                    const executionDateStr = item.meta?.executionDate || item.timestamp?.split("T")[0] || new Date().toISOString().split("T")[0];
                    
                    // O vencimento é 1 ano após a execução por padrão
                    let expiryDateStr = item.meta?.expiryDate;
                    if (!expiryDateStr) {
                        const date = new Date(executionDateStr + "T12:00:00");
                        date.setFullYear(date.getFullYear() + 1);
                        expiryDateStr = date.toISOString().split("T")[0];
                    }

                    // Cálculo de dias restantes
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const expiryDate = new Date(expiryDateStr + "T12:00:00");
                    expiryDate.setHours(0,0,0,0);

                    const timeDiff = expiryDate.getTime() - today.getTime();
                    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    // Detecção Inteligente de Renovação:
                    // 1. Flag explícita no cadastro (isRenewed = true ou status = "renovada" ou renewedToId)
                    // 2. Ou existência de outro laudo no mesmo cliente com data posterior para o mesmo serviço
                    // 3. Ou outro laudo explicitamente apontando renewedFromId = item.id
                    let successor = leadInspList.find(other => 
                        other.id !== item.id && (
                            other.meta?.renewedFromId === item.id ||
                            item.meta?.renewedToId === other.id
                        )
                    );

                    if (!successor) {
                        // Buscar laudo sucessor cronologicamente para o mesmo serviço
                        successor = leadInspList.find(other => 
                            other.id !== item.id && 
                            (other.meta?.serviceName === item.meta?.serviceName) &&
                            (other.meta?.executionDate || other.timestamp?.split("T")[0] || "") > executionDateStr
                        );
                    }

                    const isRenewed = Boolean(
                        item.meta?.isRenewed === true || 
                        item.meta?.status === "renovada" || 
                        item.meta?.renewedToId || 
                        successor
                    );

                    // Determinar Status
                    let status = "valida"; // valida, alerta, vencida, renovada
                    if (isRenewed) {
                        status = "renovada";
                    } else if (daysRemaining < 0) {
                        status = "vencida";
                    } else if (daysRemaining <= 90) { // 3 meses (90 dias)
                        status = "alerta";
                    }

                    inspections.push({
                        id: item.id,
                        leadId: lead.id,
                        company: lead.company,
                        contact: lead.contact || "Sem nome",
                        phone: lead.whatsapp || lead.phone || "",
                        inspectionNumber: item.meta?.inspectionNumber || item.meta?.number || "",
                        serviceName: item.meta?.serviceName || "Vistoria Geral",
                        executionDate: executionDateStr,
                        expiryDate: expiryDateStr,
                        daysRemaining: daysRemaining,
                        status: status,
                        isRenewed: isRenewed,
                        successorId: successor ? successor.id : (item.meta?.renewedToId || null),
                        successorNumber: successor ? (successor.meta?.inspectionNumber || "Ciclo Seguinte") : null,
                        renewedFromId: item.meta?.renewedFromId || null,
                        notes: item.meta?.notes || item.description,
                        score: item.meta?.score
                    });
                });
            }
        });

        // Ordenar pela proximidade de vencimento (vencidos primeiro, depois alertas, depois válidos, por último renovados)
        return inspections.sort((a, b) => {
            if (a.status === "renovada" && b.status !== "renovada") return 1;
            if (b.status === "renovada" && a.status !== "renovada") return -1;
            return a.daysRemaining - b.daysRemaining;
        });
    },

    render() {
        const tableBody = document.getElementById("inspections-table-body");
        if (!tableBody) return;

        const inspections = this.getInspections();
        
        // Filtros ativos
        const query = (document.getElementById("filter-inspection-search")?.value || "").toLowerCase().trim();
        const statusFilter = document.getElementById("filter-inspection-status")?.value || "all";
        const yearFilter = document.getElementById("filter-inspection-year")?.value || "all";

        const filtered = inspections.filter(item => {
            const matchesQuery = item.company.toLowerCase().includes(query) || 
                                 item.contact.toLowerCase().includes(query) || 
                                 item.serviceName.toLowerCase().includes(query) ||
                                 (item.inspectionNumber && item.inspectionNumber.toLowerCase().includes(query));
            
            const matchesStatus = statusFilter === "all" || item.status === statusFilter;
            
            const matchesYear = yearFilter === "all" || item.executionDate.startsWith(yearFilter);

            return matchesQuery && matchesStatus && matchesYear;
        });

        // Atualizar Contadores dos KPIs e Pílulas Rápidas
        const totalCount = inspections.length;
        const validCount = inspections.filter(i => i.status === "valida").length;
        const criticalCount = inspections.filter(i => i.status === "alerta").length;
        const expiredCount = inspections.filter(i => i.status === "vencida").length;
        const renewedCount = inspections.filter(i => i.status === "renovada").length;

        // KPI Cards
        const kpiTotal = document.getElementById("kpi-inspections-total");
        const kpiValid = document.getElementById("kpi-inspections-valid");
        const kpiCrit = document.getElementById("kpi-inspections-critical");
        const kpiExp = document.getElementById("kpi-inspections-expired");
        const kpiRen = document.getElementById("kpi-inspections-renewed");

        if (kpiTotal) kpiTotal.textContent = totalCount;
        if (kpiValid) kpiValid.textContent = validCount;
        if (kpiCrit) kpiCrit.textContent = criticalCount;
        if (kpiExp) kpiExp.textContent = expiredCount;
        if (kpiRen) kpiRen.textContent = renewedCount;

        // Badges nas Pílulas Rápidas GestãoClick
        const pCountAll = document.getElementById("pill-count-all");
        const pCountVal = document.getElementById("pill-count-valid");
        const pCountCrit = document.getElementById("pill-count-critical");
        const pCountExp = document.getElementById("pill-count-expired");
        const pCountRen = document.getElementById("pill-count-renewed");

        if (pCountAll) pCountAll.textContent = totalCount;
        if (pCountVal) pCountVal.textContent = validCount;
        if (pCountCrit) pCountCrit.textContent = criticalCount;
        if (pCountExp) pCountExp.textContent = expiredCount;
        if (pCountRen) pCountRen.textContent = renewedCount;

        // Sincronizar estado visual das pílulas com statusFilter
        document.querySelectorAll("#inspection-status-pills .gc-pill-btn").forEach(btn => {
            const btnStatus = btn.getAttribute("data-status");
            if (btnStatus === statusFilter) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        this.renderAnalyticsDashboard(inspections);

        // Renderizar Tabela
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding: 48px 20px; text-align: center; color: var(--text-muted);">
                        <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
                        <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">Nenhuma vistoria encontrada</div>
                        <div style="font-size: 12.5px;">Tente ajustar os filtros de busca ou cadastre uma nova inspeção técnica.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map(item => {
            const getInitials = (str) => {
                if (!str) return "CO";
                const clean = str.replace(/[^a-zA-Z0-9\s]/g, "").trim();
                const words = clean.split(/\s+/).filter(Boolean);
                if (words.length === 0) return "CO";
                return words[0].length >= 2 ? words[0].substring(0, 2).toUpperCase() : (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
            };

            const initials = getInitials(item.company);
            const hue = Math.abs((item.company || "A").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 360;

            let statusBadge = "";
            let remainingChip = "";

            if (item.status === "renovada") {
                statusBadge = `
                    <span class="gc-status-pill gc-status-renewed" title="Renovação emitida com continuidade de histórico">
                        <span class="gc-status-indicator"></span>
                        Renovada
                    </span>
                `;
                const sucText = item.successorNumber ? `Ciclo ${item.successorNumber}` : 'Ciclo Ativo';
                remainingChip = `
                    <div class="gc-countdown-chip gc-countdown-renewed" title="${sucText}">
                        <span class="gc-chip-dot"></span>
                        <span>Renovado</span>
                    </div>
                `;
            } else if (item.status === "vencida") {
                statusBadge = `
                    <span class="gc-status-pill gc-status-expired" title="Laudo expirado">
                        <span class="gc-status-indicator"></span>
                        Vencida
                    </span>
                `;
                remainingChip = `
                    <div class="gc-countdown-chip gc-countdown-expired" title="Vencido há ${Math.abs(item.daysRemaining)} dias">
                        <span class="gc-chip-dot"></span>
                        <span>-${Math.abs(item.daysRemaining)} dias</span>
                    </div>
                `;
            } else if (item.status === "alerta") {
                statusBadge = `
                    <span class="gc-status-pill gc-status-critical" title="Vence em menos de 3 meses">
                        <span class="gc-status-indicator gc-dot-pulse"></span>
                        Crítico
                    </span>
                `;
                remainingChip = `
                    <div class="gc-countdown-chip gc-countdown-critical" title="Vence em ${item.daysRemaining} dias">
                        <span class="gc-chip-dot gc-dot-pulse"></span>
                        <span>${item.daysRemaining} dias</span>
                    </div>
                `;
            } else {
                statusBadge = `
                    <span class="gc-status-pill gc-status-valid" title="Laudo em período regular de validade">
                        <span class="gc-status-indicator"></span>
                        Válida
                    </span>
                `;
                remainingChip = `
                    <div class="gc-countdown-chip gc-countdown-valid" title="Vence em ${item.daysRemaining} dias">
                        <span class="gc-chip-dot"></span>
                        <span>${item.daysRemaining} dias</span>
                    </div>
                `;
            }

            const formatDate = (dateStr) => {
                if (!dateStr) return "N/A";
                const parts = dateStr.split("-");
                if (parts.length < 3) return dateStr;
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            };

            let buttonAction = "";
            if (item.status === "renovada") {
                const targetId = item.successorId || item.id;
                buttonAction = `
                    <button 
                        class="gc-btn-action gc-btn-action-cycle"
                        onclick="window.Inspections.openInspectionScreen('${item.leadId}', '${targetId}')"
                        title="Abrir o novo ciclo de renovação"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        <span>Ver Ciclo</span>
                    </button>
                `;
            } else if (item.status === "vencida" || item.status === "alerta") {
                buttonAction = `
                    <button 
                        class="gc-btn-action gc-btn-action-renew"
                        onclick="window.Inspections.createRenewalFrom('${item.leadId}', '${item.id}')"
                        title="Emitir renovação desta inspeção agora"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        <span>Renovar</span>
                    </button>
                `;
            } else {
                buttonAction = `
                    <button 
                        class="gc-btn-action gc-btn-action-notify"
                        onclick="window.sendInspectionNotification('${item.leadId}', '${item.id}')"
                        title="Enviar lembrete de vistoria para o cliente via WhatsApp"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>Notificar</span>
                    </button>
                `;
            }

            const scoreClass = (item.score >= 80) ? 'gc-score-high' : ((item.score >= 50) ? 'gc-score-mid' : 'gc-score-low');
            const scoreText = item.score !== undefined ? `
                <span class="gc-score-pill ${scoreClass}">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Score: ${item.score}%
                </span>
            ` : '';

            const numberBadge = item.inspectionNumber 
                ? `<span style="font-family: monospace; font-size: 10.5px; background: rgba(99,102,241,0.08); color: #4338ca; padding: 1px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(99,102,241,0.2); letter-spacing: 0.3px;" title="Nº do Laudo / Inspeção">${item.inspectionNumber}</span>`
                : '';

            const cycleIndicator = item.isRenewed 
                ? `<span class="gc-badge gc-badge-renewed" style="font-size:10px; padding:1px 6px; border-radius:4px;">Ciclo Anterior</span>`
                : (item.renewedFromId ? `<span class="gc-badge gc-badge-info" style="font-size:10px; padding:1px 6px; border-radius:4px;">Ciclo Renovado</span>` : '');

            return `
                <tr>
                    <td style="padding: 14px 18px;">
                        <div style="display: flex; align-items: center; gap: 11px;">
                            <div class="gc-company-avatar" style="background: linear-gradient(135deg, hsl(${hue}, 65%, 52%), hsl(${(hue + 45) % 360}, 70%, 42%));">
                                ${initials}
                            </div>
                            <div style="min-width: 0;">
                                <div class="gc-company-name" title="${item.company}">${item.company}</div>
                                <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap;">
                                    ${numberBadge}
                                    ${item.contact ? `
                                        <span class="gc-contact-tag">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            ${item.contact}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 14px 18px;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; line-height: 1.35;">${item.serviceName}</div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                            ${scoreText}
                            ${cycleIndicator}
                        </div>
                    </td>
                    <td style="padding: 14px 18px; color: var(--text-secondary); font-size: 12.5px; white-space: nowrap;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>${formatDate(item.executionDate)}</span>
                        </div>
                    </td>
                    <td style="padding: 14px 18px; color: var(--text-primary); font-weight: 600; font-size: 12.5px; white-space: nowrap;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6366f1;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>${formatDate(item.expiryDate)}</span>
                        </div>
                    </td>
                    <td style="padding: 14px 18px; white-space: nowrap;">
                        ${remainingChip}
                    </td>
                    <td style="padding: 14px 18px; text-align: center; white-space: nowrap;">
                        ${statusBadge}
                    </td>
                    <td style="padding: 14px 18px; text-align: right;">
                        <div class="gc-table-actions">
                            <button 
                                class="gc-btn-action gc-btn-action-edit"
                                onclick="window.Inspections.openInspectionScreen('${item.leadId}', '${item.id}')"
                                title="Editar Cadastro & Histórico (GestãoClick)"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                <span>Detalhes</span>
                            </button>
                            ${buttonAction}
                            <button 
                                class="gc-btn-action gc-btn-action-calendar"
                                onclick="window.scheduleGoogleCalendar('${item.leadId}', '${item.id}')"
                                title="Adicionar lembrete no Google Agenda"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <span>Agendar</span>
                            </button>
                            <button 
                                class="gc-btn-action gc-btn-action-pdf"
                                onclick="window.generateInspectionPDF('${item.leadId}', '${item.id}')"
                                title="Gerar Laudo Técnico Oficial em PDF"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span>Laudo</span>
                            </button>
                            <button 
                                class="gc-btn-action gc-btn-action-delete"
                                onclick="window.deleteInspection('${item.leadId}', '${item.id}')"
                                title="Excluir Inspeção Técnica"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    },

    // ─── Painel Analítico: Comparativo Anual & Índice de Renovação ──────────────
    renderAnalyticsDashboard(inspections) {
        const ctx = document.getElementById("chart-inspections-yearly")?.getContext("2d");
        if (!ctx) return;

        // Contagem por ano
        const countsByYear = { "2024": 0, "2025": 0, "2026": 0 };
        const companyCounts = {};

        inspections.forEach(item => {
            const yr = (item.executionDate || "").substring(0, 4);
            if (countsByYear[yr] !== undefined) {
                countsByYear[yr]++;
            } else if (yr) {
                countsByYear[yr] = 1;
            }

            companyCounts[item.company] = (companyCounts[item.company] || 0) + 1;
        });

        // Gráfico comparativo de vistorias por ano
        if (window._chartInspectionsYearly) {
            window._chartInspectionsYearly.destroy();
        }

        if (typeof Chart !== "undefined") {
            window._chartInspectionsYearly = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(countsByYear),
                    datasets: [{
                        label: "Vistorias Realizadas",
                        data: Object.values(countsByYear),
                        backgroundColor: ["#3b82f6", "#8b5cf6", "#10b981"],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        }

        // Taxa de Renovação e Receita
        const totalCompanies = Object.keys(companyCounts).length;
        const recurringCompanies = Object.values(companyCounts).filter(c => c > 1).length;
        const renewalRate = totalCompanies > 0 ? Math.round((recurringCompanies / totalCompanies) * 100) : 65;

        const rateEl = document.getElementById("inspection-renewal-rate");
        const revEl = document.getElementById("inspection-renewal-revenue");
        if (rateEl) rateEl.textContent = `${Math.max(45, renewalRate)}%`;

        const estimatedRenewalRevenue = inspections.length * 3500;
        if (revEl) revEl.textContent = `R$ ${estimatedRenewalRevenue.toLocaleString("pt-BR")}`;

        // Top 3 Clientes Recorrentes
        const sortedCompanies = Object.entries(companyCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const topContainer = document.getElementById("inspections-top-clients");
        if (topContainer) {
            topContainer.innerHTML = sortedCompanies.length === 0 
                ? `<div style="color:var(--text-muted);">Aguardando mais vistorias para ranking.</div>`
                : sortedCompanies.map(([comp, count], i) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-app); padding:6px 10px; border-radius:6px; border:1px solid var(--border-color);">
                        <span style="font-weight:700; color:var(--text-primary);">${i+1}. ${comp}</span>
                        <span class="badge badge-success" style="font-size:10.5px; background:rgba(16,185,129,0.1); color:#10b981;">${count} vistorias</span>
                    </div>
                `).join("");
        }
    },

    setupListeners() {
        const searchInput = document.getElementById("filter-inspection-search");
        const statusSelect = document.getElementById("filter-inspection-status");
        const yearSelect = document.getElementById("filter-inspection-year");

        if (searchInput) {
            searchInput.addEventListener("input", () => this.render());
        }
        if (statusSelect) {
            statusSelect.addEventListener("change", (e) => {
                const val = e.target.value;
                document.querySelectorAll("#inspection-status-pills .gc-pill-btn").forEach(btn => {
                    if (btn.getAttribute("data-status") === val) btn.classList.add("active");
                    else btn.classList.remove("active");
                });
                this.render();
            });
        }
        if (yearSelect) {
            yearSelect.addEventListener("change", () => this.render());
        }

        // Pílulas de filtro rápido de status estilo GestãoClick
        const pillButtons = document.querySelectorAll("#inspection-status-pills .gc-pill-btn");
        pillButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const status = btn.getAttribute("data-status") || "all";
                if (statusSelect) statusSelect.value = status;
                pillButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.render();
            });
        });

        // Listener de sincronização em tempo real (novas mensagens ou outros eventos gerais)
        window.addEventListener("vellia:waSent", () => this.render());

        // Listener específico para atualização de lead (via Realtime WS UPDATE)
        window.addEventListener("vellia:leadUpdated", () => {
            console.log("🔄 [Inspections] Lead atualizado remotamente — re-renderizando central de inspeções.");
            this.render();
        });
    },

    setupChecklistModal() {
        const btnOpen = document.getElementById("btn-open-checklist-modal");
        const btnOpenScan = document.getElementById("btn-open-checklist-scanner-top");
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        const btnCloseX = document.getElementById("btn-close-checklist-modal-x");
        const btnCancel = document.getElementById("btn-cancel-checklist");
        const form = document.getElementById("checklist-form");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const itemSelects = document.querySelectorAll(".checklist-item-select");

        // Botões do módulo de leitura de documento
        const btnUploadPdf = document.getElementById("btn-insp-upload-pdf");
        const btnUseCamera = document.getElementById("btn-insp-use-camera");
        const btnOpenWebcam = document.getElementById("btn-insp-open-webcam");
        const fileInput = document.getElementById("insp-file-input");
        const cameraInput = document.getElementById("insp-camera-input");
        const btnClearScan = document.getElementById("btn-insp-clear-scan");
        const btnQuickAddLead = document.getElementById("btn-insp-quick-add-lead");
        const btnWebcamCapture = document.getElementById("btn-insp-webcam-capture");
        const btnWebcamClose = document.getElementById("btn-insp-webcam-close");

        // Handlers de abertura (tela GestãoClick)
        if (btnOpen) {
            btnOpen.onclick = () => this.openInspectionScreen();
        }
        if (btnOpenScan) {
            btnOpenScan.onclick = () => this.openInspectionScreen(null, null, "file");
        }

        // Controles da tela GestãoClick de Inspeção
        const btnGcBack = document.getElementById("gc-insp-btn-back");
        if (btnGcBack) btnGcBack.onclick = () => this.closeInspectionScreen();

        const btnGcCancel = document.getElementById("gc-insp-btn-cancel");
        if (btnGcCancel) btnGcCancel.onclick = () => this.closeInspectionScreen();

        const btnGcDelete = document.getElementById("gc-insp-btn-delete");
        if (btnGcDelete) {
            btnGcDelete.onclick = () => {
                const leadId = document.getElementById("gc-insp-lead-id")?.value;
                const interactionId = document.getElementById("gc-insp-interaction-id")?.value;
                if (leadId && interactionId) {
                    this.deleteInspection(leadId, interactionId);
                }
            };
        }

        // Botões de Ação de Renovação
        const btnGcActionRenew = document.getElementById("gc-insp-btn-action-renew");
        if (btnGcActionRenew) {
            btnGcActionRenew.onclick = () => {
                const leadId = document.getElementById("gc-insp-lead-id")?.value;
                const interactionId = document.getElementById("gc-insp-interaction-id")?.value;
                if (leadId && interactionId) {
                    this.createRenewalFrom(leadId, interactionId);
                }
            };
        }

        const btnGcTopRenew = document.getElementById("gc-insp-btn-top-renew");
        if (btnGcTopRenew) {
            btnGcTopRenew.onclick = () => {
                const leadId = document.getElementById("gc-insp-lead-id")?.value;
                const interactionId = document.getElementById("gc-insp-interaction-id")?.value;
                if (leadId && interactionId) {
                    this.createRenewalFrom(leadId, interactionId);
                }
            };
        }

        const btnGcSubmit = document.getElementById("gc-insp-btn-submit");
        if (btnGcSubmit) btnGcSubmit.onclick = () => this.saveInspectionFromScreen(false);

        const btnGcSubmitPdf = document.getElementById("gc-insp-btn-submit-pdf");
        if (btnGcSubmitPdf) btnGcSubmitPdf.onclick = () => this.saveInspectionFromScreen(true);

        const btnGcAddService = document.getElementById("gc-insp-btn-add-service");
        if (btnGcAddService) btnGcAddService.onclick = () => this.addServiceRow();

        const btnGcEditNumber = document.getElementById("gc-insp-btn-edit-number");
        if (btnGcEditNumber) {
            btnGcEditNumber.onclick = () => {
                const numInput = document.getElementById("gc-insp-number");
                if (numInput) {
                    numInput.readOnly = false;
                    numInput.classList.remove("gc-input-readonly");
                    numInput.focus();
                }
            };
        }

        const btnGcClearInspector = document.getElementById("gc-insp-btn-clear-inspector");
        if (btnGcClearInspector) {
            btnGcClearInspector.onclick = () => {
                const input = document.getElementById("gc-insp-inspector");
                if (input) input.value = "";
            };
        }

        const gcExecDate = document.getElementById("gc-insp-exec-date");
        if (gcExecDate) {
            gcExecDate.onchange = (e) => {
                const expiryInput = document.getElementById("gc-insp-expiry-date");
                if (expiryInput && e.target.value) {
                    const d = new Date(e.target.value + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    expiryInput.value = d.toISOString().split("T")[0];
                    this.updateDaysSummary();
                }
            };
        }

        const gcExpiryDate = document.getElementById("gc-insp-expiry-date");
        if (gcExpiryDate) {
            gcExpiryDate.onchange = () => this.updateDaysSummary();
        }

        const btnGcUploadPdf = document.getElementById("gc-insp-btn-upload-pdf");
        if (btnGcUploadPdf && fileInput) {
            btnGcUploadPdf.onclick = () => fileInput.click();
        }

        const btnGcCamera = document.getElementById("gc-insp-btn-camera");
        if (btnGcCamera && cameraInput) {
            btnGcCamera.onclick = () => cameraInput.click();
        }

        const btnGcWebcam = document.getElementById("gc-insp-btn-webcam");
        if (btnGcWebcam) {
            btnGcWebcam.onclick = () => this.startGcWebcam();
        }

        const btnGcCaptureWebcam = document.getElementById("gc-insp-btn-capture-webcam");
        if (btnGcCaptureWebcam) {
            btnGcCaptureWebcam.onclick = () => this.captureGcWebcam();
        }

        const btnGcCloseWebcam = document.getElementById("gc-insp-btn-close-webcam");
        if (btnGcCloseWebcam) {
            btnGcCloseWebcam.onclick = () => this.closeGcWebcam();
        }

        const btnGcSelectPhotos = document.getElementById("gc-insp-btn-select-photos");
        const photosInput = document.getElementById("gc-insp-photos-input");
        if (btnGcSelectPhotos && photosInput) {
            btnGcSelectPhotos.onclick = () => photosInput.click();
            photosInput.onchange = (e) => {
                const countEl = document.getElementById("gc-insp-photos-count");
                if (countEl && e.target.files) {
                    countEl.textContent = `${e.target.files.length} foto(s) anexada(s)`;
                }
            };
        }

        // Handlers de fechamento do modal antigo
        if (btnCloseX) btnCloseX.onclick = () => this.closeChecklistModal();
        if (btnCancel) btnCancel.onclick = () => this.closeChecklistModal();
        if (overlay) overlay.onclick = () => this.closeChecklistModal();

        // Gatilhos de Upload e Câmera
        if (btnUploadPdf && fileInput) {
            btnUploadPdf.onclick = () => fileInput.click();
        }
        if (btnUseCamera && cameraInput) {
            btnUseCamera.onclick = () => cameraInput.click();
        }
        if (btnOpenWebcam) {
            btnOpenWebcam.onclick = () => this.startWebcam();
        }
        if (btnWebcamCapture) {
            btnWebcamCapture.onclick = () => this.captureWebcam();
        }
        if (btnWebcamClose) {
            btnWebcamClose.onclick = () => this.closeWebcam();
        }

        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleDocumentInput(e.target.files[0]);
                }
            };
        }

        if (cameraInput) {
            cameraInput.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleDocumentInput(e.target.files[0]);
                }
            };
        }

        if (btnClearScan) {
            btnClearScan.onclick = () => {
                const successBox = document.getElementById("insp-scanner-success");
                if (successBox) successBox.style.display = "none";
                const notesArea = document.getElementById("checklist-notes");
                if (notesArea) notesArea.value = "";
                if (fileInput) fileInput.value = "";
                if (cameraInput) cameraInput.value = "";
            };
        }

        if (btnQuickAddLead) {
            btnQuickAddLead.onclick = () => {
                const name = prompt("Digite a Razão Social ou Nome Fantasia da nova empresa:");
                if (name && name.trim()) {
                    const cleanName = name.trim();
                    const createFn = Store.createLead || Store.addLead;
                    const newLead = createFn.call(Store, {
                        company: cleanName,
                        contact: "Responsável",
                        source: "Inspeções",
                        stage: "Lead Qualificado",
                        notes: `Cadastrado na central de inspeções em ${new Date().toLocaleDateString('pt-BR')}`
                    });
                    this.openChecklistModal(newLead.id);
                }
            };
        }

        // Dropzone de arquivo no card
        const scannerCard = document.getElementById("insp-scanner-card");
        if (scannerCard) {
            ["dragenter", "dragover"].forEach(eventName => {
                scannerCard.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scannerCard.style.borderColor = "#6366f1";
                    scannerCard.style.background = "rgba(99, 102, 241, 0.12)";
                }, false);
            });

            ["dragleave", "drop"].forEach(eventName => {
                scannerCard.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scannerCard.style.borderColor = "rgba(99, 102, 241, 0.35)";
                    scannerCard.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(16, 185, 129, 0.06))";
                }, false);
            });

            scannerCard.addEventListener("drop", (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files[0]) {
                    this.handleDocumentInput(dt.files[0]);
                }
            });
        }

        // Atualização de data de vencimento automática (1 ano após execução)
        if (inputExecDate) {
            inputExecDate.onchange = () => {
                if (inputExecDate.value) {
                    const d = new Date(inputExecDate.value + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    inputExpiryDate.value = d.toISOString().split("T")[0];
                }
            };
        }

        itemSelects.forEach(sel => {
            sel.onchange = () => this.calculateScore();
        });

        // Submissão do Formulário
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const leadSelect = document.getElementById("checklist-lead-select");
                const selectService = document.getElementById("checklist-service-select");
                let leadId = leadSelect?.value;

                if (!leadId) {
                    alert("Selecione um Cliente / Lead ou cadastre uma nova empresa.");
                    return;
                }

                // Se for um novo lead detectado pelo laudo
                if (leadId.startsWith("__NEW__:")) {
                    const companyName = leadId.replace("__NEW__:", "").trim();
                    const createFn = Store.createLead || Store.addLead;
                    const createdLead = createFn.call(Store, {
                        company: companyName,
                        contact: "Responsável Técnico",
                        source: "Scanner de Laudo",
                        stage: "Lead Qualificado",
                        notes: `Empresa importada automaticamente via scanner de laudo técnico em ${new Date().toLocaleDateString('pt-BR')}`
                    });
                    leadId = createdLead.id;
                }

                const allLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem("comercial_leads")) || []);
                const lead = allLeads.find(l => l.id === leadId) || Store.getLeadById(leadId);
                if (!lead) {
                    alert("Erro: Não foi possível localizar os dados do cliente selecionado.");
                    return;
                }

                const service = selectService ? selectService.value : "Vistoria Geral";
                const execDate = inputExecDate ? inputExecDate.value : new Date().toISOString().split("T")[0];
                const expiryDate = inputExpiryDate ? inputExpiryDate.value : new Date(Date.now() + 365*24*3600*1000).toISOString().split("T")[0];
                const notes = document.getElementById("checklist-notes")?.value.trim() || "";
                
                const score = this.calculateScore();

                const checklistPayload = [];
                itemSelects.forEach(sel => {
                    checklistPayload.push({
                        name: sel.getAttribute("data-item-name"),
                        status: sel.value
                    });
                });

                const currentUser = Auth.getCurrentUser();
                const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

                const newInteraction = {
                    id: "int_" + Date.now().toString(36),
                    type: "Inspeção",
                    timestamp: new Date().toISOString(),
                    description: `Vistoria de ${service} concluída com ${score}% de conformidade. Parecer: ${(notes || "").substring(0, 120)}...`,
                    meta: {
                        serviceName: service,
                        score: score,
                        executionDate: execDate,
                        expiryDate: expiryDate,
                        notes: notes,
                        checklist: checklistPayload
                    }
                };

                if (!lead.interactions) lead.interactions = [];
                lead.interactions.push(newInteraction);
                
                try {
                    if (typeof Store.updateLead === "function") {
                        Store.updateLead(lead.id, { interactions: lead.interactions }, userEmail);
                    } else {
                        const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
                        const updatedLocal = localLeads.map(l => l.id === lead.id ? lead : l);
                        localStorage.setItem("comercial_leads", JSON.stringify(updatedLocal));
                    }

                    const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                        method: "PATCH",
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": `Bearer ${SUPABASE_KEY}`,
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        },
                        body: JSON.stringify({
                            interactions: lead.interactions
                        })
                    });

                    if (res.ok) {
                        console.log("✅ Vistoria registrada com sucesso no Supabase.");
                    } else {
                        console.warn("⚠️ Vistoria registrada localmente, falha ao subir no Supabase:", await res.text());
                    }
                } catch(err) {
                    console.error("Erro ao salvar inspeção no Supabase:", err);
                }

                Audit.logStageChange(userEmail, lead.company, lead.stage, lead.stage, `Concluiu Checklist Técnico de ${service} (Score: ${score}%)`);

                this.closeChecklistModal();
                alert(`✅ Inspeção registrada com sucesso para "${lead.company}"! Score de Conformidade: ${score}%`);
                
                this.init();
            };
        }
    },

    openChecklistModal(preselectedLeadId = null, autoAction = null) {
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        const leadSelect = document.getElementById("checklist-lead-select");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const itemSelects = document.querySelectorAll(".checklist-item-select");
        const notesArea = document.getElementById("checklist-notes");

        this.closeWebcam();

        const loadingBox = document.getElementById("insp-scanner-loading");
        const successBox = document.getElementById("insp-scanner-success");
        if (loadingBox) loadingBox.style.display = "none";
        if (successBox) successBox.style.display = "none";

        const currentUser = Auth.getCurrentUser();
        const isOperacional = currentUser && ["operacional", "operacoes", "operacao"].includes(currentUser.role?.toLowerCase());
        const allRawLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem("comercial_leads")) || []);
        const leads = (isOperacional || currentUser?.companyAccess === "Ambas")
            ? allRawLeads.filter(l => !l.deleted_at)
            : (Store.getLeads() || []);

        if (leadSelect) {
            leadSelect.innerHTML = `<option value="">-- Selecionar Cliente / Lead Cadastrado --</option>` +
                leads.map(l => `<option value="${l.id}">${l.company} (${l.contact || 'Sem contato'})</option>`).join("");
            
            if (preselectedLeadId) {
                leadSelect.value = preselectedLeadId;
            }
        }

        const todayStr = new Date().toISOString().split("T")[0];
        if (inputExecDate) inputExecDate.value = todayStr;
        
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        if (inputExpiryDate) inputExpiryDate.value = nextYear.toISOString().split("T")[0];

        itemSelects.forEach(sel => sel.value = "Conforme");
        if (notesArea) notesArea.value = "";
        this.calculateScore();

        if (overlay) {
            overlay.style.display = "block";
            overlay.style.zIndex = "99990";
            overlay.classList.add("open");
        }
        if (modal) {
            modal.style.display = "flex";
            modal.style.zIndex = "99999";
            modal.style.opacity = "1";
            modal.style.transform = "translate(-50%, -50%) scale(1)";
            modal.classList.add("open");
        }

        if (autoAction === "file") {
            setTimeout(() => {
                const fileInput = document.getElementById("insp-file-input");
                if (fileInput) fileInput.click();
            }, 250);
        } else if (autoAction === "camera") {
            setTimeout(() => {
                const camInput = document.getElementById("insp-camera-input");
                if (camInput) camInput.click();
            }, 250);
        }
    },

    closeChecklistModal() {
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        this.closeWebcam();
        if (modal) {
            modal.classList.remove("open");
            modal.style.opacity = "0";
            modal.style.display = "none";
        }
        if (overlay) {
            overlay.classList.remove("open");
            overlay.style.display = "none";
        }
    },

    calculateScore() {
        const itemSelects = document.querySelectorAll(".checklist-item-select");
        const scoreVal = document.getElementById("checklist-score-val");
        const scoreStatus = document.getElementById("checklist-score-status");
        const scoreBar = document.getElementById("checklist-score-bar");
        const footerScore = document.getElementById("footer-score-indicator");

        let totalEvaluated = 0;
        let conformeCount = 0;
        itemSelects.forEach(sel => {
            const val = sel.value;
            sel.setAttribute("data-status", val);
            if (val !== "N/A") {
                totalEvaluated++;
                if (val === "Conforme") {
                    conformeCount++;
                }
            }
        });

        const score = totalEvaluated > 0 ? Math.round((conformeCount / totalEvaluated) * 100) : 100;
        
        let statusLabel = "Totalmente Regular";
        let statusColor = "#10b981";
        let barBg = "linear-gradient(90deg, #10b981, #34d399)";
        let badgeBg = "rgba(16, 185, 129, 0.15)";
        let badgeBorder = "rgba(16, 185, 129, 0.3)";

        if (score < 50) {
            statusLabel = "Crítico / Irregular";
            statusColor = "#ef4444";
            barBg = "linear-gradient(90deg, #ef4444, #f87171)";
            badgeBg = "rgba(239, 68, 68, 0.15)";
            badgeBorder = "rgba(239, 68, 68, 0.3)";
        } else if (score < 80) {
            statusLabel = "Atenção / Parcial";
            statusColor = "#f59e0b";
            barBg = "linear-gradient(90deg, #f59e0b, #fbbf24)";
            badgeBg = "rgba(245, 158, 11, 0.15)";
            badgeBorder = "rgba(245, 158, 11, 0.3)";
        }

        if (scoreVal) {
            scoreVal.textContent = `${score}%`;
            scoreVal.style.color = statusColor;
        }
        if (scoreStatus) {
            scoreStatus.textContent = statusLabel;
            scoreStatus.style.color = statusColor;
        }
        if (scoreBar) {
            scoreBar.style.width = `${score}%`;
            scoreBar.style.background = barBg;
            scoreBar.style.boxShadow = `0 0 10px ${statusColor}66`;
        }
        if (footerScore) {
            footerScore.textContent = `${score}% ${statusLabel}`;
            footerScore.style.color = statusColor;
            footerScore.style.background = badgeBg;
            footerScore.style.borderColor = badgeBorder;
        }

        return score;
    },

    // ==========================================================================
    // TELA DE INSPEÇÕES & LAUDOS TÉCNICOS ESTILO GESTÃOCLICK
    // ==========================================================================
    populateClientsDatalist() {
        const datalist = document.getElementById("gc-insp-clients-datalist");
        if (!datalist) return;
        const allRawLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem("comercial_leads")) || []);
        const leads = allRawLeads.filter(l => !l.deleted_at);
        const names = new Set();
        leads.forEach(l => { if (l.company) names.add(l.company.trim()); });
        datalist.innerHTML = Array.from(names).map(name => `<option value="${name}"></option>`).join("");
    },

    openInspectionScreen(leadId = null, interactionId = null, autoAction = null) {
        this.populateClientsDatalist();

        const titleEl = document.getElementById("gc-insp-title-action");
        const breadcrumbEl = document.getElementById("gc-insp-breadcrumb-action");
        const submitBtn = document.getElementById("gc-insp-btn-submit");

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined && val !== null ? val : "";
        };

        const todayStr = new Date().toISOString().split("T")[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const nextYearStr = nextYear.toISOString().split("T")[0];

        const currentUser = Auth.getCurrentUser();
        const inspectorDefault = currentUser?.name ? `Eng. ${currentUser.name}` : "Eng. San Charles (CREA 12345/PE)";

        if (leadId && interactionId) {
            const lead = Store.getLeadById(leadId);
            const item = lead?.interactions?.find(i => i.id === interactionId);
            if (lead && item) {
                if (titleEl) titleEl.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>Editar inspeção técnica & laudo</span>
                `;
                if (breadcrumbEl) breadcrumbEl.textContent = "Editar";
                if (submitBtn) submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Salvar alterações</span>
                `;

                setVal("gc-insp-lead-id", lead.id);
                setVal("gc-insp-interaction-id", item.id);
                setVal("gc-insp-number", item.meta?.inspectionNumber || `INSP-2026-${item.id.slice(-3)}`);
                setVal("gc-insp-client", lead.company || "");
                setVal("gc-insp-inspector", item.meta?.inspector || inspectorDefault);
                setVal("gc-insp-service-select", item.meta?.serviceName || "Amostragem Isocinética de Chaminé");
                setVal("gc-insp-exec-date", item.meta?.executionDate || item.timestamp?.split("T")[0] || todayStr);
                setVal("gc-insp-expiry-date", item.meta?.expiryDate || nextYearStr);
                setVal("gc-insp-status", item.meta?.status || "valida");
                setVal("gc-insp-location", item.meta?.location || lead.address || "Planta Central");
                setVal("gc-insp-contact", item.meta?.contact || lead.contact || "");
                setVal("gc-insp-equipment-tag", item.meta?.equipmentTag || "Chaminé Caldeira 01 / Duto Principal");
                setVal("gc-insp-technical-opinion", item.meta?.notes || item.description || "");
                setVal("gc-insp-notes", item.meta?.clientNotes || item.meta?.notes || "");
                setVal("gc-insp-internal-notes", item.meta?.internalNotes || "");

                this.renderChecklistTable(item.meta?.checklist);

                // Carregar serviços vinculados
                const tbody = document.getElementById("gc-insp-services-tbody");
                if (tbody) tbody.innerHTML = "";
                if (Array.isArray(item.meta?.servicesList) && item.meta.servicesList.length > 0) {
                    item.meta.servicesList.forEach(s => this.addServiceRow(s));
                } else {
                    this.addServiceRow({
                        service: item.meta?.serviceName || "Amostragem Isocinética de Chaminé",
                        details: "Coleta e determinação de material particulado e gases",
                        qty: 1,
                        price: item.meta?.serviceValue || 4500
                    });
                }
                const btnGcDelete = document.getElementById("gc-insp-btn-delete");
                if (btnGcDelete) btnGcDelete.style.display = "inline-flex";

                const btnGcActionRenew = document.getElementById("gc-insp-btn-action-renew");
                if (btnGcActionRenew) btnGcActionRenew.style.display = "inline-flex";
            }
        } else {
            // Nova Inspeção
            const btnGcDelete = document.getElementById("gc-insp-btn-delete");
            if (btnGcDelete) btnGcDelete.style.display = "none";

            const btnGcActionRenew = document.getElementById("gc-insp-btn-action-renew");
            if (btnGcActionRenew) btnGcActionRenew.style.display = "none";

            if (titleEl) titleEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span>Nova inspeção & laudo técnico</span>
            `;
            if (breadcrumbEl) breadcrumbEl.textContent = "Adicionar";
            if (submitBtn) submitBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Salvar inspeção</span>
            `;

            const totalExisting = this.getInspections().length + 1;
            const nextNumber = `INSP-2026-${String(totalExisting).padStart(3, '0')}`;
            const curInputVal = this._scannedInspectionNumber || document.getElementById("gc-insp-number")?.value;
            const finalNumber = (curInputVal && curInputVal !== "INSP-2026-001") ? curInputVal : nextNumber;

            let clientDefault = "";
            let contactDefault = "";
            let locationDefault = "";
            if (leadId) {
                const lead = Store.getLeadById(leadId);
                if (lead) {
                    clientDefault = lead.company || "";
                    contactDefault = lead.contact || "";
                    locationDefault = lead.address || "";
                }
            }

            setVal("gc-insp-lead-id", leadId || "");
            setVal("gc-insp-interaction-id", "");
            setVal("gc-insp-number", finalNumber);
            setVal("gc-insp-client", clientDefault);
            setVal("gc-insp-inspector", inspectorDefault);
            setVal("gc-insp-service-select", "Amostragem Isocinética de Chaminé");
            setVal("gc-insp-exec-date", todayStr);
            setVal("gc-insp-expiry-date", nextYearStr);
            setVal("gc-insp-status", "valida");
            setVal("gc-insp-location", locationDefault || "Planta Industrial / Unidade Operacional");
            setVal("gc-insp-contact", contactDefault);
            setVal("gc-insp-equipment-tag", "Chaminé Caldeira 01 / Duto Principal");
            setVal("gc-insp-technical-opinion", "A fonte poluidora operou em regime contínuo estável. Os parâmetros atenderam aos padrões de emissão regulamentados.");
            setVal("gc-insp-notes", "Laudo técnico com validade legal de 12 meses contados a partir da data de realização.");
            setVal("gc-insp-internal-notes", "");

            this.renderChecklistTable();

            const tbody = document.getElementById("gc-insp-services-tbody");
            if (tbody) tbody.innerHTML = "";
            this.addServiceRow({
                service: "Amostragem Isocinética de Chaminé",
                details: "Coleta e determinação de material particulado e gases em duto",
                qty: 1,
                price: 4500
            });
        }

        // Renderizar banner e histórico de renovações no cadastro GestãoClick
        this.renderRenewalsSection(leadId, interactionId);

        // Alternar visualização
        const listContainer = document.getElementById("inspections-list-container");
        const inspView = document.getElementById("gestaoclick-inspection-view");
        if (listContainer) listContainer.style.display = "none";
        if (inspView) inspView.style.display = "block";

        this.recalculateChecklistScore();
        this.recalculateServicesTotal();
        this.updateDaysSummary();
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (autoAction === "file") {
            setTimeout(() => {
                document.getElementById("insp-file-input")?.click();
            }, 150);
        }
    },

    closeInspectionScreen() {
        const btnGcDelete = document.getElementById("gc-insp-btn-delete");
        if (btnGcDelete) btnGcDelete.style.display = "none";
        const listContainer = document.getElementById("inspections-list-container");
        const inspView = document.getElementById("gestaoclick-inspection-view");
        if (inspView) inspView.style.display = "none";
        if (listContainer) listContainer.style.display = "block";
        this.render();
    },

    // ─── Renderização do Histórico e Linha do Tempo de Renovações ───────────────
    renderRenewalsSection(leadId, currentInteractionId) {
        const banner = document.getElementById("gc-insp-renewal-banner");
        const tbody = document.getElementById("gc-insp-renewals-tbody");
        const cycleBadge = document.getElementById("gc-insp-renewal-cycle-badge");
        const btnTopRenew = document.getElementById("gc-insp-btn-top-renew");
        const btnActionRenew = document.getElementById("gc-insp-btn-action-renew");

        if (!tbody) return;

        if (!leadId || !currentInteractionId) {
            if (banner) {
                banner.style.display = "none";
                banner.innerHTML = "";
            }
            if (cycleBadge) {
                cycleBadge.className = "gc-badge gc-badge-neutral";
                cycleBadge.textContent = "Novo Ciclo";
            }
            if (btnTopRenew) btnTopRenew.style.display = "none";
            if (btnActionRenew) btnActionRenew.style.display = "none";
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 12.5px;">
                        💡 O histórico de renovações e ciclos anuais será gerado automaticamente assim que você salvar esta inspeção.
                    </td>
                </tr>
            `;
            return;
        }

        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        const allLeadInspections = (lead.interactions || []).filter(i => i.type === "Inspeção");
        const currentItem = allLeadInspections.find(i => i.id === currentInteractionId);
        if (!currentItem) return;

        // Identificar antecessores e sucessores
        const successor = allLeadInspections.find(other => 
            other.id !== currentItem.id && (
                other.meta?.renewedFromId === currentItem.id ||
                currentItem.meta?.renewedToId === other.id ||
                (other.meta?.serviceName === currentItem.meta?.serviceName && 
                 (other.meta?.executionDate || "") > (currentItem.meta?.executionDate || ""))
            )
        );

        const predecessor = allLeadInspections.find(other => 
            other.id !== currentItem.id && (
                currentItem.meta?.renewedFromId === other.id ||
                other.meta?.renewedToId === currentItem.id ||
                (other.meta?.serviceName === currentItem.meta?.serviceName && 
                 (other.meta?.executionDate || "") < (currentItem.meta?.executionDate || ""))
            )
        );

        const isRenewed = Boolean(currentItem.meta?.isRenewed || currentItem.meta?.status === "renovada" || successor);

        const formatDate = (dateStr) => {
            if (!dateStr) return "N/A";
            const parts = dateStr.split("-");
            if (parts.length < 3) return dateStr;
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        // Atualizar Banner de Status no topo
        if (banner) {
            if (successor) {
                const sucNumber = successor.meta?.inspectionNumber || "Laudo Seguinte";
                const sucDate = formatDate(successor.meta?.executionDate);
                banner.className = "gc-renewal-alert gc-renewal-alert-renewed";
                banner.style.display = "flex";
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:24px;">🔄</span>
                        <div>
                            <strong style="font-size:14px; display:block; color:#1e3a8a; margin-bottom:2px;">Inspeção Renovada com Sucesso</strong>
                            <span style="font-size:12.5px; color:#1e40af;">Este laudo já possui renovação emitida pelo ciclo <strong>${sucNumber}</strong> (${sucDate}). Os parâmetros técnicos foram continuados no novo ciclo.</span>
                        </div>
                    </div>
                    <button type="button" class="gc-btn-main" style="font-size:12px; padding:6px 14px; min-height:34px; cursor:pointer;" onclick="window.Inspections.openInspectionScreen('${lead.id}', '${successor.id}')">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        <span>Abrir Ciclo Renovado (${sucNumber})</span>
                    </button>
                `;
            } else if (currentItem.meta?.status === "vencida" || currentItem.meta?.status === "alerta") {
                banner.className = "gc-renewal-alert gc-renewal-alert-pending";
                banner.style.display = "flex";
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:24px;">⚡</span>
                        <div>
                            <strong style="font-size:14px; display:block; color:#92400e; margin-bottom:2px;">Renovação Anual Pendente</strong>
                            <span style="font-size:12.5px; color:#b45309;">A validade deste laudo expirou ou está próxima ao vencimento de 1 ano. Emita o novo ciclo para manter o cliente em conformidade.</span>
                        </div>
                    </div>
                    <button type="button" class="gc-btn-renew" style="font-size:12px; padding:6px 14px; min-height:34px; cursor:pointer;" onclick="window.Inspections.createRenewalFrom('${lead.id}', '${currentItem.id}')">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        <span>Emitir Renovação (Novo Ciclo)</span>
                    </button>
                `;
            } else if (predecessor) {
                const predNumber = predecessor.meta?.inspectionNumber || "Laudo Anterior";
                banner.className = "gc-renewal-alert gc-renewal-alert-origin";
                banner.style.display = "flex";
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:22px;">📋</span>
                        <div>
                            <strong style="font-size:14px; display:block; color:#334155; margin-bottom:2px;">Ciclo Vigente (Renovação Ativa)</strong>
                            <span style="font-size:12.5px; color:#475569;">Esta inspeção é a renovação de continuidade do laudo anterior <strong>${predNumber}</strong>.</span>
                        </div>
                    </div>
                    <button type="button" class="gc-btn-sub" style="font-size:12px; padding:6px 14px; min-height:34px; font-weight:700; cursor:pointer;" onclick="window.Inspections.openInspectionScreen('${lead.id}', '${predecessor.id}')">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>Ver Laudo Anterior (${predNumber})</span>
                    </button>
                `;
            } else {
                banner.style.display = "none";
                banner.innerHTML = "";
            }
        }

        // Atualizar Badge do ciclo
        if (cycleBadge) {
            const curYear = (currentItem.meta?.executionDate || "").substring(0, 4) || "Atual";
            if (isRenewed) {
                cycleBadge.className = "gc-badge gc-badge-renewed";
                cycleBadge.textContent = `Ciclo ${curYear} (Renovado)`;
            } else {
                cycleBadge.className = "gc-badge gc-badge-success";
                cycleBadge.textContent = `Ciclo ${curYear} (Vigente)`;
            }
        }

        if (btnTopRenew) btnTopRenew.style.display = "inline-flex";
        if (btnActionRenew) btnActionRenew.style.display = "inline-flex";

        // Ordenar cronologicamente
        const sortedInspections = [...allLeadInspections].sort((a, b) => {
            const da = a.meta?.executionDate || a.timestamp || "";
            const db = b.meta?.executionDate || b.timestamp || "";
            return da.localeCompare(db);
        });

        tbody.innerHTML = sortedInspections.map((it, idx) => {
            const isCurrent = it.id === currentInteractionId;
            const itYear = (it.meta?.executionDate || it.timestamp || "").substring(0, 4) || `Ciclo ${idx + 1}`;
            const itNumber = it.meta?.inspectionNumber || `INSP-${itYear}-${it.id.slice(-3)}`;
            const itExec = formatDate(it.meta?.executionDate || it.timestamp?.split("T")[0]);
            const itExp = formatDate(it.meta?.expiryDate);
            
            const itSuccessor = allLeadInspections.find(o => 
                o.id !== it.id && (
                    o.meta?.renewedFromId === it.id ||
                    it.meta?.renewedToId === o.id ||
                    (o.meta?.serviceName === it.meta?.serviceName && (o.meta?.executionDate || "") > (it.meta?.executionDate || ""))
                )
            );
            const itIsRenewed = Boolean(it.meta?.isRenewed || it.meta?.status === "renovada" || itSuccessor);

            let itBadge = "";
            if (isCurrent) {
                itBadge = `<span class="gc-badge gc-badge-info" style="font-weight:700;">👉 Em Edição</span>`;
            } else if (itIsRenewed) {
                itBadge = `<span class="gc-badge gc-badge-renewed">🔄 Renovado</span>`;
            } else if (it.meta?.status === "vencida") {
                itBadge = `<span class="gc-badge gc-badge-danger">🔴 Vencido</span>`;
            } else if (it.meta?.status === "alerta") {
                itBadge = `<span class="gc-badge gc-badge-warning">🟠 Crítico</span>`;
            } else {
                itBadge = `<span class="gc-badge gc-badge-success">🟢 Vigente</span>`;
            }

            const rowBg = isCurrent ? "background: rgba(37, 99, 235, 0.04); font-weight: 600;" : "";

            return `
                <tr style="${rowBg}">
                    <td style="font-weight: 700; color: #1e293b;">
                        Ano ${itYear}
                        ${isCurrent ? '<span style="font-size:10px; color:#2563eb; display:block; font-weight:700;">(Visualizando)</span>' : ''}
                    </td>
                    <td>
                        <span style="font-family: monospace; font-size: 11.5px; background: rgba(99,102,241,0.08); color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(99,102,241,0.2);">
                            ${itNumber}
                        </span>
                        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${it.meta?.serviceName || 'Vistoria Geral'}</div>
                    </td>
                    <td style="color: #475569; font-size: 12px;">${itExec}</td>
                    <td style="color: #475569; font-size: 12px; font-weight: 600;">${itExp}</td>
                    <td style="text-align: center;">${itBadge}</td>
                    <td style="text-align: center;">
                        ${isCurrent 
                            ? '<span style="font-size: 11.5px; color: #2563eb; font-weight: 700;">Ativo</span>'
                            : `<button type="button" class="gc-btn-action gc-btn-action-cycle" onclick="window.Inspections.openInspectionScreen('${lead.id}', '${it.id}')" title="Abrir dados deste ciclo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Ver Ciclo</span></button>`
                        }
                    </td>
                </tr>
            `;
        }).join("");
    },

    // ─── Criação Automática do Ciclo de Renovação ──────────────────────────────
    async createRenewalFrom(leadId, currentInteractionId) {
        if (!leadId || !currentInteractionId) {
            alert("Selecione uma inspeção válida para renovar.");
            return;
        }

        const lead = Store.getLeadById(leadId);
        if (!lead) return;

        const currentItem = (lead.interactions || []).find(i => i.id === currentInteractionId);
        if (!currentItem) return;

        const oldNumber = currentItem.meta?.inspectionNumber || "este laudo";
        const confirmMsg = `Deseja emitir uma renovação para ${oldNumber} (${lead.company})?\n\nIsso criará automaticamente o próximo ciclo anual, incrementará o número do laudo e manterá o histórico conectado.`;
        if (!confirm(confirmMsg)) return;

        // Calcular novo número de laudo incrementando o ano (ex: ISO-2026-002 -> ISO-2027-002)
        let newNumber = "";
        const curYearMatch = (currentItem.meta?.inspectionNumber || "").match(/\b(20\d{2})\b/);
        if (curYearMatch) {
            const detectedYear = parseInt(curYearMatch[1], 10);
            const nextYearVal = detectedYear + 1;
            newNumber = currentItem.meta.inspectionNumber.replace(String(detectedYear), String(nextYearVal));
        } else {
            const thisYear = new Date().getFullYear();
            newNumber = `INSP-${thisYear + 1}-${String(Date.now()).slice(-3)}`;
        }

        const todayStr = new Date().toISOString().split("T")[0];
        const nextYearDate = new Date();
        nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
        const nextYearStr = nextYearDate.toISOString().split("T")[0];

        const newInteractionId = "int_" + Date.now().toString(36);

        // Atualizar inspeção anterior marcando como renovada
        currentItem.meta = currentItem.meta || {};
        currentItem.meta.isRenewed = true;
        currentItem.meta.status = "renovada";
        currentItem.meta.renewedToId = newInteractionId;

        // Clonar dados com novo ciclo anual conectado
        const newInteraction = {
            id: newInteractionId,
            type: "Inspeção",
            timestamp: new Date().toISOString(),
            description: `Renovação de vistoria: ${currentItem.meta?.serviceName || 'Vistoria Geral'} (${newNumber}). Ciclo sucessor de ${oldNumber}.`,
            meta: {
                ...JSON.parse(JSON.stringify(currentItem.meta)),
                inspectionNumber: newNumber,
                executionDate: todayStr,
                expiryDate: nextYearStr,
                status: "valida",
                isRenewed: false,
                renewedFromId: currentItem.id,
                renewedToId: null,
                internalNotes: `Renovação anual emitida automaticamente a partir do laudo ${oldNumber}.`
            }
        };

        lead.interactions.push(newInteraction);

        // Salvar no Store e sincronizar com Supabase
        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        try {
            if (typeof Store.updateLead === "function") {
                Store.updateLead(lead.id, { interactions: lead.interactions }, userEmail);
            } else {
                const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
                const updatedLocal = localLeads.map(l => l.id === lead.id ? lead : l);
                localStorage.setItem("comercial_leads", JSON.stringify(updatedLocal));
            }

            await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                method: "PATCH",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({ interactions: lead.interactions })
            }).catch(e => console.warn("Aviso PATCH:", e));
        } catch (e) {
            console.warn("Falha ao salvar renovação:", e);
        }

        Audit.logStageChange(userEmail, lead.company, lead.stage, lead.stage, `Emitiu Renovação de Inspeção: ${newNumber} (sucessora de ${oldNumber})`);

        // Abrir imediatamente a nova inspeção em tela
        this.openInspectionScreen(lead.id, newInteraction.id);
        this.render();

        alert(`🎉 Novo ciclo de renovação (${newNumber}) criado com sucesso!\nO histórico do cliente foi conectado e o laudo anterior foi arquivado como renovado.`);
    },

    renderChecklistTable(savedItems = null) {
        const tbody = document.getElementById("gc-insp-checklist-tbody");
        if (!tbody) return;

        const defaultItems = [
            { name: "Acesso Seguro e Plataforma de Amostragem", norm: "NR-12 / NBR 10701", status: "Conforme" },
            { name: "Bocais de Coleta e Diâmetro Mínimo (4 pol)", norm: "NBR 12019 / EPA M1", status: "Conforme" },
            { name: "Estanqueidade de Dutos e Vedação de Juntas", norm: "Procedimento Técnico Padrão", status: "Conforme" },
            { name: "Regime de Queima e Carga Operacional Contínua", norm: "Operação Nominal", status: "Conforme" },
            { name: "Calibração dos Sensores e Pitot Tipo S", norm: "Certificado RBC Vigente", status: "Conforme" },
            { name: "Aterramento Elétrico e Linha de Vida (NR-35)", norm: "NR-10 / NR-35", status: "Conforme" },
            { name: "Gestão dos Resíduos da Coleta Isocinética", norm: "CONAMA / CPRH", status: "Conforme" },
            { name: "Prontuário Técnico e Emissão da ART", norm: "CREA / CONFEA", status: "Conforme" }
        ];

        const items = Array.isArray(savedItems) && savedItems.length > 0 ? savedItems : defaultItems;

        tbody.innerHTML = items.map((it, idx) => {
            const currentStatus = it.status || "Conforme";
            return `
                <tr data-index="${idx}" data-name="${it.name}">
                    <td style="font-weight: 600; color: #1e293b;">${it.name}</td>
                    <td style="color: #64748b; font-size: 11.5px;">${it.norm || 'Norma Vigente'}</td>
                    <td style="text-align: center;">
                        <div class="gc-btn-group-toggle">
                            <button type="button" class="gc-toggle-btn ${currentStatus === 'Conforme' ? 'active-conforme' : ''}" data-val="Conforme" title="Conforme">✓ Conforme</button>
                            <button type="button" class="gc-toggle-btn ${currentStatus === 'Não Conforme' ? 'active-nao-conforme' : ''}" data-val="Não Conforme" title="Não Conforme">✗ Não Conf.</button>
                            <button type="button" class="gc-toggle-btn ${currentStatus === 'Não Aplica' ? 'active-nao-aplica' : ''}" data-val="Não Aplica" title="Não se Aplica">N/A</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll(".gc-toggle-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const group = e.target.closest(".gc-btn-group-toggle");
                group.querySelectorAll(".gc-toggle-btn").forEach(b => {
                    b.classList.remove("active-conforme", "active-nao-conforme", "active-nao-aplica");
                });
                const val = e.target.getAttribute("data-val");
                if (val === "Conforme") e.target.classList.add("active-conforme");
                else if (val === "Não Conforme") e.target.classList.add("active-nao-conforme");
                else e.target.classList.add("active-nao-aplica");

                this.recalculateChecklistScore();
            });
        });

        this.recalculateChecklistScore();
    },

    recalculateChecklistScore() {
        const rows = document.querySelectorAll("#gc-insp-checklist-tbody tr");
        let total = 0;
        let conformes = 0;

        rows.forEach(tr => {
            const activeBtn = tr.querySelector(".gc-toggle-btn.active-conforme, .gc-toggle-btn.active-nao-conforme, .gc-toggle-btn.active-nao-aplica");
            const val = activeBtn ? activeBtn.getAttribute("data-val") : "Conforme";
            if (val !== "Não Aplica") {
                total++;
                if (val === "Conforme") conformes++;
            }
        });

        const score = total > 0 ? Math.round((conformes / total) * 100) : 100;

        const badge = document.getElementById("gc-insp-score-badge");
        const summaryScore = document.getElementById("gc-insp-summary-score");

        let badgeClass = "gc-badge gc-badge-success";
        let text = `${score}% de conformidade (Regular)`;

        if (score < 60) {
            badgeClass = "gc-badge gc-badge-danger";
            text = `${score}% de conformidade (Crítico / Irregular)`;
        } else if (score < 85) {
            badgeClass = "gc-badge gc-badge-warning";
            text = `${score}% de conformidade (Atenção / Ressalvas)`;
        }

        if (badge) {
            badge.className = badgeClass;
            badge.textContent = text;
        }
        if (summaryScore) {
            summaryScore.value = text;
        }

        return score;
    },

    updateDaysSummary() {
        const expiryInput = document.getElementById("gc-insp-expiry-date")?.value;
        const summaryDays = document.getElementById("gc-insp-summary-days");
        if (!summaryDays || !expiryInput) return;

        const today = new Date();
        today.setHours(0,0,0,0);
        const exp = new Date(expiryInput + "T12:00:00");
        exp.setHours(0,0,0,0);

        const diffTime = exp.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

        if (diffDays < 0) {
            summaryDays.value = `Vencido há ${Math.abs(diffDays)} dias`;
            summaryDays.style.color = "#dc2626";
        } else {
            summaryDays.value = `Vence em ${diffDays} dias (${(diffDays / 30).toFixed(1)} meses)`;
            summaryDays.style.color = diffDays <= 90 ? "#d97706" : "#16a34a";
        }
    },

    addServiceRow(data = null) {
        const tbody = document.getElementById("gc-insp-services-tbody");
        if (!tbody) return;

        const serviceName = data?.service || "Amostragem Isocinética de Chaminé";
        const details = data?.details || "";
        const qty = parseFloat(data?.qty || 1);
        const price = parseFloat(data?.price || 4500);
        const sub = qty * price;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <select class="gc-select gc-insp-service-name" style="font-size: 12.5px;">
                    <option value="Amostragem Isocinética de Chaminé">Amostragem Isocinética de Chaminé</option>
                    <option value="Inspeção NR-13 (Caldeiras e Vasos)">Inspeção NR-13 (Caldeiras e Vasos)</option>
                    <option value="Laudo NR-12 (Segurança de Máquinas)">Laudo NR-12 (Segurança de Máquinas)</option>
                    <option value="Licenciamento e Monitoramento Ambiental">Licenciamento e Monitoramento Ambiental</option>
                    <option value="Laudo Elétrico NR-10 e SPDA">Laudo Elétrico NR-10 e SPDA</option>
                    <option value="Medição de Ruído e Poluentes">Medição de Ruído e Poluentes</option>
                    <option value="Emissão de ART e Parecer Técnico">Emissão de ART e Parecer Técnico</option>
                </select>
            </td>
            <td>
                <input type="text" class="gc-input gc-insp-item-details" placeholder="Metodologia e escopo..." value="${details}">
            </td>
            <td>
                <input type="number" class="gc-input gc-insp-item-qty" min="1" value="${qty}" style="text-align: center;">
            </td>
            <td>
                <input type="number" step="0.01" class="gc-input gc-insp-item-price" value="${price.toFixed(2)}" style="text-align: right;">
            </td>
            <td>
                <input type="text" class="gc-input gc-insp-item-subtotal gc-input-readonly" value="R$ ${sub.toLocaleString('pt-BR', {minimumFractionDigits: 2})}" readonly style="text-align: right; font-weight: 600;">
            </td>
            <td style="text-align: center;">
                <button type="button" class="gc-btn-delete-row" title="Remover item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </td>
        `;

        const sel = tr.querySelector(".gc-insp-service-name");
        if (sel) sel.value = serviceName;

        const updateSub = () => {
            const q = parseFloat(tr.querySelector(".gc-insp-item-qty")?.value) || 0;
            const p = parseFloat(tr.querySelector(".gc-insp-item-price")?.value) || 0;
            const s = q * p;
            const subInput = tr.querySelector(".gc-insp-item-subtotal");
            if (subInput) subInput.value = `R$ ${s.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            this.recalculateServicesTotal();
        };

        tr.querySelector(".gc-insp-item-qty")?.addEventListener("input", updateSub);
        tr.querySelector(".gc-insp-item-price")?.addEventListener("input", updateSub);
        tr.querySelector(".gc-btn-delete-row")?.addEventListener("click", () => {
            tr.remove();
            this.recalculateServicesTotal();
        });

        tbody.appendChild(tr);
        this.recalculateServicesTotal();
    },

    recalculateServicesTotal() {
        const rows = document.querySelectorAll("#gc-insp-services-tbody tr");
        let total = 0;

        rows.forEach(tr => {
            const q = parseFloat(tr.querySelector(".gc-insp-item-qty")?.value) || 0;
            const p = parseFloat(tr.querySelector(".gc-insp-item-price")?.value) || 0;
            total += (q * p);
        });

        const totalEl = document.getElementById("gc-insp-summary-total");
        if (totalEl) totalEl.value = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    },

    async saveInspectionFromScreen(exportPdfAfter = false) {
        const clientName = document.getElementById("gc-insp-client")?.value.trim();
        if (!clientName) {
            alert("Por favor, preencha o nome da Empresa / Cliente.");
            document.getElementById("gc-insp-client")?.focus();
            return;
        }

        let leadId = document.getElementById("gc-insp-lead-id")?.value;
        const interactionId = document.getElementById("gc-insp-interaction-id")?.value;
        const number = document.getElementById("gc-insp-number")?.value;
        const inspector = document.getElementById("gc-insp-inspector")?.value;
        const service = document.getElementById("gc-insp-service-select")?.value;
        const execDate = document.getElementById("gc-insp-exec-date")?.value || new Date().toISOString().split("T")[0];
        const expiryDate = document.getElementById("gc-insp-expiry-date")?.value;
        const status = document.getElementById("gc-insp-status")?.value;
        const location = document.getElementById("gc-insp-location")?.value;
        const contact = document.getElementById("gc-insp-contact")?.value;
        const equipmentTag = document.getElementById("gc-insp-equipment-tag")?.value;
        const opinion = document.getElementById("gc-insp-technical-opinion")?.value;
        const clientNotes = document.getElementById("gc-insp-notes")?.value;
        const internalNotes = document.getElementById("gc-insp-internal-notes")?.value;

        const score = this.recalculateChecklistScore();

        // Checklist Payload
        const checklistPayload = [];
        document.querySelectorAll("#gc-insp-checklist-tbody tr").forEach(tr => {
            const name = tr.getAttribute("data-name");
            const activeBtn = tr.querySelector(".gc-toggle-btn.active-conforme, .gc-toggle-btn.active-nao-conforme, .gc-toggle-btn.active-nao-aplica");
            const val = activeBtn ? activeBtn.getAttribute("data-val") : "Conforme";
            checklistPayload.push({ name, status: val });
        });

        // Serviços vinculados
        const servicesList = [];
        let totalVal = 0;
        document.querySelectorAll("#gc-insp-services-tbody tr").forEach(tr => {
            const sName = tr.querySelector(".gc-insp-service-name")?.value;
            const det = tr.querySelector(".gc-insp-item-details")?.value;
            const q = parseFloat(tr.querySelector(".gc-insp-item-qty")?.value) || 1;
            const p = parseFloat(tr.querySelector(".gc-insp-item-price")?.value) || 0;
            totalVal += (q * p);
            servicesList.push({ service: sName, details: det, qty: q, price: p, subtotal: q * p });
        });

        // Obter ou criar lead
        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);
        let lead = null;
        if (leadId) {
            lead = leads.find(l => l.id === leadId);
        }
        if (!lead) {
            lead = leads.find(l => l.company && l.company.toLowerCase() === clientName.toLowerCase());
        }
        if (!lead) {
            const createFn = Store.createLead || Store.addLead;
            lead = createFn.call(Store, {
                company: clientName,
                contact: contact || "Responsável Técnico",
                address: location || "",
                source: "Inspeção GestãoClick",
                stage: "Cliente Ativo"
            });
            if (lead) leadId = lead.id;
        }

        if (!lead) {
            alert("Erro: Não foi possível localizar ou criar o cadastro desta empresa.");
            return;
        }

        const opinionText = opinion || "";
        const serviceText = service || "Inspeção Geral";
        const numberVal = document.getElementById("gc-insp-number")?.value?.trim();
        const numberText = numberVal || (number ? number.trim() : `INSP-2026-${String(Date.now()).slice(-4)}`);

        // Obter metadados prévios se for edição
        const existingItem = (interactionId && lead.interactions) ? lead.interactions.find(i => i.id === interactionId) : null;
        const existingMeta = existingItem?.meta || {};

        const newOrUpdatedInteraction = {
            id: interactionId || ("int_" + Date.now().toString(36)),
            type: "Inspeção",
            timestamp: new Date().toISOString(),
            description: `Vistoria de ${serviceText} (${numberText}) realizada com ${score}% de conformidade. Parecer: ${opinionText.substring(0, 100)}...`,
            meta: {
                ...existingMeta,
                inspectionNumber: numberText,
                inspector: inspector || "Técnico Responsável",
                serviceName: serviceText,
                serviceValue: totalVal,
                servicesList: servicesList,
                score: score,
                executionDate: execDate,
                expiryDate: expiryDate,
                status: status || "valida",
                isRenewed: status === "renovada" ? true : (existingMeta.isRenewed || false),
                renewedFromId: existingMeta.renewedFromId || null,
                renewedToId: existingMeta.renewedToId || null,
                location: location || "",
                contact: contact || "",
                equipmentTag: equipmentTag || "",
                notes: opinionText,
                clientNotes: clientNotes || "",
                internalNotes: internalNotes || "",
                checklist: checklistPayload
            }
        };

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        if (!lead.interactions) lead.interactions = [];
        if (interactionId) {
            const idx = lead.interactions.findIndex(i => i.id === interactionId);
            if (idx >= 0) lead.interactions[idx] = newOrUpdatedInteraction;
            else lead.interactions.push(newOrUpdatedInteraction);
        } else {
            lead.interactions.push(newOrUpdatedInteraction);
        }

        try {
            if (typeof Store.updateLead === "function") {
                Store.updateLead(lead.id, { interactions: lead.interactions }, userEmail);
            } else {
                const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
                const updatedLocal = localLeads.map(l => l.id === lead.id ? lead : l);
                localStorage.setItem("comercial_leads", JSON.stringify(updatedLocal));
            }

            // Sincronizar Supabase
            await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                method: "PATCH",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({ interactions: lead.interactions })
            }).catch(e => console.warn("Aviso PATCH:", e));
        } catch (e) {
            console.warn("Falha ao salvar no Supabase, mantido em cache local:", e);
        }

        Audit.logStageChange(userEmail, lead.company, lead.stage, lead.stage, `Registrou Inspeção Técnica: ${serviceText} (${numberText}) - Score: ${score}%`);

        alert("✅ Inspeção técnica e laudo salvos com sucesso no padrão GestãoClick!");

        if (exportPdfAfter) {
            window.generateInspectionPDF(lead.id, newOrUpdatedInteraction.id);
        }

        this.closeInspectionScreen();
        this.render();
    },

    async deleteInspection(leadId, inspectionId) {
        if (!leadId || !inspectionId) return;

        const allLeads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem("comercial_leads")) || []);
        const lead = allLeads.find(l => l.id === leadId) || (Store.getLeadById ? Store.getLeadById(leadId) : null);

        if (!lead) {
            alert("Erro: Empresa / Lead correspondente não foi localizado.");
            return;
        }

        const item = (lead.interactions || []).find(i => i.id === inspectionId);
        const serviceName = item?.meta?.serviceName || item?.description || "Vistoria Geral";

        const confirmed = confirm(`⚠️ Tem certeza que deseja EXCLUIR esta inspeção?\n\n• Empresa: ${lead.company}\n• Serviço: ${serviceName}\n\nEsta ação removerá o laudo e o histórico desta vistoria permanentemente.`);
        if (!confirmed) return;

        lead.interactions = (lead.interactions || []).filter(i => i.id !== inspectionId);

        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        try {
            if (typeof Store.updateLead === "function") {
                Store.updateLead(lead.id, { interactions: lead.interactions }, userEmail);
            } else {
                const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
                const updatedLocal = localLeads.map(l => l.id === lead.id ? lead : l);
                localStorage.setItem("comercial_leads", JSON.stringify(updatedLocal));
            }

            const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                method: "PATCH",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                    interactions: lead.interactions
                })
            });

            if (res.ok) {
                console.log("✅ [Inspections] Inspeção excluída e sincronizada com Supabase.");
            } else {
                console.warn("⚠️ [Inspections] Inspeção excluída localmente, resposta Supabase:", await res.text());
            }
        } catch (err) {
            console.error("Erro ao sincronizar exclusão com Supabase:", err);
        }

        if (typeof Audit !== "undefined" && Audit.logStageChange) {
            Audit.logStageChange(userEmail, lead.company, lead.stage || "Cliente", lead.stage || "Cliente", `Excluiu a inspeção técnica de "${serviceName}"`);
        }

        const openLeadId = document.getElementById("gc-insp-lead-id")?.value;
        const openInspId = document.getElementById("gc-insp-interaction-id")?.value;
        if (openLeadId === leadId && openInspId === inspectionId) {
            this.closeInspectionScreen();
        }

        this.render();

        if (window.CRM && typeof window.CRM.renderDrawerInspections === "function") {
            window.CRM.renderDrawerInspections(lead);
        }

        alert(`✅ A inspeção "${serviceName}" da empresa "${lead.company}" foi excluída com sucesso!`);
    },

    startGcWebcam() {
        const container = document.getElementById("gc-insp-webcam-container");
        const video = document.getElementById("gc-insp-webcam-video");
        if (!container || !video) return;

        container.style.display = "block";
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
            })
            .then(stream => {
                this._gcWebcamStream = stream;
                video.srcObject = stream;
            })
            .catch(err => {
                console.error("Erro na webcam GestãoClick:", err);
                alert("Não foi possível acessar a câmera do dispositivo.");
                container.style.display = "none";
            });
        }
    },

    captureGcWebcam() {
        const video = document.getElementById("gc-insp-webcam-video");
        if (!video) return;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `captura_laudo_${Date.now()}.jpg`, { type: "image/jpeg" });
                this.closeGcWebcam();
                this.handleDocumentInput(file);
            }
        }, "image/jpeg", 0.9);
    },

    closeGcWebcam() {
        const container = document.getElementById("gc-insp-webcam-container");
        if (container) container.style.display = "none";
        if (this._gcWebcamStream) {
            this._gcWebcamStream.getTracks().forEach(t => t.stop());
            this._gcWebcamStream = null;
        }
    },

    // ─── MÓDULO INTELIGENTE: LEITURA DE PDF & CÂMERA ──────────────────────────
    async handleDocumentInput(file) {
        if (!file) return;

        const loadingBox = document.getElementById("insp-scanner-loading");
        const statusText = document.getElementById("insp-scanner-status-text");
        const successBox = document.getElementById("insp-scanner-success");
        const summaryText = document.getElementById("insp-scanner-summary");

        if (loadingBox) loadingBox.style.display = "flex";
        if (successBox) successBox.style.display = "none";

        try {
            const isPdf = file.name?.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
            let parsedData = null;

            if (isPdf) {
                if (statusText) statusText.textContent = "📄 Lendo páginas do PDF e extraindo dados do laudo...";
                parsedData = await this.extractFromPdf(file);
            } else {
                if (statusText) statusText.textContent = "📷 Analisando foto do documento com Inteligência Artificial...";
                parsedData = await this.extractFromImage(file);
            }

            if (!parsedData) {
                throw new Error("Não foi possível identificar informações estruturadas.");
            }

            this.applyExtractedData(parsedData);

            if (loadingBox) loadingBox.style.display = "none";
            if (successBox) {
                successBox.style.display = "block";
                if (summaryText) {
                    summaryText.textContent = `Laudo lido! Cliente: "${parsedData.company || 'Detectado'}" | Serviço: "${parsedData.serviceName || 'Geral'}" | Validade: ${parsedData.expiryDate || '1 ano'}`;
                }
            }
        } catch (err) {
            console.error("[Inspections] Erro ao analisar documento:", err);
            if (loadingBox) loadingBox.style.display = "none";
            alert("Aviso: Não foi possível ler automaticamente todos os dados deste documento. Você pode preencher os campos manualmente.");
        }
    },

    async extractFromPdf(file) {
        if (typeof pdfjsLib === 'undefined' && window.LazyLoader) {
            await window.LazyLoader.ensurePdfJs();
        }
        if (typeof pdfjsLib !== 'undefined') {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                const maxPages = Math.min(pdf.numPages, 12);
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageStr = textContent.items.map(item => item.str).join(" ");
                    fullText += `\n--- Página ${i} ---\n` + pageStr;
                }

                if (fullText.trim().length > 30) {
                    return this.parseInspectionText(fullText, file.name);
                }
            } catch (pdfErr) {
                console.warn("[Inspections] Falha ao extrair texto do PDF via PDF.js:", pdfErr);
            }
        }

        return this.parseInspectionText(file.name || "", file.name);
    },

    async extractFromImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                const base64Data = dataUrl.split(",")[1];
                const mimeType = file.type || "image/jpeg";

                const apiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key") || "";
                if (apiKey) {
                    try {
                        const geminiRes = await this.callGeminiVisionForInspection(base64Data, mimeType, apiKey);
                        if (geminiRes) {
                            resolve(geminiRes);
                            return;
                        }
                    } catch (gErr) {
                        console.warn("[Inspections] Erro no Gemini Vision, usando extrator local:", gErr);
                    }
                }

                resolve(this.parseInspectionText(file.name || "Foto de Laudo Técnico", file.name));
            };
            reader.readAsDataURL(file);
        });
    },

    async callGeminiVisionForInspection(base64Data, mimeType, apiKey) {
        const prompt = `Analise este laudo técnico ambiental ou industrial.
Extraia e retorne EXCLUSIVAMENTE um objeto JSON (sem formatação markdown) com:
{
  "inspectionNumber": "Código, identificador ou número do laudo/relatório se presente no documento (ex: ISO-2026-002, LT-2026-01, REL-042/26, INSP-2026-001, etc.) ou vazio se não houver",
  "company": "Razão social ou nome da empresa/condomínio/indústria",
  "serviceName": "AMOSTRAGEM ISOCINÉTICA DE EMISSÕES ATMOSFÉRICAS" | "MONITORAMENTO DA QUALIDADE DO AR" | "MONITORAMENTO DO NÍVEL DE PRESSÃO SONORA EM AMBIENTES EXTERNOS (Ruído Ambiental)" | "INSPEÇÃO DE SEGURANÇA - NR13" | "TESTE DE ESTANQUEIDADE" | "PROGRAMA DE GERENCIAMENTO DE RESÍDUOS SÓLIDOS (PGRS)" | "OUTROS",
  "executionDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "score": 100 ou entre 40 e 100 se houver irregularidades,
  "isIrregular": false,
  "notes": "Resumo do parecer técnico, parâmetros medidos, ART e engenheiro responsável"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Data } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    response_mime_type: "application/json"
                }
            })
        });

        if (!response.ok) return null;
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        try {
            return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
        } catch(e) {
            return null;
        }
    },

    parseInspectionText(rawText, filename = "") {
        const text = (rawText + " " + filename).toLowerCase();
        const originalText = rawText || "";

        // 0. Identificar Número/Código do Laudo (ex: ISO-2026-002, LT-2026-01, RL-012/26, etc.)
        let detectedNumber = "";
        
        // Padrão explícito por termos de laudo/relatório/código
        const numberMatch = originalText.match(/(?:Laudo(?:\s+T[ée]cnico)?|Relat[óo]rio(?:\s+T[ée]cnico)?|N[º°o]\s+do\s+Laudo|N[º°o]\s+do\s+Relat[óo]rio|Identifica[çc][ãa]o|Inspe[çc][ãa]o|Certificado|Doc(?:umento)?|C[óo]digo)[\s:Nº°o#\.\-]+([A-Za-z0-9]{2,8}(?:[-_\/\.][A-Za-z0-9]{1,8})+)/i);
        if (numberMatch && numberMatch[1]) {
            detectedNumber = numberMatch[1].trim();
        }

        // Padrões diretos de códigos alfanuméricos com hífens/barras (como ISO-2026-002, LT-2026-01, INSP-2026-01)
        if (!detectedNumber) {
            const codePatterns = [
                /\b(ISO-[0-9]{4}-[0-9]{2,4})\b/i,
                /\b([A-Z]{2,6}[-_][0-9]{4}[-_][0-9]{2,4})\b/i,
                /\b([A-Z]{2,6}[-_][0-9]{2,4}[-_][0-9]{2,4})\b/i,
                /\b([A-Z]{2,6}[-\/][0-9]{2,4}\/[0-9]{2,4})\b/i,
                /\b([A-Z]{2,6}[0-9]{3,6}[A-Z0-9\-]*)\b/i
            ];
            for (const pat of codePatterns) {
                const match = originalText.match(pat);
                if (match && match[1]) {
                    detectedNumber = match[1].trim();
                    break;
                }
            }
        }

        if (!detectedNumber && filename) {
            const fileMatch = filename.match(/\b([A-Za-z]{2,6}[-_][0-9]{4}[-_][0-9]{1,4})\b/i) ||
                              filename.match(/\b([A-Za-z]{2,6}[-_][0-9]{1,6})\b/i);
            if (fileMatch && fileMatch[1]) {
                detectedNumber = fileMatch[1].trim();
            }
        }

        // 1. Identificar Empresa / Cliente
        let detectedCompany = "";
        const leads = Store.getLeads() || [];

        for (const lead of leads) {
            if (lead.company && text.includes(lead.company.toLowerCase())) {
                detectedCompany = lead.company;
                break;
            }
        }

        if (!detectedCompany) {
            const companyMatch = originalText.match(/(?:Cliente|Razão Social|Tomador|Contratante|Empresa|Proprietário|Condomínio|Edifício|Indústria|Unidade)[\s:]+([A-Za-z0-9À-ÿ\.\-\s]{3,50})/i);
            if (companyMatch && companyMatch[1]) {
                detectedCompany = companyMatch[1].trim().replace(/\r?\n.*/g, "");
            } else if (filename) {
                const cleanName = filename.replace(/\.(pdf|png|jpe?g|webp)$/i, "").replace(/[-_]/g, " ").trim();
                if (cleanName.length > 3) detectedCompany = cleanName;
            }
        }

        // 2. Identificar Serviço Inspecionado (7 Serviços Oficiais)
        let serviceName = "OUTROS";
        if (text.includes("isocinética") || text.includes("isocinetica") || text.includes("amostragem isocinética") || text.includes("emissões atmosféricas") || text.includes("emissao atmosferica") || text.includes("chaminé") || text.includes("chamine") || text.includes("dutos de exaustão") || text.includes("mp (material particulado)")) {
            serviceName = "AMOSTRAGEM ISOCINÉTICA DE EMISSÕES ATMOSFÉRICAS";
        } else if (text.includes("qualidade do ar") || text.includes("ar ambiente") || text.includes("conama 491") || text.includes("partículas inaláveis") || text.includes("pm10") || text.includes("pm2.5") || text.includes("gases poluentes")) {
            serviceName = "MONITORAMENTO DA QUALIDADE DO AR";
        } else if (text.includes("ruído") || text.includes("ruido") || text.includes("pressão sonora") || text.includes("pressao sonora") || text.includes("ruído ambiental") || text.includes("ruido ambiental") || text.includes("nbr 10151") || text.includes("decibéis") || text.includes("decibeis") || text.includes("dba") || text.includes("acústico")) {
            serviceName = "MONITORAMENTO DO NÍVEL DE PRESSÃO SONORA EM AMBIENTES EXTERNOS (Ruído Ambiental)";
        } else if (text.includes("nr-13") || text.includes("nr13") || text.includes("caldeira") || text.includes("caldeiras") || text.includes("vaso de pressão") || text.includes("vasos de pressão") || text.includes("tubulação industrial") || text.includes("tanque metálico")) {
            serviceName = "INSPEÇÃO DE SEGURANÇA - NR13";
        } else if (text.includes("estanqueidade") || text.includes("teste de estanqueidade") || text.includes("estanque") || text.includes("vazamento de gás") || text.includes("glp") || text.includes("gn") || text.includes("rede de gás")) {
            serviceName = "TESTE DE ESTANQUEIDADE";
        } else if (text.includes("pgrs") || text.includes("resíduos sólidos") || text.includes("residuos solidos") || text.includes("gerenciamento de resíduos") || text.includes("plano de gerenciamento de resíduos")) {
            serviceName = "PROGRAMA DE GERENCIAMENTO DE RESÍDUOS SÓLIDOS (PGRS)";
        }

        // 3. Identificar Data de Execução
        let executionDate = new Date().toISOString().split("T")[0];
        const dateMatch = originalText.match(/(?:Data(?:\s+da\s+(?:Vistoria|Inspeção|Realização|Coleta|Medição))?|Executado\s+em|Emissão)[\s:]*([0-3]?[0-9][/\-\.][0-1]?[0-9][/\-\.][1-2][0-9]{3})/i) ||
                           originalText.match(/\b([0-3][0-9][/\-\.][0-1][0-9][/\-\.](?:202[0-9]))\b/);

        if (dateMatch && dateMatch[1]) {
            const rawD = dateMatch[1].replace(/[\-\.]/g, "/");
            const parts = rawD.split("/");
            if (parts.length === 3) {
                const day = parts[0].padStart(2, "0");
                const month = parts[1].padStart(2, "0");
                const year = parts[2];
                if (parseInt(year) >= 2020 && parseInt(year) <= 2035) {
                    executionDate = `${year}-${month}-${day}`;
                }
            }
        }

        // 4. Identificar Data de Vencimento
        let expiryDate = "";
        const expiryMatch = originalText.match(/(?:Validade|Vencimento|Próxima\s+(?:Vistoria|Inspeção|Campanha)|Válido\s+até)[\s:]*([0-3]?[0-9][/\-\.][0-1]?[0-9][/\-\.][1-2][0-9]{3})/i);
        if (expiryMatch && expiryMatch[1]) {
            const rawD = expiryMatch[1].replace(/[\-\.]/g, "/");
            const parts = rawD.split("/");
            if (parts.length === 3) {
                const day = parts[0].padStart(2, "0");
                const month = parts[1].padStart(2, "0");
                const year = parts[2];
                if (parseInt(year) >= 2020 && parseInt(year) <= 2035) {
                    expiryDate = `${year}-${month}-${day}`;
                }
            }
        }

        if (!expiryDate) {
            const d = new Date(executionDate + "T12:00:00");
            d.setFullYear(d.getFullYear() + 1);
            expiryDate = d.toISOString().split("T")[0];
        }

        // 5. Conformidade e Score
        let score = 100;
        let isIrregular = text.includes("não conforme") || text.includes("irregularidade") || text.includes("reprovado") || text.includes("acima do limite") || text.includes("ultrapassou o limite") || text.includes("pendência crítica");
        if (isIrregular) {
            score = 60;
        }

        // 6. Parecer Técnico
        let notes = "";
        const conclusionMatch = originalText.match(/(?:Conclusão|Parecer Técnico|Considerações Finais|Recomendações|Resultado)[\s:]+([^\r\n]{10,250})/i);
        if (conclusionMatch && conclusionMatch[1]) {
            notes = conclusionMatch[1].trim();
        } else {
            notes = `Laudo técnico de ${serviceName} registrado. Parâmetros técnicos em conformidade com normas regulamentadoras vigentes.`;
        }

        const artMatch = originalText.match(/(?:ART|RRT)[\s:Nº#]+([0-9A-Za-z\.\-]+)/i);
        if (artMatch && artMatch[1]) {
            notes += ` | ART: ${artMatch[1].trim()}`;
        }

        return {
            inspectionNumber: detectedNumber,
            company: detectedCompany,
            serviceName: serviceName,
            executionDate: executionDate,
            expiryDate: expiryDate,
            score: score,
            isIrregular: isIrregular,
            notes: notes
        };
    },

    applyExtractedData(data) {
        if (!data) return;

        const leadSelect = document.getElementById("checklist-lead-select");
        const selectService = document.getElementById("checklist-service-select");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const notesArea = document.getElementById("checklist-notes");
        const itemSelects = document.querySelectorAll(".checklist-item-select");

        if (data.company && leadSelect) {
            let found = false;
            for (let i = 0; i < leadSelect.options.length; i++) {
                if (leadSelect.options[i].text.toLowerCase().includes(data.company.toLowerCase())) {
                    leadSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }

            if (!found) {
                const newOpt = document.createElement("option");
                newOpt.value = `__NEW__:${data.company}`;
                newOpt.text = `✨ ${data.company} (Detectado no laudo)`;
                leadSelect.appendChild(newOpt);
                leadSelect.value = newOpt.value;
            }
        }

        if (data.serviceName && selectService) {
            const targetNorm = data.serviceName.toUpperCase().trim();
            for (let i = 0; i < selectService.options.length; i++) {
                const optVal = selectService.options[i].value.toUpperCase().trim();
                const optText = selectService.options[i].text.toUpperCase().trim();
                if (optVal === targetNorm || optText.includes(targetNorm) || targetNorm.includes(optVal)) {
                    selectService.selectedIndex = i;
                    break;
                }
            }
        }

        if (data.executionDate && inputExecDate) {
            inputExecDate.value = data.executionDate;
        }
        if (data.expiryDate && inputExpiryDate) {
            inputExpiryDate.value = data.expiryDate;
        }

        if (data.notes && notesArea) {
            notesArea.value = data.notes;
        }

        if (data.isIrregular) {
            if (itemSelects.length >= 2) {
                itemSelects[0].value = "Não Conforme";
                itemSelects[1].value = "Não Conforme";
            }
        } else {
            itemSelects.forEach(sel => sel.value = "Conforme");
        }

        // Sincronizar com os campos da nova tela GestãoClick
        const gcNumber = document.getElementById("gc-insp-number");
        const gcClient = document.getElementById("gc-insp-client");
        const gcService = document.getElementById("gc-insp-service-select");
        const gcExecDate = document.getElementById("gc-insp-exec-date");
        const gcExpiryDate = document.getElementById("gc-insp-expiry-date");
        const gcNotes = document.getElementById("gc-insp-notes");
        const gcEqTag = document.getElementById("gc-insp-equipment-tag");

        if (data.inspectionNumber) {
            this._scannedInspectionNumber = data.inspectionNumber;
            if (gcNumber) gcNumber.value = data.inspectionNumber;
        }
        if (data.company && gcClient) gcClient.value = data.company;
        if (data.serviceName && gcService) {
            for (let i = 0; i < gcService.options.length; i++) {
                if (gcService.options[i].text.toLowerCase().includes(data.serviceName.toLowerCase()) || data.serviceName.toLowerCase().includes(gcService.options[i].text.toLowerCase())) {
                    gcService.selectedIndex = i;
                    break;
                }
            }
        }
        if (data.executionDate && gcExecDate) gcExecDate.value = data.executionDate;
        if (data.expiryDate && gcExpiryDate) gcExpiryDate.value = data.expiryDate;
        if (data.notes && gcNotes) gcNotes.value = data.notes;
        if (gcEqTag && !gcEqTag.value) gcEqTag.value = "Ponto Amostral / Duto da Chaminé Principal";

        const gcSuccessBox = document.getElementById("gc-insp-scanner-success");
        if (gcSuccessBox) {
            gcSuccessBox.style.display = "block";
            gcSuccessBox.innerHTML = `✨ Laudo lido! ${data.inspectionNumber ? `Nº: <strong>${data.inspectionNumber}</strong> | ` : ''}Empresa: <strong>${data.company || 'Detectada'}</strong>`;
        }

        this.calculateScore();
        this.updateDaysSummary();
    },

    startWebcam() {
        const container = document.getElementById("insp-webcam-container");
        const video = document.getElementById("insp-webcam-video");
        if (!container || !video) return;

        container.style.display = "flex";

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
            })
            .then(stream => {
                this._webcamStream = stream;
                video.srcObject = stream;
            })
            .catch(err => {
                console.warn("[Inspections] Erro ao acessar webcam:", err);
                alert("Não foi possível acessar a câmera do dispositivo (" + err.message + "). Verifique as permissões do navegador.");
                container.style.display = "none";
            });
        } else {
            alert("Acesso a câmera não suportado neste navegador.");
            container.style.display = "none";
        }
    },

    captureWebcam() {
        const video = document.getElementById("insp-webcam-video");
        const canvas = document.getElementById("insp-webcam-canvas");
        if (!video || !canvas) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], "foto_laudo_webcam.jpg", { type: "image/jpeg" });
                this.closeWebcam();
                this.handleDocumentInput(file);
            }
        }, "image/jpeg", 0.92);
    },

    closeWebcam() {
        const container = document.getElementById("insp-webcam-container");
        const video = document.getElementById("insp-webcam-video");
        if (this._webcamStream) {
            this._webcamStream.getTracks().forEach(track => track.stop());
            this._webcamStream = null;
        }
        if (video) video.srcObject = null;
        if (container) container.style.display = "none";
    }
};

// Handler Global para notificação do cliente via WhatsApp
window.sendInspectionNotification = function(leadId, inspectionId) {
    const lead = Store.getLeadById(leadId);
    if (!lead) return;

    const inspection = lead.interactions.find(i => i.id === inspectionId);
    if (!inspection) return;

    const serviceName = inspection.meta?.serviceName || "Vistoria Geral";
    const executionDate = inspection.meta?.executionDate || "N/A";
    const expiryDate = inspection.meta?.expiryDate || "N/A";

    const partsExec = executionDate.split("-");
    const formattedExec = partsExec.length === 3 ? `${partsExec[2]}/${partsExec[1]}/${partsExec[0]}` : executionDate;
    const partsExp = expiryDate.split("-");
    const formattedExp = partsExp.length === 3 ? `${partsExp[2]}/${partsExp[1]}/${partsExp[0]}` : expiryDate;

    // Calcular dias restantes
    const today = new Date();
    today.setHours(0,0,0,0);
    const expDate = new Date(expiryDate + "T12:00:00");
    expDate.setHours(0,0,0,0);
    const diff = expDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diff / (1000 * 3600 * 24));

    let timeText = "";
    if (daysRemaining < 0) {
        timeText = `está VENCIDA desde o dia ${formattedExp}`;
    } else {
        timeText = `vencerá em breve no dia ${formattedExp} (daqui a ${daysRemaining} dias)`;
    }

    const contactName = lead.contact || "Cliente";
    const message = `Olá, ${contactName}! 💡

Passando para te lembrar que a inspeção anual de *${serviceName}* realizada na sua empresa em *${formattedExec}* ${timeText}.

A renovação periódica garante o pleno funcionamento dos equipamentos, a emissão de laudos de conformidade exigidos por seguradoras/Corpo de Bombeiros e evita multas.

Gostaria de agendar a nova vistoria para a próxima semana? Temos horários disponíveis na terça e quinta-feira.

Fico no aguardo! 😊`;

    // Redirecionamento de WhatsApp
    const leadPhone = String(lead.whatsapp || lead.phone || "").replace(/\D/g, "");
    if (!leadPhone) {
        alert("Erro: Este cliente não possui número de WhatsApp ou telefone cadastrado para notificação.");
        return;
    }

    const cleanPhone = leadPhone.length === 10 || leadPhone.length === 11 ? '55' + leadPhone : leadPhone;
    
    // Tentar disparo automático via backend primeiro se houver API configurada
    const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || {};
    if (waConfig.connected && waConfig.apiUrl) {
        const confirmSend = confirm(`Deseja enviar o alerta de inspeção automaticamente via API do WhatsApp para ${lead.company}?`);
        if (confirmSend) {
            fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: cleanPhone,
                    message: message,
                    config: waConfig
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(`Mensagem enviada com sucesso via ${data.provider}!`);
                    
                    // Adicionar log na timeline do lead
                    Store.addLeadInteraction(leadId, "sdr-ai@vellia.com", {
                        type: "WhatsApp",
                        description: `📢 **Notificação de Vencimento de Inspeção enviada:** "${serviceName}".`
                    });
                } else {
                    alert(`Falha no envio automático: ${data.message || 'Erro desconhecido'}`);
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao conectar com API de envio. Abrindo WhatsApp Web...");
                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
            });
            return;
        }
    }

    // Se não tiver API conectada ou preferir manual, abrir deep link
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
    
    // Registrar a notificação na timeline local
    Store.addLeadInteraction(leadId, "sdr-ai@vellia.com", {
        type: "WhatsApp",
        description: `📢 **Notificação de Vencimento de Inspeção iniciada:** "${serviceName}".`
    });
};

// ============================================================================
// INTEGRAÇÃO: GOOGLE CALENDAR
// ============================================================================
window.scheduleGoogleCalendar = function(leadId, inspectionId) {
    const lead = Store.getLeadById(leadId);
    if (!lead || !lead.interactions) return;

    const item = lead.interactions.find(i => i.id === inspectionId);
    if (!item) return;

    const serviceName = item.meta?.serviceName || "Vistoria Geral";
    const company = lead.company || "Cliente";
    const contactName = lead.contact || "";
    const phone = lead.whatsapp || lead.phone || "";
    const notes = item.meta?.notes || item.description || "";
    const targetDate = item.meta?.expiryDate || item.meta?.executionDate; // Prefere a data de vencimento/renovação

    if (!targetDate) {
        alert("Nenhuma data definida para agendar.");
        return;
    }

    // Formatar data (adiciona hora padrão: 09:00 - 10:00)
    const dt = new Date(targetDate + "T09:00:00");
    const dtEnd = new Date(targetDate + "T10:00:00");

    const formatGCalDate = (d) => {
        return d.toISOString().replace(/-|:|\.\d+/g, "");
    };

    const title = encodeURIComponent(`Vistoria/Renovação: ${company} - ${serviceName}`);
    const details = encodeURIComponent(`Contato: ${contactName}
Telefone: ${phone}
Serviço: ${serviceName}
Notas: ${notes}

Gerado automaticamente via VelliaCRM`);
    const dates = `${formatGCalDate(dt)}/${formatGCalDate(dtEnd)}`;

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
    window.open(url, '_blank');
};

// ============================================================================
// EXPORTAÇÕES GLOBAIS DE ACESSIBILIDADE E DISPARO DIRETO
// ============================================================================
window.openChecklistModal = function(leadId = null, autoAction = null) {
    Inspections.openChecklistModal(leadId, autoAction);
};

window.closeChecklistModal = function() {
    Inspections.closeChecklistModal();
};

window.deleteInspection = function(leadId, inspectionId) {
    return Inspections.deleteInspection(leadId, inspectionId);
};

if (typeof window !== "undefined") {
    window.Inspections = Inspections;
}

