/**
 * Vellia Realtime — Supabase WebSocket Integration
 * Substitui o polling de 15s por eventos instantâneos via WebSocket.
 * Fallback automático: se o WS cair, o polling continua como seguro de rede.
 */

const SUPABASE_URL     = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY     = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";
const REALTIME_WS_BASE = "wss://ogrbsonpkiamoytxjshg.supabase.co/realtime/v1/websocket";

let ws         = null;
let wsActive   = false;
let reconnectDelay = 3000;
let heartbeatTimer = null;
let joinRef    = 1;
let msgRef     = 1;

// ─── Toast de notificação ──────────────────────────────────────────────
function showRealtimeToast(lead) {
    // Remover toast anterior se existir
    const old = document.getElementById("vellia-realtime-toast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "vellia-realtime-toast";
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: var(--bg-card, #1e293b);
        border: 1px solid rgba(24,119,242,0.4);
        border-left: 4px solid #1877F2;
        border-radius: 12px;
        padding: 14px 18px;
        min-width: 300px; max-width: 380px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        display: flex; align-items: flex-start; gap: 12px;
        animation: vellia-slide-in 0.4s cubic-bezier(0.4,0,0.2,1);
        font-family: 'Inter', sans-serif;
    `;

    const icon = document.createElement("div");
    icon.style.cssText = `
        width: 36px; height: 36px; border-radius: 8px;
        background: #1877F2; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center; font-size: 18px;
    `;
    icon.textContent = "📥";

    const body = document.createElement("div");
    body.style.flex = "1";

    const title = document.createElement("div");
    title.style.cssText = "font-weight: 700; font-size: 13px; color: var(--text-primary, #f1f5f9); margin-bottom: 3px;";
    title.textContent = "🟢 Novo Lead Meta Ads";

    const sub = document.createElement("div");
    sub.style.cssText = "font-size: 12px; color: var(--text-muted, #64748b); line-height: 1.4;";
    sub.textContent = `${lead.company || lead.name || "Lead sem nome"} · ${lead.segment || lead.source || "Meta Ads"}`;

    const time = document.createElement("div");
    time.style.cssText = "font-size: 10px; color: var(--text-muted, #64748b); margin-top: 4px;";
    time.textContent = "Agora · via Supabase Realtime ⚡";

    body.appendChild(title);
    body.appendChild(sub);
    body.appendChild(time);
    toast.appendChild(icon);
    toast.appendChild(body);

    // Injetar CSS de animação apenas uma vez
    if (!document.getElementById("vellia-realtime-style")) {
        const style = document.createElement("style");
        style.id = "vellia-realtime-style";
        style.textContent = `
            @keyframes vellia-slide-in {
                from { opacity: 0; transform: translateX(60px) scale(0.95); }
                to   { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes vellia-slide-out {
                from { opacity: 1; transform: translateX(0) scale(1); }
                to   { opacity: 0; transform: translateX(60px) scale(0.95); }
            }
            #vellia-realtime-badge {
                animation: vellia-pulse 2s ease-in-out infinite;
            }
            @keyframes vellia-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-fechar após 6 segundos
    setTimeout(() => {
        toast.style.animation = "vellia-slide-out 0.35s cubic-bezier(0.4,0,0.2,1) forwards";
        setTimeout(() => toast.remove(), 350);
    }, 6000);
}

// ─── Atualizar badge de status na UI ─────────────────────────────────
function updateStatusBadge(connected) {
    const badge = document.getElementById("realtime-status-badge");
    if (!badge) return;
    if (connected) {
        badge.style.background = "rgba(16,185,129,0.15)";
        badge.style.color = "#10b981";
        badge.style.borderColor = "rgba(16,185,129,0.3)";
        badge.textContent = "⚡ Realtime Ativo";
    } else {
        badge.style.background = "rgba(245,158,11,0.15)";
        badge.style.color = "#f59e0b";
        badge.style.borderColor = "rgba(245,158,11,0.3)";
        badge.textContent = "🔄 Reconectando...";
    }
}

// ─── Processar novo lead recebido via WS ──────────────────────────────
function processIncomingLead(lead) {
    if (!lead || !lead.id) return;

    const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
    const alreadyExists = localLeads.some(l => l.id === lead.id);
    if (alreadyExists) return;

    console.log("⚡ [Realtime] Novo lead recebido:", lead.company, lead.id);

    // Salvar localmente
    localLeads.push(lead);
    localStorage.setItem("comercial_leads", JSON.stringify(localLeads));

    // Disparar eventos de app
    window.dispatchEvent(new CustomEvent("vellia:leadAdded", { detail: lead }));
    window.dispatchEvent(new CustomEvent("vellia:waSent"));
    window.dispatchEvent(new Event("storage"));

    // Toast visual
    showRealtimeToast(lead);

    // SDR AI automático
    const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
    if (lead.source === "Meta Ads" && waConfig.sdrActive !== false) {
        setTimeout(() => {
            import("./sdr.js").then(m => m.SDR.runTriage(lead.id));
        }, 1500);
    }
}

// ─── Processar nova tarefa ou alteração de tarefa recebida via WS ──────
function processIncomingTask(type, record, oldRecord) {
    const task = record || oldRecord;
    if (!task || !task.owner) return;

    const ownerEmail = task.owner;
    const localKey = `seller_tasks_${ownerEmail}`;
    let localTasks = [];
    try {
        localTasks = JSON.parse(localStorage.getItem(localKey)) || [];
    } catch (e) {
        localTasks = [];
    }

    const taskId = task.id;
    const taskText = task.text;

    // Localizar a tarefa local correspondente
    const existingIndex = localTasks.findIndex(t => t.id === taskId || (t.text === taskText && t.date === task.date));

    if (type === "INSERT" || type === "UPDATE") {
        const formattedTask = {
            id: task.id,
            text: task.text,
            done: task.done === true || task.done === "true" || task.done === 1 || task.done === "1",
            date: task.date,
            priority: task.priority || "normal",
            assignedBy: task.assignedBy
        };

        if (existingIndex !== -1) {
            // Verificar se houve alteração real para evitar loops/re-renderizações desnecessárias
            const existing = localTasks[existingIndex];
            if (
                existing.done === formattedTask.done &&
                existing.text === formattedTask.text &&
                existing.priority === formattedTask.priority
            ) {
                return; // Nenhuma mudança real
            }
            localTasks[existingIndex] = formattedTask;
        } else {
            localTasks.push(formattedTask);
        }
    } else if (type === "DELETE" || type === "DELETE_ROW") {
        if (existingIndex === -1) return; // Não encontrada localmente, nada a fazer
        localTasks.splice(existingIndex, 1);
    } else {
        return; // Evento desconhecido
    }

    // Salvar localmente
    localStorage.setItem(localKey, JSON.stringify(localTasks));

    // Obter o usuário logado atualmente para decidir se notifica
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem("comercial_session"));
    } catch (e) {}

    // Notificar visualmente o vendedor se for uma nova tarefa atribuída por outra pessoa
    if (currentUser && ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) {
        if (type === "INSERT" && task.assignedBy && task.assignedBy.toLowerCase() !== currentUser.email.toLowerCase()) {
            window.dispatchEvent(new CustomEvent("vellia:aiNotification", {
                detail: {
                    id: `task_assigned_${task.id || Date.now()}`,
                    title: `📋 Nova Tarefa Atribuída!`,
                    message: `O gestor atribuiu a você a tarefa: "${task.text}" (Prioridade: ${task.priority || "normal"})`,
                    type: task.priority === "high" ? "danger" : "info"
                }
            }));
        }
    }

    // Disparar eventos para atualizar a UI
    window.dispatchEvent(new CustomEvent("vellia:tasksChanged", {
        detail: { owner: ownerEmail, type, task }
    }));
    window.dispatchEvent(new Event("storage"));
}

// ─── Heartbeat para manter WS vivo ───────────────────────────────────
function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: String(msgRef++)
            }));
        }
    }, 25000);
}

// ─── Conectar ao canal Realtime ───────────────────────────────────────
export function connectRealtime() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    const wsUrl = `${REALTIME_WS_BASE}?apikey=${SUPABASE_KEY}&vsn=1.0.0`;

    try {
        ws = new WebSocket(wsUrl);
    } catch (e) {
        console.warn("[Realtime] Falha ao criar WebSocket:", e.message);
        scheduleReconnect();
        return;
    }

    ws.onopen = () => {
        wsActive = true;
        reconnectDelay = 3000; // Resetar backoff
        console.log("✅ [Realtime] WebSocket conectado ao Supabase.");
        updateStatusBadge(true);
        startHeartbeat();

        // Entrar no canal da tabela comercial_leads
        ws.send(JSON.stringify({
            topic: "realtime:public:comercial_leads",
            event: "phx_join",
            payload: {
                config: {
                    broadcast: { self: false },
                    presence: { key: "" }
                }
            },
            ref: String(joinRef++),
            join_ref: String(joinRef)
        }));

        // Entrar no canal da tabela comercial_tasks
        ws.send(JSON.stringify({
            topic: "realtime:public:comercial_tasks",
            event: "phx_join",
            payload: {
                config: {
                    broadcast: { self: false },
                    presence: { key: "" }
                }
            },
            ref: String(joinRef++),
            join_ref: String(joinRef)
        }));
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);

            // Confirmar join bem-sucedido
            if (msg.event === "phx_reply" && msg.payload?.status === "ok") {
                console.log("📡 [Realtime] Canal inscrito:", msg.topic);
                return;
            }

            // Evento de INSERT na tabela comercial_leads
            if (
                msg.topic === "realtime:public:comercial_leads" &&
                msg.event === "INSERT"
            ) {
                const lead = msg.payload?.record;
                if (lead) processIncomingLead(lead);
            }

            // Evento na tabela comercial_tasks
            if (msg.topic === "realtime:public:comercial_tasks") {
                const type = msg.event; // "INSERT", "UPDATE", "DELETE"
                const record = msg.payload?.record || msg.payload?.new_record || msg.payload?.data?.record;
                const oldRecord = msg.payload?.old_record || msg.payload?.data?.old_record;
                processIncomingTask(type, record, oldRecord);
            }

            // Supabase Realtime v2: eventos aninhados em postgres_changes
            if (msg.event === "broadcast" || msg.event === "postgres_changes") {
                const changes = msg.payload?.data || msg.payload;
                if (changes) {
                    if (changes.table === "comercial_leads") {
                        if (changes.type === "INSERT" || changes.type === "UPDATE") {
                            const lead = changes.record || changes.new_record;
                            if (lead) processIncomingLead(lead);
                        }
                    } else if (changes.table === "comercial_tasks") {
                        const type = changes.type;
                        const record = changes.record || changes.new_record;
                        const oldRecord = changes.old_record;
                        processIncomingTask(type, record, oldRecord);
                    }
                }
            }

        } catch (e) {
            // Ignorar mensagens malformadas
        }
    };

    ws.onerror = (e) => {
        console.warn("[Realtime] Erro no WebSocket:", e.type);
    };

    ws.onclose = (e) => {
        wsActive = false;
        clearInterval(heartbeatTimer);
        console.warn(`[Realtime] WebSocket fechado (code: ${e.code}). Reconectando em ${reconnectDelay / 1000}s...`);
        updateStatusBadge(false);
        scheduleReconnect();
    };
}

// ─── Backoff exponencial para reconexão ──────────────────────────────
function scheduleReconnect() {
    setTimeout(() => {
        connectRealtime();
        reconnectDelay = Math.min(reconnectDelay * 1.5, 30000); // Máx 30s
    }, reconnectDelay);
}

// ─── Desconectar (útil ao sair da sessão) ────────────────────────────
export function disconnectRealtime() {
    clearInterval(heartbeatTimer);
    if (ws) {
        ws.onclose = null; // Evitar reconexão automática
        ws.close();
        ws = null;
    }
    wsActive = false;
    updateStatusBadge(false);
}

export const isRealtimeActive = () => wsActive;
