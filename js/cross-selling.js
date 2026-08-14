import { Store } from "./store.js";
import { Proposals } from "./proposals.js";

export const CrossSelling = {
    // Matriz de recomendação: Se tem X, oferecer Y.
    matrix: {
        "Licenciamento Ambiental": [
            { suggest: "Monitoramento Ambiental", reason: "Licenças exigem relatórios periódicos de monitoramento." },
            { suggest: "Estudos Ambientais", reason: "Complementar à licença caso novos impactos sejam identificados." }
        ],
        "Monitoramento Ambiental": [
            { suggest: "ESG", reason: "Empresas com monitoramento maduro são ideais para iniciar práticas ESG." },
            { suggest: "Licenciamento Ambiental", reason: "Opcional caso haja ampliação da área monitorada." }
        ],
        "ESG": [
            { suggest: "Consultorias Técnicas", reason: "Para ajudar a bater as metas propostas no plano ESG." }
        ],
        "Estudos Ambientais": [
            { suggest: "Licenciamento Ambiental", reason: "Passo subsequente natural após a conclusão dos estudos prévios." }
        ],
        "NR-13": [
            { suggest: "Monitoramento Ambiental", reason: "Equipamentos auditados podem requerer monitoramento de emissões." }
        ],
        "Consultorias Técnicas": [
            { suggest: "ESG", reason: "Evolução natural do processo consultivo para métricas sustentáveis." },
            { suggest: "Licenciamento Ambiental", reason: "Adequação legal frequentemente requerida pós-consultoria." }
        ]
    },

    evaluateLead(leadId) {
        const section = document.getElementById("cross-selling-section");
        if (!section) return;

        const lead = Store.getLeadById(leadId);
        if (!lead) {
            section.style.display = "none";
            return;
        }

        // Recuperar contratos e propostas ganhas do lead
        const allContracts = Store.getAllContracts ? Store.getAllContracts() : [];
        const leadContracts = allContracts.filter(c => c.leadId === leadId);
        
        // Vamos analisar os serviços baseados nas vitórias registradas no CRM (propostas ganhas).
        // Se a store suportar getProposals...
        const allProposals = Store.getAllProposals ? Store.getAllProposals() : [];
        const leadProposals = allProposals.filter(p => p.leadId === leadId && p.status === "Ganha");

        // Compilar serviços já adquiridos
        const acquiredServices = new Set();
        
        // Tentamos puxar de propostas ganhas
        leadProposals.forEach(p => {
            if (p.service) acquiredServices.add(p.service);
        });

        // E também tentamos puxar dos contratos, se o contrato guardar qual foi o serviço
        // Na estrutura atual, o serviço é definido na proposta ou no contrato.
        // Se o histórico de lead contiver 'Ganhos' com descrição do serviço, também serve.
        
        // Se não tiver nenhum serviço adquirido, não tem cross-selling, e sim venda normal.
        if (acquiredServices.size === 0) {
            section.style.display = "none";
            return;
        }

        let suggestion = null;

        // Tentar encontrar uma sugestão baseada no que o cliente já possui
        for (const service of acquiredServices) {
            const recommendations = this.matrix[service];
            if (recommendations) {
                // Procurar a primeira recomendação que o cliente AINDA NÃO POSSUI
                for (const rec of recommendations) {
                    if (!acquiredServices.has(rec.suggest)) {
                        suggestion = rec;
                        break;
                    }
                }
            }
            if (suggestion) break; // achou uma sugestão válida
        }

        if (suggestion) {
            document.getElementById("cs-suggested-service").textContent = suggestion.suggest;
            document.getElementById("cs-suggestion-reason").textContent = suggestion.reason;
            section.style.display = "block";

            // Vincular evento de gerar nova proposta
            const btnGenerate = document.getElementById("btn-cs-generate-proposal");
            // Remover event listeners anteriores clonando o botão
            const newBtn = btnGenerate.cloneNode(true);
            btnGenerate.parentNode.replaceChild(newBtn, btnGenerate);

            newBtn.addEventListener("click", () => {
                // Abrir modal de proposta preenchido
                if (window.Proposals) {
                    window.location.hash = "#proposals";
                    setTimeout(() => {
                        Proposals.openModal(leadId, suggestion.suggest);
                    }, 300);
                }
            });
        } else {
            section.style.display = "none";
        }
    }
};
