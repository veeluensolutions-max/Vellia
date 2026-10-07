// js/lazy-loader.js - Carregamento Sob Demanda (Lazy Loading) de Bibliotecas Externas

const loadedScripts = new Map();

/**
 * Carrega um script externo de forma assíncrona sob demanda.
 * Se o script já foi requisitado, reutiliza a Promise para evitar downloads duplicados.
 */
export function loadScript(src) {
    if (loadedScripts.has(src)) {
        return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        // Verificar se já existe uma tag script idêntica no DOM
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true" || window.jspdf || window.pdfjsLib) {
                return resolve();
            }
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", (e) => reject(e));
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };
        script.onerror = (err) => {
            loadedScripts.delete(src);
            reject(new Error(`Falha ao carregar o script sob demanda: ${src}`));
        };

        document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
}

/**
 * Garante que o jsPDF e o plugin autoTable estejam prontos para uso.
 */
export async function ensureJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) {
        return window.jspdf;
    }

    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
        return window.jspdf;
    } catch (err) {
        console.error("❌ [LazyLoader] Falha ao carregar jsPDF:", err);
        throw err;
    }
}

/**
 * Garante que a biblioteca PDF.js esteja pronta para leitura de arquivos PDF.
 */
export async function ensurePdfJs() {
    if (window.pdfjsLib) {
        if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        return window.pdfjsLib;
    }

    try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        return window.pdfjsLib;
    } catch (err) {
        console.error("❌ [LazyLoader] Falha ao carregar PDF.js:", err);
        throw err;
    }
}

/**
 * Garante que Chart.js esteja disponível caso necessário.
 */
export async function ensureChartJs() {
    if (window.Chart) {
        return window.Chart;
    }

    try {
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js");
        return window.Chart;
    } catch (err) {
        console.error("❌ [LazyLoader] Falha ao carregar Chart.js:", err);
        throw err;
    }
}

// Expor no escopo global para compatibilidade com scripts legados
const LazyLoader = {
    loadScript,
    ensureJsPDF,
    ensurePdfJs,
    ensureChartJs
};

if (typeof window !== "undefined") {
    window.LazyLoader = LazyLoader;
}

export default LazyLoader;
