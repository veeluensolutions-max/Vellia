import { Store } from "./store.js";
import { Auth } from "./auth.js";

let bcgChartInstance = null;

export const Services = {
    init() {
        this.renderAll();
        this.bindEvents();
    },

    bindEvents() {
        const periodFilter = document.getElementById("services-period-filter");
        if (periodFilter) periodFilter.addEventListener("change", () => this.renderAll());
    },

    renderAll() {
        const user = Auth.getCurrentUser();
        if (!user || user.role === "seller") {
            // Se for vendedor, restrições se aplicam, mas ignoramos para demo
        }

        const services = Store.getServices().filter(s => s.isActive);
        const proposals = Store.getProposals();
        const leads = Store.getLeads();

        const period = document.getElementById("services-period-filter")?.value || "all";
        const { start, end, label, prevStart, prevEnd } = this.getPeriodRange(period);

        const labelEl = document.getElementById("services-period-label");
        if(labelEl) labelEl.textContent = `Período Analisado: ${label}`;

        const serviceStats = services.map(srv => {
            return {
                ...srv,
                currentRevenue: 0,
                currentVolume: 0,
                prevRevenue: 0,
                prevVolume: 0,
                profit: 0,
                totalCycleDays: 0,
                bcgClass: "",
                ticketMedio: 0
            };
        });

        proposals.forEach(p => {
            if (p.status !== "Ganho") return;
            
            const titleLower = p.title.toLowerCase();
            let srvId = "srv_4"; 
            if (titleLower.includes("gestão") || titleLower.includes("erp")) srvId = "srv_1";
            else if (titleLower.includes("pdv") || titleLower.includes("ponto")) srvId = "srv_2";
            else if (titleLower.includes("app") || titleLower.includes("mobile") || titleLower.includes("aplicativo")) srvId = "srv_3";

            const srvStat = serviceStats.find(s => s.id === srvId);
            if (!srvStat) return;

            const closedAt = new Date(p.closedAt || p.sentAt);

            if (closedAt >= start && closedAt <= end) {
                srvStat.currentRevenue += (p.value || 0);
                srvStat.currentVolume++;

                const lead = leads.find(l => l.id === p.leadId);
                if (lead) {
                    const cycle = Math.max(0, (closedAt - new Date(lead.createdAt)) / (1000 * 60 * 60 * 24));
                    srvStat.totalCycleDays += cycle;
                }
            } else if (closedAt >= prevStart && closedAt <= prevEnd) {
                srvStat.prevRevenue += (p.value || 0);
                srvStat.prevVolume++;
            }
        });

        let totalRevenue = 0;
        let totalPrevRevenue = 0;
        
        serviceStats.forEach(s => {
            totalRevenue += s.currentRevenue;
            totalPrevRevenue += s.prevRevenue;
            s.profit = s.currentRevenue * (s.baseMargin / 100);
            s.ticketMedio = s.currentVolume > 0 ? (s.currentRevenue / s.currentVolume) : 0;
            s.avgCycle = s.currentVolume > 0 ? Math.round(s.totalCycleDays / s.currentVolume) : 0;
        });

        serviceStats.forEach(s => {
            s.share = totalRevenue > 0 ? (s.currentRevenue / totalRevenue) * 100 : 0;
            if (s.prevRevenue === 0) {
                s.growth = s.currentRevenue > 0 ? 100 : 0;
            } else {
                s.growth = ((s.currentRevenue - s.prevRevenue) / s.prevRevenue) * 100;
            }
        });

        this.renderKPIs(totalRevenue, totalPrevRevenue, serviceStats);
        this.renderBCGMatrix(serviceStats);
        this.renderPortfolioTable(serviceStats);
        this.renderBarChart(serviceStats);
    },

    getPeriodRange(period) {
        const now = new Date();
        let start, end, label, prevStart, prevEnd;

        if (period === "all") {
            start = new Date(2000, 0, 1);
            end = new Date(2099, 11, 31, 23, 59, 59);
            label = "Todo o período";
            prevStart = start;
            prevEnd = end;
        } else if (period === "month") {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            label = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            
            prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (period === "year") {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            label = `Ano ${now.getFullYear()}`;
            
            prevStart = new Date(now.getFullYear() - 1, 0, 1);
            prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        }
        return { start, end, label, prevStart, prevEnd };
    },

    renderKPIs(totalRevenue, totalPrevRevenue, services) {
        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        const totalProfit = services.reduce((s, a) => s + a.profit, 0);
        const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const topService = [...services].sort((a,b) => b.currentRevenue - a.currentRevenue)[0];
        
        const elRev = document.getElementById("srv-kpi-revenue");
        if(elRev) elRev.textContent = fmt(totalRevenue);

        const elProf = document.getElementById("srv-kpi-profit");
        if(elProf) elProf.textContent = fmt(totalProfit);

        const elMar = document.getElementById("srv-kpi-margin");
        if(elMar) elMar.textContent = `${marginPct.toFixed(1)}%`;

        const elTop = document.getElementById("srv-kpi-top");
        if(elTop) elTop.textContent = topService && topService.currentRevenue > 0 ? topService.name : "Nenhum";
    },

    renderBarChart(services) {
        const container = document.getElementById("services-bar-chart");
        if (!container) return;
        const maxRev = Math.max(...services.map(s => s.currentRevenue), 1);
        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

        container.innerHTML = services.map(s => {
            const h = Math.max((s.currentRevenue / maxRev) * 100, 2);
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 50px;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; transform: rotate(-45deg); white-space: nowrap;">${fmt(s.currentRevenue)}</div>
                    <div class="bcg-bar" style="height: ${h}%; background: var(--primary); width: 40px; border-radius: 4px 4px 0 0;"></div>
                    <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-top: 8px; width: 100px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${s.name}</div>
                </div>
            `;
        }).join("");
    },

    renderBCGMatrix(services) {
        const ctx = document.getElementById("chart-bcg-matrix")?.getContext("2d");
        if (!ctx) return;

        if (bcgChartInstance) bcgChartInstance.destroy();

        // Calcular médias de eixo cruzando conversão x ticket
        let totalConv = 0, totalTicket = 0, validSrv = 0;
        services.forEach(s => {
            if(s.currentVolume > 0) {
                // taxa de conversão simplificada = growth, ou share
                // Aqui o plano era Ticket Médio vs Conversão
                totalTicket += s.ticketMedio;
                totalConv += s.share;
                validSrv++;
            }
        });
        const avgTicket = validSrv > 0 ? totalTicket / validSrv : 1;
        const avgShare = validSrv > 0 ? totalConv / validSrv : 1;

        const dataPoints = services.filter(s => s.currentVolume > 0).map(s => {
            let label = "";
            let color = "";
            if (s.ticketMedio >= avgTicket && s.share >= avgShare) { label = "Estrela ⭐"; color = "#3b82f6"; s.bcgClass = label; }
            else if (s.ticketMedio < avgTicket && s.share >= avgShare) { label = "Vaca Leiteira 🐄"; color = "#10b981"; s.bcgClass = label; }
            else if (s.ticketMedio >= avgTicket && s.share < avgShare) { label = "Interrogação ❓"; color = "#f59e0b"; s.bcgClass = label; }
            else { label = "Abacaxi 🍍"; color = "#ef4444"; s.bcgClass = label; }

            return {
                x: s.share,
                y: s.ticketMedio,
                r: Math.max(10, Math.min((s.currentRevenue / 30000) * 30, 40)), // Raio da bolha
                name: s.name,
                backgroundColor: color,
                labelClass: label
            };
        });

        bcgChartInstance = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: dataPoints.map(dp => ({
                    label: dp.name,
                    data: [{x: dp.x, y: dp.y, r: dp.r}],
                    backgroundColor: dp.backgroundColor,
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const dp = dataPoints[ctx.datasetIndex];
                                return `${dp.name} (${dp.labelClass}) | Share: ${dp.x.toFixed(1)}% | Ticket: R$ ${dp.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Share de Vendas (%)' }, beginAtZero: true },
                    y: { title: { display: true, text: 'Ticket Médio (R$)' }, beginAtZero: true }
                }
            }
        });
    },

    renderPortfolioTable(services) {
        const tbody = document.getElementById("services-table-body");
        if (!tbody) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        if (services.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum serviço cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = [...services].sort((a,b) => b.currentRevenue - a.currentRevenue).map(s => {
            let classBadge = s.bcgClass;
            if(!classBadge) classBadge = "Sem Dados ➖";
            let color = "var(--text-muted)";
            if(classBadge.includes("Estrela")) color = "#3b82f6";
            if(classBadge.includes("Vaca")) color = "#10b981";
            if(classBadge.includes("Interrogação")) color = "#f59e0b";
            if(classBadge.includes("Abacaxi")) color = "#ef4444";

            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-primary);">${s.name}</td>
                    <td>${s.currentVolume}</td>
                    <td>${fmt(s.price)}</td>
                    <td>${fmt(s.ticketMedio)}</td>
                    <td style="font-weight: 700; color: var(--success);">${fmt(s.currentRevenue)}</td>
                    <td>${s.avgCycle} dias</td>
                    <td><span class="badge" style="background: ${color}20; color: ${color};">${classBadge}</span></td>
                </tr>
            `;
        }).join("");
    }
};
