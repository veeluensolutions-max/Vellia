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

        this.renderPodium(stats);
        this.renderTable(stats);
        this.renderPersonalProgress(stats);
        this.renderBonusCalculator();
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

            // Injetar medalhas baseadas em estatísticas comportamentais
            let achievements = "";
            if (index === 0 && stat.revenue > 0) {
                achievements += `<span class="badge" style="background: rgba(251,191,36,0.12); color:#92400e; border: 1px solid rgba(251,191,36,0.2); margin-left: 6px; font-size:9px; padding: 2px 6px;">🥇 Lenda</span>`;
            }
            if (stat.conversion >= 30) {
                achievements += `<span class="badge" style="background: rgba(99,102,241,0.12); color:#4f46e5; border: 1px solid rgba(99,102,241,0.2); margin-left: 6px; font-size:9px; padding: 2px 6px;">🎯 Sniper</span>`;
            }
            if (stat.contacts >= 15) {
                achievements += `<span class="badge" style="background: rgba(16,185,129,0.12); color:#065f46; border: 1px solid rgba(16,185,129,0.2); margin-left: 6px; font-size:9px; padding: 2px 6px;">📞 Conectado</span>`;
            }
            if (stat.proposalsSent >= 8) {
                achievements += `<span class="badge" style="background: rgba(245,158,11,0.12); color:#b45309; border: 1px solid rgba(245,158,11,0.2); margin-left: 6px; font-size:9px; padding: 2px 6px;">🚀 Máquina</span>`;
            }

            tr.innerHTML = `
                <td><strong>${posMedal}</strong></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                            ${stat.avatar}
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-weight: 600;">${stat.name}</span>
                                ${achievements}
                            </div>
                            <div style="font-size: 11px; color: var(--text-muted);">${stat.role === "manager" ? "Gerente" : "Vendedor"}</div>
                        </div>
                    </div>
                </td>
                <td style="text-align: center;">${stat.contacts}</td>
                <td style="text-align: center;">${stat.leadsGenerated}</td>
                <td style="text-align: center;">${stat.leadsQualified}</td>
                <td style="text-align: center;">${stat.proposalsSent}</td>
                <td style="text-align: center;">${stat.proposalsWon}</td>
                <td style="font-weight: 700; text-align: right; color: var(--success);">${fmt(stat.revenue)}</td>
                <td style="text-align: center;">
                    <span class="badge ${stat.conversion >= 30 ? 'badge-success' : 'badge-warning'}">${stat.conversion}%</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                        <div style="flex: 1; height: 6px; background: var(--bg-hover); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${stat.metaPct}%; background: ${metaColor};"></div>
                        </div>
                        <span style="font-size: 12px; font-weight: 600; color: ${metaColor}; width: 36px; text-align: right;">${stat.metaPct}%</span>
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
            <div style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                    <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;"><span style="font-size: 16px;">💰</span> Receita Gerada</span>
                    <span style="font-weight: 700;">${fmt(myStat.revenue)} <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">/ ${fmt(DEFAULT_GOALS.meta_revenue)}</span></span>
                </div>
                <div style="height: 12px; background: var(--bg-hover); border-radius: 6px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="height: 100%; width: ${myStat.metaPct}%; background: linear-gradient(90deg, ${revenueColor}, #10b981); border-radius: 6px;"></div>
                </div>
                <div style="text-align: right; font-size: 12px; color: ${revenueColor}; font-weight: 700; margin-top: 4px;">${myStat.metaPct}% Concluído</div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                    <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;"><span style="font-size: 16px;">📄</span> Propostas Enviadas</span>
                    <span style="font-weight: 700;">${myStat.proposalsSent} <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">/ ${DEFAULT_GOALS.meta_proposals}</span></span>
                </div>
                <div style="height: 12px; background: var(--bg-hover); border-radius: 6px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="height: 100%; width: ${propsPct}%; background: linear-gradient(90deg, var(--primary), #8b5cf6); border-radius: 6px;"></div>
                </div>
                <div style="text-align: right; font-size: 12px; color: var(--primary); font-weight: 700; margin-top: 4px;">${propsPct}% Concluído</div>
            </div>
        `;
    },

    renderPodium(stats) {
        const container = document.getElementById("team-gamification-podium");
        if (!container) return;

        if (stats.length === 0) {
            container.innerHTML = "";
            return;
        }

        const fmt = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        // Identificar posições
        const first = stats[0];
        const second = stats[1];
        const third = stats[2];

        let colsHtml = "";

        // 2º Colocado
        if (second) {
            colsHtml += `
                <div class="card" style="position: relative; border-top: 4px solid #cbd5e1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px; order: 1;">
                    <div style="position: absolute; top: -14px; background: #cbd5e1; color: #0f172a; font-weight: 800; font-size: 10px; padding: 4px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; z-index: 1;">🥈 2º Colocado</div>
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-surface-hover); border: 2.5px solid #cbd5e1; color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; margin-bottom: 12px;">
                        ${second.avatar}
                    </div>
                    <h4 style="font-size: 15px; font-weight: 700; margin: 0 0 4px 0; color: var(--text-primary);">${second.name}</h4>
                    <span style="font-size: 11px; color: var(--text-muted);">${second.role === "manager" ? "Gerente" : "Vendedor"}</span>
                    <div style="margin-top: 12px; font-size: 17px; font-weight: 800; color: var(--success);">${fmt(second.revenue)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Conversão: ${second.conversion}% • ${second.proposalsWon} fechadas</div>
                </div>
            `;
        }

        // 1º Colocado (Vendedor do Mês)
        if (first) {
            colsHtml += `
                <div class="card" style="position: relative; border: 2px solid #fbbf24; box-shadow: 0 0 20px rgba(251, 191, 36, 0.15); display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px; order: 2; transform: scale(1.02); z-index: 2;">
                    <div style="position: absolute; top: -14px; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #0f172a; font-weight: 900; font-size: 11px; padding: 5px 14px; border-radius: 99px; text-transform: uppercase; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.25); letter-spacing: 0.5px; z-index: 3;">👑 Vendedor do Mês</div>
                    <div style="width: 68px; height: 68px; border-radius: 50%; background: linear-gradient(135deg, #fef3c7, #fde68a); border: 3px solid #fbbf24; color: #92400e; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; margin-bottom: 12px; box-shadow: 0 0 15px rgba(251, 191, 36, 0.35);">
                        ${first.avatar}
                    </div>
                    <h4 style="font-size: 17px; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary);">${first.name}</h4>
                    <span style="font-size: 11px; color: var(--text-muted);">${first.role === "manager" ? "Gerente" : "Vendedor"}</span>
                    <div style="margin-top: 12px; font-size: 20px; font-weight: 900; color: var(--success);">${fmt(first.revenue)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Conversão: ${first.conversion}% • ${first.proposalsWon} fechadas</div>
                    <span class="badge" style="background: rgba(251, 191, 36, 0.12); color: #92400e; border: 1px solid rgba(251, 191, 36, 0.3); margin-top: 10px; font-size: 10px; text-transform: uppercase; font-weight: 700;">🏆 Performance Lendária</span>
                </div>
            `;
        }

        // 3º Colocado
        if (third) {
            colsHtml += `
                <div class="card" style="position: relative; border-top: 4px solid #b45309; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px; order: 3;">
                    <div style="position: absolute; top: -14px; background: #b45309; color: white; font-weight: 800; font-size: 10px; padding: 4px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; z-index: 1;">🥉 3º Colocado</div>
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-surface-hover); border: 2.5px solid #b45309; color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; margin-bottom: 12px;">
                        ${third.avatar}
                    </div>
                    <h4 style="font-size: 15px; font-weight: 700; margin: 0 0 4px 0; color: var(--text-primary);">${third.name}</h4>
                    <span style="font-size: 11px; color: var(--text-muted);">${third.role === "manager" ? "Gerente" : "Vendedor"}</span>
                    <div style="margin-top: 12px; font-size: 17px; font-weight: 800; color: var(--success);">${fmt(third.revenue)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Conversão: ${third.conversion}% • ${third.proposalsWon} fechadas</div>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; align-items: stretch;">
                ${colsHtml}
            </div>
        `;
    },

    renderBonusCalculator() {
        const container = document.getElementById("team-bonus-section");
        if (!container) return;

        container.innerHTML = `
            <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 20px;">
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; margin-top: 0;">Simule sua bonificação com base no atingimento de metas e taxa de comissão.</p>
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Vendas Estimadas (R$)</label>
                        <input type="number" id="calc-sales" class="input-control" value="30000" style="width: 100%;">
                    </div>
                    <div style="width: 100px;">
                        <label style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Comissão (%)</label>
                        <input type="number" id="calc-pct" class="input-control" value="5" style="width: 100%;">
                    </div>
                </div>
                <button id="btn-calc-bonus" class="btn btn-primary" style="width: 100%; justify-content: center; background: linear-gradient(90deg, #8b5cf6, #6d28d9); border: none;">
                    Calcular Projeção
                </button>
                <div id="calc-result" style="margin-top: 20px; text-align: center; display: none;">
                    <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Bônus Projetado</div>
                    <div id="calc-value" style="font-size: 28px; font-weight: 800; color: #10b981; margin-top: 4px;">R$ 0,00</div>
                </div>
            </div>
        `;

        const btn = document.getElementById("btn-calc-bonus");
        if (btn) {
            btn.addEventListener("click", () => {
                const sales = parseFloat(document.getElementById("calc-sales").value) || 0;
                const pct = parseFloat(document.getElementById("calc-pct").value) || 0;
                const bonus = sales * (pct / 100);
                
                const resultDiv = document.getElementById("calc-result");
                const valDiv = document.getElementById("calc-value");
                
                resultDiv.style.display = "block";
                valDiv.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(bonus);
                
                valDiv.style.transform = "scale(1.1)";
                valDiv.style.transition = "transform 0.2s ease";
                setTimeout(() => { valDiv.style.transform = "scale(1)"; }, 200);
            });
        }
    }
};
