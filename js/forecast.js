import { Store } from "./store.js";

// Pesos de probabilidade por estágio do pipeline
const STAGE_PROBABILITY = {
    "Lead Gerado":      5,
    "Contato":         15,
    "Qualificação":    30,
    "Proposta Enviada":50,
    "Negociação":      70,
    "Fechamento":      90,
    "Cliente Ativo":  100,
    "Perdido":          0
};

export const Forecast = {
    init() {
        this.renderAll();
        this.bindEvents();
    },

    bindEvents() {
        const scenarioFilter = document.getElementById("forecast-scenario-filter");
        if (scenarioFilter) scenarioFilter.addEventListener("change", () => this.renderAll());

        const simProb = document.getElementById("slider-sim-prob");
        const simGrowth = document.getElementById("slider-sim-growth");
        const simMult = document.getElementById("slider-sim-mult");

        const updateLabels = () => {
            if (simProb) document.getElementById("val-sim-prob").textContent = `${simProb.value}%`;
            if (simGrowth) document.getElementById("val-sim-growth").textContent = `${simGrowth.value}%`;
            if (simMult) document.getElementById("val-sim-mult").textContent = `${parseFloat(simMult.value).toFixed(1)}x`;
        };

        [simProb, simGrowth, simMult].forEach(slider => {
            if (slider) {
                slider.addEventListener("input", () => {
                    updateLabels();
                    this.renderAll();
                });
            }
        });
    },

    renderAll() {
        const proposals = Store.getProposals();
        const leads = Store.getLeads();
        const scenario = document.getElementById("forecast-scenario-filter")?.value || "realistic";

        const simProbVal = document.getElementById("slider-sim-prob") 
            ? parseFloat(document.getElementById("slider-sim-prob").value) / 100 
            : 0.50; // Probabilidade de conversão simulada

        const simGrowthVal = document.getElementById("slider-sim-growth")
            ? 1 + (parseFloat(document.getElementById("slider-sim-growth").value) / 100)
            : 1.08; // Crescimento mensal base simulado

        const simMultVal = document.getElementById("slider-sim-mult")
            ? parseFloat(document.getElementById("slider-sim-mult").value)
            : 1.0; // Multiplicador de volume simulado

        // Multiplicadores por cenário
        const multipliers = { pessimistic: 0.65, realistic: 1.0, optimistic: 1.35 };
        const mult = (multipliers[scenario] || 1.0) * simMultVal;
        const scenarioLabels = { pessimistic: "Pessimista 🔻", realistic: "Realista ⚖️", optimistic: "Otimista 🚀" };
        this.setEl("forecast-scenario-label", scenarioLabels[scenario]);

        // === PIPELINED REVENUE (propostas abertas + leads ponderados) ===
        const openProposals = proposals.filter(p => p.status === "Enviada" || p.status === "Em Negociação");
        const wonThisMonth = proposals.filter(p => {
            if (p.status !== "Ganho") return false;
            const d = new Date(p.closedAt || p.sentAt);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const wonLastMonth = proposals.filter(p => {
            if (p.status !== "Ganho") return false;
            const d = new Date(p.closedAt || p.sentAt);
            const now = new Date();
            const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
        });

        const revenueThisMonth = wonThisMonth.reduce((s, p) => s + (p.value || 0), 0);
        const revenueLastMonth = wonLastMonth.reduce((s, p) => s + (p.value || 0), 0);

        // Weighted pipeline
        const weightedPipeline = openProposals.reduce((s, p) => s + (p.value || 0) * simProbVal, 0); // Probabilidade simulada pelo slider
        const weightedLeads = leads
            .filter(l => !["Perdido", "Cliente Ativo"].includes(l.stage))
            .reduce((s, l) => {
                const prob = (STAGE_PROBABILITY[l.stage] || 10) / 100;
                // Estimar valor médio de proposta com base nas propostas existentes
                const avgValue = proposals.length > 0
                    ? proposals.filter(p => p.status === "Ganho").reduce((a,p) => a + p.value, 0) / Math.max(proposals.filter(p => p.status === "Ganho").length, 1)
                    : 5000;
                return s + (avgValue * prob * 0.4); // 40% de chance de gerar proposta
            }, 0);

        const pipelineForecast = Math.round((weightedPipeline + weightedLeads) * mult);

        // Crescimento MoM
        const growthPct = revenueLastMonth > 0 
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100).toFixed(1) 
            : (revenueThisMonth > 0 ? 100 : 0);

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

        // KPIs
        this.setEl("fc-kpi-pipeline", fmt(pipelineForecast));
        this.setEl("fc-kpi-current", fmt(revenueThisMonth));
        this.setEl("fc-kpi-lastmonth", fmt(revenueLastMonth));
        this.setEl("fc-kpi-growth", `${growthPct > 0 ? "+" : ""}${growthPct}%`);
        const growthEl = document.getElementById("fc-kpi-growth");
        if (growthEl) growthEl.style.color = parseFloat(growthPct) >= 0 ? "var(--success)" : "var(--danger)";

        // === PROJEÇÃO DOS PRÓXIMOS 3 MESES ===
        this.renderProjection(revenueThisMonth, pipelineForecast, mult, simGrowthVal);

        // === PIPELINE PONDERADO POR PROPOSTA ===
        this.renderPipelineBreakdown(openProposals, mult);

        // === SAÚDE COMERCIAL ===
        this.renderHealthScore(proposals, leads);

        // === ALERTAS INTELIGENTES ===
        this.renderAlerts(proposals, leads);
    },

    // ===========================================================================
    // PROJEÇÃO GRÁFICA — 3 MESES
    // ===========================================================================
    renderProjection(currentRevenue, pipeline, mult, simGrowthVal) {
        const container = document.getElementById("fc-projection-chart");
        if (!container) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
        const now = new Date();
        const months = [];

        // Últimos 2 meses (histórico)
        for (let i = 2; i >= 1; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ label: d.toLocaleDateString("pt-BR", { month: "short" }), value: 0, type: "history" });
        }

        // Mês atual (real)
        months.push({ label: now.toLocaleDateString("pt-BR", { month: "short" }) + " (atual)", value: currentRevenue, type: "current" });

        // Próximos 3 meses (forecast)
        const baseGrowth = simGrowthVal || 1.08; // Crescimento esperado ao mês simulado
        let forecastBase = Math.max(currentRevenue, pipeline * 0.4);
        for (let i = 1; i <= 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            forecastBase = forecastBase * baseGrowth * mult;
            months.push({ label: d.toLocaleDateString("pt-BR", { month: "short" }), value: Math.round(forecastBase), type: "forecast" });
        }

        // Preencher meses históricos com dados reais
        const proposals = Store.getProposals();
        months.forEach((m, i) => {
            if (m.type === "history") {
                const mIndex = now.getMonth() - (2 - i);
                const yr = mIndex < 0 ? now.getFullYear() - 1 : now.getFullYear();
                const mN = ((mIndex % 12) + 12) % 12;
                const rev = proposals.filter(p => {
                    if (p.status !== "Ganho") return false;
                    const d = new Date(p.closedAt || p.sentAt);
                    return d.getMonth() === mN && d.getFullYear() === yr;
                }).reduce((s, p) => s + (p.value || 0), 0);
                m.value = rev;
            }
        });

        const maxVal = Math.max(...months.map(m => m.value), 1);

        container.innerHTML = `
            <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 200px; gap: 10px;">
                ${months.map((m, i) => {
                    const barH = Math.max((m.value / maxVal) * 100, 2);
                    const color = m.type === "forecast" ? "rgba(99,102,241,0.7)" : m.type === "current" ? "#6366f1" : "#94a3b8";
                    const border = m.type === "forecast" ? "2px dashed #6366f1" : "none";
                    return `
                        <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%;">
                            <div style="font-size: 10px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; text-align: center;">${fmt(m.value)}</div>
                            <div style="flex: 1; display: flex; align-items: flex-end; width: 100%;">
                                <div style="width: 100%; height: ${barH}%; background: ${color}; border-radius: 4px 4px 0 0; border: ${border}; transition: height 0.8s ease; position: relative;">
                                    ${m.type === "forecast" ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:9px;color:#6366f1;font-weight:700;">PROJ.</div>' : ""}
                                </div>
                            </div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 8px; text-align: center; white-space: nowrap;">${m.label}</div>
                        </div>
                    `;
                }).join("")}
            </div>
            <div style="display: flex; gap: 16px; justify-content: center; margin-top: 16px; font-size: 11px; color: var(--text-muted);">
                <span>⬛ Histórico</span><span style="color: #6366f1;">■ Atual</span><span style="color: rgba(99,102,241,0.6);">▦ Projetado</span>
            </div>
        `;
    },

    // ===========================================================================
    // BREAKDOWN DO PIPELINE
    // ===========================================================================
    renderPipelineBreakdown(openProposals, mult) {
        const container = document.getElementById("fc-pipeline-breakdown");
        if (!container) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

        if (openProposals.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 24px 0;">Nenhuma proposta aberta no pipeline.</p>`;
            return;
        }

        const sorted = [...openProposals].sort((a, b) => (b.value || 0) - (a.value || 0));

        container.innerHTML = sorted.map(p => {
            const prob = p.status === "Em Negociação" ? 70 : 50;
            const adj = Math.round((p.value || 0) * (prob / 100) * mult);
            const barW = Math.min(prob, 100);
            const daysOpen = Math.round((Date.now() - new Date(p.sentAt).getTime()) / (1000 * 60 * 60 * 24));
            const urgency = daysOpen > 30 ? "⚠️" : daysOpen > 15 ? "🟡" : "🟢";

            return `
                <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${urgency} ${p.company}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${p.title?.substring(0, 55)}${p.title?.length > 55 ? "..." : ""}</div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0; margin-left: 12px;">
                            <div style="font-size: 14px; font-weight: 800; color: var(--primary);">${fmt(adj)}</div>
                            <div style="font-size: 10px; color: var(--text-muted);">${prob}% prob. → ajustado</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="flex: 1; height: 6px; background: var(--bg-surface); border-radius: 99px; overflow: hidden;">
                            <div style="height: 100%; width: ${barW}%; background: var(--primary); border-radius: 99px;"></div>
                        </div>
                        <span style="font-size: 11px; color: var(--text-muted);">${daysOpen}d aberta</span>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">${fmt(p.value || 0)} bruto</span>
                    </div>
                </div>
            `;
        }).join("");
    },

    // ===========================================================================
    // SAÚDE COMERCIAL (Health Score)
    // ===========================================================================
    renderHealthScore(proposals, leads) {
        const container = document.getElementById("fc-health-score");
        if (!container) return;

        const total = proposals.length;
        const won = proposals.filter(p => p.status === "Ganho").length;
        const lost = proposals.filter(p => p.status === "Perdido").length;
        const open = proposals.filter(p => !["Ganho", "Perdido"].includes(p.status)).length;
        const convRate = total > 0 ? (won / total) : 0;

        const activeLeads = leads.filter(l => !["Perdido"].includes(l.stage)).length;
        const coldLeads = leads.filter(l => {
            const hist = l.stageHistory || [];
            if (!hist.length) return false;
            const last = new Date(hist[hist.length - 1].timestamp);
            return (Date.now() - last.getTime()) > 1000 * 60 * 60 * 24 * 14; // 14 dias
        }).length;
        const coldRate = activeLeads > 0 ? coldLeads / activeLeads : 0;

        // Score 0-100
        let score = 0;
        score += Math.min(convRate * 150, 40); // Conversão (peso 40)
        score += Math.min(open * 2, 30);       // Pipeline ativo (peso 30)
        score += Math.max(30 - coldRate * 60, 0); // Leads quentes (peso 30)
        score = Math.round(Math.min(score, 100));

        let scoreColor = "#ef4444";
        let scoreLabel = "Crítico";
        let scoreIcon = "🔴";
        if (score >= 80) { scoreColor = "#10b981"; scoreLabel = "Excelente"; scoreIcon = "🟢"; }
        else if (score >= 60) { scoreColor = "#f59e0b"; scoreLabel = "Bom"; scoreIcon = "🟡"; }
        else if (score >= 40) { scoreColor = "#f97316"; scoreLabel = "Regular"; scoreIcon = "🟠"; }

        // Gauge usando Chart.js
        const ctx = document.getElementById("chart-health-score")?.getContext("2d");
        if (ctx) {
            if (window.healthScoreChart) window.healthScoreChart.destroy();
            window.healthScoreChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [score, 100 - score],
                        backgroundColor: [scoreColor, 'var(--bg-surface)'],
                        borderWidth: 0,
                        circumference: 180,
                        rotation: 270
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: { tooltip: { enabled: false }, legend: { display: false } }
                }
            });
        }

        const scoreVal = document.getElementById("health-score-value");
        if(scoreVal) { scoreVal.textContent = score; scoreVal.style.color = scoreColor; }

        const scoreLbl = document.getElementById("health-score-label");
        if(scoreLbl) { scoreLbl.textContent = `${scoreIcon} ${scoreLabel}`; scoreLbl.style.color = scoreColor; }

        const metricsContainer = document.getElementById("health-score-metrics");
        if(metricsContainer) {
            metricsContainer.innerHTML = [
                { label: "Taxa de Conversão", val: `${(convRate * 100).toFixed(1)}%`, color: convRate >= 0.3 ? "var(--success)" : "var(--danger)" },
                { label: "Pipeline Ativo", val: `${open} propostas`, color: open > 0 ? "var(--primary)" : "var(--text-muted)" },
                { label: "Leads Quentes", val: `${activeLeads - coldLeads}`, color: "var(--success)" },
                { label: "Oportunidades Perdidas", val: `${lost}`, color: "var(--danger)" }
            ].map(m => `
                <div style="background: var(--bg-surface); padding: 10px; border-radius: var(--radius-sm);">
                    <div style="font-size: 10px; text-transform: uppercase;">${m.label}</div>
                    <div style="font-size: 14px; font-weight: 700; color: ${m.color}; mt-2">${m.val}</div>
                </div>
            `).join("");
        }
    },

    // ===========================================================================
    // ALERTAS INTELIGENTES
    // ===========================================================================
    renderAlerts(proposals, leads) {
        const container = document.getElementById("fc-alerts");
        if (!container) return;

        const alerts = [];
        const now = Date.now();

        // Propostas próximas do vencimento (< 7 dias)
        proposals.filter(p => p.status === "Enviada" && p.validUntil).forEach(p => {
            const daysLeft = Math.round((new Date(p.validUntil).getTime() - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7 && daysLeft >= 0) {
                alerts.push({ type: "warning", icon: "⏰", msg: `Proposta para <strong>${p.company}</strong> vence em <strong>${daysLeft} dia(s)</strong> — entre em contato!` });
            } else if (daysLeft < 0) {
                alerts.push({ type: "danger", icon: "❌", msg: `Proposta para <strong>${p.company}</strong> venceu há <strong>${Math.abs(daysLeft)} dias</strong> — renove ou arquive.` });
            }
        });

        // Leads sem contato há +14 dias
        leads.filter(l => !["Perdido", "Cliente Ativo"].includes(l.stage)).forEach(l => {
            const hist = l.stageHistory || [];
            if (!hist.length) return;
            const last = new Date(hist[hist.length - 1].timestamp);
            const days = Math.round((now - last.getTime()) / (1000 * 60 * 60 * 24));
            if (days >= 14) {
                alerts.push({ type: "info", icon: "🧊", msg: `Lead <strong>${l.company}</strong> está frio há <strong>${days} dias</strong> — agende um follow-up!` });
            }
        });

        // Pipeline vazio
        if (proposals.filter(p => p.status === "Enviada").length === 0) {
            alerts.push({ type: "warning", icon: "📭", msg: "Nenhuma proposta aberta no pipeline. Crie novas oportunidades agora!" });
        }

        // Boa notícia (conversão alta)
        const won = proposals.filter(p => p.status === "Ganho").length;
        const total = proposals.length;
        if (total > 0 && (won / total) >= 0.4) {
            alerts.push({ type: "success", icon: "🏆", msg: `Taxa de conversão acima de 40%! Seu time está <strong>performando excelente</strong>.` });
        }

        if (alerts.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 24px 0;">✅ Nenhum alerta no momento. Tudo sob controle!</div>`;
            return;
        }

        const colorMap = { warning: "#f59e0b", danger: "#ef4444", info: "#6366f1", success: "#10b981" };
        const bgMap = { warning: "rgba(245,158,11,0.06)", danger: "rgba(239,68,68,0.06)", info: "rgba(99,102,241,0.06)", success: "rgba(16,185,129,0.06)" };

        container.innerHTML = alerts.map(a => `
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; background: ${bgMap[a.type]}; border-left: 3px solid ${colorMap[a.type]}; border-radius: 0 var(--radius-md) var(--radius-md) 0; margin-bottom: 8px;">
                <span style="font-size: 18px; flex-shrink: 0;">${a.icon}</span>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0;">${a.msg}</p>
            </div>
        `).join("");
    },

    setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
};
