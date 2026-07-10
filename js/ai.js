import { Store } from "./store.js";
import { Auth } from "./auth.js";

// =============================================================================
// Motor de Inteligência do Vellia AI
// =============================================================================

const AI_NAME = "Vellia AI";

// Banco de conhecimento de regras de negócio
function analyzeContext() {
    const proposals = Store.getProposals();
    const leads = Store.getLeads();
    const users = Store.getUsers();
    const goals = JSON.parse(localStorage.getItem("comercial_goals_config")) || {};

    const now = Date.now();
    const ONE_DAY = 1000 * 60 * 60 * 24;

    // Métricas calculadas
    const wonProps = proposals.filter(p => p.status === "Ganho");
    const lostProps = proposals.filter(p => p.status === "Perdido");
    const openProps = proposals.filter(p => !["Ganho", "Perdido"].includes(p.status));
    const totalRevenue = wonProps.reduce((s, p) => s + (p.value || 0), 0);
    const avgTicket = wonProps.length > 0 ? Math.round(totalRevenue / wonProps.length) : 0;
    const convRate = proposals.length > 0 ? wonProps.length / proposals.length : 0;

    // Leads frios (sem atividade há +14 dias)
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

    // Distribuição de estágios
    const stageCounts = {};
    leads.forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1; });

    // Maior lead em valor (proposta)
    const highValueLead = [...openProps].sort((a, b) => (b.value || 0) - (a.value || 0))[0];

    // Análise de Risco (Churn) em Propostas Abertas
    const atRiskProps = openProps.filter(p => {
        let riskScore = 0;
        
        // Fator 1: Vencimento próximo ou atrasado
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

        // Fator 3: Palavras-chave negativas nas anotações
        const notes = (p.notes || "").toLowerCase();
        if (notes.includes("caro") || notes.includes("concorrência") || notes.includes("concorrente") || notes.includes("desconto") || notes.includes("difícil") || notes.includes("orçamento")) {
            riskScore += 40;
        }

        p._riskScore = riskScore;
        return riskScore >= 50; // Considerada "Em Risco"
    });

    // Lead Scoring (Pontuação de 0 a 100)
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
// Resposta Inteligente por Intenção
// =============================================================================
function generateResponse(userInput, ctx) {
    const input = userInput.toLowerCase().trim();

    // ── CUMPRIMENTOS ──────────────────────────────────────────────────────────
    if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e aí|eai|hello|hi)/.test(input)) {
        const user = Auth.getCurrentUser();
        const hr = new Date().getHours();
        const greeting = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
        return { text: `${greeting}, ${user?.name?.split(" ")[0] || ""}! 👋 Sou o **Vellia AI**, seu assistente comercial inteligente.\n\nPosso te ajudar com:\n• 📊 Análise do seu pipeline e metas\n• 🧊 Identificar leads frios para follow-up\n• 💡 Sugestões de próximas ações\n• 📈 Resumo do desempenho\n• 🔮 Previsões e alertas\n\nO que você gostaria de saber hoje?`, type: "greeting" };
    }

    // ── AJUDA / COMANDOS ──────────────────────────────────────────────────────
    if (/ajuda|help|o que você|o que voce|comandos|pode fazer/.test(input)) {
        return { text: `Aqui estão os tópicos que posso analisar para você:\n\n📊 **"resumo"** — Visão geral do desempenho\n🧊 **"leads frios"** — Quem está sem contato\n📝 **"propostas"** — Status do pipeline\n🎯 **"meta"** — Como está sua meta do mês\n⚠️ **"alertas"** — O que requer atenção urgente\n💡 **"próximas ações"** — O que fazer agora\n🏆 **"concorrência"** — Análise de perdas\n💰 **"ticket médio"** — Valor médio por venda\n\nTambém posso responder perguntas abertas sobre seu negócio!`, type: "help" };
    }

    // ── RESUMO GERAL ──────────────────────────────────────────────────────────
    if (/resumo|geral|situação|situacao|overview|como estou|como está/.test(input)) {
        const convPct = (ctx.convRate * 100).toFixed(1);
        const status = ctx.convRate >= 0.4 ? "🟢 **Excelente**" : ctx.convRate >= 0.25 ? "🟡 **Bom**" : "🔴 **Precisa melhorar**";
        return {
            text: `📊 **Resumo Comercial Atual**\n\n` +
                `• Propostas abertas: **${ctx.openProps.length}**\n` +
                `• Vendas ganhas: **${ctx.wonProps.length}** (${formatCurrency(ctx.totalRevenue)})\n` +
                `• Perdas: **${ctx.lostProps.length}**\n` +
                `• Taxa de conversão: **${convPct}%** — ${status}\n` +
                `• Ticket médio: **${formatCurrency(ctx.avgTicket)}**\n` +
                `• Leads ativos: **${ctx.leads.filter(l => l.stage !== "Perdido").length}**\n` +
                `• Leads frios: **${ctx.coldLeads.length}**\n\n` +
                (ctx.coldLeads.length > 0 ? `⚠️ Atenção: você tem **${ctx.coldLeads.length} lead(s) frio(s)** sem contato há mais de 14 dias.` : `✅ Todos os leads estão sendo trabalhados regularmente!`),
            type: "analysis"
        };
    }

    // ── LEADS FRIOS ───────────────────────────────────────────────────────────
    if (/frio|frios|sem contato|esquecido|parado|inativo/.test(input)) {
        if (ctx.coldLeads.length === 0) {
            return { text: `✅ Ótimo! Nenhum lead frio no momento. Todos os seus leads ativos receberam contato nos últimos 14 dias. Continue assim! 💪`, type: "success" };
        }
        const list = ctx.coldLeads.slice(0, 5).map(l => {
            const hist = l.stageHistory || [];
            const last = hist.length ? new Date(hist[hist.length - 1].timestamp) : new Date(0);
            const days = Math.round((ctx.now - last.getTime()) / ctx.ONE_DAY);
            return `• **${l.company}** (${l.stage}) — ${days} dias sem atividade`;
        }).join("\n");
        return {
            text: `🧊 **${ctx.coldLeads.length} Lead(s) Frio(s) Identificados:**\n\n${list}\n\n💡 **Sugestão:** Envie um e-mail de reengajamento ou ligue para esses contatos hoje mesmo. Leads frios têm chance de recuperação reduzida a cada dia que passa.`,
            type: "warning",
            action: { label: "Ver Leads Frios no CRM", route: "crm" }
        };
    }

    // ── LEADS QUENTES / SCORING ───────────────────────────────────────────────
    if (/quente|score|ranqueamento|ranking|melhores leads/.test(input)) {
        if (!ctx.scoredLeads || ctx.scoredLeads.length === 0) {
            return { text: `📭 Não encontrei leads ativos no momento. Que tal prospectar novos clientes?`, type: "warning" };
        }
        const topLeads = ctx.scoredLeads.slice(0, 3).map((l, i) => {
            const temp = l._score >= 70 ? "🔥" : l._score >= 40 ? "⚡" : "🧊";
            return `${i + 1}. **${l.company}** — Score: **${l._score}** ${temp}`;
        }).join("\n");
        return {
            text: `📈 **Top Leads (Scoring Automático):**\n\n${topLeads}\n\n💡 **Sugestão:** Foque no top 1 hoje! O score é calculado com base no preenchimento de dados, engajamento recente e valor potencial das propostas.`,
            type: "analysis",
            action: { label: "Ver Leads no CRM", route: "crm" }
        };
    }

    // ── ANÁLISE DE RISCO / CHURN ───────────────────────────────────────────────
    if (/risco|churn|perigo|perdendo/.test(input)) {
        if (!ctx.atRiskProps || ctx.atRiskProps.length === 0) {
            return { text: `✅ **Excelente!** Nenhuma proposta atual apresenta alto risco de churn (perda).`, type: "success" };
        }
        const riskList = ctx.atRiskProps.map(p => `• **${p.company}** — ${formatCurrency(p.value || 0)} (Risco: ${p._riskScore})`).join("\n");
        return {
            text: `⚠️ **Atenção: ${ctx.atRiskProps.length} proposta(s) em Risco Alto!**\n\n${riskList}\n\n💡 **Diagnóstico:** O risco aumenta por tempo sem fechamento, proximidade do vencimento ou palavras-chave críticas nas anotações (ex: "caro", "concorrência"). Entre em contato imediatamente!`,
            type: "warning",
            action: { label: "Revisar Propostas", route: "proposals" }
        };
    }

    // ── PROPOSTAS / PIPELINE ──────────────────────────────────────────────────
    if (/proposta|pipeline|aberta|pendente/.test(input)) {
        if (ctx.openProps.length === 0) {
            return { text: `📭 Não há propostas abertas no seu pipeline no momento.\n\n💡 **Sugestão:** Isso é um sinal para gerar novas oportunidades. Considere:\n• Entrar em contato com leads na etapa de Qualificação\n• Fazer follow-up com leads que tiveram reuniões recentes\n• Solicitar indicações de clientes ativos`, type: "warning" };
        }
        const total = ctx.openProps.reduce((s, p) => s + (p.value || 0), 0);
        const list = ctx.openProps.slice(0, 4).map(p => `• **${p.company}** — ${formatCurrency(p.value || 0)} (${p.status})`).join("\n");
        return {
            text: `📝 **Pipeline Ativo: ${ctx.openProps.length} proposta(s)**\n\nValor total em aberto: **${formatCurrency(total)}**\n\n${list}${ctx.openProps.length > 4 ? `\n• ...e mais ${ctx.openProps.length - 4} proposta(s)` : ""}\n\n${ctx.expiringProps.length > 0 ? `\n⚠️ **Urgente:** ${ctx.expiringProps.length} proposta(s) vencem em menos de 7 dias!` : ""}`,
            type: "analysis",
            action: { label: "Ver Propostas", route: "proposals" }
        };
    }

    // ── META DO MÊS ───────────────────────────────────────────────────────────
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

        let status = pct >= 100 ? "🏆 **Meta batida!** Parabéns!" :
            pct >= 75 ? "🔥 Quase lá! Você está no caminho certo." :
            pct >= 50 ? "📈 Progresso ok. Acelere o passo!" :
            "⚠️ Atenção: ritmo abaixo do esperado.";

        return {
            text: `🎯 **Sua Meta de Faturamento — Mês Atual**\n\n• Meta: **${formatCurrency(metaRevenue)}**\n• Realizado: **${formatCurrency(monthRevenue)}** (${pct}%)\n• Restante: **${formatCurrency(remaining)}**\n• Dias restantes: **${daysLeft} dias**\n• Precisa gerar por dia: **${formatCurrency(dailyNeeded)}/dia**\n\n${status}\n\n💡 Foco nas propostas abertas pode fechar ${formatCurrency(ctx.openProps.reduce((s, p) => s + (p.value || 0) * 0.5, 0))} estimados!`,
            type: pct >= 75 ? "success" : "analysis"
        };
    }

    // ── ALERTAS ───────────────────────────────────────────────────────────────
    if (/alerta|urgente|atenção|atencao|prioridade/.test(input)) {
        const alerts = [];
        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) alerts.push(`⚠️ **${ctx.atRiskProps.length} proposta(s)** com ALTO RISCO de perda`);
        if (ctx.expiringProps.length > 0) alerts.push(`⏰ **${ctx.expiringProps.length} proposta(s)** vencem em menos de 7 dias`);
        if (ctx.coldLeads.length > 0) alerts.push(`🧊 **${ctx.coldLeads.length} lead(s) frio(s)** sem contato há +14 dias`);
        const lostThisMonth = ctx.lostProps.filter(p => {
            const d = new Date(p.closedAt || p.sentAt);
            const now2 = new Date();
            return d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
        });
        if (lostThisMonth.length > 2) alerts.push(`📉 **${lostThisMonth.length} propostas perdidas** este mês — revise a abordagem`);
        if (ctx.openProps.length === 0) alerts.push(`📭 **Pipeline vazio** — crie novas propostas agora`);

        if (alerts.length === 0) {
            return { text: `✅ **Nenhum alerta crítico!** Sua operação está sob controle. Continue monitorando regularmente. 🎉`, type: "success" };
        }
        return { text: `🚨 **${alerts.length} Alerta(s) Prioritário(s):**\n\n${alerts.join("\n\n")}\n\n💡 Recomendo resolver esses pontos ainda hoje para não perder oportunidades.`, type: "warning" };
    }

    // ── PRÓXIMAS AÇÕES ────────────────────────────────────────────────────────
    if (/próxim|proxim|ação|acao|fazer|recomend|sugest/.test(input)) {
        const actions = [];
        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) actions.push(`🚨 Contornar objeções da proposta de **${ctx.atRiskProps[0].company}** — Alto risco de perda!`);
        if (ctx.scoredLeads && ctx.scoredLeads.length > 0 && ctx.scoredLeads[0]._score >= 70) actions.push(`🔥 Tentar fechamento com **${ctx.scoredLeads[0].company}** — Lead mais quente no momento!`);
        if (ctx.coldLeads.length > 0) actions.push(`📞 Ligar para **${ctx.coldLeads[0].company}** — lead frio há mais de 14 dias`);
        if (ctx.expiringProps.length > 0 && (!ctx.atRiskProps || ctx.atRiskProps[0].id !== ctx.expiringProps[0].id)) actions.push(`⚡ Renovar proposta para **${ctx.expiringProps[0].company}** — vence em breve`);
        if (ctx.highValueLead && (!ctx.atRiskProps || ctx.atRiskProps[0].id !== ctx.highValueLead.id)) actions.push(`💎 Priorizar proposta de **${ctx.highValueLead.company}** — maior valor: ${formatCurrency(ctx.highValueLead.value)}`);
        
        if (actions.length < 5 && ctx.leads.filter(l => l.stage === "Qualificação").length > 0) {
            const ql = ctx.leads.filter(l => l.stage === "Qualificação")[0];
            actions.push(`📝 Criar proposta para **${ql.company}** — está na etapa de Qualificação`);
        }
        if (actions.length < 5) actions.push(`📊 Revisar o Dashboard Gerencial para avaliar KPIs da semana`);

        return {
            text: `💡 **Top ${Math.min(actions.length, 5)} Ações Prioritárias para Hoje:**\n\n${actions.slice(0, 5).map((a, i) => `**${i + 1}.** ${a}`).join("\n\n")}`,
            type: "action"
        };
    }

    // ── CONCORRÊNCIA ──────────────────────────────────────────────────────────
    if (/concorrente|concorrência|concorrencia|perdeu|perda|motivo/.test(input)) {
        if (ctx.lostProps.length === 0) {
            return { text: `✅ Nenhuma proposta perdida registrada até o momento! Continue assim.`, type: "success" };
        }
        const reasons = {};
        ctx.lostProps.forEach(p => { if (p.lossReason) reasons[p.lossReason] = (reasons[p.lossReason] || 0) + 1; });
        const topReason = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])[0];

        return {
            text: `🏆 **Análise de Concorrência e Perdas**\n\n• Total de perdas: **${ctx.lostProps.length} proposta(s)**\n• Principal motivo: **"${topReason || "Não especificado"}"**\n${ctx.topCompetitor ? `• Concorrente que mais venceu: **${ctx.topCompetitor}**\n` : ""}\n💡 **Estratégia sugerida:** ${topReason?.includes("Preço") ? "Considere criar pacotes com mais valor percebido ou oferecer condições especiais para competir em preço." : "Acompanhe de perto os concorrentes citados e identifique diferenciais do seu serviço para destacar nas propostas."}`,
            type: "analysis"
        };
    }

    // ── TICKET MÉDIO ─────────────────────────────────────────────────────────
    if (/ticket|valor médio|valor medio|preço médio|preco medio/.test(input)) {
        const topSale = ctx.wonProps.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
        return {
            text: `💰 **Análise de Ticket Médio**\n\n• Ticket médio atual: **${formatCurrency(ctx.avgTicket)}**\n• Total de vendas: **${ctx.wonProps.length}**\n• Receita total: **${formatCurrency(ctx.totalRevenue)}**\n${topSale ? `• Maior venda: **${formatCurrency(topSale.value)}** (${topSale.company})\n` : ""}\n💡 **Dica:** Para aumentar o ticket médio, considere adicionar serviços complementares nas propostas (upsell) e destacar o retorno sobre investimento para o cliente.`,
            type: "analysis"
        };
    }

    // ── FALLBACK INTELIGENTE ──────────────────────────────────────────────────
    // Tenta extrair empresa mencionada
    const allCompanies = [...Store.getLeads(), ...Store.getProposals()].map(x => x.company?.toLowerCase()).filter(Boolean);
    const mentionedCompany = allCompanies.find(c => input.includes(c));
    if (mentionedCompany) {
        const lead = Store.getLeads().find(l => l.company?.toLowerCase() === mentionedCompany);
        const props = Store.getProposals().filter(p => p.company?.toLowerCase() === mentionedCompany);
        if (lead || props.length) {
            const info = lead ? `\n• Estágio: **${lead.stage}**\n• Segmento: **${lead.segment || "N/A"}**\n• Contato: **${lead.contact}** — ${lead.phone}` : "";
            const propInfo = props.length ? `\n\n📝 **Proposta(s):** ${props.map(p => `${p.title} — ${formatCurrency(p.value)} (${p.status})`).join(", ")}` : "";
            return { text: `🔍 **Informações sobre ${lead?.company || props[0]?.company}:**${info}${propInfo}`, type: "analysis" };
        }
    }

    // ── RECUPERAR LEAD FRIO / DICA DE FECHAMENTO ESPECÍFICO ────────────────────
    if (/fechar|recuperar|dica|salvar/.test(input)) {
        const company = [...ctx.leads, ...ctx.proposals].find(x => x.company && input.includes(x.company.toLowerCase()));
        if (company) {
            const isCold = ctx.coldLeads.some(l => l.id === company.id);
            const isAtRisk = ctx.atRiskProps.some(p => p.company?.toLowerCase() === company.company?.toLowerCase() || p.leadId === company.id);
            
            let tip = "";
            if (isCold) {
                tip = `🧊 **Como recuperar ${company.company}:**\n\nEste lead está sem contato há algum tempo. Recomendo enviar uma mensagem via WhatsApp ou ligar oferecendo uma breve demonstração das novas atualizações do sistema, ou perguntar se as prioridades mudaram neste trimestre.`;
            } else if (isAtRisk) {
                tip = `⚠️ **Como salvar a proposta de ${company.company}:**\n\nEssa proposta está classificada como de alto risco. Verifique se o decisor financeiro tem alguma objeção de orçamento e proponha um parcelamento facilitado ou uma bonificação no primeiro mês.`;
            } else {
                tip = `💡 **Dicas de fechamento para ${company.company}:**\n\nO relacionamento com esse lead está aquecido (Score de Engajamento: **${company._score || 50}**). Esta é a hora ideal para agendar uma reunião final de fechamento e apresentar um caso de sucesso de um segmento similar (Varejo/Serviços).`;
            }
            return {
                text: tip,
                type: "analysis",
                action: { label: "Abrir Detalhes do Lead", route: "crm", leadId: company.id }
            };
        }
    }

    return {
        text: `🤔 Hmm, não tenho certeza do que você quis dizer com "*${userInput}*".\n\nAlgumas sugestões:\n• "**resumo**" — visão geral\n• "**leads frios**" — quem requer atenção\n• "**alertas**" — situações críticas\n• "**próximas ações**" — o que fazer hoje\n• "**metas**" — quanto falta para bater a meta\n\nOu mencione o nome de uma empresa para ver os detalhes!`,
        type: "fallback"
    };
}

// =============================================================================
// MÓDULO PRINCIPAL DE RENDERIZAÇÃO
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
            ${msg.action ? `<button class="btn btn-primary ai-action-btn" data-route="${msg.action.route}" ${msg.action.leadId ? `data-leadid="${msg.action.leadId}"` : ""} style="margin-top: 12px; font-size: 12px; padding: 8px 16px;">${msg.action.label} →</button>` : ""}
        </div>
        ${!isAI ? `<div class="ai-user-avatar">${Auth.getCurrentUser()?.avatar || "U"}</div>` : ""}
    `;

    // Handler do botão de ação
    const actionBtn = div.querySelector(".ai-action-btn");
    if (actionBtn) {
        actionBtn.addEventListener("click", () => {
            const route = actionBtn.dataset.route;
            const leadId = actionBtn.dataset.leadid;
            document.querySelector(`[data-view="${route}"]`)?.click();
            if (leadId) {
                setTimeout(() => {
                    import('./crm.js').then(m => m.CRM.openLeadDrawer(leadId));
                }, 200);
            }
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

        if (!container || !form) return;

        // Limpar e reinicar apenas se não está inicializado
        if (!this.initialized) {
            container.innerHTML = "";
            this.initialized = true;

            // Mensagem de boas-vindas automática
            setTimeout(() => {
                const ctx = analyzeContext();
                const welcome = generateResponse("oi", ctx);
                chatHistory.push({ from: "ai", ...welcome });
                renderMessage({ from: "ai", ...welcome }, container);
                this.renderChips(ctx);
            }, 300);

            // Insights proativos após 1s
            setTimeout(() => {
                const ctx = analyzeContext();
                if (ctx.coldLeads.length > 0 || ctx.expiringProps.length > 0) {
                    const proactive = {
                        from: "ai",
                        text: `🔔 **Insight Proativo:** Detectei ${ctx.coldLeads.length > 0 ? `**${ctx.coldLeads.length} lead(s) frio(s)**` : ""}${ctx.coldLeads.length > 0 && ctx.expiringProps.length > 0 ? " e " : ""}${ctx.expiringProps.length > 0 ? `**${ctx.expiringProps.length} proposta(s) vencendo em breve**` : ""} que precisam de atenção.\n\nDigite "**alertas**" para ver os detalhes ou "**próximas ações**" para saber o que fazer agora.`,
                        type: "warning"
                    };

                    chatHistory.push(proactive);
                    renderMessage(proactive, container);
                    this.renderChips(ctx);
                }
            }, 1500);

            // Popula os Insights do Dia no painel lateral
            this.renderDailyInsights(container);

            // Submit do form
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const text = input?.value?.trim();
                if (!text) return;
                this.sendMessage(text, container, input);
            });
        }
    },

    renderChips(ctx) {
        const chipsContainer = document.getElementById("ai-chips-container");
        if (!chipsContainer) return;

        const chips = [
            { icon: "📊", label: "Resumo", query: "resumo" },
            { icon: "🧊", label: "Leads Frios", query: "leads frios" },
            { icon: "🚨", label: "Alertas", query: "alertas" }
        ];

        // Se houver algum lead frio, sugere como recuperar
        if (ctx.coldLeads && ctx.coldLeads.length > 0) {
            const l = ctx.coldLeads[0];
            chips.push({ icon: "❄️", label: `Como recuperar ${l.company}?`, query: `como recuperar ${l.company.toLowerCase()}` });
        }

        // Se houver proposta em risco
        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) {
            const p = ctx.atRiskProps[0];
            chips.push({ icon: "⚠️", label: `Salvar proposta da ${p.company}?`, query: `como salvar a proposta de ${p.company.toLowerCase()}` });
        } else if (ctx.scoredLeads && ctx.scoredLeads.length > 0) {
            // Se houver lead quente
            const l = ctx.scoredLeads[0];
            chips.push({ icon: "🔥", label: `Dica de fechamento para ${l.company}?`, query: `dicas para fechar o lead ${l.company.toLowerCase()}` });
        }

        chips.push({ icon: "🎯", label: "Meta", query: "meta" });
        chips.push({ icon: "🏆", label: "Concorrentes", query: "concorrência" });

        chipsContainer.innerHTML = chips.map(c => `
            <button class="ai-chip" data-query="${c.query}">${c.icon} ${c.label}</button>
        `).join("");

        // Re-vincular eventos
        chipsContainer.querySelectorAll(".ai-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                const query = btn.dataset.query;
                const input = document.getElementById("ai-chat-input");
                const messagesContainer = document.getElementById("ai-chat-messages");
                if (input) input.value = query;
                this.sendMessage(query, messagesContainer, input);
            });
        });
    },

    sendMessage(text, container, input) {
        if (!text.trim()) return;

        // Mensagem do usuário
        const userMsg = { from: "user", text };
        chatHistory.push(userMsg);
        renderMessage(userMsg, container);
        if (input) input.value = "";

        // Typing indicator
        const typingEl = showTyping(container);

        // Resposta da IA com delay realista
        const delay = 600 + Math.random() * 800;
        setTimeout(() => {
            typingEl.remove();
            const ctx = analyzeContext();
            const response = generateResponse(text, ctx);
            const aiMsg = { from: "ai", ...response };
            chatHistory.push(aiMsg);
            renderMessage(aiMsg, container);
            
            // Re-renderizar os chips dinamicamente
            this.renderChips(ctx);
        }, delay);
    },

    renderDailyInsights(chatContainer) {
        const insightsContainer = document.getElementById("ai-insights-container");
        if (!insightsContainer) return;
        
        const ctx = analyzeContext();
        insightsContainer.innerHTML = "";
        
        const insights = [];
        
        // Insight 1: Risco de Churn ou Leads Frios
        if (ctx.atRiskProps && ctx.atRiskProps.length > 0) {
            insights.push({
                icon: "⚠️",
                title: "Propostas em Risco",
                desc: `Você tem ${ctx.atRiskProps.length} proposta(s) com alto risco de perda.`,
                action: "Revisar Propostas",
                route: "proposals",
                command: "risco"
            });
        } else if (ctx.coldLeads.length > 0) {
            insights.push({
                icon: "🧊",
                title: "Leads Frios",
                desc: `${ctx.coldLeads.length} lead(s) sem contato há mais de 14 dias.`,
                action: "Ver Leads",
                route: "crm",
                command: "leads frios"
            });
        }

        // Insight 2: Metas ou Scoring
        if (ctx.scoredLeads && ctx.scoredLeads.length > 0) {
            const top = ctx.scoredLeads[0];
            insights.push({
                icon: "🔥",
                title: "Lead Quente",
                desc: `${top.company} está com score alto (${top._score}). Boa chance de fechamento.`,
                action: "Detalhes do Lead",
                route: "crm",
                command: "melhores leads"
            });
        } else {
            insights.push({
                icon: "🎯",
                title: "Progresso",
                desc: `Confira como está sua meta do mês.`,
                action: "Ver Meta",
                route: "dashboard",
                command: "meta"
            });
        }
        
        // Insight 3: Dica de Negócio
        if (ctx.openProps.length > 0) {
            insights.push({
                icon: "💰",
                title: "Pipeline Ativo",
                desc: `Você tem ${ctx.openProps.length} proposta(s) aberta(s).`,
                action: "Ver Resumo",
                route: "proposals",
                command: "resumo"
            });
        } else {
            insights.push({
                icon: "🔍",
                title: "Prospectar",
                desc: "Seu pipeline está vazio. É hora de prospectar!",
                action: "Novo Lead",
                route: "crm",
                command: "próximas ações"
            });
        }

        insightsContainer.innerHTML = insights.map(ins => `
            <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-color)'" onclick="document.getElementById('ai-chat-input').value='${ins.command}'; document.getElementById('ai-chat-form').dispatchEvent(new Event('submit'))">
                <div style="display: flex; gap: 10px; align-items: flex-start;">
                    <div style="font-size: 18px;">${ins.icon}</div>
                    <div>
                        <div style="font-weight: 700; font-size: 12px; color: var(--text-primary); margin-bottom: 4px;">${ins.title}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">${ins.desc}</div>
                        <span style="font-size: 10px; font-weight: 700; color: var(--primary);">Ask: "${ins.command}" &rarr;</span>
                    </div>
                </div>
            </div>
        `).join("");
    }
};
export { analyzeContext };