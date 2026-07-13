import { Store } from "./store.js";

// ============================================================
// Vellia CRM — Módulo de Relatório de Desempenho em PDF
// Usa jsPDF (carregado via CDN no index.html)
// ============================================================

const BRAND_COLOR = [59, 130, 246];
const DARK_COLOR  = [15, 23, 42];
const GRAY_COLOR  = [100, 116, 139];
const WHITE       = [255, 255, 255];
const GREEN_COLOR = [16, 185, 129];
const RED_COLOR   = [239, 68, 68];
const ORANGE_COLOR = [245, 158, 11];

function fmtCurrency(v) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
}

function fmtDate(isoStr) {
    if (!isoStr) return "—";
    return new Date(isoStr).toLocaleDateString("pt-BR");
}

function pct(part, total) {
    if (!total) return 0;
    return Math.min(100, Math.round((part / total) * 100));
}

function drawProgressBar(doc, x, y, w, h, percent, color) {
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    if (percent > 0) {
        const fillW = Math.max(h, (percent / 100) * w);
        doc.setFillColor(...color);
        doc.roundedRect(x, y, fillW, h, h / 2, h / 2, "F");
    }
}

function drawSectionTitle(doc, text, y) {
    doc.setFillColor(...BRAND_COLOR);
    doc.rect(14, y, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK_COLOR);
    doc.text(text, 20, y + 4.5);
    return y + 12;
}

function drawCard(doc, x, y, w, h, title, value, subtitle, valueColor) {
    const vc = valueColor || DARK_COLOR;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 3, 3, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_COLOR);
    doc.text(title, x + 5, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...vc);
    doc.text(String(value), x + 5, y + 19);
    if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GRAY_COLOR);
        doc.text(subtitle, x + 5, y + 26);
    }
}

export function generatePerformancePDF(userEmail) {
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib || !jsPDFLib.jsPDF) {
        alert("Biblioteca PDF não carregada. Recarregue a página e tente novamente.");
        return;
    }
    const { jsPDF } = jsPDFLib;

    const user = Store.getUserByEmail(userEmail);
    if (!user) { alert("Usuário não encontrado."); return; }

    const allLeads = Store.getLeads();
    const allProposals = Store.getProposals();
    const userLeads = allLeads.filter(l => l.owner === userEmail);
    const userProposals = allProposals.filter(p =>
        p.createdBy === userEmail || userLeads.some(l => l.id === p.leadId)
    );

    const now = new Date();
    const period = `${now.toLocaleString("pt-BR", { month: "long" })} de ${now.getFullYear()}`;
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const goalObj = Store.getGoalByUserAndPeriod(userEmail, periodKey);
    const targets = goalObj?.targets || { revenue: 0, proposals: 0, leadsQualified: 0 };

    const wonProps   = userProposals.filter(p => p.status === "Ganho");
    const lostProps  = userProposals.filter(p => p.status === "Perdido");
    const totalRevenue = wonProps.reduce((s, p) => s + (p.value || 0), 0);
    const leadsQualified = userLeads.filter(l => !["Contato", "Cliente Perdido"].includes(l.stage)).length;
    const leadsByStage = {};
    userLeads.forEach(l => { leadsByStage[l.stage] = (leadsByStage[l.stage] || 0) + 1; });

    const todayTasks = Store.getTasks(userEmail);
    const doneTasksCount = todayTasks.filter(t => t.done).length;
    const roleLabel = { admin: "Administrador", manager: "Gerente Comercial", seller: "Vendedor" }[user.role] || user.role;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;

    // HEADER
    doc.setFillColor(...DARK_COLOR);
    doc.rect(0, 0, pageW, 42, "F");

    doc.setFillColor(...BRAND_COLOR);
    doc.roundedRect(14, 10, 28, 22, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text("Vellia", 17, 24);
    doc.setFontSize(7);
    doc.text("CRM", 33, 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...WHITE);
    doc.text("Relatório de Desempenho", 50, 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Período: ${period}   •   Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 50, 28);

    // User chip
    const chipX = pageW - 72;
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(chipX, 10, 58, 22, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    const shortName = user.name.split(" ").slice(0, 2).join(" ");
    doc.text(shortName, chipX + 5, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(roleLabel, chipX + 5, 29);

    let y = 54;
    const revenueGoalPct    = pct(totalRevenue, targets.revenue);
    const proposalsGoalPct  = pct(wonProps.length, targets.proposals);
    const leadsGoalPct      = pct(leadsQualified, targets.leadsQualified);

    // METAS
    y = drawSectionTitle(doc, "Metas do Mês", y);
    const cardW = (pageW - 28 - 8) / 3;
    const cardH = 38;

    drawCard(doc, 14, y, cardW, cardH, "RECEITA GERADA",
        fmtCurrency(totalRevenue), `Meta: ${fmtCurrency(targets.revenue)}`,
        revenueGoalPct >= 100 ? GREEN_COLOR : revenueGoalPct >= 50 ? ORANGE_COLOR : RED_COLOR);
    drawProgressBar(doc, 14 + 5, y + 32, cardW - 10, 3, revenueGoalPct,
        revenueGoalPct >= 100 ? GREEN_COLOR : revenueGoalPct >= 50 ? ORANGE_COLOR : RED_COLOR);

    drawCard(doc, 14 + cardW + 4, y, cardW, cardH, "PROPOSTAS GANHAS",
        wonProps.length, `Meta: ${targets.proposals}`,
        proposalsGoalPct >= 100 ? GREEN_COLOR : BRAND_COLOR);
    drawProgressBar(doc, 14 + cardW + 4 + 5, y + 32, cardW - 10, 3, proposalsGoalPct, BRAND_COLOR);

    drawCard(doc, 14 + (cardW + 4) * 2, y, cardW, cardH, "LEADS QUALIFICADOS",
        leadsQualified, `Meta: ${targets.leadsQualified}`,
        leadsGoalPct >= 100 ? GREEN_COLOR : BRAND_COLOR);
    drawProgressBar(doc, 14 + (cardW + 4) * 2 + 5, y + 32, cardW - 10, 3, leadsGoalPct, GREEN_COLOR);

    y += cardH + 14;

    // PIPELINE DE LEADS
    y = drawSectionTitle(doc, "Pipeline de Leads", y);
    const stages = ["Contato", "Lead Gerado", "Lead Qualificado", "Proposta Enviada", "Negociação", "Cliente Fechado", "Cliente Perdido"];
    const stageTableData = stages.map(s => {
        const count = leadsByStage[s] || 0;
        return count > 0 ? [s, count, `${pct(count, userLeads.length)}%`] : null;
    }).filter(Boolean);

    if (stageTableData.length === 0) stageTableData.push(["Nenhum lead atribuído", "—", "—"]);

    doc.autoTable({
        startY: y,
        head: [["Estágio Comercial", "Qtd. de Leads", "% do Total"]],
        body: stageTableData,
        styles: { fontSize: 9, cellPadding: 4, textColor: DARK_COLOR },
        headStyles: { fillColor: DARK_COLOR, textColor: WHITE, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "center" }, 2: { halign: "center" } },
        margin: { left: 14, right: 14 },
        theme: "grid"
    });
    y = doc.lastAutoTable.finalY + 12;

    // PROPOSTAS
    y = drawSectionTitle(doc, "Resumo de Propostas", y);
    const pCardW = (pageW - 28 - 12) / 4;
    const pCardH = 32;
    drawCard(doc, 14, y, pCardW, pCardH, "TOTAL ENVIADAS", userProposals.length, "propostas");
    drawCard(doc, 14 + pCardW + 4, y, pCardW, pCardH, "GANHAS", wonProps.length, `${pct(wonProps.length, userProposals.length)}% conversão`, GREEN_COLOR);
    drawCard(doc, 14 + (pCardW + 4) * 2, y, pCardW, pCardH, "PERDIDAS", lostProps.length, "propostas perdidas", RED_COLOR);
    drawCard(doc, 14 + (pCardW + 4) * 3, y, pCardW, pCardH, "RECEITA", fmtCurrency(totalRevenue), "negócios fechados", BRAND_COLOR);
    y += pCardH + 10;

    if (wonProps.length > 0) {
        const wonData = wonProps.slice(0, 5).map(p => [
            p.company || "—", p.title || "—", fmtCurrency(p.value), fmtDate(p.closedAt || p.sentAt)
        ]);
        doc.autoTable({
            startY: y,
            head: [["Empresa", "Proposta", "Valor", "Data Fechamento"]],
            body: wonData,
            styles: { fontSize: 9, cellPadding: 3, textColor: DARK_COLOR },
            headStyles: { fillColor: GREEN_COLOR, textColor: WHITE, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 },
            theme: "grid"
        });
        y = doc.lastAutoTable.finalY + 12;
    }

    // TAREFAS
    if (y < pageH - 55) {
        y = drawSectionTitle(doc, "Tarefas do Dia", y);
        const tCardW = (pageW - 28 - 4) / 2;
        drawCard(doc, 14, y, tCardW, 30, "CONCLUÍDAS HOJE", doneTasksCount, "tarefas finalizadas", GREEN_COLOR);
        drawCard(doc, 14 + tCardW + 4, y, tCardW, 30, "PENDENTES", todayTasks.length - doneTasksCount, "ainda a completar");
        y += 36;
    }

    // FOOTER
    doc.setFillColor(...DARK_COLOR);
    doc.rect(0, pageH - 12, pageW, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Vellia CRM — Sistema Comercial Inteligente  •  Documento confidencial", 14, pageH - 4);
    doc.setTextColor(148, 163, 184);
    doc.text("Página 1 de 1", pageW - 28, pageH - 4);

    const safeName = user.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").substring(0, 20);
    const dateStr  = now.toISOString().substring(0, 10);
    doc.save(`Relatorio_${safeName}_${dateStr}.pdf`);
}
