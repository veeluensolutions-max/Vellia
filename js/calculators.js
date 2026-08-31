/**
 * Calculadoras de Serviços — Vellia CRM
 * Dimensionamento técnico, precificação comercial e geração automática de propostas
 */

import { Store } from "./store.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";
import { Toast } from "./toast.js";

export const Calculators = {
    activeCalculator: null,
    currentResult: null,

    init() {
        this.bindHubCards();
        this.injectModal();
    },

    bindHubCards() {
        const cards = document.querySelectorAll("#view-calculators .calc-card");
        cards.forEach(card => {
            card.style.cursor = "pointer";
            card.addEventListener("click", () => {
                const calcType = card.getAttribute("data-calc");
                if (calcType === "isocinetica") {
                    window.location.hash = "#isocinetica";
                } else if (calcType) {
                    this.openCalculator(calcType);
                }
            });
        });
    },

    injectModal() {
        if (document.getElementById("calculator-modal-overlay")) return;

        const modalHtml = `
            <div id="calculator-modal-overlay" class="modal-overlay" style="display: none; z-index: 2000; backdrop-filter: blur(8px);"></div>
            <div id="calculator-modal" class="modal" style="display: none; z-index: 2001; max-width: 920px; width: 94%; max-height: 90vh; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.3); border: 1px solid var(--border-color); background: var(--bg-surface); overflow: hidden; display: none; flex-direction: column;">
                <!-- Header -->
                <div style="padding: 18px 24px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div id="calc-modal-icon" style="width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: rgba(99,102,241,0.1); color: var(--primary);">
                            ☀️
                        </div>
                        <div>
                            <h3 id="calc-modal-title" style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-primary);">Calculadora de Serviço</h3>
                            <p id="calc-modal-subtitle" style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-secondary);">Dimensionamento técnico e precificação comercial</p>
                        </div>
                    </div>
                    <button type="button" id="calc-modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted); padding: 4px 8px; border-radius: 8px; transition: all 0.2s;">&times;</button>
                </div>

                <!-- Body (Grid 2 colunas: Inputs & Resultados) -->
                <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; flex: 1; overflow-y: auto; max-height: calc(90vh - 140px);">
                    <!-- Coluna Esquerda: Formulário de Inputs -->
                    <div id="calc-modal-inputs" style="padding: 24px; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 16px;">
                        <!-- Injetado dinamicamente -->
                    </div>

                    <!-- Coluna Direita: Dashboard de Resultados -->
                    <div style="padding: 24px; background: var(--bg-app); display: flex; flex-direction: column; justify-content: space-between; gap: 20px;">
                        <div>
                            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 12px;">
                                📊 Resumo do Dimensionamento
                            </div>

                            <!-- Preço Sugerido em Destaque -->
                            <div style="background: var(--bg-surface); border: 1.5px solid var(--primary); border-radius: 14px; padding: 18px; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(99,102,241,0.12);">
                                <span style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Preço Comercial Sugerido</span>
                                <div id="calc-result-price" style="font-size: 28px; font-weight: 800; color: #10b981; margin: 4px 0 2px 0; font-variant-numeric: tabular-nums;">
                                    R$ 0,00
                                </div>
                                <span id="calc-result-price-detail" style="font-size: 11.5px; color: var(--text-muted);">Com impostos e margem líquida calculados</span>
                            </div>

                            <!-- KPIs Técnicos Secundários -->
                            <div id="calc-result-kpis" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                                <!-- Injetado dinamicamente -->
                            </div>

                            <!-- Breakdown de Custos -->
                            <div id="calc-result-breakdown" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                                <!-- Injetado dinamicamente -->
                            </div>
                        </div>

                        <!-- Ações do Rodapé -->
                        <div style="display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                            <button id="btn-calc-generate-proposal" class="btn btn-primary" style="width: 100%; height: 42px; font-weight: 700; font-size: 13px; justify-content: center; gap: 8px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), #8b5cf6); border: none; box-shadow: 0 4px 12px rgba(99,102,241,0.25);">
                                <span>📄</span> Gerar Proposta Comercial
                            </button>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <button id="btn-calc-copy-summary" class="btn btn-outline" style="font-size: 11.5px; height: 36px; justify-content: center; gap: 6px;">
                                    <span>📋</span> Copiar Resumo
                                </button>
                                <button id="btn-calc-reset-inputs" class="btn btn-outline" style="font-size: 11.5px; height: 36px; justify-content: center; gap: 6px; color: var(--text-muted);">
                                    <span>🔄</span> Redefinir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHtml);

        // Bind Fechar
        const closeBtn = document.getElementById("calc-modal-close");
        const overlay = document.getElementById("calculator-modal-overlay");
        if (closeBtn) closeBtn.addEventListener("click", () => this.closeModal());
        if (overlay) overlay.addEventListener("click", () => this.closeModal());

        // Bind Ações
        const btnGen = document.getElementById("btn-calc-generate-proposal");
        if (btnGen) btnGen.addEventListener("click", () => this.generateProposalFromActiveCalc());

        const btnCopy = document.getElementById("btn-calc-copy-summary");
        if (btnCopy) btnCopy.addEventListener("click", () => this.copySummary());

        const btnReset = document.getElementById("btn-calc-reset-inputs");
        if (btnReset) btnReset.addEventListener("click", () => this.resetActiveInputs());
    },

    openCalculator(type) {
        this.activeCalculator = type;
        const config = this.getCalculatorConfig(type);
        if (!config) return;

        // Atualizar Título e Ícone
        document.getElementById("calc-modal-title").textContent = config.title;
        document.getElementById("calc-modal-subtitle").textContent = config.subtitle;
        document.getElementById("calc-modal-icon").textContent = config.icon;
        document.getElementById("calc-modal-icon").style.color = config.color || "var(--primary)";
        document.getElementById("calc-modal-icon").style.background = `${config.color || '#6366f1'}18`;

        // Injetar Inputs
        const inputsContainer = document.getElementById("calc-modal-inputs");
        inputsContainer.innerHTML = config.renderInputsHtml();

        // Vincular Eventos de Input
        const formInputs = inputsContainer.querySelectorAll("input, select, textarea");
        formInputs.forEach(input => {
            input.addEventListener("input", () => this.runCalculation());
            input.addEventListener("change", () => this.runCalculation());
        });

        // Executar primeiro cálculo
        this.runCalculation();

        // Exibir Modal
        const overlay = document.getElementById("calculator-modal-overlay");
        const modal = document.getElementById("calculator-modal");
        overlay.style.display = "block";
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    },

    closeModal() {
        const overlay = document.getElementById("calculator-modal-overlay");
        const modal = document.getElementById("calculator-modal");
        if (overlay) overlay.style.display = "none";
        if (modal) modal.style.display = "none";
        document.body.style.overflow = "";
    },

    runCalculation() {
        const config = this.getCalculatorConfig(this.activeCalculator);
        if (!config) return;

        const result = config.calculate();
        this.currentResult = result;

        // Atualizar Preço
        document.getElementById("calc-result-price").textContent = this.formatCurrency(result.suggestedPrice);
        if (result.priceDetail) {
            document.getElementById("calc-result-price-detail").textContent = result.priceDetail;
        }

        // Atualizar KPIs Secundários
        const kpiContainer = document.getElementById("calc-result-kpis");
        kpiContainer.innerHTML = (result.kpis || []).map(kpi => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px;">
                <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${kpi.label}</span>
                <div style="font-size: 16px; font-weight: 800; color: ${kpi.color || 'var(--text-primary)'}; margin-top: 3px; font-variant-numeric: tabular-nums;">
                    ${kpi.value}
                </div>
                ${kpi.sub ? `<span style="font-size: 10.5px; color: var(--text-muted);">${kpi.sub}</span>` : ''}
            </div>
        `).join("");

        // Atualizar Breakdown de Custos
        const breakdownContainer = document.getElementById("calc-result-breakdown");
        breakdownContainer.innerHTML = (result.breakdown || []).map(b => `
            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-secondary);">
                <span>${b.label}</span>
                <strong style="color: ${b.highlight ? 'var(--text-primary)' : 'inherit'}; font-variant-numeric: tabular-nums;">${b.value}</strong>
            </div>
        `).join("");
    },

    resetActiveInputs() {
        if (this.activeCalculator) {
            this.openCalculator(this.activeCalculator);
        }
    },

    copySummary() {
        if (!this.currentResult) return;
        const config = this.getCalculatorConfig(this.activeCalculator);
        const text = `📋 *${config.title} — Vellia CRM*\n` +
            `💰 *Preço Comercial Sugerido:* ${this.formatCurrency(this.currentResult.suggestedPrice)}\n` +
            (this.currentResult.kpis || []).map(k => `• *${k.label}:* ${k.value}`).join("\n") +
            `\n\n_Dimensionamento gerado via Vellia CRM Inteligente._`;

        navigator.clipboard.writeText(text).then(() => {
            Toast.show("Resumo técnico copiado para a área de transferência!", "success");
        });
    },

    generateProposalFromActiveCalc() {
        if (!this.currentResult) return;
        const config = this.getCalculatorConfig(this.activeCalculator);
        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

        // Obter lead selecionado no formulário se houver
        const leadSelect = document.getElementById("calc-input-lead");
        const leadId = leadSelect ? leadSelect.value : "";
        let targetLead = leadId ? Store.getLeadById(leadId) : null;

        const newProposalData = {
            title: `Proposta Comercial — ${config.title}`,
            leadId: targetLead ? targetLead.id : "",
            company: targetLead ? targetLead.company : "Cliente a Definir",
            contact: targetLead ? targetLead.contact : "",
            value: this.currentResult.suggestedPrice,
            status: "Enviada",
            notes: `Dimensionamento Técnico gerado automaticamente via Calculadora de ${config.title}.\n` +
                (this.currentResult.kpis || []).map(k => `- ${k.label}: ${k.value}`).join("\n"),
            createdBy: userEmail
        };

        const created = Store.addProposal(newProposalData);
        Audit.log(userEmail, "PROPOSAL_CREATED_FROM_CALC", `Proposta de ${config.title} gerada via Calculadora.`);

        this.closeModal();
        Toast.show(`Proposta comercial criada com sucesso! (R$ ${this.currentResult.suggestedPrice.toLocaleString('pt-BR')})`, "success");

        // Redirecionar para visualização de propostas
        window.location.hash = "#proposals";
    },

    formatCurrency(val) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    },

    // =========================================================================
    // CONFIGURAÇÕES & MOTORES DE CÁLCULO DE CADA SERVIÇO
    // =========================================================================

    getCalculatorConfig(type) {
        const leads = Store.getLeads();
        const leadOptionsHtml = `<option value="">-- Selecionar Lead do CRM (Opcional) --</option>` +
            leads.map(l => `<option value="${l.id}">${l.company} (${l.contact || 'Sem contato'})</option>`).join("");

        const configs = {
            // 1. ENERGIA SOLAR FOTOVOLTAICA
            solar: {
                title: "Energia Solar Fotovoltaica",
                subtitle: "Dimensionamento fotovoltaico, kits de módulos e retorno financeiro",
                icon: "☀️",
                color: "#f59e0b",
                renderInputsHtml: () => `
                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Lead / Cliente</label>
                        <select id="calc-input-lead" class="form-control" style="height: 38px; font-size: 13px;">${leadOptionsHtml}</select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Consumo Mensal (kWh/mês)</label>
                            <input type="number" id="solar-consumo" class="form-control" value="1200" min="50" step="50" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Tarifa de Energia (R$/kWh)</label>
                            <input type="number" id="solar-tarifa" class="form-control" value="0.95" min="0.3" step="0.05" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Região / Irradiação Solar (HSP)</label>
                            <select id="solar-hsp" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="5.4">Nordeste (5.4 kWh/m²/dia)</option>
                                <option value="5.1">Centro-Oeste (5.1 kWh/m²/dia)</option>
                                <option value="4.8" selected>Sudeste (4.8 kWh/m²/dia)</option>
                                <option value="4.2">Sul (4.2 kWh/m²/dia)</option>
                                <option value="4.6">Norte (4.6 kWh/m²/dia)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Tipo de Ligação</label>
                            <select id="solar-ligacao" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="30">Monofásico (Taxa 30 kWh)</option>
                                <option value="50">Bifásico (Taxa 50 kWh)</option>
                                <option value="100" selected>Trifásico (Taxa 100 kWh)</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Potência Módulos (Wp)</label>
                            <select id="solar-pot-modulo" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="550" selected>550 Wp (Monocristalino Tier 1)</option>
                                <option value="580">580 Wp (N-Type Bifacial)</option>
                                <option value="650">650 Wp (Alta Densidade)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Margem Comercial (%)</label>
                            <input type="number" id="solar-margem" class="form-control" value="25" min="5" max="60" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                `,
                calculate: () => {
                    const consumo = parseFloat(document.getElementById("solar-consumo")?.value) || 1200;
                    const tarifa = parseFloat(document.getElementById("solar-tarifa")?.value) || 0.95;
                    const hsp = parseFloat(document.getElementById("solar-hsp")?.value) || 4.8;
                    const taxaRede = parseFloat(document.getElementById("solar-ligacao")?.value) || 100;
                    const potMod = parseFloat(document.getElementById("solar-pot-modulo")?.value) || 550;
                    const margem = parseFloat(document.getElementById("solar-margem")?.value) || 25;

                    // Potência necessária = (Consumo - TaxaRede) / (30 * HSP * PerformanceRatio 0.78)
                    const consumoCompensavel = Math.max(0, consumo - taxaRede);
                    const potKwp = consumoCompensavel / (30 * hsp * 0.78);
                    const qtdModulos = Math.max(2, Math.ceil((potKwp * 1000) / potMod));
                    const potRealKwp = (qtdModulos * potMod) / 1000;
                    const geracaoMensal = potRealKwp * 30 * hsp * 0.78;
                    const areaTelhado = Math.round(qtdModulos * 2.4);

                    // Custos
                    const custoEquipamentos = potRealKwp * 2200; // R$ 2.200/kWp de kit gerador
                    const custoEngInstalacao = potRealKwp * 800 + 1500; // Instalação + Homologação
                    const custoTotal = custoEquipamentos + custoEngInstalacao;

                    const divisor = 1 - (0.08) - (margem / 100); // 8% impostos
                    const suggestedPrice = divisor > 0 ? (custoTotal / divisor) : (custoTotal * 1.5);

                    const economiaMensal = Math.min(consumo * tarifa, geracaoMensal * tarifa * 0.90);
                    const economiaAnual = economiaMensal * 12;
                    const paybackAnos = economiaAnual > 0 ? (suggestedPrice / economiaAnual).toFixed(1) : "N/A";

                    return {
                        suggestedPrice,
                        priceDetail: `Kit Gerador Fotovoltaico de ${potRealKwp.toFixed(2)} kWp Completo`,
                        kpis: [
                            { label: "Potência do Sistema", value: `${potRealKwp.toFixed(2)} kWp`, color: "#f59e0b" },
                            { label: "Qtd. de Módulos", value: `${qtdModulos} placas (${potMod}W)`, color: "var(--primary)" },
                            { label: "Geração Estimada", value: `${Math.round(geracaoMensal)} kWh/mês`, color: "#10b981" },
                            { label: "Payback Estimado", value: `${paybackAnos} anos`, color: "#8b5cf6" }
                        ],
                        breakdown: [
                            { label: "Área de telhado necessária", value: `~${areaTelhado} m²` },
                            { label: "Custo Equipamentos (Inversor + Painéis)", value: Calculators.formatCurrency(custoEquipamentos) },
                            { label: "Instalação & Homologação na Concessionária", value: Calculators.formatCurrency(custoEngInstalacao) },
                            { label: "Economia Anual Estimada", value: Calculators.formatCurrency(economiaAnual), highlight: true }
                        ]
                    };
                }
            },

            // 2. GESTÃO DE ETE (TRATAMENTO DE EFLUENTES)
            ete: {
                title: "Gestão e Operação de ETE",
                subtitle: "Estações de tratamento com dosagem química, operação e laudos laboratoriais",
                icon: "💧",
                color: "#0284c7",
                renderInputsHtml: () => `
                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Lead / Cliente</label>
                        <select id="calc-input-lead" class="form-control" style="height: 38px; font-size: 13px;">${leadOptionsHtml}</select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Vazão de Efluente (m³/dia)</label>
                            <input type="number" id="ete-vazao" class="form-control" value="60" min="5" step="5" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Tipo de Efluente</label>
                            <select id="ete-tipo" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="sanitario">Sanitário / Doméstico</option>
                                <option value="alimenticio" selected>Industrial Alimentício (Alta DBO)</option>
                                <option value="quimico">Industrial Químico / Metalúrgico</option>
                                <option value="galvanico">Galvânico (Metais Pesados)</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Visitas Técnicas / Mês</label>
                            <select id="ete-visitas" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="2">2 visitas mensais (Quinzenal)</option>
                                <option value="4" selected>4 visitas mensais (Semanal)</option>
                                <option value="8">8 visitas mensais (2x/semana)</option>
                                <option value="22">Operador Residente (Diário)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Análises Laboratoriais / Mês</label>
                            <input type="number" id="ete-analises" class="form-control" value="4" min="1" max="30" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Descarte de Lodo (m³/mês)</label>
                            <input type="number" id="ete-lodo" class="form-control" value="10" min="0" step="2" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Margem Comercial (%)</label>
                            <input type="number" id="ete-margem" class="form-control" value="35" min="10" max="60" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                `,
                calculate: () => {
                    const vazao = parseFloat(document.getElementById("ete-vazao")?.value) || 60;
                    const tipo = document.getElementById("ete-tipo")?.value || "alimenticio";
                    const visitas = parseInt(document.getElementById("ete-visitas")?.value) || 4;
                    const analises = parseInt(document.getElementById("ete-analises")?.value) || 4;
                    const lodo = parseFloat(document.getElementById("ete-lodo")?.value) || 10;
                    const margem = parseFloat(document.getElementById("ete-margem")?.value) || 35;

                    let multQuimico = 1.0;
                    if (tipo === "alimenticio") multQuimico = 1.4;
                    if (tipo === "quimico") multQuimico = 1.8;
                    if (tipo === "galvanico") multQuimico = 2.4;

                    const custoQuimicos = vazao * 30 * 1.80 * multQuimico;
                    const custoVisitas = visitas * 450; // R$ 450/visita de químico/técnico
                    const custoAnalises = analises * 380; // R$ 380/amostra acreditada
                    const custoLodo = lodo * 180; // R$ 180/m³ transporte + descarte
                    const custoFixoAdmin = 800;

                    const custoTotalMensal = custoQuimicos + custoVisitas + custoAnalises + custoLodo + custoFixoAdmin;
                    const divisor = 1 - 0.10 - (margem / 100);
                    const suggestedPrice = divisor > 0 ? (custoTotalMensal / divisor) : (custoTotalMensal * 1.5);

                    return {
                        suggestedPrice,
                        priceDetail: `Contrato Mensal de Operação e Gestão de ETE (${vazao} m³/dia)`,
                        kpis: [
                            { label: "Vazão Mensal Total", value: `${(vazao * 30).toLocaleString()} m³/mês`, color: "#0284c7" },
                            { label: "Visitas Especializadas", value: `${visitas} visitas/mês`, color: "var(--primary)" },
                            { label: "Análises de Conformidade", value: `${analises} laudos/mês`, color: "#10b981" },
                            { label: "Valor Anual do Contrato", value: Calculators.formatCurrency(suggestedPrice * 12), color: "#8b5cf6" }
                        ],
                        breakdown: [
                            { label: "Reagentes Químicos (Coagulante/Polímero/Neutralizante)", value: Calculators.formatCurrency(custoQuimicos) },
                            { label: "Equipe Técnica e Visitas Operacionais", value: Calculators.formatCurrency(custoVisitas) },
                            { label: "Laboratório Acreditado (CONAMA/Órgão)", value: Calculators.formatCurrency(custoAnalises) },
                            { label: "Destinação de Lodo e Resíduos ETE", value: Calculators.formatCurrency(custoLodo) }
                        ]
                    };
                }
            },

            // 3. CONSULTORIA & LICENCIAMENTO AMBIENTAL
            licensing: {
                title: "Consultoria e Licenciamento Ambiental",
                subtitle: "Elaboração de estudos ambientais (PGRS, PCA, EIA/RIMA), licenças LP/LI/LO e ART",
                icon: "🌿",
                color: "#10b981",
                renderInputsHtml: () => `
                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Lead / Cliente</label>
                        <select id="calc-input-lead" class="form-control" style="height: 38px; font-size: 13px;">${leadOptionsHtml}</select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Tipo de Processo / Licença</label>
                            <select id="lic-tipo" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="LO" selected>Licença de Operação (LO)</option>
                                <option value="LP_LI">Licença Prévia e de Instalação (LP + LI)</option>
                                <option value="Renovacao">Renovação de Licença Ambiental</option>
                                <option value="PGRS">Plano de Gestão de Resíduos (PGRS)</option>
                                <option value="EIA_RIMA">Estudo de Impacto Ambiental (EIA/RIMA)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Porte do Empreendimento</label>
                            <select id="lic-porte" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="1">Pequeno Porte</option>
                                <option value="1.6" selected>Médio Porte</option>
                                <option value="2.5">Grande Porte / Alto Potencial</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Horas de Engenharia / Consultoria</label>
                            <input type="number" id="lic-horas" class="form-control" value="40" min="10" step="5" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Vistorias de Campo</label>
                            <input type="number" id="lic-vistorias" class="form-control" value="2" min="1" max="10" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Taxas de ART / Protocolo (R$)</label>
                            <input type="number" id="lic-taxas" class="form-control" value="450" min="100" step="50" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Margem de Lucro (%)</label>
                            <input type="number" id="lic-margem" class="form-control" value="40" min="10" max="70" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                `,
                calculate: () => {
                    const tipo = document.getElementById("lic-tipo")?.value || "LO";
                    const porte = parseFloat(document.getElementById("lic-porte")?.value) || 1.6;
                    const horas = parseFloat(document.getElementById("lic-horas")?.value) || 40;
                    const vistorias = parseInt(document.getElementById("lic-vistorias")?.value) || 2;
                    const taxas = parseFloat(document.getElementById("lic-taxas")?.value) || 450;
                    const margem = parseFloat(document.getElementById("lic-margem")?.value) || 40;

                    const valorHoraEng = 160; // R$ 160/hora de especialista
                    const custoHoras = horas * valorHoraEng * porte;
                    const custoVistorias = vistorias * 600; // R$ 600 vistoria + deslocamento
                    const custoEstudos = tipo === "EIA_RIMA" ? 8000 : tipo === "LP_LI" ? 3500 : 1500;

                    const custoTotal = custoHoras + custoVistorias + custoEstudos + taxas;
                    const divisor = 1 - 0.08 - (margem / 100);
                    const suggestedPrice = divisor > 0 ? (custoTotal / divisor) : (custoTotal * 1.6);

                    return {
                        suggestedPrice,
                        priceDetail: `Consultoria Completa para Processo de ${tipo}`,
                        kpis: [
                            { label: "Horas de Consultoria", value: `${Math.round(horas * porte)}h técnicas`, color: "#10b981" },
                            { label: "Vistorias Técnicas", value: `${vistorias} in loco`, color: "var(--primary)" },
                            { label: "Emissão de ART", value: "Inclusa (CREA)", color: "#f59e0b" },
                            { label: "Prazo Estimado", value: "30 a 60 dias", color: "#8b5cf6" }
                        ],
                        breakdown: [
                            { label: "Elaboração Técnica de Laudos e Estudos", value: Calculators.formatCurrency(custoHoras + custoEstudos) },
                            { label: "Vistorias de Campo e Amostragens", value: Calculators.formatCurrency(custoVistorias) },
                            { label: "Taxas de ART e Custos Administrativos", value: Calculators.formatCurrency(taxas) }
                        ]
                    };
                }
            },

            // 4. TRANSPORTE E DESTINAÇÃO DE RESÍDUOS
            waste: {
                title: "Transporte e Destinação de Resíduos",
                subtitle: "Logística reversa, MTR, coprocessamento e destinação final de resíduos Classe I e II",
                icon: "🚛",
                color: "#ea580c",
                renderInputsHtml: () => `
                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Lead / Cliente</label>
                        <select id="calc-input-lead" class="form-control" style="height: 38px; font-size: 13px;">${leadOptionsHtml}</select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Classificação do Resíduo</label>
                            <select id="waste-classe" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="I" selected>Classe I (Perigoso / Químico)</option>
                                <option value="IIA">Classe II A (Não Inerte / Orgânico)</option>
                                <option value="IIB">Classe II B (Inerte / Entulho)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Volume / Peso (Toneladas)</label>
                            <input type="number" id="waste-toneladas" class="form-control" value="15" min="1" step="1" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Distância Ida/Volta (km)</label>
                            <input type="number" id="waste-distancia" class="form-control" value="180" min="10" step="10" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Tipo de Destinação</label>
                            <select id="waste-destinacao" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="coprocessamento" selected>Coprocessamento (Forno Clinker)</option>
                                <option value="aterro">Aterro Industrial Licenciado</option>
                                <option value="incineracao">Incineração Térmica</option>
                                <option value="reciclagem">Reciclagem / Valorização</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">MTR / Documentação SINIR (R$)</label>
                            <input type="number" id="waste-mtr" class="form-control" value="250" min="50" step="50" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Margem Comercial (%)</label>
                            <input type="number" id="waste-margem" class="form-control" value="30" min="10" max="60" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                `,
                calculate: () => {
                    const classe = document.getElementById("waste-classe")?.value || "I";
                    const toneladas = parseFloat(document.getElementById("waste-toneladas")?.value) || 15;
                    const distancia = parseFloat(document.getElementById("waste-distancia")?.value) || 180;
                    const destinacao = document.getElementById("waste-destinacao")?.value || "coprocessamento";
                    const mtr = parseFloat(document.getElementById("waste-mtr")?.value) || 250;
                    const margem = parseFloat(document.getElementById("waste-margem")?.value) || 30;

                    // Custo por tonelada de destinação
                    let precoDestinacaoTon = 320;
                    if (classe === "I") precoDestinacaoTon = destinacao === "incineracao" ? 850 : 450;
                    else if (classe === "IIA") precoDestinacaoTon = 180;
                    else precoDestinacaoTon = 90;

                    const custoDestinacao = toneladas * precoDestinacaoTon;
                    const precoKmFrete = classe === "I" ? 8.5 : 6.0; // Frete com MOPP e licença ambiental
                    const viagens = Math.ceil(toneladas / 12); // Capacidade de 12t por caminhão roll-on
                    const custoFrete = distancia * precoKmFrete * viagens;

                    const custoTotal = custoDestinacao + custoFrete + mtr;
                    const divisor = 1 - 0.10 - (margem / 100);
                    const suggestedPrice = divisor > 0 ? (custoTotal / divisor) : (custoTotal * 1.5);

                    return {
                        suggestedPrice,
                        priceDetail: `Lote de Transporte & Destinação (${toneladas}t - Classe ${classe})`,
                        kpis: [
                            { label: "Peso Total", value: `${toneladas} toneladas`, color: "#ea580c" },
                            { label: "Viagens Necessárias", value: `${viagens} carga(s)`, color: "var(--primary)" },
                            { label: "Destinação", value: destinacao.toUpperCase(), color: "#10b981" },
                            { label: "Preço Médio / Tonelada", value: Calculators.formatCurrency(suggestedPrice / toneladas), color: "#8b5cf6" }
                        ],
                        breakdown: [
                            { label: "Custo de Destinação Final / Coprocessamento", value: Calculators.formatCurrency(custoDestinacao) },
                            { label: "Frete Especializado com Licença Ambiental", value: Calculators.formatCurrency(custoFrete) },
                            { label: "Emissão de MTR / SINIR e Certificado CDF", value: Calculators.formatCurrency(mtr) }
                        ]
                    };
                }
            },

            // 5. INSPEÇÃO DE SEGURANÇA NR-13
            nr13: {
                title: "Inspeção de Segurança NR-13",
                subtitle: "Inspeção técnica de vasos de pressão, caldeiras, ultrassom, teste hidrostático e ART",
                icon: "⚙️",
                color: "#e11d48",
                renderInputsHtml: () => `
                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Lead / Cliente</label>
                        <select id="calc-input-lead" class="form-control" style="height: 38px; font-size: 13px;">${leadOptionsHtml}</select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Vasos de Pressão (Compressor, Pulmão)</label>
                            <input type="number" id="nr13-vasos" class="form-control" value="6" min="0" step="1" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Caldeiras a Vapor</label>
                            <input type="number" id="nr13-caldeiras" class="form-control" value="1" min="0" step="1" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Calibração Válvulas PSV / Manômetros</label>
                            <input type="number" id="nr13-valvulas" class="form-control" value="8" min="0" step="1" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Medição de Espessura Ultrassom (MEU)</label>
                            <select id="nr13-ultrassom" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="sim" selected>Sim (Ensaios Não Destrutivos)</option>
                                <option value="nao">Não (Apenas Exame Visual)</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Deslocamento Técnico (km)</label>
                            <input type="number" id="nr13-km" class="form-control" value="80" min="0" step="10" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Margem de Lucro (%)</label>
                            <input type="number" id="nr13-margem" class="form-control" value="45" min="15" max="70" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                `,
                calculate: () => {
                    const vasos = parseInt(document.getElementById("nr13-vasos")?.value) || 0;
                    const caldeiras = parseInt(document.getElementById("nr13-caldeiras")?.value) || 0;
                    const valvulas = parseInt(document.getElementById("nr13-valvulas")?.value) || 0;
                    const ultrassom = document.getElementById("nr13-ultrassom")?.value === "sim";
                    const km = parseFloat(document.getElementById("nr13-km")?.value) || 80;
                    const margem = parseFloat(document.getElementById("nr13-margem")?.value) || 45;

                    const custoVasos = vasos * (ultrassom ? 450 : 300);
                    const custoCaldeiras = caldeiras * (ultrassom ? 2400 : 1600);
                    const custoValvulas = valvulas * 140; // Calibração de bancada
                    const custoDeslocamento = km * 2.5 + 200;
                    const custoArt = 350; // ART CREA Profissional Habilitado (PH)

                    const custoTotal = custoVasos + custoCaldeiras + custoValvulas + custoDeslocamento + custoArt;
                    const divisor = 1 - 0.08 - (margem / 100);
                    const suggestedPrice = divisor > 0 ? (custoTotal / divisor) : (custoTotal * 1.6);

                    return {
                        suggestedPrice,
                        priceDetail: `Laudo Técnico & ART NR-13 (${vasos} Vasos + ${caldeiras} Caldeiras)`,
                        kpis: [
                            { label: "Total de Equipamentos", value: `${vasos + caldeiras} unidades`, color: "#e11d48" },
                            { label: "Válvulas Calibradas", value: `${valvulas} PSV`, color: "var(--primary)" },
                            { label: "Responsabilidade", value: "Eng. Mecânico (PH)", color: "#10b981" },
                            { label: "Livro de Registro", value: "Incluso e Atualizado", color: "#8b5cf6" }
                        ],
                        breakdown: [
                            { label: "Inspeção e Ultrassom de Vasos de Pressão", value: Calculators.formatCurrency(custoVasos) },
                            { label: "Inspeção e Testes em Caldeiras a Vapor", value: Calculators.formatCurrency(custoCaldeiras) },
                            { label: "Calibração e Teste de Estanqueidade de PSVs", value: Calculators.formatCurrency(custoValvulas) },
                            { label: "Emissão de ART CREA e Relatório Conclusivo", value: Calculators.formatCurrency(custoArt) }
                        ]
                    };
                }
            },

            // 6. ESG & INVENTÁRIO DE CARBONO
            esg: {
                title: "ESG & Inventário de Carbono (GHG)",
                subtitle: "Inventário corporativo de gases de efeito estufa (Escopos 1, 2 e 3) e relatório de sustentabilidade",
                icon: "🌍",
                color: "#8b5cf6",
                renderInputsHtml: () => `
                    <div class="form-group">
                        <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Lead / Cliente</label>
                        <select id="calc-input-lead" class="form-control" style="height: 38px; font-size: 13px;">${leadOptionsHtml}</select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Nº de Colaboradores / Unidades</label>
                            <input type="number" id="esg-porte" class="form-control" value="150" min="10" step="10" style="height: 38px; font-size: 13px; font-weight: 700;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Escopos Inclusos</label>
                            <select id="esg-escopos" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="1_2">Escopo 1 e 2 (Diretas + Energia)</option>
                                <option value="1_2_3" selected>Escopo 1, 2 e 3 (Completo + Cadeia)</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Consumo Combustível (Litros/Ano)</label>
                            <input type="number" id="esg-combustivel" class="form-control" value="25000" min="1000" step="5000" style="height: 38px; font-size: 13px;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Consumo Energia (MWh/Ano)</label>
                            <input type="number" id="esg-energia" class="form-control" value="350" min="10" step="50" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Metodologia / Relatório</label>
                            <select id="esg-metodologia" class="form-control" style="height: 38px; font-size: 13px;">
                                <option value="ghg" selected>GHG Protocol Programa Brasileiro</option>
                                <option value="gri">GHG Protocol + Relatório GRI Padrão</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; display: block;">Margem Comercial (%)</label>
                            <input type="number" id="esg-margem" class="form-control" value="40" min="15" max="70" style="height: 38px; font-size: 13px;">
                        </div>
                    </div>
                `,
                calculate: () => {
                    const porte = parseInt(document.getElementById("esg-porte")?.value) || 150;
                    const escopos = document.getElementById("esg-escopos")?.value || "1_2_3";
                    const combustivel = parseFloat(document.getElementById("esg-combustivel")?.value) || 25000;
                    const energia = parseFloat(document.getElementById("esg-energia")?.value) || 350;
                    const metodologia = document.getElementById("esg-metodologia")?.value || "ghg";
                    const margem = parseFloat(document.getElementById("esg-margem")?.value) || 40;

                    // Fatores de emissão médios (tCO2e)
                    const emissoesEscopo1 = (combustivel * 2.6) / 1000; // ~2.6 kg CO2e / litro diesel
                    const emissoesEscopo2 = energia * 0.05; // ~0.05 tCO2e / MWh SIN Brasil
                    const emissoesEscopo3 = escopos === "1_2_3" ? (porte * 1.2) : 0;
                    const totalTco2e = Math.round(emissoesEscopo1 + emissoesEscopo2 + emissoesEscopo3);

                    // Horas de auditoria e cálculo
                    let horasConsultoria = 45;
                    if (porte > 100) horasConsultoria += 25;
                    if (escopos === "1_2_3") horasConsultoria += 30;
                    if (metodologia === "gri") horasConsultoria += 35;

                    const custoHoras = horasConsultoria * 180;
                    const custoSoftwareGhg = 2200; // Licença e base de fatores
                    const custoTotal = custoHoras + custoSoftwareGhg;

                    const divisor = 1 - 0.08 - (margem / 100);
                    const suggestedPrice = divisor > 0 ? (custoTotal / divisor) : (custoTotal * 1.6);

                    return {
                        suggestedPrice,
                        priceDetail: `Inventário de Emissões GHG Protocol (${totalTco2e} tCO2e Estimadas)`,
                        kpis: [
                            { label: "Emissões Estimadas", value: `${totalTco2e} tCO2e/ano`, color: "#8b5cf6" },
                            { label: "Créditos para Neutralizar", value: `${totalTco2e} créditos`, color: "#10b981" },
                            { label: "Horas de Consultoria", value: `${horasConsultoria} horas`, color: "var(--primary)" },
                            { label: "Padrão Internacional", value: "GHG Protocol Brasil", color: "#f59e0b" }
                        ],
                        breakdown: [
                            { label: "Mapeamento e Cálculo de Emissões Escopos 1, 2 e 3", value: Calculators.formatCurrency(custoHoras) },
                            { label: "Base de Dados e Modelagem de Fatores GHG", value: Calculators.formatCurrency(custoSoftwareGhg) },
                            { label: "Elaboração do Plano de Descarbonização & Metas", value: "Incluso no Escopo" }
                        ]
                    };
                }
            }
        };

        return configs[type] || null;
    }
};
