import { Store } from "./store.js";

export const DataExport = {
    panel: null,
    btnToggle: null,
    btnLeads: null,
    btnProposals: null,

    init() {
        this.panel = document.getElementById("export-panel");
        this.btnToggle = document.getElementById("btn-export-menu");
        this.btnLeads = document.getElementById("btn-export-leads");
        this.btnProposals = document.getElementById("btn-export-proposals");

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
    }
};

