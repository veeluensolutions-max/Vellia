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
        avatar: "AG"
    },
    {
        id: "usr_gerente",
        name: "Carlos Gerente",
        email: "gerente@vellia.com",
        password: "123456",
        role: "manager",
        avatar: "CG"
    },
    {
        id: "usr_vendedor",
        name: "Lucas Vendedor",
        email: "vendedor@vellia.com",
        password: "123456",
        role: "seller",
        avatar: "LV"
    }
];

const INITIAL_LOGS = [
    {
        id: "log_001",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2h atrás
        userEmail: "sistema@vellia.com",
        action: "SYSTEM_INITIALIZATION",
        details: "Banco de dados inicializado com sucesso no localStorage.",
        status: "SUCCESS"
    },
    {
        id: "log_002",
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1h atrás
        userEmail: "admin@vellia.com",
        action: "USER_LOGIN",
        details: "Login efetuado com sucesso no perfil Administrador.",
        status: "SUCCESS"
    }
];

const INITIAL_LEADS = [
    {
        id: "lead_1",
        company: "Tecnologia Alfa",
        contact: "Amanda Rocha",
        role: "Diretora de Marketing",
        phone: "(11) 98212-3434",
        whatsapp: "(11) 98212-3434",
        email: "amanda@tecalfa.com.br",
        city: "São Paulo",
        state: "SP",
        segment: "Tecnologia",
        source: "Google Ads",
        stage: "Contato",
        owner: "vendedor@vellia.com",
        interactions: [
            {
                id: "int_1_1",
                type: "Ligação",
                description: "Conversa inicial sobre serviços de desenvolvimento.",
                timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
                userEmail: "vendedor@vellia.com"
            }
        ],
        stageHistory: [
            {
                stage: "Contato",
                userEmail: "vendedor@vellia.com",
                timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
                reason: "Contato inicial captado via Google Ads."
            }
        ]
    },
    {
        id: "lead_2",
        company: "Construções Prime",
        contact: "Ricardo Alencar",
        role: "Gerente de Compras",
        phone: "(21) 97112-5566",
        whatsapp: "(21) 97112-5566",
        email: "ricardo@primeconst.com.br",
        city: "Rio de Janeiro",
        state: "RJ",
        segment: "Construção Civil",
        source: "Indicação",
        stage: "Lead Gerado",
        owner: "vendedor@vellia.com",
        interactions: [],
        stageHistory: [
            {
                stage: "Contato",
                userEmail: "vendedor@vellia.com",
                timestamp: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
                reason: "Primeira indicação do parceiro comercial."
            },
            {
                stage: "Lead Gerado",
                userEmail: "vendedor@vellia.com",
                timestamp: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
                reason: "Validado e transformado em lead de interesse."
            }
        ]
    },
    {
        id: "lead_3",
        company: "Logística Express",
        contact: "Fernanda Lima",
        role: "Head de Operações",
        phone: "(31) 98877-6655",
        whatsapp: "(31) 98877-6655",
        email: "fernanda@logexpress.com.br",
        city: "Belo Horizonte",
        state: "MG",
        segment: "Transportes",
        source: "Outbound",
        stage: "Lead Qualificado",
        owner: "vendedor@vellia.com",
        interactions: [
            {
                id: "int_3_1",
                type: "Reunião",
                description: "Reunião de alinhamento técnico para proposta comercial.",
                timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
                userEmail: "vendedor@vellia.com"
            }
        ],
        stageHistory: [
            {
                stage: "Contato",
                userEmail: "vendedor@vellia.com",
                timestamp: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
                reason: "Contato frio outbound."
            },
            {
                stage: "Lead Qualificado",
                userEmail: "vendedor@vellia.com",
                timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
                reason: "Alinhado necessidades técnicas e orçamento aprovado."
            }
        ]
    }
];

const INITIAL_PROPOSALS = [
    {
        id: "prop_1",
        leadId: "lead_2",
        company: "Construções Prime",
        contact: "Rodrigo Lima",
        title: "Proposta Comercial - Software de Gestão de Obras",
        value: 18500,
        status: "Enviada",
        sentAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
        closedAt: null,
        validUntil: new Date(Date.now() + 3600000 * 24 * 10).toISOString(),
        competitor: "",
        lossReason: "",
        notes: "Apresentação agendada para a próxima semana. Cliente comentou que o preço pode estar caro em comparação com a concorrência.",
        createdBy: "vendedor@vellia.com",
        createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString()
    },
    {
        id: "prop_2",
        leadId: "lead_3",
        company: "Farmácia Saúde Total",
        contact: "Fernanda Costa",
        title: "Proposta Comercial - Sistema de Ponto de Venda PDV",
        value: 9800,
        status: "Ganho",
        sentAt: new Date(Date.now() - 3600000 * 24 * 20).toISOString(),
        closedAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
        validUntil: new Date(Date.now() - 3600000 * 24 * 8).toISOString(),
        competitor: "",
        lossReason: "",
        notes: "Cliente fechou após demonstração do produto.",
        createdBy: "vendedor@vellia.com",
        createdAt: new Date(Date.now() - 3600000 * 24 * 20).toISOString()
    },
    {
        id: "prop_3",
        leadId: "lead_1",
        company: "Tecnologia Alfa",
        contact: "Amanda Rocha",
        title: "Proposta Comercial - Desenvolvimento de Aplicativo Mobile",
        value: 35000,
        status: "Perdido",
        sentAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
        closedAt: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
        validUntil: new Date(Date.now() - 3600000 * 24 * 20).toISOString(),
        competitor: "Softex Soluções",
        lossReason: "Preço acima do orçamento do cliente",
        notes: "Cliente optou por concorrente com escopo reduzido.",
        createdBy: "vendedor@vellia.com",
        createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString()
    }
];

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

// Inicializar imediatamente
initStorage();

export const Store = {
    // USUÁRIOS
    getUsers() {
        return JSON.parse(localStorage.getItem("comercial_users")) || [];
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
        return newLead;
    },

    updateLead(leadId, updatedData, userEmail = "sistema@vellia.com") {
        const leads = this.getLeads();
        const index = leads.findIndex(l => l.id === leadId);
        if (index !== -1) {
            leads[index] = { ...leads[index], ...updatedData };
            localStorage.setItem("comercial_leads", JSON.stringify(leads));
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
        return newProposal;
    },

    updateProposal(id, updates, userEmail = "sistema@vellia.com") {
        const proposals = this.getProposals();
        const index = proposals.findIndex(p => p.id === id);
        if (index !== -1) {
            proposals[index] = { ...proposals[index], ...updates };
            localStorage.setItem("comercial_proposals", JSON.stringify(proposals));
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
        return newLog;
    },

    clearLogs() {
        localStorage.setItem("comercial_logs", JSON.stringify([]));
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
        return newService;
    },

    updateService(id, data) {
        const services = this.getServices();
        const idx = services.findIndex(s => s.id === id);
        if (idx !== -1) {
            services[idx] = { ...services[idx], ...data };
            localStorage.setItem("comercial_services", JSON.stringify(services));
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
