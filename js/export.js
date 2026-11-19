import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const DataExport = {
    panel: null,
    btnToggle: null,
    btnLeads: null,
    btnProposals: null,
    btnFullBackup: null,

    init() {
        window.DataExport = this;
        this.panel = document.getElementById("export-panel");
        this.btnToggle = document.getElementById("btn-export-menu");
        this.btnLeads = document.getElementById("btn-export-leads");
        this.btnProposals = document.getElementById("btn-export-proposals");
        this.btnFullBackup = document.getElementById("btn-export-full-excel");

        const btnDashBackup = document.getElementById("btn-dashboard-backup-excel");
        if (btnDashBackup) {
            btnDashBackup.addEventListener("click", () => this.exportFullExcelBackup());
        }

        if (!this.panel || !this.btnToggle) return;

        this.bindEvents();
    },

    bindEvents() {
        this.btnToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        document.addEventListener("click", (e) => {
            if (this.panel.style.display === "flex" && !this.panel.contains(e.target) && !this.btnToggle.contains(e.target)) {
                this.closePanel();
            }
        });

        if (this.btnFullBackup) {
            this.btnFullBackup.addEventListener("click", () => {
                this.exportFullExcelBackup();
                this.closePanel();
            });
        }

        if (this.btnLeads) {
            this.btnLeads.addEventListener("click", () => {
                this.exportLeads();
                this.closePanel();
            });
        }

        if (this.btnProposals) {
            this.btnProposals.addEventListener("click", () => {
                this.exportProposals();
                this.closePanel();
            });
        }
    },

    togglePanel() {
        const isHidden = !this.panel.style.display || this.panel.style.display === "none";
        this.panel.style.display = isHidden ? "flex" : "none";
        this.panel.style.flexDirection = "column"; // Ensure it behaves like notifications panel
    },

    closePanel() {
        this.panel.style.display = "none";
    },

    exportLeads() {
        const leads = Store.getLeads();
        if (leads.length === 0) {
            alert("Nenhum lead para exportar.");
            return;
        }

        const headers = ["ID", "Empresa", "Contato", "Email", "Telefone", "Cidade", "Estado", "Segmento", "Estágio", "Origem", "Criado Em"];
        const rows = leads.map(l => [
            l.id,
            this.escapeCSV(l.company),
            this.escapeCSV(l.contact),
            this.escapeCSV(l.email),
            this.escapeCSV(l.phone),
            this.escapeCSV(l.city),
            this.escapeCSV(l.state),
            this.escapeCSV(l.segment),
            this.escapeCSV(l.stage),
            this.escapeCSV(l.source),
            l.createdAt || ""
        ]);

        const csvContent = this.buildCSV(headers, rows);
        this.downloadFile("vellia_leads_export.csv", csvContent);
    },

    exportProposals() {
        const proposals = Store.getProposals();
        if (proposals.length === 0) {
            alert("Nenhuma proposta para exportar.");
            return;
        }

        const headers = ["ID", "Lead_ID", "Empresa", "Contato", "Título", "Valor", "Status", "Vencimento", "Criado Por", "Criado Em"];
        const rows = proposals.map(p => [
            p.id,
            p.leadId,
            this.escapeCSV(p.company),
            this.escapeCSV(p.contact),
            this.escapeCSV(p.title),
            p.value,
            this.escapeCSV(p.status),
            p.validUntil || "",
            this.escapeCSV(p.createdBy),
            p.createdAt || ""
        ]);

        const csvContent = this.buildCSV(headers, rows);
        this.downloadFile("vellia_propostas_export.csv", csvContent);
    },

    escapeCSV(text) {
        if (text === null || text === undefined) return "";
        const str = String(text);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    },

    buildCSV(headers, rows) {
        // Add BOM for Excel UTF-8 encoding
        const bom = "\uFEFF";
        const headerString = headers.join(",");
        const rowString = rows.map(r => r.join(",")).join("\n");
        return bom + headerString + "\n" + rowString;
    },

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    exportExecutiveReportPDF() {
        const leads = Store.getLeads();
        const proposals = Store.getProposals();
        const users = Store.getUsers();
        
        const totalLeads = leads.length;
        const totalPipelineValue = proposals.filter(p => p.status !== "Perdido").reduce((s, p) => s + (p.value || 0), 0);
        const wonProposals = proposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status));
        const wonValue = wonProposals.reduce((s, p) => s + (p.value || 0), 0);
        const conversionRate = totalLeads > 0 ? ((wonProposals.length / totalLeads) * 100).toFixed(1) : "0.0";
        
        const codeAuth = `REP-EXEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
        const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        const stages = ["Lead Gerado", "Contato", "Lead Qualificado", "Proposta Enviada", "Negociação", "Cliente Fechado", "Cliente Perdido"];
        const stageRowsHtml = stages.map(stg => {
            const count = leads.filter(l => l.stage === stg).length;
            const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : "0.0";
            return `<tr><td><strong>${stg}</strong></td><td>${count}</td><td>${pct}%</td></tr>`;
        }).join("");

        const sellerRowsHtml = users.filter(u => u.role === "seller" || u.role === "admin" || u.role === "manager").map(u => {
            const userLeads = leads.filter(l => l.owner === u.email);
            const userWonProps = proposals.filter(p => (p.createdBy === u.email || userLeads.some(l => l.id === p.leadId)) && ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status));
            const userRev = userWonProps.reduce((s, p) => s + (p.value || 0), 0);
            return `<tr>
                <td><strong>${u.name}</strong> (${u.role})</td>
                <td>${userLeads.length}</td>
                <td>${userWonProps.length}</td>
                <td>R$ ${userRev.toLocaleString('pt-BR')}</td>
            </tr>`;
        }).join("");

        const printWin = window.open('', '_blank');
        if (!printWin) {
            alert("Por favor, permita popups para gerar o Relatório Executivo.");
            return;
        }

        printWin.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório Executivo Consolidado - Vellia CRM</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Inter', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; padding: 20px; font-size: 13px; line-height: 1.6; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1877F2; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 800; color: #1877F2; letter-spacing: -0.5px; }
        .sublogo { font-size: 11px; color: #64748b; text-transform: uppercase; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
        .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
        .kpi-val { font-size: 20px; font-weight: 800; color: #1877F2; }
        .kpi-lbl { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .section-title { font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #1877F2; padding-left: 8px; margin: 24px 0 12px 0; text-transform: uppercase; }
        .no-print { background: #1877F2; color: #fff; padding: 12px 20px; text-align: center; font-weight: 700; border-radius: 8px; margin-bottom: 20px; cursor: pointer; }
        @media print { .no-print { display: none !important; } }
    </style>
</head>
<body>
    <div class="no-print" onclick="window.print()">
        🖨️ CLIQUE AQUI PARA IMPRIMIR OU SALVAR COMO PDF
    </div>

    <div class="header">
        <div>
            <div class="logo">VELLIA CRM</div>
            <div class="sublogo">Sistema Comercial Inteligente • Relatório Executivo</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div style="color: #1877F2; font-weight: 800;">📊 AUDITORIA COMERCIAL</div>
            <div><strong>Código:</strong> ${codeAuth}</div>
            <div><strong>Emissão:</strong> ${todayStr}</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-box">
            <div class="kpi-val">${totalLeads}</div>
            <div class="kpi-lbl">Total de Leads</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-val">R$ ${totalPipelineValue.toLocaleString('pt-BR')}</div>
            <div class="kpi-lbl">Valor do Funil</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-val">R$ ${wonValue.toLocaleString('pt-BR')}</div>
            <div class="kpi-lbl">Receita Convertida</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-val">${conversionRate}%</div>
            <div class="kpi-lbl">Taxa de Conversão</div>
        </div>
    </div>

    <div class="section-title">1. Distribuição de Leads por Estágio</div>
    <table>
        <thead><tr><th>Estágio do Funil</th><th>Quantidade de Leads</th><th>Percentual (%)</th></tr></thead>
        <tbody>${stageRowsHtml}</tbody>
    </table>

    <div class="section-title">2. Desempenho por Vendedor</div>
    <table>
        <thead><tr><th>Vendedor / Perfil</th><th>Leads Atribuídos</th><th>Vendas Fechadas</th><th>Faturamento Convertido</th></tr></thead>
        <tbody>${sellerRowsHtml}</tbody>
    </table>

    <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center;">
        Relatório Executivo Consolidado • Gerado automaticamente via Vellia CRM • Código Rastreio: ${codeAuth}
    </div>
</body>
</html>
        `);
        printWin.document.close();
    },

    /**
     * Gera e baixa uma cópia completa de segurança (backup físico) de todas as bases de dados
     * do Vellia CRM em formato Excel (.xlsx), com abas organizadas para Leads, Propostas,
     * Itens Orçados, Contratos, Histórico de Interações, Usuários e Resumo de Integridade.
     */
    async exportFullExcelBackup() {
        try {
            // 1. Carregar SheetJS (XLSX)
            let XLSX = window.XLSX;
            if (!XLSX) {
                if (typeof showToast === "function") {
                    showToast("Carregando motor de planilhas Excel...", "info");
                }
                XLSX = await window.LazyLoader?.ensureXLSX?.();
            }

            if (!XLSX) {
                alert("Não foi possível carregar o motor de exportação Excel. Verifique a conexão.");
                return;
            }

            if (typeof showToast === "function") {
                showToast("Gerando backup completo das bases de dados em Excel...", "info");
            }

            // 2. Coletar dados do Store
            const leads = Store.getLeads() || [];
            const proposals = Store.getProposals() || [];
            const contracts = Store.getContracts() || [];
            const users = Store.getUsers() || [];
            const currentUser = Auth.getCurrentUser() || { name: "Usuário", email: "sistema@vellia.com" };

            // 3. Formatar Aba: Leads e Clientes
            const leadsRows = leads.map(l => ({
                "ID": l.id || "",
                "Nome Fantasia / Empresa": l.company || "",
                "Razão Social": l.corporateName || l.razaoSocial || "",
                "CNPJ": l.cnpj || "",
                "Contato Principal": l.contact || "",
                "Cargo": l.role || "",
                "WhatsApp": l.whatsapp || "",
                "Telefone Principal": l.phone || "",
                "Telefone 2": l.phone2 || "",
                "E-mail Principal": l.email || "",
                "E-mail 2": l.email2 || "",
                "Cidade": l.city || "",
                "Estado (UF)": l.state || "",
                "CEP": l.cep || "",
                "Endereço Completo": l.address || "",
                "Segmento": l.segment || "",
                "Origem do Lead": l.source || "",
                "Estágio Atual": l.stage || "",
                "Responsável (Vendedor)": l.owner || "",
                "Score / Temperatura": l.score ? `${l.score} (${l.temperature || ''})` : (l.temperature || ""),
                "Valor Estimado (R$)": Number(l.estimatedValue || 0),
                "Data de Cadastro": l.createdAt ? new Date(l.createdAt).toLocaleString("pt-BR") : "",
                "Última Interação": l.lastInteraction ? new Date(l.lastInteraction).toLocaleString("pt-BR") : "",
                "Observações Gerais": l.notes || ""
            }));

            // 4. Formatar Aba: Propostas e Orçamentos
            const proposalsRows = proposals.map(p => ({
                "ID": p.id || "",
                "Número do Orçamento": p.budgetNumber || p.id || "",
                "Empresa / Cliente": p.company || "",
                "Contato": p.contact || "",
                "Título da Proposta": p.title || "",
                "Serviço Principal": p.service || "",
                "Valor Bruto (R$)": Number(p.value || 0),
                "Desconto (%)": Number(p.discount || 0),
                "Valor Final (R$)": Number(p.finalValue || p.value || 0),
                "Status": p.status || "",
                "Data de Envio": p.sentAt ? new Date(p.sentAt).toLocaleDateString("pt-BR") : "",
                "Válida Até": p.validUntil ? new Date(p.validUntil).toLocaleDateString("pt-BR") : "",
                "Data de Fechamento": p.closedAt ? new Date(p.closedAt).toLocaleDateString("pt-BR") : "",
                "Vendedor / Responsável": p.seller || p.createdBy || "",
                "Canal": p.channel || "",
                "Centro de Custo": p.costCenter || "",
                "Motivo de Perda": p.lossReason || "",
                "Concorrente": p.competitor || "",
                "Observações / Condições": p.notes || ""
            }));

            // 5. Formatar Aba: Itens dos Orçamentos (Serviços e Produtos)
            const itemsRows = [];
            proposals.forEach(p => {
                const propNum = p.budgetNumber || p.id || "";
                if (Array.isArray(p.servicesList) && p.servicesList.length > 0) {
                    p.servicesList.forEach(s => {
                        const qty = Number(s.qty || 1);
                        const price = Number(s.price || 0);
                        itemsRows.push({
                            "ID Proposta": p.id,
                            "Número Orçamento": propNum,
                            "Empresa": p.company || "",
                            "Tipo de Item": "Serviço",
                            "Item / Serviço": s.service || s.name || "",
                            "Detalhes / Especificação": s.details || "",
                            "Quantidade": qty,
                            "Valor Unitário (R$)": price,
                            "Subtotal (R$)": qty * price
                        });
                    });
                } else if (p.service || p.title) {
                    itemsRows.push({
                        "ID Proposta": p.id,
                        "Número Orçamento": propNum,
                        "Empresa": p.company || "",
                        "Tipo de Item": "Serviço Principal",
                        "Item / Serviço": p.service || p.title || "",
                        "Detalhes / Especificação": p.title || "",
                        "Quantidade": 1,
                        "Valor Unitário (R$)": Number(p.value || 0),
                        "Subtotal (R$)": Number(p.value || 0)
                    });
                }

                if (Array.isArray(p.productsList) && p.productsList.length > 0) {
                    p.productsList.forEach(prod => {
                        const qty = Number(prod.qty || 1);
                        const price = Number(prod.price || 0);
                        itemsRows.push({
                            "ID Proposta": p.id,
                            "Número Orçamento": propNum,
                            "Empresa": p.company || "",
                            "Tipo de Item": "Produto / Material",
                            "Item / Serviço": prod.product || prod.name || "",
                            "Detalhes / Especificação": prod.details || "",
                            "Quantidade": qty,
                            "Valor Unitário (R$)": price,
                            "Subtotal (R$)": qty * price
                        });
                    });
                }
            });

            // 6. Formatar Aba: Contratos
            const contractsRows = contracts.map(c => {
                const lead = leads.find(l => l.id === c.leadId);
                return {
                    "ID": c.id || "",
                    "Número do Contrato": c.number || c.id || "",
                    "Empresa / Cliente": lead ? lead.company : (c.company || ""),
                    "Status": c.status || "",
                    "Valor Total (R$)": Number(c.totalValue || 0),
                    "Valor Recorrente (R$)": Number(c.recurringValue || 0),
                    "Periodicidade": c.periodicity || "Mensal",
                    "Data Início": c.startDate ? new Date(c.startDate).toLocaleDateString("pt-BR") : "",
                    "Data Término": c.endDate ? new Date(c.endDate).toLocaleDateString("pt-BR") : "",
                    "Renovação Automática": c.autoRenew ? "Sim" : "Não",
                    "Responsável": c.owner || c.createdBy || "",
                    "Observações": c.notes || ""
                };
            });

            // 7. Formatar Aba: Histórico de Interações
            const interactionsRows = [];
            leads.forEach(lead => {
                if (Array.isArray(lead.interactions)) {
                    lead.interactions.forEach(int => {
                        interactionsRows.push({
                            "Data e Hora": int.timestamp ? new Date(int.timestamp).toLocaleString("pt-BR") : "",
                            "Empresa": lead.company || "",
                            "Contato": lead.contact || "",
                            "Tipo": int.type || "Interação",
                            "Usuário / Autor": int.userEmail || "",
                            "Detalhes / Mensagem": int.description || ""
                        });
                    });
                }
                if (Array.isArray(lead.stageHistory)) {
                    lead.stageHistory.forEach(stg => {
                        interactionsRows.push({
                            "Data e Hora": stg.timestamp ? new Date(stg.timestamp).toLocaleString("pt-BR") : "",
                            "Empresa": lead.company || "",
                            "Contato": lead.contact || "",
                            "Tipo": "Mudança de Estágio",
                            "Usuário / Autor": stg.userEmail || "",
                            "Detalhes / Mensagem": `Estágio alterado para: ${stg.stage || ''}. ${stg.reason || ''}`
                        });
                    });
                }
            });

            // Ordenar interações da mais recente para a mais antiga
            interactionsRows.sort((a, b) => (b["Data e Hora"] || "").localeCompare(a["Data e Hora"] || ""));

            // 8. Formatar Aba: Usuários da Equipe
            const usersRows = users.map(u => ({
                "ID": u.id || "",
                "Nome Completo": u.name || "",
                "E-mail de Acesso": u.email || "",
                "Perfil / Função": u.role || "",
                "Telefone / WhatsApp": u.phone || "",
                "Status": u.active !== false ? "Ativo" : "Inativo",
                "Cadastrado em": u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : ""
            }));

            // 9. Formatar Aba: Resumo do Backup
            const now = new Date();
            const dateStr = now.toLocaleDateString("pt-BR");
            const timeStr = now.toLocaleTimeString("pt-BR");
            const summaryRows = [
                { "Item": "Sistema", "Valor": "Vellia CRM - Plataforma Comercial Oficial" },
                { "Item": "Data da Exportação", "Valor": `${dateStr} às ${timeStr}` },
                { "Item": "Gerado Por", "Valor": `${currentUser.name} (${currentUser.email})` },
                { "Item": "Finalidade", "Valor": "Cópia Física de Segurança e Armazenamento Local" },
                { "Item": "Total de Leads / Clientes", "Valor": leads.length },
                { "Item": "Total de Propostas Comerciais", "Valor": proposals.length },
                { "Item": "Total de Itens Orçados", "Valor": itemsRows.length },
                { "Item": "Total de Contratos", "Valor": contracts.length },
                { "Item": "Total de Registros de Interações", "Valor": interactionsRows.length },
                { "Item": "Total de Usuários Cadastrados", "Valor": users.length },
                { "Item": "Integridade dos Dados", "Valor": "Base consolidada (Sincronizada com Supabase)" }
            ];

            // 10. Criar Pasta de Trabalho do Excel (Workbook)
            const wb = XLSX.utils.book_new();

            // Adicionar abas
            const addSheet = (data, sheetName) => {
                const ws = data.length > 0 
                    ? XLSX.utils.json_to_sheet(data)
                    : XLSX.utils.aoa_to_sheet([["Nenhum registro encontrado nesta base."]]);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            };

            addSheet(summaryRows, "Resumo do Backup");
            addSheet(leadsRows, "Leads e Clientes");
            addSheet(proposalsRows, "Propostas Comerciais");
            if (itemsRows.length > 0) addSheet(itemsRows, "Itens dos Orçamentos");
            addSheet(contractsRows, "Contratos");
            addSheet(interactionsRows, "Histórico de Atividades");
            addSheet(usersRows, "Equipe e Usuários");

            // 11. Gerar e baixar arquivo .xlsx
            const pad = (n) => String(n).padStart(2, "0");
            const yyyy = now.getFullYear();
            const mm = pad(now.getMonth() + 1);
            const dd = pad(now.getDate());
            const hh = pad(now.getHours());
            const min = pad(now.getMinutes());
            const filename = `Backup_Vellia_CRM_${yyyy}-${mm}-${dd}_${hh}h${min}.xlsx`;

            XLSX.writeFile(wb, filename);

            Store.addLog(currentUser.email, "DATA_BACKUP_EXCEL", `Backup completo do sistema em Excel exportado (${filename})`);

            if (typeof showToast === "function") {
                showToast(`Backup em Excel gerado com sucesso! Arquivo: ${filename}`, "success");
            } else {
                alert(`✅ Backup Completo do Vellia CRM gerado com sucesso!\n\nArquivo baixado: ${filename}\n\nO arquivo contém todas as abas: Leads, Propostas, Itens, Contratos, Histórico de Atividades e Usuários.`);
            }
        } catch (error) {
            console.error("❌ Erro ao gerar backup em Excel:", error);
            alert("Erro ao gerar o backup em Excel: " + (error.message || error));
        }
    }
};

