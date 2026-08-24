import { Store } from "./store.js";
import { Auth } from "./auth.js";

/**
 * Leaderboard — Ranking Gamificado de Vendedores e Conquistas Comercial
 */
export const Leaderboard = {
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.render();

        // Ouvir eventos do sistema para atualizar ranking ao vivo
        window.addEventListener("vellia:proposalUpdated", () => this.render());
        window.addEventListener("vellia:leadsUpdated", () => this.render());
        window.addEventListener("hashchange", () => {
            if (window.location.hash === "#team" || window.location.hash === "#performance") {
                setTimeout(() => this.render(), 100);
            }
        });
    },

    /**
     * Compila e calcula as estatísticas de cada vendedor
     */
    getRankedSellers() {
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        const users = Store.getUsers().filter(u => u && u.status === "active");
        const proposals = Store.getProposals().filter(p => p.workspace === activeCompany);
        const leads = Store.getLeads().filter(l => l.workspace === activeCompany);

        const sellerStats = users.map(user => {
            const userProposals = proposals.filter(p => p.owner === user.email || p.createdBy === user.email);
            const wonProposals = userProposals.filter(p => p.status === "Ganho");

            const totalRevenue = wonProposals.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);
            const totalProposalsCount = userProposals.length;
            const wonCount = wonProposals.length;
            const conversionRate = totalProposalsCount > 0 ? Math.round((wonCount / totalProposalsCount) * 100) : 0;

            const userLeads = leads.filter(l => l.owner === user.email);

            // Calcular Badges / Conquistas
            const badges = [];
            if (wonCount >= 1) {
                badges.push({ icon: "🚀", title: "Primeira Venda", desc: "Realizou seu primeiro fechamento no CRM" });
            }
            if (totalRevenue >= 100000) {
                badges.push({ icon: "💎", title: "Clube dos 100k", desc: "Superou R$ 100.000 em faturamento acumulado" });
            } else if (totalRevenue >= 50000) {
                badges.push({ icon: "🔥", title: "Clube dos 50k", desc: "Superou R$ 50.000 em faturamento acumulado" });
            }
            if (conversionRate >= 40 && totalProposalsCount >= 3) {
                badges.push({ icon: "🎯", title: "Sniper Comercial", desc: "Taxa de conversão de propostas acima de 40%" });
            }
            if (userLeads.length >= 15) {
                badges.push({ icon: "⚡", title: "Prospector Natos", desc: "Mais de 15 leads sob sua gestão" });
            }

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar || user.name.substring(0, 2).toUpperCase(),
                totalRevenue,
                wonCount,
                totalProposalsCount,
                conversionRate,
                badges
            };
        });

        // Ordenar por maior faturamento e depois por maior número de fechamentos
        sellerStats.sort((a, b) => (b.totalRevenue - a.totalRevenue) || (b.wonCount - a.wonCount));

        // Atribuir medalha de top 1
        if (sellerStats.length > 0 && sellerStats[0].totalRevenue > 0) {
            sellerStats[0].badges.unshift({ icon: "👑", title: "Top Closer", desc: "1º Lugar no Ranking Comercial da Empresa" });
        }

        return sellerStats;
    },

    /**
     * Renderiza a interface do Ranking no container
     */
    render() {
        const container = document.getElementById("leaderboard-widget-container");
        if (!container) return;

        const sellers = this.getRankedSellers();
        const top1 = sellers[0] || null;
        const top2 = sellers[1] || null;
        const top3 = sellers[2] || null;

        const fmt = (val) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        container.innerHTML = `
            <div class="card" style="margin-bottom: 24px; padding: 24px; background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 1); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05); border-radius: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                            🏆 Ranking Comercial & Leaderboard ao Vivo
                        </h3>
                        <span style="font-size: 12px; color: var(--text-muted);">Pódio de desempenho e conquistas desbloqueadas pela equipe de vendas</span>
                    </div>
                </div>

                <!-- Pódio de Vendas (Podium Visual) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; align-items: flex-end;">
                    
                    <!-- 2º Lugar (Prata) -->
                    ${top2 ? `
                        <div style="background: rgba(241, 245, 249, 0.8); border: 1px solid rgba(203, 213, 225, 0.8); padding: 18px; border-radius: 16px; text-align: center; position: relative;">
                            <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #94a3b8; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: 99px;">
                                🥈 2º LUGAR
                            </div>
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #cbd5e1, #94a3b8); color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; margin: 10px auto 8px;">
                                ${top2.avatar}
                            </div>
                            <div style="font-weight: 800; font-size: 14px; color: var(--text-primary);">${top2.name}</div>
                            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${fmt(top2.totalRevenue)}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${top2.wonCount} Vendas • ${top2.conversionRate}% Conversão</div>
                        </div>
                    ` : ''}

                    <!-- 1º Lugar (Ouro - Destaque Principal) -->
                    ${top1 ? `
                        <div style="background: linear-gradient(135deg, rgba(254, 240, 138, 0.4), rgba(253, 224, 71, 0.2)); border: 2px solid #facc15; padding: 22px 18px; border-radius: 16px; text-align: center; position: relative; box-shadow: 0 10px 30px rgba(250, 204, 21, 0.2);">
                            <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: #eab308; color: #fff; font-size: 12px; font-weight: 800; padding: 4px 14px; border-radius: 99px; display: flex; align-items: center; gap: 4px;">
                                👑 1º LUGAR (TOP CLOSER)
                            </div>
                            <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #eab308, #ca8a04); color: #fff; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; margin: 12px auto 8px; border: 3px solid #fef08a;">
                                ${top1.avatar}
                            </div>
                            <div style="font-weight: 800; font-size: 16px; color: var(--text-primary);">${top1.name}</div>
                            <div style="font-size: 22px; font-weight: 900; color: #ca8a04; margin-top: 4px;">${fmt(top1.totalRevenue)}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px; font-weight: 600;">${top1.wonCount} Vendas Fechadas • ${top1.conversionRate}% Taxa de Conversão</div>
                        </div>
                    ` : ''}

                    <!-- 3º Lugar (Bronze) -->
                    ${top3 ? `
                        <div style="background: rgba(254, 215, 170, 0.3); border: 1px solid rgba(251, 146, 60, 0.4); padding: 18px; border-radius: 16px; text-align: center; position: relative;">
                            <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #f97316; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: 99px;">
                                🥉 3º LUGAR
                            </div>
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #fb923c, #ea580c); color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; margin: 10px auto 8px;">
                                ${top3.avatar}
                            </div>
                            <div style="font-weight: 800; font-size: 14px; color: var(--text-primary);">${top3.name}</div>
                            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${fmt(top3.totalRevenue)}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${top3.wonCount} Vendas • ${top3.conversionRate}% Conversão</div>
                        </div>
                    ` : ''}
                </div>

                <!-- Tabela de Classificação Completa -->
                <div class="table-responsive">
                    <table class="custom-table" style="width: 100%; font-size: 13px;">
                        <thead>
                            <tr>
                                <th style="width: 50px;">Posição</th>
                                <th>Vendedor</th>
                                <th>Faturamento Acumulado</th>
                                <th>Fechamentos</th>
                                <th>Conversão</th>
                                <th>Conquistas / Badges</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sellers.map((s, idx) => `
                                <tr>
                                    <td style="font-weight: 800; font-size: 14px; text-align: center; color: ${idx === 0 ? '#eab308' : idx === 1 ? '#94a3b8' : idx === 2 ? '#f97316' : 'var(--text-muted)'};">
                                        #${idx + 1}
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                                                ${s.avatar}
                                            </div>
                                            <div>
                                                <div style="font-weight: 700; color: var(--text-primary);">${s.name}</div>
                                                <div style="font-size: 10.5px; color: var(--text-muted);">${s.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="font-weight: 800; color: var(--text-primary);">${fmt(s.totalRevenue)}</td>
                                    <td style="font-weight: 700;">${s.wonCount} / ${s.totalProposalsCount}</td>
                                    <td><span class="badge" style="background: rgba(99, 102, 241, 0.1); color: var(--primary); font-weight: 700;">${s.conversionRate}%</span></td>
                                    <td>
                                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                            ${s.badges.map(b => `<span title="${b.title}: ${b.desc}" style="cursor: help; font-size: 15px; padding: 2px 6px; background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.08); border-radius: 6px;">${b.icon}</span>`).join("") || '<span style="font-size: 11px; color: var(--text-muted);">Em progresso</span>'}
                                        </div>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};

window.Leaderboard = Leaderboard;
