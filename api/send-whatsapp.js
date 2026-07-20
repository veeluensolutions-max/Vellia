// Vercel Serverless Function
// Rota: POST /api/send-whatsapp

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        const { phone, message, config } = req.body || {};

        if (!phone || !message) {
            return res.status(400).json({ error: 'Parâmetros "phone" e "message" são obrigatórios.' });
        }

        // Sanitizar telefone (apenas números, garante formato E.164 com código de país)
        let cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanPhone.length === 10 || cleanPhone.length === 11) {
            cleanPhone = '55' + cleanPhone;
        }

        const waConfig = config || {};
        const metaToken = process.env.META_ACCESS_TOKEN || waConfig.metaToken;
        const metaPhoneId = process.env.META_PHONE_ID || waConfig.metaPhoneId;

        // 1. Tentar disparo via Meta WhatsApp Cloud API (Graph API Official)
        if (metaPhoneId && metaToken) {
            console.log(`[WhatsApp API] Enviando via Meta Cloud API para ${cleanPhone}...`);
            const graphUrl = `https://graph.facebook.com/v20.0/${metaPhoneId}/messages`;
            const graphRes = await fetch(graphUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${metaToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: cleanPhone,
                    type: "text",
                    text: { body: message }
                })
            });

            if (graphRes.ok) {
                const data = await graphRes.json();
                return res.status(200).json({
                    success: true,
                    provider: "Meta WhatsApp Cloud API",
                    messageId: data.messages?.[0]?.id || `meta_${Date.now()}`,
                    recipient: cleanPhone
                });
            } else {
                const errText = await graphRes.text();
                console.error("[WhatsApp API] Erro na Meta Graph API:", errText);
            }
        }

        // 2. Tentar disparo via Gateway (Z-API ou Evolution)
        if (waConfig.apiUrl && waConfig.instanceId && waConfig.token) {
            console.log(`[WhatsApp API] Enviando via Gateway (${waConfig.instanceId}) para ${cleanPhone}...`);
            let endpoint = `${waConfig.apiUrl.replace(/\/$/, '')}/send-text`;
            if (waConfig.apiUrl.includes('z-api.io')) {
                endpoint = `${waConfig.apiUrl.replace(/\/$/, '')}/instances/${waConfig.instanceId}/token/${waConfig.token}/send-text`;
            }

            const gatewayRes = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Client-Token": waConfig.token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    phone: cleanPhone,
                    message: message
                })
            });

            if (gatewayRes.ok) {
                const data = await gatewayRes.json();
                return res.status(200).json({
                    success: true,
                    provider: "WhatsApp Gateway (Z-API)",
                    messageId: data.messageId || data.id || `gw_${Date.now()}`,
                    recipient: cleanPhone
                });
            } else {
                const errText = await gatewayRes.text();
                console.error("[WhatsApp API] Erro no Gateway:", errText);
            }
        }

        // 3. Fallback: Retornar instrução para abrir via Deep Link Nativo no Cliente
        return res.status(200).json({
            success: true,
            provider: "Deep Link Nativo",
            recipient: cleanPhone,
            deepLink: `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`,
            message: "Nenhuma API de gateway configurada no servidor. Redirecionando para envio direto no aplicativo do WhatsApp."
        });

    } catch (err) {
        console.error("Erro interno no endpoint de WhatsApp:", err);
        return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
    }
}
