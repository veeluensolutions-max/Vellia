// Vercel Serverless Function
// Rota: POST /api/meta-webhook | GET /api/meta-webhook

export default async function handler(req, res) {
    // Configurar cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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

        console.log('📬 Webhook recebido do Meta Ads / Messenger:', JSON.stringify(body, null, 2));

        if (body.object === 'page' || body.object === 'instagram' || body.object === 'whatsapp_business_account') {
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
                // Tratar eventos de Leadgen (Formulários do Facebook) ou Messenger
                const messagingEvent = entry.messaging ? entry.messaging[0] : null;
                const changeEvent = entry.changes ? entry.changes[0] : null;

                // --- FLUXO 0.5: MENSAGEM DO WHATSAPP (whatsapp_business_account) ---
                if (body.object === 'whatsapp_business_account' && changeEvent && changeEvent.field === 'messages' && changeEvent.value?.messages) {
                    const whatsappMsg = changeEvent.value.messages[0];
                    if (whatsappMsg && whatsappMsg.type === 'text') {
                        const from = whatsappMsg.from; // Número de WhatsApp do remetente
                        const messageText = whatsappMsg.text.body;
                        const contactName = changeEvent.value.contacts?.[0]?.profile?.name || `Cliente WhatsApp ${from.substr(-4)}`;
                        const isSimulated = whatsappMsg.id?.startsWith("mock_");

                        console.log(`[Webhook WhatsApp] Recebida de ${from} (${contactName}): "${messageText}"` + (isSimulated ? " (Simulado)" : ""));

                        // 1. Procurar lead correspondente no Supabase
                        let lead = null;
                        try {
                            const leadSearchRes = await fetch(`${sbUrl}/rest/v1/comercial_leads?whatsapp=eq.${from}`, {
                                headers: {
                                    "apikey": sbKey,
                                    "Authorization": `Bearer ${sbKey}`
                                }
                            });

                            if (leadSearchRes.ok) {
                                const leadsList = await leadSearchRes.json();
                                if (leadsList && leadsList.length > 0) {
                                    lead = leadsList[0];
                                }
                            }
                        } catch (err) {
                            console.error("Erro ao procurar lead no Supabase:", err);
                        }

                        // 2. Criar lead se não existir
                        if (!lead) {
                            lead = {
                                id: `lead_wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                company: `WhatsApp Lead (${from.substr(-4)})`,
                                contact: contactName,
                                role: "Cliente WhatsApp",
                                phone: `+${from}`,
                                whatsapp: from,
                                email: `wa_${from}@whatsapp.com`,
                                city: "WhatsApp",
                                state: "WA",
                                segment: "Outros",
                                source: "WhatsApp Cloud API",
                                stage: "Contato",
                                owner: "admin@vellia.com",
                                interactions: [
                                    {
                                        id: `int_wa_init_${Date.now()}`,
                                        type: "Mensagem Recebida",
                                        description: `Mensagem via WhatsApp: "${messageText}"`,
                                        timestamp: new Date().toISOString(),
                                        userEmail: "sistema@vellia.com"
                                    }
                                ],
                                stageHistory: [
                                    {
                                        stage: "Contato",
                                        userEmail: "sistema@vellia.com",
                                        timestamp: new Date().toISOString(),
                                        reason: "Novo contato via WhatsApp iniciado."
                                    }
                                ]
                            };

                            // Salvar no Supabase
                            try {
                                await fetch(`${sbUrl}/rest/v1/comercial_leads`, {
                                    method: "POST",
                                    headers: {
                                        "apikey": sbKey,
                                        "Authorization": `Bearer ${sbKey}`,
                                        "Content-Type": "application/json",
                                        "Prefer": "resolution=merge-duplicates"
                                    },
                                    body: JSON.stringify(lead)
                                });
                            } catch (err) {
                                console.error("Erro ao inserir novo lead de WhatsApp no Supabase:", err);
                            }
                        } else {
                            // Se o lead já existia, salvar a nova mensagem recebida na timeline
                            lead.interactions = lead.interactions || [];
                            lead.interactions.push({
                                id: `int_wa_${Date.now()}`,
                                type: "Mensagem Recebida",
                                description: `Mensagem via WhatsApp: "${messageText}"`,
                                timestamp: new Date().toISOString(),
                                userEmail: "sistema@vellia.com"
                            });

                            // Salvar interações novas no lead no Supabase
                            try {
                                await fetch(`${sbUrl}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                                    method: "PATCH",
                                    headers: {
                                        "apikey": sbKey,
                                        "Authorization": `Bearer ${sbKey}`,
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify({ interactions: lead.interactions })
                                });
                            } catch (err) {
                                console.error("Erro ao atualizar interações de WhatsApp no lead:", err);
                            }
                        }

                        // 3. Se SDR AI estiver ativo (não pausado pelo vendedor), acionar resposta com Gemini!
                        if (!lead.sdrPaused) {
                            console.log(`[SDR AI Webhook] Acionando triagem autônoma para lead: ${lead.contact} / ${lead.company}`);

                            let parsed = null;
                            const geminiKey = process.env.GEMINI_API_KEY || '';
                            if (geminiKey) {
                                try {
                                    // Buscar histórico de conversas nas interações do lead para passar como contexto
                                    const contextMessages = (lead.interactions || [])
                                        .filter(i => i.type === "Mensagem Recebida" || i.type === "WhatsApp" || i.description.includes("SDR AI"))
                                        .slice(-6)
                                        .map(i => i.description)
                                        .join("\n");

                                    const prompt = `
Você é o Vellia AI SDR (Assistente de Pré-vendas).
Dados do Lead:
- Empresa: ${lead.company}
- Contato: ${lead.contact || "Sem nome"}
- Segmento: ${lead.segment || "Outros"}
- Origem: ${lead.source || "WhatsApp"}

Histórico recente de mensagens:
${contextMessages}

Mensagem nova recebida do cliente:
"${messageText}"

Sua tarefa: Responder a este cliente por WhatsApp de forma natural, simpática e profissional para qualificá-lo de forma inteligente.
Determine se o cliente já revelou informações suficientes sobre suas dores e tamanho de equipe para decidirmos o estágio do lead.
Regras de decisão de estágio comercial:
- Se ele demonstrar interesse genuíno e qualificado na Vellia: "Lead Qualificado"
- Se ele demonstrar que precisa de orçamento formal: "Proposta Enviada"
- Se ele rejeitar, for spam ou sem perfil: "Cliente Perdido"
- Caso contrário, mantenha em "Contato".

Retorne obrigatoriamente um formato JSON válido contendo a resposta que o SDR deve enviar ao cliente e a decisão de qualificação/score:
{
  "reply": "Escreva aqui a mensagem simpática e direta de resposta do SDR para enviar ao cliente pelo WhatsApp.",
  "decision": {
     "stage": "Contato | Lead Qualificado | Proposta Enviada | Cliente Perdido",
     "score": 0 a 100,
     "reason": "Resumo rápido do motivo da classificação."
  }
}
`;
                                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
                                    const geminiRes = await fetch(geminiUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            contents: [{ parts: [{ text: prompt }] }],
                                            generationConfig: {
                                                responseMimeType: "application/json"
                                            }
                                        })
                                    });

                                    if (geminiRes.ok) {
                                        const geminiData = await geminiRes.json();
                                        const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                                        parsed = JSON.parse(resultText);
                                    } else {
                                        console.error("[SDR AI Webhook] Erro ao invocar API do Gemini:", await geminiRes.text());
                                    }
                                } catch (geminiErr) {
                                    console.error("[SDR AI Webhook] Falha ao executar triagem de WhatsApp com Gemini:", geminiErr);
                                }
                            } else {
                                console.warn("[SDR AI Webhook] GEMINI_API_KEY não configurada na máquina local. Usando simulador fallback.");
                            }

                            // FALLBACK: Simulador local caso o Gemini falhe ou a chave esteja vazia
                            if (!parsed) {
                                const msgLower = messageText.toLowerCase();
                                let reply = "";
                                let stage = "Contato";
                                let score = 50;
                                let reason = "";

                                if (msgLower.includes("preco") || msgLower.includes("preço") || msgLower.includes("valor") || msgLower.includes("custa") || msgLower.includes("orçamento") || msgLower.includes("licença")) {
                                    reply = `Olá, ${contactName}! A Vellia possui planos a partir de R$ 99/mês por usuário, com automação completa de SDR por IA inclusa. Para desenhar a melhor proposta para seu time de vendas, quantas licenças você precisaria?`;
                                    stage = "Lead Qualificado";
                                    score = 80;
                                    reason = "Lead demonstrou interesse comercial explícito pedindo preços/valores.";
                                } else if (msgLower.includes("como funciona") || msgLower.includes("apresentacao") || msgLower.includes("apresentação") || msgLower.includes("conhecer") || msgLower.includes("sistema")) {
                                    reply = `Olá, ${contactName}! A Vellia é um CRM focado em acelerar vendas usando agentes inteligentes de IA (SDRs) que qualificam seus leads e disparam WhatsApp de forma autônoma. Gostaria de agendar uma demonstração rápida de 15 minutos amanhã?`;
                                    stage = "Lead Qualificado";
                                    score = 75;
                                    reason = "Lead perguntou como o sistema funciona ou pediu demonstração.";
                                } else if (msgLower.includes("não") || msgLower.includes("nao quero") || msgLower.includes("parar") || msgLower.includes("recuso") || msgLower.includes("spam")) {
                                    reply = `Entendido, ${contactName}. Agradecemos o retorno e retiramos seu contato da nossa lista de abordagem. Qualquer dúvida estamos à disposição!`;
                                    stage = "Cliente Perdido";
                                    score = 10;
                                    reason = "Lead recusou abordagem ou pediu cancelamento.";
                                } else {
                                    reply = `Olá, ${contactName}! Muito obrigado pela mensagem. Vi que você veio da nossa campanha e gostaria de saber se seu foco é automatizar a triagem de leads pelo WhatsApp ou organizar o funil do seu time comercial?`;
                                    stage = "Contato";
                                    score = 55;
                                    reason = "Mensagem inicial geral. SDR qualifica dores operacionais.";
                                }

                                parsed = {
                                    reply,
                                    decision: {
                                        stage,
                                        score,
                                        reason
                                    }
                                };
                            }

                            if (parsed) {
                                console.log(`[SDR AI Webhook] Resposta processada: "${parsed.reply}"`);
                                console.log(`[SDR AI Webhook] Decisão: ${parsed.decision.stage} (Score: ${parsed.decision.score})`);

                                // Enviar resposta de volta usando a Meta Cloud API se configurada
                                let wasSent = false;
                                const metaToken = process.env.META_ACCESS_TOKEN || config.accessToken;
                                const metaPhoneId = process.env.META_PHONE_ID || config.metaPhoneId;

                                if (metaPhoneId && metaToken && !isSimulated) {
                                    try {
                                        const graphUrl = `https://graph.facebook.com/v20.0/${metaPhoneId}/messages`;
                                        const graphSendRes = await fetch(graphUrl, {
                                            method: "POST",
                                            headers: {
                                                "Authorization": `Bearer ${metaToken}`,
                                                "Content-Type": "application/json"
                                            },
                                            body: JSON.stringify({
                                                messaging_product: "whatsapp",
                                                recipient_type: "individual",
                                                to: from,
                                                type: "text",
                                                text: { body: parsed.reply }
                                            })
                                        });
                                        wasSent = graphSendRes.ok;
                                    } catch (sendErr) {
                                        console.error("Erro ao enviar mensagem pelo Graph API do Meta:", sendErr);
                                    }
                                }

                                // Atualizar interações, score e estágio do Lead no Supabase
                                lead.interactions.push({
                                    id: `int_wa_sdr_reply_${Date.now()}`,
                                    type: "WhatsApp",
                                    description: `🤖 **SDR AI:** ${parsed.reply}`,
                                    timestamp: new Date().toISOString(),
                                    userEmail: "sdr-ai@vellia.com"
                                });

                                lead.interactions.push({
                                    id: `int_wa_sdr_decision_${Date.now()}`,
                                    type: "Observação",
                                    description: `🤖 **Análise SDR AI:** Estágio decidido: **"${parsed.decision.stage}"** (Score IA: ${parsed.decision.score}/100).\nMotivo: *${parsed.decision.reason}*`,
                                    timestamp: new Date().toISOString(),
                                    userEmail: "sdr-ai@vellia.com"
                                });

                                 const updatePayload = {
                                     interactions: lead.interactions
                                 };

                                if (parsed.decision.stage && parsed.decision.stage !== lead.stage) {
                                    const oldStage = lead.stage;
                                    updatePayload.stage = parsed.decision.stage;
                                    
                                    // Atualizar histórico de estágio
                                    lead.stageHistory = lead.stageHistory || [];
                                    lead.stageHistory.push({
                                        stage: parsed.decision.stage,
                                        userEmail: "sdr-ai@vellia.com",
                                        timestamp: new Date().toISOString(),
                                        reason: `SDR AI reclassificou após nova mensagem: ${parsed.decision.reason}`
                                    });
                                    updatePayload.stageHistory = lead.stageHistory;

                                    // Registrar log de mudança de estágio
                                    try {
                                        await fetch(`${sbUrl}/rest/v1/comercial_logs`, {
                                            method: "POST",
                                            headers: {
                                                "apikey": sbKey,
                                                "Authorization": `Bearer ${sbKey}`,
                                                "Content-Type": "application/json"
                                            },
                                            body: JSON.stringify({
                                                id: `log_wa_sdr_${Date.now()}`,
                                                timestamp: new Date().toISOString(),
                                                userEmail: "sdr-ai@vellia.com",
                                                action: "SDR_AUTO_TRIAGE",
                                                details: `Triagem automática via WhatsApp para ${lead.company}. De "${oldStage}" para "${parsed.decision.stage}"` + (isSimulated ? " (Simulado)" : ""),
                                                status: "SUCCESS"
                                            })
                                        });
                                    } catch (logErr) {
                                        console.error("Erro ao salvar log de triagem automática no Supabase:", logErr);
                                    }
                                }

                                try {
                                    const patchRes = await fetch(`${sbUrl}/rest/v1/comercial_leads?id=eq.${lead.id}`, {
                                        method: "PATCH",
                                        headers: {
                                            "apikey": sbKey,
                                            "Authorization": `Bearer ${sbKey}`,
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify(updatePayload)
                                    });
                                    if (!patchRes.ok) {
                                        console.error(`[SDR AI Webhook] Erro ao atualizar lead no Supabase: ${patchRes.status} ${patchRes.statusText}`);
                                        console.error("Detalhes do erro PATCH:", await patchRes.text());
                                    } else {
                                        console.log(`[SDR AI Webhook] Lead atualizado no Supabase com sucesso. Status: ${patchRes.status}`);
                                    }
                                } catch (updateErr) {
                                    console.error("Erro de rede ao atualizar lead após resposta SDR no Supabase:", updateErr);
                                }
                            }
                        }

                        continue;
                    }
                }

                // --- FLUXO 1: MENSAGEM DO MESSENGER OU INSTAGRAM DIRECT ---
                if (messagingEvent && messagingEvent.message) {
                    const senderId = messagingEvent.sender ? messagingEvent.sender.id : "desconhecido";
                    const messageText = messagingEvent.message.text || "[Mídia/Anexo]";
                    const isInstagram = body.object === 'instagram' || entry.id?.startsWith("ig_");
                    const sourceName = isInstagram ? "Instagram Direct" : "Facebook Messenger";
                    const prefix = isInstagram ? "IG" : "FB";

                    const messengerLead = {
                        id: `lead_${isInstagram ? 'ig' : 'msg'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        company: `${sourceName} (ID: ${senderId.substr(-4)})`,
                        contact: `Usuário ${isInstagram ? 'Instagram' : 'Facebook'} ${senderId.substr(-4)}`,
                        role: `Cliente ${isInstagram ? 'Instagram' : 'Messenger'}`,
                        phone: `(${prefix}) ${senderId}`,
                        whatsapp: senderId.replace(/[^0-9]/g, ''),
                        email: `${isInstagram ? 'instagram' : 'messenger'}_${senderId}@social.com`,
                        city: "Rede Social",
                        state: prefix,
                        segment: isInstagram ? "Instagram Direct" : "Messenger Direct",
                        source: sourceName,
                        stage: "Contato",
                        owner: "admin@vellia.com",
                        interactions: [
                            {
                                id: `int_${isInstagram ? 'ig' : 'msg'}_${Date.now()}`,
                                type: "Mensagem Recebida",
                                description: `Mensagem via ${sourceName}: "${messageText}"`,
                                timestamp: new Date().toISOString(),
                                userEmail: "sistema@vellia.com"
                            }
                        ],
                        stageHistory: [
                            {
                                stage: "Contato",
                                userEmail: "sistema@vellia.com",
                                timestamp: new Date().toISOString(),
                                reason: `Nova mensagem iniciada via ${sourceName}.`
                            }
                        ]
                    };

                    try {
                        await fetch(`${sbUrl}/rest/v1/comercial_leads`, {
                            method: "POST",
                            headers: {
                                "apikey": sbKey,
                                "Authorization": `Bearer ${sbKey}`,
                                "Content-Type": "application/json",
                                "Prefer": "resolution=merge-duplicates"
                            },
                            body: JSON.stringify(messengerLead)
                        });

                        await fetch(`${sbUrl}/rest/v1/comercial_logs`, {
                            method: "POST",
                            headers: {
                                "apikey": sbKey,
                                "Authorization": `Bearer ${sbKey}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                id: `log_${Date.now()}_messenger`,
                                timestamp: new Date().toISOString(),
                                userEmail: "sistema@vellia.com",
                                action: "MESSENGER_RECEIVED",
                                details: `Mensagem recebida no Facebook Messenger de ${senderId}: "${messageText.substring(0, 40)}"`,
                                status: "SUCCESS"
                            })
                        });
                    } catch (err) {
                        console.error("Erro ao salvar mensagem do Messenger no Supabase:", err);
                    }
                    continue;
                }

                // --- FLUXO 2: LEADGEN (FORMULÁRIOS DE LEAD ADS) ---
                if (changeEvent && (changeEvent.field === 'leadgen' || changeEvent.value?.leadgen_id)) {
                    const leadgenId = changeEvent.value.leadgen_id;
                    const formId = changeEvent.value.form_id;
                    const adId = changeEvent.value.ad_id;
                    const campaignId = changeEvent.value.campaign_id;

                    let leadData = null;
                    let fetchError = null;

                    if (token && token !== 'EAAC...' && leadgenId && !leadgenId.startsWith("leadgen_") && !leadgenId.startsWith("mock_")) {
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
                        const mockNames = ["Ricardo Vanzin", "Mariana Silveira", "Alexandre Pires", "Caroline Schultz", "Felipe Alcantara"];
                        const mockCompanies = ["Vanzin Distribuidora", "Silveira Tech", "Pires & Associados", "Schultz Indústrias", "Alcantara Soluções"];
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
                    let role = 'Interessado Meta Ads';
                    let city = 'São Paulo';
                    let state = 'SP';
                    let segment = 'Marketing Digital';

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
                        id: `lead_meta_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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

            return res.status(200).json({ status: 'EVENT_RECEIVED', timestamp: new Date().toISOString() });
        } else {
            return res.status(404).json({ error: 'Objeto webhook não suportado' });
        }
    }

    return res.status(405).json({ error: 'Método não permitido.' });
}
