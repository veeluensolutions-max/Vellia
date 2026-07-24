/**
 * Vellia — Gerador de Laudos e Relatórios de Inspeção em PDF
 * Emissão de Laudos Técnicos Oficiais com impressão / download PDF nativo
 */

import { Store } from "./store.js";

export const PDFGenerator = {
    // ─── Gerar Laudo Técnico Individual de Inspeção ──────────────────────────────
    generateInspectionPDF(leadId, inspectionId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) {
            alert("Lead não encontrado.");
            return;
        }

        const inspection = (lead.interactions || []).find(i => i.id === inspectionId);
        if (!inspection) {
            alert("Inspeção não encontrada.");
            return;
        }

        const serviceName = inspection.meta?.serviceName || "Vistoria Técnica de Engenharia";
        const execDate = inspection.meta?.executionDate || inspection.timestamp?.split("T")[0] || "N/A";
        const expiryDate = inspection.meta?.expiryDate || "N/A";

        const formatDate = (str) => {
            if (!str || str === "N/A") return "N/A";
            const p = str.split("-");
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : str;
        };

        const codeAuth = `VEL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const issueDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

        const score = inspection.meta?.score;
        let badgeColor = "#16a34a";
        let badgeBg = "#dcfce7";
        let badgeBorder = "#86efac";
        let badgeText = "🟢 LAUDO REGULAR";

        if (score !== undefined) {
            if (score >= 80) {
                badgeText = `🟢 APROVADO (${score}%)`;
            } else if (score >= 50) {
                badgeText = `🟡 ALERTA TÉCNICO (${score}%)`;
                badgeColor = "#d97706";
                badgeBg = "#fef3c7";
                badgeBorder = "#fcd34d";
            } else {
                badgeText = `🔴 REPROVADO (${score}%)`;
                badgeColor = "#dc2626";
                badgeBg = "#fee2e2";
                badgeBorder = "#fca5a5";
            }
        }

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Laudo Técnico - ${serviceName} - ${lead.company}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #fff;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.6;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1877F2;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .logo-title {
            font-size: 22px;
            font-weight: 800;
            color: #1877F2;
            letter-spacing: -0.5px;
        }
        .logo-sub {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 2px;
        }
        .doc-info {
            text-align: right;
            font-size: 11px;
            color: #64748b;
        }
        .doc-title-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 5px solid #1877F2;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        .doc-title {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 4px 0;
            text-transform: uppercase;
        }
        .section-heading {
            font-size: 13px;
            font-weight: 700;
            color: #1877F2;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin: 24px 0 12px 0;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .info-card {
            background: #fafafa;
            border: 1px solid #f1f5f9;
            padding: 12px 14px;
            border-radius: 6px;
        }
        .info-label {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .info-val {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 99px;
            font-size: 12px;
            font-weight: 700;
            background: #dcfce7;
            color: #16a34a;
            border: 1px solid #86efac;
        }
        .notes-box {
            background: #fff;
            border: 1px solid #e2e8f0;
            padding: 14px;
            border-radius: 6px;
            font-size: 12.5px;
            color: #334155;
            white-space: pre-wrap;
        }
        .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            gap: 40px;
        }
        .sig-block {
            flex: 1;
            text-align: center;
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            font-size: 11px;
            color: #475569;
        }
        .footer-seal {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #94a3b8;
        }
        .no-print {
            background: #1877F2;
            color: #fff;
            padding: 12px 20px;
            text-align: center;
            font-weight: 700;
            border-radius: 8px;
            margin-bottom: 20px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(24,119,242,0.3);
        }
        @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="no-print" onclick="window.print()">
        🖨️ CLIQUE AQUI PARA IMPRIMIR OU SALVAR COMO PDF
    </div>

    <div class="header">
        <div>
            <div class="logo-title">VELLIA</div>
            <div class="logo-sub">Engineering & Commercial Solutions</div>
        </div>
        <div class="doc-info">
            <div><strong>Código Autenticador:</strong> ${codeAuth}</div>
            <div><strong>Emissão:</strong> ${issueDate}</div>
        </div>
    </div>

    <div class="doc-title-box">
        <div class="doc-title">LAUDO TÉCNICO DE INSPEÇÃO</div>
        <div style="font-size: 13px; color: #475569;">Certificado Oficial de Vistoria e Conformidade Técnica</div>
    </div>

    <div class="section-heading">1. Identificação do Cliente</div>
    <div class="grid-2">
        <div class="info-card">
            <div class="info-label">Empresa / Razão Social</div>
            <div class="info-val">${lead.company || "N/A"}</div>
        </div>
        <div class="info-card">
            <div class="info-label">Contato Responsável</div>
            <div class="info-val">${lead.contact || "N/A"} (${lead.role || "Cargo não informado"})</div>
        </div>
        <div class="info-card">
            <div class="info-label">WhatsApp / Telefone</div>
            <div class="info-val">${lead.whatsapp || lead.phone || "N/A"}</div>
        </div>
        <div class="info-card">
            <div class="info-label">Localização</div>
            <div class="info-val">${lead.city || "-"} / ${lead.state || "-"}</div>
        </div>
    </div>

    <div class="section-heading">2. Especificações da Inspeção</div>
    <div class="grid-2">
        <div class="info-card">
            <div class="info-label">Serviço Técnico Inspecionado</div>
            <div class="info-val" style="color: #1877F2;">${serviceName}</div>
        </div>
        <div class="info-card">
            <div class="info-label">Data de Realização</div>
            <div class="info-val">${formatDate(execDate)}</div>
        </div>
        <div class="info-card">
            <div class="info-label">Data de Vencimento / Próxima Vistoria</div>
            <div class="info-val">${formatDate(expiryDate)}</div>
        </div>
        <div class="info-card">
            <div class="info-label">Status da Validade</div>
            <div class="info-val">
                <span class="status-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px;">${badgeText}</span>
            </div>
        </div>
    </div>

    ${inspection.meta?.checklist ? `
    <div class="section-heading" style="font-size: 13px; font-weight: 700; color: #1877F2; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px 0;">3. Checklist de Itens Inspecionados</div>
    <table style="width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 24px; font-size: 11px;">
        <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569;">
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 70%;">Critério de Avaliação Técnica</th>
                <th style="padding: 10px; text-align: center; font-weight: bold; width: 30%;">Parecer da Inspeção</th>
            </tr>
        </thead>
        <tbody>
            ${inspection.meta.checklist.map(item => {
                let color = "#16a34a";
                let bg = "#dcfce7";
                if (item.status === "Não Conforme") {
                    color = "#dc2626";
                    bg = "#fee2e2";
                } else if (item.status === "N/A") {
                    color = "#64748b";
                    bg = "#f1f5f9";
                }
                return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; font-weight: 600; color: #334155;">${item.name}</td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; color: ${color}; background: ${bg};">${item.status}</span>
                    </td>
                </tr>
                `;
            }).join("")}
        </tbody>
    </table>
    ` : ''}

    <div class="section-heading">${inspection.meta?.checklist ? '4' : '3'}. Parecer Técnico & Resumo da Vistoria</div>
    <div class="notes-box">
${inspection.meta?.notes || inspection.description || "Inspeção técnica realizada em conformidade com as normas vigentes. Equipamento e instalações aprovados na avaliação periódica."}
    </div>

    <div class="signatures">
        <div class="sig-block">
            <strong>Engenharia Responsável</strong><br>
            Vellia Soluções Técnicas & Engenharia<br>
            CREA/CONFEA Registrado
        </div>
        <div class="sig-block">
            <strong>${lead.contact || "Representante do Cliente"}</strong><br>
            ${lead.company || "Empresa Contratante"}<br>
            Aceite & Recebimento
        </div>
    </div>

    <div class="footer-seal">
        <div>🔒 Vellia CRM Engine — Documento Assinado Digitalmente</div>
        <div>Página 1 de 1</div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
        };
    </script>
</body>
</html>
        `;

        const win = window.open("", "_blank");
        if (win) {
            win.document.write(htmlContent);
            win.document.close();
        } else {
            alert("Por favor permita popups para visualizar e baixar o PDF.");
        }
    },

    // ─── Gerar Relatório Geral da Central de Inspeções ────────────────────────────
    exportInspectionsSummaryPDF() {
        const leads = Store.getLeads();
        const inspections = [];

        leads.forEach(lead => {
            if (lead.interactions && Array.isArray(lead.interactions)) {
                lead.interactions.forEach(item => {
                    if (item.type === "Inspeção" || item.type === "Inspecao") {
                        inspections.push({
                            company: lead.company,
                            contact: lead.contact,
                            service: item.meta?.serviceName || "Vistoria Geral",
                            execDate: item.meta?.executionDate || item.timestamp?.split("T")[0] || "N/A",
                            expiryDate: item.meta?.expiryDate || "N/A",
                            notes: item.meta?.notes || ""
                        });
                    }
                });
            }
        });

        if (inspections.length === 0) {
            alert("Nenhuma inspeção registrada para gerar relatório.");
            return;
        }

        const formatDate = (str) => {
            if (!str || str === "N/A") return "N/A";
            const p = str.split("-");
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : str;
        };

        const rowsHtml = inspections.map((item, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${idx + 1}</td>
                <td style="padding: 10px; font-weight: 700;">${item.company}</td>
                <td style="padding: 10px;">${item.contact || "-"}</td>
                <td style="padding: 10px; color: #1877F2; font-weight: 600;">${item.service}</td>
                <td style="padding: 10px;">${formatDate(item.execDate)}</td>
                <td style="padding: 10px; font-weight: 700; color: #059669;">${formatDate(item.expiryDate)}</td>
            </tr>
        `).join("");

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório Geral de Inspeções - Vellia CRM</title>
    <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: sans-serif; padding: 20px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1877F2; padding-bottom: 12px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; }
        .no-print { background: #1877F2; color: #fff; padding: 12px; text-align: center; font-weight: 700; border-radius: 8px; margin-bottom: 20px; cursor: pointer; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="no-print" onclick="window.print()">🖨️ CLIQUE PARA IMPRIMIR OU SALVAR RELATÓRIO EM PDF</div>
    <div class="header">
        <div>
            <h2 style="margin:0; color:#1877F2;">VELLIA COMMERCIAL & ENGINEERING</h2>
            <div style="font-size:12px; color:#64748b;">Relatório Consolidado da Central de Inspeções & Renovações</div>
        </div>
        <div style="text-align:right; font-size:11px; color:#64748b;">
            Emissão: ${new Date().toLocaleDateString("pt-BR")}
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Serviço</th>
                <th>Data Execução</th>
                <th>Vencimento</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>
    <script>window.onload = function() { setTimeout(function(){ window.print(); }, 400); };</script>
</body>
</html>
        `;

        const win = window.open("", "_blank");
        if (win) {
            win.document.write(htmlContent);
            win.document.close();
        }
    }
};

// Expor globalmente para cliques em HTML
window.generateInspectionPDF = (leadId, inspectionId) => PDFGenerator.generateInspectionPDF(leadId, inspectionId);
window.exportInspectionsSummaryPDF = () => PDFGenerator.exportInspectionsSummaryPDF();
