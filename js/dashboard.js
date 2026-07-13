import { Store } from "./store.js";
import { Auth } from "./auth.js";

const charts = {};

export const Dashboard = {
    init() {
        this.renderAll();
        this.bindEvents();
        this.setupAdminTaskManager();
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
            { id: "kpi-closed", val: closedLeads, label: "Clientes Fechados", icon: "🤝", color: "var(--success)", link: "#kanban" },
            { id: "kpi-revenue", val: fmt(revenue), label: "Receita Gerada", icon: "💰", color: "var(--success)", large: true, link: "#performance" },
            { id: "kpi-pipeline", val: fmt(pipeline), label: "Pipeline em Aberto", icon: "📊", color: "var(--primary)", large: true, link: "#kanban" },
            { id: "kpi-avg-ticket", val: fmt(avgTicket), label: "Ticket Médio", icon: "🎯", color: "#f97316", large: true, link: "#proposals" },
            { id: "kpi-conv-rate", val: `${convRate}%`, label: "Taxa de Conversão", icon: "📈", color: convRate >= 30 ? "var(--success)" : convRate >= 15 ? "var(--warning)" : "var(--danger)", link: "#performance" },
            { id: "kpi-total-proposals", val: totalProposals, label: "Total de Propostas", icon: "📝", color: "var(--primary)", link: "#proposals" },
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
            <div onclick="window.location.hash = '#team'" style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 10px; cursor: pointer; transition: all var(--transition-fast);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
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
            if (p.closedAt && p.status === "Ganho") {
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

            const key = `seller_tasks_${email}`;
            const today = new Date().toLocaleDateString("pt-BR");
            const tasks = JSON.parse(localStorage.getItem(key) || "[]").filter(t => t.date === today);

            if (tasks.length === 0) {
                adminTaskList.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">Nenhuma tarefa atribuída hoje para este vendedor.</p>`;
                return;
            }

            const priorityBadge = p => {
                if (p === "high") return `<span style="background: rgba(220,38,38,0.1); color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">ALTA</span>`;
                if (p === "low") return `<span style="background: rgba(22,163,74,0.1); color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">BAIXA</span>`;
                return `<span style="background: rgba(234,179,8,0.1); color: #ca8a04; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">NORMAL</span>`;
            };

            adminTaskList.innerHTML = tasks.map((t, idx) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); ${t.done ? 'opacity: 0.6;' : ''}">
                    <div style="font-size: 13px; color: var(--text-primary);">
                        ${priorityBadge(t.priority)}
                        ${t.assignedBy ? `<span style="font-size: 10px; color: var(--primary); font-weight: 600; border: 1px solid var(--primary); padding: 1px 4px; border-radius: 4px; margin-right: 6px;">GESTOR</span> ` : ''}
                        <span style="${t.done ? 'text-decoration: line-through;' : ''}">${t.text}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: ${t.done ? 'var(--success)' : 'var(--text-muted)'}">${t.done ? 'Concluída ✅' : 'Pendente ⏳'}</span>
                        <button class="delete-task-btn" data-email="${email}" data-idx="${idx}" style="background: none; border: none; cursor: pointer; color: #dc2626; padding: 4px; display: flex; align-items: center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                    </div>
                </div>
            `).join("");

            // Evento excluir
            adminTaskList.querySelectorAll(".delete-task-btn").forEach(btn => {
                btn.onclick = () => {
                    const mail = btn.getAttribute("data-email");
                    const index = parseInt(btn.getAttribute("data-idx"));
                    const k = `seller_tasks_${mail}`;
                    const list = JSON.parse(localStorage.getItem(k) || "[]").filter(t => t.date === today);
                    list.splice(index, 1);
                    localStorage.setItem(k, JSON.stringify(list));
                    renderAssignedTasks();
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

            const key = `seller_tasks_${targetSeller}`;
            const today = new Date().toLocaleDateString("pt-BR");
            const tasks = JSON.parse(localStorage.getItem(key) || "[]").filter(t => t.date === today);
            
            tasks.push({
                text,
                done: false,
                date: today,
                priority,
                assignedBy: Auth.getCurrentUser()?.email || "gestao@vellia.com"
            });

            localStorage.setItem(key, JSON.stringify(tasks));
            inputTask.value = "";
            
            // Forçar visualização a selecionar o vendedor a quem foi atribuído
            viewSeller.value = targetSeller;
            renderAssignedTasks();

        };
    }
};
