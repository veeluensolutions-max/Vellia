import { Store } from "./store.js";

// Armazenar instâncias do Chart.js para destruí-las antes de recriar
const charts = {};

export const Performance = {
    init() {
        this.renderAll();
    },

    renderAll() {
        // Destroy existing charts to prevent memory leaks
        Object.keys(charts).forEach(key => {
            if (charts[key]) charts[key].destroy();
        });

        const leads = Store.getLeads();
        const proposals = Store.getProposals();

        this.renderDailyEvolution(leads);
        this.renderYearlyEvolution(leads, proposals);
        this.renderFunnel(leads, proposals);
        this.renderPipeline(proposals);
    },

    renderDailyEvolution(leads) {
        const ctx = document.getElementById("chart-daily-evolution")?.getContext("2d");
        if (!ctx) return;

        // Gerar últimos 7 dias
        const labels = [];
        const dataLeads = [];
        const dataQualified = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            labels.push(d.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' }));

            let countLeads = 0;
            let countQual = 0;

            leads.forEach(l => {
                if (l.createdAt && l.createdAt.startsWith(dateStr)) countLeads++;
                if (l.qualification && l.qualification.updatedAt && l.qualification.updatedAt.startsWith(dateStr)) {
                    countQual++;
                }
            });

            dataLeads.push(countLeads);
            dataQualified.push(countQual);
        }

        charts.daily = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Leads Gerados',
                        data: dataLeads,
                        borderColor: '#0284c7',
                        backgroundColor: 'rgba(2, 132, 199, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Leads Qualificados',
                        data: dataQualified,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    },

    renderYearlyEvolution(leads, proposals) {
        const ctx = document.getElementById("chart-yearly-evolution")?.getContext("2d");
        if (!ctx) return;

        const labels = [];
        const dataRevenue = [];
        
        // Últimos 6 meses para simplificar visualização
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            labels.push(d.toLocaleDateString("pt-BR", { month: 'short' }));

            const rev = proposals
                .filter(p => p.status === "Ganho" && p.closedAt && p.closedAt.startsWith(monthStr))
                .reduce((sum, p) => sum + (p.value || 0), 0);
            
            dataRevenue.push(rev);
        }

        charts.yearly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Faturamento Mensal (R$)',
                    data: dataRevenue,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    },

    renderFunnel(leads, proposals) {
        const ctx = document.getElementById("chart-commercial-funnel")?.getContext("2d");
        if (!ctx) return;

        // Total Contatos, Leads Qualificados, Propostas, Clientes
        const contatos = leads.length;
        const qualificados = leads.filter(l => l.stage !== "Lead Novo" && l.stage !== "Contato").length;
        const propostas = proposals.length;
        const clientes = proposals.filter(p => p.status === "Ganho").length;

        charts.funnel = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Contatos (Leads)', 'Qualificados', 'Propostas', 'Clientes Fechados'],
                datasets: [{
                    label: 'Funil',
                    data: [contatos, qualificados, propostas, clientes],
                    backgroundColor: [
                        '#94a3b8',
                        '#3b82f6',
                        '#f59e0b',
                        '#10b981'
                    ],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    },

    renderPipeline(proposals) {
        const ctx = document.getElementById("chart-financial-pipeline")?.getContext("2d");
        if (!ctx) return;

        let valuePendente = 0;
        let valueGanho = 0;
        let valuePerdido = 0;

        proposals.forEach(p => {
            if (p.status === "Enviada" || p.status === "Em Negociação") {
                valuePendente += p.value || 0;
            } else if (p.status === "Ganho") {
                valueGanho += p.value || 0;
            } else if (p.status === "Perdido") {
                valuePerdido += p.value || 0;
            }
        });

        charts.pipeline = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Em Negociação', 'Ganho', 'Perdido'],
                datasets: [{
                    data: [valuePendente, valueGanho, valuePerdido],
                    backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                },
                cutout: '60%'
            }
        });
    }
};
