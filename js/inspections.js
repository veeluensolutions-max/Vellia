import { Store } from "./store.js";

export const Inspections = {
    init() {
        this.render();
        this.setupListeners();
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
                            notes: item.meta?.notes || item.description
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

            return `
                <tr style="${rowStyle} border-bottom: 1px solid var(--border-color); transition: all 0.2s;">
                    <td style="padding: 16px 20px;">
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 13.5px;">${item.company}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Contato: ${item.contact}</div>
                    </td>
                    <td style="padding: 16px 20px; font-weight: 600; color: var(--text-primary);">${item.serviceName}</td>
                    <td style="padding: 16px 20px; color: var(--text-secondary);">${formatDate(item.executionDate)}</td>
                    <td style="padding: 16px 20px; color: var(--text-secondary); font-weight: 600;">${formatDate(item.expiryDate)}</td>
                    <td style="padding: 16px 20px;">${remainingText}</td>
                    <td style="padding: 16px 20px; text-align: center;">${statusBadge}</td>
                    <td style="padding: 16px 20px; text-align: center;">
                        <button 
                            class="btn btn-sm"
                            style="${buttonStyle} padding: 8px 14px; border-radius: 8px; font-size: 11.5px; transition: all 0.2s;"
                            onclick="window.sendInspectionNotification('${item.leadId}', '${item.id}')"
                            ${buttonDisabled}
                        >
                            ${buttonText}
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
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

        // Listener de sincronização em tempo real
        window.addEventListener("vellia:waSent", () => this.render());
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
