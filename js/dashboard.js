import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const Dashboard = {
    init() {
        this.renderAll();
    },

    renderAll() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const leads = Store.getLeads();
        const proposals = Store.getProposals();

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
            { id: "kpi-total-leads", val: totalLeads, label: "Leads Cadastrados", icon: "👥", color: "var(--primary)" },
            { id: "kpi-active-leads", val: activeLeads, label: "Leads Ativos", icon: "🔥", color: "#8b5cf6" },
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
            <div class="card stat-card dash-kpi-card" style="--kpi-color: ${k.color};">
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
    renderFunnelChart(leads) {
        const container = document.getElementById("chart-funnel");
        if (!container) return;

        const stages = [
            { label: "Contato", color: "#94a3b8" },
            { label: "Lead Gerado", color: "#6366f1" },
            { label: "Lead Qualificado", color: "#8b5cf6" },
            { label: "Proposta Enviada", color: "#f59e0b" },
            { label: "Negociação", color: "#f97316" },
            { label: "Cliente Fechado", color: "#10b981" },
            { label: "Cliente Perdido", color: "#ef4444" }
        ];

        const counts = stages.map(s => ({
            ...s,
            count: leads.filter(l => l.stage === s.label).length
        }));

        const max = Math.max(...counts.map(c => c.count), 1);

        container.innerHTML = counts.map(item => {
            const pct = Math.round((item.count / max) * 100);
            return `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                    <div style="width: 130px; font-size: 12px; font-weight: 500; color: var(--text-secondary); text-align: right; flex-shrink: 0;">${item.label}</div>
                    <div style="flex-grow: 1; height: 28px; background: var(--bg-app); border-radius: 6px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${pct}%; background: ${item.color}; border-radius: 6px; transition: width 0.7s cubic-bezier(0.4,0,0.2,1); display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; min-width: ${item.count > 0 ? '28px' : '0'};">
                            ${item.count > 0 ? `<span style="font-size: 11px; font-weight: 700; color: #fff;">${item.count}</span>` : ''}
                        </div>
                        ${item.count === 0 ? '<span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-muted); font-weight: 500;">0</span>' : ''}
                    </div>
                </div>
            `;
        }).join("");
    },

    // ===========================================================================
    // GRÁFICO DE RECEITA MENSAL (BARRAS VERTICAIS SVG)
    // ===========================================================================
    renderRevenueChart(proposals) {
        const container = document.getElementById("chart-revenue");
        if (!container) return;

        // Últimos 6 meses
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push({
                label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
                year: d.getFullYear(),
                month: d.getMonth()
            });
        }

        const monthlyRevenue = months.map(m => {
            const total = proposals
                .filter(p => p.status === "Ganho" && p.closedAt)
                .filter(p => {
                    const d = new Date(p.closedAt);
                    return d.getMonth() === m.month && d.getFullYear() === m.year;
                })
                .reduce((sum, p) => sum + (p.value || 0), 0);
            return { ...m, total };
        });

        const maxVal = Math.max(...monthlyRevenue.map(m => m.total), 1);
        const chartH = 160;
        const fmt = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`;

        container.innerHTML = `
            <div style="display: flex; align-items: flex-end; gap: 12px; height: ${chartH}px; padding: 0 8px;">
                ${monthlyRevenue.map(m => {
                    const barH = Math.max((m.total / maxVal) * (chartH - 30), m.total > 0 ? 8 : 4);
                    const opacity = m.total > 0 ? 1 : 0.3;
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end;">
                            ${m.total > 0 ? `<div style="font-size: 10px; font-weight: 700; color: var(--success);">${fmt(m.total)}</div>` : ''}
                            <div style="width: 100%; height: ${barH}px; background: linear-gradient(180deg, #10b981, #059669); border-radius: 6px 6px 0 0; opacity: ${opacity}; transition: height 0.7s ease;"></div>
                            <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${m.label}</div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    },

    // ===========================================================================
    // DONUT DE CONVERSÃO (SVG)
    // ===========================================================================
    renderConversionDonut(proposals) {
        const container = document.getElementById("chart-conversion");
        if (!container) return;

        const total = proposals.length;
        const won = proposals.filter(p => p.status === "Ganho").length;
        const lost = proposals.filter(p => p.status === "Perdido").length;
        const pending = total - won - lost;
        const convRate = total > 0 ? Math.round((won / total) * 100) : 0;

        if (total === 0) {
            container.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 40px 0; font-size: 13px;">Sem propostas ainda.</p>`;
            return;
        }

        // SVG Donut
        const r = 60, cx = 80, cy = 80;
        const circumference = 2 * Math.PI * r;
        const wonPct = (won / total);
        const lostPct = (lost / total);
        const pendingPct = (pending / total);

        const wonDash = wonPct * circumference;
        const lostDash = lostPct * circumference;
        const pendingDash = pendingPct * circumference;

        const wonOffset = 0;
        const lostOffset = -wonDash;
        const pendingOffset = -(wonDash + lostDash);

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div style="position: relative; width: 160px; height: 160px; flex-shrink: 0;">
                    <svg width="160" height="160" viewBox="0 0 160 160">
                        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-app)" stroke-width="18"/>
                        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#10b981" stroke-width="18"
                            stroke-dasharray="${wonDash} ${circumference - wonDash}"
                            stroke-dashoffset="${wonOffset}"
                            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
                        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ef4444" stroke-width="18"
                            stroke-dasharray="${lostDash} ${circumference - lostDash}"
                            stroke-dashoffset="${lostOffset}"
                            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
                        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f59e0b" stroke-width="18"
                            stroke-dasharray="${pendingDash} ${circumference - pendingDash}"
                            stroke-dashoffset="${pendingOffset}"
                            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
                        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-primary)" font-size="22" font-weight="800">${convRate}%</text>
                        <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="var(--text-muted)" font-size="10">conversão</text>
                    </svg>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px; flex-grow: 1;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981; flex-shrink: 0;"></div>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Ganhos</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${won} proposta${won !== 1 ? 's' : ''} · ${Math.round(wonPct * 100)}%</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #ef4444; flex-shrink: 0;"></div>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Perdidos</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${lost} proposta${lost !== 1 ? 's' : ''} · ${Math.round(lostPct * 100)}%</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #f59e0b; flex-shrink: 0;"></div>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Em Aberto</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${pending} proposta${pending !== 1 ? 's' : ''} · ${Math.round(pendingPct * 100)}%</div>
                        </div>
                    </div>
                    <div style="padding-top: 8px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--text-muted);">
                        Total: <strong style="color: var(--text-primary);">${total} propostas</strong>
                    </div>
                </div>
            </div>
        `;
    },

    // ===========================================================================
    // LEADS POR SEGMENTO (BARRAS HORIZONTAIS)
    // ===========================================================================
    renderSegmentBreakdown(leads) {
        const container = document.getElementById("chart-segments");
        if (!container) return;

        const segMap = {};
        leads.forEach(l => {
            if (!segMap[l.segment]) segMap[l.segment] = 0;
            segMap[l.segment]++;
        });

        const sorted = Object.entries(segMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const max = Math.max(...sorted.map(s => s[1]), 1);

        const colors = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#f97316", "#ef4444"];

        if (sorted.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Nenhum lead cadastrado.</p>`;
            return;
        }

        container.innerHTML = sorted.map(([seg, count], i) => {
            const pct = Math.round((count / max) * 100);
            const color = colors[i % colors.length];
            return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${seg}</span>
                        <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${count} lead${count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style="height: 8px; background: var(--bg-app); border-radius: 99px; overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 99px; transition: width 0.7s ease;"></div>
                    </div>
                </div>
            `;
        }).join("");
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
