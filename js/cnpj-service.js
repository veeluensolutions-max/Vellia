/**
 * Vellia CRM - CNPJ Enrichment Service
 * Integração resiliente com BrasilAPI, Minha Receita e ReceitaWS
 * Preenchimento inteligente e enriquecimento de dados de Leads B2B
 */

// Cache em memória para consultas na sessão atual (evita chamadas redundantes)
const cnpjCache = new Map();

export const CNPJService = {
    /**
     * Remove todos os caracteres não numéricos
     */
    cleanDigits(cnpj) {
        return (cnpj || "").toString().replace(/\D/g, "");
    },

    /**
     * Aplica máscara de CNPJ (00.000.000/0000-00)
     */
    formatCNPJ(value) {
        const digits = this.cleanDigits(value).slice(0, 14);
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
        if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
        if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
    },

    /**
     * Valida formato e dígitos verificadores do CNPJ
     */
    isValidCNPJ(cnpj) {
        const digits = this.cleanDigits(cnpj);
        if (digits.length !== 14) return false;
        if (/^(\d)\1+$/.test(digits)) return false;

        // Validação do 1º dígito
        let length = digits.length - 2;
        let numbers = digits.substring(0, length);
        let sum = 0;
        let pos = length - 7;
        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i), 10) * pos--;
            if (pos < 2) pos = 9;
        }
        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(length), 10)) return false;

        // Validação do 2º dígito
        length = length + 1;
        numbers = digits.substring(0, length);
        sum = 0;
        pos = length - 7;
        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i), 10) * pos--;
            if (pos < 2) pos = 9;
        }
        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return result === parseInt(digits.charAt(length), 10);
    },

    /**
     * Converte a descrição do CNAE ou Atividade Econômica para as opções de Segmento do CRM
     */
    mapCnaeToSegment(cnaeDesc = "") {
        const desc = (cnaeDesc || "").toLowerCase();

        if (desc.includes("software") || desc.includes("informática") || desc.includes("computador") || 
            desc.includes("tecnologia") || desc.includes("dados") || desc.includes("internet") || desc.includes("telecom")) {
            return "Tecnologia";
        }
        if (desc.includes("construção") || desc.includes("engenharia") || desc.includes("obras") || 
            desc.includes("edifícios") || desc.includes("incorporação") || desc.includes("reforma") || desc.includes("instalação")) {
            return "Construção Civil";
        }
        if (desc.includes("transporte") || desc.includes("carga") || desc.includes("logística") || 
            desc.includes("rodoviário") || desc.includes("frotas") || desc.includes("entregas") || desc.includes("armazém")) {
            return "Transportes";
        }
        if (desc.includes("médic") || desc.includes("hospital") || desc.includes("saúde") || 
            desc.includes("clínica") || desc.includes("odontol") || desc.includes("farmácia") || desc.includes("fisioter") || desc.includes("laborat")) {
            return "Saúde";
        }
        if (desc.includes("comércio") || desc.includes("varejo") || desc.includes("loja") || 
            desc.includes("mercado") || desc.includes("venda a varejo") || desc.includes("atacad") || desc.includes("distribui")) {
            return "Varejo";
        }
        if (desc.includes("indústria") || desc.includes("fabricação") || desc.includes("manufatura") || desc.includes("metalúrgica") || desc.includes("química")) {
            return "Indústria";
        }
        if (desc.includes("educação") || desc.includes("ensino") || desc.includes("escola") || desc.includes("treinamento") || desc.includes("curso")) {
            return "Educação";
        }
        if (desc.includes("alimento") || desc.includes("restaurante") || desc.includes("refeição") || desc.includes("bar") || desc.includes("bebida")) {
            return "Alimentação";
        }
        return "Outros";
    },

    /**
     * Consulta dados cadastrais completos da empresa com fallback automático
     */
    async fetchCompanyByCNPJ(cnpj) {
        const digits = this.cleanDigits(cnpj);
        if (digits.length !== 14) {
            throw new Error("CNPJ incompleto. O número deve ter exatamente 14 dígitos.");
        }

        // Verificar cache na sessão
        if (cnpjCache.has(digits)) {
            return cnpjCache.get(digits);
        }

        let rawData = null;
        let lastError = null;

        // Provedor 1: BrasilAPI
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });
            if (res.ok) {
                rawData = await res.json();
            } else if (res.status === 404) {
                throw new Error("CNPJ não encontrado na base de dados da Receita Federal.");
            }
        } catch (e) {
            lastError = e;
        }

        // Provedor 2 (Fallback): Minha Receita
        if (!rawData) {
            try {
                const res = await fetch(`https://minhareceita.org/${digits}`, {
                    method: "GET",
                    headers: { "Accept": "application/json" }
                });
                if (res.ok) {
                    rawData = await res.json();
                } else if (res.status === 404) {
                    throw new Error("CNPJ não encontrado na base de dados da Receita Federal.");
                }
            } catch (e) {
                lastError = e;
            }
        }

        if (!rawData) {
            throw new Error(lastError?.message || "Não foi possível consultar os dados do CNPJ no momento. Verifique sua conexão e tente novamente.");
        }

        // Extrair e normalizar dados
        const companyName = (rawData.nome_fantasia && rawData.nome_fantasia.trim() !== "") 
            ? rawData.nome_fantasia.trim() 
            : (rawData.razao_social || "");

        // Extrair contato prioritário a partir do Quadro de Sócios e Administradores (QSA)
        let primaryContact = "";
        let primaryRole = "Diretoria";

        if (Array.isArray(rawData.qsa) && rawData.qsa.length > 0) {
            const adminPartner = rawData.qsa.find(p => {
                const qual = (p.qualificacao_socio || p.qualificacao_do_responsavel || "").toLowerCase();
                return qual.includes("administrador") || qual.includes("diretor") || qual.includes("presidente") || qual.includes("sócio-administrador");
            }) || rawData.qsa[0];

            if (adminPartner && adminPartner.nome_socio) {
                primaryContact = this.formatName(adminPartner.nome_socio);
                primaryRole = adminPartner.qualificacao_socio || "Sócio / Administrador";
            }
        }

        // Telefones formatados
        let phone = "";
        if (rawData.ddd_telefone_1) {
            const rawPhone = rawData.ddd_telefone_1.replace(/\D/g, "");
            if (rawPhone.length === 10) {
                phone = `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 6)}-${rawPhone.slice(6)}`;
            } else if (rawPhone.length === 11) {
                phone = `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`;
            } else {
                phone = rawData.ddd_telefone_1;
            }
        }

        let phone2 = "";
        if (rawData.ddd_telefone_2) {
            const rawPhone2 = rawData.ddd_telefone_2.replace(/\D/g, "");
            if (rawPhone2.length === 10) {
                phone2 = `(${rawPhone2.slice(0, 2)}) ${rawPhone2.slice(2, 6)}-${rawPhone2.slice(6)}`;
            } else if (rawPhone2.length === 11) {
                phone2 = `(${rawPhone2.slice(0, 2)}) ${rawPhone2.slice(2, 7)}-${rawPhone2.slice(7)}`;
            } else {
                phone2 = rawData.ddd_telefone_2;
            }
        }

        const whatsapp = phone;

        // Endereço completo formatado
        const addressParts = [
            rawData.logradouro ? `${rawData.descricao_tipo_de_logradouro || ''} ${rawData.logradouro}`.trim() : '',
            rawData.numero ? `Nº ${rawData.numero}` : '',
            rawData.complemento ? `${rawData.complemento}` : '',
            rawData.bairro ? `Bairro: ${rawData.bairro}` : '',
            rawData.cep ? `CEP: ${rawData.cep}` : ''
        ].filter(Boolean).join(", ");

        // Capital social formatado
        let capitalSocialFormatted = "";
        if (rawData.capital_social) {
            capitalSocialFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rawData.capital_social);
        }

        const segment = this.mapCnaeToSegment(rawData.cnae_fiscal_descricao);

        const result = {
            cnpjFormatted: this.formatCNPJ(digits),
            cnpjRaw: digits,
            razaoSocial: rawData.razao_social || "",
            nomeFantasia: rawData.nome_fantasia || "",
            companyName: companyName,
            contactName: primaryContact,
            contactRole: primaryRole,
            email: (rawData.email || "").toLowerCase(),
            phone: phone,
            phone2: phone2,
            whatsapp: whatsapp,
            city: rawData.municipio || "",
            state: rawData.uf || "",
            cep: rawData.cep || "",
            address: addressParts,
            segment: segment,
            cnaeCode: rawData.cnae_fiscal,
            cnaeDescription: rawData.cnae_fiscal_descricao || "",
            situacaoCadastral: rawData.descricao_situacao_cadastral || "ATIVA",
            dataSituacao: rawData.data_situacao_cadastral || "",
            porte: rawData.porte || "",
            capitalSocial: capitalSocialFormatted,
            naturezaJuridica: rawData.natureza_juridica || "",
            simplesNacional: rawData.opcao_pelo_simples ? "Sim" : (rawData.opcao_pelo_simples === false ? "Não" : "N/A"),
            mei: rawData.opcao_pelo_mei ? "Sim" : "Não",
            qsa: rawData.qsa || []
        };

        // Salvar em cache
        cnpjCache.set(digits, result);

        return result;
    },

    /**
     * Formata nomes próprios para Capital Case (ex: JOAO SILVA -> João Silva)
     */
    formatName(name) {
        if (!name) return "";
        return name
            .toLowerCase()
            .split(" ")
            .map(word => {
                if (["de", "da", "do", "das", "dos", "e"].includes(word)) return word;
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(" ");
    }
};

// Tornar disponível globalmente
if (typeof window !== "undefined") {
    window.CNPJService = CNPJService;
}
