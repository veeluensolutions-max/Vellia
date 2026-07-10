export default async function handler(req, res) {
    // Apenas aceita requisições POST ou GET (para verificação do Facebook)
    if (req.method === 'GET') {
        // Validação de Webhook do Facebook (Hub Challenge)
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            // Em produção, o token de verificação seria checado com uma variável de ambiente
            if (mode === 'subscribe' /* && token === process.env.FB_VERIFY_TOKEN */) {
                return res.status(200).send(challenge);
            } else {
                return res.status(403).json({ error: 'Token de verificação inválido' });
            }
        }
        return res.status(200).json({ status: 'API Vellia CRM Online' });
    }

    if (req.method === 'POST') {
        try {
            const body = req.body;
            console.log("Recebido Webhook do Meta Ads:", JSON.stringify(body));
            
            // Aqui entra a lógica de salvar no Banco de Dados.
            // Ex: const { data, error } = await supabase.from('leads').insert([{ nome, email, telefone }])
            
            return res.status(200).json({ success: true, message: 'Evento recebido com sucesso' });
        } catch (error) {
            console.error("Erro ao processar Webhook:", error);
            return res.status(500).json({ error: 'Erro interno no processamento' });
        }
    }

    res.status(405).json({ error: 'Método não permitido' });
}
