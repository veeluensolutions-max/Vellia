import { Store } from "./store.js";
import { Auth } from "./auth.js";

// Metas mensais padrão por vendedor (em localStorage para edição)
const DEFAULT_GOALS = {
    meta_leads: 20,        // leads qualificados no mês
    meta_proposals: 8,     // propostas enviadas no mês
    meta_calls: 60,        // ligações realizadas no mês
    meta_meetings: 10,     // reuniões agendadas
    meta_revenue: 30000    // faturamento mensal (R$)
};

function getGoalsConfig() {
    const stored = localStorage.getItem("comercial_goals_config");
    return stored ? JSON.parse(stored) : DEFAULT_GOALS;
}

function saveGoalsConfig(config) {
    localStorage.setItem("comercial_goals_config", JSON.stringify(config));
}

export const Goals = {
    init() {
        this.renderAll();
        this.bindEvents();
    },

    bindEvents() {
        // Botão de editar metas
        const btnEdit = document.getElementById("btn-edit-goals");
        if (btnEdit) btnEdit.addEventListener("click", () => this.openGoalsModal());

        const btnClose = document.getElementById("btn-close-goals-modal");
        if (btnClose) btnClose.addEventListener("click", () => this.closeGoalsModal());

        const btnCancel = document.getElementById("btn-cancel-goals");
        if (btnCancel) btnCancel.addEventListener("click", () => this.closeGoalsModal());

        const overlay = document.getElementById("goals-modal-overlay");
        if (overlay) overlay.addEventListener("click", () => this.closeGoalsModal());

        const form = document.getElementById("goals-form");
        if (form) form.addEventListener("submit", (e) => { e.preventDefault(); this.saveGoals(); });

        // Filtro de período
        const periodFilter = document.getElementById("goals-period-filter");
        if (periodFilter) periodFilter.addEventListener("change", () => this.renderAll());
    },

    renderAll() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const goals = getGoalsConfig();
        const leads = Store.getLeads();
        const proposals = Store.getProposals();
        const users = Store.getUsers();
        const sellers = users.filter(u => u.role === "seller" || u.role === "manager");

        const period = document.getElementById("goals-period-filter")?.value || "month";
        const { start, end, label } = this.getPeriodRange(period);

        // Filtrar dados por período
        const periodLeads = leads.filter(l => {
            const d = this.getLeadLastActivity(l);
            return d >= start && d <= end;
        });

        const periodProposals = proposals.filter(p => {
            const d = new Date(p.sentAt);
            return d >= start && d <= end;
        });

        // Calcular performance atual do usuário logado
        let myLeads, myProposals;
        if (user.role === "admin") {
            myLeads = periodLeads;
            myProposals = periodProposals;
        } else {
            myLeads = periodLeads.filter(l => l.stageHistory?.some(s => s.userEmail === user.email));
            myProposals = periodProposals.filter(p => p.createdBy === user.email);
        }

        const myRevenue = myProposals.filter(p => p.status === "Ganho").reduce((s, p) => s + (p.value || 0), 0);
        const myWon = myProposals.filter(p => p.status === "Ganho").length;

        // Calcular interações (ligações e reuniões)
        let myInteractions = { Ligação: 0, Reunião: 0 };
        leads.forEach(lead => {
            if (lead.interactions) {
                lead.interactions.forEach(int => {
                    const d = new Date(int.timestamp);
                    if (d >= start && d <= end) {
                        if (int.type === "Ligação") myInteractions.Ligação++;
                        if (int.type === "Reunião") myInteractions.Reunião++;
                    }
                });
            }
        });

        this.setEl("goals-period-label", `Período: ${label}`);

        this.renderPersonalProgress(goals, {
            leads: myLeads.length,
            proposals: myProposals.length,
            calls: myInteractions.Ligação,
            meetings: myInteractions.Reunião,
            revenue: myRevenue,
            won: myWon
        });

        this.renderTeamRanking(sellers, periodProposals, goals);
        this.renderBonusCalculator(goals, myRevenue, myWon, myProposals.length);
        this.renderGoalsOverview(goals, periodProposals, periodLeads);
    },

    getPeriodRange(period) {
        const now = new Date();
        let start, end, label;

        if (period === "month") {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            label = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        } else if (period === "quarter") {
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
            label = `Q${q + 1}/${now.getFullYear()}`;
        } else if (period === "year") {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            label = `Ano ${now.getFullYear()}`;
        } else {
            // Semana atual
            const day = now.getDay();
            start = new Date(now);
            start.setDate(now.getDate() - day);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59);
            label = "Semana Atual";
        }

        return { start, end, label };
    },

    getLeadLastActivity(lead) {
        let lastDate = new Date(lead.stageHistory?.[0]?.timestamp || Date.now());
        if (lead.stageHistory?.length > 0) {
            const sorted = [...lead.stageHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            lastDate = new Date(sorted[0].timestamp);
        }
        return lastDate;
    },

    // ===========================================================================
    // PROGRESSO PESSOAL
    // ===========================================================================
    renderPersonalProgress(goals, actual) {
        const container = document.getElementById("goals-personal-progress");
        if (!container) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        const metrics = [
            {
                key: "revenue",
                label: "Faturamento",
                icon: "💰",
                actual: actual.revenue,
                target: goals.meta_revenue,
                format: fmt,
                color: "#10b981"
            },
            {
                key: "proposals",
                label: "Propostas Enviadas",
                icon: "📝",
                actual: actual.proposals,
                target: goals.meta_proposals,
                format: v => v,
                color: "#6366f1"
            },
            {
                key: "leads",
                label: "Leads Qualificados",
                icon: "👥",
                actual: actual.leads,
                target: goals.meta_leads,
                format: v => v,
                color: "#8b5cf6"
            },
            {
                key: "calls",
                label: "Ligações Realizadas",
                icon: "📞",
                actual: actual.calls,
                target: goals.meta_calls,
                format: v => v,
                color: "#f59e0b"
            },
            {
                key: "meetings",
                label: "Reuniões Realizadas",
                icon: "🤝",
                actual: actual.meetings,
                target: goals.meta_meetings,
                format: v => v,
                color: "#f97316"
            },
            {
                key: "won",
                label: "Vendas Fechadas",
                icon: "✅",
                actual: actual.won,
                target: Math.max(1, Math.round(goals.meta_proposals * 0.3)),
                format: v => v,
                color: "#10b981"
            }
        ];

        container.innerHTML = metrics.map(m => {
            const pct = Math.min(Math.round((m.actual / m.target) * 100), 100);
            const rawPct = Math.round((m.actual / m.target) * 100);
            const status = rawPct >= 100 ? "✅ Meta Atingida!" : rawPct >= 75 ? "🔥 Quase lá!" : rawPct >= 50 ? "📊 Em progresso" : "⚠️ Atenção";
            const barColor = rawPct >= 100 ? "#10b981" : rawPct >= 75 ? "#f59e0b" : rawPct >= 50 ? m.color : "#ef4444";

            return `
                <div class="goal-metric-card">
                    <div class="goal-metric-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 22px;">${m.icon}</span>
                            <div>
                                <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${m.label}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${status}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 800; color: ${barColor};">${rawPct}%</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${m.format(m.actual)} / ${m.format(m.target)}</div>
                        </div>
                    </div>
                    <div class="goal-progress-track">
                        <div class="goal-progress-bar" style="width: ${pct}%; background: ${barColor};"></div>
                    </div>
                </div>
            `;
        }).join("");
    },

    // ===========================================================================
    // RANKING DA EQUIPE
    // ===========================================================================
    renderTeamRanking(sellers, periodProposals, goals) {
        const container = document.getElementById("goals-team-ranking");
        if (!container) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        const ranking = sellers.map(u => {
            const myProps = periodProposals.filter(p => p.createdBy === u.email);
            const won = myProps.filter(p => p.status === "Ganho").length;
            const revenue = myProps.filter(p => p.status === "Ganho").reduce((s, p) => s + (p.value || 0), 0);
            const sent = myProps.length;
            const convRate = sent > 0 ? Math.round((won / sent) * 100) : 0;
            const goalPct = goals.meta_revenue > 0 ? Math.min(Math.round((revenue / goals.meta_revenue) * 100), 100) : 0;
            
            // Contar quantos WhatsApp foram enviados por este vendedor
            const waCount = Store.getLeads().reduce((total, lead) => {
                const myWa = (lead.interactions || []).filter(int => int.type === "WhatsApp" && int.userEmail === u.email).length;
                return total + myWa;
            }, 0);

            const score = revenue + (won * 1000) + (sent * 100) + (waCount * 5);
            return { ...u, won, revenue, sent, convRate, goalPct, score, waCount };
        }).sort((a, b) => b.score - a.score);

        const medals = ["🥇", "🥈", "🥉"];
        const colors = ["#f59e0b", "#94a3b8", "#cd7c2f"];

        if (ranking.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; font-size: 13px; padding: 24px 0;">Nenhum vendedor cadastrado.</p>`;
            return;
        }

        container.innerHTML = ranking.map((r, i) => `
            <div class="ranking-card ${i === 0 ? 'ranking-first' : ''}">
                <div class="ranking-position" style="color: ${colors[i] || 'var(--text-muted)'};">${medals[i] || `#${i + 1}`}</div>
                <div class="user-avatar" style="width: 40px; height: 40px; font-size: 13px; flex-shrink: 0;">${r.name.substring(0, 2).toUpperCase()}</div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${r.name}</div>
                    <div style="display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap;">
                        <span style="font-size: 11px; color: var(--text-muted);">📝 ${r.sent} propostas</span>
                        <span style="font-size: 11px; color: var(--success);">✅ ${r.won} ganhos</span>
                        <span style="font-size: 11px; color: var(--text-muted);">📈 ${r.convRate}% conv.</span>
                        <span style="font-size: 11px; color: #25d366; font-weight: 600;">💬 ${r.waCount || 0} zap</span>
                    </div>
                    <div style="margin-top: 8px;">
                        <div style="height: 5px; background: var(--bg-app); border-radius: 99px; overflow: hidden;">
                            <div style="height: 100%; width: ${r.goalPct}%; background: ${i === 0 ? '#f59e0b' : 'var(--primary)'}; border-radius: 99px; transition: width 0.7s ease;"></div>
                        </div>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">${r.goalPct}% da meta de faturamento</div>
                    </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                    <div style="font-weight: 800; font-size: 15px; color: var(--success);">${fmt(r.revenue)}</div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">receita gerada</div>
                </div>
            </div>
        `).join("");
    },

    // ===========================================================================
    // CALCULADORA DE BONIFICAÇÃO
    // ===========================================================================
    renderBonusCalculator(goals, revenue, won, proposals) {
        const container = document.getElementById("goals-bonus-section");
        if (!container) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        const revPct = goals.meta_revenue > 0 ? revenue / goals.meta_revenue : 0;
        let bonusRate = 0;
        let bonusLabel = "Sem bônus";
        let bonusColor = "var(--text-muted)";
        let bonusIcon = "—";

        if (revPct >= 1.2) {
            bonusRate = 0.12;
            bonusLabel = "Superação Máxima (+120%)";
            bonusColor = "#f59e0b";
            bonusIcon = "🏆";
        } else if (revPct >= 1.0) {
            bonusRate = 0.08;
            bonusLabel = "Meta Atingida (100%)";
            bonusColor = "#10b981";
            bonusIcon = "✅";
        } else if (revPct >= 0.75) {
            bonusRate = 0.04;
            bonusLabel = "Parcial (75–99%)";
            bonusColor = "#6366f1";
            bonusIcon = "📊";
        } else if (revPct >= 0.5) {
            bonusRate = 0.02;
            bonusLabel = "Mínimo (50–74%)";
            bonusColor = "#f97316";
            bonusIcon = "⚠️";
        } else {
            bonusLabel = "Abaixo do mínimo (< 50%)";
            bonusColor = "#ef4444";
            bonusIcon = "❌";
        }

        const bonusValue = revenue * bonusRate;
        const progressPct = Math.min(Math.round(revPct * 100), 150);
        const barWidth = Math.min(progressPct, 100);

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div class="bonus-tier-card" style="--bonus-color: ${bonusColor};">
                    <div style="font-size: 28px; margin-bottom: 8px;">${bonusIcon}</div>
                    <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Nível Atual</div>
                    <div style="font-size: 15px; font-weight: 700; color: ${bonusColor}; margin-top: 4px;">${bonusLabel}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">${fmt(revenue)} de ${fmt(goals.meta_revenue)} faturados</div>
                </div>
                <div class="bonus-tier-card" style="--bonus-color: ${bonusColor};">
                    <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 8px;">Bônus Estimado</div>
                    <div style="font-size: 32px; font-weight: 800; color: ${bonusColor};">${fmt(bonusValue)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">${(bonusRate * 100).toFixed(0)}% sobre a receita gerada</div>
                </div>
            </div>

            <!-- Barra de progresso em direção à meta -->
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Progresso da Meta de Faturamento</span>
                    <span style="font-size: 13px; font-weight: 800; color: ${bonusColor};">${progressPct}%</span>
                </div>
                <div style="height: 14px; background: var(--bg-app); border-radius: 99px; overflow: hidden; position: relative;">
                    <div style="height: 100%; width: ${barWidth}%; background: linear-gradient(90deg, ${bonusColor}88, ${bonusColor}); border-radius: 99px; transition: width 1s ease;"></div>
                    <!-- Marcadores de tier -->
                    <div style="position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: rgba(255,255,255,0.4);"></div>
                    <div style="position: absolute; top: 0; bottom: 0; left: 75%; width: 2px; background: rgba(255,255,255,0.4);"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: var(--text-muted);">
                    <span>0%</span>
                    <span>50% mínimo</span>
                    <span>75% parcial</span>
                    <span>100% meta</span>
                </div>
            </div>

            <!-- Tabela de tiers de bônus -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; background: var(--bg-app); padding: 10px 16px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                    <span>Faixa</span><span>Atingimento</span><span>% Bônus</span><span>Estimativa</span>
                </div>
                ${[
                    ["❌ Sem bônus", "< 50%", "0%", fmt(0), "#94a3b8", revPct < 0.5],
                    ["⚠️ Mínimo", "50 – 74%", "2%", fmt(revenue * 0.02), "#f97316", revPct >= 0.5 && revPct < 0.75],
                    ["📊 Parcial", "75 – 99%", "4%", fmt(revenue * 0.04), "#6366f1", revPct >= 0.75 && revPct < 1.0],
                    ["✅ Meta", "100 – 119%", "8%", fmt(revenue * 0.08), "#10b981", revPct >= 1.0 && revPct < 1.2],
                    ["🏆 Superação", "≥ 120%", "12%", fmt(revenue * 0.12), "#f59e0b", revPct >= 1.2]
                ].map(([tier, range, rate, est, color, active]) => `
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding: 10px 16px; border-top: 1px solid var(--border-color); background: ${active ? `${color}10` : 'transparent'}; font-size: 12px; ${active ? `border-left: 3px solid ${color};` : ''}">
                        <span style="font-weight: ${active ? '700' : '400'}; color: ${active ? color : 'var(--text-secondary)'};">${tier}</span>
                        <span style="color: var(--text-muted);">${range}</span>
                        <span style="font-weight: 600; color: ${active ? color : 'var(--text-muted)'};">${rate}</span>
                        <span style="font-weight: ${active ? '700' : '400'}; color: ${active ? 'var(--success)' : 'var(--text-muted)'};">${est}</span>
                    </div>
                `).join("")}
            </div>
        `;
    },

    // ===========================================================================
    // VISÃO GERAL DO TIME
    // ===========================================================================
    renderGoalsOverview(goals, periodProposals, periodLeads) {
        const container = document.getElementById("goals-overview");
        if (!container) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        const totalRevenue = periodProposals.filter(p => p.status === "Ganho").reduce((s, p) => s + (p.value || 0), 0);
        const totalWon = periodProposals.filter(p => p.status === "Ganho").length;
        const totalLost = periodProposals.filter(p => p.status === "Perdido").length;
        const totalSent = periodProposals.length;
        const avgTicket = totalWon > 0 ? Math.round(totalRevenue / totalWon) : 0;
        const convRate = totalSent > 0 ? Math.round((totalWon / totalSent) * 100) : 0;

        const users = Store.getUsers();
        const numSellers = users.filter(u => u.role === "seller" || u.role === "manager").length || 1;
        const teamRevenueGoal = goals.meta_revenue * numSellers;
        const teamRevPct = teamRevenueGoal > 0 ? Math.min(Math.round((totalRevenue / teamRevenueGoal) * 100), 100) : 0;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px;">
                ${[
                    { label: "Receita do Time", val: fmt(totalRevenue), icon: "💰", color: "var(--success)" },
                    { label: "Propostas Enviadas", val: totalSent, icon: "📝", color: "var(--primary)" },
                    { label: "Vendas Ganhas", val: totalWon, icon: "🤝", color: "var(--success)" },
                    { label: "Perdas", val: totalLost, icon: "❌", color: "var(--danger)" },
                    { label: "Ticket Médio", val: fmt(avgTicket), icon: "🎯", color: "#f97316" },
                    { label: "Conversão do Time", val: `${convRate}%`, icon: "📈", color: convRate >= 30 ? "var(--success)" : "var(--warning)" }
                ].map(k => `
                    <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; text-align: center;">
                        <div style="font-size: 20px; margin-bottom: 6px;">${k.icon}</div>
                        <div style="font-size: 16px; font-weight: 800; color: ${k.color};">${k.val}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${k.label}</div>
                    </div>
                `).join("")}
            </div>

            <!-- Progresso da meta coletiva -->
            <div style="margin-top: 20px; background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">🏁 Meta Coletiva de Faturamento</span>
                    <span style="font-weight: 800; font-size: 14px; color: ${teamRevPct >= 100 ? 'var(--success)' : 'var(--warning)'};">${teamRevPct}%</span>
                </div>
                <div style="height: 10px; background: var(--bg-surface); border-radius: 99px; overflow: hidden;">
                    <div style="height: 100%; width: ${teamRevPct}%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 99px; transition: width 1s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--text-muted);">
                    <span>${fmt(totalRevenue)} arrecadado</span>
                    <span>Meta: ${fmt(teamRevenueGoal)} (${numSellers} vendedor${numSellers !== 1 ? 'es' : ''})</span>
                </div>
            </div>
        `;
    },

    // ===========================================================================
    // MODAL DE CONFIGURAÇÃO DE METAS
    // ===========================================================================
    openGoalsModal() {
        const goals = getGoalsConfig();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        
        // Popular o seletor de vendedores
        const selector = document.getElementById("goal-scope-selector");
        if (selector) {
            selector.innerHTML = `<option value="global">Equipe Geral (Padrão)</option>`;
            const sellers = Store.getUsers().filter(u => u.role === "seller" || u.role === "manager");
            sellers.forEach(s => {
                selector.innerHTML += `<option value="${s.email}">${s.name} (${s.role === "manager" ? "Gerente" : "Vendedor"})</option>`;
            });
            
            // Ouvinte de mudança para carregar metas correspondentes
            selector.onchange = () => {
                const scope = selector.value;
                const activeGoals = getGoalsConfig();
                if (scope === "global") {
                    setVal("goal-revenue", activeGoals.meta_revenue);
                    setVal("goal-proposals", activeGoals.meta_proposals);
                    setVal("goal-leads", activeGoals.meta_leads);
                    setVal("goal-calls", activeGoals.meta_calls);
                    setVal("goal-meetings", activeGoals.meta_meetings);
                } else {
                    setVal("goal-revenue", activeGoals[`meta_revenue_${scope}`] !== undefined ? activeGoals[`meta_revenue_${scope}`] : activeGoals.meta_revenue);
                    setVal("goal-proposals", activeGoals[`meta_proposals_${scope}`] !== undefined ? activeGoals[`meta_proposals_${scope}`] : activeGoals.meta_proposals);
                    setVal("goal-leads", activeGoals[`meta_leads_${scope}`] !== undefined ? activeGoals[`meta_leads_${scope}`] : activeGoals.meta_leads);
                    setVal("goal-calls", activeGoals[`meta_calls_${scope}`] !== undefined ? activeGoals[`meta_calls_${scope}`] : activeGoals.meta_calls);
                    setVal("goal-meetings", activeGoals[`meta_meetings_${scope}`] !== undefined ? activeGoals[`meta_meetings_${scope}`] : activeGoals.meta_meetings);
                }
            };
        }

        // Carregar valores globais inicialmente
        setVal("goal-revenue", goals.meta_revenue);
        setVal("goal-proposals", goals.meta_proposals);
        setVal("goal-leads", goals.meta_leads);
        setVal("goal-calls", goals.meta_calls);
        setVal("goal-meetings", goals.meta_meetings);

        document.getElementById("goals-config-modal")?.classList.add("open");
        document.getElementById("goals-modal-overlay").style.display = "block";
    },

    closeGoalsModal() {
        document.getElementById("goals-config-modal")?.classList.remove("open");
        document.getElementById("goals-modal-overlay").style.display = "none";
    },

    saveGoals() {
        const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
        const selector = document.getElementById("goal-scope-selector");
        const scope = selector ? selector.value : "global";
        
        const config = getGoalsConfig();
        
        if (scope === "global") {
            config.meta_revenue = getVal("goal-revenue");
            config.meta_proposals = getVal("goal-proposals");
            config.meta_leads = getVal("goal-leads");
            config.meta_calls = getVal("goal-calls");
            config.meta_meetings = getVal("goal-meetings");
        } else {
            config[`meta_revenue_${scope}`] = getVal("goal-revenue");
            config[`meta_proposals_${scope}`] = getVal("goal-proposals");
            config[`meta_leads_${scope}`] = getVal("goal-leads");
            config[`meta_calls_${scope}`] = getVal("goal-calls");
            config[`meta_meetings_${scope}`] = getVal("goal-meetings");
        }
        
        saveGoalsConfig(config);
        this.closeGoalsModal();
        this.renderAll();
        
        // Re-renderizar tela de equipe se estiver ativa
        const teamView = document.getElementById("view-team");
        if (teamView && teamView.style.display !== "none") {
            import('./team.js').then(m => m.Team.renderAll());
        }
    },

    setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
};
