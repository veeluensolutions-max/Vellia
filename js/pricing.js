import { Store } from "./store.js";
import { Audit } from "./audit.js";

export const Pricing = {
    chart: null,

    init() {
        this.initModalSimulators();
        this.cacheElements();
        if (!this.els.service) return; // Se não existir na tela, não inicializa
        this.bindEvents();
        this.calculate();
    },

    cacheElements() {
        this.els = {
            service: document.getElementById("pricing-service"),
            hours: document.getElementById("pricing-hours"),
            rate: document.getElementById("pricing-rate"),
            fixedCosts: document.getElementById("pricing-fixed-costs"),
            tax: document.getElementById("pricing-tax"),
            margin: document.getElementById("pricing-margin"),
            
            suggestedPrice: document.getElementById("pricing-suggested-price"),
            totalCost: document.getElementById("pricing-total-cost"),
            netProfit: document.getElementById("pricing-net-profit"),
            marginValue: document.getElementById("pricing-margin-value"),
            feedback: document.getElementById("pricing-feedback"),
            
            btnToProposal: document.getElementById("btn-pricing-to-proposal"),
            canvas: document.getElementById("chart-pricing")
        };
    },

    bindEvents() {
        const inputs = [
            this.els.hours, 
            this.els.rate, 
            this.els.fixedCosts, 
            this.els.tax, 
            this.els.margin
        ];

        inputs.forEach(input => {
            input.addEventListener("input", () => this.calculate());
        });

        this.els.service.addEventListener("change", () => {
            this.presetForService();
            this.calculate();
        });

        this.els.btnToProposal.addEventListener("click", () => this.sendToProposal());
    },

    presetForService() {
        const val = this.els.service.value;
        if (val === "licenciamento") {
            this.els.hours.value = 60;
            this.els.rate.value = 150;
            this.els.fixedCosts.value = 1200;
        } else if (val === "esg") {
            this.els.hours.value = 120;
            this.els.rate.value = 200;
            this.els.fixedCosts.value = 800;
        } else if (val === "nr13") {
            this.els.hours.value = 30;
            this.els.rate.value = 180;
            this.els.fixedCosts.value = 400;
        }
    },

    calculate() {
        const hours = parseFloat(this.els.hours.value) || 0;
        const rate = parseFloat(this.els.rate.value) || 0;
        const fixedCosts = parseFloat(this.els.fixedCosts.value) || 0;
        const taxPercent = parseFloat(this.els.tax.value) || 0;
        const marginPercent = parseFloat(this.els.margin.value) || 0;

        // Custo Operacional (Horas x Taxa) + Custos Fixos
        const baseCost = (hours * rate) + fixedCosts;

        // Para atingir a Margem Líquida % desejada (e pagar os impostos sobre a NF bruta):
        // Preço de Venda (PV) = BaseCost / (1 - TaxaImposto - TaxaMargem)
        // Isso porque: PV - (PV * TaxaImposto) - (PV * TaxaMargem) = BaseCost
        const divisor = 1 - (taxPercent / 100) - (marginPercent / 100);

        let suggestedPrice = 0;
        let netProfit = 0;
        let taxValue = 0;
        let realMargin = 0;

        if (divisor > 0) {
            suggestedPrice = baseCost / divisor;
            taxValue = suggestedPrice * (taxPercent / 100);
            netProfit = suggestedPrice - baseCost - taxValue;
            realMargin = marginPercent;
        } else {
            // Se o usuário pedir margem + imposto >= 100%, cálculo matemático quebra, fazemos um markup simples de alerta
            suggestedPrice = baseCost * 2; // Fixo fallback
            taxValue = suggestedPrice * (taxPercent / 100);
            netProfit = suggestedPrice - baseCost - taxValue;
            realMargin = (netProfit / suggestedPrice) * 100;
        }

        this.updateUI(baseCost, suggestedPrice, netProfit, taxValue, realMargin);
    },

    updateUI(baseCost, suggestedPrice, netProfit, taxValue, realMargin) {
        this.els.suggestedPrice.textContent = this.formatCurrency(suggestedPrice);
        this.els.totalCost.textContent = this.formatCurrency(baseCost);
        this.els.netProfit.textContent = this.formatCurrency(netProfit);
        this.els.marginValue.textContent = `${realMargin.toFixed(1)}%`;

        // Update Feedback
        if (realMargin < 20) {
            this.els.feedback.textContent = "⚠️ Margem de risco! Verifique se os custos podem ser reduzidos.";
            this.els.feedback.style.color = "var(--danger)";
            this.els.feedback.style.background = "rgba(239, 68, 68, 0.1)";
            this.els.marginValue.style.color = "var(--danger)";
        } else if (realMargin > 40) {
            this.els.feedback.textContent = "🚀 Excelente negócio! Rentabilidade superando expectativas.";
            this.els.feedback.style.color = "var(--success)";
            this.els.feedback.style.background = "rgba(16, 185, 129, 0.1)";
            this.els.marginValue.style.color = "var(--success)";
        } else {
            this.els.feedback.textContent = "✅ Rentabilidade saudável dentro da média do mercado.";
            this.els.feedback.style.color = "var(--primary)";
            this.els.feedback.style.background = "rgba(99, 102, 241, 0.1)";
            this.els.marginValue.style.color = "var(--text-primary)";
        }

        this.updateChart(baseCost, netProfit, taxValue);
    },

    updateChart(baseCost, netProfit, taxValue) {
        if (this.chart) {
            this.chart.destroy();
        }

        const ctx = this.els.canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Custo Operacional', 'Lucro Líquido', 'Impostos'],
                datasets: [{
                    data: [baseCost, netProfit, taxValue],
                    backgroundColor: [
                        '#ef4444', // Red (Custo)
                        '#10b981', // Green (Lucro)
                        '#f59e0b'  // Yellow (Impostos)
                    ],
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
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let value = context.parsed;
                                return ' ' + this.formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    },

    sendToProposal() {
        const serviceName = this.els.service.options[this.els.service.selectedIndex].text;
        if (this.els.service.value === "") {
            alert("Por favor, selecione um Serviço Principal antes de gerar a proposta.");
            return;
        }

        // Sugestão de Preço para formatar no input
        const suggestedPrice = parseFloat(this.els.suggestedPrice.textContent.replace('R$ ', '').replace('.', '').replace(',', '.'));

        // Se o modal de nova proposta existir, preenche.
        const propModal = document.getElementById("new-proposal-modal");
        const propTitle = document.getElementById("proposal-title");
        const propValue = document.getElementById("proposal-value");

        if (propModal) {
            if (propTitle) propTitle.value = `Proposta - ${serviceName}`;
            if (propValue) propValue.value = this.els.suggestedPrice.textContent.replace('R$ ', '').trim();
            
            // Ativa visualização de propostas, e abre modal
            const propostasMenu = document.getElementById("menu-proposals");
            if (propostasMenu) propostasMenu.click();
            
            const btnNew = document.getElementById("btn-new-proposal");
            if (btnNew) btnNew.click();
            
            Audit.log(`Simulação de Preços convertida em rascunho de Proposta: ${serviceName}`);
        }
    },

    initModalSimulators() {
        const toggleButtons = document.querySelectorAll(".btn-toggle-pricing-sim");
        toggleButtons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const target = btn.getAttribute("data-target");
                const panel = document.getElementById(`pricing-sim-panel-${target}`);
                if (panel) {
                    const isHidden = panel.style.display === "none";
                    panel.style.display = isHidden ? "block" : "none";
                }
            });
        });

        const calculatePanel = (target) => {
            const costo = parseFloat(document.getElementById(`sim-${target}-custo`).value) || 0;
            const despesa = parseFloat(document.getElementById(`sim-${target}-despesa`).value) || 0;
            const margem = parseFloat(document.getElementById(`sim-${target}-margem`).value) || 0;
            const impostos = parseFloat(document.getElementById(`sim-${target}-impostos`).value) || 0;

            const baseCost = costo + despesa;
            const divisor = 1 - (impostos / 100) - (margem / 100);

            let price = 0;
            if (divisor > 0) {
                price = baseCost / divisor;
            } else {
                price = baseCost * 2;
            }

            const resultEl = document.getElementById(`sim-${target}-result`);
            if (resultEl) {
                resultEl.textContent = this.formatCurrency(price);
            }
        };

        const targets = ["new", "edit"];
        targets.forEach(target => {
            const inputs = [
                document.getElementById(`sim-${target}-custo`),
                document.getElementById(`sim-${target}-despesa`),
                document.getElementById(`sim-${target}-margem`),
                document.getElementById(`sim-${target}-impostos`)
            ];
            inputs.forEach(input => {
                if (input) {
                    input.addEventListener("input", () => calculatePanel(target));
                }
            });

            const applyBtn = document.querySelector(`.btn-apply-sim-val[data-target="${target}"]`);
            if (applyBtn) {
                applyBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    const resultEl = document.getElementById(`sim-${target}-result`);
                    const val = parseFloat(resultEl.textContent.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.'));
                    
                    const valueInput = document.getElementById(target === "new" ? "proposal-value" : "edit-prop-value");
                    if (valueInput) {
                        valueInput.value = val.toFixed(2);
                    }
                    const panel = document.getElementById(`pricing-sim-panel-${target}`);
                    if (panel) panel.style.display = "none";
                });
            }
        });
    },

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
};
