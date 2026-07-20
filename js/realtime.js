/**
 * Vellia Realtime — Supabase WebSocket Integration
 * Substitui o polling de 15s por eventos instantâneos via WebSocket.
 * Fallback automático: se o WS cair, o polling continua como seguro de rede.
 */
import { Store } from "./store.js";

const SUPABASE_URL     = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY     = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";
const REALTIME_WS_BASE = "wss://ogrbsonpkiamoytxjshg.supabase.co/realtime/v1/websocket";

let ws         = null;
let wsActive   = false;
let reconnectDelay = 3000;
let heartbeatTimer = null;
let joinRef    = 1;
let msgRef     = 1;
let pingStartTimes = {};

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

    let localLeads = [];
    try {
        localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
    } catch (e) {
        localLeads = [];
    }
    const alreadyExists = localLeads.some(l => l && l.id === lead.id);
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
            const ref = String(msgRef++);
            pingStartTimes[ref] = Date.now();
            ws.send(JSON.stringify({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: ref
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

        // Configurar popover interativo ao clicar no badge
        const badge = document.getElementById("realtime-status-badge");
        if (badge && !badge.dataset.listenerBound) {
            badge.dataset.listenerBound = "true";
            badge.style.cursor = "pointer";
            badge.title = "Clique para ver detalhes da conexão";
            badge.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleRealtimePopover(badge);
            });
        }

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

            // Resposta de heartbeat/ping ou confirmação de join
            if (msg.event === "phx_reply") {
                if (pingStartTimes[msg.ref]) {
                    const latency = Date.now() - pingStartTimes[msg.ref];
                    window.realtimeLatency = latency;
                    delete pingStartTimes[msg.ref];
                    const pingEl = document.getElementById("realtime-ping");
                    if (pingEl) pingEl.textContent = `${latency} ms`;
                }
                if (msg.payload?.status === "ok") {
                    console.log("📡 [Realtime] Canal inscrito:", msg.topic);
                    return;
                }
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

            // Supabase Realtime v2: eventos aninhados em postgres_changes ou broadcast
            if (msg.event === "broadcast" || msg.event === "postgres_changes") {
                const changes = msg.payload?.data || msg.payload;
                if (changes) {
                    if (changes.event === "tasks_changed" || (msg.payload && msg.payload.event === "tasks_changed")) {
                        const payloadData = changes.payload || msg.payload.payload;
                        const ownerEmail = payloadData?.owner;
                        if (ownerEmail) {
                            console.log("⚡ [Realtime] Broadcast de tarefas recebido para:", ownerEmail);
                            Store.syncTasksForUser(ownerEmail);
                        }
                    } else if (changes.table === "comercial_leads") {
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

export function broadcastTaskChange(ownerEmail) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            topic: "realtime:public:comercial_tasks",
            event: "broadcast",
            payload: {
                type: "broadcast",
                event: "tasks_changed",
                payload: { owner: ownerEmail }
            },
            ref: String(msgRef++)
        }));
        console.log("⚡ [Realtime] Enviou broadcast de alteração de tarefas para:", ownerEmail);
    }
}

// Escutar alterações locais de tarefas para realizar o broadcast
window.addEventListener("vellia:localTasksMutated", (e) => {
    const { owner } = e.detail || {};
    if (owner) {
        broadcastTaskChange(owner);
    }
});

// Popover interativo com estatísticas da conexão realtime
function toggleRealtimePopover(badge) {
    const existing = document.getElementById("realtime-status-popover");
    if (existing) {
        existing.remove();
        return;
    }

    const rect = badge.getBoundingClientRect();
    const popover = document.createElement("div");
    popover.id = "realtime-status-popover";
    popover.style.cssText = `
        position: fixed;
        top: ${rect.bottom + window.scrollY + 8}px;
        right: ${window.innerWidth - rect.right}px;
        width: 290px;
        background: var(--bg-card, #1e293b);
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        border-radius: 14px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        padding: 16px;
        z-index: 99999;
        font-family: inherit;
        animation: slideDownFade 0.2s ease;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: var(--text-primary, #f1f5f9);
    `;

    // Obter estatísticas locais de leads e tasks
    let leadsCount = 0;
    let tasksCount = 0;
    try {
        leadsCount = (JSON.parse(localStorage.getItem("comercial_leads")) || []).length;
    } catch(e){}
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith("seller_tasks_")) {
                tasksCount += (JSON.parse(localStorage.getItem(key)) || []).length;
            }
        }
    } catch(e){}

    const latency = window.realtimeLatency ? `${window.realtimeLatency} ms` : "Calculando...";

    popover.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1)); padding-bottom: 8px;">
            <span style="font-size: 14px;">⚡</span>
            <strong style="font-size: 13.5px; font-weight: 700; color: var(--text-primary);">Conexão Supabase Realtime</strong>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: var(--text-secondary, #94a3b8); margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between;">
                <span>Status da Sessão:</span>
                <strong style="color: #10b981;">Ativa</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Latência (Ping):</span>
                <strong id="realtime-ping" style="color: var(--text-primary);">${latency}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Leads na Cache:</span>
                <strong style="color: var(--text-primary);">${leadsCount} registros</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Tarefas na Cache:</span>
                <strong style="color: var(--text-primary);">${tasksCount} registradas</strong>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
                <span style="font-size: 10px; color: var(--text-muted);">Canais WebSocket Inscritos:</span>
                <code style="font-size: 9.5px; background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px; color: var(--primary); font-family: monospace;">comercial_leads (Replication)</code>
                <code style="font-size: 9.5px; background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px; color: var(--primary); font-family: monospace;">comercial_tasks (Hybrid Sync)</code>
            </div>
        </div>
        <button id="btn-force-sync-realtime" style="
            width: 100%; padding: 8px 12px; border-radius: 8px;
            background: var(--primary, #6366f1); color: #fff;
            border: none; font-size: 12px; font-weight: 700;
            cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
            transition: all 0.2s; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
        ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="sync-icon" style="transition: transform 1s ease;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Forçar Sincronização</span>
        </button>
    `;

    document.body.appendChild(popover);

    if (!document.getElementById("style-popover-animation")) {
        const style = document.createElement("style");
        style.id = "style-popover-animation";
        style.textContent = `
            @keyframes slideDownFade {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes spin {
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    const syncBtn = popover.querySelector("#btn-force-sync-realtime");
    syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        syncBtn.style.opacity = "0.7";
        syncBtn.style.cursor = "not-allowed";
        const icon = syncBtn.querySelector(".sync-icon");
        if (icon) icon.style.animation = "spin 1s linear infinite";
        syncBtn.querySelector("span").textContent = "Sincronizando...";

        try {
            await Store.syncFromSupabase();
            
            syncBtn.querySelector("span").textContent = "Sincronizado! 🎉";
            if (icon) icon.style.animation = "";
            syncBtn.style.background = "#10b981";
            syncBtn.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.2)";
            
            if (window.dispatchEvent) {
                window.dispatchEvent(new Event("storage"));
            }

            setTimeout(() => {
                popover.remove();
            }, 1200);
        } catch(err) {
            syncBtn.querySelector("span").textContent = "Erro na sincronização";
            if (icon) icon.style.animation = "";
            syncBtn.style.background = "#dc2626";
            setTimeout(() => {
                syncBtn.disabled = false;
                syncBtn.style.opacity = "1";
                syncBtn.style.cursor = "pointer";
                syncBtn.querySelector("span").textContent = "Forçar Sincronização";
                syncBtn.style.background = "var(--primary, #6366f1)";
            }, 2000);
        }
    });

    const clickOutside = (event) => {
        if (!popover.contains(event.target) && event.target !== badge) {
            popover.remove();
            document.removeEventListener("click", clickOutside);
        }
    };
    document.addEventListener("click", clickOutside);
}
