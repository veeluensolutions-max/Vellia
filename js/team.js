import { Store } from "./store.js";
import { Auth } from "./auth.js";

// Metas mensais padrão por vendedor
const DEFAULT_GOALS = {
    meta_leads: 20,
    meta_proposals: 8,
    meta_calls: 60,
    meta_meetings: 10,
    meta_revenue: 30000
};

export const Team = {
    init() {
        this.renderAll();
        this.bindEvents();
    },

    bindEvents() {
        const periodFilter = document.getElementById("team-period-filter");
        if (periodFilter) periodFilter.addEventListener("change", () => this.renderAll());
        
        const searchInput = document.getElementById("team-search");
        if (searchInput) searchInput.addEventListener("input", () => this.renderAll());
    },

    getPeriodRange(period) {
        const now = new Date();
        let start, end, label;
        
        if (period === "week") {
            const day = now.getDay() || 7; 
            if (day !== 1) now.setHours(-24 * (day - 1));
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 23, 59, 59).toISOString();
            label = "Esta Semana";
        } else if (period === "month") {
            start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
            label = `${now.toLocaleString('pt-BR', { month: 'long' })} ${now.getFullYear()}`;
        } else if (period === "quarter") {
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
            end = new Date(now.getFullYear(), (quarter * 3) + 3, 0, 23, 59, 59).toISOString();
            label = `${quarter + 1}º Trimestre ${now.getFullYear()}`;
        } else {
            start = new Date(now.getFullYear(), 0, 1).toISOString();
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
            label = `Ano ${now.getFullYear()}`;
        }
        return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1) };
    },

    renderAll() {
        const period = document.getElementById("team-period-filter")?.value || "month";
        const { start, end, label } = this.getPeriodRange(period);
        
        const labelEl = document.getElementById("team-period-label");
        if (labelEl) labelEl.textContent = `Mostrando resultados de: ${label}`;

        const leads = Store.getLeads();
        const proposals = Store.getProposals();
        const users = Store.getUsers();
        let sellers = users.filter(u => u.role === "seller" || u.role === "manager");

        const search = document.getElementById("team-search")?.value.toLowerCase().trim() || "";
        if (search) {
            sellers = sellers.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
        }

        const stats = sellers.map(seller => {
            // Contatos
            let contacts = 0;
            leads.forEach(lead => {
                if (lead.interactions) {
                    lead.interactions.forEach(int => {
                        const d = new Date(int.timestamp);
                        if (d >= new Date(start) && d <= new Date(end) && int.userEmail === seller.email) {
                            contacts++;
                        }
                    });
                }
            });

            // Leads
            const sellerLeads = leads.filter(l => {
                const d = new Date(l.createdAt);
                return d >= new Date(start) && d <= new Date(end) && l.createdBy === seller.email;
            });
            const leadsGenerated = sellerLeads.length;
            const leadsQualified = sellerLeads.filter(l => l.stage !== "Lead Novo" && l.stage !== "Contato").length;

            // Propostas
            const sellerProposals = proposals.filter(p => {
                const d = new Date(p.sentAt);
                return d >= new Date(start) && d <= new Date(end) && p.createdBy === seller.email;
            });
            const proposalsSent = sellerProposals.length;
            const proposalsWon = sellerProposals.filter(p => p.status === "Ganho").length;
            const revenue = sellerProposals.filter(p => p.status === "Ganho").reduce((s, p) => s + (p.value || 0), 0);
            
            const conversion = proposalsSent > 0 ? Math.round((proposalsWon / proposalsSent) * 100) : 0;
            const metaPct = Math.min(Math.round((revenue / DEFAULT_GOALS.meta_revenue) * 100), 100);

            return {
                ...seller,
                contacts,
                leadsGenerated,
                leadsQualified,
                proposalsSent,
                proposalsWon,
                revenue,
                conversion,
                metaPct
            };
        });

        // Ordenar por receita e conversão
        stats.sort((a, b) => b.revenue - a.revenue || b.conversion - a.conversion);

        this.renderTable(stats);
        this.renderPersonalProgress(stats);
    },

    renderTable(stats) {
        const tbody = document.getElementById("team-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        stats.forEach((stat, index) => {
            const tr = document.createElement("tr");
            
            let posMedal = `${index + 1}º`;
            if (index === 0) posMedal = "🥇 1º";
            if (index === 1) posMedal = "🥈 2º";
            if (index === 2) posMedal = "🥉 3º";

            let metaColor = "var(--danger)";
            if (stat.metaPct >= 100) metaColor = "var(--success)";
            else if (stat.metaPct >= 70) metaColor = "var(--warning)";

            tr.innerHTML = `
                <td><strong>${posMedal}</strong></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                            ${stat.avatar}
                        </div>
                        <div>
                            <div style="font-weight: 600;">${stat.name}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${stat.role === "manager" ? "Gerente" : "Vendedor"}</div>
                        </div>
                    </div>
                </td>
                <td>${stat.contacts}</td>
                <td>${stat.leadsGenerated}</td>
                <td>${stat.leadsQualified}</td>
                <td>${stat.proposalsSent}</td>
                <td>${stat.proposalsWon}</td>
                <td style="font-weight: 700;">${fmt(stat.revenue)}</td>
                <td>${stat.conversion}%</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; height: 6px; background: var(--bg-hover); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${stat.metaPct}%; background: ${metaColor};"></div>
                        </div>
                        <span style="font-size: 12px; font-weight: 600; color: ${metaColor}; width: 36px;">${stat.metaPct}%</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderPersonalProgress(stats) {
        const user = Auth.getCurrentUser();
        const myStat = stats.find(s => s.email === user.email);
        const container = document.getElementById("team-personal-progress");
        if (!container) return;
        
        if (!myStat) {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">Sem dados de performance para seu usuário neste período.</p>`;
            return;
        }

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
        
        let revenueColor = "var(--danger)";
        if (myStat.metaPct >= 100) revenueColor = "var(--success)";
        else if (myStat.metaPct >= 70) revenueColor = "var(--warning)";

        const propsPct = Math.min(Math.round((myStat.proposalsSent / DEFAULT_GOALS.meta_proposals) * 100), 100);

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                    <span style="font-weight: 600;">Receita Gerada</span>
                    <span>${fmt(myStat.revenue)} / ${fmt(DEFAULT_GOALS.meta_revenue)}</span>
                </div>
                <div style="height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${myStat.metaPct}%; background: ${revenueColor};"></div>
                </div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                    <span style="font-weight: 600;">Propostas Enviadas</span>
                    <span>${myStat.proposalsSent} / ${DEFAULT_GOALS.meta_proposals}</span>
                </div>
                <div style="height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${propsPct}%; background: var(--primary);"></div>
                </div>
            </div>
        `;
    }
};
