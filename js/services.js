import { Store } from "./store.js";
import { Auth } from "./auth.js";

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
            // Se for vendedor, pode ser redirecionado ou ver uma visão limitada, 
            // mas o HTML deve restringir o acesso no menu.
        }

        const services = Store.getServices().filter(s => s.isActive);
        const proposals = Store.getProposals();

        const period = document.getElementById("services-period-filter")?.value || "all";
        const { start, end, label, prevStart, prevEnd } = this.getPeriodRange(period);

        this.setEl("services-period-label", `Período Analisado: ${label}`);

        // Mapear propostas para serviços baseados no título
        const serviceStats = services.map(srv => {
            return {
                ...srv,
                currentRevenue: 0,
                currentVolume: 0,
                prevRevenue: 0,
                prevVolume: 0,
                profit: 0
            };
        });

        // Simulação de atribuição de proposta ao serviço por palavras-chave
        proposals.forEach(p => {
            if (p.status !== "Ganho") return;
            
            const titleLower = p.title.toLowerCase();
            let srvId = "srv_4"; // Default: Consultoria
            if (titleLower.includes("gestão") || titleLower.includes("erp")) srvId = "srv_1";
            else if (titleLower.includes("pdv") || titleLower.includes("ponto")) srvId = "srv_2";
            else if (titleLower.includes("app") || titleLower.includes("mobile") || titleLower.includes("aplicativo")) srvId = "srv_3";

            const srvStat = serviceStats.find(s => s.id === srvId);
            if (!srvStat) return;

            const closedAt = new Date(p.closedAt || p.sentAt);

            // Verifica se pertence ao período atual
            if (closedAt >= start && closedAt <= end) {
                srvStat.currentRevenue += p.value;
                srvStat.currentVolume++;
            }
            // Verifica se pertence ao período anterior (para calcular crescimento)
            else if (closedAt >= prevStart && closedAt <= prevEnd) {
                srvStat.prevRevenue += p.value;
                srvStat.prevVolume++;
            }
        });

        // Calcular KPIs Consolidados e Métricas da Matriz
        let totalRevenue = 0;
        let totalPrevRevenue = 0;
        
        serviceStats.forEach(s => {
            totalRevenue += s.currentRevenue;
            totalPrevRevenue += s.prevRevenue;
            s.profit = s.currentRevenue * (s.baseMargin / 100);
        });

        // Adicionar share e crescimento a cada serviço
        serviceStats.forEach(s => {
            s.share = totalRevenue > 0 ? (s.currentRevenue / totalRevenue) * 100 : 0;
            if (s.prevRevenue === 0) {
                s.growth = s.currentRevenue > 0 ? 100 : 0; // 100% de crescimento se antes era 0 e agora tem
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

        // Por simplicidade, assumindo meses cheios
        if (period === "all") {
            start = new Date(2000, 0, 1);
            end = new Date(2099, 11, 31);
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

    // ===========================================================================
    // RENDERIZADORES
    // ===========================================================================
    renderKPIs(totalRevenue, totalPrevRevenue, services) {
        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        
        const totalProfit = services.reduce((s, a) => s + a.profit, 0);
        const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        
        const topService = [...services].sort((a,b) => b.currentRevenue - a.currentRevenue)[0];
        
        this.setEl("srv-kpi-revenue", fmt(totalRevenue));
        this.setEl("srv-kpi-profit", fmt(totalProfit));
        this.setEl("srv-kpi-margin", `${marginPct.toFixed(1)}%`);
        this.setEl("srv-kpi-top", topService && topService.currentRevenue > 0 ? topService.name : "Nenhum");
    },

    renderBarChart(services) {
        const container = document.getElementById("services-bar-chart");
        if (!container) return;

        const maxRev = Math.max(...services.map(s => s.currentRevenue), 1); // Evitar divisao por zero
        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

        container.innerHTML = services.map(s => {
            const h = Math.max((s.currentRevenue / maxRev) * 100, 2); // min 2% de altura pra aparecer barrinha
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 50px;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; transform: rotate(-45deg); white-space: nowrap;">${fmt(s.currentRevenue)}</div>
                    <div class="bcg-bar" style="height: ${h}%; background: var(--primary); width: 40px; border-radius: 4px 4px 0 0; transition: height 0.8s;"></div>
                    <div style="font-size: 10px; color: var(--text-muted); text-align: center; margin-top: 8px; width: 100px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${s.name}</div>
                </div>
            `;
        }).join("");
    },

    renderBCGMatrix(services) {
        const container = document.getElementById("bcg-matrix-container");
        if (!container) return;

        // A Matriz BCG original usa Market Share Relativo no eixo X (inverso, esquerda maior) 
        // e Crescimento do Mercado no eixo Y.
        // Vamos adaptar:
        // Eixo X: Share interno de receita (0 a 100%) - da Esquerda pra Direita por padrao web, mas BCG é Direita pra Esquerda
        // Eixo Y: Crescimento de Receita (em %)

        // Centro da cruz (médias)
        const avgGrowth = services.length > 0 ? services.reduce((s, a) => s + a.growth, 0) / services.length : 0;
        const avgShare = services.length > 0 ? services.reduce((s, a) => s + a.share, 0) / services.length : 0;

        let itemsHtml = "";
        
        services.forEach(s => {
            if (s.currentRevenue === 0 && s.prevRevenue === 0) return; // Ignora inativos no período

            // Determina a posição no CSS grid/absoluto baseada nos quadrantes
            // Quadrantes:
            // Top Left (Estrela): Alto Share, Alto Crescimento
            // Top Right (Interrogação): Baixo Share, Alto Crescimento
            // Bottom Left (Vaca Leiteira): Alto Share, Baixo Crescimento
            // Bottom Right (Abacaxi): Baixo Share, Baixo Crescimento

            const isHighShare = s.share >= avgShare;
            const isHighGrowth = s.growth >= avgGrowth;

            let qClass = "";
            let icon = "";
            
            if (isHighShare && isHighGrowth) { qClass = "bcg-star"; icon = "⭐"; }
            else if (!isHighShare && isHighGrowth) { qClass = "bcg-question"; icon = "❓"; }
            else if (isHighShare && !isHighGrowth) { qClass = "bcg-cow"; icon = "🐄"; }
            else { qClass = "bcg-dog"; icon = "🍍"; }

            // Calcular tamanho da bolha baseado no faturamento (min 30px, max 80px)
            const maxRev = Math.max(...services.map(srv => srv.currentRevenue), 1);
            const size = Math.max(30, (s.currentRevenue / maxRev) * 80);

            // Calcular posicao X e Y realativa (0 a 100%) no container de 100x100
            // Eixo X (Share): BCG tem Share Alto na Esquerda (0%) e Baixo na Direita (100%)
            // Portanto, x = 100 - (s.share / maxShare * 100).
            const maxShare = Math.max(...services.map(srv => srv.share), 10);
            const maxGrowth = Math.max(...services.map(srv => Math.abs(srv.growth)), 10);

            // Clamp positions
            let x = 100 - Math.min((s.share / (maxShare * 1.2)) * 100, 90); // 1.2 pra nao bater na borda
            let y = 100 - Math.min(((s.growth + maxGrowth) / (maxGrowth * 2.5)) * 100, 90); // Normaliza Y

            // Evitar bolhas encavaladas forçando posições baseadas no quadrante para ficar visual
            if(isHighShare) x = Math.max(10, Math.min(x, 45)); else x = Math.max(55, Math.min(x, 90));
            if(isHighGrowth) y = Math.max(10, Math.min(y, 45)); else y = Math.max(55, Math.min(y, 90));

            itemsHtml += `
                <div class="bcg-item ${qClass}" style="left: ${x}%; top: ${y}%; width: ${size}px; height: ${size}px;" title="${s.name}\nShare: ${s.share.toFixed(1)}%\nCresc: ${s.growth.toFixed(1)}%">
                    ${icon}
                    <div class="bcg-tooltip">${s.name} (${s.share.toFixed(0)}%)</div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="bcg-grid-lines"></div>
            <div class="bcg-label top">Crescimento Alto</div>
            <div class="bcg-label bottom">Crescimento Baixo</div>
            <div class="bcg-label left">Share Alto</div>
            <div class="bcg-label right">Share Baixo</div>
            ${itemsHtml}
        `;
    },

    renderPortfolioTable(services) {
        const tbody = document.getElementById("services-table-body");
        if (!tbody) return;

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        if (services.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhum serviço cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = [...services].sort((a,b) => b.currentRevenue - a.currentRevenue).map(s => {
            const isHighGrowth = s.growth > 0;
            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-primary);">${s.name}</td>
                    <td><span class="badge" style="background: var(--bg-surface); color: var(--text-secondary);">${s.category}</span></td>
                    <td style="font-weight: 700;">${fmt(s.currentRevenue)}</td>
                    <td style="color: var(--text-muted);">${s.share.toFixed(1)}%</td>
                    <td style="font-weight: 700; color: ${isHighGrowth ? 'var(--success)' : (s.growth < 0 ? 'var(--danger)' : 'var(--text-muted)')};">
                        ${isHighGrowth ? '↑' : (s.growth < 0 ? '↓' : '-')} ${Math.abs(s.growth).toFixed(1)}%
                    </td>
                    <td style="font-weight: 700; color: var(--primary);">${s.baseMargin}%</td>
                </tr>
            `;
        }).join("");
    },

    setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
};
