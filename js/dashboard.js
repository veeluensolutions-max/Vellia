import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { PostSales } from "./post-sales.js";
import { Toast } from "./toast.js";

const charts = {};

export const Dashboard = {
    currentTimeframe: "all",

    setTimeframe(period) {
        this.currentTimeframe = period;
        const group = document.getElementById("dashboard-timeframe-selector");
        if (group) {
            group.querySelectorAll(".timeframe-pill-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.period === period);
            });
        }
        this.renderAll();
    },

    filterByTimeframe(items, dateField = "createdAt") {
        if (!this.currentTimeframe || this.currentTimeframe === "all") return items;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return items.filter(item => {
            const raw = item[dateField] || item.closedAt || item.created_at || item.updatedAt;
            if (!raw) return true;
            const itemDate = new Date(raw);
            if (isNaN(itemDate.getTime())) return true;
            
            if (this.currentTimeframe === "today") {
                return itemDate >= startOfToday;
            } else if (this.currentTimeframe === "7d") {
                const limit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return itemDate >= limit;
            } else if (this.currentTimeframe === "month") {
                return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            } else if (this.currentTimeframe === "quarter") {
                const currentQuarter = Math.floor(now.getMonth() / 3);
                const itemQuarter = Math.floor(itemDate.getMonth() / 3);
                return itemQuarter === currentQuarter && itemDate.getFullYear() === now.getFullYear();
            }
            return true;
        });
    },

    init() {
        this.renderAll();
        this.bindEvents();
        this.setupAdminTaskManager();

        this.renderLiveTasksMonitor();
        if (!this._liveTimerInterval) {
            this._liveTimerInterval = setInterval(() => {
                this.updateLiveTimers();
            }, 1000);
        }

        window.addEventListener("vellia:liveTasksChanged", () => {
            this.renderLiveTasksMonitor();
        });

        // Atualização automática em tempo real do ranking e dos KPIs
        const refreshDashboardData = () => {
            const viewDashboard = document.getElementById("view-dashboard");
            if (viewDashboard && viewDashboard.style.display !== "none") {
                let proposals = Store.getProposals();
                let leads = Store.getLeads();
                const session = JSON.parse(localStorage.getItem("comercial_session"));
                if (session && session.role === "seller") {
                    leads = leads.filter(l => l.owner === session.email);
                    proposals = proposals.filter(p => p.authorEmail === session.email);
                }
                const filteredLeads = this.filterByTimeframe(leads, "createdAt");
                const filteredProposals = this.filterByTimeframe(proposals, "createdAt");
                this.renderVendorRanking(filteredProposals);
                this.renderKPIs(filteredLeads, filteredProposals);
                this.renderRecentActivity(filteredLeads, filteredProposals);
            }
        };

        window.addEventListener("vellia:scoreUpdated", refreshDashboardData);
        window.addEventListener("vellia:leadAdded", refreshDashboardData);
        window.addEventListener("vellia:leadUpdated", refreshDashboardData);
        window.addEventListener("vellia:proposalUpdated", refreshDashboardData);
        window.addEventListener("vellia:waSent", refreshDashboardData);

        // Atualização em tempo real (Real-time) do painel de Atividades Recentes
        setInterval(() => {
            if (document.hidden) return;
            const viewDashboard = document.getElementById("view-dashboard");
            
            // Só consome processamento se o usuário estiver de fato com a aba Dashboard aberta
            if (viewDashboard && viewDashboard.style.display !== "none") {
                let currentLeads = Store.getLeads();
                let currentProposals = Store.getProposals();
                const session = JSON.parse(localStorage.getItem("comercial_session"));
                
                if (session && session.role === "seller") {
                    currentLeads = currentLeads.filter(l => l.owner === session.email);
                    currentProposals = currentProposals.filter(p => p.authorEmail === session.email);
                }
                
                const filteredLeads = this.filterByTimeframe(currentLeads, "createdAt");
                const filteredProposals = this.filterByTimeframe(currentProposals, "createdAt");
                this.renderRecentActivity(filteredLeads, filteredProposals);
            }
        }, 5000); // A cada 5 segundos
    },

    bindEvents() {
        // Botões de Ações Rápidas (Seller)
        const btnNewLead = document.getElementById("btn-quick-new-lead");
        if (btnNewLead) {
            btnNewLead.addEventListener("click", () => {
                window.location.hash = "#crm";
                setTimeout(() => {
                    const btn = document.getElementById("btn-new-lead");
                    if (btn) btn.click();
                }, 300);
            });
        }

        const btnLogCall = document.getElementById("btn-quick-log-call");
        if (btnLogCall) {
            btnLogCall.addEventListener("click", () => {
                window.location.hash = "#crm";
            });
        }

        const btnLogMeeting = document.getElementById("btn-quick-log-meeting");
        if (btnLogMeeting) {
            btnLogMeeting.addEventListener("click", () => {
                window.location.hash = "#crm";
            });
        }

        const btnChangeStage = document.getElementById("btn-quick-change-stage");
        if (btnChangeStage) {
            btnChangeStage.addEventListener("click", () => {
                window.location.hash = "#kanban";
            });
        }

        const btnCloseSale = document.getElementById("btn-quick-close-sale");
        if (btnCloseSale) {
            btnCloseSale.addEventListener("click", () => {
                window.location.hash = "#kanban";
            });
        }

        const selectRevenueMetric = document.getElementById("select-revenue-metric");
        if (selectRevenueMetric && !selectRevenueMetric._hasListener) {
            selectRevenueMetric._hasListener = true;
            selectRevenueMetric.addEventListener("change", () => {
                this.renderRevenueChart(this._lastProposals || Store.getProposals());
            });
        }
    },

    renderAll() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        let leads = Store.getLeads();
        const session = JSON.parse(localStorage.getItem("comercial_session"));
        if (session && session.role === "seller") {
            leads = leads.filter(l => l.owner === session.email);
        }
        
        let proposals = Store.getProposals();
        if (session && session.role === "seller") {
            proposals = proposals.filter(p => p.authorEmail === session.email);
        }

        const filteredLeads = this.filterByTimeframe(leads, "createdAt");
        const filteredProposals = this.filterByTimeframe(proposals, "createdAt");
        this._lastProposals = filteredProposals;

        const execDash = document.getElementById("dashboard-exec");
        const opDash = document.getElementById("dashboard-operacional");

        if (user.role && user.role.toLowerCase() === "operacional") {
            if (execDash) execDash.style.display = "none";
            if (opDash) {
                opDash.style.display = "flex";
                this.renderOperacionalDashboard(proposals, leads);
            }
        } else {
            // Admin, Manager ou Vendedor
            if (execDash) execDash.style.display = "flex";
            if (opDash) opDash.style.display = "none";

            this.renderKPIs(filteredLeads, filteredProposals);
            this.renderCommercialSummary(filteredLeads, filteredProposals);
            this.renderHorizontalPipeline(filteredLeads, filteredProposals);
            this.renderNextActivities(filteredLeads, filteredProposals);
            this.renderAttentionClients(filteredLeads, filteredProposals);
            this.renderRevenueChart(filteredProposals);
            this.renderConversionDonut(filteredProposals);
            this.renderSegmentBreakdown(filteredLeads);
            this.renderSourcesChart(filteredLeads);
            this.renderVendorRanking(filteredProposals);
            this.renderRecentActivity(filteredLeads, filteredProposals);
            this.renderTasksWeekChart();
            this.renderLiveTasksMonitor();
            this.renderChannelRoiMatrix(filteredLeads, filteredProposals);
            this.renderGoalsCommissionPanel();
        }
    },

    // ===========================================================================
    // DASHBOARD OPERACIONAL COMPACTO
    // ===========================================================================
    renderOperacionalDashboard(proposals, leads) {
        const container = document.getElementById("dashboard-operacional");
        if (!container) return;

        const awaiting = proposals.filter(p => p.status === "Aguardando Agendamento" || p.status === "Ganho");
        const scheduled = proposals.filter(p => p.status === "Agendada");

        const renderCompactAgendamentosList = (list, title, isAwaiting) => {
            if (list.length === 0) {
                return `
                <div class="vellia-card" style="flex: 1; min-width: 280px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-weight: 650; font-size: 13.5px; color: var(--text-primary);">${title}</span>
                        <span class="badge ${isAwaiting ? 'badge-warning' : 'badge-success'}">0</span>
                    </div>
                    <div class="vellia-empty-state" style="padding: 16px 8px;">
                        <div class="vellia-empty-icon" style="width: 36px; height: 36px; font-size: 15px; margin-bottom: 8px;">📅</div>
                        <div class="vellia-empty-title" style="font-size: 13px;">Nenhum agendamento pendente</div>
                        <div class="vellia-empty-desc" style="font-size: 12px; margin-bottom: 10px;">Quando uma proposta precisar de visita, ela aparecerá aqui automaticamente.</div>
                        <a href="#proposals" class="btn btn-outline" style="font-size: 11.5px; height: 32px; padding: 0 12px;">Ver propostas</a>
                    </div>
                </div>`;
            }

            const visibleItems = list.slice(0, 3).map(p => {
                const lead = leads.find(l => l.id === p.leadId);
                const leadName = lead ? (lead.company || lead.contact) : "Lead Comercial";
                
                return `
                <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-color-light); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="min-width: 0;">
                        <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${leadName}
                        </div>
                        <div style="font-size: 11.5px; color: var(--text-muted);">
                            ${p.service || 'Serviço'} • #${p.id.substring(0,6)}
                        </div>
                    </div>
                    <div style="flex-shrink: 0;">
                        ${isAwaiting ? `
                            <button onclick="window.Dashboard.markProposalScheduled('${p.id}')" class="btn btn-primary" style="font-size: 11px; height: 30px; padding: 0 10px;">
                                Agendar
                            </button>
                        ` : `
                            <span class="badge badge-success" style="font-size: 11px;">🗓️ Agendada</span>
                        `}
                    </div>
                </div>`;
            }).join("");

            return `
            <div class="vellia-card" style="flex: 1; min-width: 280px; padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                    <span style="font-weight: 650; font-size: 13.5px; color: var(--text-primary);">${title}</span>
                    <span class="badge ${isAwaiting ? 'badge-warning' : 'badge-success'}">${list.length}</span>
                </div>
                <div>
                    ${visibleItems}
                </div>
                <div style="margin-top: 10px; text-align: right;">
                    <a href="#calendar" style="font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none;">Ver agenda completa &rarr;</a>
                </div>
            </div>`;
        };

        container.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 2px 0;">
                    Agendamentos Operacionais
                </h3>
                <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0;">Controle rápido de vistorias técnicas e visitas a clientes</p>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                ${renderCompactAgendamentosList(awaiting, "Aguardando Agendamento", true)}
                ${renderCompactAgendamentosList(scheduled, "Já Agendadas", false)}
            </div>
        `;
    },

    markProposalScheduled(proposalId) {
        if(confirm("Confirma que esta proposta já foi agendada na agenda principal?")) {
            const proposals = Store.getProposals();
            const p = proposals.find(x => x.id === proposalId);
            if(p) {
                p.status = "Agendada";
                Store.saveProposals(proposals);
                this.renderAll();
                alert("Proposta marcada como Agendada!");
            }
        }
    },

    // ===========================================================================
    // PRIMEIRA LINHA — 4 KPIs COMPACTOS EXECUTIVOS
    // ===========================================================================
    renderKPIs(leads, proposals) {
        // 1. Receita Recorrente e TCV (Contratos)
        let mrr = 0;
        let tcv = 0;
        if (Store && Store.getContracts) {
            const contracts = Store.getContracts();
            contracts.filter(c => c.status === 'Ativo').forEach(c => {
                if (c.billing_type === 'Recorrente') {
                    mrr += (c.monthly_value || 0);
                }
                tcv += (c.total_value || 0);
            });
        }

        // 2. Saúde do Pós-Venda
        let activeClientsCount = 0;
        let riskClientsCount = 0;
        const closedClients = PostSales.getClosedClients();
        closedClients.forEach(client => {
            const inactivity = PostSales.calculateInactivity(client);
            if (inactivity.status === "Ativo") {
                activeClientsCount++;
            } else {
                riskClientsCount++;
            }
        });

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        // Helper para gerar Sparkline SVG de alta definição
        const generateSparklineSVG = (points, color = "#6257F5", height = 30, width = 90) => {
            if (!points || points.length < 2) points = [12, 18, 15, 24, 28, 38, 42];
            const min = Math.min(...points);
            const max = Math.max(...points);
            const range = (max - min) || 1;
            const stepX = width / (points.length - 1);
            
            const coords = points.map((p, i) => {
                const x = i * stepX;
                const y = height - ((p - min) / range) * (height - 8) - 4;
                return { x, y };
            });

            let pathD = `M ${coords[0].x} ${coords[0].y}`;
            for (let i = 0; i < coords.length - 1; i++) {
                const p0 = coords[i];
                const p1 = coords[i + 1];
                const cpx1 = p0.x + (p1.x - p0.x) / 2;
                const cpy1 = p0.y;
                const cpx2 = p0.x + (p1.x - p0.x) / 2;
                const cpy2 = p1.y;
                pathD += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
            }

            const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
            const gradId = `spark-grad-${Math.random().toString(36).substr(2, 6)}`;

            return `
                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width: 100%; height: 30px; overflow: visible;">
                    <defs>
                        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="${color}" stop-opacity="0.25" />
                            <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
                        </linearGradient>
                    </defs>
                    <path d="${fillD}" fill="url(#${gradId})" />
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            `;
        };

        const kpis = [
            { 
                id: "kpi-mrr", 
                val: fmt(mrr), 
                label: "Receita Recorrente", 
                icon: "🔄", 
                color: "#6257F5", 
                trend: "↑ 12.5%", 
                trendPositive: true,
                sparkData: [10, 15, 14, 22, 28, 35, 42],
                link: "#contracts" 
            },
            { 
                id: "kpi-tcv", 
                val: fmt(tcv), 
                label: "Total em Contratos", 
                icon: "📜", 
                color: "#6257F5", 
                trend: "↑ 18.4%", 
                trendPositive: true,
                sparkData: [20, 25, 22, 34, 38, 48, 55],
                link: "#contracts" 
            },
            { 
                id: "kpi-health-active", 
                val: activeClientsCount, 
                label: "Clientes Ativos", 
                icon: "👥", 
                color: "#16A36A", 
                trend: "98% Retenção", 
                trendPositive: true,
                sparkData: [8, 12, 14, 15, 18, 20, 22],
                link: "#post-sales" 
            },
            { 
                id: "kpi-health-risk", 
                val: riskClientsCount, 
                label: "Clientes em Risco", 
                icon: "⚠️", 
                color: riskClientsCount > 0 ? "#EF4444" : "#16A36A", 
                trend: riskClientsCount > 0 ? "Atenção" : "Zero Riscos", 
                trendPositive: riskClientsCount === 0,
                sparkData: [5, 4, 6, 3, 4, 2, Math.max(1, riskClientsCount)],
                link: "#post-sales" 
            }
        ];

        const container = document.getElementById("dashboard-kpis");
        if (!container) return;

        container.innerHTML = kpis.map(k => `
            <div class="modern-kpi-card" 
                 style="${k.link ? 'cursor: pointer;' : ''}" 
                 ${k.link ? `onclick="window.location.hash = '${k.link}'"` : ''}>
                <div class="kpi-top-row">
                    <span class="kpi-label">${k.label}</span>
                    <div class="kpi-icon-small">
                        <span>${k.icon}</span>
                    </div>
                </div>

                <div class="kpi-value-row">
                    <div class="kpi-value">${k.val}</div>
                </div>

                <div class="kpi-bottom-row">
                    <span class="kpi-badge-trend ${k.trendPositive ? 'positive' : 'negative'}">
                        ${k.trend}
                    </span>
                    <div class="kpi-sparkline-box">
                        ${generateSparklineSVG(k.sparkData, k.color)}
                    </div>
                </div>
            </div>
        `).join("");
    },

    // ===========================================================================
    // SEGUNDA LINHA — RESUMO COMERCIAL
    // ===========================================================================
    renderCommercialSummary(leads, proposals) {
        const container = document.getElementById("dashboard-commercial-summary");
        if (!container) return;

        const totalLeads = leads.length;
        const openProposals = proposals.filter(p => p.status === "Enviada" || p.status === "Em Negociação").length;
        const wonProposals = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).length;
        const convRate = proposals.length > 0 ? Math.round((wonProposals / proposals.length) * 100) : 0;
        const revenue = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).reduce((s, p) => s + (p.value || 0), 0);
        const avgTicket = wonProposals > 0 ? Math.round(revenue / wonProposals) : 0;
        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        let avgDays = 4.2;
        const closedWithDates = proposals.filter(p => p.closedAt && p.createdAt && ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status));
        if (closedWithDates.length > 0) {
            const sumDays = closedWithDates.reduce((acc, p) => {
                const diff = new Date(p.closedAt).getTime() - new Date(p.createdAt).getTime();
                return acc + Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
            }, 0);
            avgDays = Math.max(1, Math.round(sumDays / closedWithDates.length * 10) / 10);
        }

        container.innerHTML = `
            <div class="commercial-summary-item">
                <span class="commercial-summary-label">Novos Leads</span>
                <span class="commercial-summary-val">${totalLeads}</span>
            </div>
            <div class="commercial-summary-item">
                <span class="commercial-summary-label">Propostas Abertas</span>
                <span class="commercial-summary-val">${openProposals}</span>
            </div>
            <div class="commercial-summary-item">
                <span class="commercial-summary-label">Taxa de Conversão</span>
                <span class="commercial-summary-val" style="color: #16A36A;">${convRate}%</span>
            </div>
            <div class="commercial-summary-item">
                <span class="commercial-summary-label">Ticket Médio</span>
                <span class="commercial-summary-val">${fmt(avgTicket)}</span>
            </div>
            <div class="commercial-summary-item">
                <span class="commercial-summary-label">Tempo Médio Fechamento</span>
                <span class="commercial-summary-val">${avgDays} dias</span>
            </div>
        `;
    },

    // ===========================================================================
    // TERCEIRA LINHA — PIPELINE COMERCIAL HORIZONTAL
    // ===========================================================================
    renderHorizontalPipeline(leads, proposals) {
        const container = document.getElementById("dashboard-horizontal-pipeline");
        if (!container) return;

        const stages = [
            { key: "Lead", label: "Lead", aliases: ["Novo", "Lead Gerado", "Lead"] },
            { key: "Contato", label: "Contato", aliases: ["Contato", "Primeiro Contato"] },
            { key: "Diagnostico", label: "Diagnóstico", aliases: ["Diagnóstico", "Lead Qualificado", "Diagnostico"] },
            { key: "Proposta", label: "Proposta", aliases: ["Proposta", "Proposta Enviada"] },
            { key: "Negociacao", label: "Negociação", aliases: ["Negociação", "Em Negociação", "Negociacao"] },
            { key: "Contrato", label: "Contrato", aliases: ["Contrato", "Cliente Fechado", "Ganho"] }
        ];

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        container.innerHTML = stages.map(st => {
            const matchedLeads = leads.filter(l => st.aliases.some(a => (l.stage || "").toLowerCase().includes(a.toLowerCase())));
            const count = matchedLeads.length;

            const stageProposals = proposals.filter(p => {
                const lead = leads.find(l => l.id === p.leadId);
                return (lead && st.aliases.some(a => (lead.stage || "").toLowerCase().includes(a.toLowerCase()))) ||
                       (st.key === "Contrato" && ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)) ||
                       (st.key === "Negociacao" && p.status === "Em Negociação") ||
                       (st.key === "Proposta" && p.status === "Enviada");
            });

            const valSum = stageProposals.reduce((sum, p) => sum + (p.value || 0), 0);

            return `
                <div class="pipeline-stage-item" onclick="window.location.hash = '#kanban'" style="cursor: pointer;">
                    <span class="pipeline-stage-name">${st.label}</span>
                    <span class="pipeline-stage-count">${count}</span>
                    <span class="pipeline-stage-value">${valSum > 0 ? fmt(valSum) : 'R$ 0,00'}</span>
                </div>
            `;
        }).join("");
    },

    // ===========================================================================
    // QUARTA LINHA — AGENDA & PRÓXIMAS ATIVIDADES
    // ===========================================================================
    renderNextActivities(leads, proposals) {
        const container = document.getElementById("dashboard-next-activities");
        if (!container) return;

        const activities = [];

        // 1. Propostas com agendamento
        proposals.filter(p => p.status === "Agendada" || p.status === "Aguardando Agendamento").slice(0, 3).forEach(p => {
            const lead = leads.find(l => l.id === p.leadId);
            const name = lead ? (lead.company || lead.contact) : "Cliente Comercial";
            activities.push({
                type: "Visita Técnica",
                client: name,
                time: p.scheduledDate || "Hoje • 14:30",
                status: p.status === "Agendada" ? "Agendada" : "Pendente"
            });
        });

        // 2. Leads com primeiro contato ou negociação
        leads.filter(l => l.stage === "Primeiro Contato" || l.stage === "Em Negociação").slice(0, 2).forEach(l => {
            activities.push({
                type: "Follow-up",
                client: l.company || l.contact || "Lead",
                time: "Amanhã • 10:00",
                status: "Pendente"
            });
        });

        if (activities.length === 0) {
            container.innerHTML = `
                <div class="vellia-empty-state">
                    <div class="vellia-empty-icon">📅</div>
                    <div class="vellia-empty-title">Nenhuma atividade pendente</div>
                    <div class="vellia-empty-desc">Sua agenda está livre para hoje. Agende novas visitas ou reuniões pelo calendário.</div>
                    <a href="#calendar" class="btn btn-outline" style="font-size: 12px; height: 32px;">Abrir Agenda</a>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${activities.slice(0, 5).map(act => `
                    <div class="activity-row-item">
                        <div>
                            <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary); margin-bottom: 2px;">
                                ${act.type} &bull; ${act.client}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                ${act.time}
                            </div>
                        </div>
                        <span class="badge ${act.status === 'Agendada' ? 'badge-success' : 'badge-warning'}" style="font-size: 11px;">
                            ${act.status}
                        </span>
                    </div>
                `).join("")}
            </div>
        `;
    },

    // ===========================================================================
    // QUARTA LINHA — CLIENTES QUE EXIGEM ATENÇÃO
    // ===========================================================================
    renderAttentionClients(leads, proposals) {
        const container = document.getElementById("dashboard-attention-clients");
        if (!container) return;

        const attentionItems = [];

        // 1. Clientes em risco do pós-venda
        const closedClients = PostSales.getClosedClients();
        closedClients.forEach(client => {
            const inact = PostSales.calculateInactivity(client);
            if (inact.status === "Em Risco" || inact.status === "Inativo") {
                attentionItems.push({
                    client: client.company || client.contact,
                    reason: `Sem contato há ${inact.days} dias`,
                    severity: "high",
                    link: "#post-sales"
                });
            }
        });

        // 2. Propostas paradas em negociação
        proposals.filter(p => (p.status === "Enviada" || p.status === "Em Negociação")).slice(0, 3).forEach(p => {
            const lead = leads.find(l => l.id === p.leadId);
            attentionItems.push({
                client: lead ? (lead.company || lead.contact) : "Cliente em Negociação",
                reason: "Proposta aguardando retorno",
                severity: "medium",
                link: "#proposals"
            });
        });

        // 3. Contratos próximos de renovação
        if (Store && Store.getContracts) {
            const contracts = Store.getContracts().filter(c => c.status === 'Ativo');
            contracts.slice(0, 2).forEach(c => {
                attentionItems.push({
                    client: c.client_name || "Cliente Contrato",
                    reason: "Renovação contratual próxima",
                    severity: "medium",
                    link: "#contracts"
                });
            });
        }

        if (attentionItems.length === 0) {
            container.innerHTML = `
                <div class="vellia-empty-state">
                    <div class="vellia-empty-icon">🛡️</div>
                    <div class="vellia-empty-title">Nenhum cliente em risco</div>
                    <div class="vellia-empty-desc">Todos os clientes ativos e negociações estão com o acompanhamento em dia.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${attentionItems.slice(0, 5).map(item => `
                    <div class="activity-row-item" style="cursor: pointer;" onclick="window.location.hash = '${item.link}'">
                        <div>
                            <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary); margin-bottom: 2px;">
                                ${item.client}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                ${item.reason}
                            </div>
                        </div>
                        <span class="badge ${item.severity === 'high' ? 'badge-danger' : 'badge-warning'}" style="font-size: 11px;">
                            ${item.severity === 'high' ? 'Crítico' : 'Atenção'}
                        </span>
                    </div>
                `).join("")}
            </div>
        `;
    },

    // ===========================================================================
    // FUNIL DE VENDAS (BARRAS HORIZONTAIS SVG)
    // ===========================================================================
    // ===========================================================================
    // FUNIL DE VENDAS (CHART.JS)
    // ===========================================================================
    renderFunnelChart(leads) {
        const container = document.getElementById("funnel-conversion");
        if (!container) return;

        // Estágios do funil (ordem do pipeline, excluindo "Cliente Perdido")
        const funnelStages = [
            { label: "Contato",           color: "#94a3b8", emoji: "🔵" },
            { label: "Lead Gerado",       color: "#6366f1", emoji: "🟣" },
            { label: "Lead Qualificado",  color: "#8b5cf6", emoji: "🟣" },
            { label: "Proposta Enviada",  color: "#f59e0b", emoji: "🟡" },
            { label: "Negociação",        color: "#f97316", emoji: "🟠" },
            { label: "Cliente Fechado",   color: "#10b981", emoji: "✅" }
        ];

        // Contar leads por estágio (CUMULATIVO - para funil de conversão real)
        const counts = {};
        funnelStages.forEach(s => counts[s.label] = 0);

        leads.forEach(lead => {
            // Identificar todos os estágios pelos quais o lead já passou
            let reachedStages = new Set();
            
            // 1. A partir do histórico
            if (lead.stageHistory && Array.isArray(lead.stageHistory)) {
                lead.stageHistory.forEach(h => reachedStages.add(h.stage));
            }
            // 2. Estágio atual
            reachedStages.add(lead.stage);

            // 3. Preenchimento cumulativo reverso (se o lead está num estágio avançado, ele passou pelos anteriores)
            const currentIdx = funnelStages.findIndex(fs => fs.label === lead.stage);
            
            funnelStages.forEach((s, idx) => {
                // Conta se o lead já passou explicitamente por essa etapa,
                // Ou se a etapa atual do lead é maior que essa etapa no funil (pulou etapa),
                // Ou se é Cliente Fechado (passou por todas).
                if (
                    reachedStages.has(s.label) || 
                    (currentIdx !== -1 && idx <= currentIdx) || 
                    (lead.stage === "Cliente Fechado" && idx <= 5)
                ) {
                    counts[s.label]++;
                }
            });
        });
        const lostCount = leads.filter(l => l.stage === "Cliente Perdido").length;

        // O estágio com mais leads define 100% da largura
        const maxCount = Math.max(...Object.values(counts), 1);

        // Calcular taxa de conversão entre estágios consecutivos
        const conversionRates = [];
        for (let i = 0; i < funnelStages.length - 1; i++) {
            const from = counts[funnelStages[i].label];
            const to   = counts[funnelStages[i + 1].label];
            const rate = from > 0 ? Math.round((to / from) * 100) : 0;
            conversionRates.push(rate);
        }

        // Calcular tempo médio por estágio usando stageHistory
        function avgDaysInStage(stageLabel) {
            const durations = [];
            leads.forEach(lead => {
                if (!Array.isArray(lead.stageHistory)) return;
                const idx = lead.stageHistory.findIndex(h => h.stage === stageLabel);
                if (idx === -1) return;
                const entryTs = new Date(lead.stageHistory[idx].timestamp).getTime();
                const exitTs  = idx + 1 < lead.stageHistory.length
                    ? new Date(lead.stageHistory[idx + 1].timestamp).getTime()
                    : Date.now();
                const days = Math.round((exitTs - entryTs) / (1000 * 60 * 60 * 24));
                if (!isNaN(days) && days >= 0) durations.push(days);
            });
            return durations.length > 0
                ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                : null;
        }

        // Badge de taxa colorido
        function rateBadge(rate) {
            let color, bg, label;
            if (rate >= 60)      { color = "#10b981"; bg = "rgba(16,185,129,0.13)"; label = "Bom"; }
            else if (rate >= 30) { color = "#f59e0b"; bg = "rgba(245,158,11,0.13)"; label = "Médio"; }
            else                  { color = "#ef4444"; bg = "rgba(239,68,68,0.13)";  label = "Crítico"; }
            return `<span style="
                display:inline-flex; align-items:center; gap:4px;
                background:${bg}; color:${color};
                border:1px solid ${color}33; border-radius:12px;
                font-size:11px; font-weight:700; padding:2px 9px;
            ">${rate}%</span>`;
        }

        // Gerar HTML das linhas do funil
        let html = `<div style="padding: 4px 0; display:flex; flex-direction:column; gap:0;">`;

        funnelStages.forEach((stage, i) => {
            const count    = counts[stage.label];
            const pct      = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
            const avgDays  = avgDaysInStage(stage.label);
            const daysText = avgDays !== null ? `· ${avgDays}d médio` : "";

            const rowId    = `funnel-row-${stage.label.replace(/\s+/g, '-')}`;

            // Tooltip nativo via title
            const tooltipTxt = `Clique para ver os vendedores responsáveis por estes leads`;

            html += `
            <div style="margin-bottom: 4px;">
                <div id="${rowId}" title="${tooltipTxt}" style="
                    display:flex; align-items:center; gap: 10px; cursor:pointer;
                    padding: 5px 6px; border-radius: 6px; transition: background 0.2s;
                " onmouseover="this.style.background='rgba(0,0,0,0.04)'" onmouseout="this.style.background='transparent'">
                    <div style="width:130px; flex-shrink:0; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:13px;">${stage.emoji}</span>
                        <span style="font-size:12px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${stage.label}</span>
                    </div>
                    <div style="flex:1; background:rgba(148,163,184,0.1); border-radius:8px; height:26px; overflow:hidden; position:relative;">
                        <div style="
                            width:${pct}%; height:100%;
                            background: linear-gradient(90deg, ${stage.color}, ${stage.color}88);
                            border-radius:8px;
                            transition: width 0.6s ease;
                            min-width:${count > 0 ? '4px' : '0'};
                        "></div>
                    </div>
                    <div style="width:110px; flex-shrink:0; display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                        <span style="font-size:12px; font-weight:700; color:var(--text-primary);">${count}</span>
                        <span style="font-size:11px; color:var(--text-muted);">${daysText}</span>
                    </div>
                </div>`;

            // Linha de conversão (entre estágios, exceto após o último)
            if (i < funnelStages.length - 1) {
                const rate = conversionRates[i];
                html += `
                <div style="display:flex; align-items:center; gap:10px; padding: 0 0 0 136px; margin-bottom: 2px;">
                    <div style="flex:1; border-left: 2px dashed rgba(148,163,184,0.2); height:16px; margin-left:6px;"></div>
                    <div style="width:110px; flex-shrink:0; display:flex; justify-content:flex-end; align-items:center; gap:4px;">
                        <span style="font-size:10px; color:var(--text-muted);">↓ conv.</span>
                        ${rateBadge(rate)}
                    </div>
                </div>`;
            }

            html += `</div>`;
        });

        // "Cliente Perdido" separado
        if (lostCount > 0) {
            const lostPct = maxCount > 0 ? Math.round((lostCount / maxCount) * 100) : 0;
            html += `
            <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(239,68,68,0.2);">
                <div title="Cliente Perdido: ${lostCount} lead(s)" style="display:flex; align-items:center; gap:10px; cursor:default; padding:5px 0;">
                    <div style="width:130px; flex-shrink:0; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:13px;">❌</span>
                        <span style="font-size:12px; font-weight:600; color:#ef4444;">Cliente Perdido</span>
                    </div>
                    <div style="flex:1; background:rgba(239,68,68,0.06); border-radius:8px; height:26px; overflow:hidden;">
                        <div style="
                            width:${lostPct}%; height:100%;
                            background: linear-gradient(90deg, #ef4444, #ef444488);
                            border-radius:8px; min-width:${lostCount > 0 ? '4px' : '0'};
                        "></div>
                    </div>
                    <div style="width:110px; flex-shrink:0; display:flex; align-items:center; justify-content:flex-end;">
                        <span style="font-size:12px; font-weight:700; color:#ef4444;">${lostCount}</span>
                    </div>
                </div>
            </div>`;
        }

        // Legenda de cores
        html += `
            <div style="display:flex; gap:16px; margin-top:14px; padding-top:10px; border-top:1px solid var(--border-color);">
                <span style="font-size:11px; color:var(--text-muted);">Taxa de conversão:</span>
                <span style="font-size:11px; color:#10b981; font-weight:600;">● &ge;60% Boa</span>
                <span style="font-size:11px; color:#f59e0b; font-weight:600;">● 30–60% Média</span>
                <span style="font-size:11px; color:#ef4444; font-weight:600;">● &lt;30% Crítica</span>
            </div>
        </div>`;

        container.innerHTML = html;

        // Adicionar eventos de clique no funil para abrir o modal de vendedores
        funnelStages.forEach((stage) => {
            const rowId = `funnel-row-${stage.label.replace(/\s+/g, '-')}`;
            const rowEl = document.getElementById(rowId);
            if (rowEl) {
                rowEl.addEventListener('click', () => {
                    this.showFunnelStageDetails(leads, stage.label, funnelStages);
                });
            }
        });
    },

    showFunnelStageDetails(leads, stageLabel, funnelStages) {
        // Encontrar os leads que compõem o número mostrado no funil (cumulativo)
        const currentIdx = funnelStages.findIndex(fs => fs.label === stageLabel);
        
        const stageLeads = leads.filter(lead => {
            let reachedStages = new Set();
            if (lead.stageHistory && Array.isArray(lead.stageHistory)) {
                lead.stageHistory.forEach(h => reachedStages.add(h.stage));
            }
            reachedStages.add(lead.stage);
            
            return reachedStages.has(stageLabel) || 
                   (currentIdx !== -1 && funnelStages.findIndex(fs => fs.label === lead.stage) >= currentIdx) || 
                   (lead.stage === "Cliente Fechado");
        });
        
        const users = JSON.parse(localStorage.getItem("comercial_users")) || [];
        
        const sellerCounts = {};
        stageLeads.forEach(l => {
            let ownerName = l.owner;
            const u = users.find(u => u.email === l.owner);
            if (u && u.name) ownerName = u.name;
            
            if (!sellerCounts[ownerName]) sellerCounts[ownerName] = { count: 0, names: [] };
            sellerCounts[ownerName].count++;
            sellerCounts[ownerName].names.push(l.company || l.contact || 'Sem Nome');
        });

        let html = `<div style="padding: 24px;">
            <h3 style="margin-top:0; margin-bottom: 5px; color:var(--text-dark); font-size:18px;">Leads na Etapa: ${stageLabel}</h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:24px;">
                Total: ${stageLeads.length} lead(s) contabilizados
            </p>
        `;

        if (Object.keys(sellerCounts).length === 0) {
            html += `<p style="font-size:14px; color:var(--text-muted);">Nenhum lead nesta etapa no momento.</p>`;
        } else {
            // Ordenar por quem tem mais leads
            const sortedSellers = Object.entries(sellerCounts).sort((a,b) => b[1].count - a[1].count);
            
            sortedSellers.forEach(([ownerName, data]) => {
                html += `
                    <div style="margin-bottom:16px; border-left:4px solid var(--primary); padding-left:14px; background: rgba(0,0,0,0.02); padding-top: 10px; padding-bottom: 10px; border-radius: 0 6px 6px 0;">
                        <strong style="font-size:15px; color:var(--text-dark);">Vendedor: ${ownerName}</strong>
                        <div style="font-size:13px; color:var(--text-muted); margin-top:8px; line-height: 1.5;">
                            <span style="font-weight:600; color:var(--primary);">${data.count} lead(s):</span> 
                            ${data.names.join(', ')}
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;

        const modalId = "dynamic-funnel-modal";
        let modalEl = document.getElementById(modalId);
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(3px); animation: fadeIn 0.2s;';
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) modalEl.remove();
            });
            document.body.appendChild(modalEl);
        }

        const modalBox = document.createElement('div');
        modalBox.style.cssText = 'background: #fff; width: 450px; max-width: 90%; max-height: 85vh; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); overflow-y: auto; position: relative; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'position: absolute; top: 12px; right: 16px; background: none; border: none; font-size: 26px; cursor: pointer; color: #999; line-height: 1; transition: color 0.2s;';
        closeBtn.onmouseover = () => closeBtn.style.color = '#333';
        closeBtn.onmouseout = () => closeBtn.style.color = '#999';
        closeBtn.onclick = () => modalEl.remove();

        modalBox.innerHTML = html;
        modalBox.appendChild(closeBtn);
        modalEl.innerHTML = '';
        modalEl.appendChild(modalBox);
    },

    // ===========================================================================
    // GRÁFICO DE RECEITA MENSAL (CHART.JS)
    // ===========================================================================
    renderRevenueChart(proposals) {
        const canvas = document.getElementById("chart-revenue");
        if (!canvas) return;

        if (typeof Chart !== 'undefined' && Chart.getChart) { const ex = Chart.getChart(canvas); if (ex) ex.destroy(); } if (charts.revenue) { charts.revenue.destroy(); }

        const metric = document.getElementById("select-revenue-metric")?.value || "revenue";

        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1); // Garante que a virada de mês não pule meses
            d.setMonth(d.getMonth() - i);
            months.push({
                label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
                year: d.getFullYear(),
                month: d.getMonth()
            });
        }

        const labels = months.map(m => m.label);
        let data = [];
        let datasetLabel = "Receita Realizada (R$)";
        let tooltipCallback = (context) => " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(context.parsed.y);
        let yTickCallback = (value) => value === 0 ? 'R$ 0' : (value >= 1000 ? 'R$ ' + (value / 1000).toFixed(0) + 'k' : 'R$ ' + value);

        if (metric === "contracts") {
            datasetLabel = "Contratos Fechados";
            data = months.map(m => {
                return proposals
                    .filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status) && p.closedAt)
                    .filter(p => {
                        const d = new Date(p.closedAt);
                        return d.getMonth() === m.month && d.getFullYear() === m.year;
                    }).length;
            });
            tooltipCallback = (context) => ` ${context.parsed.y} contrato${context.parsed.y === 1 ? '' : 's'}`;
            yTickCallback = (value) => `${value}`;
        } else if (metric === "conversions") {
            datasetLabel = "Propostas Ganhas";
            data = months.map(m => {
                return proposals
                    .filter(p => p.status === "Ganho" && p.closedAt)
                    .filter(p => {
                        const d = new Date(p.closedAt);
                        return d.getMonth() === m.month && d.getFullYear() === m.year;
                    }).length;
            });
            tooltipCallback = (context) => ` ${context.parsed.y} fechamento${context.parsed.y === 1 ? '' : 's'}`;
            yTickCallback = (value) => `${value}`;
        } else {
            // "revenue"
            data = months.map(m => {
                return proposals
                    .filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status) && p.closedAt)
                    .filter(p => {
                        const d = new Date(p.closedAt);
                        return d.getMonth() === m.month && d.getFullYear() === m.year;
                    })
                    .reduce((sum, p) => sum + (p.value || 0), 0);
            });
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(98, 87, 245, 0.22)');
        gradient.addColorStop(0.7, 'rgba(98, 87, 245, 0.04)');
        gradient.addColorStop(1, 'rgba(98, 87, 245, 0.0)');

        const modernTooltip = {
            backgroundColor: '#111827',
            titleColor: '#F9FAFB',
            bodyColor: '#E5E7EB',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            usePointStyle: true,
            titleFont: { family: 'Inter, sans-serif', weight: '600', size: 11 },
            bodyFont: { family: 'Inter, sans-serif', size: 12 }
        };

        charts.revenue = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: datasetLabel,
                    data: data,
                    borderColor: '#6257F5',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.38,
                    pointBackgroundColor: '#FFFFFF',
                    pointBorderColor: '#6257F5',
                    pointBorderWidth: 2,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#6257F5',
                    pointHoverBorderColor: '#FFFFFF',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...modernTooltip,
                        callbacks: {
                            label: tooltipCallback
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9CA3AF', font: { family: 'Inter, sans-serif', weight: 600, size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(232, 234, 240, 0.6)' },
                        ticks: {
                            color: '#9CA3AF',
                            maxTicksLimit: 4,
                            precision: 0,
                            font: { family: 'Inter, sans-serif', size: 11 },
                            callback: yTickCallback
                        }
                    }
                }
            }
        });
    },

    // ===========================================================================
    // DONUT DE CONVERSÃO (CHART.JS)
    // ===========================================================================
    renderConversionDonut(proposals) {
        const canvas = document.getElementById("chart-conversion");
        if (!canvas) return;

        if (typeof Chart !== 'undefined' && Chart.getChart) { const ex = Chart.getChart(canvas); if (ex) ex.destroy(); } if (charts.conversion) { charts.conversion.destroy(); }

        const total = proposals.length;
        const won = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).length;
        const lost = proposals.filter(p => p.status === "Perdido").length;
        const pending = total - won - lost;

        const ctx = canvas.getContext('2d');
        const gradWon = ctx.createLinearGradient(0, 0, 0, 200);
        gradWon.addColorStop(0, '#10b981');
        gradWon.addColorStop(1, '#059669');

        const gradLost = ctx.createLinearGradient(0, 0, 0, 200);
        gradLost.addColorStop(0, '#ef4444');
        gradLost.addColorStop(1, '#b91c1c');

        const gradPending = ctx.createLinearGradient(0, 0, 0, 200);
        gradPending.addColorStop(0, '#6366f1');
        gradPending.addColorStop(1, '#4f46e5');

        const glassTooltip = {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: { family: 'Inter, sans-serif', weight: '700', size: 12 },
            bodyFont: { family: 'Inter, sans-serif', size: 12 }
        };

        charts.conversion = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Ganhos', 'Perdidos', 'Em Aberto'],
                datasets: [{
                    data: [won, lost, pending],
                    backgroundColor: [gradWon, gradLost, gradPending],
                    borderWidth: 0,
                    hoverOffset: 6,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '74%',
                plugins: {
                    tooltip: glassTooltip,
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', weight: 600, size: 11 },
                            usePointStyle: true,
                            padding: 16
                        }
                    }
                }
            },
            plugins: [{
                id: 'textCenter',
                beforeDraw: function(chart) {
                    if (total === 0) return;
                    var width = chart.width,
                        height = chart.height,
                        ctx = chart.ctx;
            
                    ctx.restore();
                    var fontSize = (height / 114).toFixed(2);
                    ctx.font = "800 " + fontSize + "em Inter, sans-serif";
                    ctx.textBaseline = "middle";
                    
                    const isDark = document.body.classList.contains("dark") || 
                                   document.documentElement.getAttribute("data-theme") === "dark";
                    ctx.fillStyle = isDark ? "#f8fafc" : "#1e293b";
            
                    var convRate = Math.round((won / total) * 100);
                    var text = convRate + "%",
                        textX = Math.round((chart.chartArea.left + chart.chartArea.right - ctx.measureText(text).width) / 2),
                        textY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
            
                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    },

    // ===========================================================================
    // LEADS POR SEGMENTO (CHART.JS POLAR AREA)
    // ===========================================================================
    renderSegmentBreakdown(leads) {
        const canvas = document.getElementById("chart-segments");
        if (!canvas) return;

        if (typeof Chart !== 'undefined' && Chart.getChart) { const ex = Chart.getChart(canvas); if (ex) ex.destroy(); } if (charts.segments) { charts.segments.destroy(); }

        const segMap = {};
        leads.forEach(l => {
            if (!segMap[l.segment]) segMap[l.segment] = 0;
            segMap[l.segment]++;
        });

        const sorted = Object.entries(segMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);
        const colors = [
            'rgba(99, 102, 241, 0.85)',
            'rgba(139, 92, 246, 0.85)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(16, 185, 129, 0.85)',
            'rgba(249, 115, 22, 0.85)',
            'rgba(239, 68, 68, 0.85)'
        ];

        const glassTooltip = {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: { family: 'Inter, sans-serif', weight: '700', size: 12 },
            bodyFont: { family: 'Inter, sans-serif', size: 12 }
        };

        charts.segments = new Chart(canvas, {
            type: 'polarArea',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1.5,
                    borderColor: 'var(--bg-surface)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: glassTooltip,
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', size: 11, weight: 600 },
                            usePointStyle: true,
                            padding: 12
                        }
                    }
                },
                scales: {
                    r: {
                        ticks: { display: false },
                        grid: { color: 'rgba(148, 163, 184, 0.08)' }
                    }
                }
            }
        });
    },

    // ===========================================================================
    // ORIGEM DOS LEADS (CHART.JS DOUGHNUT)
    // ===========================================================================
    renderSourcesChart(leads) {
        const canvas = document.getElementById("chart-sources");
        if (!canvas) return;

        if (typeof Chart !== 'undefined' && Chart.getChart) { const ex = Chart.getChart(canvas); if (ex) ex.destroy(); } if (charts.sources) { charts.sources.destroy(); }

        const srcMap = {};
        leads.forEach(l => {
            const src = l.source || "Outbound";
            if (!srcMap[src]) srcMap[src] = 0;
            srcMap[src]++;
        });

        const labels = Object.keys(srcMap);
        const data = Object.values(srcMap);

        const ctx = canvas.getContext('2d');
        const colors = [
            '#6366f1',
            '#8b5cf6',
            '#06b6d4',
            '#10b981',
            '#f59e0b',
            '#ef4444'
        ];

        const gradients = colors.map((col) => {
            const grad = ctx.createLinearGradient(0, 0, 0, 200);
            grad.addColorStop(0, col);
            grad.addColorStop(1, col + '88');
            return grad;
        });

        const glassTooltip = {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#ffffff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: { family: 'Inter, sans-serif', weight: '700', size: 12 },
            bodyFont: { family: 'Inter, sans-serif', size: 12 }
        };

        charts.sources = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: gradients,
                    borderWidth: 0,
                    hoverOffset: 6,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    tooltip: glassTooltip,
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', size: 11, weight: 600 },
                            usePointStyle: true,
                            padding: 12
                        }
                    }
                }
            }
        });
    },

    // ===========================================================================
    // RANKING DE VENDEDORES
    // ===========================================================================
    renderVendorRanking(proposals) {
        const container = document.getElementById("chart-ranking");
        if (!container) return;

        const users = Store.getUsers();
        const sellers = users.filter(u => u.role === "seller" || u.role === "manager");
        const leads = Store.getLeads();

        const ranking = sellers.map(u => {
            const myProps = proposals.filter(p => p.createdBy === u.email);
            const won = myProps.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).length;
            const revenue = myProps.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).reduce((s, p) => s + (p.value || 0), 0);
            const convRate = myProps.length > 0 ? Math.round((won / myProps.length) * 100) : 0;
            
            // Leads gerados pelo vendedor (criados ou atribuídos)
            const sellerLeads = leads.filter(l => l.createdBy === u.email || l.owner === u.email);
            const leadsCount = sellerLeads.length;
            const leadsQualified = sellerLeads.filter(l => l.stage !== "Lead Novo" && l.stage !== "Contato").length;

            // Interações / WhatsApp realizadas pelo vendedor
            const waCount = leads.reduce((total, lead) => {
                const myWa = (lead.interactions || []).filter(int => int.userEmail === u.email).length;
                return total + myWa;
            }, 0);

            // Fórmula de pontuação unificada (Score XP):
            // 50 pts por lead cadastrado + 30 pts por lead qualificado + 10 pts por interação + 100 pts por proposta + 500 pts por ganho + receita
            const score = (leadsCount * 50) + (leadsQualified * 30) + (waCount * 10) + (myProps.length * 100) + (won * 500) + revenue;

            return { ...u, totalProposals: myProps.length, won, revenue, convRate, leadsCount, score, waCount };
        }).sort((a, b) => b.score - a.score || b.revenue - a.revenue);

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const medals = ["🥇", "🥈", "🥉"];

        if (ranking.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Nenhum vendedor cadastrado.</p>`;
            return;
        }

        container.innerHTML = ranking.map((r, i) => `
            <div onclick="window.location.hash = '#team'" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 10px; cursor: pointer; transition: all var(--transition-fast);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                <div style="font-size: 22px; width: 32px; text-align: center; flex-shrink: 0;">${medals[i] || `#${i + 1}`}</div>
                <div class="user-avatar" style="width: 38px; height: 38px; font-size: 13px; flex-shrink: 0;">${r.avatar || r.name.substring(0, 2).toUpperCase()}</div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-weight: 700; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.name}</span>
                        <span class="badge" style="background: rgba(99,102,241,0.12); color:#6366f1; border: 1px solid rgba(99,102,241,0.2); font-size: 10px; padding: 1px 5px; font-weight: 700;">⭐ ${Math.round(r.score).toLocaleString('pt-BR')} pts</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">🎯 ${r.leadsCount} lead${r.leadsCount !== 1 ? 's' : ''} · 📝 ${r.totalProposals} prop. · ✅ ${r.won} ganhos · ${r.convRate}% conv.</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                    <div style="font-weight: 800; font-size: 14px; color: var(--success);">${fmt(r.revenue)}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">receita gerada</div>
                </div>
            </div>
        `).join("");
    },

    // ===========================================================================
    // ATIVIDADE RECENTE (FEED)
    // ===========================================================================
    renderRecentActivity(leads, proposals) {
        const container = document.getElementById("dash-activity-feed");
        if (!container) return;

        const events = [];

        // Mudanças de estágio dos leads
        leads.forEach(lead => {
            if (lead.stageHistory && lead.stageHistory.length > 0) {
                const last = [...lead.stageHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                events.push({
                    timestamp: new Date(last.timestamp),
                    leadId: lead.id,
                    icon: "🔄",
                    text: `<strong>${lead.company}</strong> movido para <strong>${lead.stage}</strong>`,
                    sub: last.userEmail,
                    color: "var(--primary)"
                });
            }
        });

        // Propostas criadas/fechadas
        proposals.forEach(p => {
            const lead = leads.find(l => l.company === p.company);
            const leadId = lead ? lead.id : null;
            events.push({
                timestamp: new Date(p.createdAt),
                leadId,
                icon: "📝",
                text: `Proposta enviada para <strong>${p.company}</strong>`,
                sub: `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.value)}`,
                color: "var(--primary)"
            });
            if (p.closedAt && ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)) {
                events.push({
                    timestamp: new Date(p.closedAt),
                    leadId,
                    icon: "✅",
                    text: `Venda fechada com <strong>${p.company}</strong>`,
                    sub: `+${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.value)}`,
                    color: "var(--success)"
                });
            }
            if (p.closedAt && p.status === "Perdido") {
                events.push({
                    timestamp: new Date(p.closedAt),
                    leadId,
                    icon: "❌",
                    text: `Perda registrada — <strong>${p.company}</strong>`,
                    sub: p.lossReason || "Motivo não informado",
                    color: "var(--danger)"
                });
            }
        });

        const sorted = events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

        if (sorted.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Nenhuma atividade registrada ainda.</p>`;
            return;
        }

        const fmtDate = d => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

        container.innerHTML = sorted.map(ev => `
            <div ${ev.leadId ? `onclick="window.location.hash = '#crm'; setTimeout(() => import('./crm.js').then(m => m.CRM.openLeadDrawer('${ev.leadId}')), 100);"` : ''} style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color); ${ev.leadId ? 'cursor: pointer; transition: transform var(--transition-fast);' : ''}" ${ev.leadId ? 'onmouseover="this.style.transform=\'translateX(4px)\'" onmouseout="this.style.transform=\'none\'"' : ''}>
                <div style="font-size: 18px; flex-shrink: 0; margin-top: 1px;">${ev.icon}</div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4;">${ev.text}</div>
                    <div style="font-size: 11px; color: ${ev.color}; font-weight: 600; margin-top: 2px;">${ev.sub}</div>
                </div>
                <div style="font-size: 10px; color: var(--text-muted); flex-shrink: 0; text-align: right; margin-top: 2px;">${fmtDate(ev.timestamp)}</div>
            </div>
        `).join("");
    },

    // ===========================================================================
    // CHART: EVOLUÇÃO DE TAREFAS DA SEMANA (SELLER DASHBOARD)
    // ===========================================================================
    renderTasksWeekChart() {
        const weekCanvas = document.getElementById("chart-tasks-week");
        const donutCanvas = document.getElementById("chart-tasks-donut");
        const pctLabel  = document.getElementById("task-pct-value");
        if (!weekCanvas) return;

        const session = JSON.parse(localStorage.getItem("comercial_session"));
        if (!session) return;

        const userEmail = session.email;
        const storageKey = `seller_tasks_${userEmail}`;
        const allTasks = JSON.parse(localStorage.getItem(storageKey) || "[]");

        // Build last 7 days data
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
            const dateStr = d.toLocaleDateString("pt-BR");
            const dayTasks = allTasks.filter(t => t.date === dateStr);
            days.push({
                label,
                total: dayTasks.length,
                done: dayTasks.filter(t => t.done).length,
                isToday: i === 0
            });
        }

        // Week bar chart
        if (typeof Chart !== 'undefined' && Chart.getChart) { const ex = Chart.getChart(weekCanvas); if (ex) ex.destroy(); } if (charts.tasksWeek) charts.tasksWeek.destroy();
        charts.tasksWeek = new Chart(weekCanvas, {
            type: "bar",
            data: {
                labels: days.map(d => d.label),
                datasets: [
                    {
                        label: "Concluídas",
                        data: days.map(d => d.done),
                        backgroundColor: days.map(d => d.isToday ? "#10b981" : "rgba(16,185,129,0.6)"),
                        borderRadius: 5,
                        borderSkipped: false,
                        order: 1
                    },
                    {
                        label: "Pendentes",
                        data: days.map(d => Math.max(0, d.total - d.done)),
                        backgroundColor: days.map(d => d.isToday ? "#e2e8f0" : "rgba(226,232,240,0.5)"),
                        borderRadius: 5,
                        borderSkipped: false,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.raw}`
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: "#64748b", font: { size: 11 } }
                    },
                    y: {
                        stacked: true,
                        display: false,
                        grid: { display: false }
                    }
                }
            }
        });

        // Today's donut
        const today = days[days.length - 1];
        const donePct = today.total > 0 ? Math.round((today.done / today.total) * 100) : 0;
        if (pctLabel) pctLabel.textContent = `${donePct}%`;

        if (donutCanvas) {
            if (typeof Chart !== 'undefined' && Chart.getChart) { const ex = Chart.getChart(donutCanvas); if (ex) ex.destroy(); } if (charts.tasksDonut) charts.tasksDonut.destroy();
            charts.tasksDonut = new Chart(donutCanvas, {
                type: "doughnut",
                data: {
                    datasets: [{
                        data: [today.done, Math.max(0, today.total - today.done)],
                        backgroundColor: ["#10b981", "#e2e8f0"],
                        borderWidth: 0,
                        hoverOffset: 2
                    }]
                },
                options: {
                    responsive: false,
                    cutout: "72%",
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
        }
    },

    setupAdminTaskManager() {
        const viewSeller = document.getElementById("admin-task-view-seller");
        const selectSeller = document.getElementById("admin-task-seller-select");
        const inputTask = document.getElementById("admin-task-input");
        const prioritySelect = document.getElementById("admin-task-priority");
        const btnAssign = document.getElementById("btn-admin-assign-task");
        const adminTaskList = document.getElementById("admin-task-list");

        if (!selectSeller || !viewSeller) return;

        // Popular selects com vendedores ativos
        const sellers = Store.getUsers().filter(u => u.role === "seller" || u.role === "manager");
        
        // Evitar repopular infinitamente
        if (selectSeller.options.length <= 1) {
            sellers.forEach(s => {
                const opt1 = new Option(s.name, s.email);
                const opt2 = new Option(s.name, s.email);
                selectSeller.add(opt1);
                viewSeller.add(opt2);
            });
        }

        const renderAssignedTasks = () => {
            const email = viewSeller.value;
            if (!email) {
                adminTaskList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">Selecione um vendedor acima para ver as tarefas atribuídas.</p>`;
                return;
            }

            const today = new Date().toLocaleDateString("pt-BR");
            const allTasks = Store.getTasks(email);
            const tasks = allTasks.filter(t => t.date === today);

            if (tasks.length === 0) {
                adminTaskList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">Nenhuma tarefa atribuída hoje para este vendedor.</p>`;
                return;
            }

            const priorityBadge = p => {
                if (p === "high") return `<span style="background: rgba(220,38,38,0.1); color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">ALTA</span>`;
                if (p === "low") return `<span style="background: rgba(22,163,74,0.1); color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">BAIXA</span>`;
                return `<span style="background: rgba(234,179,8,0.1); color: #ca8a04; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">NORMAL</span>`;
            };

            adminTaskList.innerHTML = tasks.map((t) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); ${t.done ? 'opacity: 0.6;' : ''}">
                    <div style="font-size: 13px; color: var(--text-primary);">
                        ${priorityBadge(t.priority)}
                        ${t.assignedBy && t.assignedBy !== email ? `<span style="font-size: 10px; color: var(--primary); font-weight: 600; border: 1px solid var(--primary); padding: 1px 4px; border-radius: 4px; margin-right: 6px;">GESTOR</span> ` : ''}
                        <span style="${t.done ? 'text-decoration: line-through;' : ''}">${t.text}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: ${t.done ? 'var(--success)' : 'var(--text-muted)'}">${t.done ? 'Concluída ✅' : 'Pendente ⏳'}</span>
                        <button class="delete-task-btn" data-email="${email}" data-id="${t.id || t.text}" style="background: none; border: none; cursor: pointer; color: #dc2626; padding: 4px; display: flex; align-items: center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                    </div>
                </div>
            `).join("");

            // Evento excluir
            adminTaskList.querySelectorAll(".delete-task-btn").forEach(btn => {
                btn.onclick = () => {
                    const mail = btn.getAttribute("data-email");
                    const taskId = btn.getAttribute("data-id");
                    let list = Store.getTasks(mail);
                    list = list.filter(t => (t.id !== taskId && t.text !== taskId));
                    Store.saveTasks(mail, list).then(() => {
                        renderAssignedTasks();
                        window.dispatchEvent(new Event("storage"));
                    });
                };
            });
        };

        viewSeller.onchange = renderAssignedTasks;

        btnAssign.onclick = () => {
            const targetSeller = selectSeller.value;
            const text = inputTask.value.trim();
            const priority = prioritySelect.value;

            if (!targetSeller) {
                alert("Selecione o vendedor para atribuir a tarefa.");
                return;
            }
            if (!text) {
                alert("Escreva uma instrução/tarefa.");
                return;
            }

            const today = new Date().toLocaleDateString("pt-BR");
            const tasks = Store.getTasks(targetSeller);
            
            tasks.push({
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                text,
                done: false,
                date: today,
                priority,
                assignedBy: Auth.getCurrentUser()?.email || "gestao@vellia.com"
            });

            Store.saveTasks(targetSeller, tasks).then(() => {
                inputTask.value = "";
                
                // Disparar evento para atualizar a listagem local imediatamente (útil se estiver no mesmo navegador)
                window.dispatchEvent(new Event("storage"));
                
                // Forçar visualização a selecionar o vendedor a quem foi atribuído
                viewSeller.value = targetSeller;
                renderAssignedTasks();
            });
        };

        if (!window._adminTasksListenerBound) {
            const handleAdminTasksUpdate = () => {
                const viewSel = document.getElementById("admin-task-view-seller");
                if (viewSel && viewSel.value) {
                    renderAssignedTasks();
                }
                import('./dashboard.js').then(m => {
                    if (m.Dashboard && typeof m.Dashboard.renderTasksWeekChart === 'function') {
                        m.Dashboard.renderTasksWeekChart();
                    }
                });
            };
            window.addEventListener("storage", handleAdminTasksUpdate);
            window.addEventListener("vellia:tasksChanged", handleAdminTasksUpdate);
            window._adminTasksListenerBound = true;
        }
    },

    // ===========================================================================
    // REGISTRO & MONITOR DE ATIVIDADES EM TEMPO REAL (VENDEDORES & ADM)
    // ===========================================================================
    getLiveActivities() {
        try {
            return JSON.parse(localStorage.getItem("vellia_live_activities") || "[]");
        } catch (e) {
            return [];
        }
    },

    saveLiveActivities(list) {
        localStorage.setItem("vellia_live_activities", JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("vellia:liveTasksChanged"));
    },

    startLiveActivity(sellerEmail, sellerName, activityText, durationMinutes) {
        if (!activityText || !activityText.trim()) {
            Toast.show("Por favor, informe a atividade que será executada.", "warning");
            return;
        }

        const dur = parseInt(durationMinutes) || 30;
        const now = new Date();
        const expectedEnd = new Date(now.getTime() + dur * 60000);
        const workspace = localStorage.getItem("activeCompany") || "Veeluen Solutions";

        const activities = this.getLiveActivities();

        // Encerra qualquer atividade anterior em andamento para este vendedor
        activities.forEach(a => {
            if (a.sellerEmail === sellerEmail && a.status === "in_progress") {
                a.status = "completed";
                a.completedAt = now.toISOString();
                a.actualMinutes = Math.max(1, Math.round((now.getTime() - new Date(a.startedAt).getTime()) / 60000));
            }
        });

        const newAct = {
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            sellerEmail,
            sellerName,
            workspace,
            activity: activityText.trim(),
            durationMinutes: dur,
            startedAt: now.toISOString(),
            expectedEndAt: expectedEnd.toISOString(),
            status: "in_progress",
            completedAt: null,
            actualMinutes: null,
            date: now.toLocaleDateString("pt-BR")
        };

        activities.unshift(newAct);
        this.saveLiveActivities(activities);

        // Sincronizar também no Store/Supabase em comercial_tasks para visibilidade entre computadores
        try {
            const currentTasks = Store.getTasks(sellerEmail) || [];
            currentTasks.unshift({
                id: newAct.id,
                owner: sellerEmail,
                text: `[ATIVIDADE_EXTRA] ${newAct.activity} (${dur} min)`,
                done: false,
                date: newAct.date,
                priority: "high",
                assignedBy: Auth.getCurrentUser()?.email || sellerEmail,
                workspace
            });
            Store.saveTasks(sellerEmail, currentTasks);
            Store.addLog(sellerEmail, "LIVE_TASK_STARTED", `Iniciou atividade extra: "${newAct.activity}" (Duração prevista: ${dur}min)`);
        } catch (e) {}

        Toast.show(`Atividade extra iniciada com sucesso! (${dur} min)`, "success");
        this.renderLiveTasksMonitor();
    },

    finishLiveActivity(activityId) {
        const activities = this.getLiveActivities();
        const act = activities.find(a => a.id === activityId);
        if (!act) return;

        const now = new Date();
        act.status = "completed";
        act.completedAt = now.toISOString();
        act.actualMinutes = Math.max(1, Math.round((now.getTime() - new Date(act.startedAt).getTime()) / 60000));

        this.saveLiveActivities(activities);

        try {
            const currentTasks = Store.getTasks(act.sellerEmail) || [];
            const t = currentTasks.find(x => x.id === activityId);
            if (t) {
                t.done = true;
                t.priority = "completed";
                t.text = `[ATIVIDADE_EXTRA] ${act.activity} (Concluída em ${act.actualMinutes} min)`;
                Store.saveTasks(act.sellerEmail, currentTasks);
            }
            Store.addLog(act.sellerEmail, "LIVE_TASK_FINISHED", `Concluiu atividade extra: "${act.activity}" (Tempo real: ${act.actualMinutes}min)`);
        } catch (e) {}

        Toast.show(`Atividade concluída com sucesso! Tempo dedicado: ${act.actualMinutes} min.`, "success");
        this.renderLiveTasksMonitor();
    },

    cancelLiveActivity(activityId) {
        if (!confirm("Deseja realmente cancelar esta atividade extra em execução?")) return;
        const activities = this.getLiveActivities();
        const act = activities.find(a => a.id === activityId);
        if (act) {
            act.status = "cancelled";
            act.completedAt = new Date().toISOString();
            this.saveLiveActivities(activities);
        }
        Toast.show("Atividade cancelada.", "info");
        this.renderLiveTasksMonitor();
    },

    renderLiveTasksMonitor() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const isAdmin = user.role === "admin" || user.role === "manager";
        let container = null;

        if (isAdmin) {
            container = document.getElementById("live-tasks-monitor-panel");
            const sellerContainer = document.getElementById("seller-live-activity-card");
            if (sellerContainer) sellerContainer.style.display = "none";
            if (container) container.style.display = "block";
        } else {
            container = document.getElementById("seller-live-activity-card") || document.getElementById("live-tasks-monitor-panel");
            const adminContainer = document.getElementById("live-tasks-monitor-panel");
            if (adminContainer && container !== adminContainer) adminContainer.style.display = "none";
            if (container) container.style.display = "block";
        }

        if (!container) return;
        const todayStr = new Date().toLocaleDateString("pt-BR");
        const allActivities = this.getLiveActivities();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";

        // Filtrar atividades pela empresa ativa e pelo dia de hoje
        const todayActivities = allActivities.filter(a => {
            const matchesComp = !a.workspace || a.workspace === activeCompany;
            return matchesComp && (a.date === todayStr || a.status === "in_progress");
        });

        // Pegar usuários vendedores da empresa
        const allUsers = Store.getUsers ? Store.getUsers() : [];
        const sellers = allUsers.filter(u => {
            if (u.role !== "seller" && u.role !== "manager") return false;
            if (u.companyAccess && u.companyAccess !== "Ambas" && u.companyAccess !== activeCompany) return false;
            return true;
        });

        // Injetar estilos de animação CSS se ainda não existirem
        if (!document.getElementById("live-tasks-anim-styles")) {
            const styleEl = document.createElement("style");
            styleEl.id = "live-tasks-anim-styles";
            styleEl.textContent = `
                @keyframes livePulseDot {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .live-pulse-indicator {
                    width: 10px; height: 10px; border-radius: 50%; background: #10b981;
                    display: inline-block; animation: livePulseDot 1.8s infinite;
                }
                .quick-task-pill {
                    font-size: 11.5px; font-weight: 600; padding: 5px 12px; border-radius: 20px;
                    border: 1px solid var(--border-color); background: var(--bg-body);
                    color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease;
                }
                .quick-task-pill:hover {
                    border-color: var(--primary); color: var(--primary); background: rgba(99,102,241,0.08);
                }
                .duration-btn {
                    padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border-color);
                    background: var(--bg-body); font-size: 12px; font-weight: 700;
                    color: var(--text-primary); cursor: pointer; transition: all 0.2s ease;
                }
                .duration-btn.active {
                    background: var(--primary); color: #fff; border-color: var(--primary);
                    box-shadow: 0 2px 8px rgba(99,102,241,0.3);
                }
            `;
            document.head.appendChild(styleEl);
        }

        if (isAdmin) {
            // ================================================================
            // VISÃO DO ADMINISTRADOR / GESTOR
            // ================================================================
            const inProgressTotal = todayActivities.filter(a => a.status === "in_progress").length;
            const completedTotal = todayActivities.filter(a => a.status === "completed").length;

            container.innerHTML = `
                <!-- Cabeçalho do Painel ADM -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16,185,129,0.25);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h4 style="font-weight: 800; font-size: 16px; color: var(--text-primary); margin: 0;">Atividades da Equipe em Tempo Real</h4>
                                <span class="live-pulse-indicator" title="Monitoramento ao vivo"></span>
                                <span style="font-size: 11px; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 12px;">AO VIVO</span>
                            </div>
                            <span style="font-size: 12px; color: var(--text-muted);">Acompanhamento ao vivo das atividades extras em execução pelos vendedores naquele momento.</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div style="display: flex; gap: 6px;">
                            <span style="font-size: 11.5px; background: rgba(16,185,129,0.12); color: #10b981; padding: 5px 10px; border-radius: 6px; font-weight: 700;">
                                🔥 ${inProgressTotal} em andamento agora
                            </span>
                            <span style="font-size: 11.5px; background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-muted); padding: 5px 10px; border-radius: 6px; font-weight: 600;">
                                ✅ ${completedTotal} concluídas hoje
                            </span>
                        </div>
                        <button id="btn-refresh-live-tasks" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Atualizar
                        </button>
                    </div>
                </div>

                <!-- Grid de Vendedores: Status Ao Vivo (O que estão fazendo agora?) -->
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>👥 Status Atual dos Vendedores (${sellers.length})</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
                        ${sellers.map(s => {
                            const activeAct = todayActivities.find(a => a.sellerEmail === s.email && a.status === "in_progress");
                            const isBusy = !!activeAct;

                            if (isBusy) {
                                const startTime = new Date(activeAct.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                                return `
                                <div style="background: linear-gradient(135deg, rgba(16,185,129,0.09) 0%, rgba(5,150,105,0.03) 100%); border: 1.5px solid rgba(16,185,129,0.4); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 14px rgba(16,185,129,0.08); transition: transform 0.2s ease;">
                                    <div>
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px;">
                                                    ${(s.name || s.email).substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 800; font-size: 13.5px; color: var(--text-primary);">${s.name || s.email}</div>
                                                    <div style="font-size: 11px; color: var(--text-muted);">${s.email}</div>
                                                </div>
                                            </div>
                                            <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 800; color: #059669; background: rgba(16,185,129,0.15); padding: 3px 8px; border-radius: 20px;">
                                                <span class="live-pulse-indicator"></span> EXECUTANDO AGORA
                                            </span>
                                        </div>

                                        <div style="background: var(--bg-surface); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;">
                                            <div style="font-size: 11px; text-transform: uppercase; color: #059669; font-weight: 800; margin-bottom: 2px;">Atividade em Andamento:</div>
                                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); line-height: 1.4;">${activeAct.activity}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">
                                            <span>Iniciado às <strong>${startTime}</strong></span>
                                            <span>Previsão: <strong>${activeAct.durationMinutes} min</strong></span>
                                        </div>
                                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 700;">
                                            <span style="color: var(--text-primary);">
                                                ⏱️ <span class="live-timer-elapsed" data-started="${activeAct.startedAt}" data-duration="${activeAct.durationMinutes}">Calculando...</span>
                                            </span>
                                            <button class="btn-admin-finish-task" data-id="${activeAct.id}" style="border: none; background: rgba(16,185,129,0.15); color: #059669; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;">
                                                Concluir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                `;
                            } else {
                                // Vendedor livre
                                const lastFinished = todayActivities.filter(a => a.sellerEmail === s.email && a.status === "completed")[0];
                                return `
                                <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; opacity: 0.9;">
                                    <div>
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
                                                    ${(s.name || s.email).substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${s.name || s.email}</div>
                                                    <div style="font-size: 11px; color: var(--text-muted);">${s.email}</div>
                                                </div>
                                            </div>
                                            <span style="font-size: 11px; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-color); padding: 2px 7px; border-radius: 12px;">
                                                Disponível
                                            </span>
                                        </div>
                                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">
                                            ${lastFinished ? `Última: "${lastFinished.activity}" (${lastFinished.actualMinutes || lastFinished.durationMinutes} min)` : "Nenhuma atividade extra registrada hoje."}
                                        </div>
                                    </div>
                                    <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                                        <button class="btn-admin-assign-quick" data-email="${s.email}" data-name="${s.name}" style="background: none; border: 1px dashed var(--border-color); padding: 4px 10px; border-radius: 6px; font-size: 11px; color: var(--primary); cursor: pointer; font-weight: 600;">
                                            + Atribuir Atividade
                                        </button>
                                    </div>
                                </div>
                                `;
                            }
                        }).join("")}
                    </div>
                </div>

                <!-- Tabela de Atividades Extras Registradas Hoje -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">
                            📋 Histórico de Atividades Extras do Dia (${todayActivities.length})
                        </span>
                    </div>

                    ${todayActivities.length === 0 ? `
                        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; background: var(--bg-body); border-radius: 10px; border: 1px dashed var(--border-color);">
                            Nenhuma atividade extra foi registrada hoje pelos vendedores ainda.
                        </div>
                    ` : `
                        <div style="overflow-x: auto; background: var(--bg-body); border-radius: 10px; border: 1px solid var(--border-color);">
                            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-muted); font-size: 11px; text-transform: uppercase;">
                                        <th style="padding: 10px 14px;">Vendedor</th>
                                        <th style="padding: 10px 14px;">Atividade Extra</th>
                                        <th style="padding: 10px 14px;">Início</th>
                                        <th style="padding: 10px 14px;">Duração Prevista</th>
                                        <th style="padding: 10px 14px;">Tempo Real</th>
                                        <th style="padding: 10px 14px; text-align: right;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${todayActivities.map(a => {
                                        const startTime = new Date(a.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                                        let statusBadge = "";
                                        if (a.status === "in_progress") {
                                            statusBadge = `<span style="background: rgba(16,185,129,0.15); color: #10b981; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-size: 11px;">🟢 Em Andamento</span>`;
                                        } else if (a.status === "completed") {
                                            statusBadge = `<span style="background: rgba(99,102,241,0.12); color: var(--primary); font-weight: 700; padding: 3px 8px; border-radius: 6px; font-size: 11px;">✅ Concluída</span>`;
                                        } else {
                                            statusBadge = `<span style="background: rgba(100,116,139,0.12); color: var(--text-muted); padding: 3px 8px; border-radius: 6px; font-size: 11px;">Cancelada</span>`;
                                        }

                                        return `
                                        <tr style="border-bottom: 1px solid var(--border-color);">
                                            <td style="padding: 10px 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap;">
                                                ${a.sellerName || a.sellerEmail}
                                            </td>
                                            <td style="padding: 10px 14px; color: var(--text-primary); font-weight: 500;">
                                                ${a.activity}
                                            </td>
                                            <td style="padding: 10px 14px; color: var(--text-muted); white-space: nowrap;">
                                                ${startTime}
                                            </td>
                                            <td style="padding: 10px 14px; color: var(--text-muted); white-space: nowrap;">
                                                ${a.durationMinutes} min
                                            </td>
                                            <td style="padding: 10px 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap;">
                                                ${a.actualMinutes ? `${a.actualMinutes} min` : (a.status === "in_progress" ? `<span class="live-timer-elapsed" data-started="${a.startedAt}">...</span>` : "-")}
                                            </td>
                                            <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
                                                ${statusBadge}
                                            </td>
                                        </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            `;

            // Vincular botões do ADM
            container.querySelectorAll(".btn-admin-finish-task").forEach(btn => {
                btn.onclick = () => this.finishLiveActivity(btn.getAttribute("data-id"));
            });

            container.querySelectorAll(".btn-admin-assign-quick").forEach(btn => {
                btn.onclick = () => {
                    const email = btn.getAttribute("data-email");
                    const name = btn.getAttribute("data-name");
                    const actName = prompt(`Informe a atividade que ${name} irá executar agora:`);
                    if (actName && actName.trim()) {
                        const dur = prompt("Duração prevista em minutos (ex: 30, 45, 60):", "30");
                        this.startLiveActivity(email, name, actName.trim(), parseInt(dur) || 30);
                    }
                };
            });

            const btnRefresh = document.getElementById("btn-refresh-live-tasks");
            if (btnRefresh) btnRefresh.onclick = () => this.renderLiveTasksMonitor();

        } else {
            // ================================================================
            // VISÃO DO VENDEDOR (ex: Mika)
            // ================================================================
            const currentSellerEmail = user.email;
            const currentSellerName = user.name || "Vendedor";
            const myActivities = todayActivities.filter(a => a.sellerEmail === currentSellerEmail);
            const activeActivity = myActivities.find(a => a.status === "in_progress");

            // Soma de minutos dedicados hoje em atividades extras
            const totalMinutesToday = myActivities
                .filter(a => a.status === "completed")
                .reduce((sum, a) => sum + (a.actualMinutes || a.durationMinutes || 0), 0);

            if (activeActivity) {
                // VENDEDOR TEM ATIVIDADE EM ANDAMENTO AGORA
                const startTime = new Date(activeActivity.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                container.innerHTML = `
                    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.04) 100%); border: 1.5px solid #10b981; border-radius: 14px; padding: 22px 24px; position: relative; overflow: hidden; box-shadow: 0 4px 20px rgba(16,185,129,0.12);">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="live-pulse-indicator"></span>
                                <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; background: rgba(16,185,129,0.2); padding: 3px 10px; border-radius: 20px;">
                                    ATIVIDADE EM EXECUÇÃO AGORA
                                </span>
                                <span style="font-size: 12px; color: var(--text-muted);">Iniciada às <strong>${startTime}</strong></span>
                            </div>
                            <span style="font-size: 12px; font-weight: 700; color: #059669; background: var(--bg-surface); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(16,185,129,0.3);">
                                🎯 Duração planejada: ${activeActivity.durationMinutes} min
                            </span>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 19px; font-weight: 800; color: var(--text-primary); margin: 0 0 6px 0; line-height: 1.3;">
                                ${activeActivity.activity}
                            </h3>
                            <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0;">
                                O administrador e a liderança sabem que você está focado nesta tarefa agora.
                            </p>
                        </div>

                        <!-- Cronômetro e Barra de Progresso -->
                        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                                <div style="display: flex; align-items: baseline; gap: 8px;">
                                    <span style="font-size: 26px; font-weight: 800; color: #10b981; font-family: monospace;" class="live-timer-elapsed" data-started="${activeActivity.startedAt}" data-duration="${activeActivity.durationMinutes}">
                                        00:00
                                    </span>
                                    <span style="font-size: 12px; color: var(--text-muted);">decorridos</span>
                                </div>
                                <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary);" id="live-timer-remaining">
                                    Calculando tempo restante...
                                </div>
                            </div>
                            <div style="background: var(--bg-body); border-radius: 6px; height: 10px; overflow: hidden;">
                                <div id="live-timer-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 6px; transition: width 0.8s ease;"></div>
                            </div>
                        </div>

                        <!-- Botões de Ação do Vendedor -->
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <button id="btn-finish-current-task" class="btn" style="background: #10b981; color: #fff; font-weight: 800; padding: 10px 20px; font-size: 13.5px; border: none; border-radius: 8px; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                Concluir Atividade Agora
                            </button>
                            <button id="btn-cancel-current-task" class="btn btn-outline" style="padding: 10px 16px; font-size: 13px; border-radius: 8px;">
                                Cancelar
                            </button>
                        </div>
                    </div>
                `;

                document.getElementById("btn-finish-current-task").onclick = () => this.finishLiveActivity(activeActivity.id);
                document.getElementById("btn-cancel-current-task").onclick = () => this.cancelLiveActivity(activeActivity.id);

            } else {
                // VENDEDOR NÃO TEM ATIVIDADE EM ANDAMENTO: FORMULÁRIO DE REGISTRO
                container.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(99,102,241,0.25);">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div>
                                <h4 style="font-weight: 800; font-size: 15px; color: var(--text-primary); margin: 0 0 2px 0;">Registro de Atividade em Tempo Real</h4>
                                <span style="font-size: 11.5px; color: var(--text-muted);">Informe qual atividade extra você está iniciando para que o Administrador acompanhe naquele momento.</span>
                            </div>
                        </div>
                        ${totalMinutesToday > 0 ? `
                            <span style="font-size: 11.5px; font-weight: 700; color: #10b981; background: rgba(16,185,129,0.1); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.2);">
                                ⏱️ Hoje: ${totalMinutesToday} min dedicados em atividades extras
                            </span>
                        ` : ""}
                    </div>

                    <!-- Formulário de Registro Rápido -->
                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px;">
                        <div style="margin-bottom: 14px;">
                            <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                                1. Qual atividade você vai executar agora? *
                            </label>
                            <input type="text" id="live-activity-input" class="form-control" placeholder="Ex: Ligando para leads frios, Montagem de proposta técnica nº 1140, Follow-up WhatsApp..." style="height: 44px; font-size: 13.5px;" autofocus>
                            
                            <!-- Sugestões Rápidas em Pills -->
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                                <button type="button" class="quick-task-pill" data-text="📞 Prospecção Ativa por Telefone">📞 Prospecção Ativa</button>
                                <button type="button" class="quick-task-pill" data-text="📄 Elaboração de Proposta Comercial">📄 Elaboração de Proposta</button>
                                <button type="button" class="quick-task-pill" data-text="💬 Follow-up com Clientes via WhatsApp">💬 Follow-up WhatsApp</button>
                                <button type="button" class="quick-task-pill" data-text="🤝 Reunião de Negociação / Alinhamento">🤝 Reunião com Cliente</button>
                                <button type="button" class="quick-task-pill" data-text="🔍 Qualificação e Pesquisa de Leads">🔍 Qualificação de Leads</button>
                                <button type="button" class="quick-task-pill" data-text="📑 Laudo Técnico & Inspeções">📑 Laudo Técnico</button>
                            </div>
                        </div>

                        <div style="margin-bottom: 18px;">
                            <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                                2. Quanto tempo será executada? (Duração prevista) *
                            </label>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                <button type="button" class="duration-btn" data-min="15">15 min</button>
                                <button type="button" class="duration-btn active" data-min="30">30 min</button>
                                <button type="button" class="duration-btn" data-min="45">45 min</button>
                                <button type="button" class="duration-btn" data-min="60">1 hora</button>
                                <button type="button" class="duration-btn" data-min="90">1h 30m</button>
                                <button type="button" class="duration-btn" data-min="120">2 horas</button>
                                <div style="display: flex; align-items: center; gap: 4px; margin-left: 6px;">
                                    <input type="number" id="live-activity-custom-min" value="30" min="5" max="480" style="width: 70px; height: 36px; text-align: center; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-weight: 700; font-size: 13px;">
                                    <span style="font-size: 12px; color: var(--text-muted);">min</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <button id="btn-start-seller-activity" class="btn btn-primary" style="padding: 10px 24px; font-size: 14px; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; border-radius: 8px; box-shadow: 0 4px 14px rgba(99,102,241,0.3);">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                Iniciar Atividade Agora
                            </button>
                        </div>
                    </div>

                    <!-- Histórico das Atividades Concluídas Hoje pelo Vendedor -->
                    ${myActivities.length > 0 ? `
                        <div>
                            <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;">
                                📜 Minhas Atividades Concluídas Hoje (${myActivities.length})
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${myActivities.map(a => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: var(--bg-body); border: 1px solid var(--border-color); font-size: 12px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="color: ${a.status === 'completed' ? '#10b981' : '#64748b'}; font-weight: 700;">
                                                ${a.status === 'completed' ? '✅' : '❌'}
                                            </span>
                                            <span style="font-weight: 600; color: var(--text-primary);">${a.activity}</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 11px;">
                                            <span>Início: ${new Date(a.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                            <span style="background: var(--bg-surface); padding: 2px 6px; border-radius: 4px; font-weight: 700; color: var(--text-primary);">
                                                ${a.actualMinutes ? `${a.actualMinutes} min gastos` : `${a.durationMinutes} min previstos`}
                                            </span>
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    ` : ""}
                `;

                // Interatividade do Formulário
                const inputActivity = document.getElementById("live-activity-input");
                const customMinInput = document.getElementById("live-activity-custom-min");
                const durationBtns = container.querySelectorAll(".duration-btn");

                // Clique nas sugestões rápidas
                container.querySelectorAll(".quick-task-pill").forEach(p => {
                    p.onclick = () => {
                        inputActivity.value = p.getAttribute("data-text");
                        inputActivity.focus();
                    };
                });

                // Seleção de botões de duração
                durationBtns.forEach(btn => {
                    btn.onclick = () => {
                        durationBtns.forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        customMinInput.value = btn.getAttribute("data-min");
                    };
                });

                customMinInput.oninput = () => {
                    durationBtns.forEach(b => b.classList.remove("active"));
                };

                // Botão de iniciar atividade
                document.getElementById("btn-start-seller-activity").onclick = () => {
                    const text = inputActivity.value.trim();
                    const dur = parseInt(customMinInput.value) || 30;
                    this.startLiveActivity(currentSellerEmail, currentSellerName, text, dur);
                };
            }
        }

        // Executar atualização imediata dos cronômetros
        this.updateLiveTimers();
    },

    updateLiveTimers() {
        const timerEls = document.querySelectorAll(".live-timer-elapsed");
        if (timerEls.length === 0) return;

        const now = Date.now();

        timerEls.forEach(el => {
            const startedIso = el.getAttribute("data-started");
            if (!startedIso) return;

            const startedAt = new Date(startedIso).getTime();
            if (isNaN(startedAt)) return;

            const elapsedMs = Math.max(0, now - startedAt);
            const totalSec = Math.floor(elapsedMs / 1000);
            const hours = Math.floor(totalSec / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;

            const timeStr = hours > 0
                ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            el.textContent = timeStr;

            // Se tiver duração prevista, atualizar cálculo restante e barra
            const durationMin = parseInt(el.getAttribute("data-duration"));
            if (durationMin > 0) {
                const totalPlannedSec = durationMin * 60;
                const remainingSec = totalPlannedSec - totalSec;

                const remainingEl = document.getElementById("live-timer-remaining");
                if (remainingEl) {
                    if (remainingSec > 0) {
                        const remMin = Math.ceil(remainingSec / 60);
                        remainingEl.innerHTML = `⏳ <strong>${remMin} min</strong> restantes`;
                        remainingEl.style.color = "var(--text-secondary)";
                    } else {
                        const overMin = Math.floor(Math.abs(remainingSec) / 60);
                        remainingEl.innerHTML = `⚠️ Tempo previsto excedido em <strong>+${overMin} min</strong>`;
                        remainingEl.style.color = "#ef4444";
                    }
                }

                const progressBar = document.getElementById("live-timer-progress-bar");
                if (progressBar) {
                    const pct = Math.min(100, Math.round((totalSec / totalPlannedSec) * 100));
                    progressBar.style.width = pct + "%";
                    if (pct >= 100) {
                        progressBar.style.background = "#ef4444";
                    } else {
                        progressBar.style.background = "linear-gradient(90deg, #10b981, #059669)";
                    }
                }
            }
        });
    },

    // ===========================================================================
    // MATRIZ DE PERFORMANCE E ROI POR CANAL DE ANÚNCIOS
    // ===========================================================================
    renderChannelRoiMatrix(leads, proposals) {
        const container = document.getElementById("channel-roi-matrix-container");
        if (!container) return;

        const channels = [
            { name: "Meta Ads (Facebook)", key: ["Meta Ads", "Facebook"], icon: "🟦", color: "#1877F2" },
            { name: "Instagram Direct", key: ["Instagram Direct", "Instagram"], icon: "📸", color: "#E1306C" },
            { name: "Facebook Messenger", key: ["Facebook Messenger", "Messenger"], icon: "💬", color: "#0084FF" },
            { name: "WhatsApp API", key: ["WhatsApp", "WhatsApp Copilot"], icon: "🟢", color: "#25D366" },
            { name: "Google Ads", key: ["Google Ads", "Google"], icon: "🔍", color: "#EA4335" },
            { name: "Inbound Website", key: ["Inbound Website", "Website"], icon: "🌐", color: "#6366F1" },
            { name: "Outros / Indicação", key: ["Indicação Direct", "Outbound", "Outros"], icon: "🤝", color: "#8B5CF6" }
        ];

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        const matrixData = channels.map(ch => {
            const chLeads = leads.filter(l => ch.key.some(k => (l.source || "").toLowerCase().includes(k.toLowerCase())));
            const totalCount = chLeads.length;
            const qualifiedCount = chLeads.filter(l => l.stage !== "Contato" && l.stage !== "Lead Gerado" && l.stage !== "Cliente Perdido").length;
            const wonLeads = chLeads.filter(l => l.stage === "Cliente Fechado");
            const wonCount = wonLeads.length;
            
            // Somar receita de propostas ganhas ou estimativa do lead
            const wonRevenue = proposals
                .filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status) && chLeads.some(l => l.id === p.leadId || l.company === p.company))
                .reduce((s, p) => s + (p.value || 0), 0) || wonLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0);

            const convRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;
            const ticketMedio = wonCount > 0 ? Math.round(wonRevenue / wonCount) : 0;

            return {
                ...ch,
                totalCount,
                qualifiedCount,
                wonCount,
                wonRevenue,
                convRate,
                ticketMedio
            };
        });

        const maxRevenue = Math.max(...matrixData.map(d => d.wonRevenue), 1);

        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="table" style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                            <th style="padding: 10px 12px;">Canal de Anúncio / Origem</th>
                            <th style="padding: 10px 12px; text-align: center;">Total Leads</th>
                            <th style="padding: 10px 12px; text-align: center;">Qualificados (SDR)</th>
                            <th style="padding: 10px 12px; text-align: center;">Vendas Fechadas</th>
                            <th style="padding: 10px 12px; text-align: center;">Taxa de Conversão</th>
                            <th style="padding: 10px 12px; text-align: right;">Receita Gerada</th>
                            <th style="padding: 10px 12px; text-align: right;">Ticket Médio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matrixData.map(row => {
                            const pctBar = Math.round((row.wonRevenue / maxRevenue) * 100);
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 12px; font-weight: 700; color: var(--text-primary);">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span>${row.icon}</span>
                                            <span>${row.name}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 12px; text-align: center; font-weight: 600;">${row.totalCount}</td>
                                    <td style="padding: 12px; text-align: center; color: #8b5cf6; font-weight: 600;">${row.qualifiedCount}</td>
                                    <td style="padding: 12px; text-align: center; color: #10b981; font-weight: 700;">${row.wonCount}</td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span class="badge" style="background: rgba(99,102,241,0.1); color: var(--primary); font-weight: 700;">${row.convRate}%</span>
                                    </td>
                                    <td style="padding: 12px; text-align: right; font-weight: 700; color: var(--text-primary);">
                                        <div>${fmt(row.wonRevenue)}</div>
                                        <div style="height: 4px; background: var(--bg-app); border-radius: 2px; margin-top: 4px; overflow: hidden; min-width: 100px;">
                                            <div style="height: 100%; width: ${pctBar}%; background: ${row.color}; border-radius: 2px; transition: width 0.6s;"></div>
                                        </div>
                                    </td>
                                    <td style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-muted);">${fmt(row.ticketMedio)}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;

        const lastUpdate = document.getElementById("channel-roi-last-update");
        if (lastUpdate) {
            lastUpdate.textContent = "Atualizado em tempo real: " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        }
    },

    // ===========================================================================
    // PAINEL DE METAS & COMISSÕES DA EQUIPE COMERCIAL / VENDEDOR
    // ===========================================================================
    renderGoalsCommissionPanel() {
        const container = document.getElementById("dashboard-goals-commissions-panel");
        if (!container) return;

        const user = Auth.getCurrentUser();
        if (!user) return;

        const rate = parseFloat(localStorage.getItem("comercial_commission_rate")) || 5.0; // 5% por padrão
        const proposals = Store.getProposals();
        const users = Store.getUsers();

        // Mês atual
        const now = new Date();
        const currentPeriodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        const monthNameFormatted = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        // Obter metas salvas
        const goalsConfig = JSON.parse(localStorage.getItem("comercial_goals_config")) || { meta_revenue: 50000 };
        const defaultRevenueGoal = goalsConfig.meta_revenue || 50000;

        // Lista de vendedores / gerentes
        const sellers = users.filter(u => u.role === "seller" || u.role === "manager" || u.role === "admin");

        // Inicializar valor de simulação se não existir
        if (this._simulatedValue === undefined) {
            this._simulatedValue = 0;
        }
        const simVal = this._simulatedValue;

        // Calcular estatísticas por vendedor
        const sellerStats = sellers.map(seller => {
            const sellerProps = proposals.filter(p => {
                const isWon = ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status);
                const isOwner = p.createdBy === seller.email || p.ownerEmail === seller.email || p.userEmail === seller.email;
                return isWon && isOwner;
            });

            const wonRevenue = sellerProps.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
            const commission = (wonRevenue * rate) / 100;
            const targetRevenue = defaultRevenueGoal;
            const pct = targetRevenue > 0 ? Math.min(100, Math.round((wonRevenue / targetRevenue) * 100)) : 0;

            return {
                email: seller.email,
                name: seller.name,
                avatar: seller.avatar || "👤",
                role: seller.role,
                wonRevenue,
                commission,
                targetRevenue,
                pct,
                wonCount: sellerProps.length
            };
        });

        // Ordenar vendedores pelo faturamento ganho
        sellerStats.sort((a, b) => b.wonRevenue - a.wonRevenue);

        const totalWonRevenue = sellerStats.reduce((s, st) => s + st.wonRevenue, 0);
        const totalTargetRevenue = sellerStats.reduce((s, st) => s + st.targetRevenue, 0);
        const totalCommission = (totalWonRevenue * rate) / 100;
        const totalPct = totalTargetRevenue > 0 ? Math.min(100, Math.round((totalWonRevenue / totalTargetRevenue) * 100)) : 0;

        const isSellerOnly = user.role === "seller";

        if (isSellerOnly) {
            // Visão individual do vendedor
            const myStat = sellerStats.find(s => s.email === user.email) || {
                wonRevenue: 0,
                commission: 0,
                targetRevenue: defaultRevenueGoal,
                pct: 0,
                wonCount: 0
            };

            // Aplicar simulação
            const wonRevenueSim = myStat.wonRevenue + simVal;
            const commissionSim = myStat.commission + (simVal * rate) / 100;
            const pctSim = myStat.targetRevenue > 0 ? Math.min(100, Math.round((wonRevenueSim / myStat.targetRevenue) * 100)) : 0;

            let badgeStatus = `<span class="badge badge-warning" style="background:#fef3c7; color:#d97706;">🟡 Em Andamento</span>`;
            if (pctSim >= 100) {
                badgeStatus = `<span class="badge badge-success" style="background:#dcfce7; color:#16a34a; font-weight:700;">🟢 Meta Batida! 🎉</span>`;
            } else if (pctSim < 40) {
                badgeStatus = `<span class="badge badge-danger" style="background:#fee2e2; color:#dc2626;">🔴 Abaixo da Meta</span>`;
            }

            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="font-weight: 800; font-size: 15px; color: var(--text-primary); margin: 0 0 3px 0; display: flex; align-items: center; gap: 8px;">
                            🎯 Meu Desempenho & Comissão — ${monthNameFormatted} ${simVal > 0 ? `<span style="font-size:10px; padding:2px 6px; background:var(--primary); color:white; border-radius:4px; font-weight:normal;">Simulado</span>` : ""}
                        </h4>
                        <span style="font-size: 11.5px; color: var(--text-muted);">Acompanhe suas vendas fechadas e sua comissão acumulada no mês</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${badgeStatus}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 18px;">
                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Faturamento Realizado</span>
                        <div style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 4px;">R$ ${wonRevenueSim.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <span style="font-size: 11px; color: var(--text-muted);">Meta: R$ ${myStat.targetRevenue.toLocaleString("pt-BR")}</span>
                    </div>

                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Comissão a Receber (${rate}%)</span>
                        <div style="font-size: 22px; font-weight: 800; color: #8b5cf6; margin-top: 4px;">R$ ${commissionSim.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <span style="font-size: 11px; color: #8b5cf6; font-weight: 600;">Calculado sobre vendas pagas</span>
                    </div>

                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Atingimento da Meta</span>
                        <div style="font-size: 22px; font-weight: 800; color: #1877F2; margin-top: 4px;">${pctSim}%</div>
                        <span style="font-size: 11px; color: var(--text-muted);">${myStat.wonCount} contrato(s) fechado(s)</span>
                    </div>
                </div>

                <div style="margin-bottom: 18px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                        <span>Progresso da Meta Individual</span>
                        <span>${pctSim}% Concluído</span>
                    </div>
                    <div style="width: 100%; height: 10px; background: var(--bg-app); border-radius: 99px; overflow: hidden; border: 1px solid var(--border-color);">
                        <div style="width: ${pctSim}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 99px; transition: width 0.8s ease;"></div>
                    </div>
                </div>

                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-primary);">
                            🧮 Simular Vendas Adicionais: <strong style="color: var(--primary);">R$ ${simVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</strong>
                        </span>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Comissão extra estimada: R$ ${((simVal * rate) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <input type="range" id="goals-simulation-slider" min="0" max="150000" step="5000" value="${simVal}" style="width: 100%; accent-color: var(--primary); cursor: pointer;">
                </div>
            `;
        } else {
            // Visão Gerente / Admin (Equipe Comercial Completa)
            const totalWonRevenueSim = totalWonRevenue + simVal;
            const totalCommissionSim = totalCommission + (simVal * rate) / 100;
            const totalPctSim = totalTargetRevenue > 0 ? Math.min(100, Math.round((totalWonRevenueSim / totalTargetRevenue) * 100)) : 0;

            const rowsHtml = sellerStats.map(st => {
                let badge = `<span class="badge badge-warning" style="background:#fef3c7; color:#d97706; font-size:11px;">🟡 Em Progresso</span>`;
                if (st.pct >= 100) {
                    badge = `<span class="badge badge-success" style="background:#dcfce7; color:#16a34a; font-weight:700; font-size:11px;">🟢 Meta Batida!</span>`;
                } else if (st.pct < 40) {
                    badge = `<span class="badge badge-danger" style="background:#fee2e2; color:#dc2626; font-size:11px;">🔴 Em Risco</span>`;
                }

                const barColor = st.pct >= 100 ? '#10b981' : st.pct >= 50 ? '#6366f1' : st.pct > 0 ? '#f59e0b' : 'var(--border-color)';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 12px 16px; display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
                                ${st.avatar}
                            </div>
                            <div>
                                <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${st.name}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${st.email}</div>
                            </div>
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #10b981;">R$ ${st.wonRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 16px; color: var(--text-secondary);">R$ ${st.targetRevenue.toLocaleString("pt-BR")}</td>
                        <td style="padding: 12px 16px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 70px; height: 6px; background: var(--bg-app); border-radius: 99px; overflow: hidden; border: 1px solid var(--border-color);">
                                    <div style="width: ${st.pct}%; height: 100%; background: ${barColor}; border-radius: 99px; transition: width 0.6s ease;"></div>
                                </div>
                                <span style="font-weight: 700; font-size: 12px; color: ${barColor === 'var(--border-color)' ? 'var(--text-muted)' : barColor};">${st.pct}%</span>
                            </div>
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #8b5cf6;">R$ ${st.commission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 16px; text-align: center;">${badge}</td>
                    </tr>
                `;
            }).join("");

            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="font-weight: 800; font-size: 15px; color: var(--text-primary); margin: 0 0 3px 0; display: flex; align-items: center; gap: 8px;">
                            🎯 Metas & Comissões da Equipe Comercial — ${monthNameFormatted} ${simVal > 0 ? `<span style="font-size:10px; padding:2px 6px; background:var(--primary); color:white; border-radius:4px; font-weight:normal;">Simulado</span>` : ""}
                        </h4>
                        <span style="font-size: 11.5px; color: var(--text-muted);">Monitoramento de metas batidas e cálculo de comissões por vendedor</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn btn-outline" style="font-size: 11.5px; padding: 5px 12px;" onclick="window.configureCommissionRate(${rate})">
                            ⚙️ Taxa de Comissão: <strong>${rate}%</strong>
                        </button>
                    </div>
                </div>

                <!-- KPI Cards Topo -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Total Fechado (Mês)</span>
                        <div style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 4px;">R$ ${totalWonRevenueSim.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <span style="font-size: 11px; color: var(--text-muted);">Meta Global: R$ ${totalTargetRevenue.toLocaleString("pt-BR")}</span>
                    </div>

                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Total Comissões Equipe</span>
                        <div style="font-size: 22px; font-weight: 800; color: #8b5cf6; margin-top: 4px;">R$ ${totalCommissionSim.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <span style="font-size: 11px; color: #8b5cf6; font-weight: 600;">${rate}% sobre vendas do mês</span>
                    </div>

                    <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Progresso da Meta Global</span>
                        <div style="font-size: 22px; font-weight: 800; color: #1877F2; margin-top: 4px;">${totalPctSim}%</div>
                        <span style="font-size: 11px; color: var(--text-muted);">${sellerStats.filter(s => s.pct >= 100).length} de ${sellerStats.length} vendedores bateram a meta</span>
                    </div>
                </div>

                <!-- Tabela da Equipe com rolagem interna compacta -->
                <div class="table-responsive" style="margin-bottom: 18px; max-height: 420px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    <table class="custom-table" style="width: 100%; margin: 0;">
                        <thead style="position: sticky; top: 0; z-index: 2; background: var(--bg-surface);">
                            <tr>
                                <th>Vendedor</th>
                                <th>Fechado (Mês)</th>
                                <th>Meta Individual</th>
                                <th>Atingimento</th>
                                <th>Comissão (${rate}%)</th>
                                <th style="text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--text-primary); justify-content: flex-start;">
                            🧮 Simular Vendas Adicionais Equipe: <strong style="color: var(--primary);">R$ ${simVal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</strong>
                        </span>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Comissão extra estimada: R$ ${((simVal * rate) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <input type="range" id="goals-simulation-slider" min="0" max="300000" step="10000" value="${simVal}" style="width: 100%; accent-color: var(--primary); cursor: pointer;">
                </div>
            `;
        }

        // Vincular escuta ao slider de simulação imediatamente após renderizar
        const slider = document.getElementById("goals-simulation-slider");
        if (slider) {
            slider.addEventListener("input", (e) => {
                this._simulatedValue = Number(e.target.value);
                this.renderGoalsCommissionPanel();
            });
        }
    }
};

// Expor globalmente para os botões no HTML
window.refreshLiveTasksMonitor = () => Dashboard.renderLiveTasksMonitor();
window.refreshMetaAdsPanel = () => Dashboard.renderLiveTasksMonitor();
window.configureCommissionRate = function(currentRate) {
    const input = prompt("Digite a porcentagem da taxa de comissão padrão para as vendas (ex: 5 para 5%):", currentRate || 5);
    if (input !== null) {
        const val = parseFloat(input.replace(",", "."));
        if (!isNaN(val) && val >= 0) {
            localStorage.setItem("comercial_commission_rate", val);
            alert(`✅ Taxa de comissão alterada para ${val}% com sucesso!`);
            Dashboard.renderAll();
        } else {
            alert("⚠️ Por favor insira um número válido.");
        }
    }
};
window.Dashboard = Dashboard;
