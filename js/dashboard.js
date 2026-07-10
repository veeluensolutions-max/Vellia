import { Store } from "./store.js";
import { Auth } from "./auth.js";

const charts = {};

export const Dashboard = {
    init() {
        this.renderAll();
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

        this.renderKPIs(leads, proposals);
        this.renderFunnelChart(leads);
        this.renderRevenueChart(proposals);
        this.renderConversionDonut(proposals);
        this.renderSegmentBreakdown(leads);
        this.renderVendorRanking(proposals);
        this.renderRecentActivity(leads, proposals);
    },

    // ===========================================================================
    // KPIs GLOBAIS
    // ===========================================================================
    renderKPIs(leads, proposals) {
        const totalLeads = leads.length;
        const activeLeads = leads.filter(l => l.stage !== "Cliente Fechado" && l.stage !== "Cliente Perdido").length;
        const closedLeads = leads.filter(l => l.stage === "Cliente Fechado").length;
        const totalProposals = proposals.length;
        const wonProposals = proposals.filter(p => p.status === "Ganho").length;
        const lostProposals = proposals.filter(p => p.status === "Perdido").length;
        const revenue = proposals.filter(p => p.status === "Ganho").reduce((s, p) => s + (p.value || 0), 0);
        const pipeline = proposals.filter(p => p.status === "Enviada" || p.status === "Em Negociação").reduce((s, p) => s + (p.value || 0), 0);
        const convRate = totalProposals > 0 ? Math.round((wonProposals / totalProposals) * 100) : 0;
        const avgTicket = wonProposals > 0 ? Math.round(revenue / wonProposals) : 0;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        const kpis = [
            { id: "kpi-total-leads", val: totalLeads, label: "Leads Cadastrados", icon: "👥", color: "var(--primary)", link: "#crm" },
            { id: "kpi-active-leads", val: activeLeads, label: "Leads Ativos", icon: "🔥", color: "#8b5cf6", link: "#crm" },
            { id: "kpi-closed", val: closedLeads, label: "Clientes Fechados", icon: "🤝", color: "var(--success)" },
            { id: "kpi-revenue", val: fmt(revenue), label: "Receita Gerada", icon: "💰", color: "var(--success)", large: true },
            { id: "kpi-pipeline", val: fmt(pipeline), label: "Pipeline em Aberto", icon: "📊", color: "var(--primary)", large: true },
            { id: "kpi-avg-ticket", val: fmt(avgTicket), label: "Ticket Médio", icon: "🎯", color: "#f97316", large: true },
            { id: "kpi-conv-rate", val: `${convRate}%`, label: "Taxa de Conversão", icon: "📈", color: convRate >= 30 ? "var(--success)" : convRate >= 15 ? "var(--warning)" : "var(--danger)" },
            { id: "kpi-total-proposals", val: totalProposals, label: "Total de Propostas", icon: "📝", color: "var(--primary)" },
        ];

        const container = document.getElementById("dashboard-kpis");
        if (!container) return;

        container.innerHTML = kpis.map(k => `
            <div class="card stat-card dash-kpi-card" style="--kpi-color: ${k.color}; ${k.link ? 'cursor: pointer; transition: transform 0.2s;' : ''}" ${k.link ? `onclick="window.location.hash = '${k.link}'"` : ''} ${k.link ? 'onmouseover="this.style.transform=&apos;translateY(-3px)&apos;"' : ''} ${k.link ? 'onmouseout="this.style.transform=&apos;none&apos;"' : ''}>
                <div class="stat-info">
                    <span class="stat-label">${k.label}</span>
                    <span class="stat-value" style="font-size: ${k.large ? '18px' : '26px'}; color: ${k.color};">${k.val}</span>
                </div>
                <div class="dash-kpi-icon" style="background: ${k.color}22; color: ${k.color};">
                    <span style="font-size: 20px;">${k.icon}</span>
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
        const canvas = document.getElementById("chart-funnel");
        if (!canvas) return;

        if (charts.funnel) {
            charts.funnel.destroy();
        }

        const stages = [
            { label: "Contato", color: "#94a3b8" },
            { label: "Lead Gerado", color: "#6366f1" },
            { label: "Lead Qualificado", color: "#8b5cf6" },
            { label: "Proposta Enviada", color: "#f59e0b" },
            { label: "Negociação", color: "#f97316" },
            { label: "Cliente Fechado", color: "#10b981" },
            { label: "Cliente Perdido", color: "#ef4444" }
        ];

        const labels = stages.map(s => s.label);
        const data = stages.map(s => leads.filter(l => l.stage === s.label).length);
        const bgColors = stages.map(s => s.color);

        charts.funnel = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Leads',
                    data: data,
                    backgroundColor: bgColors,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false, grid: { display: false } },
                    y: { 
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', weight: 500, size: 12 }
                        }
                    }
                }
            }
        });
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
                .filter(p => p.status === "Ganho" && p.closedAt)
                .filter(p => {
                    const d = new Date(p.closedAt);
                    return d.getMonth() === m.month && d.getFullYear() === m.year;
                })
                .reduce((sum, p) => sum + (p.value || 0), 0);
        });

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        charts.revenue = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Receita (R$)',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { family: 'Inter, sans-serif', weight: 500 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif' },
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
        const won = proposals.filter(p => p.status === "Ganho").length;
        const lost = proposals.filter(p => p.status === "Perdido").length;
        const pending = total - won - lost;

        if (total === 0) {
            // Render an empty gray donut or text if preferred, but for now just empty chart
        }

        charts.conversion = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Ganhos', 'Perdidos', 'Em Aberto'],
                datasets: [{
                    data: [won, lost, pending],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', weight: 500 },
                            usePointStyle: true,
                            padding: 20
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
                    ctx.fillStyle = "#1e293b";
            
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
            'rgba(99, 102, 241, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(239, 68, 68, 0.8)'
        ];

        charts.segments = new Chart(canvas, {
            type: 'polarArea',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#64748b',
                            font: { family: 'Inter, sans-serif', size: 11 },
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    r: {
                        ticks: { display: false },
                        grid: { color: 'rgba(0,0,0,0.05)' }
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

        const ranking = sellers.map(u => {
            const myProps = proposals.filter(p => p.createdBy === u.email);
            const won = myProps.filter(p => p.status === "Ganho").length;
            const revenue = myProps.filter(p => p.status === "Ganho").reduce((s, p) => s + (p.value || 0), 0);
            const convRate = myProps.length > 0 ? Math.round((won / myProps.length) * 100) : 0;
            return { ...u, totalProposals: myProps.length, won, revenue, convRate };
        }).sort((a, b) => b.revenue - a.revenue);

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const medals = ["🥇", "🥈", "🥉"];

        if (ranking.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Nenhum vendedor cadastrado.</p>`;
            return;
        }

        container.innerHTML = ranking.map((r, i) => `
            <div style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 10px; transition: all var(--transition-fast);">
                <div style="font-size: 22px; width: 32px; text-align: center; flex-shrink: 0;">${medals[i] || `#${i + 1}`}</div>
                <div class="user-avatar" style="width: 38px; height: 38px; font-size: 13px; flex-shrink: 0;">${r.avatar || r.name.substring(0, 2).toUpperCase()}</div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${r.totalProposals} proposta${r.totalProposals !== 1 ? 's' : ''} · ${r.won} ganhos · ${r.convRate}% conv.</div>
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
                    icon: "🔄",
                    text: `<strong>${lead.company}</strong> movido para <strong>${lead.stage}</strong>`,
                    sub: last.userEmail,
                    color: "var(--primary)"
                });
            }
        });

        // Propostas criadas/fechadas
        proposals.forEach(p => {
            events.push({
                timestamp: new Date(p.createdAt),
                icon: "📝",
                text: `Proposta enviada para <strong>${p.company}</strong>`,
                sub: `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.value)}`,
                color: "var(--primary)"
            });
            if (p.closedAt && p.status === "Ganho") {
                events.push({
                    timestamp: new Date(p.closedAt),
                    icon: "✅",
                    text: `Venda fechada com <strong>${p.company}</strong>`,
                    sub: `+${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.value)}`,
                    color: "var(--success)"
                });
            }
            if (p.closedAt && p.status === "Perdido") {
                events.push({
                    timestamp: new Date(p.closedAt),
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
            <div style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="font-size: 18px; flex-shrink: 0; margin-top: 1px;">${ev.icon}</div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4;">${ev.text}</div>
                    <div style="font-size: 11px; color: ${ev.color}; font-weight: 600; margin-top: 2px;">${ev.sub}</div>
                </div>
                <div style="font-size: 10px; color: var(--text-muted); flex-shrink: 0; text-align: right; margin-top: 2px;">${fmtDate(ev.timestamp)}</div>
            </div>
        `).join("");
    }
};
