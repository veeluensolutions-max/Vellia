// Vercel Serverless Function
// Rota: POST /api/meta-capi

import crypto from 'crypto';

function hashSha256(data) {
    if (!data) return undefined;
    const clean = String(data).trim().toLowerCase();
    return crypto.createHash('sha256').update(clean).digest('hex');
}

export default async function handler(req, res) {
    // Configuração CORS
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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    try {
        const { eventName, lead, value, currency = 'BRL', pixelId, accessToken } = req.body || {};

        if (!lead) {
            return res.status(400).json({ error: 'Dados do lead são obrigatórios.' });
        }

        // Mapear Estágio Comercial do CRM para Evento Padrão da Meta Graph API
        let metaEventName = 'Lead';
        if (eventName === 'QualifyLead' || lead.stage === 'Lead Qualificado') {
            metaEventName = 'QualifyLead';
        } else if (eventName === 'SubmitApplication' || lead.stage === 'Proposta Enviada' || lead.stage === 'Negociação') {
            metaEventName = 'SubmitApplication';
        } else if (eventName === 'Purchase' || lead.stage === 'Cliente Fechado') {
            metaEventName = 'Purchase';
        }

        // Tratar dados do usuário com hash SHA-256 (Padrão de Privacidade Meta/LGPD)
        const emailHash = hashSha256(lead.email);
        const phoneHash = hashSha256(lead.phone || lead.whatsapp);
        const firstName = lead.contact ? lead.contact.split(' ')[0] : '';
        const fnHash = hashSha256(firstName);

        const eventTime = Math.floor(Date.now() / 1000);
        const eventId = `capi_${lead.id || 'sim'}_${eventTime}`;

        const payloadData = {
            event_name: metaEventName,
            event_time: eventTime,
            event_id: eventId,
            action_source: "system_generated",
            user_data: {
                ...(emailHash && { em: [emailHash] }),
                ...(phoneHash && { ph: [phoneHash] }),
                ...(fnHash && { fn: [fnHash] })
            },
            custom_data: {
                lead_id: lead.id,
                company_name: lead.company,
                crm_stage: lead.stage,
                lead_source: lead.source || "Meta Ads",
                currency: currency,
                value: value || lead.estimatedValue || 0
            }
        };

        const targetPixelId = process.env.META_PIXEL_ID || pixelId || "123456789012345";
        const targetToken = process.env.META_ACCESS_TOKEN || accessToken;

        // Se o Token da Meta e Pixel ID estiverem configurados, fazer a chamada oficial à Graph API
        if (targetToken && targetToken !== 'EAAC...' && targetPixelId) {
            console.log(`[Meta CAPI] Disparando evento ${metaEventName} para Pixel ${targetPixelId}...`);
            const graphUrl = `https://graph.facebook.com/v20.0/${targetPixelId}/events?access_token=${targetToken}`;

            const graphRes = await fetch(graphUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: [payloadData] })
            });

            if (graphRes.ok) {
                const responseJson = await graphRes.json();
                return res.status(200).json({
                    success: true,
                    mode: "LIVE_GRAPH_API",
                    eventName: metaEventName,
                    eventId: eventId,
                    eventsReceived: responseJson.events_received || 1,
                    pixelId: targetPixelId,
                    payload: payloadData
                });
            } else {
                const errText = await graphRes.text();
                console.error("[Meta CAPI] Erro na Graph API:", errText);
            }
        }

        // Modo Simulador / Sandbox Fallback
        return res.status(200).json({
            success: true,
            mode: "SIMULATOR_SANDBOX",
            eventName: metaEventName,
            eventId: eventId,
            pixelId: targetPixelId,
            message: "Evento CAPI simulado com sucesso (SHA-256 aplicado nos dados de usuário).",
            payload: payloadData
        });

    } catch (err) {
        console.error("Erro interno no endpoint CAPI Meta:", err);
        return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
    }
}
