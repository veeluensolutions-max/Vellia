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
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>⚡ Resposta WhatsApp (&lt; 1 min)</span>
                            <span class="badge badge-success" style="background: #dcfce7; color: #16a34a; font-size: 11px;">⚡ Ativo</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Leads Recebidos (Hoje)</span>
                            <span style="font-weight: 700;" id="meta-leads-count">0</span>
                        </div>
                    </div>

                    <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 8px;">
                        <button class="btn btn-primary" style="flex: 1; font-size: 11.5px; padding: 6px 8px;" onclick="window.simulateMetaLead()">Simular Lead</button>
                        <button class="btn btn-outline" style="flex: 1; font-size: 11.5px; padding: 6px 8px;" onclick="window.simulateMessengerMessage()">Simular Messenger</button>
                        <button class="btn btn-outline" style="flex: 1; font-size: 11.5px; padding: 6px 8px; border-color: #e1306c; color: #e1306c;" onclick="window.simulateInstagramDirect()">📸 Simular Instagram Direct</button>
                        <button class="btn btn-outline" style="width: 100%; font-size: 12px; padding: 6px 10px;" onclick="window.openMetaConfigModal()">⚙️ Configurações Meta</button>
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

            <!-- AI AUTOPILOT CONSOLE -->
            <div class="autopilot-container" id="ai-autopilot-panel">
                <h3 style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <span>🛰️</span> Painel do Piloto Automático SDR AI
                </h3>
                <div class="autopilot-grid">
                    <div style="text-align: center;">
                        <div class="radar-scanner" id="autopilot-radar"></div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--primary); margin-top: 10px;" id="autopilot-status-lbl">AGUARDANDO...</div>
                    </div>
                    <div>
                        <div class="terminal-console" id="autopilot-terminal">
                            <div class="terminal-line info">> Aguardando início da simulação de lead ou mensagem...</div>
                        </div>
                    </div>
                </div>
                <div class="autopilot-steps">
                    <div class="autopilot-step" id="step-init">1. Conexão</div>
                    <div class="autopilot-step" id="step-scanning">2. Varredura Ads</div>
                    <div class="autopilot-step" id="step-dialogue">3. Triagem WhatsApp</div>
                    <div class="autopilot-step" id="step-decision">4. Decisão Funil</div>
                    <div class="autopilot-step" id="step-done">5. Concluído</div>
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

        // Ouvinte de atualização do SDR AI para o console do Piloto Automático
        window.removeEventListener("vellia:sdrUpdate", window.handleSdrAutopilotUpdate);
        window.handleSdrAutopilotUpdate = (e) => {
            const panel = document.getElementById("ai-autopilot-panel");
            const terminal = document.getElementById("autopilot-terminal");
            const radar = document.getElementById("autopilot-radar");
            const statusLabel = document.getElementById("autopilot-status-lbl");
            
            if (!panel || !terminal) return;

            // Exibir o painel
            panel.style.display = "block";

            // Se for inicialização, limpa o terminal
            if (e.detail.stage === "init") {
                terminal.innerHTML = "";
                radar.classList.add("active");
                statusLabel.textContent = "CONECTANDO...";
                statusLabel.style.color = "var(--primary)";
                
                // Resetar etapas
                document.querySelectorAll(".autopilot-step").forEach(s => s.className = "autopilot-step");
            }

            // Atualizar classes das etapas
            const currentStepEl = document.getElementById(`step-${e.detail.stage}`);
            if (currentStepEl) {
                currentStepEl.classList.add("active");
                // Marcar anteriores como success
                if (e.detail.stage === "scanning") {
                    document.getElementById("step-init").className = "autopilot-step success";
                    statusLabel.textContent = "VARRENDO ADS...";
                } else if (e.detail.stage === "dialogue") {
                    document.getElementById("step-init").className = "autopilot-step success";
                    document.getElementById("step-scanning").className = "autopilot-step success";
                    statusLabel.textContent = "TRIANDO NO WHATSAPP...";
                } else if (e.detail.stage === "decision") {
                    document.getElementById("step-init").className = "autopilot-step success";
                    document.getElementById("step-scanning").className = "autopilot-step success";
                    document.getElementById("step-dialogue").className = "autopilot-step success";
                    statusLabel.textContent = "DECIDINDO ETAPA...";
                } else if (e.detail.stage === "done") {
                    document.querySelectorAll(".autopilot-step").forEach(s => s.className = "autopilot-step success");
                    statusLabel.textContent = "FINALIZADO";
                    statusLabel.style.color = "var(--success)";
                    radar.classList.remove("active");
                }
            }

            // Adicionar linha ao terminal com estilo retro/hacker
            const line = document.createElement("div");
            line.className = "terminal-line";
            
            // Colorir conforme o conteúdo
            if (e.detail.text.includes("✅") || e.detail.text.includes("Sucesso") || e.detail.text.includes("done")) {
                line.classList.add("success");
            } else if (e.detail.text.includes("❌") || e.detail.text.includes("Falha") || e.detail.text.includes("Erro")) {
                line.classList.add("error");
            } else if (e.detail.text.includes("📡") || e.detail.text.includes("🧠") || e.detail.text.includes("Varrendo")) {
                line.classList.add("warning");
            } else {
                line.classList.add("info");
            }

            line.textContent = e.detail.text;
            terminal.appendChild(line);
            
            // Rolagem automática
            terminal.scrollTop = terminal.scrollHeight;
        };
        window.addEventListener("vellia:sdrUpdate", window.handleSdrAutopilotUpdate);
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

        // Disparar evento para atualizar visões e notificações
        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new CustomEvent("vellia:metaLeadReceived", {
            detail: { contact: newLead.name || newLead.contact, company: newLead.company, source: "Meta Ads" }
        }));

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

window.simulateMessengerMessage = function() {
    import('./store.js').then(module => {
        const Store = module.Store;
        const leads = Store.getLeads();
        
        const mockSenderId = Math.floor(1000 + Math.random() * 9000).toString();
        const newLead = {
            id: 'L_msg_' + Date.now(),
            name: 'Cliente Messenger ' + mockSenderId,
            contact: 'Cliente Facebook ' + mockSenderId,
            email: `messenger_${mockSenderId}@facebook.com`,
            phone: `(FB) ${mockSenderId}`,
            company: 'FB Messenger (' + mockSenderId + ')',
            segment: 'Redes Sociais',
            owner: 'admin@vellia.com',
            stage: 'Contato',
            source: 'Facebook Messenger',
            date: new Date().toISOString()
        };
        
        leads.unshift(newLead);
        Store.saveLeads(leads);
        
        const logs = Store.getLogs();
        logs.unshift({
            id: 'log-' + Date.now(),
            timestamp: new Date().toISOString(),
            userEmail: 'sistema@vellia.com',
            action: 'MESSENGER_RECEIVED',
            details: `Mensagem recebida no Facebook Messenger de ${newLead.company}`
        });
        Store.saveLogs(logs);

        // Atualizar contador na tela se existir
        const countSpan = document.getElementById('meta-leads-count');
        if (countSpan) {
            countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }

        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new CustomEvent("vellia:metaLeadReceived", {
            detail: { contact: newLead.contact, company: newLead.company, source: "Facebook Messenger" }
        }));

        const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
        if (waConfig.sdrActive !== false) {
            setTimeout(() => {
                import('./sdr.js').then(m => m.SDR.runTriage(newLead.id));
            }, 1500);
            alert(`Mensagem simulada do Facebook Messenger (${newLead.company}) recebida! O SDR AI iniciou a triagem automática.`);
        } else {
            alert('Mensagem do Facebook Messenger recebida com sucesso!');
        }
    });
};

window.simulateInstagramDirect = function() {
    import('./store.js').then(module => {
        const Store = module.Store;
        const leads = Store.getLeads();
        
        const mockIgUsernames = ["@mariana.tech", "@lucas.design", "@carol.influencer", "@rafael.ventures"];
        const randIdx = Math.floor(Math.random() * mockIgUsernames.length);
        const mockHandle = mockIgUsernames[randIdx];
        const mockId = Math.floor(1000 + Math.random() * 9000).toString();

        const newLead = {
            id: 'L_ig_' + Date.now(),
            name: `Cliente Instagram (${mockHandle})`,
            contact: mockHandle,
            email: `direct_${mockId}@instagram.com`,
            phone: `(IG) ${mockHandle}`,
            whatsapp: `55119${mockId}${mockId}`,
            company: `Instagram Direct (${mockHandle})`,
            segment: 'Redes Sociais',
            owner: 'admin@vellia.com',
            stage: 'Contato',
            source: 'Instagram Direct',
            date: new Date().toISOString(),
            interactions: [
                {
                    id: 'int_ig_init_' + Date.now(),
                    type: "Instagram Direct",
                    description: `📸 **Mensagem Recebida via Instagram Direct:** "Olá! Vi o post de vocês sobre a plataforma comercial e gostaria de saber os valores para a minha equipe."`,
                    timestamp: new Date().toISOString(),
                    userEmail: "sistema@vellia.com"
                }
            ]
        };
        
        leads.unshift(newLead);
        Store.saveLeads(leads);
        
        const logs = Store.getLogs();
        logs.unshift({
            id: 'log-' + Date.now(),
            timestamp: new Date().toISOString(),
            userEmail: 'sistema@vellia.com',
            action: 'INSTAGRAM_DIRECT_RECEIVED',
            details: `Mensagem recebida no Instagram Direct de ${mockHandle}`
        });
        Store.saveLogs(logs);

        // Atualizar contador na tela se existir
        const countSpan = document.getElementById('meta-leads-count');
        if (countSpan) {
            countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }

        window.dispatchEvent(new CustomEvent("vellia:waSent"));
        window.dispatchEvent(new CustomEvent("vellia:metaLeadReceived", {
            detail: { contact: newLead.contact, company: newLead.company, source: "Instagram Direct" }
        }));

        const waConfig = JSON.parse(localStorage.getItem("comercial_wa_api_config")) || { sdrActive: true };
        if (waConfig.sdrActive !== false) {
            setTimeout(() => {
                import('./sdr.js').then(m => m.SDR.runTriage(newLead.id));
            }, 1500);
            alert(`Mensagem simulada do Instagram Direct (${mockHandle}) recebida! O SDR AI iniciou a triagem automática.`);
        } else {
            alert(`Mensagem do Instagram Direct (${mockHandle}) recebida com sucesso!`);
        }
    });
};

window.openMetaConfigModal = function() {
    // Garantir que o modal seja criado e inserido no DOM se não existir
    let configModal = document.getElementById("meta-config-modal");
    if (!configModal) {
        configModal = document.createElement("div");
        configModal.id = "meta-config-modal";
        configModal.className = "modal";
        configModal.style.maxWidth = "550px";
        configModal.style.position = "fixed";
        configModal.style.top = "50%";
        configModal.style.left = "50%";
        configModal.style.transform = "translate(-50%, -50%)";
        configModal.style.zIndex = "1100";
        configModal.style.background = "var(--bg-card)";
        configModal.style.border = "1px solid var(--border-color)";
        configModal.style.borderRadius = "var(--radius-lg)";
        configModal.style.boxShadow = "var(--shadow-lg)";
        configModal.style.display = "none";
        
        configModal.innerHTML = `
            <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
                <h3 style="font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span>⚙️</span> Configurações Meta Ads
                </h3>
                <button class="drawer-close" id="btn-close-meta-modal" style="background: none; border: none; cursor: pointer; color: var(--text-primary); font-size: 20px; display: flex; align-items: center; justify-content: center; padding: 4px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 60vh; overflow-y: auto;">
                <!-- Webhook Info (Read-Only) -->
                <div style="background: var(--bg-body); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 13px;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: var(--text-primary);">Configuração no Meta Developer Portal:</p>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">URL de Retorno (Callback URL)</span>
                            <input type="text" class="form-control" value="https://velliacrm.vercel.app/api/meta-webhook" readonly style="font-size: 12px; height: 32px; background: var(--bg-app); width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" id="meta-callback-url">
                        </div>
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">Token de Verificação (Verify Token)</span>
                            <input type="text" id="meta-verify-token-input" class="form-control" style="font-size: 12px; height: 32px; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" value="vellia-crm-token-123">
                        </div>
                    </div>
                </div>

                <!-- Graph API & CAPI Credentials -->
                <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: block;">Page Access Token (Token de Acesso)</label>
                    <input type="password" id="meta-access-token-input" class="form-control" placeholder="Inserir Page Access Token do Facebook" style="font-size: 12px; height: 36px; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;">
                    <span style="font-size: 11px; color: var(--text-muted); display: block;">Token requerido para consulta do formulário via Graph API e envio de eventos CAPI.</span>
                </div>

                <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: block;">Meta Pixel ID (Conversions API)</label>
                    <input type="text" id="meta-pixel-id-input" class="form-control" placeholder="Ex: 123456789012345" style="font-size: 12px; height: 36px; width: 100%; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" value="123456789012345">
                    <span style="font-size: 11px; color: var(--text-muted); display: block;">ID do Pixel para envio de estatísticas de conversão e otimização de anúncios.</span>
                </div>

                <!-- Mapeamento de Campos -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 14px;">
                    <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0 0 10px 0;">Mapeamento de Campos do Formulário</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; font-size: 12px;">
                        <div style="display: flex; flex-direction: column; justify-content: space-around; gap: 8px;">
                            <div style="font-weight: 600; color: var(--text-muted); height: 32px; display: flex; align-items: center;">Campo Vellia CRM</div>
                            <div style="height: 32px; display: flex; align-items: center; font-weight: 500;">Nome Completo</div>
                            <div style="height: 32px; display: flex; align-items: center; font-weight: 500;">E-mail</div>
                            <div style="height: 32px; display: flex; align-items: center; font-weight: 500;">Telefone</div>
                            <div style="height: 32px; display: flex; align-items: center; font-weight: 500;">Empresa</div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-weight: 600; color: var(--text-muted); height: 32px; display: flex; align-items: center;">ID do Campo no Meta</div>
                            <input type="text" id="map-name" class="form-control" style="font-size: 12px; height: 32px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" value="full_name" placeholder="Ex: full_name">
                            <input type="text" id="map-email" class="form-control" style="font-size: 12px; height: 32px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" value="email" placeholder="Ex: email">
                            <input type="text" id="map-phone" class="form-control" style="font-size: 12px; height: 32px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" value="phone_number" placeholder="Ex: phone_number">
                            <input type="text" id="map-company" class="form-control" style="font-size: 12px; height: 32px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0 8px;" value="company_name" placeholder="Ex: company_name">
                        </div>
                    </div>
                </div>

                <!-- Sandbox -->
                <div style="border-top: 1px solid var(--border-color); padding-top: 14px; background: rgba(99,102,241,0.03); padding: 12px; border-radius: var(--radius-md); border: 1px dashed var(--primary); margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="font-size: 13px; font-weight: 700; color: var(--primary); margin: 0; display: flex; align-items: center; gap: 6px;">
                        <span>🚀</span> Sandbox do Desenvolvedor (Simuladores API)
                    </h4>
                    <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Envie um POST contendo o payload de webhook simulado para o endpoint backend do VelliaCRM.</p>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 4px;">
                        <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Tipo de Evento Simulado:</span>
                        <select id="meta-sandbox-payload-type" class="filter-control" style="height: 28px; padding: 2px 6px; font-size: 11px; border-radius: 6px; min-width: 180px;">
                            <option value="leadgen">📋 Cadastro Lead Ads (Meta)</option>
                            <option value="whatsapp">💬 Mensagem WhatsApp Recebida</option>
                        </select>
                    </div>

                    <textarea id="meta-sandbox-payload" class="form-control" style="font-family: monospace; font-size: 11px; height: 110px; width: 100%; background: var(--bg-app); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px; resize: vertical;"></textarea>
                    
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" id="btn-fire-sandbox-webhook" style="flex: 1; font-size: 11px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--primary); color: var(--primary); background: transparent; cursor: pointer;">
                            Webhook Teste (POST /api/meta-webhook)
                        </button>
                        <button class="btn btn-outline" id="btn-fire-capi-test" style="flex: 1; font-size: 11px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid #16a34a; color: #16a34a; background: transparent; cursor: pointer;">
                            📊 Testar CAPI Pixel (POST /api/meta-capi)
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg-card); border-bottom-left-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg);">
                <button class="btn btn-outline" id="btn-close-meta-modal-footer" style="cursor: pointer; padding: 8px 16px;">Fechar</button>
                <button class="btn btn-primary" id="btn-save-meta-config" style="cursor: pointer; padding: 8px 16px;">Salvar Configurações</button>
            </div>
        `;
        document.body.appendChild(configModal);

        // Registrar eventos do modal
        document.getElementById("btn-close-meta-modal").addEventListener("click", () => window.closeMetaConfigModal());
        document.getElementById("btn-close-meta-modal-footer").addEventListener("click", () => window.closeMetaConfigModal());
        
        document.getElementById("btn-save-meta-config").addEventListener("click", async () => {
            const verifyToken = document.getElementById("meta-verify-token-input").value.trim();
            const accessToken = document.getElementById("meta-access-token-input").value.trim();
            const pixelId = document.getElementById("meta-pixel-id-input").value.trim();
            const mapName = document.getElementById("map-name").value.trim();
            const mapEmail = document.getElementById("map-email").value.trim();
            const mapPhone = document.getElementById("map-phone").value.trim();
            const mapCompany = document.getElementById("map-company").value.trim();

            const config = {
                verifyToken,
                accessToken,
                pixelId,
                fields: {
                    name: mapName,
                    email: mapEmail,
                    phone: mapPhone,
                    company: mapCompany
                }
            };

            localStorage.setItem("comercial_meta_config", JSON.stringify(config));

            const saveBtn = document.getElementById("btn-save-meta-config");
            saveBtn.disabled = true;
            saveBtn.textContent = "Salvando...";

            await saveMetaConfigToSupabase(config);

            saveBtn.disabled = false;
            saveBtn.textContent = "Salvar Configurações";
            alert("Configurações salvas e sincronizadas com sucesso!");
            window.closeMetaConfigModal();
        });

        document.getElementById("btn-fire-capi-test").addEventListener("click", async () => {
            const capiBtn = document.getElementById("btn-fire-capi-test");
            capiBtn.disabled = true;
            capiBtn.textContent = "Enviando Evento CAPI...";

            try {
                const response = await fetch("/api/meta-capi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        eventName: "QualifyLead",
                        pixelId: document.getElementById("meta-pixel-id-input").value.trim(),
                        lead: {
                            id: `lead_test_${Date.now()}`,
                            company: "Empresa Teste CAPI",
                            contact: "Cliente Diagnóstico",
                            email: "teste.capi@exemplo.com",
                            phone: "(11) 99999-8888",
                            stage: "Lead Qualificado",
                            estimatedValue: 50000
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    alert(`✅ Evento Meta CAPI (${data.eventName}) disparado com sucesso em modo ${data.mode}!\nID do Evento: ${data.eventId}`);
                } else {
                    const text = await response.text();
                    alert(`Falha ao disparar evento CAPI: ${response.status} - ${text}`);
                }
            } catch (err) {
                alert(`Erro ao testar CAPI Meta: ${err.message}`);
            } finally {
                capiBtn.disabled = false;
                capiBtn.textContent = "📊 Testar CAPI Pixel (POST /api/meta-capi)";
            }
        });

        document.getElementById("btn-fire-sandbox-webhook").addEventListener("click", async () => {
            const fireBtn = document.getElementById("btn-fire-sandbox-webhook");
            const rawPayload = document.getElementById("meta-sandbox-payload").value;
            let payload;
            try {
                payload = JSON.parse(rawPayload);
            } catch (err) {
                alert("Erro de sintaxe JSON no Payload!");
                return;
            }

            fireBtn.disabled = true;
            fireBtn.textContent = "Enviando...";

            try {
                const response = await fetch("/api/meta-webhook", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    alert("Webhook enviado e processado com sucesso! Sincronizando leads...");
                    // Forçar atualização do localStorage sincronizando do Supabase
                    if (window.Store && typeof window.Store.syncFromSupabase === 'function') {
                        await window.Store.syncFromSupabase();
                    } else if (typeof syncFromSupabase === 'function') {
                        await syncFromSupabase();
                    }
                    window.dispatchEvent(new CustomEvent("vellia:waSent"));
                } else {
                    const text = await response.text();
                    alert(`Falha ao processar webhook: ${response.status} - ${text}`);
                }
            } catch (err) {
                console.error(err);
                alert(`Erro de conexão ao enviar webhook: ${err.message}`);
            } finally {
                fireBtn.disabled = false;
                fireBtn.textContent = "Enviar Webhook de Teste (POST /api/meta-webhook)";
            }
        });
    }

    // Carregar configurações existentes
    const config = JSON.parse(localStorage.getItem("comercial_meta_config")) || {
        verifyToken: "vellia-crm-token-123",
        accessToken: "",
        fields: {
            name: "full_name",
            email: "email",
            phone: "phone_number",
            company: "company_name"
        }
    };

    document.getElementById("meta-verify-token-input").value = config.verifyToken || "vellia-crm-token-123";
    document.getElementById("meta-access-token-input").value = config.accessToken || "";
    document.getElementById("map-name").value = config.fields?.name || "full_name";
    document.getElementById("map-email").value = config.fields?.email || "email";
    document.getElementById("map-phone").value = config.fields?.phone || "phone_number";
    document.getElementById("map-company").value = config.fields?.company || "company_name";

    // Payloads de exemplo dinâmicos
    const getPayloads = () => {
        const leadgenPayload = {
          "object": "page",
          "entry": [
            {
              "id": "109283749283749",
              "time": Math.floor(Date.now() / 1000),
              "changes": [
                {
                  "field": "leadgen",
                  "value": {
                    "ad_id": "83749283749",
                    "adgroup_id": "28374982374",
                    "campaign_id": "19283749283",
                    "form_id": "form_simulado_" + Math.floor(100 + Math.random() * 900),
                    "leadgen_id": "leadgen_" + Date.now(),
                    "page_id": "109283749283749",
                    "created_time": Math.floor(Date.now() / 1000)
                  }
                }
              ]
            }
          ]
        };

        const whatsappPayload = {
          "object": "whatsapp_business_account",
          "entry": [
            {
              "id": "whatsapp_mock_entry",
              "changes": [
                {
                  "field": "messages",
                  "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                      "display_phone_number": "5511999999999",
                      "phone_number_id": "mock_phone_id"
                    },
                    "contacts": [
                      {
                        "profile": {
                          "name": "Ricardo Vanzin"
                        },
                        "wa_id": "5551988887777"
                      }
                    ],
                    "messages": [
                      {
                        "from": "5551988887777",
                        "id": "mock_message_" + Date.now(),
                        "timestamp": Math.floor(Date.now() / 1000),
                        "text": {
                          "body": "Olá! Gostaria de saber como funciona o sistema e quais os valores da licença."
                        },
                        "type": "text"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        };

        return { leadgen: leadgenPayload, whatsapp: whatsappPayload };
    };

    const payloads = getPayloads();
    const payloadTypeSelect = document.getElementById("meta-sandbox-payload-type");
    const payloadTextarea = document.getElementById("meta-sandbox-payload");

    if (payloadTextarea) {
        payloadTextarea.value = JSON.stringify(payloads.leadgen, null, 2);
    }

    if (payloadTypeSelect && payloadTextarea) {
        // Remover listeners anteriores para não acumular
        const newSelect = payloadTypeSelect.cloneNode(true);
        payloadTypeSelect.parentNode.replaceChild(newSelect, payloadTypeSelect);
        
        newSelect.addEventListener("change", (e) => {
            const type = e.target.value;
            payloadTextarea.value = JSON.stringify(payloads[type], null, 2);
        });
    }

    // Abrir modal
    document.getElementById("meta-config-modal").style.display = "block";
    document.getElementById("meta-config-modal").classList.add("open");
    document.getElementById("modal-overlay").style.display = "block";
};

window.closeMetaConfigModal = function() {
    const modal = document.getElementById("meta-config-modal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("open");
    }
    
    const newLeadModal = document.getElementById("new-lead-modal");
    const editLeadModal = document.getElementById("edit-lead-modal");
    const stageReasonModal = document.getElementById("stage-reason-modal");
    
    const anyOpen = (newLeadModal && newLeadModal.classList.contains("open")) ||
                    (editLeadModal && editLeadModal.classList.contains("open")) ||
                    (stageReasonModal && stageReasonModal.classList.contains("open"));
                    
    if (!anyOpen) {
        const overlay = document.getElementById("modal-overlay");
        if (overlay) overlay.style.display = "none";
    }
};

async function saveMetaConfigToSupabase(config) {
    const configRecord = {
        id: "usr_meta_config",
        name: JSON.stringify(config),
        email: "meta_config@vellia.com",
        password: "system_internal_config",
        role: "system",
        avatar: "MC",
        status: "active",
        lastLoginAt: null
    };

    const url = "https://ogrbsonpkiamoytxjshg.supabase.co/rest/v1/comercial_users";
    const key = "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7";
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "apikey": key,
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            body: JSON.stringify(configRecord)
        });
        if (!response.ok) {
            throw new Error(`Supabase upsert failed with status ${response.status}`);
        }
    } catch (e) {
        console.warn("Erro ao salvar configuração no Supabase:", e);
    }
}
