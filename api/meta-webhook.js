// Vercel Serverless Function
// Rota: POST /api/meta-webhook

export default async function handler(req, res) {
    if (req.method === 'GET') {
        // Validação do Webhook (Meta exige que você responda ao challenge hub.challenge)
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        let configuredVerifyToken = 'vellia-crm-token-123';
        
        try {
            const configResponse = await fetch(`https://ogrbsonpkiamoytxjshg.supabase.co/rest/v1/comercial_users?email=eq.meta_config@vellia.com`, {
                headers: {
                    "apikey": "sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7",
                    "Authorization": "Bearer sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7"
                }
            });
            if (configResponse.ok) {
                const configUsers = await configResponse.json();
                if (configUsers && configUsers.length > 0) {
                    const parsed = JSON.parse(configUsers[0].name);
                    if (parsed && parsed.verifyToken) {
                        configuredVerifyToken = parsed.verifyToken;
                    }
                }
            }
        } catch (err) {
            console.error("Erro ao obter verifyToken do Supabase:", err);
        }

        const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || configuredVerifyToken;

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('WEBHOOK_VERIFIED');
                return res.status(200).send(challenge);
            } else {
                return res.status(403).json({ error: 'Token de verificação inválido.' });
            }
        }
        return res.status(400).json({ error: 'Faltam parâmetros de verificação.' });
    }

    if (req.method === 'POST') {
        const body = req.body;

        console.log('📬 Webhook recebido do Meta Ads:', JSON.stringify(body, null, 2));

        if (body.object === 'page') {
            // Buscar configurações do Meta do Supabase
            let config = {
                verifyToken: "vellia-crm-token-123",
                accessToken: "",
                fields: {
                    name: "full_name",
                    email: "email",
                    phone: "phone_number",
                    company: "company_name"
                }
            };
            
            const sbUrl = process.env.SUPABASE_URL || 'https://ogrbsonpkiamoytxjshg.supabase.co';
            const sbKey = process.env.SUPABASE_KEY || 'sb_publishable_Wi3eKJi5uyEzqihEDF6Eaw_-i0zcHe7';

            try {
                const configResponse = await fetch(`${sbUrl}/rest/v1/comercial_users?email=eq.meta_config@vellia.com`, {
                    headers: {
                        "apikey": sbKey,
                        "Authorization": `Bearer ${sbKey}`
                    }
                });
                if (configResponse.ok) {
                    const configUsers = await configResponse.json();
                    if (configUsers && configUsers.length > 0) {
                        const parsed = JSON.parse(configUsers[0].name);
                        config = { ...config, ...parsed };
                    }
                }
            } catch (err) {
                console.error("Erro ao obter configurações do Supabase:", err);
            }

            const token = process.env.META_ACCESS_TOKEN || config.accessToken;

            for (const entry of body.entry) {
                const webhook_event = entry.messaging ? entry.messaging[0] : (entry.changes ? entry.changes[0] : null);
                console.log('Evento do Webhook:', webhook_event);
                
                if (webhook_event && (webhook_event.field === 'leadgen' || webhook_event.value?.leadgen_id)) {
                    const leadgenId = webhook_event.value.leadgen_id;
                    const formId = webhook_event.value.form_id;
                    const adId = webhook_event.value.ad_id;
                    const campaignId = webhook_event.value.campaign_id;

                    let leadData = null;
                    let fetchError = null;

                    if (token && token !== 'EAAC...' && leadgenId && !leadgenId.startsWith("leadgen_")) {
                        try {
                            const graphUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${token}`;
                            const graphRes = await fetch(graphUrl);
                            if (graphRes.ok) {
                                leadData = await graphRes.json();
                                console.log("Dados consultados na Graph API:", leadData);
                            } else {
                                fetchError = `Graph API retornou status ${graphRes.status}: ${graphRes.statusText}`;
                                const errBody = await graphRes.text();
                                console.error("Detalhes do erro Graph API:", errBody);
                            }
                        } catch (err) {
                            fetchError = `Erro na requisição Graph API: ${err.message}`;
                        }
                    } else {
                        fetchError = !token 
                            ? "Token de Acesso da Meta não configurado (modo de simulação)." 
                            : "ID de leadgen simulado detectado (modo de simulação).";
                    }

                    // Fallback se falhar ou se for simulação
                    if (!leadData) {
                        console.log("Gerando lead de teste devido a:", fetchError);
                        const mockNames = ["Ricardo Vanzin", "Mariana Silveira", "Alexandre Pires", "Caroline Schultz"];
                        const mockCompanies = ["Vanzin Distribuidora", "Silveira Tech", "Pires & Associados", "Schultz Indústrias"];
                        const randIdx = Math.floor(Math.random() * mockNames.length);

                        leadData = {
                            id: leadgenId || `mock_${Date.now()}`,
                            created_time: new Date().toISOString(),
                            field_data: [
                                { name: config.fields?.name || "full_name", values: [mockNames[randIdx]] },
                                { name: config.fields?.email || "email", values: [mockNames[randIdx].toLowerCase().replace(/[^a-z]/g, "") + "@exemplo.com"] },
                                { name: config.fields?.phone || "phone_number", values: ["(11) 99" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.floor(1000 + Math.random() * 9000)] },
                                { name: config.fields?.company || "company_name", values: [mockCompanies[randIdx]] },
                                { name: "segment", values: ["Tecnologia"] }
                            ]
                        };
                    }

                    // Parsear campos do formulário
                    const fieldData = leadData.field_data || [];
                    let contactName = 'Lead do Meta Ads';
                    let email = '';
                    let phone = '';
                    let company = 'Meta Ads Lead';
                    let role = '';
                    let city = '';
                    let state = '';
                    let segment = 'Outros';

                    fieldData.forEach(field => {
                        const name = field.name;
                        const value = field.values ? field.values[0] : '';
                        
                        if (name === 'full_name' || name === 'name' || name === config.fields?.name) {
                            contactName = value;
                        } else if (name === 'email' || name === config.fields?.email) {
                            email = value;
                        } else if (name === 'phone_number' || name === 'phone' || name === config.fields?.phone) {
                            phone = value;
                        } else if (name === 'company_name' || name === 'company' || name === config.fields?.company) {
                            company = value;
                        } else if (name === 'role' || name === 'job_title') {
                            role = value;
                        } else if (name === 'city') {
                            city = value;
                        } else if (name === 'state') {
                            state = value;
                        } else if (name === 'segment' || name === 'industry') {
                            segment = value;
                        }
                    });

                    // Criar estrutura de Lead do Vellia CRM
                    const newLead = {
                        id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        company: company,
                        contact: contactName,
                        role: role,
                        phone: phone,
                        whatsapp: phone.replace(/[^0-9]/g, ''),
                        email: email,
                        city: city,
                        state: state,
                        segment: segment,
                        source: "Meta Ads",
                        stage: "Contato",
                        owner: "admin@vellia.com",
                        interactions: [
                            {
                                id: `int_meta_${Date.now()}`,
                                type: "Observação",
                                description: fetchError 
                                    ? `Lead gerado via webhook do Meta Ads. Detalhes: ${fetchError}` 
                                    : `Lead recebido e integrado via Meta Ads (Form ID: ${formId || 'N/A'}, Ad ID: ${adId || 'N/A'}, Campanha ID: ${campaignId || 'N/A'}).`,
                                timestamp: new Date().toISOString(),
                                userEmail: "sistema@vellia.com"
                            }
                        ],
                        stageHistory: [
                            {
                                stage: "Contato",
                                userEmail: "sistema@vellia.com",
                                timestamp: new Date().toISOString(),
                                reason: "Lead importado automaticamente via Webhook Meta Ads."
                            }
                        ]
                    };

                    // Salvar no Supabase comercial_leads
                    try {
                        const insertLeadRes = await fetch(`${sbUrl}/rest/v1/comercial_leads`, {
                            method: "POST",
                            headers: {
                                "apikey": sbKey,
                                "Authorization": `Bearer ${sbKey}`,
                                "Content-Type": "application/json",
                                "Prefer": "resolution=merge-duplicates"
                            },
                            body: JSON.stringify(newLead)
                        });

                        if (!insertLeadRes.ok) {
                            console.error("Erro ao salvar lead no Supabase:", insertLeadRes.statusText);
                        }

                        // Registrar Log de Auditoria no Supabase
                        const newLog = {
                            id: `log_${Date.now()}_meta`,
                            timestamp: new Date().toISOString(),
                            userEmail: "sistema@vellia.com",
                            action: "LEAD_RECEIVED",
                            details: `Lead recebido via Meta Ads: ${company} (${contactName})` + (fetchError && fetchError.includes("simulação") ? ` (Simulado)` : ``),
                            status: "SUCCESS"
                        };

                        await fetch(`${sbUrl}/rest/v1/comercial_logs`, {
                            method: "POST",
                            headers: {
                                "apikey": sbKey,
                                "Authorization": `Bearer ${sbKey}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(newLog)
                        });
                    } catch (err) {
                        console.error("Erro na comunicação com o Supabase:", err);
                    }
                }
            }

            return res.status(200).send('EVENT_RECEIVED');
        } else {
            return res.status(404).end();
        }
    }

    return res.status(405).json({ error: 'Método não permitido.' });
}
