export const Integrations = {
    init() {
        const container = document.getElementById("integrations-container");
        if (!container) return;

        // Recuperar configurações do localStorage
        const config = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || {
            connected: false,
            apiUrl: "https://api.z-api.io",
            instanceId: "",
            token: "",
            sdrActive: true
        };

        const statusBadge = config.connected 
            ? `<span class="badge badge-success" id="wa-connection-status-badge" style="background: #dcfce7; color: #16a34a;">🟢 Conectado</span>`
            : `<span class="badge badge-danger" id="wa-connection-status-badge" style="background: #fee2e2; color: #dc2626;">🔴 Desconectado</span>`;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                <!-- Meta Ads Card -->
                <div class="card stat-card" style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </div>
                        <div>
                            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">Meta Ads (Facebook)</h3>
                            <span style="font-size: 12px; color: var(--text-muted);">Recepção de Leads via Webhook</span>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-body); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 8px 0;">URL do Webhook para configurar na campanha:</p>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" class="form-control" value="https://velliacrm.vercel.app/api/meta-webhook" readonly style="font-size: 12px; background: var(--bg-app); cursor: copy;" id="webhook-url-input">
                            <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('webhook-url-input').value); alert('URL Copiada!')" style="padding: 0 12px;">
                                Copiar
                            </button>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-primary);">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Status da Conexão</span>
                            <span class="badge badge-success" style="background: #dcfce7; color: #16a34a;">🟢 Conectado</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <span>🤖 SDR AI Automático</span>
                            <input type="checkbox" id="toggle-sdr-ai" ${config.sdrActive !== false ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px;">
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Leads Recebidos (Hoje)</span>
                            <span style="font-weight: 700;" id="meta-leads-count">0</span>
                        </div>
                    </div>

                    <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 10px;">
                        <button class="btn btn-primary" style="flex: 1;" onclick="window.simulateMetaLead()">Simular Lead</button>
                        <button class="btn btn-outline" style="flex: 1;" onclick="alert('Configurações avançadas do Webhook.')">Configurar</button>
                    </div>
                </div>

                <!-- WhatsApp API Card -->
                <div class="card stat-card" style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">WhatsApp API</h3>
                            <span style="font-size: 12px; color: var(--text-muted);">Integração ativa de mensagens</span>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--bg-body); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">URL do Servidor / Gateway</label>
                            <input type="text" id="wa-api-url" class="form-control" style="font-size: 12px; height: 32px; padding: 6px 10px;" value="${config.apiUrl}" placeholder="https://api.z-api.io">
                        </div>
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">ID da Instância</label>
                            <input type="text" id="wa-api-instance" class="form-control" style="font-size: 12px; height: 32px; padding: 6px 10px;" value="${config.instanceId}" placeholder="Ex: 3B82F6...">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Token de Autenticação</label>
                            <input type="password" id="wa-api-token" class="form-control" style="font-size: 12px; height: 32px; padding: 6px 10px;" value="${config.token}" placeholder="••••••••••••">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-primary);">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Status da Conexão</span>
                            ${statusBadge}
                        </div>
                    </div>

                    <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 10px;">
                        <button class="btn btn-primary" style="flex: 1;" id="btn-save-wa-config">${config.connected ? 'Desconectar' : 'Salvar e Conectar'}</button>
                        <button class="btn btn-outline" style="flex: 1;" id="btn-simulate-wa-incoming" ${config.connected ? '' : 'disabled style="opacity: 0.5; cursor: not-allowed;"'}>Simular Mensagem</button>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        const btnSave = document.getElementById("btn-save-wa-config");
        const btnSimulate = document.getElementById("btn-simulate-wa-incoming");

        if (btnSave) {
            btnSave.addEventListener("click", () => {
                const config = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || {
                    connected: false,
                    apiUrl: "https://api.z-api.io",
                    instanceId: "",
                    token: "",
                    sdrActive: true
                };

                if (config.connected) {
                    // Desconectar
                    config.connected = false;
                    localStorage.setItem("comercial_wa_api_config", JSON.stringify(config));
                    import('./audit.js').then(module => {
                        module.Audit.logConfigChange("sistema@vellia.com", "WHATSAPP_API_DISCONNECT", "WhatsApp API desconectada pelo usuário.");
                    });
                    alert("Instância do WhatsApp desconectada.");
                    this.init();
                } else {
                    // Validar campos
                    const apiUrl = document.getElementById("wa-api-url").value.trim();
                    const instanceId = document.getElementById("wa-api-instance").value.trim();
                    const token = document.getElementById("wa-api-token").value.trim();

                    if (!apiUrl || !instanceId || !token) {
                        alert("Por favor, preencha todos os campos para conectar.");
                        return;
                    }

                    config.apiUrl = apiUrl;
                    config.instanceId = instanceId;
                    config.token = token;
                    config.connected = true;

                    localStorage.setItem("comercial_wa_api_config", JSON.stringify(config));
                    import('./audit.js').then(module => {
                        module.Audit.logConfigChange("sistema@vellia.com", "WHATSAPP_API_CONNECT", `WhatsApp API conectada à instância ${instanceId}.`);
                    });
                    alert("Configurações salvas. WhatsApp API conectada com sucesso!");
                    this.init();
                }
            });
        }

        if (btnSimulate) {
            btnSimulate.addEventListener("click", () => {
                window.simulateWhatsAppIncoming();
            });
        }

        const toggleSdr = document.getElementById("toggle-sdr-ai");
        if (toggleSdr) {
            toggleSdr.addEventListener("change", () => {
                const config = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || {
                    connected: false,
                    apiUrl: "https://api.z-api.io",
                    instanceId: "",
                    token: "",
                    sdrActive: true
                };
                config.sdrActive = toggleSdr.checked;
                localStorage.setItem("comercial_wa_api_config", JSON.stringify(config));
                import('./audit.js').then(module => {
                    module.Audit.logConfigChange("sistema@vellia.com", "SDR_AI_TOGGLE", `SDR AI automático alterado para ${toggleSdr.checked ? "ATIVO" : "INATIVO"}.`);
                });
            });
        }
    }
};

window.simulateWhatsAppIncoming = function() {
    import('./store.js').then(module => {
        const Store = module.Store;
        const leads = Store.getLeads();
        
        const companies = ["Indústrias Metalúrgicas", "Mega Distribuidora", "Agro Soluções", "Nexus Logística", "Clínica Vida"];
        const contacts = ["Fernanda Souza", "Gustavo Mendes", "Patrícia Nunes", "Thiago Silva", "Renata Azevedo"];
        const segments = ["Tecnologia", "Construção Civil", "Transportes", "Saúde", "Varejo"];
        
        const randIdx = Math.floor(Math.random() * companies.length);
        const phoneSuffix = Math.floor(1000 + Math.random() * 9000);
        
        const newLead = {
            id: 'L_WA_' + Date.now(),
            company: companies[randIdx],
            contact: contacts[randIdx],
            role: "Diretor(a)",
            phone: `(11) 98765-${phoneSuffix}`,
            whatsapp: `(11) 98765-${phoneSuffix}`,
            email: `${contacts[randIdx].toLowerCase().replace(" ", ".")}@${companies[randIdx].toLowerCase().replace(/[^a-z]/g, "")}.com.br`,
            city: "São Paulo",
            state: "SP",
            segment: segments[randIdx],
            source: "WhatsApp",
            stage: "Contato",
            owner: "vendedor@vellia.com",
            interactions: [
                {
                    id: "int_wa_init",
                    type: "WhatsApp",
                    description: `Mensagem recebida via WhatsApp API: "Olá! Gostaria de saber mais sobre as soluções comerciais de vocês. Conseguem me mandar uma proposta?"`,
                    timestamp: new Date().toISOString(),
                    userEmail: "sistema@vellia.com"
                }
            ],
            stageHistory: [
                {
                    stage: "Contato",
                    userEmail: "sistema@vellia.com",
                    timestamp: new Date().toISOString(),
                    reason: "Lead gerado automaticamente por mensagem entrante do WhatsApp."
                }
            ]
        };
        
        leads.unshift(newLead);
        Store.saveLeads(leads);
        
        // Registrar log
        const logs = Store.getLogs();
        logs.unshift({
            id: 'log-' + Date.now(),
            timestamp: new Date().toISOString(),
            userEmail: 'sistema@vellia.com',
            action: 'WHATSAPP_MESSAGE_RECEIVED',
            details: `Mensagem de WhatsApp recebida de ${newLead.contact} (${newLead.company}). Lead gerado com sucesso.`,
            status: 'SUCCESS'
        });
        Store.saveLogs(logs);

        // Disparar atualização das tabelas
        window.dispatchEvent(new CustomEvent("vellia:waSent"));

        // Se a automação SDR estiver ativa, inicia a triagem após 1.5s
        const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
        if (waConfig.sdrActive !== false) {
            setTimeout(() => {
                import('./sdr.js').then(m => m.SDR.runTriage(newLead.id));
            }, 1500);
            alert(`Mensagem simulada de ${newLead.contact} (${newLead.company})! O SDR AI iniciou a triagem automática via WhatsApp.`);
        } else {
            alert(`Mensagem simulada recebida de ${newLead.contact} (${newLead.company})! Um novo lead foi inserido na etapa 'Contato'.`);
        }
    });
};

window.simulateMetaLead = function() {
    import('./store.js').then(module => {
        const Store = module.Store;
        const leads = Store.getLeads();
        
        const newLead = {
            id: 'L' + Date.now(),
            name: 'Lead Simulado (Meta Ads)',
            email: 'simulado.meta@exemplo.com',
            phone: '(11) 9' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000),
            company: 'Meta Simulações',
            segment: 'Varejo',
            owner: 'admin@vellia.com',
            stage: 'Contato',
            source: 'Meta Ads',
            date: new Date().toISOString()
        };
        
        leads.unshift(newLead);
        Store.saveLeads(leads);
        
        // Registrar log
        const logs = Store.getLogs();
        logs.unshift({
            id: 'log-' + Date.now(),
            timestamp: new Date().toISOString(),
            userEmail: 'sistema@vellia.com',
            action: 'LEAD_RECEIVED',
            details: `Lead recebido via Meta Ads: ${newLead.company}`
        });
        Store.saveLogs(logs);

        // Atualizar contador na tela se existir
        const countSpan = document.getElementById('meta-leads-count');
        if (countSpan) {
            countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }

        // Disparar evento para atualizar visões
        window.dispatchEvent(new CustomEvent("vellia:waSent"));

        // Se a automação SDR estiver ativa, inicia a triagem após 1.5s
        const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
        if (waConfig.sdrActive !== false) {
            setTimeout(() => {
                import('./sdr.js').then(m => m.SDR.runTriage(newLead.id));
            }, 1500);
            alert(`Lead simulado do Meta Ads (${newLead.company}) recebido! O SDR AI iniciou a triagem automática.`);
        } else {
            alert('Lead simulado recebido com sucesso! Vá para a tela de Contatos para visualizá-lo.');
        }
    });
};
