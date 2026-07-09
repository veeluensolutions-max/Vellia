import { Store } from "./store.js";
import { Auth } from "./auth.js";

// =============================================================================
// Motor de InteligÃªncia do Vellia AI
// =============================================================================

const AI_NAME = "Vellia AI";

// Banco de conhecimento de regras de negÃ³cio
function analyzeContext() {
    const proposals = Store.getProposals();
    const leads = Store.getLeads();
    const users = Store.getUsers();
    const goals = JSON.parse(localStorage.getItem("comercial_goals_config")) || {};

    const now = Date.now();
    const ONE_DAY = 1000 * 60 * 60 * 24;

    // MÃ©tricas calculadas
    const wonProps = proposals.filter(p => p.status === "Ganho");
    const lostProps = proposals.filter(p => p.status === "Perdido");
    const openProps = proposals.filter(p => !["Ganho", "Perdido"].includes(p.status));
    const totalRevenue = wonProps.reduce((s, p) => s + (p.value || 0), 0);
    const avgTicket = wonProps.length > 0 ? Math.round(totalRevenue / wonProps.length) : 0;
    const convRate = proposals.length > 0 ? wonProps.length / proposals.length : 0;

    // Leads frios (sem atividade hÃ¡ +14 dias)
    const coldLeads = leads.filter(l => {
        if (l.stage === "Perdido" || l.stage === "Cliente Ativo") return false;
        const hist = l.stageHistory || [];
        if (!hist.length) return true;
        const last = new Date(hist[hist.length - 1].timestamp);
        return (now - last.getTime()) > ONE_DAY * 14;
    });

    // Propostas vencendo em breve
    const expiringProps = openProps.filter(p => {
        if (!p.validUntil) return false;
        const days = (new Date(p.validUntil).getTime() - now) / ONE_DAY;
        return days >= 0 && days <= 7;
    });

    // Principal concorrente
    const competitors = {};
    lostProps.forEach(p => {
        if (p.competitor) competitors[p.competitor] = (competitors[p.competitor] || 0) + 1;
    });
    const topCompetitor = Object.keys(competitors).sort((a, b) => competitors[b] - competitors[a])[0] || null;

    // DistribuiÃ§Ã£o de estÃ¡gios
    const stageCounts = {};
    leads.forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1; });

    // Maior lead em valor (proposta)
    const highValueLead = [...openProps].sort((a, b) => (b.value || 0) - (a.value || 0))[0];

    // AnÃ¡lise de Risco (Churn) em Propostas Abertas
    const atRiskProps = openProps.filter(p => {
        let riskScore = 0;
        
        // Fator 1: Vencimento prÃ³ximo ou atrasado
        if (p.validUntil) {
            const daysToExpiry = (new Date(p.validUntil).getTime() - now) / ONE_DAY;
            if (daysToExpiry < 0) riskScore += 50; // Vencida
            else if (daysToExpiry <= 5) riskScore += 30;
        }

        // Fator 2: Tempo sem fechamento (mais de 15 dias aberta)
        if (p.sentAt) {
            const daysOpen = (now - new Date(p.sentAt).getTime()) / ONE_DAY;
            if (daysOpen > 15) riskScore += 20;
        }

        // Fator 3: Palavras-chave negativas nas anotaÃ§Ãµes
        const notes = (p.notes || "").toLowerCase();
        if (notes.includes("caro") || notes.includes("concorrÃªncia") || notes.includes("concorrente") || notes.includes("desconto") || notes.includes("difÃ­cil") || notes.includes("orÃ§amento")) {
            riskScore += 40;
        }

        p._riskScore = riskScore;
        return riskScore >= 50; // Considerada "Em Risco"
    });

    // Lead Scoring (PontuaÃ§Ã£o de 0 a 100)
    const scoredLeads = leads.filter(l => l.stage !== "Perdido" && l.stage !== "Cliente Ativo").map(l => {
        let score = 0;
        
        // Perfil completo
        if (l.segment) score += 10;
        if (l.contact) score += 10;
        
        // Engajamento recente
        const hist = l.stageHistory || [];
        if (hist.length > 0) {
            const last = new Date(hist[hist.length - 1].timestamp);
            const daysSinceLast = (now - last.getTime()) / ONE_DAY;
            if (daysSinceLast <= 3) score += 40;
            else if (daysSinceLast <= 7) score += 20;
            else if (daysSinceLast <= 14) score += 10;
        }
        
        // Valor atrelado (Propostas)
        const leadProps = openProps.filter(p => p.leadId === l.id);
        const propsValue = leadProps.reduce((s, p) => s + (p.value || 0), 0);
        if (propsValue > 20000) score += 40;
        else if (propsValue > 5000) score += 20;
        else if (leadProps.length > 0) score += 10;

        // Limite a 100
        l._score = Math.min(score, 100);
        return l;
    }).sort((a, b) => b._score - a._score); // Ordena do mais quente para o mais frio

    return {
        proposals, leads, users, goals, now, ONE_DAY,
        wonProps, lostProps, openProps,
        totalRevenue, avgTicket, convRate,
        coldLeads, expiringProps, topCompetitor,
        stageCounts, highValueLead,
        atRiskProps, scoredLeads
    };
}

function formatCurrency(v) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

// =============================================================================
// Resposta Inteligente por IntenÃ§Ã£o
// =============================================================================
function generateResponse(userInput, ctx) {
    const input = userInput.toLowerCase().trim();

    // â”€â”€ CUMPRIMENTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/^(oi|olÃ¡|ola|hey|bom dia|boa tarde|boa noite|e aÃ­|eai|hello|hi)/.test(input)) {
        const user = Auth.getCurrentUser();
        const hr = new Date().getHours();
        const greeting = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
        return { text: `${greeting}, ${user?.name?.split(" ")[0] || ""}! ðŸ‘‹ Sou o **Vellia AI**, seu assistente comercial inteligente.\n\nPosso te ajudar com:\nâ€¢ ðŸ“Š AnÃ¡lise do seu pipeline e metas\nâ€¢ ðŸ§Š Identificar leads frios para follow-up\nâ€¢ ðŸ’¡ SugestÃµes de prÃ³ximas aÃ§Ãµes\nâ€¢ ðŸ“ˆ Resumo do desempenho\nâ€¢ ðŸ”® PrevisÃµes e alertas\n\nO que vocÃª gostaria de saber hoje?`, type: "greeting" };
    }

    // â”€â”€ AJUDA / COMANDOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/ajuda|help|o que vocÃª|o que voce|comandos|pode fazer/.test(input)) {
        return { text: `Aqui estÃ£o os tÃ³picos que posso analisar para vocÃª:\n\nðŸ“Š **"resumo"** â€” VisÃ£o geral do desempenho\nðŸ§Š **"leads frios"** â€” Quem estÃ¡ sem contato\nðŸ“ **"propostas"** â€” Status do pipeline\nðŸŽ¯ **"meta"** â€” Como estÃ¡ sua meta do mÃªs\nâš ï¸ **"alertas"** â€” O que requer atenÃ§Ã£o urgente\nðŸ’¡ **"prÃ³ximas aÃ§Ãµes"** â€” O que fazer agora\nðŸ† **"concorrÃªncia"** â€” AnÃ¡lise de perdas\nðŸ’° **"ticket mÃ©dio"** â€” Valor mÃ©dio por venda\n\nTambÃ©m posso responder perguntas abertas sobre seu negÃ³cio!`, type: "help" };
    }

    // â”€â”€ RESUMO GERAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/resumo|geral|situaÃ§Ã£o|situacao|overview|como estou|como estÃ¡/.test(input)) {
        const convPct = (ctx.convRate * 100).toFixed(1);
        const status = ctx.convRate >= 0.4 ? "ðŸŸ¢ **Excelente**" : ctx.convRate >= 0.25 ? "ðŸŸ¡ **Bom**" : "ðŸ”´ **Precisa melhorar**";
        return {
            text: `ðŸ“Š **Resumo Comercial Atual**\n\n` +
                `â€¢ Propostas abertas: **${ctx.openProps.length}**\n` +
                `â€¢ Vendas ganhas: **${ctx.wonProps.length}** (${formatCurrency(ctx.totalRevenue)})\n` +
                `â€¢ Perdas: **${ctx.lostProps.length}**\n` +
                `â€¢ Taxa de conversÃ£o: **${convPct}%** â€” ${status}\n` +
                `â€¢ Ticket mÃ©dio: **${formatCurrency(ctx.avgTicket)}**\n` +
                `â€¢ Leads ativos: **${ctx.leads.filter(l => l.stage !== "Perdido").length}**\n` +
                `â€¢ Leads frios: **${ctx.coldLeads.length}**\n\n` +
                (ctx.coldLeads.length > 0 ? `âš ï¸ AtenÃ§Ã£o: vocÃª tem **${ctx.coldLeads.length} lead(s) frio(s)** sem contato hÃ¡ mais de 14 dias.` : `âœ… Todos os leads estÃ£o sendo trabalhados regularmente!`),
            type: "analysis"
        };
    }

    // â”€â”€ LEADS FRIOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/frio|frios|sem contato|esquecido|parado|inativo/.test(input)) {
        if (ctx.coldLeads.length === 0) {
            return { text: `âœ… Ã“timo! Nenhum lead frio no momento. Todos os seus leads ativos receberam contato nos Ãºltimos 14 dias. Continue assim! ðŸ’ª`, type: "success" };
        }
        const list = ctx.coldLeads.slice(0, 5).map(l => {
            const hist = l.stageHistory || [];
            const last = hist.length ? new Date(hist[hist.length - 1].timestamp) : new Date(0);
            const days = Math.round((ctx.now - last.getTime()) / ctx.ONE_DAY);
            return `â€¢ **${l.company}** (${l.stage}) â€” ${days} dias sem atividade`;
        }).join("\n");
        return {
            text: `ðŸ§Š **${ctx.coldLeads.length} Lead(s) Frio(s) Identificados:**\n\n${list}\n\nðŸ’¡ **SugestÃ£o:** Envie um e-mail de reengajamento ou ligue para esses contatos hoje mesmo. Leads frios tÃªm chance de recuperaÃ§Ã£o reduzida a cada dia que passa.`,
            type: "warning",
            action: { label: "Ver Leads Frios no CRM", route: "crm" }
        };
    }

    // â”€â”€ LEADS QUENTES / SCORING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/quente|score|ranqueamento|ranking|melhores leads/.test(input)) {
        if (!ctx.scoredLeads || ctx.scoredLeads.length === 0) {
            return { text: `ðŸ“­ NÃ£o encontrei leads ativos no momento. Que tal prospectar novos clientes?`, type: "warning" };
        }
        const topLeads = ctx.scoredLeads.slice(0, 3).map((l, i) => {
            const temp = l._score >= 70 ? "ðŸ”¥" : l._score >= 40 ? "âš¡" : "ðŸ§Š";
            return `${i + 1}. **${l.company}** â€” Score: **${l._score}** ${temp}`;
        }).join("\n");
        return {
            text: `ðŸ“ˆ **Top Leads (Scoring AutomÃ¡tico):**\n\n${topLeads}\n\nðŸ’¡ **SugestÃ£o:** Foque no top 1 hoje! O score Ã© calculado com base no preenchimento de dados, engajamento recente e valor potencial das propostas.`,
            type: "analysis",
            action: { label: "Ver Leads no CRM", route: "crm" }
        };
    }

    // â”€â”€ ANÃLISE DE RISCO / CHURN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/risco|churn|perigo|perdendo/.test(input)) {
        if (!ctx.atRiskProps || ctx.atRiskProps.length === 0) {
            return { text: `âœ… **Excelente!** Nenhuma proposta atual apresenta alto risco de churn (perda).`, type: "success" };
        }
        const riskList = ctx.atRiskProps.map(p => `â€¢ **${p.company}** â€” ${formatCurrency(p.value || 0)} (Risco: ${p._riskScore})`).join("\n");
        return {
            text: `âš ï¸ **AtenÃ§Ã£o: ${ctx.atRiskProps.length} proposta(s) em Risco Alto!**\n\n${riskList}\n\nðŸ’¡ **DiagnÃ³stico:** O risco aumenta por tempo sem fechamento, proximidade do vencimento ou palavras-chave crÃ­ticas nas anotaÃ§Ãµes (ex: "caro", "concorrÃªncia"). Entre em contato imediatamente!`,
            type: "warning",
            action: { label: "Revisar Propostas", route: "proposals" }
        };
    }

    // â”€â”€ PROPOSTAS / PIPELINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/proposta|pipeline|aberta|pendente/.test(input)) {
        if (ctx.openProps.length === 0) {
            return { text: `ðŸ“­ NÃ£o hÃ¡ propostas abertas no seu pipeline no momento.\n\nðŸ’¡ **SugestÃ£o:** Isso Ã© um sinal para gerar novas oportunidades. Considere:\nâ€¢ Entrar em contato com leads na etapa de QualificaÃ§Ã£o\nâ€¢ Fazer follow-up com leads que tiveram reuniÃµes recentes\nâ€¢ Solicitar indicaÃ§Ãµes de clientes ativos`, type: "warning" };
        }
        const total = ctx.openProps.reduce((s, p) => s + (p.value || 0), 0);
        const list = ctx.openProps.slice(0, 4).map(p => `â€¢ **${p.company}** â€” ${formatCurrency(p.value || 0)} (${p.status})`).join("\n");
        return {
            text: `ðŸ“ **Pipeline Ativo: ${ctx.openProps.length} proposta(s)**\n\nValor total em aberto: **${formatCurrency(total)}**\n\n${list}${ctx.openProps.length > 4 ? `\nâ€¢ ...e mais ${ctx.openProps.length - 4} proposta(s)` : ""}\n\n${ctx.expiringProps.length > 0 ? `\nâš ï¸ **Urgente:** ${ctx.expiringProps.length} proposta(s) vencem em menos de 7 dias!` : ""}`,
            type: "analysis",
            action: { label: "Ver Propostas", route: "proposals" }
        };
    }

    // â”€â”€ META DO MÃŠS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/meta|objetivo|target|goal/.test(input)) {
        const metaRevenue = ctx.goals.meta_revenue || 30000;
        const now2 = new Date();
        const monthRevenue = ctx.wonProps.filter(p => {
            const d = new Date(p.closedAt || p.sentAt);
            return d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
        }).reduce((s, p) => s + (p.value || 0), 0);
        const pct = metaRevenue > 0 ? Math.round((monthRevenue / metaRevenue) * 100) : 0;
        const remaining = Math.max(metaRevenue - monthRevenue, 0);
        const daysLeft = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).getDate() - now2.getDate();
        const dailyNeeded = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;

        let status = pct >= 100 ? "ðŸ† **Meta batida!** ParabÃ©ns!" :
            pct >= 75 ? "ðŸ”¥ Quase lÃ¡! VocÃª estÃ¡ no caminho certo." :
            pct >= 50 ? "ðŸ“ˆ Progresso ok. Acelere o passo!" :
            "âš ï¸ AtenÃ§Ã£o: ritmo abaixo do esperado.";

        return {
            text: `ðŸŽ¯ **Sua Meta de Faturamento â€” MÃªs Atual**\n\nâ€¢ Meta: **${formatCurrency(metaRevenue)}**\nâ€¢ Realizado: **${formatCurrency(monthRevenue)}** (${pct}%)\nâ€¢ Restante: **${formatCurrency(remaining)}**\nâ€¢ Dias restantes: **${daysLeft} dias**\nâ€¢ Precisa gerar por dia: **${formatCurrency(dailyNeeded)}/dia**\n\n${status}\n\nðŸ’¡ Foco nas propostas abertas pode fechar ${formatCurrency(ctx.openProps.reduce((s, p) => s + (p.value || 0) * 0.5, 0))} estimados!`,
            type: pct >= 75 ? "success" : "analysis"
        };
    }

    // â”€â”€ ALERTAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/alerta|urgente|atenÃ§Ã£o|atencao|prioridade/.test(input)) {
        const alerts = [];
        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) alerts.push(`âš ï¸ **${ctx.atRiskProps.length} proposta(s)** com ALTO RISCO de perda`);
        if (ctx.expiringProps.length > 0) alerts.push(`â° **${ctx.expiringProps.length} proposta(s)** vencem em menos de 7 dias`);
        if (ctx.coldLeads.length > 0) alerts.push(`ðŸ§Š **${ctx.coldLeads.length} lead(s) frio(s)** sem contato hÃ¡ +14 dias`);
        const lostThisMonth = ctx.lostProps.filter(p => {
            const d = new Date(p.closedAt || p.sentAt);
            const now2 = new Date();
            return d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
        });
        if (lostThisMonth.length > 2) alerts.push(`ðŸ“‰ **${lostThisMonth.length} propostas perdidas** este mÃªs â€” revise a abordagem`);
        if (ctx.openProps.length === 0) alerts.push(`ðŸ“­ **Pipeline vazio** â€” crie novas propostas agora`);

        if (alerts.length === 0) {
            return { text: `âœ… **Nenhum alerta crÃ­tico!** Sua operaÃ§Ã£o estÃ¡ sob controle. Continue monitorando regularmente. ðŸŽ‰`, type: "success" };
        }
        return { text: `ðŸš¨ **${alerts.length} Alerta(s) PrioritÃ¡rio(s):**\n\n${alerts.join("\n\n")}\n\nðŸ’¡ Recomendo resolver esses pontos ainda hoje para nÃ£o perder oportunidades.`, type: "warning" };
    }

    // â”€â”€ PRÃ“XIMAS AÃ‡Ã•ES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/prÃ³xim|proxim|aÃ§Ã£o|acao|fazer|recomend|sugest/.test(input)) {
        const actions = [];
        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) actions.push(`ðŸš¨ Contornar objeÃ§Ãµes da proposta de **${ctx.atRiskProps[0].company}** â€” Alto risco de perda!`);
        if (ctx.scoredLeads && ctx.scoredLeads.length > 0 && ctx.scoredLeads[0]._score >= 70) actions.push(`ðŸ”¥ Tentar fechamento com **${ctx.scoredLeads[0].company}** â€” Lead mais quente no momento!`);
        if (ctx.coldLeads.length > 0) actions.push(`ðŸ“ž Ligar para **${ctx.coldLeads[0].company}** â€” lead frio hÃ¡ mais de 14 dias`);
        if (ctx.expiringProps.length > 0 && (!ctx.atRiskProps || ctx.atRiskProps[0].id !== ctx.expiringProps[0].id)) actions.push(`âš¡ Renovar proposta para **${ctx.expiringProps[0].company}** â€” vence em breve`);
        if (ctx.highValueLead && (!ctx.atRiskProps || ctx.atRiskProps[0].id !== ctx.highValueLead.id)) actions.push(`ðŸ’Ž Priorizar proposta de **${ctx.highValueLead.company}** â€” maior valor: ${formatCurrency(ctx.highValueLead.value)}`);
        
        if (actions.length < 5 && ctx.leads.filter(l => l.stage === "QualificaÃ§Ã£o").length > 0) {
            const ql = ctx.leads.filter(l => l.stage === "QualificaÃ§Ã£o")[0];
            actions.push(`ðŸ“ Criar proposta para **${ql.company}** â€” estÃ¡ na etapa de QualificaÃ§Ã£o`);
        }
        if (actions.length < 5) actions.push(`ðŸ“Š Revisar o Dashboard Gerencial para avaliar KPIs da semana`);

        return {
            text: `ðŸ’¡ **Top ${Math.min(actions.length, 5)} AÃ§Ãµes PrioritÃ¡rias para Hoje:**\n\n${actions.slice(0, 5).map((a, i) => `**${i + 1}.** ${a}`).join("\n\n")}`,
            type: "action"
        };
    }

    // â”€â”€ CONCORRÃŠNCIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/concorrente|concorrÃªncia|concorrencia|perdeu|perda|motivo/.test(input)) {
        if (ctx.lostProps.length === 0) {
            return { text: `âœ… Nenhuma proposta perdida registrada atÃ© o momento! Continue assim.`, type: "success" };
        }
        const reasons = {};
        ctx.lostProps.forEach(p => { if (p.lossReason) reasons[p.lossReason] = (reasons[p.lossReason] || 0) + 1; });
        const topReason = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])[0];

        return {
            text: `ðŸ† **AnÃ¡lise de ConcorrÃªncia e Perdas**\n\nâ€¢ Total de perdas: **${ctx.lostProps.length} proposta(s)**\nâ€¢ Principal motivo: **"${topReason || "NÃ£o especificado"}"**\n${ctx.topCompetitor ? `â€¢ Concorrente que mais venceu: **${ctx.topCompetitor}**\n` : ""}\nðŸ’¡ **EstratÃ©gia sugerida:** ${topReason?.includes("PreÃ§o") ? "Considere criar pacotes com mais valor percebido ou oferecer condiÃ§Ãµes especiais para competir em preÃ§o." : "Acompanhe de perto os concorrentes citados e identifique diferenciais do seu serviÃ§o para destacar nas propostas."}`,
            type: "analysis"
        };
    }

    // â”€â”€ TICKET MÃ‰DIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (/ticket|valor mÃ©dio|valor medio|preÃ§o mÃ©dio|preco medio/.test(input)) {
        const topSale = ctx.wonProps.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
        return {
            text: `ðŸ’° **AnÃ¡lise de Ticket MÃ©dio**\n\nâ€¢ Ticket mÃ©dio atual: **${formatCurrency(ctx.avgTicket)}**\nâ€¢ Total de vendas: **${ctx.wonProps.length}**\nâ€¢ Receita total: **${formatCurrency(ctx.totalRevenue)}**\n${topSale ? `â€¢ Maior venda: **${formatCurrency(topSale.value)}** (${topSale.company})\n` : ""}\nðŸ’¡ **Dica:** Para aumentar o ticket mÃ©dio, considere adicionar serviÃ§os complementares nas propostas (upsell) e destacar o retorno sobre investimento para o cliente.`,
            type: "analysis"
        };
    }

    // â”€â”€ FALLBACK INTELIGENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Tenta extrair empresa mencionada
    const allCompanies = [...Store.getLeads(), ...Store.getProposals()].map(x => x.company?.toLowerCase()).filter(Boolean);
    const mentionedCompany = allCompanies.find(c => input.includes(c));
    if (mentionedCompany) {
        const lead = Store.getLeads().find(l => l.company?.toLowerCase() === mentionedCompany);
        const props = Store.getProposals().filter(p => p.company?.toLowerCase() === mentionedCompany);
        if (lead || props.length) {
            const info = lead ? `\nâ€¢ EstÃ¡gio: **${lead.stage}**\nâ€¢ Segmento: **${lead.segment || "N/A"}**\nâ€¢ Contato: **${lead.contact}** â€” ${lead.phone}` : "";
            const propInfo = props.length ? `\n\nðŸ“ **Proposta(s):** ${props.map(p => `${p.title} â€” ${formatCurrency(p.value)} (${p.status})`).join(", ")}` : "";
            return { text: `ðŸ” **InformaÃ§Ãµes sobre ${lead?.company || props[0]?.company}:**${info}${propInfo}`, type: "analysis" };
        }
    }

    return {
        text: `ðŸ¤” Hmm, nÃ£o tenho certeza do que vocÃª quis dizer com "*${userInput}*".\n\nAlgumas sugestÃµes:\nâ€¢ "**resumo**" â€” visÃ£o geral\nâ€¢ "**leads frios**" â€” quem requer atenÃ§Ã£o\nâ€¢ "**alertas**" â€” situaÃ§Ãµes crÃ­ticas\nâ€¢ "**prÃ³ximas aÃ§Ãµes**" â€” o que fazer hoje\nâ€¢ "**metas**" â€” quanto falta para bater a meta\n\nOu mencione o nome de uma empresa para ver os detalhes!`,
        type: "fallback"
    };
}

// =============================================================================
// MÃ“DULO PRINCIPAL DE RENDERIZAÃ‡ÃƒO
// =============================================================================
const chatHistory = [];

function renderMessage(msg, container) {
    const isAI = msg.from === "ai";
    const div = document.createElement("div");
    div.className = `ai-message ${isAI ? "ai-message--assistant" : "ai-message--user"}`;

    // Converter **bold** e quebras de linha em HTML
    const formatted = msg.text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");

    div.innerHTML = `
        ${isAI ? `<div class="ai-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>` : ""}
        <div class="ai-bubble">
            <div class="ai-bubble-text">${formatted}</div>
            ${msg.action ? `<button class="btn btn-primary ai-action-btn" data-route="${msg.action.route}" style="margin-top: 12px; font-size: 12px; padding: 8px 16px;">${msg.action.label} â†’</button>` : ""}
        </div>
        ${!isAI ? `<div class="ai-user-avatar">${Auth.getCurrentUser()?.avatar || "U"}</div>` : ""}
    `;

    // Handler do botÃ£o de aÃ§Ã£o
    const actionBtn = div.querySelector(".ai-action-btn");
    if (actionBtn) {
        actionBtn.addEventListener("click", () => {
            document.querySelector(`[data-view="${actionBtn.dataset.route}"]`)?.click();
        });
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping(container) {
    const div = document.createElement("div");
    div.className = "ai-message ai-message--assistant ai-typing-indicator";
    div.id = "ai-typing";
    div.innerHTML = `
        <div class="ai-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div>
        <div class="ai-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

export const VelliaAI = {
    initialized: false,

    init() {
        const container = document.getElementById("ai-chat-messages");
        const input = document.getElementById("ai-chat-input");
        const form = document.getElementById("ai-chat-form");
        const chips = document.querySelectorAll(".ai-chip");

        if (!container || !form) return;

        // Limpar e reinicar apenas se nÃ£o estÃ¡ inicializado
        if (!this.initialized) {
            container.innerHTML = "";
            this.initialized = true;

            // Mensagem de boas-vindas automÃ¡tica
            setTimeout(() => {
                const ctx = analyzeContext();
                const welcome = generateResponse("oi", ctx);
                chatHistory.push({ from: "ai", ...welcome });
                renderMessage({ from: "ai", ...welcome }, container);
            }, 300);

            // Insights proativos apÃ³s 1s
            setTimeout(() => {
                const ctx = analyzeContext();
                if (ctx.coldLeads.length > 0 || ctx.expiringProps.length > 0) {
                    const proactive = {
                        from: "ai",
                        text: `ðŸ”” **Insight Proativo:** Detectei ${ctx.coldLeads.length > 0 ? `**${ctx.coldLeads.length} lead(s) frio(s)**` : ""}${ctx.coldLeads.length > 0 && ctx.expiringProps.length > 0 ? " e " : ""}${ctx.expiringProps.length > 0 ? `**${ctx.expiringProps.length} proposta(s) vencendo em breve**` : ""} que precisam de atenÃ§Ã£o.\n\nDigite "**alertas**" para ver os detalhes ou "**prÃ³ximas aÃ§Ãµes**" para saber o que fazer agora.`,
                        type: "warning"
                    };

                    chatHistory.push(proactive);
                    renderMessage(proactive, container);
                }
            }, 1500);

            // Popula os Insights do Dia no painel lateral
            this.renderDailyInsights(container);

            // Chips de atalho
            chips.forEach(chip => {
                chip.addEventListener("click", () => {
                    const query = chip.dataset.query;
                    if (input) input.value = query;
                    this.sendMessage(query, container, input);
                });
            });

            export { analyzeContext };
