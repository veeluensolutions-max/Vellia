import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { PostSales } from "./post-sales.js";

const charts = {};

export const Dashboard = {
    init() {
        this.renderAll();
        this.bindEvents();
        this.setupAdminTaskManager();

        // Atualizar painel Meta Ads automaticamente quando chegar lead novo via webhook
        window.addEventListener("vellia:leadAdded", () => {
            this.renderMetaAdsPanel();
        });

        // Atualização automática em tempo real do ranking e dos KPIs
        const refreshDashboardData = () => {
            const viewDashboard = document.getElementById("view-dashboard");
            if (viewDashboard && viewDashboard.style.display !== "none") {
                const proposals = Store.getProposals();
                const leads = Store.getLeads();
                this.renderVendorRanking(proposals);
                this.renderKPIs(leads, proposals);
                this.renderRecentActivity(leads, proposals);
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
                
                this.renderRecentActivity(currentLeads, currentProposals);
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

        const execDash = document.getElementById("dashboard-exec");
        const opDash = document.getElementById("dashboard-operacional");

        if (user.role && user.role.toLowerCase() === "operacional") {
            if (execDash) execDash.style.display = "none";
            if (opDash) {
                opDash.style.display = "flex";
                this.renderOperacionalDashboard(proposals, leads);
            }
        } else {
            // Admin, Manager or Seller
            if (execDash) execDash.style.display = "flex";
            
            if (user.role && ["admin", "manager", "gerente", "operacional"].includes(user.role.toLowerCase())) {
                if (opDash) {
                    opDash.style.display = "flex";
                    this.renderOperacionalDashboard(proposals, leads);
                }
            } else {
                if (opDash) opDash.style.display = "none";
            }

            this.renderKPIs(leads, proposals);
            this.renderGoalsCommissionPanel();
            this.renderFunnelChart(leads);
            this.renderRevenueChart(proposals);
            this.renderConversionDonut(proposals);
            this.renderSegmentBreakdown(leads);
            this.renderSourcesChart(leads);
            this.renderVendorRanking(proposals);
            this.renderRecentActivity(leads, proposals);
            this.renderTasksWeekChart();
            this.renderMetaAdsPanel();
            this.renderChannelRoiMatrix(leads, proposals);
        }
    },

    // ===========================================================================
    // DASHBOARD OPERACIONAL
    // ===========================================================================
    renderOperacionalDashboard(proposals, leads) {
        const container = document.getElementById("dashboard-operacional");
        if (!container) return;

        const awaiting = proposals.filter(p => p.status === "Aguardando Agendamento" || p.status === "Ganho");
        const scheduled = proposals.filter(p => p.status === "Agendada");

        const renderList = (list, title, color, isAwaiting) => {
            if (list.length === 0) {
                return `
                <div class="card" style="padding: 20px; flex: 1; border-top: 4px solid ${color};">
                    <h4 style="font-weight: 700; margin-bottom: 16px; font-size: 14px; color: var(--text-primary);">
                        ${title} (0)
                    </h4>
                    <p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">
                        Nenhuma proposta encontrada.
                    </p>
                </div>`;
            }

            const items = list.map(p => {
                const lead = leads.find(l => l.id === p.leadId);
                const leadName = lead ? (lead.company || lead.contact) : "Lead Desconhecido";
                
                return `
                <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">
                            ${leadName} - ${p.service}
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted);">
                            Proposta: #${p.id.substring(0,8)} • Vendedor: ${p.authorEmail}
                        </div>
                    </div>
                    <div>
                        ${isAwaiting ? `
                            <button onclick="window.Dashboard.markProposalScheduled('${p.id}')" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 6px 12px;">
                                ✅ Marcar como Agendada
                            </button>
                        ` : `
                            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">🗓️ Agendada</span>
                        `}
                    </div>
                </div>`;
            }).join("");

            return `
            <div class="card" style="padding: 20px; flex: 1; border-top: 4px solid ${color};">
                <h4 style="font-weight: 700; margin-bottom: 16px; font-size: 14px; color: var(--text-primary);">
                    ${title} (${list.length})
                </h4>
                <div style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
                    ${items}
                </div>
            </div>`;
        };

        container.innerHTML = `
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 20px;">
                Painel de Agendamentos (Operacional)
            </h2>
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                ${renderList(awaiting, "⏳ Aguardando Agendamento", "#f59e0b", true)}
                ${renderList(scheduled, "✅ Já Agendadas", "#10b981", false)}
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
    // KPIs GLOBAIS
    // ===========================================================================
    renderKPIs(leads, proposals) {
        const totalLeads = leads.length;
        const activeLeads = leads.filter(l => l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido").length;
        const closedLeads = leads.filter(l => l.stage === "Cliente Fechado").length;
        const totalProposals = proposals.length;
        const wonProposals = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).length;
        const lostProposals = proposals.filter(p => p.status === "Perdido").length;
        const revenue = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status)).reduce((s, p) => s + (p.value || 0), 0);
        const pipeline = proposals.filter(p => p.status === "Enviada" || p.status === "Em Negociação").reduce((s, p) => s + (p.value || 0), 0);
        const convRate = totalProposals > 0 ? Math.round((wonProposals / totalProposals) * 100) : 0;
        const avgTicket = wonProposals > 0 ? Math.round(revenue / wonProposals) : 0;

        // --- Novos KPIs da Fase 7 ---
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
                riskClientsCount++; // "Em Risco" ou "Inativo"
            }
        });
        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        // Helper para gerar Sparkline SVG de alta definição
        const generateSparklineSVG = (points, color = "#6366f1", height = 36, width = 110) => {
            if (!points || points.length < 2) points = [12, 18, 15, 24, 28, 38, 42];
            const min = Math.min(...points);
            const max = Math.max(...points);
            const range = (max - min) || 1;
            const stepX = width / (points.length - 1);
            
            const coords = points.map((p, i) => {
                const x = i * stepX;
                const y = height - ((p - min) / range) * (height - 10) - 5;
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
                <svg class="kpi-sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width: 100%; height: 38px; overflow: visible;">
                    <defs>
                        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="${color}" stop-opacity="0.35" />
                            <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
                        </linearGradient>
                    </defs>
                    <path d="${fillD}" fill="url(#${gradId})" />
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            `;
        };

        const kpis = [
            { 
                id: "kpi-mrr", 
                val: fmt(mrr), 
                label: "Receita Recorrente (MRR)", 
                icon: "🔄", 
                color: "#8b5cf6", 
                trend: "+12.5%", 
                trendPositive: true,
                sparkData: [10, 15, 14, 22, 28, 35, 42],
                large: true, 
                link: "#contracts" 
            },
            { 
                id: "kpi-tcv", 
                val: fmt(tcv), 
                label: "Total em Contratos (TCV)", 
                icon: "📜", 
                color: "#10b981", 
                trend: "+18.4%", 
                trendPositive: true,
                sparkData: [20, 25, 22, 34, 38, 48, 55],
                large: true, 
                link: "#contracts" 
            },
            { 
                id: "kpi-health-active", 
                val: activeClientsCount, 
                label: "Clientes Ativos", 
                icon: "🟢", 
                color: "#10b981", 
                trend: "98% Retenção", 
                trendPositive: true,
                sparkData: [8, 12, 14, 15, 18, 20, 22],
                link: "#post-sales" 
            },
            { 
                id: "kpi-health-risk", 
                val: riskClientsCount, 
                label: "Clientes Em Risco", 
                icon: "🔴", 
                color: "#ef4444", 
                trend: riskClientsCount > 0 ? "Atenção" : "Zero Riscos", 
                trendPositive: riskClientsCount === 0,
                sparkData: [5, 4, 6, 3, 4, 2, Math.max(1, riskClientsCount)],
                link: "#post-sales" 
            },
            { 
                id: "kpi-revenue", 
                val: fmt(revenue), 
                label: "Receita em Propostas", 
                icon: "💰", 
                color: "#10b981", 
                trend: "+15.8%", 
                trendPositive: true,
                sparkData: [15, 24, 20, 35, 40, 48, 60],
                large: true, 
                link: "#performance" 
            },
            { 
                id: "kpi-pipeline", 
                val: fmt(pipeline), 
                label: "Pipeline em Aberto", 
                icon: "📊", 
                color: "#6366f1", 
                trend: "Em Negociação", 
                trendPositive: true,
                sparkData: [30, 28, 35, 42, 38, 45, 52],
                large: true, 
                link: "#kanban" 
            },
            { 
                id: "kpi-avg-ticket", 
                val: fmt(avgTicket), 
                label: "Ticket Médio", 
                icon: "🎯", 
                color: "#f59e0b", 
                trend: "+6.3%", 
                trendPositive: true,
                sparkData: [12, 14, 13, 16, 18, 19, 22],
                large: true, 
                link: "#proposals" 
            },
            { 
                id: "kpi-conv-rate", 
                val: `${convRate}%`, 
                label: "Taxa de Conversão", 
                icon: "📈", 
                color: convRate >= 30 ? "#10b981" : convRate >= 15 ? "#f59e0b" : "#ef4444", 
                trend: convRate >= 20 ? "Alta Performance" : "Dentro da Média", 
                trendPositive: convRate >= 15,
                sparkData: [10, 14, 18, 15, 22, 26, Math.max(10, convRate)],
                link: "#performance" 
            }
        ];

        const container = document.getElementById("dashboard-kpis");
        if (!container) return;

        container.innerHTML = kpis.map(k => `
            <div class="card stat-card dash-kpi-card modern-kpi-card" 
                 style="--kpi-color: ${k.color}; background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); ${k.link ? 'cursor: pointer;' : ''}" 
                 ${k.link ? `onclick="window.location.hash = '${k.link}'"` : ''}>
                <div class="kpi-top-row">
                    <div class="stat-info">
                        <span class="stat-label">${k.label}</span>
                        <span class="stat-value modern-kpi-value" style="font-size: ${k.large ? '20px' : '24px'}; color: var(--text-primary);">${k.val}</span>
                    </div>
                    <div class="dash-kpi-icon modern-kpi-icon" style="background: ${k.color}1a; color: ${k.color}; border: 1px solid ${k.color}33;">
                        <span>${k.icon}</span>
                    </div>
                </div>

                <div class="kpi-bottom-row">
                    <span class="kpi-trend-pill ${k.trendPositive ? 'trend-up' : 'trend-down'}">
                        ${k.trendPositive ? '▲' : '▼'} ${k.trend}
                    </span>
                    <div class="kpi-sparkline-container">
                        ${generateSparklineSVG(k.sparkData, k.color)}
                    </div>
                </div>
            </div>
        `).join("");
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

        if (charts.revenue) {
            charts.revenue.destroy();
        }

        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push({
                label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
                year: d.getFullYear(),
                month: d.getMonth()
            });
        }

        const labels = months.map(m => m.label);
        const data = months.map(m => {
            return proposals
                .filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status) && p.closedAt)
                .filter(p => {
                    const d = new Date(p.closedAt);
                    return d.getMonth() === m.month && d.getFullYear() === m.year;
                })
                .reduce((sum, p) => sum + (p.value || 0), 0);
        });

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradient.addColorStop(0.6, 'rgba(16, 185, 129, 0.08)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

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

        charts.revenue = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Receita Realizada (R$)',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.42,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#10b981',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...glassTooltip,
                        callbacks: {
                            label: function(context) {
                                return " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { family: 'Inter, sans-serif', weight: 600, size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.08)' },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', size: 11 },
                            callback: function(value) {
                                return value >= 1000 ? 'R$ ' + (value/1000) + 'k' : 'R$ ' + value;
                            }
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

        if (charts.conversion) {
            charts.conversion.destroy();
        }

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

        if (charts.segments) {
            charts.segments.destroy();
        }

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

        if (charts.sources) {
            charts.sources.destroy();
        }

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
        if (charts.tasksWeek) charts.tasksWeek.destroy();
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
            if (charts.tasksDonut) charts.tasksDonut.destroy();
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
    // PAINEL META ADS PERFORMANCE
    // ===========================================================================
    renderMetaAdsPanel() {
        const allLeads = Store.getLeads();

        // Todos os leads capturados pelo Meta Ads
        const metaLeads = allLeads.filter(l =>
            l.source === "Meta Ads" || l.source === "Facebook" || l.source === "Instagram"
        );

        const totalLeads = metaLeads.length;
        const converted = metaLeads.filter(l => l.stage === "Cliente Fechado").length;
        const convRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

        // Receita gerada pelos leads Meta que viraram clientes
        const proposals = Store.getProposals();
        const metaRevenue = proposals
            .filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status) && metaLeads.some(l => l.id === p.leadId))
            .reduce((sum, p) => sum + (p.value || 0), 0);

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        // Preencher KPIs
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set("meta-kpi-total-leads", totalLeads);
        set("meta-kpi-converted", converted);
        set("meta-kpi-conv-rate", convRate + "%");
        set("meta-kpi-revenue", fmt(metaRevenue));

        // Timestamp da última atualização
        const lastUpdate = document.getElementById("meta-ads-last-update");
        if (lastUpdate) {
            lastUpdate.textContent = "Atualizado: " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        }

        // Funil de etapas
        const stages = [
            { label: "Leads Captados",    color: "#1877F2" },
            { label: "Lead Gerado",        color: "#6366f1" },
            { label: "Lead Qualificado",   color: "#8b5cf6" },
            { label: "Proposta Enviada",   color: "#f59e0b" },
            { label: "Negociação",         color: "#06b6d4" },
            { label: "Cliente Fechado",    color: "#10b981" },
        ];

        const stageCounts = [
            totalLeads,
            metaLeads.filter(l => l.stage === "Lead Gerado").length,
            metaLeads.filter(l => l.stage === "Lead Qualificado").length,
            metaLeads.filter(l => l.stage === "Proposta Enviada").length,
            metaLeads.filter(l => l.stage === "Negociação").length,
            converted,
        ];

        const funnelContainer = document.getElementById("meta-funnel-bars");
        if (funnelContainer) {
            funnelContainer.innerHTML = "";
            const maxCount = stageCounts[0] || 1;
            stages.forEach((stage, i) => {
                const count = stageCounts[i];
                const pct = Math.round((count / maxCount) * 100);
                const pctOfTotal = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

                const row = document.createElement("div");
                row.style.cssText = "display: flex; align-items: center; gap: 10px;";

                const labelEl = document.createElement("span");
                labelEl.style.cssText = "font-size: 11px; color: var(--text-muted); width: 130px; flex-shrink: 0; font-weight: 600;";
                labelEl.textContent = stage.label;

                const barWrap = document.createElement("div");
                barWrap.style.cssText = "flex: 1; background: var(--bg-app); border-radius: 4px; height: 8px; overflow: hidden;";

                const bar = document.createElement("div");
                bar.style.cssText = `height: 100%; width: 0%; background: ${stage.color}; border-radius: 4px; transition: width 0.9s cubic-bezier(0.4,0,0.2,1);`;
                barWrap.appendChild(bar);

                const countEl = document.createElement("span");
                countEl.style.cssText = "font-size: 11px; font-weight: 800; color: var(--text-primary); min-width: 30px; text-align: right;";
                countEl.textContent = count;

                const pctEl = document.createElement("span");
                pctEl.style.cssText = "font-size: 10px; color: var(--text-muted); min-width: 32px;";
                pctEl.textContent = pctOfTotal + "%";

                row.appendChild(labelEl);
                row.appendChild(barWrap);
                row.appendChild(countEl);
                row.appendChild(pctEl);
                funnelContainer.appendChild(row);

                // Animar barra após render
                setTimeout(() => { bar.style.width = pct + "%"; }, 100 + i * 60);
            });
        }

        // Gráfico doughnut: leads Meta por segmento
        const segMap = {};
        metaLeads.forEach(l => {
            const seg = l.segment || "Outros";
            segMap[seg] = (segMap[seg] || 0) + 1;
        });
        const segLabels = Object.keys(segMap);
        const segData   = Object.values(segMap);

        const canvas = document.getElementById("chart-meta-segments");
        if (canvas) {
            if (charts.metaSegments) charts.metaSegments.destroy();
            if (segLabels.length === 0) {
                canvas.style.display = "none";
                const parent = canvas.parentElement;
                if (parent && !parent.querySelector(".meta-empty-note")) {
                    const note = document.createElement("p");
                    note.className = "meta-empty-note";
                    note.style.cssText = "text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 60px;";
                    note.textContent = "Nenhum lead Meta Ads registrado ainda.";
                    parent.appendChild(note);
                }
            } else {
                canvas.style.display = "block";
                const parent = canvas.parentElement;
                const note = parent ? parent.querySelector(".meta-empty-note") : null;
                if (note) note.remove();

                const palette = ["#1877F2","#6366f1","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4"];
                charts.metaSegments = new Chart(canvas, {
                    type: "doughnut",
                    data: {
                        labels: segLabels,
                        datasets: [{
                            data: segData,
                            backgroundColor: palette.slice(0, segLabels.length),
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "65%",
                        plugins: {
                            legend: {
                                position: "right",
                                labels: {
                                    color: "#64748b",
                                    font: { family: "Inter, sans-serif", size: 10 },
                                    usePointStyle: true,
                                    boxWidth: 8
                                }
                            }
                        }
                    }
                });
            }
        }
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
                                    <div style="width: ${st.pct}%; height: 100%; background: #1877F2; border-radius: 99px;"></div>
                                </div>
                                <span style="font-weight: 700; font-size: 12px;">${st.pct}%</span>
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

                <!-- Tabela da Equipe -->
                <div class="table-responsive" style="margin-bottom: 18px;">
                    <table class="custom-table" style="width: 100%;">
                        <thead>
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
window.refreshMetaAdsPanel = () => Dashboard.renderMetaAdsPanel();
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
