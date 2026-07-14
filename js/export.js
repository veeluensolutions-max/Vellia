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
    }
};
