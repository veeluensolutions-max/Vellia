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
        lastLoginAt: null
    },
    {
        id: "usr_gerente",
        name: "Carlos Gerente",
        email: "gerente@vellia.com",
        password: "123456",
        role: "manager",
        avatar: "CG",
        status: "active",
        lastLoginAt: null
    },
    {
        id: "usr_vendedor",
        name: "Lucas Vendedor",
        email: "vendedor@vellia.com",
        password: "123456",
        role: "seller",
        avatar: "LV",
        status: "active",
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

const INITIAL_GOALS = [
    {
        userEmail: "vendedor@vellia.com",
        period: "2026-07",
        targets: {
            revenue: 150000,
            proposals: 20,
            leadsQualified: 30
        }
    },
    {
        userEmail: "gerente@vellia.com",
        period: "2026-07",
        targets: {
            revenue: 300000,
            proposals: 50,
            leadsQualified: 80
        }
    }
];

// Credenciais e API REST do Supabase
const SUPABASE_URL = "https://ogrbsonpkiamoytxjshg.supabase.co";
const SUPABASE_KEY = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";

async function supabaseFetch(table) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const response = await fetch(url, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        }
    });
    if (!response.ok) throw new Error(`Supabase query failed: ${response.statusText}`);
    return await response.json();
}

async function upsertSupabase(table, data) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    try {
        await fetch(url, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.warn(`Supabase Sync Error for ${table}:`, e);
    }
}

async function deleteSupabase(table, filter = "") {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`;
    try {
        await fetch(url, {
            method: "DELETE",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`
            }
        });
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
        const leads = await supabaseFetch("comercial_leads");
        if (leads && leads.length > 0) localStorage.setItem("comercial_leads", JSON.stringify(leads));
    } catch (e) { console.log("Leads sync fallback:", e.message); }

    try {
        const proposals = await supabaseFetch("comercial_proposals");
        if (proposals && proposals.length > 0) localStorage.setItem("comercial_proposals", JSON.stringify(proposals));
    } catch (e) { console.log("Proposals sync fallback:", e.message); }

    try {
        const logs = await supabaseFetch("comercial_logs");
        if (logs && logs.length > 0) {
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

    try {
        const remoteGoals = await supabaseFetch("comercial_goals") || [];
        const localGoals = JSON.parse(localStorage.getItem("comercial_goals")) || INITIAL_GOALS;
        
        let mergedGoals = [...remoteGoals];
        let needsUpsert = false;
        
        localGoals.forEach(localG => {
            const exists = mergedGoals.some(g => g.userEmail.toLowerCase() === localG.userEmail.toLowerCase() && g.period === localG.period);
            if (!exists) {
                mergedGoals.push(localG);
                needsUpsert = true;
            }
        });
        
        localStorage.setItem("comercial_goals", JSON.stringify(mergedGoals));
        if (needsUpsert) {
            upsertSupabase("comercial_goals", mergedGoals);
        }
    } catch (e) { console.log("Goals sync fallback:", e.message); }

    // Sincronizar Tarefas dos Vendedores
    try {
        const users = JSON.parse(localStorage.getItem("comercial_users")) || [];
        const sellers = users.filter(u => u.role === "seller" || u.role === "manager");
        for (const s of sellers) {
            const key = `seller_tasks_${s.email}`;
            const remoteTasks = await supabaseFetch(`comercial_tasks?owner=eq.${s.email}`) || [];
            if (remoteTasks && remoteTasks.length > 0) {
                // Mapeia de volta para o formato de array simples esperado pelo frontend
                const formattedTasks = remoteTasks.map(t => ({
                    text: t.text,
                    done: t.done,
                    date: t.date,
                    priority: t.priority,
                    assignedBy: t.assignedBy
                }));
                localStorage.setItem(key, JSON.stringify(formattedTasks));
            }
        }
    } catch (e) { console.log("Tasks sync fallback:", e.message); }

    // Disparar evento global para atualizar a UI do app após puxar dados do Supabase
    window.dispatchEvent(new CustomEvent("vellia:waSent"));
    window.dispatchEvent(new Event("storage"));
}

// Inicialização segura do localStorage
function initStorage() {
    if (!localStorage.getItem("comercial_users")) {
        localStorage.setItem("comercial_users", JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem("comercial_logs")) {
        localStorage.setItem("comercial_logs", JSON.stringify(INITIAL_LOGS));
    }
    const leadsVal = localStorage.getItem("comercial_leads");
    if (!leadsVal || leadsVal === "[]") {
        localStorage.setItem("comercial_leads", JSON.stringify(INITIAL_LEADS));
    }
    if (!localStorage.getItem("comercial_proposals") || localStorage.getItem("comercial_proposals") === "[]") {
        localStorage.setItem("comercial_proposals", JSON.stringify(INITIAL_PROPOSALS));
    }
    if (!localStorage.getItem("comercial_goals") || localStorage.getItem("comercial_goals") === "[]") {
        localStorage.setItem("comercial_goals", JSON.stringify(INITIAL_GOALS));
    }
    if (!localStorage.getItem("comercial_services") || localStorage.getItem("comercial_services") === "[]") {
        localStorage.setItem("comercial_services", JSON.stringify(INITIAL_SERVICES));
    }
}

// Inicializar local storage e sincronizar
initStorage();
syncFromSupabase();

export const Store = {
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
        return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    },

    // LEADS (CRM)
    getLeads() {
        return JSON.parse(localStorage.getItem("comercial_leads")) || [];
    },

    getLeadById(id) {
        return this.getLeads().find(l => l.id === id);
    },

    addLead(lead, userEmail = "sistema@vellia.com") {
        const leads = this.getLeads();
        const newLead = {
            id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            company: lead.company,
            contact: lead.contact,
            role: lead.role || "",
            phone: lead.phone || "",
            whatsapp: lead.whatsapp || "",
            email: lead.email || "",
            city: lead.city || "",
            state: lead.state || "",
            segment: lead.segment || "Outros",
            source: lead.source || "Outbound",
            stage: lead.stage || "Contato",
            owner: userEmail,
            interactions: lead.interactions || [],
            stageHistory: lead.stageHistory || [
                {
                    stage: lead.stage || "Contato",
                    userEmail: lead.userEmail || "sistema@vellia.com",
                    timestamp: new Date().toISOString(),
                    reason: "Cadastro inicial do lead."
                }
            ]
        };
        leads.push(newLead);
        localStorage.setItem("comercial_leads", JSON.stringify(leads));
        upsertSupabase("comercial_leads", newLead);
        return newLead;
    },

    updateLead(leadId, updatedData, userEmail = "sistema@vellia.com") {
        const leads = this.getLeads();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            leads[index] = { ...leads[index], ...updatedData };
            localStorage.setItem("comercial_leads", JSON.stringify(leads));
            upsertSupabase("comercial_leads", leads[index]);
            this.addLog(userEmail, "LEAD_UPDATED", `Lead ${leads[index].company} atualizado.`);
            return leads[index];
        }
        return null;
    },

    addLeadInteraction(leadId, userEmail, interaction) {
        const leads = this.getLeads();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            const newInteraction = {
                id: `int_${Date.now()}`,
                type: interaction.type, // Ligação, WhatsApp, Reunião, etc.
                description: interaction.description,
                timestamp: new Date().toISOString(),
                userEmail
            };
            leads[index].interactions.push(newInteraction);
            localStorage.setItem("comercial_leads", JSON.stringify(leads));
            upsertSupabase("comercial_leads", leads[index]);
            return newInteraction;
        }
        return null;
    },

    updateLeadStage(leadId, newStage, userEmail, reason = "") {
        const leads = this.getLeads();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            const oldStage = leads[index].stage;
            leads[index].stage = newStage;
            
            // Gravar histórico de etapas
            leads[index].stageHistory.push({
                stage: newStage,
                userEmail,
                timestamp: new Date().toISOString(),
                reason: reason || `Transição manual de etapa.`
            });

            localStorage.setItem("comercial_leads", JSON.stringify(leads));
            upsertSupabase("comercial_leads", leads[index]);
            return { success: true, oldStage, newStage };
        }
        return { success: false };
    },

    getLeadById(leadId) {
        const leads = this.getLeads();
        return leads.find(l => l.id === leadId) || null;
    },

    // PROPOSTAS
    getProposals() {
        return JSON.parse(localStorage.getItem("comercial_proposals")) || [];
    },

    getProposalById(id) {
        return this.getProposals().find(p => p.id === id) || null;
    },

    addProposal(data) {
        const proposals = this.getProposals();
        const newProposal = {
            id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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
        return newProposal;
    },

    updateProposal(id, updates, userEmail = "sistema@vellia.com") {
        const proposals = this.getProposals();
        const index = proposals.findIndex(p => p.id === id);
        if (index !== -1) {
            proposals[index] = { ...proposals[index], ...updates };
            localStorage.setItem("comercial_proposals", JSON.stringify(proposals));
            upsertSupabase("comercial_proposals", proposals[index]);
            this.addLog(userEmail, "PROPOSAL_UPDATED", `Proposta ${proposals[index].title} atualizada.`);
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
    // TAREFAS DOS VENDEDORES (TASKS)
    // ==========================================
    getTasks(email) {
        const key = `seller_tasks_${email}`;
        const today = new Date().toLocaleDateString("pt-BR");
        return JSON.parse(localStorage.getItem(key) || "[]").filter(t => t.date === today);
    },

    async saveTasks(email, tasks) {
        const key = `seller_tasks_${email}`;
        localStorage.setItem(key, JSON.stringify(tasks));
        
        // Sincronizar com Supabase: primeiro removemos as tarefas antigas do dia e inserimos as novas
        try {
            await deleteSupabase("comercial_tasks", `?owner=eq.${email}`);
            
            // Subir novas
            for (let i = 0; i < tasks.length; i++) {
                const t = tasks[i];
                const dbTask = {
                    id: `task_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                    owner: email,
                    text: t.text,
                    done: t.done,
                    date: t.date,
                    priority: t.priority || "normal",
                    assignedBy: t.assignedBy || "sistema@vellia.com"
                };
                await upsertSupabase("comercial_tasks", dbTask);
            }
        } catch (e) {
            console.warn("Erro ao sincronizar tarefas no Supabase:", e);
        }
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
    }
};
