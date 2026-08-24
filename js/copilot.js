import { Store } from "./store.js";
import { Auth } from "./auth.js";

export const Copilot = {
    triggerBtn: null,
    chatPanel: null,
    history: null,
    input: null,
    sendBtn: null,
    isOpen: false,
    isTyping: false,

    init() {
        this.triggerBtn = document.getElementById("ai-copilot-trigger");
        this.chatPanel = document.getElementById("ai-copilot-chat-panel");
        this.history = document.getElementById("copilot-chat-history");
        this.input = document.getElementById("copilot-chat-input");
        this.sendBtn = document.getElementById("btn-send-copilot-msg");

        if (!this.triggerBtn || !this.chatPanel) return;

        this.bindEvents();
        this.updateVisibility();

        // Escutar mudança de tela e cliques globais para ajustar visibilidade
        window.addEventListener("hashchange", () => this.updateVisibility());
        
        // Polling curto inicial para caso carregue logado
        setTimeout(() => this.updateVisibility(), 300);
    },

    updateVisibility() {
        const user = Auth.getCurrentUser();
        if (user) {
            this.triggerBtn.style.display = "block";
        } else {
            this.triggerBtn.style.display = "none";
            this.closeChat();
        }
    },

    bindEvents() {
        const openBtn = document.getElementById("btn-open-copilot");
        const closeBtn = document.getElementById("btn-close-copilot");

        if (openBtn) {
            openBtn.addEventListener("click", () => this.toggleChat());
        }
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.closeChat());
        }

        if (this.sendBtn) {
            this.sendBtn.addEventListener("click", () => this.handleSend());
        }
        if (this.input) {
            this.input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.handleSend();
            });
        }

        // Registrar ações rápidas das pílulas de sugestão
        document.querySelectorAll(".copilot-pill").forEach(pill => {
            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                const text = pill.getAttribute("data-prompt");
                if (text) {
                    this.input.value = text;
                    this.handleSend();
                }
            });
        });
    },

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    },

    openChat() {
        this.isOpen = true;
        this.chatPanel.style.display = "flex";
        requestAnimationFrame(() => {
            this.chatPanel.style.opacity = "1";
            this.chatPanel.style.transform = "translateY(0)";
        });
        if (this.input) this.input.focus();
    },

    closeChat() {
        this.isOpen = false;
        this.chatPanel.style.opacity = "0";
        this.chatPanel.style.transform = "translateY(20px)";
        setTimeout(() => {
            if (!this.isOpen) this.chatPanel.style.display = "none";
        }, 300);
    },

    appendMessage(text, isUser = false) {
        if (!this.history) return;

        const msgDiv = document.createElement("div");
        msgDiv.className = `copilot-msg ${isUser ? 'user' : 'assistant'}`;

        const avatar = isUser ? "👤" : "✨";

        // Formatação simples de negrito e quebras de linha
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        msgDiv.innerHTML = `
            <div class="copilot-msg-avatar">${avatar}</div>
            <div class="copilot-msg-bubble">${formattedText}</div>
        `;

        this.history.appendChild(msgDiv);
        this.history.scrollTop = this.history.scrollHeight;
    },

    showTypingSkeleton() {
        if (!this.history || this.isTyping) return;
        this.isTyping = true;

        const skeleton = document.createElement("div");
        skeleton.id = "copilot-typing-skeleton";
        skeleton.className = "copilot-msg assistant";

        skeleton.innerHTML = `
            <div class="copilot-msg-avatar">✨</div>
            <div class="copilot-msg-bubble" style="display: inline-flex; align-items: center; gap: 6px; padding: 12px 18px;">
                <span style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; display: inline-block; animation: copilot-pulse 0.8s infinite alternate;"></span>
                <span style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; display: inline-block; animation: copilot-pulse 0.8s infinite alternate 0.2s;"></span>
                <span style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; display: inline-block; animation: copilot-pulse 0.8s infinite alternate 0.4s;"></span>
            </div>
        `;

        if (!document.getElementById("copilot-pulse-style")) {
            const style = document.createElement("style");
            style.id = "copilot-pulse-style";
            style.innerHTML = `
                @keyframes copilot-pulse {
                    from { opacity: 0.3; transform: translateY(0); }
                    to { opacity: 1; transform: translateY(-3px); }
                }
            `;
            document.head.appendChild(style);
        }

        this.history.appendChild(skeleton);
        this.history.scrollTop = this.history.scrollHeight;
    },

    removeTypingSkeleton() {
        const skeleton = document.getElementById("copilot-typing-skeleton");
        if (skeleton) {
            skeleton.remove();
        }
        this.isTyping = false;
    },

    async handleSend() {
        if (!this.input || this.isTyping) return;
        const query = this.input.value.trim();
        if (!query) return;

        this.input.value = "";
        this.appendMessage(query, true);

        this.showTypingSkeleton();

        try {
            // Obter dados dinâmicos do funil CRM para alimentar o contexto
            const leads = Store.getLeads().map(l => ({
                empresa: l.company,
                contato: l.contact,
                etapa: l.stage,
                valorEstimado: l.estimatedValue,
                pontuacaoIA: l.aiScore,
                segmento: l.segment,
                responsavel: l.owner
            }));

            const proposals = Store.getProposals().map(p => ({
                empresa: p.company,
                titulo: p.title,
                valor: p.value,
                status: p.status
            }));

            const currentUser = Auth.getCurrentUser();

            const promptPayload = `
Você é o Vellia Copiloto, o assistente pessoal de inteligência artificial do Vellia CRM.
Seu objetivo é ajudar corretores, vendedores e gerentes a vender mais e melhor.

Aqui estão os dados comerciais ativos do CRM de hoje:
- LEADS ATIVOS:
${JSON.stringify(leads, null, 2)}

- PROPOSTAS COMERCIAIS ATIVAS:
${JSON.stringify(proposals, null, 2)}

O usuário que está falando com você é o "${currentUser?.name}" com o cargo de "${currentUser?.role}".

Instruções importantes para suas respostas:
1. Responda à pergunta do usuário utilizando os dados do CRM fornecidos acima. Seja direto, prático, estratégico e focado em vendas.
2. Utilize marcadores ou tópicos com negrito para organizar a resposta de forma muito bonita e profissional.
3. Se o usuário perguntar sobre leads frios, recomende ações práticas com base nos dados.
4. Mantenha um tom amigável e motivador.

Pergunta: "${query}"
`;

            let res;
            const userApiKey = localStorage.getItem("vellia_gemini_api_key") || localStorage.getItem("gemini_api_key");

            if (userApiKey && userApiKey.trim()) {
                // Se o usuário possui chave API configurada no localStorage, chama o Gemini 2.5 Flash diretamente
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
                res = await fetch(directUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptPayload }] }]
                    })
                });
            } else {
                // Tenta pelo proxy serverless do Vercel
                res = await fetch("/api/gemini-proxy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "gemini-2.5-flash",
                        contents: [
                            { parts: [{ text: promptPayload }] }
                        ]
                    })
                });
            }

            this.removeTypingSkeleton();

            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui gerar a resposta.";
                this.appendMessage(text, false);
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error("Erro na resposta Gemini:", errorData);
                this.appendMessage("⚠️ **Falha na conexão com Gemini 2.5 Flash**\n\nPor favor, cadastre sua Chave de API do Gemini na aba **Integrações** (ou configure a variável `GEMINI_API_KEY` na Vercel) para ativar o Copiloto em tempo real.", false);
            }
        } catch (e) {
            console.error("Erro ao enviar mensagem para o Copiloto:", e);
            this.removeTypingSkeleton();
            this.appendMessage("Erro de conexão. Verifique sua rede ou cadastre sua Chave de API na aba Integrações.", false);
        }
    }
};
