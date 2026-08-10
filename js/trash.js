import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const Trash = {
    init() {
        // Purgar automaticamente leads com mais de 30 dias na lixeira
        this._autoPurgeExpired();
        this.renderTrashTable();
        this._bindEvents();
    },

    _bindEvents() {
        const btnEmptyTrash = document.getElementById("btn-empty-trash");
        if (btnEmptyTrash) {
            btnEmptyTrash.removeEventListener("click", this._onEmptyTrash);
            this._onEmptyTrash = () => this.emptyTrash();
            btnEmptyTrash.addEventListener("click", this._onEmptyTrash);
        }
    },

    _autoPurgeExpired() {
        // Purga automaticamente leads com mais de 30 dias na lixeira
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const expired = Store.getAllLeadsRaw().filter(l => {
            if (!l.deleted_at) return false;
            return (now - new Date(l.deleted_at).getTime()) >= THIRTY_DAYS_MS;
        });
        if (expired.length > 0) {
            const ids = expired.map(l => l.id);
            Store.purgeLeads(ids, "sistema@vellia.com (auto-expiry)");
        }
    },

    _daysRemaining(deletedAt) {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(deletedAt).getTime();
        return Math.max(0, Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
    },

    _daysBadge(days) {
        let color, bg;
        if (days > 15) {
            color = "#10b981"; bg = "rgba(16,185,129,0.12)";
        } else if (days > 7) {
            color = "#f59e0b"; bg = "rgba(245,158,11,0.12)";
        } else {
            color = "#ef4444"; bg = "rgba(239,68,68,0.12)";
        }
        return `<span style="
            display: inline-block; padding: 2px 10px; border-radius: 20px;
            font-size: 11px; font-weight: 700;
            background: ${bg}; color: ${color};
        ">${days}d restantes</span>`;
    },

    renderTrashTable() {
        const container = document.getElementById("trash-table-body");
        if (!container) return;

        const currentUser = Auth.getCurrentUser();
        const canPurge = currentUser && (currentUser.role === "admin" || currentUser.role === "manager");
        const leads = Store.getTrashLeads();

        // Mostrar/ocultar botão de esvaziar lixeira
        const btnEmpty = document.getElementById("btn-empty-trash");
        if (btnEmpty) btnEmpty.style.display = canPurge && leads.length > 0 ? "flex" : "none";

        // Mostrar contagem
        const trashCount = document.getElementById("trash-count");
        if (trashCount) trashCount.textContent = leads.length;

        if (leads.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
                        <div style="font-size: 36px; margin-bottom: 12px;">🗑️</div>
                        <div style="font-size: 14px; font-weight: 600; color: var(--text-secondary);">Lixeira vazia</div>
                        <div style="font-size: 12px; margin-top: 4px;">Nenhum lead foi excluído recentemente.</div>
                    </td>
                </tr>`;
            return;
        }

        container.innerHTML = leads.map(lead => {
            const days = this._daysRemaining(lead.deleted_at);
            const deletedDate = new Date(lead.deleted_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 16px;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${lead.company || "—"}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${lead.contact || ""}${lead.role ? ` · ${lead.role}` : ""}</div>
                    </td>
                    <td style="padding: 12px 16px; font-size: 12px; color: var(--text-secondary);">${lead.stage || "—"}</td>
                    <td style="padding: 12px 16px; font-size: 12px; color: var(--text-muted);">${lead.deleted_by || "—"}</td>
                    <td style="padding: 12px 16px; font-size: 12px; color: var(--text-muted);">${deletedDate}</td>
                    <td style="padding: 12px 16px;">${this._daysBadge(days)}</td>
                    <td style="padding: 12px 16px;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="trash-btn-restore" data-id="${lead.id}" title="Restaurar lead ao CRM" style="
                                background: rgba(16,185,129,0.1); color: #10b981;
                                border: 1px solid rgba(16,185,129,0.3); border-radius: 8px;
                                padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
                                display: flex; align-items: center; gap: 6px;
                            ">↩️ Restaurar</button>
                            ${canPurge ? `<button class="trash-btn-purge" data-id="${lead.id}" title="Excluir definitivamente" style="
                                background: rgba(239,68,68,0.1); color: #ef4444;
                                border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
                                padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
                                display: flex; align-items: center; gap: 6px;
                            ">🗑️ Excluir</button>` : ""}
                        </div>
                    </td>
                </tr>`;
        }).join("");

        // Bind de eventos nas linhas da tabela
        container.querySelectorAll(".trash-btn-restore").forEach(btn => {
            btn.addEventListener("click", () => this.restoreLead(btn.dataset.id));
        });
        container.querySelectorAll(".trash-btn-purge").forEach(btn => {
            btn.addEventListener("click", () => this.deletePermanently(btn.dataset.id));
        });
    },

    restoreLead(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;
        const currentUser = Auth.getCurrentUser();
        const userEmail = currentUser?.email || "sistema@vellia.com";

        Store.restoreLead(leadId, userEmail);
        this.renderTrashTable();

        // Toast de sucesso
        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            background: var(--bg-card, #1e293b);
            border: 1px solid rgba(16,185,129,0.4);
            border-left: 4px solid #10b981;
            border-radius: 12px; padding: 14px 20px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            animation: vellia-slide-in 0.3s ease; min-width: 280px;
        `;
        toast.innerHTML = `
            <span style="font-size: 20px;">✅</span>
            <div>
                <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Lead restaurado!</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">${lead.company} voltou ao CRM.</div>
            </div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);

        // Notificar as views do CRM/Kanban
        window.dispatchEvent(new CustomEvent("vellia:leadRestored", { detail: { leadId } }));
    },

    deletePermanently(leadId) {
        const lead = Store.getLeadById(leadId);
        if (!lead) return;
        const currentUser = Auth.getCurrentUser();
        if (!currentUser || !["admin", "manager"].includes(currentUser.role)) {
            alert("Apenas administradores e gerentes podem excluir leads definitivamente.");
            return;
        }

        const ok = confirm(`⚠️ ATENÇÃO: Excluir "${lead.company}" PERMANENTEMENTE?\n\nEsta ação NÃO PODE ser desfeita.`);
        if (!ok) return;

        Store.purgeLeads([leadId], currentUser.email);
        this.renderTrashTable();

        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            background: var(--bg-card, #1e293b);
            border: 1px solid rgba(239,68,68,0.4);
            border-left: 4px solid #ef4444;
            border-radius: 12px; padding: 14px 20px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            animation: vellia-slide-in 0.3s ease; min-width: 280px;
        `;
        toast.innerHTML = `
            <span style="font-size: 20px;">💀</span>
            <div>
                <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Lead excluído definitivamente</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">${lead.company} foi removido para sempre.</div>
            </div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    },

    emptyTrash() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser || !["admin", "manager"].includes(currentUser.role)) {
            alert("Apenas administradores e gerentes podem esvaziar a lixeira.");
            return;
        }
        const leads = Store.getTrashLeads();
        if (leads.length === 0) return;

        const ok = confirm(`⚠️ Esvaziar a lixeira?\n\nIsso removerá ${leads.length} lead(s) PERMANENTEMENTE. Esta ação NÃO PODE ser desfeita.`);
        if (!ok) return;

        const ids = leads.map(l => l.id);
        Store.purgeLeads(ids, currentUser.email);
        this.renderTrashTable();

        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px; z-index: 9999;
            background: var(--bg-card, #1e293b);
            border: 1px solid rgba(239,68,68,0.4);
            border-left: 4px solid #ef4444;
            border-radius: 12px; padding: 14px 20px;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            animation: vellia-slide-in 0.3s ease; min-width: 280px;
        `;
        toast.innerHTML = `
            <span style="font-size: 20px;">🧹</span>
            <div>
                <div style="font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 13px;">Lixeira esvaziada!</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">${leads.length} lead(s) excluídos definitivamente.</div>
            </div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }
};
