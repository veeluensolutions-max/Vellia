// Vercel Serverless Function
// Rota: POST /api/meta-webhook

export default async function handler(req, res) {
    if (req.method === 'GET') {
        // Validação do Webhook (Meta exige que você responda ao challenge hub.challenge)
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'vellia-crm-token-123';

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
            body.entry.forEach(function(entry) {
                const webhook_event = entry.messaging ? entry.messaging[0] : entry.changes[0];
                console.log('Evento do Webhook:', webhook_event);
                
                // Em um cenário real, aqui nós faríamos uma requisição para a Graph API 
                // do Meta usando o leadgen_id para pegar os dados do formulário preenchido
                // (Nome, Email, Telefone) e depois salvaríamos no Banco de Dados.
            });

            return res.status(200).send('EVENT_RECEIVED');
        } else {
            return res.status(404).end();
        }
    }

    return res.status(405).json({ error: 'Método não permitido.' });
}
