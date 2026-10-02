import { Store } from "./store.js";
import { Auth } from "./auth.js";

let currentEditingContractId = null;

export const Contracts = {
    _eventsBound: false,

    init() {
        if (!this._eventsBound) {
            this.bindEvents();
            this._eventsBound = true;
        }
        this.populateClientsDatalist();
        this.checkRenewals();
        this.renderTable();
    },

    bindEvents() {
        // Botão Novo Contrato (Abre tela completa no padrão GestãoClick)
        const btnNewContract = document.getElementById("btn-new-contract");
        if (btnNewContract) btnNewContract.addEventListener("click", () => this.openContractScreen());

        // Controles da tela GestãoClick de Contrato
        const btnBack = document.getElementById("gc-contract-btn-back");
        if (btnBack) btnBack.addEventListener("click", () => this.closeContractScreen());

        const btnCancel = document.getElementById("gc-contract-btn-cancel");
        if (btnCancel) btnCancel.addEventListener("click", () => this.closeContractScreen());

        const btnSubmit = document.getElementById("gc-contract-btn-submit");
        if (btnSubmit) btnSubmit.addEventListener("click", () => this.saveContractFromScreen(false));

        const btnSubmitPdf = document.getElementById("gc-contract-btn-submit-pdf");
        if (btnSubmitPdf) btnSubmitPdf.addEventListener("click", () => this.saveContractFromScreen(true));

        const btnAddService = document.getElementById("gc-contract-btn-add-service");
        if (btnAddService) btnAddService.addEventListener("click", () => this.addServiceRow());

        const btnEditNumber = document.getElementById("gc-contract-btn-edit-number");
        if (btnEditNumber) {
            btnEditNumber.addEventListener("click", () => {
                const numInput = document.getElementById("gc-contract-number");
                if (numInput) {
                    numInput.readOnly = false;
                    numInput.classList.remove("gc-input-readonly");
                    numInput.focus();
                }
            });
        }

        const btnClearSeller = document.getElementById("gc-contract-btn-clear-seller");
        if (btnClearSeller) {
            btnClearSeller.addEventListener("click", () => {
                const sellerInput = document.getElementById("gc-contract-seller");
                if (sellerInput) sellerInput.value = "";
            });
        }

        const startDateInput = document.getElementById("gc-contract-start-date");
        if (startDateInput) {
            startDateInput.addEventListener("change", (e) => {
                const endDateInput = document.getElementById("gc-contract-end-date");
                if (endDateInput && e.target.value) {
                    const d = new Date(e.target.value + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    endDateInput.value = d.toISOString().split("T")[0];
                    this.recalculateTotals();
                }
            });
        }

        const endDateInput = document.getElementById("gc-contract-end-date");
        if (endDateInput) {
            endDateInput.addEventListener("change", () => this.recalculateTotals());
        }

        // Minuta IA na tela GestãoClick
        const btnGenerateAI = document.getElementById("gc-contract-btn-generate-ai");
        if (btnGenerateAI) btnGenerateAI.addEventListener("click", () => this.generateDraftFromScreen());

        const btnCopyDraft = document.getElementById("gc-contract-btn-copy-draft");
        if (btnCopyDraft) {
            btnCopyDraft.addEventListener("click", () => {
                const editor = document.getElementById("gc-contract-draft-editor");
                if (editor && editor.value) {
                    navigator.clipboard.writeText(editor.value);
                    alert("📋 Minuta do contrato copiada para a área de transferência!");
                }
            });
        }

        const btnExportPDF = document.getElementById("gc-contract-btn-export-pdf");
        if (btnExportPDF) {
            btnExportPDF.addEventListener("click", () => {
                const editor = document.getElementById("gc-contract-draft-editor");
                if (editor && editor.value) {
                    this.exportContractDraftPDF(editor.value);
                } else {
                    alert("Gere ou preencha a minuta antes de exportar.");
                }
            });
        }

        const btnSelectFile = document.getElementById("gc-contract-btn-select-file");
        const fileInput = document.getElementById("gc-contract-files");
        if (btnSelectFile && fileInput) {
            btnSelectFile.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", (e) => {
                const countEl = document.getElementById("gc-contract-files-count");
                if (countEl && e.target.files) {
                    countEl.textContent = `${e.target.files.length} arquivo(s) selecionado(s)`;
                }
            });
        }

        // Filtros da tabela
        const searchInput = document.getElementById("contracts-search");
        const filterStatus = document.getElementById("contracts-filter-status");
        if (searchInput) searchInput.addEventListener("input", () => this.renderTable());
        if (filterStatus) filterStatus.addEventListener("change", () => this.renderTable());

        // Modais legados (mantidos para compatibilidade)
        const btnCloseModal = document.getElementById("btn-close-contract-modal");
        const btnCancelContract = document.getElementById("btn-cancel-contract");
        const contractForm = document.getElementById("contract-form");
        if (btnCloseModal) btnCloseModal.addEventListener("click", () => this.closeModal());
        if (btnCancelContract) btnCancelContract.addEventListener("click", () => this.closeModal());
        if (contractForm) {
            contractForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveContract();
            });
        }
    },

    populateClientsDatalist() {
        const datalist = document.getElementById("gc-contract-clients-datalist");
        if (!datalist) return;
        const leads = Store.getLeads ? Store.getLeads() : [];
        const contracts = Store.getContracts ? Store.getContracts() : [];
        const names = new Set();
        leads.forEach(l => { if (l.company) names.add(l.company.trim()); });
        contracts.forEach(c => { 
            const lead = leads.find(l => l.id === c.leadId);
            if (lead && lead.company) names.add(lead.company.trim());
        });
        datalist.innerHTML = Array.from(names).map(name => `<option value="${name}"></option>`).join("");
    },

    openContractScreen(contractId = null, leadData = null) {
        currentEditingContractId = contractId;
        this.populateClientsDatalist();

        const titleEl = document.getElementById("gc-contract-title-action");
        const breadcrumbEl = document.getElementById("gc-contract-breadcrumb-action");
        const submitBtn = document.getElementById("gc-contract-btn-submit");

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined && val !== null ? val : "";
        };

        const todayStr = new Date().toISOString().split("T")[0];
        const nextYearDate = new Date();
        nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
        const nextYearStr = nextYearDate.toISOString().split("T")[0];

        const currentUser = Auth.getCurrentUser();

        if (contractId) {
            const contract = Store.getContractById(contractId);
            if (!contract) return;

            if (titleEl) titleEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Editar contrato</span>
            `;
            if (breadcrumbEl) breadcrumbEl.textContent = "Editar";
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Salvar alterações</span>
                `;
            }

            const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);
            const lead = leads.find(l => l.id === contract.leadId);

            setVal("gc-contract-id", contract.id);
            setVal("gc-contract-number", contract.number);
            setVal("gc-contract-client", lead ? lead.company : "");
            setVal("gc-contract-seller", contract.owner || contract.createdBy || currentUser?.name || "San Charles");
            setVal("gc-contract-status", contract.status || "Ativo");
            setVal("gc-contract-start-date", contract.startDate || todayStr);
            setVal("gc-contract-end-date", contract.endDate || nextYearStr);
            setVal("gc-contract-periodicity", contract.periodicity || "Mensal");
            setVal("gc-contract-due-day", contract.dueDay || "10");
            setVal("gc-contract-payment-method", contract.paymentMethod || "Boleto Bancário");
            setVal("gc-contract-warning-days", contract.warningDays || 30);
            setVal("gc-contract-object", contract.notes || contract.object || "Prestação de Serviços de Engenharia Ambiental e Monitoramento");
            setVal("gc-contract-notes", contract.clientNotes || contract.notes || "");
            setVal("gc-contract-internal-notes", contract.internalNotes || "");

            const checkAutoRenew = document.getElementById("gc-contract-auto-renew");
            if (checkAutoRenew) checkAutoRenew.checked = contract.autoRenew !== false;

            // Carregar serviços vinculados
            const tbody = document.getElementById("gc-contract-services-tbody");
            if (tbody) tbody.innerHTML = "";
            const services = Store.getServicesForContract ? Store.getServicesForContract(contract.id) : [];
            if (services && services.length > 0) {
                services.forEach(s => this.addServiceRow(s));
            } else {
                this.addServiceRow({
                    service: contract.service || "Licenciamento e Consultoria Ambiental",
                    details: contract.notes || "Monitoramento Periódico",
                    qty: 1,
                    price: contract.recurringValue || (contract.totalValue ? (contract.totalValue / 12) : 0),
                    discount: 0
                });
            }

            // Minuta
            if (contract.draftText) {
                setVal("gc-contract-draft-editor", contract.draftText);
            }

        } else {
            // Novo Contrato
            if (titleEl) titleEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span>Adicionar contrato</span>
            `;
            if (breadcrumbEl) breadcrumbEl.textContent = "Adicionar";
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Salvar contrato</span>
                `;
            }

            const totalExisting = (Store.getContracts ? Store.getContracts().length : 0) + 1;
            const nextNumber = `CT-${new Date().getFullYear()}-${String(totalExisting).padStart(3, '0')}`;

            setVal("gc-contract-id", "");
            setVal("gc-contract-number", nextNumber);
            setVal("gc-contract-client", leadData?.company || "");
            setVal("gc-contract-seller", currentUser?.name || "San Charles");
            setVal("gc-contract-status", "Em formalização");
            setVal("gc-contract-start-date", todayStr);
            setVal("gc-contract-end-date", nextYearStr);
            setVal("gc-contract-periodicity", "Mensal");
            setVal("gc-contract-due-day", "10");
            setVal("gc-contract-payment-method", "Boleto Bancário");
            setVal("gc-contract-warning-days", "30");
            setVal("gc-contract-object", "Prestação de Serviços Contínuos de Consultoria Ambiental, Emissões Atmosféricas e Laudos Técnicos.");
            setVal("gc-contract-notes", "Condições gerais de prestação dos serviços e acompanhamento técnico.");
            setVal("gc-contract-internal-notes", "");

            const checkAutoRenew = document.getElementById("gc-contract-auto-renew");
            if (checkAutoRenew) checkAutoRenew.checked = true;

            const tbody = document.getElementById("gc-contract-services-tbody");
            if (tbody) tbody.innerHTML = "";
            this.addServiceRow({
                service: "Licenciamento e Consultoria Ambiental",
                details: "Acompanhamento mensal de condicionantes ambientais",
                qty: 1,
                price: 1500,
                discount: 0
            });

            setVal("gc-contract-draft-editor", "");
        }

        // Alternar visualização
        const listContainer = document.getElementById("contracts-list-container");
        const contractView = document.getElementById("gestaoclick-contract-view");
        if (listContainer) listContainer.style.display = "none";
        if (contractView) contractView.style.display = "block";

        this.recalculateTotals();
        window.scrollTo({ top: 0, behavior: "smooth" });
    },

    closeContractScreen() {
        const listContainer = document.getElementById("contracts-list-container");
        const contractView = document.getElementById("gestaoclick-contract-view");
        if (contractView) contractView.style.display = "none";
        if (listContainer) listContainer.style.display = "block";
        this.renderTable();
    },

    addServiceRow(data = null) {
        const tbody = document.getElementById("gc-contract-services-tbody");
        if (!tbody) return;

        const defaultService = data?.service || "Licenciamento e Consultoria Ambiental";
        const defaultDetails = data?.details || "";
        const defaultQty = data?.qty || 1;
        const defaultPrice = parseFloat(data?.price || 0);
        const defaultDiscount = parseFloat(data?.discount || 0);
        const subtotal = Math.max(0, (defaultPrice * defaultQty) - defaultDiscount);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <select class="gc-select gc-service-select" style="font-size: 12.5px;">
                    <option value="Licenciamento e Consultoria Ambiental">Licenciamento & Consultoria Ambiental</option>
                    <option value="Amostragem Isocinética de Chaminé">Amostragem Isocinética de Chaminé</option>
                    <option value="Inspeção NR-13 (Caldeiras e Vasos)">Inspeção NR-13 (Caldeiras e Vasos)</option>
                    <option value="Laudo NR-12 (Segurança de Máquinas)">Laudo NR-12 (Segurança de Máquinas)</option>
                    <option value="PGR / PCMSO / Meio Ambiente">PGR / PCMSO / Meio Ambiente</option>
                    <option value="Laudo Elétrico NR-10 e SPDA">Laudo Elétrico NR-10 e SPDA</option>
                    <option value="Medição de Ruído e Poluentes">Medição de Ruído e Poluentes</option>
                    <option value="Outros Serviços Técnicos">Outros Serviços Técnicos</option>
                </select>
            </td>
            <td>
                <input type="text" class="gc-input gc-service-details" placeholder="Escopo do serviço..." value="${defaultDetails}">
            </td>
            <td>
                <input type="number" class="gc-input gc-service-qty" min="1" value="${defaultQty}" style="text-align: center;">
            </td>
            <td>
                <input type="number" step="0.01" class="gc-input gc-service-price" value="${defaultPrice.toFixed(2)}" style="text-align: right;">
            </td>
            <td>
                <input type="number" step="0.01" class="gc-input gc-service-discount" value="${defaultDiscount.toFixed(2)}" style="text-align: right;">
            </td>
            <td>
                <input type="text" class="gc-input gc-service-subtotal gc-input-readonly" value="R$ ${subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}" readonly style="text-align: right; font-weight: 600;">
            </td>
            <td style="text-align: center;">
                <button type="button" class="gc-btn-delete-row" title="Remover item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </td>
        `;

        const select = tr.querySelector(".gc-service-select");
        if (select) select.value = defaultService;

        const updateRowSubtotal = () => {
            const qty = parseFloat(tr.querySelector(".gc-service-qty")?.value) || 0;
            const price = parseFloat(tr.querySelector(".gc-service-price")?.value) || 0;
            const discount = parseFloat(tr.querySelector(".gc-service-discount")?.value) || 0;
            const sub = Math.max(0, (qty * price) - discount);
            const subInput = tr.querySelector(".gc-service-subtotal");
            if (subInput) subInput.value = `R$ ${sub.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            this.recalculateTotals();
        };

        tr.querySelector(".gc-service-qty")?.addEventListener("input", updateRowSubtotal);
        tr.querySelector(".gc-service-price")?.addEventListener("input", updateRowSubtotal);
        tr.querySelector(".gc-service-discount")?.addEventListener("input", updateRowSubtotal);

        tr.querySelector(".gc-btn-delete-row")?.addEventListener("click", () => {
            tr.remove();
            this.recalculateTotals();
        });

        tbody.appendChild(tr);
        this.recalculateTotals();
    },

    recalculateTotals() {
        const rows = document.querySelectorAll("#gc-contract-services-tbody tr");
        let totalMrr = 0;
        let totalDiscount = 0;

        rows.forEach(tr => {
            const qty = parseFloat(tr.querySelector(".gc-service-qty")?.value) || 0;
            const price = parseFloat(tr.querySelector(".gc-service-price")?.value) || 0;
            const discount = parseFloat(tr.querySelector(".gc-service-discount")?.value) || 0;
            const sub = Math.max(0, (qty * price) - discount);
            totalMrr += sub;
            totalDiscount += discount;
        });

        // Calcular meses de vigência
        const startStr = document.getElementById("gc-contract-start-date")?.value;
        const endStr = document.getElementById("gc-contract-end-date")?.value;
        let months = 12;

        if (startStr && endStr) {
            const d1 = new Date(startStr);
            const d2 = new Date(endStr);
            const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
            if (diffMonths > 0) months = diffMonths;
        }

        const totalTcv = totalMrr * months;

        const durationEl = document.getElementById("gc-contract-duration-months");
        if (durationEl) durationEl.value = `${months} meses`;

        const discountEl = document.getElementById("gc-contract-total-discount");
        if (discountEl) discountEl.value = `R$ ${totalDiscount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        const mrrEl = document.getElementById("gc-contract-total-mrr");
        if (mrrEl) mrrEl.value = `R$ ${totalMrr.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        const tcvEl = document.getElementById("gc-contract-total-tcv");
        if (tcvEl) tcvEl.value = `R$ ${totalTcv.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    },

    saveContractFromScreen(exportPdfAfter = false) {
        const clientName = document.getElementById("gc-contract-client")?.value.trim();
        if (!clientName) {
            alert("Por favor, preencha o nome do Cliente / Contratante.");
            document.getElementById("gc-contract-client")?.focus();
            return;
        }

        const id = document.getElementById("gc-contract-id")?.value;
        const number = document.getElementById("gc-contract-number")?.value;
        const seller = document.getElementById("gc-contract-seller")?.value;
        const status = document.getElementById("gc-contract-status")?.value || "Ativo";
        const startDate = document.getElementById("gc-contract-start-date")?.value;
        const endDate = document.getElementById("gc-contract-end-date")?.value;
        const periodicity = document.getElementById("gc-contract-periodicity")?.value;
        const dueDay = document.getElementById("gc-contract-due-day")?.value;
        const paymentMethod = document.getElementById("gc-contract-payment-method")?.value;
        const autoRenew = document.getElementById("gc-contract-auto-renew")?.checked;
        const warningDays = parseInt(document.getElementById("gc-contract-warning-days")?.value) || 30;
        const objectText = document.getElementById("gc-contract-object")?.value;
        const notes = document.getElementById("gc-contract-notes")?.value;
        const internalNotes = document.getElementById("gc-contract-internal-notes")?.value;
        const draftText = document.getElementById("gc-contract-draft-editor")?.value;

        // Serviços
        const rows = document.querySelectorAll("#gc-contract-services-tbody tr");
        const servicesList = [];
        let totalMrr = 0;

        rows.forEach(tr => {
            const service = tr.querySelector(".gc-service-select")?.value;
            const details = tr.querySelector(".gc-service-details")?.value;
            const qty = parseFloat(tr.querySelector(".gc-service-qty")?.value) || 1;
            const price = parseFloat(tr.querySelector(".gc-service-price")?.value) || 0;
            const discount = parseFloat(tr.querySelector(".gc-service-discount")?.value) || 0;
            const sub = Math.max(0, (qty * price) - discount);
            totalMrr += sub;
            servicesList.push({ service, details, qty, price, discount, subtotal: sub });
        });

        // Meses de vigência
        let months = 12;
        if (startDate && endDate) {
            const d1 = new Date(startDate);
            const d2 = new Date(endDate);
            const diff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
            if (diff > 0) months = diff;
        }
        const totalTcv = totalMrr * months;

        // Obter ou criar lead
        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);
        let lead = leads.find(l => l.company && l.company.toLowerCase() === clientName.toLowerCase());
        if (!lead) {
            lead = Store.createLead({
                company: clientName,
                contact: "Representante Comercial",
                source: "Contratos GestãoClick",
                stage: "Cliente Ativo"
            });
        }

        const user = Auth.getCurrentUser();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";

        const contractData = {
            leadId: lead.id,
            workspace: activeCompany,
            number: number || `CT-${new Date().getFullYear()}-001`,
            status: status,
            totalValue: totalTcv,
            recurringValue: totalMrr,
            startDate: startDate,
            endDate: endDate,
            periodicity: periodicity,
            dueDay: dueDay,
            paymentMethod: paymentMethod,
            autoRenew: autoRenew,
            warningDays: warningDays,
            notes: objectText,
            clientNotes: notes,
            internalNotes: internalNotes,
            draftText: draftText,
            servicesList: servicesList,
            owner: seller || user?.email || "sistema@vellia.com"
        };

        let savedContractId = id;
        if (id) {
            Store.updateContract(id, contractData, user ? user.email : 'sistema@vellia.com');
        } else {
            contractData.createdBy = user ? user.email : 'sistema@vellia.com';
            const created = Store.addContract(contractData);
            savedContractId = created.id;
        }

        // Salvar serviços associados para o contrato
        if (savedContractId && Store.getContractServices) {
            const allServices = Store.getContractServices().filter(s => s.contractId !== savedContractId);
            servicesList.forEach(s => {
                allServices.push({ ...s, contractId: savedContractId });
            });
            localStorage.setItem("comercial_contract_services", JSON.stringify(allServices));
        }

        alert("✅ Contrato salvo com sucesso no padrão GestãoClick!");

        if (exportPdfAfter && draftText) {
            this.exportContractDraftPDF(draftText, `Contrato_${number}.pdf`);
        }

        this.closeContractScreen();
    },

    async generateDraftFromScreen() {
        const clientName = document.getElementById("gc-contract-client")?.value || "Empresa Contratante";
        const number = document.getElementById("gc-contract-number")?.value || "CT-2026-001";
        const mrr = document.getElementById("gc-contract-total-mrr")?.value || "R$ 0,00";
        const tcv = document.getElementById("gc-contract-total-tcv")?.value || "R$ 0,00";
        const startDate = document.getElementById("gc-contract-start-date")?.value || "Data da assinatura";
        const endDate = document.getElementById("gc-contract-end-date")?.value || "12 meses";
        const objectText = document.getElementById("gc-contract-object")?.value || "Prestação de serviços contínuos de engenharia e consultoria técnica";
        const templateModel = document.getElementById("gc-contract-template-model")?.value || "ambiental";

        const editor = document.getElementById("gc-contract-draft-editor");
        const statusBadge = document.getElementById("gc-draft-status-badge");

        if (statusBadge) {
            statusBadge.className = "gc-badge gc-badge-warning";
            statusBadge.textContent = "Gerando minuta por IA...";
        }
        if (editor) {
            editor.value = "🤖 Redigindo minuta contratual jurídica com base nas regras empresariais... Aguarde...";
        }

        const prompt = `
Você é um Advogado Especialista em Direito Empresarial, Contratos B2B e Engenharia.
Crie um Instrumento Particular de Contrato de Prestação de Serviços Contínuos e Técnicos completo, formal e juridicamente válido.

DADOS DO CONTRATO:
- CONTRATADA: VEELUEN SOLUTIONS LTDA / VELLIA (Engenharia, Meio Ambiente e Consultoria)
- CONTRATANTE: "${clientName}"
- NÚMERO DO CONTRATO: "${number}"
- VALOR RECORRENTE MENSAL (MRR): "${mrr}"
- VALOR TOTAL ESTIMADO DO CONTRATO: "${tcv}"
- VIGÊNCIA: De ${startDate} até ${endDate}
- OBJETO DO CONTRATO: "${objectText}"
- MODELO ESPECÍFICO: "${templateModel === 'ambiental' ? 'Engenharia Ambiental e Monitoramento' : (templateModel === 'laudos' ? 'Inspeção Técnica de Caldeiras e Máquinas NR-13/NR-12' : 'Consultoria Técnica Contínua')}"

CLÁUSULAS OBRIGATÓRIAS:
1. INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS
2. CLÁUSULA PRIMEIRA - DO OBJETO E ESCOPO DOS SERVIÇOS
3. CLÁUSULA SEGUNDA - DA VIGÊNCIA E PRORROGAÇÃO
4. CLÁUSULA TERCEIRA - DO PREÇO E CONDIÇÕES DE PAGAMENTO
5. CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA
6. CLÁUSULA QUINTA - DAS OBRIGAÇÕES DA CONTRATANTE
7. CLÁUSULA SEXTA - DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)
8. CLÁUSULA SÉTIMA - DA RESCISÃO E MULTA PENAL
9. CLÁUSULA OITAVA - DO FORO DE ELEIÇÃO
10. FECHAMENTO COM CAMPOS PARA ASSINATURA DAS PARTES E 2 TESTEMUNHAS.

Retorne APENAS o texto completo e formal em Português do Brasil, pronto para emissão e assinatura.
`;

        try {
            const userApiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key");
            let res;

            if (userApiKey && userApiKey.trim()) {
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
                res = await fetch(directUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
            } else {
                res = await fetch("/api/gemini-proxy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "gemini-2.5-flash",
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
            }

            if (res.ok) {
                const data = await res.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (aiText && editor) {
                    editor.value = aiText.trim();
                    if (statusBadge) {
                        statusBadge.className = "gc-badge gc-badge-success";
                        statusBadge.textContent = "✨ Minuta gerada por IA (Gemini)";
                    }
                    return;
                }
            }
        } catch (e) {
            console.warn("Falha na chamada IA de minuta:", e);
        }

        // Fallback estruturado
        if (editor) {
            editor.value = `INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS Nº ${number}

CONTRATADA: VEELUEN SOLUTIONS LTDA, empresa especializada em engenharia, consultoria e meio ambiente.
CONTRATANTE: ${clientName}

CLÁUSULA PRIMEIRA - DO OBJETO:
O presente contrato tem por objeto a prestação de serviços técnicos continuados de ${objectText}.

CLÁUSULA SEGUNDA - DA VIGÊNCIA:
O presente contrato terá vigência de ${startDate} a ${endDate}, prorrogável automaticamente por mútuo acordo entre as partes.

CLÁUSULA TERCEIRA - DO PREÇO E CONDIÇÕES DE PAGAMENTO:
Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA o valor mensal de ${mrr}, com vencimento fixado no dia acordado via faturamento bancário.

CLÁUSULA QUARTA - DAS RESPONSABILIDADES:
A CONTRATADA obriga-se a disponibilizar corpo técnico devidamente qualificado e habilitado junto ao respectivo Conselho de Classe (CREA/CRQ).

CLÁUSULA QUINTA - DO FORO:
Para dirimir quaisquer controvérsias oriundas do presente instrumento, as partes elegem o Foro da Comarca de Recife/PE.

E por estarem justas e acordadas, firmam o presente instrumento em 2 (duas) vias de igual teor.

____________________________________
VEELUEN SOLUTIONS LTDA (Contratada)

____________________________________
${clientName} (Contratante)

Testemunhas:
1. _______________________________ CPF:
2. _______________________________ CPF:`;
        }

        if (statusBadge) {
            statusBadge.className = "gc-badge gc-badge-info";
            statusBadge.textContent = "Minuta padrão pronta";
        }
    },

    checkRenewals() {
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        const contracts = Store.getContracts().filter(c => c.workspace === activeCompany && (c.status === "Ativo" || c.status === "Vencendo"));
        const today = new Date();
        
        contracts.forEach(c => {
            if (c.endDate) {
                const end = new Date(c.endDate);
                const diffTime = end - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Mudar status para 'Vencendo'
                if (diffDays <= c.warningDays && c.status === "Ativo") {
                    Store.updateContract(c.id, { status: "Vencendo" });
                    
                    // Criar tarefa comercial para o vendedor, se não existir
                    const userTasks = Store.getTasks ? Store.getTasks(c.owner) : [];
                    const taskText = `Renovar contrato ${c.number} (vence em ${diffDays} dias)`;
                    
                    if (!userTasks.some(t => t.text === taskText && !t.done)) {
                        userTasks.push({
                            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            workspace: c.workspace,
                            owner: c.owner,
                            text: taskText,
                            date: new Date().toISOString().split("T")[0],
                            priority: "Alta",
                            done: false,
                            assignedBy: "sistema@vellia.com"
                        });
                        if (Store.saveTasks) Store.saveTasks(c.owner, userTasks);
                    }
                }
            }
        });
    },

    openModal(contractId = null) {
        const modal = document.getElementById("modal-contract");
        const form = document.getElementById("contract-form");
        const title = document.getElementById("modal-contract-title");
        const leadSelect = document.getElementById("contract-lead-id");

        if (!modal || !form) return;

        const overlay = document.getElementById("contract-modal-overlay");
        if (overlay) overlay.style.display = "block";
        modal.classList.add("open");

        form.reset();
        document.getElementById("contract-id").value = "";

        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        
        leadSelect.innerHTML = `<option value="">Selecione o Cliente / Lead</option>`;
        leads.filter(l => (l.workspace || "Veeluen Solutions") === activeCompany).forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.id;
            opt.textContent = `${l.company} - ${l.contact}`;
            leadSelect.appendChild(opt);
        });

        if (contractId) {
            title.textContent = "Editar Contrato";
            const contract = Store.getContractById(contractId);
            if (contract) {
                document.getElementById("contract-id").value = contract.id;
                document.getElementById("contract-lead-id").value = contract.leadId;
                document.getElementById("contract-number").value = contract.number;
                document.getElementById("contract-status").value = contract.status;
                document.getElementById("contract-total-value").value = contract.totalValue;
                document.getElementById("contract-recurring-value").value = contract.recurringValue;
                document.getElementById("contract-start-date").value = contract.startDate || "";
                document.getElementById("contract-end-date").value = contract.endDate || "";
                document.getElementById("contract-auto-renew").checked = contract.autoRenew;
                document.getElementById("contract-notes").value = contract.notes || "";
            }
        } else {
            title.textContent = "Novo Contrato";
            document.getElementById("contract-number").value = `CT-${new Date().getFullYear()}-...`;
        }

        modal.style.display = "block";
    },

    closeModal() {
        const modal = document.getElementById("modal-contract");
        const overlay = document.getElementById("contract-modal-overlay");
        if (overlay) overlay.style.display = "none";
        if (modal) modal.classList.remove("open");
    },

    saveContract() {
        const user = Auth.getCurrentUser();
        const id = document.getElementById("contract-id").value;
        const data = {
            leadId: document.getElementById("contract-lead-id").value,
            status: document.getElementById("contract-status").value,
            totalValue: parseFloat(document.getElementById("contract-total-value").value) || 0,
            recurringValue: parseFloat(document.getElementById("contract-recurring-value").value) || 0,
            startDate: document.getElementById("contract-start-date").value,
            endDate: document.getElementById("contract-end-date").value,
            autoRenew: document.getElementById("contract-auto-renew").checked,
            notes: document.getElementById("contract-notes").value
        };

        if (id) {
            Store.updateContract(id, data, user ? user.email : 'sistema@vellia.com');
        } else {
            data.createdBy = user ? user.email : 'sistema@vellia.com';
            data.owner = data.createdBy;
            Store.addContract(data);
        }

        this.closeModal();
        this.renderTable();
    },

    renewContract(contractId) {
        if (!confirm("Deseja iniciar a renovação deste contrato? Um novo contrato será gerado e o atual ficará com status 'Renovado'.")) return;
        
        const c = Store.getContractById(contractId);
        if (!c) return;

        Store.updateContract(c.id, { status: "Renovado" });

        const user = Auth.getCurrentUser();
        let nextStart = "";
        let nextEnd = "";

        if (c.endDate) {
            const dateEnd = new Date(c.endDate);
            dateEnd.setDate(dateEnd.getDate() + 1);
            nextStart = dateEnd.toISOString().split("T")[0];
            dateEnd.setFullYear(dateEnd.getFullYear() + 1);
            nextEnd = dateEnd.toISOString().split("T")[0];
        }

        const newC = Store.addContract({
            leadId: c.leadId,
            proposalId: c.proposalId,
            status: "Em formalização",
            totalValue: c.totalValue,
            recurringValue: c.recurringValue,
            periodicity: c.periodicity,
            startDate: nextStart,
            endDate: nextEnd,
            autoRenew: c.autoRenew,
            warningDays: c.warningDays,
            owner: c.owner,
            createdBy: user ? user.email : "sistema@vellia.com",
            notes: `Renovação originada do contrato ${c.number}`
        });

        // Copiar serviços associados, se existirem
        const oldServices = Store.getServicesForContract(c.id);
        if (oldServices.length > 0) {
            const allServices = Store.getContractServices();
            oldServices.forEach(s => {
                const ns = { ...s, contractId: newC.id };
                allServices.push(ns);
                if (Store.upsert) {
                    Store.upsert("comercial_contract_services", ns);
                }
            });
            localStorage.setItem("comercial_contract_services", JSON.stringify(allServices));
        }

        this.renderTable();
        alert(`O contrato ${newC.number} foi criado e está "Em formalização".`);
        this.openContractScreen(newC.id);
    },

    renderTable() {
        const tbody = document.getElementById("contracts-table-body");
        if (!tbody) return;

        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        let contracts = Store.getContracts().filter(c => c.workspace === activeCompany);
        
        // Calcular KPIs (Receita Recorrente e Valor Total Ativo)
        const activeOrWarning = contracts.filter(c => c.status === "Ativo" || c.status === "Vencendo");
        const countActive = activeOrWarning.length;
        const totalMrr = activeOrWarning.reduce((sum, c) => sum + (c.recurringValue || 0), 0);
        const totalTcv = activeOrWarning.reduce((sum, c) => sum + (c.totalValue || 0), 0);

        const elCount = document.getElementById("contract-stat-active");
        const elMrr = document.getElementById("contract-stat-mrr");
        const elTcv = document.getElementById("contract-stat-tcv");
        
        if (elCount) elCount.textContent = countActive;
        if (elMrr) elMrr.textContent = `R$ ${totalMrr.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if (elTcv) elTcv.textContent = `R$ ${totalTcv.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

        contracts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const searchInput = document.getElementById("contracts-search");
        const filterStatus = document.getElementById("contracts-filter-status");

        const term = searchInput ? searchInput.value.toLowerCase() : "";
        const statusVal = filterStatus ? filterStatus.value : "all";

        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);

        contracts = contracts.filter(c => {
            if (statusVal !== "all" && c.status !== statusVal) return false;
            
            const lead = leads.find(l => l.id === c.leadId);
            const leadName = lead ? `${lead.company} ${lead.contact}`.toLowerCase() : "";
            
            if (term && !c.number.toLowerCase().includes(term) && !leadName.includes(term)) {
                return false;
            }
            return true;
        });

        tbody.innerHTML = "";

        if (contracts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum contrato encontrado.</td></tr>`;
            return;
        }

        contracts.forEach(c => {
            const lead = leads.find(l => l.id === c.leadId);
            const leadDisplay = lead ? (lead.company || 'Cliente sem nome') : 'Desconhecido';
            const initials = leadDisplay.substring(0, 2).toUpperCase();
            
            let statusPillClass = "status-pill status-inactive";
            let statusDot = "●";
            if (c.status === "Ativo") {
                statusPillClass = "status-pill status-active";
            } else if (c.status === "Em formalização" || c.status === "Aguardando assinatura") {
                statusPillClass = "status-pill status-formalizing";
            } else if (c.status === "Vencendo" || c.status === "Suspenso") {
                statusPillClass = "status-pill status-risk";
            } else if (c.status === "Encerrado" || c.status === "Cancelado" || c.status === "Renovado") {
                statusPillClass = "status-pill status-inactive";
            }

            let actionButtons = `
                <button class="btn-icon" onclick="window.Contracts.openContractScreen('${c.id}')" title="Editar Contrato (GestãoClick)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon" style="color: #7C3AED;" onclick="window.Contracts.generateContractDraftAI('${c.id}')" title="Gerar Minuta de Contrato IA">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </button>
            `;
            
            // Mostrar botão de renovar se estiver Ativo ou Vencendo
            if (c.status === "Ativo" || c.status === "Vencendo") {
                actionButtons += `
                <button class="btn-icon" style="color: var(--primary);" onclick="window.Contracts.renewContract('${c.id}')" title="Renovar Contrato">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                `;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight: 600; font-family: monospace; color: #475569; font-size: 12.5px;">${c.number}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="table-avatar">${initials}</div>
                        <div>
                            <div style="font-weight: 600; color: #0F172A; font-size: 13px;">${leadDisplay}</div>
                            <div style="font-size: 11px; color: #94A3B8;">${lead ? (lead.contact || 'Contato não inf.') : '-'}</div>
                        </div>
                    </div>
                </td>
                <td style="font-weight: 600; color: #0F172A;">R$ ${c.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td style="font-weight: 600; color: var(--primary);">R$ ${c.recurringValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td style="font-size: 12.5px; color: #64748B;">${c.startDate ? new Date(c.startDate).toLocaleDateString('pt-BR') : '-'} até ${c.endDate ? new Date(c.endDate).toLocaleDateString('pt-BR') : '-'}</td>
                <td><span class="${statusPillClass}">${statusDot} ${c.status}</span></td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                        ${actionButtons}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    activeContractId: null,

    async generateContractDraftAI(contractId) {
        this.activeContractId = contractId;
        const contracts = Store.getContracts();
        const contract = contracts.find(c => c.id === contractId);
        if (!contract) return;

        const leads = Store.getAllLeadsRaw ? Store.getAllLeadsRaw() : (JSON.parse(localStorage.getItem('comercial_leads')) || []);
        const lead = leads.find(l => l.id === contract.leadId) || { company: "Empresa Cliente", contact: "Representante Legal" };

        const overlay = document.getElementById("contract-draft-modal-overlay");
        const modal = document.getElementById("modal-contract-draft-view");
        const titleEl = document.getElementById("draft-contract-company-title");
        const subtitleEl = document.getElementById("draft-contract-subtitle");
        const editor = document.getElementById("contract-draft-text-editor");

        if (overlay) overlay.style.display = "block";
        if (modal) modal.style.display = "block";

        if (titleEl) titleEl.textContent = `Minuta — ${contract.number} (${lead.company})`;
        if (subtitleEl) subtitleEl.textContent = `Vigência: ${contract.startDate || 'A definir'} a ${contract.endDate || 'A definir'} • MRR: R$ ${contract.recurringValue || 0}`;

        if (editor) editor.value = "🤖 Gerando minuta contratual por IA (Gemini 2.5 Flash)... Aguarde...";

        const prompt = `
Você é um Advogado Especialista em Direito Empresarial e Contratos B2B.
Crie uma Minuta de Contrato de Prestação de Serviços Comerciais e Técnicos completa, formal e juridicamente válida.

DADOS DA NEGOCIAÇÃO:
- CONTRATADA: Veeluen Solutions / Vellia (Consultoria & Engenharia)
- CONTRATANTE: "${lead.company}" (Contato/Representante: "${lead.contact || 'Representante Legal'}")
- NÚMERO DO CONTRATO: "${contract.number}"
- VALOR TOTAL DO CONTRATO: "R$ ${contract.totalValue || 0}"
- VALOR RECORRENTE MENSAL (MRR): "R$ ${contract.recurringValue || 0}"
- PERIODO DE VIGÊNCIA: De ${contract.startDate || 'Data da Assinatura'} a ${contract.endDate || '12 meses'}
- OBJETO E NOTAS TÉCNICAS: "${contract.notes || 'Prestação de Serviços de Consultoria Comercial, Engenharia e Licenciamento Ambiental'}"

ESTRUTURA OBRIGATÓRIA DA MINUTA:
1. INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS
2. CLÁUSULA PRIMEIRA - DO OBJETO E ESCOPO
3. CLÁUSULA SEGUNDA - DO PREÇO E FORMA DE PAGAMENTO
4. CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DAS PARTES
5. CLÁUSULA QUARTA - DA VIGÊNCIA E RESCISÃO
6. CLÁUSULA QUINTA - DA MULTA CONTRATUAL E INADIMPLÊNCIA
7. CLÁUSULA SEXTA - DO FORO E DISPOSIÇÕES GERAIS
8. LOCAL E CAMPO PARA ASSINATURA DAS PARTES E TESTEMUNHAS

Retorne APENAS o texto completo da minuta limpo e pronto para impressão ou cópia, em tom jurídico formal e profissional.
`;

        try {
            const userApiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key");
            let res;

            if (userApiKey && userApiKey.trim()) {
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
                res = await fetch(directUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
            } else {
                res = await fetch("/api/gemini-proxy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "gemini-2.5-flash",
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
            }

            if (res.ok) {
                const data = await res.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (aiText && editor) {
                    editor.value = aiText.trim();
                }
            }
        } catch (e) {
            console.error("Erro ao gerar minuta por IA:", e);
            if (editor) {
                editor.value = `MINUTA DE CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS N° ${contract.number}\n\nCONTRATANTE: ${lead.company}\nCONTRATADA: Veeluen Solutions / Vellia\n\nVALOR TOTAL: R$ ${contract.totalValue}\nVALOR MENSAL: R$ ${contract.recurringValue}\nVIGÊNCIA: ${contract.startDate} a ${contract.endDate}\n\nCLÁUSULA 1ª - DO OBJETO:\nConstitui objeto deste contrato a prestação dos serviços especificados: ${contract.notes || 'Consultoria Técnica'}.\n\nCLÁUSULA 2ª - DO PREÇO:\nPelo cumprimento do objeto, a CONTRATANTE pagará o valor mensal de R$ ${contract.recurringValue}.\n\nE por estarem justas e contratadas, as partes assinam o presente instrumento.`;
            }
        }
    },

    exportContractDraftPDF(text, filename) {
        if (!text) return;

        const now = new Date();
        const issueDate = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        const codeAuth = `VEL-CTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const pdfFilename = filename || `Minuta_Contrato_${Date.now()}.pdf`;

        // Converter texto em parágrafos HTML
        const paragraphs = text
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => {
                // Detectar cláusulas/títulos em maiúsculas
                if (/^(CL[AÁ]USULA|PARTES|OBJETO|PRE[ÇC]O|CONTRATANTE|CONTRATADA|VALOR|VIGI[EÊ]NCIA|E POR ESTAREM)/i.test(p)) {
                    return `<p class="clause-title">${p.replace(/\n/g, "<br>")}</p>`;
                }
                return `<p class="clause-body">${p.replace(/\n/g, "<br>")}</p>`;
            })
            .join("");

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>${pdfFilename}</title>
    <style>
        @page { size: A4; margin: 20mm 18mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Times New Roman', Times, Georgia, serif;
            color: #1e293b;
            background: #fff;
            font-size: 12.5px;
            line-height: 1.75;
        }
        .no-print {
            background: #6257F5;
            color: #fff;
            padding: 12px 20px;
            text-align: center;
            font-weight: 700;
            font-family: Helvetica, Arial, sans-serif;
            font-size: 14px;
            border-radius: 8px;
            margin: 16px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(98,87,245,0.35);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #1e293b;
            padding-bottom: 14px;
            margin-bottom: 22px;
        }
        .logo-block .logo { font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 900; color: #6257F5; letter-spacing: -1px; }
        .logo-block .sub { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
        .doc-info { text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #64748b; }
        .doc-info strong { color: #1e293b; }
        .title-box {
            text-align: center;
            margin-bottom: 24px;
            padding: 14px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #f8fafc;
        }
        .title-box h1 { font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .title-box p { font-family: Helvetica, Arial, sans-serif; font-size: 10.5px; color: #64748b; margin-top: 4px; }
        .clause-title {
            font-weight: 700;
            font-size: 12.5px;
            color: #0f172a;
            margin: 18px 0 6px 0;
            text-transform: uppercase;
        }
        .clause-body {
            margin-bottom: 10px;
            text-align: justify;
            color: #334155;
        }
        .footer {
            margin-top: 48px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-family: Helvetica, Arial, sans-serif;
            font-size: 10px;
            color: #94a3b8;
        }
        @media print { .no-print { display: none !important; } body { padding: 0; } }
    </style>
</head>
<body>
    <div class="no-print" onclick="window.print()">
        🖨️ CLIQUE AQUI PARA IMPRIMIR OU SALVAR COMO PDF
    </div>

    <div class="header">
        <div class="logo-block">
            <div class="logo">Vellia</div>
            <div class="sub">Engineering &amp; Commercial Solutions</div>
        </div>
        <div class="doc-info">
            <div><strong>🛡️ CÓDIGO AUTENTICADOR</strong></div>
            <div>${codeAuth}</div>
            <div>Emissão: ${issueDate}</div>
        </div>
    </div>

    <div class="title-box">
        <h1>Minuta de Contrato Particular de Prestação de Serviços</h1>
        <p>Documento gerado eletronicamente pelo Vellia CRM • Sujeito a revisão jurídica antes da assinatura</p>
    </div>

    <div class="content">
        ${paragraphs}
    </div>

    <div class="footer">
        <div>🔒 Vellia CRM Engine — Documento Gerado Digitalmente</div>
        <div>Auth: ${codeAuth}</div>
    </div>

    <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 500); };
    </script>
</body>
</html>`;

        const win = window.open("", "_blank");
        if (win) {
            win.document.write(htmlContent);
            win.document.close();
        } else {
            // Fallback: download direto via jsPDF
            const jsPDFLib = window.jspdf;
            if (!jsPDFLib || !jsPDFLib.jsPDF) {
                alert("Por favor, permita popups neste site para visualizar e baixar o contrato em PDF.");
                return;
            }
            const { jsPDF } = jsPDFLib;
            const doc = new jsPDF();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("MINUTA DE CONTRATO COMERCIAL", 14, 20);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            const lines = doc.splitTextToSize(text, 180);
            let y = 30;
            lines.forEach(line => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(line, 14, y);
                y += 5;
            });
            doc.save(pdfFilename);
        }
    }
};

window.Contracts = Contracts;
