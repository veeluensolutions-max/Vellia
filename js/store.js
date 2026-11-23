/**
 * Store - Camada de Banco de Dados Local (localStorage)
 */

const DEFAULT_USERS = [
    {
        id: "usr_admin",
        name: "Administrador Geral",
        email: "admin@vellia.com",
        password: "123456",
        role: "admin",
        avatar: "AG",
        status: "active",
        companyAccess: "Ambas",
        lastLoginAt: null
    },
    {
        id: "usr_operacoes",
        name: "Controle Operacional",
        email: "operacoes@vellia.com",
        password: "123",
        role: "operacional",
        avatar: "OP",
        status: "active",
        companyAccess: "Ambas",
        lastLoginAt: null
    },
    {
        id: "usr_seller",
        name: "Vendedor Teste",
        email: "vendedor@vellia.com",
        password: "123",
        role: "seller",
        avatar: "VT",
        status: "active",
        companyAccess: "Ambas",
        lastLoginAt: null
    }
];

const INITIAL_LOGS = [];
const INITIAL_LEADS = [];
const INITIAL_PROPOSALS = [];

const INITIAL_SERVICES = [
    {
        id: "srv_1",
        name: "Sistema de Gestão (ERP)",
        category: "Software",
        baseMargin: 65, // %
        isActive: true
    },
    {
        id: "srv_2",
        name: "Ponto de Venda (PDV)",
        category: "Software",
        baseMargin: 70,
        isActive: true
    },
    {
        id: "srv_3",
        name: "Aplicativo Mobile",
        category: "Desenvolvimento",
        baseMargin: 50,
        isActive: true
    },
    {
        id: "srv_4",
        name: "Consultoria e Implantação",
        category: "Serviço",
        baseMargin: 85,
        isActive: true
    }
];

const INITIAL_GOALS = [];

// Credenciais e API REST do Supabase
const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";

async function supabaseFetch(table) {
    const separator = table.includes('?') ? '&' : '?';
    const selectParam = table.includes('select=') ? '' : `${separator}select=*`;
    const url = `${SUPABASE_URL}/rest/v1/${table}${selectParam}`;
    const response = await fetch(url, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        }
    });
    if (!response.ok) throw new Error(`Supabase query failed: ${response.statusText}`);
    return await response.json();
}

// =========================================================================
// HELPERS DE METADADOS: GESTÃOCLICK & CAMPOS AVANÇADOS NO SUPABASE
// =========================================================================
function sanitizeIsoDate(dateVal, fallback = null) {
    if (!dateVal) return fallback;
    if (typeof dateVal === "string") {
        const trimmed = dateVal.trim();
        if (trimmed === "") return fallback;
        // Se for string YYYY-MM-DD pura, fixar às 12:00:00 UTC para evitar recuo de fuso horário (-3h no Brasil)
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return `${trimmed}T12:00:00.000Z`;
        }
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return d.toISOString();
}

function encodeProposalForSupabase(prop) {
    if (!prop) return prop;
    const supabaseCols = new Set([
        'id', 'leadId', 'company', 'contact', 'title', 'value', 'status',
        'sentAt', 'closedAt', 'validUntil', 'competitor', 'lossReason',
        'notes', 'createdBy', 'createdAt', 'workspace'
    ]);

    const meta = {};
    for (const [k, v] of Object.entries(prop)) {
        if (!supabaseCols.has(k)) {
            if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
                meta[k] = v;
            }
        }
    }

    let notesText = (prop.notes || "").replace(/\n\n<!-- GESTAOCLICK_METADATA:[\s\S]*?-->/g, "").trim();
    if (Object.keys(meta).length > 0) {
        notesText = `${notesText}\n\n<!-- GESTAOCLICK_METADATA:${JSON.stringify(meta)} -->`;
    }

    return {
        id: prop.id,
        leadId: prop.leadId ? String(prop.leadId).trim() : null,
        company: String(prop.company || "").trim(),
        contact: String(prop.contact || "").trim(),
        title: String(prop.title || "").trim(),
        value: typeof prop.value === "number" && !isNaN(prop.value) ? prop.value : (parseFloat(prop.value) || 0),
        status: String(prop.status || "Enviada").trim(),
        sentAt: sanitizeIsoDate(prop.sentAt, new Date().toISOString()),
        closedAt: sanitizeIsoDate(prop.closedAt, null),
        validUntil: sanitizeIsoDate(prop.validUntil, null),
        competitor: String(prop.competitor || "").trim(),
        lossReason: String(prop.lossReason || "").trim(),
        notes: notesText,
        createdBy: String(prop.createdBy || "sistema@vellia.com").trim(),
        createdAt: sanitizeIsoDate(prop.createdAt, new Date().toISOString()),
        workspace: String(prop.workspace || localStorage.getItem("activeCompany") || "Veeluen Solutions").trim()
    };
}

function decodeProposalFromSupabase(rawProp) {
    if (!rawProp) return rawProp;
    const notesStr = rawProp.notes || "";
    const match = notesStr.match(/<!-- GESTAOCLICK_METADATA:([\s\S]*?)-->/);
    let decoded = rawProp;
    if (match) {
        try {
            const meta = JSON.parse(match[1]);
            const cleanNotes = notesStr.replace(/\n\n<!-- GESTAOCLICK_METADATA:[\s\S]*?-->/g, "").trim();
            decoded = {
                ...rawProp,
                ...meta,
                notes: cleanNotes
            };
        } catch (e) {
            console.warn("Falha ao decodificar metadados de proposta do Supabase:", e);
        }
    }
    if (decoded.status === "Aguardando Agendamento") {
        decoded = { ...decoded, status: "Ganho" };
    }
    return decoded;
}

function encodeLeadForSupabase(lead) {
    if (!lead) return lead;
    const supabaseCols = new Set([
        'id', 'company', 'contact', 'role', 'phone', 'whatsapp',
        'email', 'city', 'state', 'segment', 'source', 'stage',
        'owner', 'interactions', 'stageHistory', 'phone2', 'email2',
        'notes', 'workspace'
    ]);

    const meta = {};
    for (const [k, v] of Object.entries(lead)) {
        if (!supabaseCols.has(k)) {
            if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
                meta[k] = v;
            }
        }
    }

    let notesText = (lead.notes || "").replace(/\n\n<!-- LEAD_META:[\s\S]*?-->/g, "").trim();
    if (Object.keys(meta).length > 0) {
        notesText = `${notesText}\n\n<!-- LEAD_META:${JSON.stringify(meta)} -->`;
    }

    const cleanLead = {};
    for (const key of supabaseCols) {
        if (lead.hasOwnProperty(key)) {
            cleanLead[key] = lead[key];
        }
    }
    cleanLead.id = lead.id;
    cleanLead.company = lead.company || "";
    cleanLead.notes = notesText;
    cleanLead.workspace = lead.workspace || localStorage.getItem("activeCompany") || "Veeluen Solutions";
    return cleanLead;
}

function decodeLeadFromSupabase(rawLead) {
    if (!rawLead) return rawLead;
    const notesStr = rawLead.notes || "";
    const match = notesStr.match(/<!-- LEAD_META:([\s\S]*?)-->/);
    if (match) {
        try {
            const meta = JSON.parse(match[1]);
            const cleanNotes = notesStr.replace(/\n\n<!-- LEAD_META:[\s\S]*?-->/g, "").trim();
            return {
                ...rawLead,
                ...meta,
                notes: cleanNotes
            };
        } catch (e) {
            console.warn("Falha ao decodificar metadados de lead do Supabase:", e);
        }
    }
    return rawLead;
}

export function getLeadTimestamp(lead) {
    if (!lead) return 0;
    if (lead.createdAt) {
        const t = new Date(lead.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    if (Array.isArray(lead.stageHistory) && lead.stageHistory.length > 0) {
        const first = lead.stageHistory[0];
        if (first && first.timestamp) {
            const t = new Date(first.timestamp).getTime();
            if (!isNaN(t) && t > 0) return t;
        }
    }
    if (typeof lead.id === "string" && lead.id.startsWith("lead_")) {
        const parts = lead.id.split("_");
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 1000000000000) return parsed;
    }
    return 0;
}

const TABLE_SCHEMAS = {
    comercial_users: ['id', 'name', 'email', 'password', 'role', 'avatar', 'status', 'lastLoginAt'],
    comercial_leads: ['id', 'workspace', 'company', 'contact', 'role', 'phone', 'whatsapp', 'email', 'city', 'state', 'segment', 'source', 'stage', 'owner', 'interactions', 'stageHistory', 'phone2', 'email2', 'notes'],
    comercial_proposals: ['id', 'workspace', 'leadId', 'company', 'contact', 'title', 'value', 'status', 'sentAt', 'closedAt', 'validUntil', 'competitor', 'lossReason', 'notes', 'createdBy', 'createdAt'],
    comercial_logs: ['id', 'timestamp', 'userEmail', 'action', 'details', 'status'],
    comercial_services: ['id', 'name', 'category', 'baseMargin', 'isActive'],
    comercial_goals: ['userEmail', 'period', 'targets'],
    comercial_tasks: ['id', 'workspace', 'owner', 'text', 'done', 'date', 'priority', 'assignedBy'],
    comercial_calendar_events: ['id', 'workspace', 'title', 'company', 'date', 'time', 'type', 'status', 'notes', 'phone', 'contact', 'leadId'],
    comercial_contracts: ['id', 'workspace', 'leadId', 'proposalId', 'number', 'status', 'totalValue', 'recurringValue', 'periodicity', 'startDate', 'endDate', 'autoRenew', 'warningDays', 'owner', 'createdBy', 'notes', 'createdAt', 'updatedAt'],
    comercial_contract_services: ['id', 'contractId', 'serviceId', 'quantity', 'unitValue']
};

async function upsertSupabase(table, data) {
    // Se for tabela de contratos ainda não criada no Supabase, ignorar para evitar erro 404
    if (table === "comercial_contracts" || table === "comercial_contract_services") {
        return;
    }

    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const timestampFields = new Set(['sentAt', 'closedAt', 'validUntil', 'createdAt', 'updatedAt', 'lastLoginAt']);
    try {
        let payload = data;
        if (TABLE_SCHEMAS[table]) {
            if (Array.isArray(data)) {
                payload = data.map(item => {
                    const filtered = {};
                    for (const key of TABLE_SCHEMAS[table]) {
                        if (item && item.hasOwnProperty(key)) {
                            let val = item[key];
                            if (timestampFields.has(key) && (val === "" || val === undefined)) val = null;
                            filtered[key] = val;
                        }
                    }
                    return filtered;
                });
            } else {
                payload = {};
                for (const key of TABLE_SCHEMAS[table]) {
                    if (data && data.hasOwnProperty(key)) {
                        let val = data[key];
                        if (timestampFields.has(key) && (val === "" || val === undefined)) val = null;
                        payload[key] = val;
                    }
                }
            }
        }
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errBody = await response.text();
            console.warn(`Supabase Sync Error for ${table}: [Status ${response.status}]`, errBody);
        }
    } catch (e) {
        console.warn(`Supabase Sync Error for ${table}:`, e);
    }
}

async function deleteSupabase(table, filter = "") {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`;
    try {
        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) {
            const errBody = await response.text();
            console.warn(`Supabase Delete Error for ${table}: [Status ${response.status}]`, errBody);
        }
    } catch (e) {
        console.warn(`Supabase Delete Error for ${table}:`, e);
    }
}

// =========================================================================
// CACHE EM MEMÓRIA (ULTRA FAST IN-MEMORY CACHE)
// Elimina o gargalo de centenas de JSON.parse/localStorage repetitivos
// =========================================================================
const MemoryCache = {
    _cache: new Map(),

    get(key, fallbackFn = null) {
        if (this._cache.has(key)) {
            return this._cache.get(key);
        }
        let data = null;
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null && raw !== undefined) {
                data = JSON.parse(raw);
            } else if (typeof fallbackFn === "function") {
                data = fallbackFn();
            }
        } catch (e) {
            data = typeof fallbackFn === "function" ? fallbackFn() : null;
        }
        this._cache.set(key, data);
        return data;
    },

    set(key, val) {
        this._cache.set(key, val);
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) {
            console.warn(`[MemoryCache] Falha ao persistir ${key} no localStorage:`, e);
        }
    },

    invalidate(key = null) {
        if (key) {
            this._cache.delete(key);
        } else {
            this._cache.clear();
        }
    }
};

// Sincronização entre abas: se outra aba alterar o localStorage, invalidamos a chave
window.addEventListener("storage", (e) => {
    if (e && e.key) {
        MemoryCache.invalidate(e.key);
    } else {
        MemoryCache.invalidate();
    }
});

function isTestArtifactRecord(item) {
    if (!item) return false;
    const comp = String(item.company || item.details || "").toUpperCase();
    return comp.includes("INDÚSTRIA METALÚRGICA NORDESTE") || comp.includes("INDUSTRIA METALURGICA NORDESTE");
}

// Sincronização em background no início da aplicação (Execução paralela ultrarrápida)
async function syncFromSupabase() {
    try {
        const [
            usersRes,
            goalsRes,
            eventsRes,
            leadsRes,
            proposalsRes,
            logsRes,
            servicesRes,
            tasksRes
        ] = await Promise.allSettled([
            supabaseFetch("comercial_users"),
            supabaseFetch("comercial_goals"),
            supabaseFetch("comercial_calendar_events"),
            supabaseFetch("comercial_leads"),
            supabaseFetch("comercial_proposals"),
            supabaseFetch("comercial_logs?order=timestamp.desc&limit=100"),
            supabaseFetch("comercial_services"),
            supabaseFetch("comercial_tasks?select=*&limit=300")
        ]);

        // 1. Usuários
        if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value) && usersRes.value.length > 0) {
            const remoteUsers = usersRes.value;
            const deletedEmails = new Set((JSON.parse(localStorage.getItem("comercial_deleted_user_emails")) || []).map(e => e.toLowerCase().trim()));
            const deletedIds = new Set(JSON.parse(localStorage.getItem("comercial_deleted_user_ids")) || []);

            const validUsers = [];
            for (const u of remoteUsers) {
                if (!u || !u.email) continue;
                const emailNorm = u.email.toLowerCase().trim();
                if (u.role === "system" || u.id === "usr_meta_config" || emailNorm.includes("config@")) {
                    continue;
                }
                if (deletedEmails.has(emailNorm) || deletedIds.has(u.id)) {
                    deleteSupabase("comercial_users", `?id=eq.${encodeURIComponent(u.id)}`);
                    continue;
                }
                const isExcelencia = emailNorm === 'mika@vellia.com' || emailNorm.includes('excelenciaambiental') || (u.name && u.name.toLowerCase().includes('mika'));
                const companyAccess = u.companyAccess || (isExcelencia ? 'Excelência Ambiental' : 'Ambas');
                validUsers.push({ ...u, companyAccess });
            }

            MemoryCache.set("comercial_users", validUsers);
            localStorage.setItem("comercial_users_initialized", "true");
            try {
                window.dispatchEvent(new CustomEvent("vellia:userUpdated", { detail: validUsers }));
            } catch (evErr) { }
        }

        // 2. Metas
        if (goalsRes.status === "fulfilled" && Array.isArray(goalsRes.value)) {
            MemoryCache.set("comercial_goals", goalsRes.value);
        }

        // 3. Calendário
        if (eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value)) {
            const remoteEvents = eventsRes.value;
            const eventMap = new Map();
            remoteEvents.forEach(e => { if (e && e.id) eventMap.set(e.id, e); });
            MemoryCache.set("vellia_calendar_events", Array.from(eventMap.values()));
        }

        // 4. Leads (Supabase é a fonte da verdade)
        if (leadsRes.status === "fulfilled" && Array.isArray(leadsRes.value)) {
            const remoteLeads = leadsRes.value;
            const localLeads = (MemoryCache.get("comercial_leads", () => []) || []).filter(l => !isTestArtifactRecord(l));
            const localMap = new Map();
            localLeads.forEach(l => { if (l && l.id) localMap.set(l.id, l); });

            const leadMap = new Map();
            remoteLeads.forEach(rawRemote => {
                if (!rawRemote || !rawRemote.id) return;
                if (isTestArtifactRecord(rawRemote)) {
                    deleteSupabase("comercial_leads", `?id=eq.${encodeURIComponent(rawRemote.id)}`);
                    return;
                }
                const remote = decodeLeadFromSupabase(rawRemote);
                const local = localMap.get(remote.id);
                if (!local) {
                    leadMap.set(remote.id, remote);
                } else {
                    const isRecentLocal = local._lastModified && (Date.now() - local._lastModified < 12000);
                    if (isRecentLocal) {
                        leadMap.set(remote.id, {
                            ...remote,
                            ...local,
                            stage: local.stage || remote.stage,
                            stageHistory: local.stageHistory || remote.stageHistory,
                            interactions: (Array.isArray(local.interactions) && local.interactions.length >= (remote.interactions || []).length)
                                ? local.interactions
                                : (remote.interactions || [])
                        });
                    } else {
                        leadMap.set(remote.id, remote);
                    }
                }
            });

            // Preservar apenas leads recém-criados nesta aba nos últimos 12s cujo POST ainda esteja em trânsito
            localLeads.forEach(ll => {
                if (ll && ll.id && !leadMap.has(ll.id) && !isTestArtifactRecord(ll)) {
                    const ageMs = Date.now() - (ll._lastModified || getLeadTimestamp(ll) || 0);
                    if (ageMs >= 0 && ageMs < 12000) {
                        leadMap.set(ll.id, ll);
                        upsertSupabase("comercial_leads", encodeLeadForSupabase(ll));
                    }
                }
            });

            const mergedLeads = Array.from(leadMap.values()).sort((a, b) => getLeadTimestamp(b) - getLeadTimestamp(a));
            MemoryCache.set("comercial_leads", mergedLeads);
        }

        // 5. Propostas (Supabase é a fonte da verdade)
        if (proposalsRes.status === "fulfilled" && Array.isArray(proposalsRes.value)) {
            const remoteProposals = proposalsRes.value;
            const localProposals = (MemoryCache.get("comercial_proposals", () => []) || []).filter(p => !isTestArtifactRecord(p));
            const localPropMap = new Map();
            localProposals.forEach(p => { if (p && p.id) localPropMap.set(p.id, p); });

            const propMap = new Map();
            remoteProposals.forEach(rawProp => {
                if (!rawProp || !rawProp.id) return;
                if (isTestArtifactRecord(rawProp)) {
                    deleteSupabase("comercial_proposals", `?id=eq.${encodeURIComponent(rawProp.id)}`);
                    return;
                }
                const p = decodeProposalFromSupabase(rawProp);
                const localP = localPropMap.get(p.id);
                if (localP && localP._lastModified && (Date.now() - localP._lastModified < 12000)) {
                    propMap.set(p.id, { ...p, ...localP });
                } else {
                    propMap.set(p.id, p);
                }
            });

            // Preservar apenas propostas recém-criadas nos últimos 12s cujo POST ainda esteja em trânsito
            localProposals.forEach(lp => {
                if (lp && lp.id && !propMap.has(lp.id) && !isTestArtifactRecord(lp)) {
                    const createdTs = lp._lastModified || (lp.createdAt ? new Date(lp.createdAt).getTime() : 0);
                    const ageMs = Date.now() - createdTs;
                    if (ageMs >= 0 && ageMs < 12000) {
                        propMap.set(lp.id, lp);
                        upsertSupabase("comercial_proposals", encodeProposalForSupabase(lp));
                    }
                }
            });

            const mergedProps = Array.from(propMap.values());
            MemoryCache.set("comercial_proposals", mergedProps);
        }

        // 6. Logs de Auditoria (Últimos 100)
        if (logsRes.status === "fulfilled" && Array.isArray(logsRes.value)) {
            const cleanLogs = logsRes.value.filter(lg => !isTestArtifactRecord(lg));
            const sortedLogs = cleanLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            MemoryCache.set("comercial_logs", sortedLogs);
        }

        // 7. Serviços
        if (servicesRes.status === "fulfilled" && Array.isArray(servicesRes.value)) {
            const remoteServices = servicesRes.value;
            const localServices = MemoryCache.get("comercial_services", () => INITIAL_SERVICES) || INITIAL_SERVICES;
            let mergedServices = [...remoteServices];
            let needsUpsert = false;
            localServices.forEach(localS => {
                const exists = mergedServices.some(s => s.id === localS.id);
                if (!exists) {
                    mergedServices.push(localS);
                    needsUpsert = true;
                }
            });
            MemoryCache.set("comercial_services", mergedServices);
            if (needsUpsert) {
                upsertSupabase("comercial_services", mergedServices);
            }
        }

        // 8. Tarefas dos Vendedores
        if (tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value)) {
            const allRemoteTasks = tasksRes.value;
            const users = MemoryCache.get("comercial_users", () => DEFAULT_USERS) || [];
            const sellers = users.filter(u => u.role === "seller" || u.role === "manager");
            const tasksByOwner = {};
            allRemoteTasks.forEach(t => {
                if (!t || !t.owner) return;
                const owner = t.owner.toLowerCase().trim();
                if (!tasksByOwner[owner]) tasksByOwner[owner] = [];
                tasksByOwner[owner].push({
                    id: t.id,
                    text: t.text,
                    done: t.done === true || t.done === "true" || t.done === 1 || t.done === "1",
                    date: t.date,
                    priority: t.priority || "normal",
                    assignedBy: t.assignedBy
                });
            });

            for (const s of sellers) {
                if (!s || !s.email) continue;
                const key = `seller_tasks_${s.email}`;
                const formattedTasks = tasksByOwner[s.email.toLowerCase().trim()] || [];
                MemoryCache.set(key, formattedTasks);
            }
        }

        // Disparar eventos para atualizar todos os componentes em tempo real
        window.dispatchEvent(new CustomEvent("vellia:leadUpdated"));
        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
        window.dispatchEvent(new CustomEvent("vellia:cloudSynced", { detail: { timestamp: Date.now() } }));
        window.dispatchEvent(new Event("storage"));
    } catch (e) {
        console.warn("syncFromSupabase error:", e);
    }
}

// Inicialização segura do localStorage
function initStorage() {
    let existingUsers = [];
    try {
        existingUsers = JSON.parse(localStorage.getItem("comercial_users")) || [];
    } catch (e) { }

    const isInitialized = localStorage.getItem("comercial_users_initialized");

    // Injetar DEFAULT_USERS APENAS se for a primeira vez e o banco/storage estiverem vazios
    if (!isInitialized && existingUsers.length === 0) {
        MemoryCache.set("comercial_users", DEFAULT_USERS);
        localStorage.setItem("comercial_users_initialized", "true");
    }
    if (!localStorage.getItem("comercial_logs")) {
        MemoryCache.set("comercial_logs", INITIAL_LOGS);
    } else {
        try {
            const existingLogs = (JSON.parse(localStorage.getItem("comercial_logs")) || []).filter(lg => !isTestArtifactRecord(lg));
            MemoryCache.set("comercial_logs", existingLogs);
        } catch (e) { }
    }
    if (!localStorage.getItem("comercial_leads")) {
        MemoryCache.set("comercial_leads", []);
    } else {
        try {
            const existingLeads = (JSON.parse(localStorage.getItem("comercial_leads")) || []).filter(l => !isTestArtifactRecord(l));
            if (Array.isArray(existingLeads)) {
                existingLeads.sort((a, b) => getLeadTimestamp(b) - getLeadTimestamp(a));
                MemoryCache.set("comercial_leads", existingLeads);
            }
        } catch (e) { }
    }
    if (!localStorage.getItem("comercial_proposals")) {
        MemoryCache.set("comercial_proposals", []);
    } else {
        try {
            const existingProps = (JSON.parse(localStorage.getItem("comercial_proposals")) || []).filter(p => !isTestArtifactRecord(p));
            MemoryCache.set("comercial_proposals", existingProps);
        } catch (e) { }
    }
    if (!localStorage.getItem("comercial_goals")) {
        MemoryCache.set("comercial_goals", []);
    }
    if (!localStorage.getItem("comercial_services") || localStorage.getItem("comercial_services") === "[]") {
        MemoryCache.set("comercial_services", INITIAL_SERVICES);
    }
    if (!localStorage.getItem("vellia_calendar_events")) {
        MemoryCache.set("vellia_calendar_events", []);
    }
}

function startSyncPolling() {
    setInterval(async () => {
        if (document.hidden) return;
        try {
            const [leadsRes, propsRes, logsRes] = await Promise.allSettled([
                supabaseFetch("comercial_leads"),
                supabaseFetch("comercial_proposals"),
                supabaseFetch("comercial_logs?order=timestamp.desc&limit=100")
            ]);

            let anySyncedChange = false;

            if (leadsRes.status === "fulfilled" && Array.isArray(leadsRes.value)) {
                const rawRemoteLeads = leadsRes.value.filter(rl => {
                    if (isTestArtifactRecord(rl)) {
                        if (rl && rl.id) deleteSupabase("comercial_leads", `?id=eq.${encodeURIComponent(rl.id)}`);
                        return false;
                    }
                    return true;
                });
                const decodedRemoteLeads = rawRemoteLeads.map(l => decodeLeadFromSupabase(l));
                const localLeads = (MemoryCache.get("comercial_leads", () => []) || []).filter(l => !isTestArtifactRecord(l));
                const localMap = new Map();
                localLeads.forEach(l => { if (l && l.id) localMap.set(l.id, l); });

                const nextLeadMap = new Map();
                let hasChanges = decodedRemoteLeads.length !== localLeads.length;
                const newLeads = [];

                decodedRemoteLeads.forEach(remote => {
                    if (!remote || !remote.id) return;
                    const local = localMap.get(remote.id);
                    if (!local) {
                        nextLeadMap.set(remote.id, remote);
                        newLeads.push(remote);
                        hasChanges = true;
                    } else {
                        const isRecentLocal = local._lastModified && (Date.now() - local._lastModified < 12000);
                        if (isRecentLocal) {
                            nextLeadMap.set(remote.id, {
                                ...remote,
                                ...local,
                                stage: local.stage || remote.stage,
                                stageHistory: local.stageHistory || remote.stageHistory,
                                interactions: (Array.isArray(local.interactions) && local.interactions.length >= (remote.interactions || []).length)
                                    ? local.interactions
                                    : (remote.interactions || [])
                            });
                        } else {
                            const localIntStr = JSON.stringify(local.interactions || []);
                            const remoteIntStr = JSON.stringify(remote.interactions || []);
                            if (
                                local.stage !== remote.stage ||
                                local.owner !== remote.owner ||
                                local.company !== remote.company ||
                                localIntStr !== remoteIntStr
                            ) {
                                hasChanges = true;
                            }
                            nextLeadMap.set(remote.id, remote);
                        }
                    }
                });

                // Manter leads recém-criados nesta aba (< 12s) ainda em trânsito
                localLeads.forEach(ll => {
                    if (ll && ll.id && !nextLeadMap.has(ll.id)) {
                        const ageMs = Date.now() - (ll._lastModified || getLeadTimestamp(ll) || 0);
                        if (ageMs >= 0 && ageMs < 12000) {
                            nextLeadMap.set(ll.id, ll);
                        } else {
                            hasChanges = true;
                        }
                    }
                });

                if (hasChanges || newLeads.length > 0) {
                    const mergedLeads = Array.from(nextLeadMap.values()).sort((a, b) => getLeadTimestamp(b) - getLeadTimestamp(a));
                    MemoryCache.set("comercial_leads", mergedLeads);
                    anySyncedChange = true;

                    newLeads.forEach(newLead => {
                        window.dispatchEvent(new CustomEvent("vellia:leadAdded", { detail: newLead }));
                        const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
                        if (newLead.source === "Meta Ads" && waConfig.sdrActive !== false) {
                            setTimeout(() => {
                                import('./sdr.js').then(m => m.SDR.runTriage(newLead.id));
                            }, 1500);
                        }
                    });

                    window.dispatchEvent(new CustomEvent("vellia:stageChanged"));
                    window.dispatchEvent(new CustomEvent("vellia:leadUpdated"));
                    window.dispatchEvent(new CustomEvent("vellia:waSent"));
                }
            }

            // Polling de propostas em tempo real
            if (propsRes.status === "fulfilled" && Array.isArray(propsRes.value)) {
                const rawRemoteProps = propsRes.value.filter(rp => {
                    if (isTestArtifactRecord(rp)) {
                        if (rp && rp.id) deleteSupabase("comercial_proposals", `?id=eq.${encodeURIComponent(rp.id)}`);
                        return false;
                    }
                    return true;
                });
                const remoteProps = rawRemoteProps.map(p => decodeProposalFromSupabase(p));
                const localProps = (MemoryCache.get("comercial_proposals", () => []) || []).filter(p => !isTestArtifactRecord(p));
                if (JSON.stringify(remoteProps) !== JSON.stringify(localProps)) {
                    MemoryCache.set("comercial_proposals", remoteProps);
                    anySyncedChange = true;
                    window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
                }
            }

            // Polling de logs de auditoria
            if (logsRes.status === "fulfilled" && Array.isArray(logsRes.value)) {
                const remoteLogs = logsRes.value.filter(lg => !isTestArtifactRecord(lg));
                const localLogs = MemoryCache.get("comercial_logs", () => []) || [];
                if (remoteLogs.length !== localLogs.length || (remoteLogs[0]?.id !== localLogs[0]?.id)) {
                    MemoryCache.set("comercial_logs", remoteLogs);
                    anySyncedChange = true;
                    window.dispatchEvent(new CustomEvent("vellia:logsUpdated", { detail: remoteLogs }));
                }
            }

            if (anySyncedChange) {
                window.dispatchEvent(new CustomEvent("vellia:cloudSynced", { detail: { timestamp: Date.now() } }));
                window.dispatchEvent(new Event("storage"));
            }
        } catch (e) {
            console.log("Erro no polling de sincronização do Supabase:", e.message);
        }
    }, 8000); // 8s — Sincronização contínua em conjunto com o Realtime WebSocket
}

// Inicializar local storage e sincronizar
initStorage();
syncFromSupabase();
startSyncPolling();

export const Store = {
    cache: MemoryCache,

    // CALENDÁRIO
    getCalendarEvents() {
        return MemoryCache.get("vellia_calendar_events", () => []) || [];
    },
    saveCalendarEvents(events) {
        MemoryCache.set("vellia_calendar_events", events);
        try { localStorage.setItem("vellia_calendar_events", JSON.stringify(events)); } catch (e) { }
        upsertSupabase("comercial_calendar_events", events);
        try { window.dispatchEvent(new CustomEvent("vellia:calendarEventsUpdated", { detail: events })); } catch (e) { }
    },

    DEFAULT_USERS,

    // USUÁRIOS
    getUsers() {
        const users = MemoryCache.get("comercial_users", () => DEFAULT_USERS);
        const list = (Array.isArray(users) && users.length > 0) ? users : DEFAULT_USERS;
        return list.filter(u => u && u.role !== "system" && u.id !== "usr_meta_config" && !(u.email && String(u.email).toLowerCase().includes("config@")));
    },

    saveUsers(users) {
        MemoryCache.set("comercial_users", users);
        upsertSupabase("comercial_users", users);
    },

    async deleteUser(userId) {
        if (!userId) return false;
        const users = this.getUsers();
        const target = users.find(u => u && (u.id === userId || u.email === userId));

        const targetId = target ? target.id : userId;
        const targetEmail = target && target.email ? target.email.toLowerCase().trim() : null;

        // 1. Guardar nos tombstones persistentes para nunca ser ressuscitado
        try {
            const deletedIds = JSON.parse(localStorage.getItem("comercial_deleted_user_ids") || "[]");
            if (targetId && !deletedIds.includes(targetId)) {
                deletedIds.push(targetId);
                localStorage.setItem("comercial_deleted_user_ids", JSON.stringify(deletedIds));
            }
            if (targetEmail) {
                const deletedEmails = JSON.parse(localStorage.getItem("comercial_deleted_user_emails") || "[]");
                if (!deletedEmails.includes(targetEmail)) {
                    deletedEmails.push(targetEmail);
                    localStorage.setItem("comercial_deleted_user_emails", JSON.stringify(deletedEmails));
                }
            }
        } catch (e) { }

        // 2. Remover do cache e localStorage imediatamente
        const updatedUsers = users.filter(u => u && u.id !== targetId && (!targetEmail || u.email?.toLowerCase().trim() !== targetEmail));
        MemoryCache.set("comercial_users", updatedUsers);

        // 3. Deletar no Supabase imediatamente tanto por ID quanto por E-mail
        try {
            if (targetId) {
                await deleteSupabase("comercial_users", `?id=eq.${encodeURIComponent(targetId)}`);
            }
            if (targetEmail) {
                await deleteSupabase("comercial_users", `?email=eq.${encodeURIComponent(targetEmail)}`);
            }
        } catch (e) {
            console.warn("Erro ao deletar usuário no Supabase:", e);
        }

        // 4. Disparar eventos para UI em tempo real
        window.dispatchEvent(new CustomEvent("vellia:userDeleted", { detail: { id: targetId, email: targetEmail } }));
        window.dispatchEvent(new Event("storage"));

        return true;
    },

    getUserByEmail(email) {
        if (!email || typeof email !== "string") return null;
        return this.getUsers().find(u => u && u.email && typeof u.email === "string" && u.email.toLowerCase() === email.toLowerCase());
    },

    // LEADS (CRM)
    getLeadTimestamp: getLeadTimestamp,

    getLeads() {
        // Retorna apenas leads ativos (sem deleted_at), excluindo itens da lixeira, sempre com cadastrados mais recentes no topo
        const allLeads = this.getAllLeadsRaw();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return allLeads.filter(l => {
            if (l.deleted_at) return false;
            const w = l.workspace || "Veeluen Solutions";
            return w === activeCompany;
        }).sort((a, b) => getLeadTimestamp(b) - getLeadTimestamp(a));
    },

    getAllLeadsRaw() {
        // Retorna TODOS os leads incluindo os que estão na lixeira (acesso instantâneo via MemoryCache)
        return MemoryCache.get("comercial_leads", () => []) || [];
    },

    getTrashLeads() {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return this.getAllLeadsRaw().filter(l => {
            if (!l.deleted_at) return false;
            if (l.workspace && l.workspace !== activeCompany && activeCompany !== "Veeluen Solutions") return false;
            // Legacy items without workspace go to Veeluen
            if (!l.workspace && activeCompany !== "Veeluen Solutions") return false;

            const deletedTs = new Date(l.deleted_at).getTime();
            return (now - deletedTs) < THIRTY_DAYS_MS;
        });
    },

    saveLeads(workspaceLeads) {
        let allLeads = this.getAllLeadsRaw();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";

        // Remove leads from active company from allLeads
        allLeads = allLeads.filter(l => {
            const w = l.workspace || "Veeluen Solutions";
            return w !== activeCompany;
        });

        // Add updated leads
        allLeads = allLeads.concat(workspaceLeads);

        MemoryCache.set("comercial_leads", allLeads);
        if (Array.isArray(workspaceLeads)) {
            for (const lead of workspaceLeads) {
                upsertSupabase("comercial_leads", encodeLeadForSupabase(lead));
            }
        }
    },

    getLogs() {
        return MemoryCache.get("comercial_logs", () => []) || [];
    },

    saveLogs(logs) {
        MemoryCache.set("comercial_logs", logs);
        if (Array.isArray(logs) && logs.length > 0) {
            upsertSupabase("comercial_logs", logs[0]);
        }
    },

    getLeadById(id) {
        // Busca em TODOS os leads (ativos + lixeira) para operações de restauração
        if (id == null) return null;
        return this.getAllLeadsRaw().find(l => String(l.id) === String(id)) || null;
    },

    moveToTrash(leadId, userEmail = "sistema@vellia.com") {
        // Move o lead para a lixeira sem excluir permanentemente
        const allLeads = this.getAllLeadsRaw();
        const index = allLeads.findIndex(l => l.id === leadId);
        if (index === -1) return false;
        allLeads[index].deleted_at = new Date().toISOString();
        allLeads[index].deleted_by = userEmail;
        MemoryCache.set("comercial_leads", allLeads);
        upsertSupabase("comercial_leads", encodeLeadForSupabase(allLeads[index]));
        window.dispatchEvent(new CustomEvent("vellia:leadDeleted"));
        return true;
    },

    restoreLead(leadId, userEmail = "sistema@vellia.com") {
        // Remove os campos de lixeira restaurando o lead ao CRM ativo
        const allLeads = this.getAllLeadsRaw();
        const index = allLeads.findIndex(l => l.id === leadId);
        if (index === -1) return false;
        delete allLeads[index].deleted_at;
        delete allLeads[index].deleted_by;
        MemoryCache.set("comercial_leads", allLeads);
        upsertSupabase("comercial_leads", encodeLeadForSupabase(allLeads[index]));
        this.addLog(userEmail, "LEAD_RESTORED", `Lead "${allLeads[index].company}" restaurado da lixeira por ${userEmail}.`, "SUCCESS");
        return allLeads[index];
    },

    purgeLeads(leadIds, userEmail = "sistema@vellia.com") {
        // Exclui definitivamente os leads do banco (uso exclusivo de admins/gerentes)
        const allLeads = this.getAllLeadsRaw().filter(l => !leadIds.includes(l.id));
        MemoryCache.set("comercial_leads", allLeads);
        for (const id of leadIds) {
            deleteSupabase("comercial_leads", `?id=eq.${id}`);
        }
        this.addLog(userEmail, "LEAD_PURGED", `${leadIds.length} lead(s) excluído(s) definitivamente da lixeira por ${userEmail}.`, "SUCCESS");
        window.dispatchEvent(new CustomEvent("vellia:leadDeleted"));
    },

    assignLeadsBulk(leadIds, newOwnerEmail, userEmail = "sistema@vellia.com") {
        if (!Array.isArray(leadIds) || leadIds.length === 0) return [];
        const allLeads = this.getAllLeadsRaw();
        const nowIso = new Date().toISOString();
        const updated = [];
        const users = this.getUsers ? this.getUsers() : [];
        const targetUser = newOwnerEmail ? users.find(u => u.email === newOwnerEmail) : null;
        const targetName = targetUser ? (targetUser.name || targetUser.email) : (newOwnerEmail || "Não atribuído");
        const sellersOnly = users.filter(u => u && (u.role === "seller" || u.role === "vendedor"));

        const idSet = new Set(leadIds.map(String));
        let roundRobinIdx = 0;

        allLeads.forEach(lead => {
            if (idSet.has(String(lead.id))) {
                const oldOwner = lead.owner || "Não atribuído";
                let assignedOwner = newOwnerEmail;
                let assignedName = targetName;

                if (newOwnerEmail === "__ROUND_ROBIN__") {
                    if (sellersOnly.length > 0) {
                        const chosen = sellersOnly[roundRobinIdx % sellersOnly.length];
                        assignedOwner = chosen.email;
                        assignedName = chosen.name || chosen.email;
                        roundRobinIdx++;
                    } else {
                        assignedOwner = userEmail;
                        assignedName = userEmail;
                    }
                }

                lead.owner = assignedOwner || null;
                lead._lastModified = Date.now();
                lead.interactions = lead.interactions || [];
                lead.interactions.push({
                    id: "assign_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                    type: "Observação",
                    description: `👤 Lead redirecionado em massa de "${oldOwner}" para "${assignedName}" por ${userEmail}.`,
                    timestamp: nowIso,
                    userEmail
                });
                updated.push(lead);
                upsertSupabase("comercial_leads", encodeLeadForSupabase(lead));
            }
        });

        if (updated.length > 0) {
            MemoryCache.set("comercial_leads", allLeads);
            this.addLog(userEmail, "LEADS_BULK_ASSIGNED", `${updated.length} lead(s) direcionado(s) para "${targetName}" por ${userEmail}.`, "SUCCESS");
            window.dispatchEvent(new CustomEvent("vellia:leadUpdated"));
            window.dispatchEvent(new CustomEvent("vellia:leadsBulkAssigned", { detail: { count: updated.length, owner: newOwnerEmail } }));
        }
        return updated;
    },

    deleteLead(leadId) {
        // Mantido para compatibilidade retroativa - agora chama purgeLeads
        const allLeads = this.getAllLeadsRaw().filter(l => l.id !== leadId);
        MemoryCache.set("comercial_leads", allLeads);
        deleteSupabase("comercial_leads", `?id=eq.${leadId}`);
    },

    addLead(lead, userEmail = "sistema@vellia.com") {
        const leads = this.getAllLeadsRaw();
        const nowIso = new Date().toISOString();
        let targetWorkspace = lead.workspace;
        if (!targetWorkspace) {
            const isMika = userEmail === "mika@vellia.com" || (typeof Auth !== "undefined" && Auth.getCurrentUser && Auth.getCurrentUser()?.email === "mika@vellia.com");
            const curAccess = (typeof Auth !== "undefined" && Auth.getCurrentUser) ? Auth.getCurrentUser()?.companyAccess : null;
            if (curAccess && curAccess !== "Ambas") {
                targetWorkspace = curAccess;
            } else if (isMika) {
                targetWorkspace = "Excelência Ambiental";
            } else {
                targetWorkspace = localStorage.getItem('activeCompany') || 'Veeluen Solutions';
            }
        }
        const newLead = {
            id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            workspace: targetWorkspace,
            cnpj: lead.cnpj || "",
            company: lead.company,
            contact: lead.contact,
            role: lead.role || "",
            phone: lead.phone || "",
            whatsapp: lead.whatsapp || "",
            phone2: lead.phone2 || "",
            email2: lead.email2 || "",
            notes: lead.notes || "",
            email: lead.email || "",
            city: lead.city || "",
            state: lead.state || "",
            segment: lead.segment || "Outros",
            source: lead.source || "Outbound",
            stage: lead.stage || "Contato",
            owner: lead.owner || userEmail,
            createdBy: lead.createdBy || userEmail,
            createdAt: lead.createdAt || nowIso,
            _lastModified: Date.now(),
            interactions: lead.interactions || [],
            stageHistory: lead.stageHistory || [
                {
                    stage: lead.stage || "Contato",
                    userEmail: lead.userEmail || userEmail,
                    timestamp: nowIso,
                    reason: "Cadastro inicial do lead."
                }
            ]
        };
        leads.unshift(newLead);
        MemoryCache.set("comercial_leads", leads);
        upsertSupabase("comercial_leads", encodeLeadForSupabase(newLead));

        // Notificar agentes de IA e rankings sobre o novo lead gerado
        window.dispatchEvent(new CustomEvent("vellia:leadAdded", { detail: newLead }));
        window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: newLead.createdBy || newLead.owner, action: "LEAD_ADDED", points: 50 } }));
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new Event("storage"));

        return newLead;
    },

    createLead(lead, userEmail = "sistema@vellia.com") {
        return this.addLead(lead, userEmail);
    },

    async addLeadsBulk(leadsInputArray, userEmail = "sistema@vellia.com") {
        if (!Array.isArray(leadsInputArray) || leadsInputArray.length === 0) return [];
        const leads = this.getAllLeadsRaw();
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();

        const isMika = userEmail === "mika@vellia.com" || (typeof Auth !== "undefined" && Auth.getCurrentUser && Auth.getCurrentUser()?.email === "mika@vellia.com");
        const curAccess = (typeof Auth !== "undefined" && Auth.getCurrentUser) ? Auth.getCurrentUser()?.companyAccess : null;
        let defaultWorkspace = localStorage.getItem('activeCompany') || 'Veeluen Solutions';
        if (curAccess && curAccess !== "Ambas") {
            defaultWorkspace = curAccess;
        } else if (isMika) {
            defaultWorkspace = "Excelência Ambiental";
        }

        const createdLeads = leadsInputArray.map((lead, idx) => {
            const stage = lead.stage || "Contato";
            const ownerEmail = lead.owner || userEmail;
            const creatorEmail = lead.createdBy || userEmail;
            return {
                id: `lead_${nowMs + idx}_${Math.random().toString(36).substr(2, 5)}`,
                workspace: lead.workspace || defaultWorkspace,
                cnpj: lead.cnpj || "",
                company: String(lead.company || "").trim(),
                contact: String(lead.contact || "Responsável").trim(),
                role: String(lead.role || "").trim(),
                phone: String(lead.phone || "").trim(),
                whatsapp: String(lead.whatsapp || lead.phone || "").trim(),
                phone2: String(lead.phone2 || "").trim(),
                email2: String(lead.email2 || "").trim(),
                notes: String(lead.notes || "").trim(),
                email: String(lead.email || "").trim(),
                city: String(lead.city || "").trim(),
                state: String(lead.state || "").trim(),
                segment: String(lead.segment || "Outros").trim(),
                source: String(lead.source || "Planilha Excel").trim(),
                stage,
                owner: ownerEmail,
                createdBy: creatorEmail,
                createdAt: lead.createdAt || nowIso,
                _lastModified: nowMs,
                interactions: lead.interactions || [],
                stageHistory: lead.stageHistory || [
                    {
                        stage,
                        userEmail: creatorEmail,
                        timestamp: nowIso,
                        reason: "Importação de leads via planilha Excel."
                    }
                ]
            };
        });

        const updatedAllLeads = [...createdLeads, ...leads];
        MemoryCache.set("comercial_leads", updatedAllLeads);

        // Sincronizar em lotes de 50 registros com o Supabase
        const encodedAll = createdLeads.map(l => encodeLeadForSupabase(l));
        for (let i = 0; i < encodedAll.length; i += 50) {
            const chunk = encodedAll.slice(i, i + 50);
            await upsertSupabase("comercial_leads", chunk);
        }

        this.addLog(userEmail, "LEADS_IMPORTED_EXCEL", `${createdLeads.length} lead(s) importado(s) via planilha Excel.`, "SUCCESS");
        if (createdLeads[0]) {
            window.dispatchEvent(new CustomEvent("vellia:leadAdded", { detail: createdLeads[0] }));
        }
        window.dispatchEvent(new CustomEvent("vellia:leadsUpdated"));
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new Event("storage"));

        return createdLeads;
    },


    updateLead(leadId, updatedData, userEmail = "sistema@vellia.com") {
        const leads = this.getAllLeadsRaw();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            leads[index] = { ...leads[index], ...updatedData, _lastModified: Date.now() };
            MemoryCache.set("comercial_leads", leads);
            upsertSupabase("comercial_leads", encodeLeadForSupabase(leads[index]));
            this.addLog(userEmail, "LEAD_UPDATED", `Lead ${leads[index].company} atualizado.`);
            window.dispatchEvent(new CustomEvent("vellia:leadUpdated", { detail: leads[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "LEAD_UPDATED" } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
            return leads[index];
        }
        return null;
    },

    addLeadInteraction(leadId, userEmail, interaction) {
        // Tratar caso onde os parâmetros de e-mail e interação foram invertidos
        if (userEmail && typeof userEmail === "object" && (!interaction || typeof interaction === "string")) {
            const temp = userEmail;
            userEmail = interaction || "sistema@vellia.com";
            interaction = temp;
        }

        const leads = this.getAllLeadsRaw();
        const index = leads.findIndex(l => String(l.id) === String(leadId));
        if (index !== -1) {
            const newInteraction = {
                id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                type: interaction?.type || "WhatsApp", // Ligação, WhatsApp, Reunião, etc.
                description: interaction?.description || "",
                timestamp: new Date().toISOString(),
                userEmail
            };
            leads[index].interactions = leads[index].interactions || [];
            leads[index].interactions.push(newInteraction);
            leads[index]._lastModified = Date.now();
            MemoryCache.set("comercial_leads", leads);
            upsertSupabase("comercial_leads", encodeLeadForSupabase(leads[index]));
            window.dispatchEvent(new CustomEvent("vellia:leadUpdated", { detail: leads[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "INTERACTION_ADDED", points: 10 } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent", { detail: { leadId: leads[index].id, lead: leads[index], interaction: newInteraction } }));
            window.dispatchEvent(new Event("storage"));
            return newInteraction;
        }
        return null;
    },

    updateLeadStage(leadId, newStage, userEmail, reason = "") {
        const leads = this.getAllLeadsRaw();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            const oldStage = leads[index].stage;
            leads[index].stage = newStage;
            leads[index]._lastModified = Date.now();

            // Gravar histórico de etapas
            leads[index].stageHistory = leads[index].stageHistory || [];
            leads[index].stageHistory.push({
                stage: newStage,
                userEmail,
                timestamp: new Date().toISOString(),
                reason: reason || `Transição manual de etapa.`
            });

            // Salvar no cache local e localStorage imediatamente
            MemoryCache.set("comercial_leads", leads);

            // 1. PATCH Direto e Atômico no Supabase (garante gravação imediata do stage no banco)
            fetch(`${SUPABASE_URL}/rest/v1/comercial_leads?id=eq.${encodeURIComponent(leadId)}`, {
                method: "PATCH",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                    stage: newStage,
                    stageHistory: leads[index].stageHistory
                })
            }).then(res => {
                if (!res.ok) {
                    console.warn("⚠️ PATCH Supabase stage retornou status:", res.status);
                    upsertSupabase("comercial_leads", encodeLeadForSupabase(leads[index]));
                }
            }).catch(err => {
                console.error("❌ Erro no PATCH Supabase:", err);
                upsertSupabase("comercial_leads", encodeLeadForSupabase(leads[index]));
            });

            // 2. Disparar eventos para todos os ouvintes da aplicação (Kanban, CRM, Dashboard)
            window.dispatchEvent(new CustomEvent("vellia:stageChanged", { detail: { leadId, oldStage, newStage } }));
            window.dispatchEvent(new CustomEvent("vellia:leadUpdated", { detail: leads[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "STAGE_CHANGED", oldStage, newStage, points: 30 } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
            window.dispatchEvent(new Event("storage"));
            return { success: true, oldStage, newStage };
        }
        return { success: false };
    },

    getLeadById(leadId) {
        const leads = this.getAllLeadsRaw();
        return leads.find(l => l.id === leadId) || null;
    },

    // CONTRATOS
    getContracts() {
        return MemoryCache.get("comercial_contracts", () => []) || [];
    },

    getContractById(id) {
        return this.getContracts().find(c => c.id === id) || null;
    },

    addContract(data) {
        const contracts = this.getContracts();
        const newContract = {
            id: `ct_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            workspace: localStorage.getItem('activeCompany') || 'Veeluen Solutions',
            leadId: data.leadId || "",
            proposalId: data.proposalId || null,
            number: data.number || `CT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            status: data.status || "Em formalização",
            totalValue: parseFloat(data.totalValue) || 0,
            recurringValue: parseFloat(data.recurringValue) || 0,
            periodicity: data.periodicity || "Mensal",
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            autoRenew: data.autoRenew || false,
            warningDays: parseInt(data.warningDays) || 30,
            owner: data.owner || "",
            createdBy: data.createdBy || "sistema@vellia.com",
            notes: data.notes || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        contracts.push(newContract);
        MemoryCache.set("comercial_contracts", contracts);
        upsertSupabase("comercial_contracts", newContract);

        if (data.services && data.services.length > 0) {
            const cServices = this.getContractServices();
            data.services.forEach(srv => {
                const cs = {
                    contractId: newContract.id,
                    serviceId: srv.serviceId,
                    quantity: srv.quantity || 1,
                    unitValue: srv.unitValue || 0
                };
                cServices.push(cs);
                upsertSupabase("comercial_contract_services", cs);
            });
            MemoryCache.set("comercial_contract_services", cServices);
        }

        this.addLog(data.createdBy, "CONTRACT_CREATED", `Contrato ${newContract.number} criado.`);
        return newContract;
    },

    updateContract(id, updates, userEmail = "sistema@vellia.com") {
        const contracts = this.getContracts();
        const index = contracts.findIndex(c => c.id === id);
        if (index !== -1) {
            contracts[index] = { ...contracts[index], ...updates, updatedAt: new Date().toISOString() };
            MemoryCache.set("comercial_contracts", contracts);
            upsertSupabase("comercial_contracts", contracts[index]);
            this.addLog(userEmail, "CONTRACT_UPDATED", `Contrato ${contracts[index].number} atualizado.`);
            return contracts[index];
        }
        return null;
    },

    getContractServices() {
        return MemoryCache.get("comercial_contract_services", () => []) || [];
    },

    getServicesForContract(contractId) {
        return this.getContractServices().filter(cs => cs.contractId === contractId);
    },

    // PROPOSTAS
    getProposals() {
        const all = this.getProposalsRaw();
        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return all.filter(p => {
            const w = p.workspace || "Veeluen Solutions";
            return w === activeCompany;
        });
    },

    getProposalsRaw() {
        const list = MemoryCache.get("comercial_proposals", () => []) || [];
        return list.map(p => (p && p.status === "Aguardando Agendamento") ? { ...p, status: "Ganho" } : p);
    },

    getProposalById(id) {
        if (!id) return null;
        const strId = String(id);
        return this.getProposals().find(p => p && String(p.id) === strId) ||
            this.getProposalsRaw().find(p => p && String(p.id) === strId) ||
            null;
    },

    addProposal(data) {
        const proposals = this.getProposalsRaw();
        const creator = data.createdBy || "sistema@vellia.com";
        const isMika = creator === "mika@vellia.com" || (typeof Auth !== "undefined" && Auth.getCurrentUser && Auth.getCurrentUser()?.email === "mika@vellia.com");
        const curAccess = (typeof Auth !== "undefined" && Auth.getCurrentUser) ? Auth.getCurrentUser()?.companyAccess : null;
        let ws = data.workspace;
        if (!ws) {
            if (data.leadId) {
                const lead = this.getLeadById(data.leadId);
                if (lead && lead.workspace) ws = lead.workspace;
            }
            if (!ws) {
                if (curAccess && curAccess !== "Ambas") {
                    ws = curAccess;
                } else if (isMika) {
                    ws = "Excelência Ambiental";
                } else {
                    ws = localStorage.getItem('activeCompany') || 'Veeluen Solutions';
                }
            }
        }
        const newProposal = {
            id: data.id || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            workspace: ws,
            leadId: data.leadId || "",
            company: data.company || "",
            contact: data.contact || "",
            title: data.title || "",
            value: parseFloat(data.value) || 0,
            status: data.status || "Enviada",
            sentAt: data.sentAt ? sanitizeIsoDate(data.sentAt, new Date().toISOString()) : new Date().toISOString(),
            closedAt: data.closedAt ? sanitizeIsoDate(data.closedAt, null) : null,
            validUntil: data.validUntil ? sanitizeIsoDate(data.validUntil, null) : null,
            competitor: data.competitor || "",
            lossReason: data.lossReason || "",
            notes: data.notes || "",
            createdBy: data.createdBy || "sistema@vellia.com",
            createdAt: data.createdAt ? sanitizeIsoDate(data.createdAt, new Date().toISOString()) : new Date().toISOString(),
            ...data
        };
        if (!newProposal.id) newProposal.id = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        if (!newProposal.workspace) newProposal.workspace = ws;
        if (!newProposal.createdAt) newProposal.createdAt = new Date().toISOString();
        newProposal._lastModified = Date.now();

        proposals.push(newProposal);
        MemoryCache.set("comercial_proposals", proposals);
        upsertSupabase("comercial_proposals", encodeProposalForSupabase(newProposal));

        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated", { detail: newProposal }));
        window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: newProposal.createdBy, action: "PROPOSAL_ADDED", points: 100 } }));
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new Event("storage"));

        return newProposal;
    },

    updateProposal(id, updates, userEmail = "sistema@vellia.com") {
        const proposals = this.getProposalsRaw();
        const index = proposals.findIndex(p => p.id === id);
        if (index !== -1) {
            proposals[index] = { ...proposals[index], ...updates, _lastModified: Date.now() };
            MemoryCache.set("comercial_proposals", proposals);
            upsertSupabase("comercial_proposals", encodeProposalForSupabase(proposals[index]));
            this.addLog(userEmail, "PROPOSAL_UPDATED", `Proposta ${proposals[index].title || proposals[index].budgetNumber || proposals[index].id} atualizada.`);

            window.dispatchEvent(new CustomEvent("vellia:proposalUpdated", { detail: proposals[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "PROPOSAL_UPDATED" } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
            window.dispatchEvent(new Event("storage"));

            return proposals[index];
        }
        return null;
    },

    deleteProposal(id, userEmail = "sistema@vellia.com") {
        const proposals = this.getProposalsRaw().filter(p => String(p.id) !== String(id));
        MemoryCache.set("comercial_proposals", proposals);
        deleteSupabase("comercial_proposals", `?id=eq.${encodeURIComponent(id)}`);
        this.addLog(userEmail, "PROPOSAL_DELETED", `Proposta ${id} excluída.`);
        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
    },

    saveProposals(proposals) {
        const listToSave = Array.isArray(proposals) ? proposals : this.getProposalsRaw();
        MemoryCache.set("comercial_proposals", listToSave);
        if (listToSave.length > 0) {
            const payloads = listToSave.map(p => encodeProposalForSupabase(p));
            upsertSupabase("comercial_proposals", payloads);
        }
    },

    async syncProposalsWithSupabase() {
        try {
            console.log("☁️ [Store.syncProposalsWithSupabase] Sincronizando propostas com o Supabase...");
            const res = await fetch(`${SUPABASE_URL}/rest/v1/comercial_proposals?select=*`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Falha ao buscar propostas na nuvem: ${res.statusText} (${errText})`);
            }

            const remoteProposals = await res.json();
            const localProposals = (this.getProposalsRaw() || []).filter(p => !isTestArtifactRecord(p));
            const localMap = new Map();
            localProposals.forEach(p => { if (p && p.id) localMap.set(p.id, p); });

            // Mapa autoritativo a partir da nuvem
            const propMap = new Map();
            remoteProposals.forEach(rawP => {
                if (!rawP || !rawP.id) return;
                if (isTestArtifactRecord(rawP)) {
                    deleteSupabase("comercial_proposals", `?id=eq.${encodeURIComponent(rawP.id)}`);
                    return;
                }
                const remoteP = decodeProposalFromSupabase(rawP);
                const localP = localMap.get(remoteP.id);
                if (localP && localP._lastModified && (Date.now() - localP._lastModified < 12000)) {
                    propMap.set(remoteP.id, { ...remoteP, ...localP });
                } else {
                    propMap.set(remoteP.id, remoteP);
                }
            });

            let uploadedCount = 0;
            localProposals.forEach(lp => {
                if (lp && lp.id && !propMap.has(lp.id) && !isTestArtifactRecord(lp)) {
                    const createdTs = lp._lastModified || (lp.createdAt ? new Date(lp.createdAt).getTime() : 0);
                    const ageMs = Date.now() - createdTs;
                    if (ageMs >= 0 && ageMs < 12000) {
                        propMap.set(lp.id, lp);
                        upsertSupabase("comercial_proposals", encodeProposalForSupabase(lp));
                        uploadedCount++;
                    }
                }
            });

            const merged = Array.from(propMap.values());
            MemoryCache.set("comercial_proposals", merged);
            window.dispatchEvent(new CustomEvent("vellia:proposalUpdated"));

            return {
                success: true,
                total: merged.length,
                syncedFromCloud: propMap.size,
                uploadedToCloud: uploadedCount
            };
        } catch (err) {
            console.error("❌ [Store.syncProposalsWithSupabase] Erro:", err);
            return {
                success: false,
                error: err.message
            };
        }
    },


    getLogs() {
        const logs = MemoryCache.get("comercial_logs", () => JSON.parse(localStorage.getItem("comercial_logs")) || []);
        // Ordenar do mais novo para o mais antigo
        return [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    addLog(userEmail, action, details, status = "SUCCESS") {
        const logs = [...this.getLogs()];
        const newLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            userEmail,
            action,
            details,
            status
        };
        logs.unshift(newLog);
        MemoryCache.set("comercial_logs", logs);
        upsertSupabase("comercial_logs", newLog);
        try {
            window.dispatchEvent(new CustomEvent("vellia:logAdded", { detail: newLog }));
            window.dispatchEvent(new CustomEvent("vellia:logsUpdated", { detail: logs }));
        } catch (evErr) { }
        return newLog;
    },

    clearLogs() {
        MemoryCache.set("comercial_logs", []);
        deleteSupabase("comercial_logs");
        this.addLog("sistema@vellia.com", "LOGS_CLEARED", "Os logs de auditoria foram limpos.", "WARN");
    },

    // CATÁLOGO DE SERVIÇOS (ETAPA 7)
    getServices() {
        return MemoryCache.get("comercial_services", () => JSON.parse(localStorage.getItem("comercial_services")) || []);
    },

    getServiceById(id) {
        return this.getServices().find(s => s.id === id);
    },

    addService(data) {
        const services = [...this.getServices()];
        const newService = {
            id: `srv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: data.name,
            category: data.category || "Geral",
            baseMargin: parseFloat(data.baseMargin) || 50,
            isActive: true
        };
        services.push(newService);
        MemoryCache.set("comercial_services", services);
        upsertSupabase("comercial_services", newService);
        return newService;
    },

    updateService(id, data) {
        const services = [...this.getServices()];
        const idx = services.findIndex(s => s.id === id);
        if (idx !== -1) {
            services[idx] = { ...services[idx], ...data };
            MemoryCache.set("comercial_services", services);
            upsertSupabase("comercial_services", services[idx]);
            return true;
        }
        return false;
    },


    // ==========================================
    // METAS (GOALS)
    // ==========================================
    getGoals() {
        return MemoryCache.get("comercial_goals", () => JSON.parse(localStorage.getItem("comercial_goals")) || []);
    },

    saveGoals(goalsData) {
        MemoryCache.set("comercial_goals", goalsData);
        upsertSupabase("comercial_goals", goalsData);
    },

    getGoalByUserAndPeriod(email, period) {
        return this.getGoals().find(g => g.userEmail === email && g.period === period);
    },

    setGoal(email, period, targets) {
        let goals = [...this.getGoals()];
        let idx = goals.findIndex(g => g.userEmail === email && g.period === period);
        if (idx !== -1) {
            goals[idx].targets = { ...goals[idx].targets, ...targets };
        } else {
            goals.push({ userEmail: email, period, targets });
        }
        this.saveGoals(goals);
    },

    // ==========================================
    // COMENTÁRIOS INTERNOS POR LEAD
    // ==========================================
    addLeadComment(leadId, userEmail, text) {
        const leads = this.getAllLeadsRaw();
        const index = leads.findIndex(l => l.id === leadId);
        if (index === -1) return null;
        const comments = leads[index].comments || [];
        const newComment = {
            id: `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            userEmail,
            text,
            timestamp: new Date().toISOString(),
            readBy: [userEmail]  // Author has already "read" it
        };
        comments.push(newComment);
        leads[index].comments = comments;
        MemoryCache.set("comercial_leads", leads);
        upsertSupabase("comercial_leads", leads[index]);
        return newComment;
    },

    // ==========================================
    // TAREFAS DOS VENDEDORES (TASKS)
    // ==========================================
    getTasks(email) {
        if (!email) {
            let tasks = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith("seller_tasks_") && !k.startsWith("seller_tasks_old_")) {
                    try {
                        const parsed = MemoryCache.get(k, () => JSON.parse(localStorage.getItem(k)));
                        if (Array.isArray(parsed)) tasks.push(...parsed);
                    } catch (e) { }
                }
            }
            return tasks;
        }
        const key = `seller_tasks_${email}`;
        return MemoryCache.get(key, () => JSON.parse(localStorage.getItem(key) || "[]"));
    },

    async saveTasks(email, tasks) {
        if (Array.isArray(email) && tasks === undefined) {
            tasks = email;
            try {
                const session = JSON.parse(sessionStorage.getItem("comercial_session") || localStorage.getItem("comercial_session") || "null");
                email = session?.email || "gestao@vellia.com";
            } catch (e) {
                email = "gestao@vellia.com";
            }
        }
        if (!email) return;
        const key = `seller_tasks_${email}`;
        MemoryCache.set(key, tasks);

        // Sincronizar com Supabase utilizando comparação de listas (diff sync)
        try {
            const remoteTasks = await supabaseFetch(`comercial_tasks?owner=eq.${email}`) || [];

            // 1. Identificar tarefas a deletar (existem no remoto mas não localmente)
            const localIds = tasks.map(t => t.id).filter(Boolean);
            const toDelete = remoteTasks.filter(rt => rt.id && !localIds.includes(rt.id));
            for (const rt of toDelete) {
                await deleteSupabase("comercial_tasks", `?id=eq.${rt.id}`);
            }

            // 2. Inserir ou atualizar tarefas locais
            for (let i = 0; i < tasks.length; i++) {
                const t = tasks[i];
                if (!t.id) {
                    t.id = `task_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`;
                }

                // Verificar se houve alteração em relação ao banco remoto
                const remoteMatch = remoteTasks.find(rt => rt.id === t.id);
                if (remoteMatch) {
                    const doneMatch = remoteMatch.done === t.done || (remoteMatch.done === "true" && t.done) || (remoteMatch.done === "false" && !t.done);
                    if (remoteMatch.text === t.text && doneMatch && remoteMatch.priority === t.priority) {
                        continue; // Nenhuma modificação, pula o POST de upsert
                    }
                }

                const dbTask = {
                    id: t.id,
                    owner: email,
                    text: t.text,
                    done: t.done === true || t.done === "true" || t.done === 1 || t.done === "1",
                    date: t.date,
                    priority: t.priority || "normal",
                    assignedBy: t.assignedBy || "sistema@vellia.com"
                };
                await upsertSupabase("comercial_tasks", dbTask);
            }

            // Atualizar cache e localStorage com os IDs possivelmente gerados
            MemoryCache.set(key, tasks);

            // Disparar evento local de que as tarefas foram alteradas para fazer o broadcast via WebSocket
            window.dispatchEvent(new CustomEvent("vellia:localTasksMutated", {
                detail: { owner: email }
            }));
        } catch (e) {
            console.warn("Erro ao sincronizar tarefas no Supabase:", e);
        }
    },

    async syncTasksForUser(email) {
        try {
            const key = `seller_tasks_${email}`;
            const remoteTasks = await supabaseFetch(`comercial_tasks?owner=eq.${email}`) || [];
            const formattedTasks = remoteTasks.map(t => ({
                id: t.id,
                text: t.text,
                done: t.done === true || t.done === "true" || t.done === 1 || t.done === "1",
                date: t.date,
                priority: t.priority || "normal",
                assignedBy: t.assignedBy
            }));
            MemoryCache.set(key, formattedTasks);

            // Obter o usuário logado atualmente para decidir se notifica de novas tarefas
            let currentUser = null;
            try {
                currentUser = JSON.parse(sessionStorage.getItem("comercial_session") || localStorage.getItem("comercial_session") || "null");
            } catch (e) { }

            // Notificar se novas tarefas foram atribuídas por outra pessoa
            if (currentUser && email.toLowerCase() === currentUser.email.toLowerCase()) {
                const oldTasks = JSON.parse(localStorage.getItem(`seller_tasks_old_${email}`) || "[]");
                const newAssignedTasks = formattedTasks.filter(t =>
                    t.assignedBy &&
                    t.assignedBy.toLowerCase() !== currentUser.email.toLowerCase() &&
                    !oldTasks.some(old => old.id === t.id)
                );

                newAssignedTasks.forEach(t => {
                    window.dispatchEvent(new CustomEvent("vellia:aiNotification", {
                        detail: {
                            id: `task_assigned_${t.id || Date.now()}`,
                            title: `📋 Nova Tarefa Atribuída!`,
                            message: `O gestor atribuiu a você a tarefa: "${t.text}" (Prioridade: ${t.priority || "normal"})`,
                            type: t.priority === "high" ? "danger" : "info"
                        }
                    }));
                });
                localStorage.setItem(`seller_tasks_old_${email}`, JSON.stringify(formattedTasks));
            }

            window.dispatchEvent(new CustomEvent("vellia:tasksChanged", {
                detail: { owner: email, type: "SYNC", tasks: formattedTasks }
            }));
            window.dispatchEvent(new Event("storage"));
            return formattedTasks;
        } catch (e) {
            console.warn(`Erro ao sincronizar tarefas de ${email}:`, e);
        }
    },

    async syncFromSupabase() {
        return await syncFromSupabase();
    },

    // =========================================================================
    // MÉTODOS DE HISTÓRICO ANUAL & COMPARATIVO MENSAL
    // =========================================================================

    getMonthlyMetrics(year, month) {
        const mStr = String(month).padStart(2, "0");
        const yStr = String(year);
        const periodKey = `${yStr}-${mStr}`;

        const leads = this.getAllLeadsRaw();
        const proposals = this.getProposalsRaw();
        const users = this.getUsers();
        const logs = this.getLogs();
        const guruHistory = MemoryCache.get("guru_strategy_history", () => JSON.parse(localStorage.getItem("guru_strategy_history") || "[]"));

        // 1. Leads criados e qualificados no mês
        const monthLeads = leads.filter(l => {
            if (!l.createdAt) return false;
            return l.createdAt.startsWith(periodKey);
        });

        const leadsCreated = monthLeads.length;
        const leadsQualified = monthLeads.filter(l => !["Contato", "Cliente Perdido"].includes(l.stage)).length;

        // 2. Propostas e Faturamento
        const monthProposals = proposals.filter(p => {
            if (!p.createdAt) return false;
            return p.createdAt.startsWith(periodKey);
        });

        const proposalsCount = monthProposals.length;
        const wonProposals = monthProposals.filter(p => ["Ganho", "Aguardando Agendamento", "Agendada"].includes(p.status));
        const wonCount = wonProposals.length;
        const revenue = wonProposals.reduce((sum, p) => sum + (Number(p.value) || 0), 0);

        // 3. Taxa de conversão
        const conversionRate = proposalsCount > 0 ? Math.round((wonCount / proposalsCount) * 100) : 0;

        // 4. Tarefas concluídas no mês
        let completedTasks = 0;
        let totalTasks = 0;
        users.forEach(u => {
            const userTasks = this.getTasks(u.email);
            userTasks.forEach(t => {
                if (t.date && t.date.includes(`/${mStr}/${yStr}`)) {
                    totalTasks++;
                    if (t.done) completedTasks++;
                }
            });
        });

        // 5. Estratégias do Guru executadas no mês
        const monthStrategies = guruHistory.filter(h => {
            if (!h.date) return false;
            return h.date.includes(`/${mStr}/${yStr}`) || h.date.startsWith(periodKey);
        }).length;

        // 6. Logs de atividades do mês
        const monthLogs = logs.filter(l => {
            if (!l.timestamp) return false;
            return l.timestamp.startsWith(periodKey);
        }).length;

        return {
            period: periodKey,
            year: yStr,
            month: mStr,
            revenue,
            wonCount,
            proposalsCount,
            leadsCreated,
            leadsQualified,
            completedTasks,
            totalTasks,
            strategiesCount: monthStrategies,
            conversionRate,
            logsCount: monthLogs
        };
    },

    getAnnualOverview(year = new Date().getFullYear()) {
        const months = [];
        for (let m = 1; m <= 12; m++) {
            months.push(this.getMonthlyMetrics(year, m));
        }
        return {
            year,
            months,
            totalRevenue: months.reduce((s, m) => s + m.revenue, 0),
            totalWon: months.reduce((s, m) => s + m.wonCount, 0),
            totalLeads: months.reduce((s, m) => s + m.leadsCreated, 0),
            totalTasks: months.reduce((s, m) => s + m.completedTasks, 0),
            totalStrategies: months.reduce((s, m) => s + m.strategiesCount, 0)
        };
    },

    compareMonths(yearA, monthA, yearB, monthB) {
        const mA = this.getMonthlyMetrics(yearA, monthA);
        const mB = this.getMonthlyMetrics(yearB, monthB);

        const calcDiff = (vA, vB) => {
            if (vB === 0) return vA > 0 ? 100 : 0;
            return Math.round(((vA - vB) / vB) * 100);
        };

        return {
            monthA: mA,
            monthB: mB,
            diff: {
                revenuePct: calcDiff(mA.revenue, mB.revenue),
                revenueAbs: mA.revenue - mB.revenue,
                wonPct: calcDiff(mA.wonCount, mB.wonCount),
                leadsPct: calcDiff(mA.leadsQualified, mB.leadsQualified),
                tasksPct: calcDiff(mA.completedTasks, mB.completedTasks),
                strategiesPct: calcDiff(mA.strategiesCount, mB.strategiesCount),
                conversionDiff: mA.conversionRate - mB.conversionRate
            }
        };
    },

    // CALENDÁRIO
    getCalendarEvents() {
        return MemoryCache.get("vellia_calendar_events", () => JSON.parse(localStorage.getItem("vellia_calendar_events")) || []);
    },
    saveCalendarEvents(events) {
        MemoryCache.set("vellia_calendar_events", events);
        try { localStorage.setItem("vellia_calendar_events", JSON.stringify(events)); } catch (e) { }
        upsertSupabase("comercial_calendar_events", events);
        try { window.dispatchEvent(new CustomEvent("vellia:calendarEventsUpdated", { detail: events })); } catch (e) { }
    },

    // Métodos utilitários para resetar banco se necessário
    resetAll() {
        MemoryCache.invalidate();
        localStorage.removeItem("comercial_users");
        localStorage.removeItem("comercial_logs");
        localStorage.removeItem("comercial_leads");
        localStorage.removeItem("comercial_proposals");
        localStorage.removeItem("comercial_goals");
        localStorage.removeItem("comercial_services");
        initStorage();
        window.location.reload();
    },

    // Expor o MemoryCache para componentes que precisem invalidar ou consultar diretamente
    cache: MemoryCache,

    // Expor upsert para módulos externos salvarem diretamente em tabelas customizadas
    upsert(table, data) {
        return upsertSupabase(table, data);
    },

    // Sincronização explícita com o Supabase
    syncFromSupabase() {
        return syncFromSupabase();
    },

    async syncToSupabase() {
        try {
            console.log("☁️ [Store.syncToSupabase] Iniciando upload forçado de dados para o Supabase...");
            const users = this.getUsers();
            if (users.length > 0) await upsertSupabase("comercial_users", users);

            const leads = this.getAllLeadsRaw();
            for (const l of leads) {
                await upsertSupabase("comercial_leads", encodeLeadForSupabase(l));
            }

            const proposals = this.getProposalsRaw();
            for (const p of proposals) {
                await upsertSupabase("comercial_proposals", encodeProposalForSupabase(p));
            }

            const tasks = JSON.parse(localStorage.getItem("comercial_tasks")) || [];
            if (tasks.length > 0) await upsertSupabase("comercial_tasks", tasks);

            console.log("☁️ [Store.syncToSupabase] Todos os dados foram sincronizados com sucesso no Supabase!");
            return { success: true };
        } catch (e) {
            console.error("❌ [Store.syncToSupabase] Erro ao sincronizar:", e);
            return { success: false, error: e.message };
        }
    },

    decodeLead(l) {
        return decodeLeadFromSupabase(l);
    },

    encodeLead(l) {
        return encodeLeadForSupabase(l);
    },

    decodeProposal(p) {
        return decodeProposalFromSupabase(p);
    },

    encodeProposal(p) {
        return encodeProposalForSupabase(p);
    },

    getLeadTimestamp(l) {
        return getLeadTimestamp(l);
    },

    isTestArtifactRecord(item) {
        return isTestArtifactRecord(item);
    }
};

if (typeof window !== "undefined") {
    window.Store = Store;
}

