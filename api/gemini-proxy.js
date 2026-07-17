// api/gemini-proxy.js
// Serverless function - Proxy seguro para a API do Gemini
// A chave GEMINI_API_KEY fica salva nas variaveis de ambiente do Vercel (nunca exposta no codigo)

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on server.' });
    }

    try {
        const { model = 'gemini-2.5-flash', contents } = req.body;

        if (!contents) {
            return res.status(400).json({ error: 'Missing "contents" in request body.' });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await geminiRes.json();

        if (!geminiRes.ok) {
            return res.status(geminiRes.status).json({ error: data?.error || 'Gemini API error' });
        }

        return res.status(200).json(data);

    } catch (err) {
        console.error('[gemini-proxy] Error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
}
