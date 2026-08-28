import { AudioEngine } from "./audio.js";

export const Toast = {
    container: null,

    init() {
        if (!this.container) {
            let el = document.getElementById("toast-container");
            if (!el) {
                el = document.createElement("div");
                el.id = "toast-container";
                el.className = "toast-container";
                document.body.appendChild(el);
            }
            this.container = el;
        }
    },

    show({ type = "info", title = "", message = "", duration = 4000 }) {
        this.init();

        // Tocar Chime Áudio correspondente
        if (window.AudioEngine || AudioEngine) {
            const engine = window.AudioEngine || AudioEngine;
            if (type === "success") {
                engine.playSuccessChime();
            } else if (type === "warning" || type === "error") {
                engine.playWarningChime();
            } else {
                engine.playLeadChime();
            }
        }

        const icons = {
            success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
        };

        const toast = document.createElement("div");
        toast.className = `toast-item toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ""}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" title="Fechar">&times;</button>
            <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
        `;

        const closeBtn = toast.querySelector(".toast-close");
        const removeToast = () => {
            if (toast.classList.contains("toast-closing")) return;
            toast.classList.add("toast-closing");
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        };

        closeBtn.addEventListener("click", removeToast);

        this.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(removeToast, duration);
        }

        return toast;
    },

    success(title, message, duration = 4000) {
        if (typeof message === "number") { duration = message; message = ""; }
        return this.show({ type: "success", title, message, duration });
    },

    error(title, message, duration = 5000) {
        if (typeof message === "number") { duration = message; message = ""; }
        return this.show({ type: "error", title, message, duration });
    },

    warning(title, message, duration = 4500) {
        if (typeof message === "number") { duration = message; message = ""; }
        return this.show({ type: "warning", title, message, duration });
    },

    info(title, message, duration = 4000) {
        if (typeof message === "number") { duration = message; message = ""; }
        return this.show({ type: "info", title, message, duration });
    }
};

window.Toast = Toast;
window.showToast = (msg, type = "info") => {
    Toast.show({ type, title: type === "success" ? "Sucesso" : type === "error" ? "Atenção" : "Informação", message: msg });
};
