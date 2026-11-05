// utils.js - Funções utilitárias globais

/**
 * Criptografia SHA-256 nativa via Web Crypto API
 * Retorna string hexadecimal de 64 caracteres
 */
export async function hashPassword(plainText) {
    if (!plainText) return "";
    const encoder = new TextEncoder();
    const data = encoder.encode(String(plainText));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converte qualquer valor monetário (string formatada BR ou número) em float preciso.
 * Exemplos:
 * "R$ 1.500,50" -> 1500.50
 * "1.500,00"    -> 1500.00
 * "1500,75"     -> 1500.75
 * "1500.75"     -> 1500.75
 */
export function parseCurrency(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;

    let clean = String(value).trim()
        .replace(/^R\$\s?/, "")
        .replace(/\s/g, "");

    // Se tiver vírgula e ponto (ex: 1.500,50), remove o ponto e troca vírgula por ponto
    if (clean.includes(",") && clean.includes(".")) {
        clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.includes(",")) {
        // Se tiver apenas vírgula (ex: 1500,50)
        clean = clean.replace(",", ".");
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

export function formatCurrency(value) {
    if (value === null || value === undefined) return "R$ 0,00";
    const num = typeof value === "number" ? value : parseCurrency(value);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

/**
 * Aplica máscara de moeda brasileira em tempo real a um elemento input
 */
export function applyCurrencyMask(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (!value) {
            e.target.value = "";
            return;
        }
        const floatVal = parseInt(value, 10) / 100;
        e.target.value = floatVal.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    });
}

/**
 * Máscara para telefone/WhatsApp: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function maskPhone(val) {
    if (!val) return "";
    let clean = String(val).replace(/\D/g, "");
    if (clean.length > 11) clean = clean.substring(0, 11);
    if (clean.length > 10) {
        return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (clean.length > 6) {
        return clean.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (clean.length > 2) {
        return clean.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    }
    return clean;
}

/**
 * Máscara para CNPJ: XX.XXX.XXX/XXXX-XX
 */
export function maskCNPJ(val) {
    if (!val) return "";
    let clean = String(val).replace(/\D/g, "");
    if (clean.length > 14) clean = clean.substring(0, 14);
    return clean
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatTimeAgo(dateInput) {
    if (!dateInput) return "Desconhecido";
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "Data inválida";
    
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return "Agora mesmo";
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} h`;
    if (diffDays === 1) return "Ontem";
    if (diffDays < 30) return `Há ${diffDays} dias`;
    if (diffMonths === 1) return "Há 1 mês";
    if (diffMonths < 12) return `Há ${diffMonths} meses`;
    if (diffYears === 1) return "Há 1 ano";
    return `Há ${diffYears} anos`;
}

export function downloadCSV(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
