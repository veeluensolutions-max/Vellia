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
    const url = `${SUPABASE_URL}/rest/v1/${table}${separator}select=*`;
    const response = await fetch(url, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        }
    });
    if (!response.ok) throw new Error(`Supabase query failed: ${response.statusText}`);
    return await response.json();
}

const TABLE_SCHEMAS = {
    comercial_users: ['id', 'name', 'email', 'password', 'role', 'avatar', 'status', 'companyAccess', 'lastLoginAt'],
    comercial_leads: ['id', 'workspace', 'company', 'contact', 'role', 'phone', 'whatsapp', 'email', 'city', 'state', 'segment', 'source', 'stage', 'owner', 'interactions', 'stageHistory', 'phone2', 'email2', 'notes'],
    comercial_proposals: ['id', 'workspace', 'leadId', 'company', 'contact', 'title', 'value', 'status', 'sentAt', 'closedAt', 'validUntil', 'competitor', 'lossReason', 'notes', 'createdBy'],
    comercial_logs: ['id', 'timestamp', 'userEmail', 'action', 'details', 'status'],
    comercial_services: ['id', 'name', 'category', 'baseMargin', 'isActive'],
    comercial_goals: ['userEmail', 'period', 'targets'],
    comercial_tasks: ['id', 'workspace', 'owner', 'text', 'done', 'date', 'priority', 'assignedBy'],
    comercial_calendar_events: ['id', 'workspace', 'title', 'company', 'date', 'time', 'type', 'status', 'notes', 'phone', 'contact', 'leadId'],
    comercial_contracts: ['id', 'workspace', 'leadId', 'proposalId', 'number', 'status', 'totalValue', 'recurringValue', 'periodicity', 'startDate', 'endDate', 'autoRenew', 'warningDays', 'owner', 'createdBy', 'notes', 'createdAt', 'updatedAt'],
    comercial_contract_services: ['contractId', 'serviceId', 'quantity', 'unitValue']
};

async function upsertSupabase(table, data) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    try {
        let payload = data;
        if (TABLE_SCHEMAS[table]) {
            if (Array.isArray(data)) {
                payload = data.map(item => {
                    const filtered = {};
                    for (const key of TABLE_SCHEMAS[table]) {
                        if (item.hasOwnProperty(key)) {
                            filtered[key] = item[key];
                        }
                    }
                    return filtered;
                });
            } else {
                payload = {};
                for (const key of TABLE_SCHEMAS[table]) {
                    if (data.hasOwnProperty(key)) {
                        payload[key] = data[key];
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

// Sincronização em background no início da aplicação
async function syncFromSupabase() {
    try {
        const remoteUsers = await supabaseFetch("comercial_users") || [];
        const localUsers = JSON.parse(localStorage.getItem("comercial_users")) || DEFAULT_USERS;
        
        // 1. Criar um mapa combinando os usuários remotos e locais, dando prioridade para as informações do banco remoto,
        // mas garantindo que novos cadastros locais ou usuários padrão do script existam.
        const userMap = new Map();
        
        // Adiciona locais primeiro
        localUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));
        // Remotos sobrescrevem (sincronização do banco para o local)
        remoteUsers.forEach(u => userMap.set(u.email.toLowerCase(), u));
        
        const mergedUsers = Array.from(userMap.values());
        localStorage.setItem("comercial_users", JSON.stringify(mergedUsers));
        
        // 2. Se houver usuários locais que não existem no Supabase, subir para garantir acesso em outros dispositivos
        const missingOnRemote = mergedUsers.filter(mu => 
            !remoteUsers.some(ru => ru.email.toLowerCase() === mu.email.toLowerCase())
        );
        
        if (missingOnRemote.length > 0) {
            // Upsert individual de cada usuário em falta
            for (const user of missingOnRemote) {
                await upsertSupabase("comercial_users", user);
            }
        }
    } catch (e) { console.log("Users sync fallback:", e.message); }

    try {
        const remoteGoals = await supabaseFetch("comercial_goals") || [];
        localStorage.setItem("comercial_goals", JSON.stringify(remoteGoals));
    } catch (e) { console.log("Goals sync fallback:", e.message); }

    try {
        const remoteEvents = await supabaseFetch("comercial_calendar_events") || [];
        // Merge calendar events using ID
        const localEvents = JSON.parse(localStorage.getItem("vellia_calendar_events")) || [];
        const eventMap = new Map();
        localEvents.forEach(e => eventMap.set(e.id, e));
        remoteEvents.forEach(e => eventMap.set(e.id, e));
        localStorage.setItem("vellia_calendar_events", JSON.stringify(Array.from(eventMap.values())));
    } catch (e) { console.log("Calendar events sync fallback:", e.message); }

    try {
        const leads = await supabaseFetch("comercial_leads");
        if (Array.isArray(leads)) localStorage.setItem("comercial_leads", JSON.stringify(leads));
    } catch (e) { console.log("Leads sync fallback:", e.message); }

    try {
        const proposals = await supabaseFetch("comercial_proposals");
        if (Array.isArray(proposals)) localStorage.setItem("comercial_proposals", JSON.stringify(proposals));
    } catch (e) { console.log("Proposals sync fallback:", e.message); }

    try {
        const logs = await supabaseFetch("comercial_logs");
        if (Array.isArray(logs)) {
            const sortedLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            localStorage.setItem("comercial_logs", JSON.stringify(sortedLogs));
        }
    } catch (e) { console.log("Logs sync fallback:", e.message); }

    try {
        const remoteServices = await supabaseFetch("comercial_services") || [];
        const localServices = JSON.parse(localStorage.getItem("comercial_services")) || INITIAL_SERVICES;
        
        let mergedServices = [...remoteServices];
        let needsUpsert = false;
        
        localServices.forEach(localS => {
            const exists = mergedServices.some(s => s.id === localS.id);
            if (!exists) {
                mergedServices.push(localS);
                needsUpsert = true;
            }
        });
        
        localStorage.setItem("comercial_services", JSON.stringify(mergedServices));
        if (needsUpsert) {
            upsertSupabase("comercial_services", mergedServices);
        }
    } catch (e) { console.log("Services sync fallback:", e.message); }

    // Sincronizar Tarefas dos Vendedores
    try {
        const users = JSON.parse(localStorage.getItem("comercial_users")) || [];
        const sellers = users.filter(u => u.role === "seller" || u.role === "manager");
        for (const s of sellers) {
            const key = `seller_tasks_${s.email}`;
            const remoteTasks = await supabaseFetch(`comercial_tasks?owner=eq.${s.email}`) || [];
            // Mapeia de volta para o formato de array simples esperado pelo frontend
            const formattedTasks = remoteTasks.map(t => ({
                id: t.id,
                text: t.text,
                done: t.done === true || t.done === "true" || t.done === 1 || t.done === "1",
                date: t.date,
                priority: t.priority || "normal",
                assignedBy: t.assignedBy
            }));
            localStorage.setItem(key, JSON.stringify(formattedTasks));
        }
    } catch (e) { console.log("Tasks sync fallback:", e.message); }

    // Disparar evento global para atualizar a UI do app após puxar dados do Supabase
    window.dispatchEvent(new CustomEvent("vellia:waSent"));
    window.dispatchEvent(new Event("storage"));
}

// Inicialização segura do localStorage
function initStorage() {
    let existingUsers = [];
    try {
        existingUsers = JSON.parse(localStorage.getItem("comercial_users")) || [];
    } catch(e) {}
    
    // Forçar injeção dos DEFAULT_USERS se eles não existirem na store
    let usersChanged = false;
    DEFAULT_USERS.forEach(defUser => {
        if (!existingUsers.some(u => u.email.toLowerCase() === defUser.email.toLowerCase())) {
            existingUsers.push(defUser);
            usersChanged = true;
        }
    });

    if (usersChanged || existingUsers.length === 0) {
        localStorage.setItem("comercial_users", JSON.stringify(existingUsers.length > 0 ? existingUsers : DEFAULT_USERS));
    }
    if (!localStorage.getItem("comercial_logs")) {
        localStorage.setItem("comercial_logs", JSON.stringify(INITIAL_LOGS));
    }
    if (!localStorage.getItem("comercial_leads")) {
        localStorage.setItem("comercial_leads", JSON.stringify([]));
    }
    if (!localStorage.getItem("comercial_proposals")) {
        localStorage.setItem("comercial_proposals", JSON.stringify([]));
    }
    if (!localStorage.getItem("comercial_goals")) {
        localStorage.setItem("comercial_goals", JSON.stringify([]));
    }
    if (!localStorage.getItem("comercial_services") || localStorage.getItem("comercial_services") === "[]") {
        localStorage.setItem("comercial_services", JSON.stringify(INITIAL_SERVICES));
    }
    if (!localStorage.getItem("vellia_calendar_events")) {
        localStorage.setItem("vellia_calendar_events", JSON.stringify([]));
    }
}

// Polling de fallback (60s) — o Supabase Realtime (WebSocket) é o mecanismo primário.
// Este polling entra em ação caso o WebSocket caia ou não consiga conectar.
function startSyncPolling() {
    setInterval(async () => {
        if (document.hidden) return;
        try {
            const remoteLeads = await supabaseFetch("comercial_leads") || [];
            const localLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
            
            // Identificar novos leads que estão no Supabase mas não localmente
            const newLeads = remoteLeads.filter(rl => !localLeads.some(ll => ll.id === rl.id));
            
            if (newLeads.length > 0 || JSON.stringify(remoteLeads) !== JSON.stringify(localLeads)) {
                console.log("🔄 [Fallback Polling] Detectou novos leads ou atualizações no Supabase. Sincronizando...");
                localStorage.setItem("comercial_leads", JSON.stringify(remoteLeads));
                
                // Também sincronizar os logs de auditoria
                const remoteLogs = await supabaseFetch("comercial_logs") || [];
                localStorage.setItem("comercial_logs", JSON.stringify(remoteLogs));
                
                // Disparar eventos para novos leads
                newLeads.forEach(newLead => {
                    console.log(`📡 [Fallback Polling] Disparando vellia:leadAdded para ${newLead.company}`);
                    window.dispatchEvent(new CustomEvent("vellia:leadAdded", { detail: newLead }));
                    
                    // Se for do Meta Ads e SDR automático ativo, iniciar triagem
                    const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
                    if (newLead.source === "Meta Ads" && waConfig.sdrActive !== false) {
                        setTimeout(() => {
                            import('./sdr.js').then(m => m.SDR.runTriage(newLead.id));
                        }, 1500);
                    }
                });
                
                // Forçar atualização do CRM/Kanban/Dashboard
                window.dispatchEvent(new CustomEvent("vellia:waSent"));
                window.dispatchEvent(new Event("storage"));
            }
        } catch (e) {
            console.log("Erro no polling de fallback do Supabase:", e.message);
        }
    }, 60000); // 60s — Realtime WebSocket é primário
}

// Inicializar local storage e sincronizar
initStorage();
syncFromSupabase();
startSyncPolling();

export const Store = {
    // TAREFAS
    getTasks(email) {
        let tasks = JSON.parse(localStorage.getItem("comercial_tasks")) || [];
        return tasks.filter(t => t.owner === email);
    },
    saveTasks(tasks) {
        localStorage.setItem("comercial_tasks", JSON.stringify(tasks));
        upsertSupabase("comercial_tasks", tasks);
    },

    // CALENDÁRIO
    getCalendarEvents() {
        return JSON.parse(localStorage.getItem("vellia_calendar_events")) || [];
    },
    saveCalendarEvents(events) {
        localStorage.setItem("vellia_calendar_events", JSON.stringify(events));
        upsertSupabase("comercial_calendar_events", events);
    },

    // USUÁRIOS
    getUsers() {
        return JSON.parse(localStorage.getItem("comercial_users")) || [];
    },

    saveUsers(users) {
        localStorage.setItem("comercial_users", JSON.stringify(users));
        upsertSupabase("comercial_users", users);
    },

    deleteUser(userId) {
        const users = this.getUsers().filter(u => u.id !== userId);
        localStorage.setItem("comercial_users", JSON.stringify(users));
        // Deletar no Supabase pelo id
        deleteSupabase("comercial_users", `?id=eq.${userId}`);
    },

    getUserByEmail(email) {
        if (!email || typeof email !== "string") return null;
        return this.getUsers().find(u => u && u.email && typeof u.email === "string" && u.email.toLowerCase() === email.toLowerCase());
    },

    // LEADS (CRM)
    getLeads() {
        // Retorna apenas leads ativos (sem deleted_at), excluindo itens da lixeira
        const allLeads = JSON.parse(localStorage.getItem("comercial_leads")) || [];
        const users = JSON.parse(localStorage.getItem("comercial_users")) || [];
        
        let needsSave = false;
        
        allLeads.forEach(l => {
            if (l.stage === "Contato" && !l.deleted_at) {
                const ownerUser = users.find(u => u.email === l.owner);
                if (ownerUser && (ownerUser.role === "seller" || ownerUser.role === "manager")) {
                    l.stage = "Lead Gerado";
                    if (!l.stageHistory) l.stageHistory = [];
                    l.stageHistory.push({
                        stage: "Lead Gerado",
                        userEmail: "sistema@vellia.com",
                        timestamp: new Date().toISOString(),
                        reason: "Migração automática: Leads de vendedores atualizados para Lead Gerado."
                    });
                    needsSave = true;
                }
            }
        });
        
        if (needsSave) {
            localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        }

        const activeCompany = localStorage.getItem("activeCompany") || "Veeluen Solutions";
        return allLeads.filter(l => {
            if(l.deleted_at) return false;
            const w = l.workspace || "Veeluen Solutions";
            return w === activeCompany;
        });
    },

    getAllLeadsRaw() {
        // Retorna TODOS os leads incluindo os que estão na lixeira
        return JSON.parse(localStorage.getItem("comercial_leads")) || [];
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
        
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        if (Array.isArray(workspaceLeads)) {
            for (const lead of workspaceLeads) {
                upsertSupabase("comercial_leads", lead);
            }
        }
    },

    getLogs() {
        return JSON.parse(localStorage.getItem("comercial_logs")) || [];
    },

    saveLogs(logs) {
        localStorage.setItem("comercial_logs", JSON.stringify(logs));
        if (Array.isArray(logs) && logs.length > 0) {
            upsertSupabase("comercial_logs", logs[0]);
        }
    },

    getLeadById(id) {
        // Busca em TODOS os leads (ativos + lixeira) para operações de restauração
        return this.getAllLeadsRaw().find(l => l.id === id);
    },

    moveToTrash(leadId, userEmail = "sistema@vellia.com") {
        // Move o lead para a lixeira sem excluir permanentemente
        const allLeads = this.getAllLeadsRaw();
        const index = allLeads.findIndex(l => l.id === leadId);
        if (index === -1) return false;
        allLeads[index].deleted_at = new Date().toISOString();
        allLeads[index].deleted_by = userEmail;
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        upsertSupabase("comercial_leads", allLeads[index]);
        return true;
    },

    restoreLead(leadId, userEmail = "sistema@vellia.com") {
        // Remove os campos de lixeira restaurando o lead ao CRM ativo
        const allLeads = this.getAllLeadsRaw();
        const index = allLeads.findIndex(l => l.id === leadId);
        if (index === -1) return false;
        delete allLeads[index].deleted_at;
        delete allLeads[index].deleted_by;
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        upsertSupabase("comercial_leads", allLeads[index]);
        this.addLog(userEmail, "LEAD_RESTORED", `Lead "${allLeads[index].company}" restaurado da lixeira por ${userEmail}.`, "SUCCESS");
        return allLeads[index];
    },

    purgeLeads(leadIds, userEmail = "sistema@vellia.com") {
        // Exclui definitivamente os leads do banco (uso exclusivo de admins/gerentes)
        const allLeads = this.getAllLeadsRaw().filter(l => !leadIds.includes(l.id));
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        for (const id of leadIds) {
            deleteSupabase("comercial_leads", `?id=eq.${id}`);
        }
        this.addLog(userEmail, "LEAD_PURGED", `${leadIds.length} lead(s) excluído(s) definitivamente da lixeira por ${userEmail}.`, "SUCCESS");
    },

    deleteLead(leadId) {
        // Mantido para compatibilidade retroativa - agora chama purgeLeads
        const allLeads = this.getAllLeadsRaw().filter(l => l.id !== leadId);
        localStorage.setItem("comercial_leads", JSON.stringify(allLeads));
        deleteSupabase("comercial_leads", `?id=eq.${leadId}`);
    },

    addLead(lead, userEmail = "sistema@vellia.com") {
        const leads = this.getAllLeadsRaw();
        const nowIso = new Date().toISOString();
        const newLead = {
            id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            workspace: localStorage.getItem('activeCompany') || 'Veeluen Solutions',
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
        leads.push(newLead);
        localStorage.setItem("comercial_leads", JSON.stringify(leads));
        upsertSupabase("comercial_leads", newLead);

        // Notificar agentes de IA e rankings sobre o novo lead gerado
        window.dispatchEvent(new CustomEvent("vellia:leadAdded", { detail: newLead }));
        window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: newLead.createdBy || newLead.owner, action: "LEAD_ADDED", points: 50 } }));
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new Event("storage"));

        return newLead;
    },


    updateLead(leadId, updatedData, userEmail = "sistema@vellia.com") {
        const leads = this.getAllLeadsRaw();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            leads[index] = { ...leads[index], ...updatedData };
            localStorage.setItem("comercial_leads", JSON.stringify(leads));
            upsertSupabase("comercial_leads", leads[index]);
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
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            const newInteraction = {
                id: `int_${Date.now()}`,
                type: interaction?.type || "WhatsApp", // Ligação, WhatsApp, Reunião, etc.
                description: interaction?.description || "",
                timestamp: new Date().toISOString(),
                userEmail
            };
            leads[index].interactions = leads[index].interactions || [];
            leads[index].interactions.push(newInteraction);
            localStorage.setItem("comercial_leads", JSON.stringify(leads));
            upsertSupabase("comercial_leads", leads[index]);
            window.dispatchEvent(new CustomEvent("vellia:leadUpdated", { detail: leads[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "INTERACTION_ADDED", points: 10 } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
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
            
            // Gravar histórico de etapas
            leads[index].stageHistory = leads[index].stageHistory || [];
            leads[index].stageHistory.push({
                stage: newStage,
                userEmail,
                timestamp: new Date().toISOString(),
                reason: reason || `Transição manual de etapa.`
            });

            // Disparar Meta Conversions API (CAPI) para estágios estratégicos
            const metaConfig = JSON.parse(localStorage.getItem("comercial_meta_config")) || {};
            const relevantStages = ["Lead Qualificado", "Proposta Enviada", "Negociação", "Cliente Fechado"];
            
            if (relevantStages.includes(newStage)) {
                fetch('/api/meta-capi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lead: leads[index],
                        pixelId: metaConfig.pixelId,
                        accessToken: metaConfig.accessToken
                    })
                }).then(res => res.json()).then(data => {
                    if (data && data.success) {
                        const targetLead = this.getLeadById(leadId);
                        if (targetLead) {
                            targetLead.interactions = targetLead.interactions || [];
                            targetLead.interactions.push({
                                id: 'capi_notif_' + Date.now(),
                                type: "Observação",
                                description: `📊 **Meta Conversions API (CAPI):** Evento \`${data.eventName}\` enviado com sucesso para a Meta (${data.mode || 'Sandbox'}).`,
                                timestamp: new Date().toISOString(),
                                userEmail: "sistema@vellia.com"
                            });
                            const currentLeads = this.getLeads();
                            const idx = currentLeads.findIndex(l => l.id === leadId);
                            if (idx !== -1) {
                                currentLeads[idx] = targetLead;
                                localStorage.setItem("comercial_leads", JSON.stringify(currentLeads));
                            }
                        }
                    }
                }).catch(err => console.warn("Erro ao disparar Meta CAPI:", err));
            }

            localStorage.setItem("comercial_leads", JSON.stringify(leads));
            upsertSupabase("comercial_leads", leads[index]);
            window.dispatchEvent(new CustomEvent("vellia:leadUpdated", { detail: leads[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "STAGE_CHANGED", oldStage, newStage, points: 30 } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
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
        return JSON.parse(localStorage.getItem("comercial_contracts")) || [];
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
            number: data.number || `CT-${new Date().getFullYear()}-${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
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
        localStorage.setItem("comercial_contracts", JSON.stringify(contracts));
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
            localStorage.setItem("comercial_contract_services", JSON.stringify(cServices));
        }
        
        this.addLog(data.createdBy, "CONTRACT_CREATED", `Contrato ${newContract.number} criado.`);
        return newContract;
    },

    updateContract(id, updates, userEmail = "sistema@vellia.com") {
        const contracts = this.getContracts();
        const index = contracts.findIndex(c => c.id === id);
        if (index !== -1) {
            contracts[index] = { ...contracts[index], ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem("comercial_contracts", JSON.stringify(contracts));
            upsertSupabase("comercial_contracts", contracts[index]);
            this.addLog(userEmail, "CONTRACT_UPDATED", `Contrato ${contracts[index].number} atualizado.`);
            return contracts[index];
        }
        return null;
    },
    
    getContractServices() {
        return JSON.parse(localStorage.getItem("comercial_contract_services")) || [];
    },
    
    getServicesForContract(contractId) {
        return this.getContractServices().filter(cs => cs.contractId === contractId);
    },

    // PROPOSTAS
    getProposals() {
        return JSON.parse(localStorage.getItem("comercial_proposals")) || [];
    },

    getProposalsRaw() {
        return JSON.parse(localStorage.getItem("comercial_proposals")) || [];
    },

    getProposalById(id) {
        return this.getProposals().find(p => p.id === id) || null;
    },

    addProposal(data) {
        const proposals = this.getProposalsRaw();
        const newProposal = {
            id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            workspace: localStorage.getItem('activeCompany') || 'Veeluen Solutions',
            leadId: data.leadId || "",
            company: data.company || "",
            contact: data.contact || "",
            title: data.title || "",
            value: parseFloat(data.value) || 0,
            status: data.status || "Enviada",
            sentAt: data.sentAt || new Date().toISOString(),
            closedAt: data.closedAt || null,
            validUntil: data.validUntil || null,
            competitor: data.competitor || "",
            lossReason: data.lossReason || "",
            notes: data.notes || "",
            createdBy: data.createdBy || "sistema@vellia.com",
            createdAt: new Date().toISOString()
        };
        proposals.push(newProposal);
        localStorage.setItem("comercial_proposals", JSON.stringify(proposals));
        upsertSupabase("comercial_proposals", newProposal);
        
        window.dispatchEvent(new CustomEvent("vellia:proposalUpdated", { detail: newProposal }));
        window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: newProposal.createdBy, action: "PROPOSAL_ADDED", points: 100 } }));
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        
        return newProposal;
    },

    updateProposal(id, updates, userEmail = "sistema@vellia.com") {
        const proposals = this.getProposalsRaw();
        const index = proposals.findIndex(p => p.id === id);
        if (index !== -1) {
            proposals[index] = { ...proposals[index], ...updates };
            localStorage.setItem("comercial_proposals", JSON.stringify(proposals));
            upsertSupabase("comercial_proposals", proposals[index]);
            this.addLog(userEmail, "PROPOSAL_UPDATED", `Proposta ${proposals[index].title} atualizada.`);
            
            window.dispatchEvent(new CustomEvent("vellia:proposalUpdated", { detail: proposals[index] }));
            window.dispatchEvent(new CustomEvent("vellia:scoreUpdated", { detail: { sellerEmail: userEmail, action: "PROPOSAL_UPDATED" } }));
            window.dispatchEvent(new CustomEvent("vellia:waSent"));
            
            return proposals[index];
        }
        return null;
    },


    getLogs() {
        const logs = JSON.parse(localStorage.getItem("comercial_logs")) || [];
        // Ordenar do mais novo para o mais antigo
        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    addLog(userEmail, action, details, status = "SUCCESS") {
        const logs = this.getLogs();
        const newLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            userEmail,
            action,
            details,
            status
        };
        logs.unshift(newLog);
        localStorage.setItem("comercial_logs", JSON.stringify(logs));
        upsertSupabase("comercial_logs", newLog);
        return newLog;
    },

    clearLogs() {
        localStorage.setItem("comercial_logs", JSON.stringify([]));
        deleteSupabase("comercial_logs");
        this.addLog("sistema@vellia.com", "LOGS_CLEARED", "Os logs de auditoria foram limpos.", "WARN");
    },

    // CATÁLOGO DE SERVIÇOS (ETAPA 7)
    getServices() {
        return JSON.parse(localStorage.getItem("comercial_services")) || [];
    },

    getServiceById(id) {
        return this.getServices().find(s => s.id === id);
    },

    addService(data) {
        const services = this.getServices();
        const newService = {
            id: `srv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: data.name,
            category: data.category || "Geral",
            baseMargin: parseFloat(data.baseMargin) || 50,
            isActive: true
        };
        services.push(newService);
        localStorage.setItem("comercial_services", JSON.stringify(services));
        upsertSupabase("comercial_services", newService);
        return newService;
    },

    updateService(id, data) {
        const services = this.getServices();
        const idx = services.findIndex(s => s.id === id);
        if (idx !== -1) {
            services[idx] = { ...services[idx], ...data };
            localStorage.setItem("comercial_services", JSON.stringify(services));
            upsertSupabase("comercial_services", services[idx]);
            return true;
        }
        return false;
    },


    // ==========================================
    // METAS (GOALS)
    // ==========================================
    getGoals() {
        return JSON.parse(localStorage.getItem("comercial_goals")) || [];
    },

    saveGoals(goalsData) {
        localStorage.setItem("comercial_goals", JSON.stringify(goalsData));
        upsertSupabase("comercial_goals", goalsData);
    },

    getGoalByUserAndPeriod(email, period) {
        return this.getGoals().find(g => g.userEmail === email && g.period === period);
    },

    setGoal(email, period, targets) {
        let goals = this.getGoals();
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
        localStorage.setItem("comercial_leads", JSON.stringify(leads));
        upsertSupabase("comercial_leads", leads[index]);
        return newComment;
    },

    // ==========================================
    // TAREFAS DOS VENDEDORES (TASKS)
    // ==========================================
    getTasks(email) {
        const key = `seller_tasks_${email}`;
        return JSON.parse(localStorage.getItem(key) || "[]");
    },

    async saveTasks(email, tasks) {
        const key = `seller_tasks_${email}`;
        localStorage.setItem(key, JSON.stringify(tasks));
        
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

            // Atualizar localStorage com os IDs possivelmente gerados
            localStorage.setItem(key, JSON.stringify(tasks));

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
            localStorage.setItem(key, JSON.stringify(formattedTasks));

            // Obter o usuário logado atualmente para decidir se notifica de novas tarefas
            let currentUser = null;
            try {
                currentUser = JSON.parse(localStorage.getItem("comercial_session"));
            } catch (e) {}

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
        const logs = JSON.parse(localStorage.getItem("comercial_logs") || "[]");
        const guruHistory = JSON.parse(localStorage.getItem("guru_strategy_history") || "[]");

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
            const userTasks = JSON.parse(localStorage.getItem(`seller_tasks_${u.email}`) || "[]");
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
        return JSON.parse(localStorage.getItem("vellia_calendar_events")) || [];
    },
    saveCalendarEvents(events) {
        localStorage.setItem("vellia_calendar_events", JSON.stringify(events));
        upsertSupabase("comercial_calendar_events", events);
    },

    // Métodos utilitários para resetar banco se necessário
    resetAll() {
        localStorage.removeItem("comercial_users");
        localStorage.removeItem("comercial_logs");
        localStorage.removeItem("comercial_leads");
        localStorage.removeItem("comercial_proposals");
        localStorage.removeItem("comercial_goals");
        localStorage.removeItem("comercial_services");
        initStorage();
        window.location.reload();
    },

    // Expor upsert para módulos externos salvarem diretamente em tabelas customizadas
    upsert(table, data) {
        return upsertSupabase(table, data);
    }
};
