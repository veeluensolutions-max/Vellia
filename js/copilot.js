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
        msgDiv.style.display = "flex";
        msgDiv.style.alignItems = "flex-start";
        msgDiv.style.gap = "8px";
        msgDiv.style.maxWidth = "85%";
        
        if (isUser) {
            msgDiv.style.alignSelf = "flex-end";
            msgDiv.style.flexDirection = "row-reverse";
        } else {
            msgDiv.style.alignSelf = "flex-start";
        }

        const avatar = isUser ? "👤" : "🤖";
        const avatarBg = isUser ? "rgba(255, 255, 255, 0.1)" : "rgba(99, 102, 241, 0.15)";
        const avatarColor = isUser ? "#cbd5e1" : "#8b5cf6";
        const avatarBorder = isUser ? "rgba(255, 255, 255, 0.15)" : "rgba(139, 92, 246, 0.2)";

        const bubbleBg = isUser ? "linear-gradient(135deg, var(--primary), #8b5cf6)" : "rgba(30, 41, 59, 0.8)";
        const bubbleBorder = isUser ? "none" : "1px solid rgba(255, 255, 255, 0.05)";
        const bubbleColor = isUser ? "#ffffff" : "#e2e8f0";
        const borderRadius = isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px";

        msgDiv.innerHTML = `
            <div style="background: ${avatarBg}; color: ${avatarColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; border: 1px solid ${avatarBorder};">${avatar}</div>
            <div style="background: ${bubbleBg}; border: ${bubbleBorder}; border-radius: ${borderRadius}; padding: 10px 14px; font-size: 12px; color: ${bubbleColor}; line-height: 1.5; text-align: left; word-break: break-word; font-family: system-ui, sans-serif;">
                ${text.replace(/\n/g, '<br>')}
            </div>
        `;

        this.history.appendChild(msgDiv);
        this.history.scrollTop = this.history.scrollHeight;
    },

    showTypingSkeleton() {
        if (!this.history || this.isTyping) return;
        this.isTyping = true;

        const skeleton = document.createElement("div");
        skeleton.id = "copilot-typing-skeleton";
        skeleton.style.display = "flex";
        skeleton.style.alignItems = "flex-start";
        skeleton.style.gap = "8px";
        skeleton.style.maxWidth = "85%";
        skeleton.style.alignSelf = "flex-start";

        skeleton.innerHTML = `
            <div style="background: rgba(99, 102, 241, 0.15); color: #8b5cf6; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; border: 1px solid rgba(139, 92, 246, 0.2);">🤖</div>
            <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 4px 14px 14px 14px; padding: 10px 14px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; display: inline-block; animation: copilot-pulse 1s infinite alternate;"></span>
                <span style="width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; display: inline-block; animation: copilot-pulse 1s infinite alternate 0.25s;"></span>
                <span style="width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; display: inline-block; animation: copilot-pulse 1s infinite alternate 0.5s;"></span>
            </div>
        `;

        // Injetar folha de estilo para animação se necessário
        if (!document.getElementById("copilot-pulse-style")) {
            const style = document.createElement("style");
            style.id = "copilot-pulse-style";
            style.innerHTML = `
                @keyframes copilot-pulse {
                    from { opacity: 0.35; transform: translateY(0); }
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

            const res = await fetch("/api/gemini-proxy", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: promptPayload,
                    systemInstruction: "Você é o Vellia Copiloto, assistente comercial de IA especialista do Vellia CRM."
                })
            });

            this.removeTypingSkeleton();

            if (res.ok) {
                const data = await res.json();
                const text = data.text || "Desculpe, não consegui gerar a resposta.";
                this.appendMessage(text, false);
            } else {
                this.appendMessage("Houve uma falha ao comunicar com a IA do Gemini. Verifique os logs e tente novamente.", false);
            }
        } catch (e) {
            console.error("Erro ao enviar mensagem para o Copiloto:", e);
            this.removeTypingSkeleton();
            this.appendMessage("Erro de conexão. Verifique sua rede ou o servidor e tente novamente.", false);
        }
    }
};
