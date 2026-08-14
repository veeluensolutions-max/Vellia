// utils.js - Funções utilitárias globais

export function formatCurrency(value) {
    if (value === null || value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
