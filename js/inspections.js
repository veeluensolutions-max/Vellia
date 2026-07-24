import { Store } from "./store.js";
import { PDFGenerator } from "./pdf-generator.js";
import { Auth } from "./auth.js";
import { Audit } from "./audit.js";

const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";

export const Inspections = {
    async init() {
        // Mostrar loading enquanto busca dados frescos do Supabase
        const tableBody = document.getElementById("inspections-table-body");
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="7" style="padding: 40px; text-align: center; color: var(--text-muted);">⏳ Sincronizando com o banco de dados...</td></tr>`;
        }

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
                }
            }
        } catch (err) {
            console.warn("[Inspections] Falha ao sincronizar com Supabase, usando cache local:", err.message);
        }

        this.render();
        this.setupListeners();
        this.setupChecklistModal();
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
                                style="padding: 8px 12px; border-radius: 8px; font-size: 11.5px; border-color: var(--primary); color: var(--primary); background: transparent; font-weight: 700; cursor: pointer;"
                                onclick="window.generateInspectionPDF('${item.leadId}', '${item.id}')"
                                title="Gerar Laudo Oficial em PDF"
                            >
                                📄 Laudo PDF
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
        const overlay = document.getElementById("inspection-checklist-modal-overlay");
        const modal = document.getElementById("inspection-checklist-modal");
        const btnCloseX = document.getElementById("btn-close-checklist-modal-x");
        const btnCancel = document.getElementById("btn-cancel-checklist");
        const form = document.getElementById("checklist-form");
        const leadSelect = document.getElementById("checklist-lead-select");
        const selectService = document.getElementById("checklist-service-select");
        const inputExecDate = document.getElementById("checklist-date-exec");
        const inputExpiryDate = document.getElementById("checklist-date-expiry");
        const scoreVal = document.getElementById("checklist-score-val");
        const scoreBar = document.getElementById("checklist-score-bar");
        const itemSelects = document.querySelectorAll(".checklist-item-select");

        const closeChecklistModal = () => {
            const overlay = document.getElementById("inspection-checklist-modal-overlay");
            const modal = document.getElementById("inspection-checklist-modal");
            if (modal) modal.classList.remove("open");
            setTimeout(() => {
                if (modal) modal.style.display = "none";
                if (overlay) overlay.style.display = "none";
            }, 300);
        };

        if (btnOpen) {
            btnOpen.onclick = () => {
                const leads = Store.getLeads();
                if (leadSelect) {
                    leadSelect.innerHTML = `<option value="">-- Selecionar Cliente / Lead --</option>` +
                        leads.map(l => `<option value="${l.id}">${l.company} (${l.contact || 'Sem contato'})</option>`).join("");
                }

                const todayStr = new Date().toISOString().split("T")[0];
                if (inputExecDate) {
                    inputExecDate.value = todayStr;
                }
                
                const nextYear = new Date();
                nextYear.setFullYear(nextYear.getFullYear() + 1);
                if (inputExpiryDate) {
                    inputExpiryDate.value = nextYear.toISOString().split("T")[0];
                }

                itemSelects.forEach(sel => sel.value = "Conforme");

                const notesArea = document.getElementById("checklist-notes");
                if (notesArea) notesArea.value = "";

                calculateScore();

                if (overlay) overlay.style.display = "block";
                if (modal) {
                    modal.style.display = "flex";
                    setTimeout(() => modal.classList.add("open"), 10);
                }
            };
        }

        if (btnCloseX) btnCloseX.onclick = closeChecklistModal;
        if (btnCancel) btnCancel.onclick = closeChecklistModal;
        if (overlay) overlay.onclick = closeChecklistModal;

        if (inputExecDate) {
            inputExecDate.onchange = () => {
                if (inputExecDate.value) {
                    const d = new Date(inputExecDate.value + "T12:00:00");
                    d.setFullYear(d.getFullYear() + 1);
                    inputExpiryDate.value = d.toISOString().split("T")[0];
                }
            };
        }

        const calculateScore = () => {
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
                    scoreVal.style.color = "#10b981";
                } else if (score >= 50) {
                    scoreBar.style.background = "#f59e0b";
                    scoreVal.style.color = "#f59e0b";
                } else {
                    scoreBar.style.background = "#ef4444";
                    scoreVal.style.color = "#ef4444";
                }
            }
            return score;
        };

        itemSelects.forEach(sel => {
            sel.onchange = calculateScore;
        });

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const leadId = leadSelect.value;
                if (!leadId) {
                    alert("Selecione um Cliente / Lead.");
                    return;
                }

                const lead = Store.getLeadById(leadId);
                if (!lead) return;

                const service = selectService.value;
                const execDate = inputExecDate.value;
                const expiryDate = inputExpiryDate.value;
                const notes = document.getElementById("checklist-notes")?.value.trim() || "";
                
                const score = calculateScore();

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
                    description: `Vistoria de ${service} concluída com ${score}% de conformidade. Parecer: ${notes.substring(0, 100)}...`,
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

                closeChecklistModal();
                alert(`✅ Inspeção registrada com sucesso! Score de Conformidade: ${score}%`);
                
                this.init();
            };
        }
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
