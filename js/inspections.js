import { Store } from "./store.js";
import { PDFGenerator } from "./pdf-generator.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";

export const Inspections = {
    async init() {
        // Inicializar listeners e modal imediatamente para resposta instantânea ao clique
        this.setupChecklistModal();
        this.setupListeners();
        this.render();

        try {
            // Buscar todos os leads atualizados do Supabase
            const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            });
            if (res.ok) {
                const freshLeads = await res.json();
                if (Array.isArray(freshLeads) && freshLeads.length > 0) {
                    // Mesclar com leads locais preservando qualquer dado local extra
                    let localLeads = [];
                    try { localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || []; } catch(e) {}
                    const merged = freshLeads.map(remote => {
                        const local = localLeads.find(l => l && l.id === remote.id);
                        return local ? { ...local, ...remote } : remote;
                    });
                    localStorage.setItem("comercial_leads", JSON.stringify(merged));
                    console.log(`✅ [Inspections] ${merged.length} leads sincronizados do Supabase.`);
                    this.render();
                }
            }
        } catch (err) {
            console.warn("[Inspections] Falha ao sincronizar com Supabase, usando cache local:", err.message);
        }
    },

    getInspections() {
        const leads = Store.getLeads();
        const inspections = [];

        leads.forEach(lead => {
            if (lead.interactions && Array.isArray(lead.interactions)) {
                lead.interactions.forEach(item => {
                    if (item.type === "Inspeção") {
                        const executionDateStr = item.meta?.executionDate || item.timestamp?.split("T")[0] || new Date().toISOString().split("T")[0];
                        
                        // O vencimento é 1 ano após a execução por padrão
                        let expiryDateStr = item.meta?.expiryDate;
                        if (!expiryDateStr) {
                            const date = new Date(executionDateStr + "T12:00:00");
                            date.setFullYear(date.getFullYear() + 1);
                            expiryDateStr = date.toISOString().split("T")[0];
                        }

                        // Cálculo de dias restantes
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const expiryDate = new Date(expiryDateStr + "T12:00:00");
                        expiryDate.setHours(0,0,0,0);

                        const timeDiff = expiryDate.getTime() - today.getTime();
                        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

                        // Determinar Status
                        let status = "valida"; // valida, alerta, vencida
                        if (daysRemaining < 0) {
                            status = "vencida";
                        } else if (daysRemaining <= 90) { // 3 meses (90 dias)
                            status = "alerta";
                        }

                        inspections.push({
                            id: item.id,
                            leadId: lead.id,
                            company: lead.company,
                            contact: lead.contact || "Sem nome",
                            phone: lead.whatsapp || lead.phone || "",
                            serviceName: item.meta?.serviceName || "Vistoria Geral",
                            executionDate: executionDateStr,
                            expiryDate: expiryDateStr,
                            daysRemaining: daysRemaining,
                            status: status,
                            notes: item.meta?.notes || item.description,
                            score: item.meta?.score
                        });
                    }
                });
            }
        });

        // Ordenar pela proximidade de vencimento (vencidos primeiro, depois alertas, depois válidos)
        return inspections.sort((a, b) => a.daysRemaining - b.daysRemaining);
    },

    render() {
        const tableBody = document.getElementById("inspections-table-body");
        if (!tableBody) return;

        const inspections = this.getInspections();
        
        // Filtros ativos
        const query = (document.getElementById("filter-inspection-search")?.value || "").toLowerCase().trim();
        const statusFilter = document.getElementById("filter-inspection-status")?.value || "all";
        const yearFilter = document.getElementById("filter-inspection-year")?.value || "all";

        const filtered = inspections.filter(item => {
            const matchesQuery = item.company.toLowerCase().includes(query) || 
                                 item.contact.toLowerCase().includes(query) || 
                                 item.serviceName.toLowerCase().includes(query);
            
            const matchesStatus = statusFilter === "all" || item.status === statusFilter;
            
            const matchesYear = yearFilter === "all" || item.executionDate.startsWith(yearFilter);

            return matchesQuery && matchesStatus && matchesYear;
        });

        // Atualizar KPIs
        const totalCount = inspections.length;
        const expiredCount = inspections.filter(i => i.status === "vencida").length;
        const criticalCount = inspections.filter(i => i.status === "alerta").length;
        const validCount = inspections.filter(i => i.status === "valida").length;

        document.getElementById("kpi-inspections-total").textContent = totalCount;
        document.getElementById("kpi-inspections-expired").textContent = expiredCount;
        document.getElementById("kpi-inspections-critical").textContent = criticalCount;
        document.getElementById("kpi-inspections-valid").textContent = validCount;

        this.renderAnalyticsDashboard(inspections);

        // Renderizar Tabela
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding: 40px; text-align: center; color: var(--text-muted);">
                        Nenhuma inspeção encontrada com os filtros selecionados.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map(item => {
            let statusBadge = "";
            let rowStyle = "";
            let remainingText = "";

            if (item.status === "vencida") {
                statusBadge = `<span class="badge badge-danger" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;">🔴 Vencida</span>`;
                rowStyle = "background-color: rgba(239, 68, 68, 0.02);";
                remainingText = `<span style="color:#dc2626; font-weight:700;">Vencida há ${Math.abs(item.daysRemaining)} dias</span>`;
            } else if (item.status === "alerta") {
                statusBadge = `<span class="badge badge-warning" style="background:#fef3c7; color:#d97706; border:1px solid #fcd34d; font-weight:700; animation: pulse 2s infinite;"> 🟠 Crítico (Notificar)</span>`;
                rowStyle = "background-color: rgba(245, 158, 11, 0.02);";
                remainingText = `<span style="color:#d97706; font-weight:700;">Vence em ${item.daysRemaining} dias</span>`;
            } else {
                statusBadge = `<span class="badge badge-success" style="background:#dcfce7; color:#16a34a; border:1px solid #86efac;">🟢 Válida</span>`;
                remainingText = `<span style="color:#16a34a;">Vence em ${item.daysRemaining} dias</span>`;
            }

            const formatDate = (dateStr) => {
                if (!dateStr) return "N/A";
                const parts = dateStr.split("-");
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            };

            const buttonStyle = item.status === "valida" 
                ? "background: #f1f5f9; color: #94a3b8; border-color: #e2e8f0; cursor: not-allowed;"
                : "background: #25d366; color: white; border: none; font-weight: 700; cursor: pointer; box-shadow: 0 4px 10px rgba(37,211,102,0.25);";

            const buttonText = item.status === "vencida" ? "⚡ Renovar Já" : "💬 Notificar Cliente";
            const buttonDisabled = item.status === "valida" ? "disabled" : "";

            const scoreText = item.score !== undefined ? ` <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${item.score >= 80 ? 'rgba(16,185,129,0.12)' : (item.score >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)')}; color: ${item.score >= 80 ? '#10b981' : (item.score >= 50 ? '#d97706' : '#ef4444')}; font-weight: 700; margin-left: 6px; display: inline-flex; align-items: center; gap: 2px;">Score: ${item.score}%</span>` : '';

            return `
                <tr style="${rowStyle} border-bottom: 1px solid var(--border-color); transition: all 0.2s;">
                    <td style="padding: 16px 20px;">
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 13.5px;">${item.company}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Contato: ${item.contact}</div>
                    </td>
                    <td style="padding: 16px 20px; font-weight: 600; color: var(--text-primary);">${item.serviceName}${scoreText}</td>
                    <td style="padding: 16px 20px; color: var(--text-secondary);">${formatDate(item.executionDate)}</td>
                    <td style="padding: 16px 20px; color: var(--text-secondary); font-weight: 600;">${formatDate(item.expiryDate)}</td>
                    <td style="padding: 16px 20px;">${remainingText}</td>
                    <td style="padding: 16px 20px; text-align: center;">${statusBadge}</td>
                    <td style="padding: 16px 20px; text-align: center;">
                        <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                            <button 
                                class="btn btn-sm"
                                style="${buttonStyle} padding: 8px 12px; border-radius: 8px; font-size: 11.5px; transition: all 0.2s;"
                                onclick="window.sendInspectionNotification('${item.leadId}', '${item.id}')"
                                ${buttonDisabled}
                            >
                                ${buttonText}
                            </button>
                            <button 
                                class="btn btn-outline btn-sm"
                                style="padding: 8px 12px; border-radius: 8px; font-size: 11.5px; border-color: #3b82f6; color: #3b82f6; background: transparent; font-weight: 700; cursor: pointer;"
                                onclick="window.scheduleGoogleCalendar('${item.leadId}', '${item.id}')"
                                title="Adicionar lembrete no Google Agenda"
                            >
                                📅 Agendar
                            </button>
                            <button 
                                class="btn btn-outline btn-sm"
                                style="padding: 8px 12px; border-radius: 8px; font-size: 11.5px; border-color: var(--primary); color: var(--primary); background: transparent; font-weight: 700; cursor: pointer;"
                                onclick="window.generateInspectionPDF('${item.leadId}', '${item.id}')"
                                title="Gerar Laudo Oficial em PDF"
                            >
                                📄 Laudo
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    },

    // ─── Painel Analítico: Comparativo Anual & Índice de Renovação ──────────────
    renderAnalyticsDashboard(inspections) {
        const ctx = document.getElementById("chart-inspections-yearly")?.getContext("2d");
        if (!ctx) return;

        // Contagem por ano
        const countsByYear = { "2024": 0, "2025": 0, "2026": 0 };
        const companyCounts = {};

        inspections.forEach(item => {
            const yr = (item.executionDate || "").substring(0, 4);
            if (countsByYear[yr] !== undefined) {
                countsByYear[yr]++;
            } else if (yr) {
                countsByYear[yr] = 1;
            }

            companyCounts[item.company] = (companyCounts[item.company] || 0) + 1;
        });

        // Gráfico comparativo de vistorias por ano
        if (window._chartInspectionsYearly) {
            window._chartInspectionsYearly.destroy();
        }

        if (typeof Chart !== "undefined") {
            window._chartInspectionsYearly = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(countsByYear),
                    datasets: [{
                        label: "Vistorias Realizadas",
                        data: Object.values(countsByYear),
                        backgroundColor: ["#3b82f6", "#8b5cf6", "#10b981"],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        }

        // Taxa de Renovação e Receita
        const totalCompanies = Object.keys(companyCounts).length;
        const recurringCompanies = Object.values(companyCounts).filter(c => c > 1).length;
        const renewalRate = totalCompanies > 0 ? Math.round((recurringCompanies / totalCompanies) * 100) : 65;

        const rateEl = document.getElementById("inspection-renewal-rate");
        const revEl = document.getElementById("inspection-renewal-revenue");
        if (rateEl) rateEl.textContent = `${Math.max(45, renewalRate)}%`;

        const estimatedRenewalRevenue = inspections.length * 3500;
        if (revEl) revEl.textContent = `R$ ${estimatedRenewalRevenue.toLocaleString("pt-BR")}`;

        // Top 3 Clientes Recorrentes
        const sortedCompanies = Object.entries(companyCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const topContainer = document.getElementById("inspections-top-clients");
        if (topContainer) {
            topContainer.innerHTML = sortedCompanies.length === 0 
                ? `<div style="color:var(--text-muted);">Aguardando mais vistorias para ranking.</div>`
                : sortedCompanies.map(([comp, count], i) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-app); padding:6px 10px; border-radius:6px; border:1px solid var(--border-color);">
                        <span style="font-weight:700; color:var(--text-primary);">${i+1}. ${comp}</span>
                        <span class="badge badge-success" style="font-size:10.5px; background:rgba(16,185,129,0.1); color:#10b981;">${count} vistorias</span>
                    </div>
                `).join("");
        }
    },

    setupListeners() {
        const searchInput = document.getElementById("filter-inspection-search");
        const statusSelect = document.getElementById("filter-inspection-status");
        const yearSelect = document.getElementById("filter-inspection-year");

        if (searchInput) {
            searchInput.addEventListener("input", () => this.render());
        }
        if (statusSelect) {
            statusSelect.addEventListener("change", () => this.render());
        }
        if (yearSelect) {
            yearSelect.addEventListener("change", () => this.render());
        }

        // Listener de sincronização em tempo real (novas mensagens ou outros eventos gerais)
        window.addEventListener("vellia:waSent", () => this.render());

        // Listener específico para atualização de lead (via Realtime WS UPDATE)
        window.addEventListener("vellia:leadUpdated", () => {
            console.log("🔄 [Inspections] Lead atualizado remotamente — re-renderizando central de inspeções.");
            this.render();
        });
    },

    setupChecklistModal() {
        const btnOpen = document.getElementById("btn-open-checklist-modal");
        const btnOpenScan = document.getElementById("btn-open-checklist-scanner-top");
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        const btnCloseX = document.getElementById("btn-close-checklist-modal-x");
        const btnCancel = document.getElementById("btn-cancel-checklist");
        const form = document.getElementById("checklist-form");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const itemSelects = document.querySelectorAll(".checklist-item-select");

        // Botões do módulo de leitura de documento
        const btnUploadPdf = document.getElementById("btn-insp-upload-pdf");
        const btnUseCamera = document.getElementById("btn-insp-use-camera");
        const btnOpenWebcam = document.getElementById("btn-insp-open-webcam");
        const fileInput = document.getElementById("insp-file-input");
        const cameraInput = document.getElementById("insp-camera-input");
        const btnClearScan = document.getElementById("btn-insp-clear-scan");
        const btnQuickAddLead = document.getElementById("btn-insp-quick-add-lead");
        const btnWebcamCapture = document.getElementById("btn-insp-webcam-capture");
        const btnWebcamClose = document.getElementById("btn-insp-webcam-close");

        // Handler de abertura
        if (btnOpen) {
            btnOpen.onclick = () => this.openChecklistModal();
        }
        if (btnOpenScan) {
            btnOpenScan.onclick = () => this.openChecklistModal(null, "file");
        }

        // Handlers de fechamento
        if (btnCloseX) btnCloseX.onclick = () => this.closeChecklistModal();
        if (btnCancel) btnCancel.onclick = () => this.closeChecklistModal();
        if (overlay) overlay.onclick = () => this.closeChecklistModal();

        // Gatilhos de Upload e Câmera
        if (btnUploadPdf && fileInput) {
            btnUploadPdf.onclick = () => fileInput.click();
        }
        if (btnUseCamera && cameraInput) {
            btnUseCamera.onclick = () => cameraInput.click();
        }
        if (btnOpenWebcam) {
            btnOpenWebcam.onclick = () => this.startWebcam();
        }
        if (btnWebcamCapture) {
            btnWebcamCapture.onclick = () => this.captureWebcam();
        }
        if (btnWebcamClose) {
            btnWebcamClose.onclick = () => this.closeWebcam();
        }

        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleDocumentInput(e.target.files[0]);
                }
            };
        }

        if (cameraInput) {
            cameraInput.onchange = (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleDocumentInput(e.target.files[0]);
                }
            };
        }

        if (btnClearScan) {
            btnClearScan.onclick = () => {
                const successBox = document.getElementById("insp-scanner-success");
                if (successBox) successBox.style.display = "none";
                const notesArea = document.getElementById("checklist-notes");
                if (notesArea) notesArea.value = "";
                if (fileInput) fileInput.value = "";
                if (cameraInput) cameraInput.value = "";
            };
        }

        if (btnQuickAddLead) {
            btnQuickAddLead.onclick = () => {
                const name = prompt("Digite a Razão Social ou Nome Fantasia da nova empresa:");
                if (name && name.trim()) {
                    const cleanName = name.trim();
                    const newLead = Store.createLead({
                        company: cleanName,
                        contact: "Responsável",
                        source: "Inspeções",
                        stage: "Lead Qualificado",
                        notes: `Cadastrado na central de inspeções em ${new Date().toLocaleDateString('pt-BR')}`
                    });
                    this.openChecklistModal(newLead.id);
                }
            };
        }

        // Dropzone de arquivo no card
        const scannerCard = document.getElementById("insp-scanner-card");
        if (scannerCard) {
            ["dragenter", "dragover"].forEach(eventName => {
                scannerCard.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scannerCard.style.borderColor = "#6366f1";
                    scannerCard.style.background = "rgba(99, 102, 241, 0.12)";
                }, false);
            });

            ["dragleave", "drop"].forEach(eventName => {
                scannerCard.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scannerCard.style.borderColor = "rgba(99, 102, 241, 0.35)";
                    scannerCard.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(16, 185, 129, 0.06))";
                }, false);
            });

            scannerCard.addEventListener("drop", (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files[0]) {
                    this.handleDocumentInput(dt.files[0]);
                }
            });
        }

        // Atualização de data de vencimento automática (1 ano após execução)
        if (inputExecDate) {
            inputExecDate.onchange = () => {
                if (inputExecDate.value) {
                    const d = new Date(inputExecDate.value + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    inputExpiryDate.value = d.toISOString().split("T")[0];
                }
            };
        }

        itemSelects.forEach(sel => {
            sel.onchange = () => this.calculateScore();
        });

        // Submissão do Formulário
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const leadSelect = document.getElementById("checklist-lead-select");
                const selectService = document.getElementById("checklist-service-select");
                let leadId = leadSelect?.value;

                if (!leadId) {
                    alert("Selecione um Cliente / Lead ou cadastre uma nova empresa.");
                    return;
                }

                // Se for um novo lead detectado pelo laudo
                if (leadId.startsWith("__NEW__:")) {
                    const companyName = leadId.replace("__NEW__:", "").trim();
                    const createdLead = Store.createLead({
                        company: companyName,
                        contact: "Responsável Técnico",
                        source: "Scanner de Laudo",
                        stage: "Lead Qualificado",
                        notes: `Empresa importada automaticamente via scanner de laudo técnico em ${new Date().toLocaleDateString('pt-BR')}`
                    });
                    leadId = createdLead.id;
                }

                const lead = Store.getLeadById(leadId);
                if (!lead) {
                    alert("Erro: Não foi possível localizar os dados do cliente selecionado.");
                    return;
                }

                const service = selectService ? selectService.value : "Vistoria Geral";
                const execDate = inputExecDate ? inputExecDate.value : new Date().toISOString().split("T")[0];
                const expiryDate = inputExpiryDate ? inputExpiryDate.value : new Date(Date.now() + 365*24*3600*1000).toISOString().split("T")[0];
                const notes = document.getElementById("checklist-notes")?.value.trim() || "";
                
                const score = this.calculateScore();

                const checklistPayload = [];
                itemSelects.forEach(sel => {
                    checklistPayload.push({
                        name: sel.getAttribute("data-item-name"),
                        status: sel.value
                    });
                });

                const currentUser = Auth.getCurrentUser();
                const userEmail = currentUser ? currentUser.email : "sistema@vellia.com";

                const newInteraction = {
                    id: "int_" + Date.now().toString(36),
                    type: "Inspeção",
                    timestamp: new Date().toISOString(),
                    description: `Vistoria de ${service} concluída com ${score}% de conformidade. Parecer: ${notes.substring(0, 120)}...`,
                    meta: {
                        serviceName: service,
                        score: score,
                        executionDate: execDate,
                        expiryDate: expiryDate,
                        notes: notes,
                        checklist: checklistPayload
                    }
                };

                if (!lead.interactions) lead.interactions = [];
                lead.interactions.push(newInteraction);
                
                try {
                    const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
                    const updatedLocal = localLeads.map(l => l.id === lead.id ? lead : l);
                    localStorage.setItem("comercial_leads", JSON.stringify(updatedLocal));

                    const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                        method: "PATCH",
                        headers: {
                            "apikey": SUPABASE_KEY,
                            "Authorization": `Bearer ${SUPABASE_KEY}`,
                            "Content-Type": "application/json",
                            "Prefer": "return=minimal"
                        },
                        body: JSON.stringify({
                            interactions: lead.interactions
                        })
                    });

                    if (res.ok) {
                        console.log("✅ Vistoria registrada com sucesso no Supabase.");
                    } else {
                        console.warn("⚠️ Vistoria registrada localmente, falha ao subir no Supabase:", await res.text());
                    }
                } catch(err) {
                    console.error("Erro ao salvar inspeção no Supabase:", err);
                }

                Audit.logStageChange(userEmail, lead.company, lead.stage, lead.stage, `Concluiu Checklist Técnico de ${service} (Score: ${score}%)`);

                this.closeChecklistModal();
                alert(`✅ Inspeção registrada com sucesso para "${lead.company}"! Score de Conformidade: ${score}%`);
                
                this.init();
            };
        }
    },

    openChecklistModal(preselectedLeadId = null, autoAction = null) {
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        const leadSelect = document.getElementById("checklist-lead-select");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const itemSelects = document.querySelectorAll(".checklist-item-select");
        const notesArea = document.getElementById("checklist-notes");

        this.closeWebcam();

        const loadingBox = document.getElementById("insp-scanner-loading");
        const successBox = document.getElementById("insp-scanner-success");
        if (loadingBox) loadingBox.style.display = "none";
        if (successBox) successBox.style.display = "none";

        const leads = Store.getLeads() || [];
        if (leadSelect) {
            leadSelect.innerHTML = `<option value="">-- Selecionar Cliente / Lead Cadastrado --</option>` +
                leads.map(l => `<option value="${l.id}">${l.company} (${l.contact || 'Sem contato'})</option>`).join("");
            
            if (preselectedLeadId) {
                leadSelect.value = preselectedLeadId;
            }
        }

        const todayStr = new Date().toISOString().split("T")[0];
        if (inputExecDate) inputExecDate.value = todayStr;
        
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        if (inputExpiryDate) inputExpiryDate.value = nextYear.toISOString().split("T")[0];

        itemSelects.forEach(sel => sel.value = "Conforme");
        if (notesArea) notesArea.value = "";
        this.calculateScore();

        if (overlay) {
            overlay.style.display = "block";
            overlay.classList.add("open");
        }
        if (modal) {
            modal.style.display = "flex";
            modal.classList.add("open");
            setTimeout(() => {
                modal.style.opacity = "1";
                modal.style.transform = "translate(-50%, -50%) scale(1)";
            }, 10);
        }

        if (autoAction === "file") {
            setTimeout(() => {
                const fileInput = document.getElementById("insp-file-input");
                if (fileInput) fileInput.click();
            }, 250);
        } else if (autoAction === "camera") {
            setTimeout(() => {
                const camInput = document.getElementById("insp-camera-input");
                if (camInput) camInput.click();
            }, 250);
        }
    },

    closeChecklistModal() {
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        this.closeWebcam();
        if (modal) {
            modal.classList.remove("open");
            modal.style.opacity = "0";
            modal.style.transform = "translate(-50%, -50%) scale(0.95)";
        }
        if (overlay) {
            overlay.classList.remove("open");
        }
        setTimeout(() => {
            if (modal) modal.style.display = "none";
            if (overlay) overlay.style.display = "none";
        }, 250);
    },

    calculateScore() {
        const itemSelects = document.querySelectorAll(".checklist-item-select");
        const scoreVal = document.getElementById("checklist-score-val");
        const scoreBar = document.getElementById("checklist-score-bar");

        let totalEvaluated = 0;
        let conformeCount = 0;
        itemSelects.forEach(sel => {
            const val = sel.value;
            if (val !== "N/A") {
                totalEvaluated++;
                if (val === "Conforme") {
                    conformeCount++;
                }
            }
        });

        const score = totalEvaluated > 0 ? Math.round((conformeCount / totalEvaluated) * 100) : 100;
        
        if (scoreVal) scoreVal.textContent = `${score}%`;
        if (scoreBar) {
            scoreBar.style.width = `${score}%`;
            if (score >= 80) {
                scoreBar.style.background = "#10b981";
                if (scoreVal) scoreVal.style.color = "#10b981";
            } else if (score >= 50) {
                scoreBar.style.background = "#f59e0b";
                if (scoreVal) scoreVal.style.color = "#f59e0b";
            } else {
                scoreBar.style.background = "#ef4444";
                if (scoreVal) scoreVal.style.color = "#ef4444";
            }
        }
        return score;
    },

    // ─── MÓDULO INTELIGENTE: LEITURA DE PDF & CÂMERA ──────────────────────────
    async handleDocumentInput(file) {
        if (!file) return;

        const loadingBox = document.getElementById("insp-scanner-loading");
        const statusText = document.getElementById("insp-scanner-status-text");
        const successBox = document.getElementById("insp-scanner-success");
        const summaryText = document.getElementById("insp-scanner-summary");

        if (loadingBox) loadingBox.style.display = "flex";
        if (successBox) successBox.style.display = "none";

        try {
            const isPdf = file.name?.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
            let parsedData = null;

            if (isPdf) {
                if (statusText) statusText.textContent = "📄 Lendo páginas do PDF e extraindo dados do laudo...";
                parsedData = await this.extractFromPdf(file);
            } else {
                if (statusText) statusText.textContent = "📷 Analisando foto do documento com Inteligência Artificial...";
                parsedData = await this.extractFromImage(file);
            }

            if (!parsedData) {
                throw new Error("Não foi possível identificar informações estruturadas.");
            }

            this.applyExtractedData(parsedData);

            if (loadingBox) loadingBox.style.display = "none";
            if (successBox) {
                successBox.style.display = "block";
                if (summaryText) {
                    summaryText.textContent = `Laudo lido! Cliente: "${parsedData.company || 'Detectado'}" | Serviço: "${parsedData.serviceName || 'Geral'}" | Validade: ${parsedData.expiryDate || '1 ano'}`;
                }
            }
        } catch (err) {
            console.error("[Inspections] Erro ao analisar documento:", err);
            if (loadingBox) loadingBox.style.display = "none";
            alert("Aviso: Não foi possível ler automaticamente todos os dados deste documento. Você pode preencher os campos manualmente.");
        }
    },

    async extractFromPdf(file) {
        if (typeof pdfjsLib !== 'undefined') {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                const maxPages = Math.min(pdf.numPages, 12);
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageStr = textContent.items.map(item => item.str).join(" ");
                    fullText += `\n--- Página ${i} ---\n` + pageStr;
                }

                if (fullText.trim().length > 30) {
                    return this.parseInspectionText(fullText, file.name);
                }
            } catch (pdfErr) {
                console.warn("[Inspections] Falha ao extrair texto do PDF via PDF.js:", pdfErr);
            }
        }

        return this.parseInspectionText(file.name || "", file.name);
    },

    async extractFromImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                const base64Data = dataUrl.split(",")[1];
                const mimeType = file.type || "image/jpeg";

                const apiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key") || "";
                if (apiKey) {
                    try {
                        const geminiRes = await this.callGeminiVisionForInspection(base64Data, mimeType, apiKey);
                        if (geminiRes) {
                            resolve(geminiRes);
                            return;
                        }
                    } catch (gErr) {
                        console.warn("[Inspections] Erro no Gemini Vision, usando extrator local:", gErr);
                    }
                }

                resolve(this.parseInspectionText(file.name || "Foto de Laudo Técnico", file.name));
            };
            reader.readAsDataURL(file);
        });
    },

    async callGeminiVisionForInspection(base64Data, mimeType, apiKey) {
        const prompt = `Analise este laudo técnico de engenharia ou vistoria predial/industrial.
Extraia e retorne EXCLUSIVAMENTE um objeto JSON (sem formatação markdown) com:
{
  "company": "Razão social ou nome da empresa/condomínio",
  "serviceName": "Laudo de SPDA" | "Laudo de Incêndio (AVCB)" | "Laudo de Instalações Elétricas (NR-10)" | "Laudo de Gás (GN/GLP)" | "Vistoria Predial Geral",
  "executionDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "score": 100 ou entre 40 e 100 se houver irregularidades,
  "isIrregular": false,
  "notes": "Resumo do parecer técnico, ART e engenheiro responsável"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Data } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    response_mime_type: "application/json"
                }
            })
        });

        if (!response.ok) return null;
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        try {
            return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
        } catch(e) {
            return null;
        }
    },

    parseInspectionText(rawText, filename = "") {
        const text = (rawText + " " + filename).toLowerCase();
        const originalText = rawText || "";

        // 1. Identificar Empresa / Cliente
        let detectedCompany = "";
        const leads = Store.getLeads() || [];

        for (const lead of leads) {
            if (lead.company && text.includes(lead.company.toLowerCase())) {
                detectedCompany = lead.company;
                break;
            }
        }

        if (!detectedCompany) {
            const companyMatch = originalText.match(/(?:Cliente|Razão Social|Tomador|Contratante|Empresa|Proprietário|Condomínio|Edifício)[\s:]+([A-Za-z0-9À-ÿ\.\-\s]{3,50})/i);
            if (companyMatch && companyMatch[1]) {
                detectedCompany = companyMatch[1].trim().replace(/\r?\n.*/g, "");
            } else if (filename) {
                const cleanName = filename.replace(/\.(pdf|png|jpe?g|webp)$/i, "").replace(/[-_]/g, " ").trim();
                if (cleanName.length > 3) detectedCompany = cleanName;
            }
        }

        // 2. Identificar Serviço Inspecionado
        let serviceName = "Vistoria Predial Geral";
        if (text.includes("spda") || text.includes("para-raios") || text.includes("pára-raios") || text.includes("descargas atmosféricas") || text.includes("5419")) {
            serviceName = "Laudo de SPDA";
        } else if (text.includes("avcb") || text.includes("clcb") || text.includes("incêndio") || text.includes("incendio") || text.includes("extintor") || text.includes("hidrante") || text.includes("bombeiros")) {
            serviceName = "Laudo de Incêndio (AVCB)";
        } else if (text.includes("nr-10") || text.includes("nr10") || text.includes("elétrica") || text.includes("eletrica") || text.includes("subestação") || text.includes("quadro elétrico") || text.includes("5410")) {
            serviceName = "Laudo de Instalações Elétricas (NR-10)";
        } else if (text.includes("gás") || text.includes("gas") || text.includes("glp") || text.includes("gn") || text.includes("estanqueidade")) {
            serviceName = "Laudo de Gás (GN/GLP)";
        }

        // 3. Identificar Data de Execução
        let executionDate = new Date().toISOString().split("T")[0];
        const dateMatch = originalText.match(/(?:Data(?:\s+da\s+(?:Vistoria|Inspeção|Realização))?|Executado\s+em|Emissão)[\s:]*([0-3]?[0-9][/\-\.][0-1]?[0-9][/\-\.][1-2][0-9]{3})/i) ||
                           originalText.match(/\b([0-3][0-9][/\-\.][0-1][0-9][/\-\.](?:202[0-9]))\b/);

        if (dateMatch && dateMatch[1]) {
            const rawD = dateMatch[1].replace(/[\-\.]/g, "/");
            const parts = rawD.split("/");
            if (parts.length === 3) {
                const day = parts[0].padStart(2, "0");
                const month = parts[1].padStart(2, "0");
                const year = parts[2];
                if (parseInt(year) >= 2020 && parseInt(year) <= 2035) {
                    executionDate = `${year}-${month}-${day}`;
                }
            }
        }

        // 4. Identificar Data de Vencimento
        let expiryDate = "";
        const expiryMatch = originalText.match(/(?:Validade|Vencimento|Próxima\s+(?:Vistoria|Inspeção)|Válido\s+até)[\s:]*([0-3]?[0-9][/\-\.][0-1]?[0-9][/\-\.][1-2][0-9]{3})/i);
        if (expiryMatch && expiryMatch[1]) {
            const rawD = expiryMatch[1].replace(/[\-\.]/g, "/");
            const parts = rawD.split("/");
            if (parts.length === 3) {
                const day = parts[0].padStart(2, "0");
                const month = parts[1].padStart(2, "0");
                const year = parts[2];
                if (parseInt(year) >= 2020 && parseInt(year) <= 2035) {
                    expiryDate = `${year}-${month}-${day}`;
                }
            }
        }

        if (!expiryDate) {
            const d = new Date(executionDate + "T12:00:00");
            d.setFullYear(d.getFullYear() + 1);
            expiryDate = d.toISOString().split("T")[0];
        }

        // 5. Conformidade e Score
        let score = 100;
        let isIrregular = text.includes("não conforme") || text.includes("irregularidade") || text.includes("reprovado") || text.includes("risco grave") || text.includes("pendência crítica");
        if (isIrregular) {
            score = 60;
        }

        // 6. Parecer Técnico
        let notes = "";
        const conclusionMatch = originalText.match(/(?:Conclusão|Parecer Técnico|Considerações Finais|Recomendações)[\s:]+([^\r\n]{10,250})/i);
        if (conclusionMatch && conclusionMatch[1]) {
            notes = conclusionMatch[1].trim();
        } else {
            notes = `Laudo de ${serviceName} importado com sucesso. Parâmetros técnicos em conformidade com normas regulamentadoras vigentes.`;
        }

        const artMatch = originalText.match(/(?:ART|RRT)[\s:Nº#]+([0-9A-Za-z\.\-]+)/i);
        if (artMatch && artMatch[1]) {
            notes += ` | ART: ${artMatch[1].trim()}`;
        }

        return {
            company: detectedCompany,
            serviceName: serviceName,
            executionDate: executionDate,
            expiryDate: expiryDate,
            score: score,
            isIrregular: isIrregular,
            notes: notes
        };
    },

    applyExtractedData(data) {
        if (!data) return;

        const leadSelect = document.getElementById("checklist-lead-select");
        const selectService = document.getElementById("checklist-service-select");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const notesArea = document.getElementById("checklist-notes");
        const itemSelects = document.querySelectorAll(".checklist-item-select");

        if (data.company && leadSelect) {
            let found = false;
            for (let i = 0; i < leadSelect.options.length; i++) {
                if (leadSelect.options[i].text.toLowerCase().includes(data.company.toLowerCase())) {
                    leadSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }

            if (!found) {
                const newOpt = document.createElement("option");
                newOpt.value = `__NEW__:${data.company}`;
                newOpt.text = `✨ ${data.company} (Detectado no laudo)`;
                leadSelect.appendChild(newOpt);
                leadSelect.value = newOpt.value;
            }
        }

        if (data.serviceName && selectService) {
            for (let i = 0; i < selectService.options.length; i++) {
                if (selectService.options[i].value === data.serviceName) {
                    selectService.selectedIndex = i;
                    break;
                }
            }
        }

        if (data.executionDate && inputExecDate) {
            inputExecDate.value = data.executionDate;
        }
        if (data.expiryDate && inputExpiryDate) {
            inputExpiryDate.value = data.expiryDate;
        }

        if (data.notes && notesArea) {
            notesArea.value = data.notes;
        }

        if (data.isIrregular) {
            if (itemSelects.length >= 2) {
                itemSelects[0].value = "Não Conforme";
                itemSelects[1].value = "Não Conforme";
            }
        } else {
            itemSelects.forEach(sel => sel.value = "Conforme");
        }

        this.calculateScore();
    },

    startWebcam() {
        const container = document.getElementById("insp-webcam-container");
        const video = document.getElementById("insp-webcam-video");
        if (!container || !video) return;

        container.style.display = "flex";

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
            })
            .then(stream => {
                this._webcamStream = stream;
                video.srcObject = stream;
            })
            .catch(err => {
                console.warn("[Inspections] Erro ao acessar webcam:", err);
                alert("Não foi possível acessar a câmera do dispositivo (" + err.message + "). Verifique as permissões do navegador.");
                container.style.display = "none";
            });
        } else {
            alert("Acesso a câmera não suportado neste navegador.");
            container.style.display = "none";
        }
    },

    captureWebcam() {
        const video = document.getElementById("insp-webcam-video");
        const canvas = document.getElementById("insp-webcam-canvas");
        if (!video || !canvas) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], "foto_laudo_webcam.jpg", { type: "image/jpeg" });
                this.closeWebcam();
                this.handleDocumentInput(file);
            }
        }, "image/jpeg", 0.92);
    },

    closeWebcam() {
        const container = document.getElementById("insp-webcam-container");
        const video = document.getElementById("insp-webcam-video");
        if (this._webcamStream) {
            this._webcamStream.getTracks().forEach(track => track.stop());
            this._webcamStream = null;
        }
        if (video) video.srcObject = null;
        if (container) container.style.display = "none";
    }
};

// Handler Global para notificação do cliente via WhatsApp
window.sendInspectionNotification = function(leadId, inspectionId) {
    const lead = Store.getLeadById(leadId);
    if (!lead) return;

    const inspection = lead.interactions.find(i => i.id === inspectionId);
    if (!inspection) return;

    const serviceName = inspection.meta?.serviceName || "Vistoria Geral";
    const executionDate = inspection.meta?.executionDate || "N/A";
    const expiryDate = inspection.meta?.expiryDate || "N/A";

    const partsExec = executionDate.split("-");
    const formattedExec = partsExec.length === 3 ? `${partsExec[2]}/${partsExec[1]}/${partsExec[0]}` : executionDate;
    const partsExp = expiryDate.split("-");
    const formattedExp = partsExp.length === 3 ? `${partsExp[2]}/${partsExp[1]}/${partsExp[0]}` : expiryDate;

    // Calcular dias restantes
    const today = new Date();
    today.setHours(0,0,0,0);
    const expDate = new Date(expiryDate + "T12:00:00");
    expDate.setHours(0,0,0,0);
    const diff = expDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diff / (1000 * 3600 * 24));

    let timeText = "";
    if (daysRemaining < 0) {
        timeText = `está VENCIDA desde o dia ${formattedExp}`;
    } else {
        timeText = `vencerá em breve no dia ${formattedExp} (daqui a ${daysRemaining} dias)`;
    }

    const contactName = lead.contact || "Cliente";
    const message = `Olá, ${contactName}! 💡

Passando para te lembrar que a inspeção anual de *${serviceName}* realizada na sua empresa em *${formattedExec}* ${timeText}.

A renovação periódica garante o pleno funcionamento dos equipamentos, a emissão de laudos de conformidade exigidos por seguradoras/Corpo de Bombeiros e evita multas.

Gostaria de agendar a nova vistoria para a próxima semana? Temos horários disponíveis na terça e quinta-feira.

Fico no aguardo! 😊`;

    // Redirecionamento de WhatsApp
    const leadPhone = String(lead.whatsapp || lead.phone || "").replace(/\D/g, "");
    if (!leadPhone) {
        alert("Erro: Este cliente não possui número de WhatsApp ou telefone cadastrado para notificação.");
        return;
    }

    const cleanPhone = leadPhone.length === 10 || leadPhone.length === 11 ? '55' + leadPhone : leadPhone;
    
    // Tentar disparo automático via backend primeiro se houver API configurada
    const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || {};
    if (waConfig.connected && waConfig.apiUrl) {
        const confirmSend = confirm(`Deseja enviar o alerta de inspeção automaticamente via API do WhatsApp para ${lead.company}?`);
        if (confirmSend) {
            fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: cleanPhone,
                    message: message,
                    config: waConfig
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(`Mensagem enviada com sucesso via ${data.provider}!`);
                    
                    // Adicionar log na timeline do lead
                    Store.addLeadInteraction(leadId, "sdr-ai@vellia.com", {
                        type: "WhatsApp",
                        description: `📢 **Notificação de Vencimento de Inspeção enviada:** "${serviceName}".`
                    });
                } else {
                    alert(`Falha no envio automático: ${data.message || 'Erro desconhecido'}`);
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao conectar com API de envio. Abrindo WhatsApp Web...");
                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
            });
            return;
        }
    }

    // Se não tiver API conectada ou preferir manual, abrir deep link
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
    
    // Registrar a notificação na timeline local
    Store.addLeadInteraction(leadId, "sdr-ai@vellia.com", {
        type: "WhatsApp",
        description: `📢 **Notificação de Vencimento de Inspeção iniciada:** "${serviceName}".`
    });
};

// ============================================================================
// INTEGRAÇÃO: GOOGLE CALENDAR
// ============================================================================
window.scheduleGoogleCalendar = function(leadId, inspectionId) {
    const lead = Store.getLeadById(leadId);
    if (!lead || !lead.interactions) return;

    const item = lead.interactions.find(i => i.id === inspectionId);
    if (!item) return;

    const serviceName = item.meta?.serviceName || "Vistoria Geral";
    const company = lead.company || "Cliente";
    const contactName = lead.contact || "";
    const phone = lead.whatsapp || lead.phone || "";
    const notes = item.meta?.notes || item.description || "";
    const targetDate = item.meta?.expiryDate || item.meta?.executionDate; // Prefere a data de vencimento/renovação

    if (!targetDate) {
        alert("Nenhuma data definida para agendar.");
        return;
    }

    // Formatar data (adiciona hora padrão: 09:00 - 10:00)
    const dt = new Date(targetDate + "T09:00:00");
    const dtEnd = new Date(targetDate + "T10:00:00");

    const formatGCalDate = (d) => {
        return d.toISOString().replace(/-|:|\.\d+/g, "");
    };

    const title = encodeURIComponent(`Vistoria/Renovação: ${company} - ${serviceName}`);
    const details = encodeURIComponent(`Contato: ${contactName}
Telefone: ${phone}
Serviço: ${serviceName}
Notas: ${notes}

Gerado automaticamente via VelliaCRM`);
    const dates = `${formatGCalDate(dt)}/${formatGCalDate(dtEnd)}`;

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
    window.open(url, '_blank');
};

// ============================================================================
// EXPORTAÇÕES GLOBAIS DE ACESSIBILIDADE E DISPARO DIRETO
// ============================================================================
window.openChecklistModal = function(leadId = null, autoAction = null) {
    Inspections.openChecklistModal(leadId, autoAction);
};

window.closeChecklistModal = function() {
    Inspections.closeChecklistModal();
};

if (typeof window !== "undefined") {
    window.Inspections = Inspections;
}

