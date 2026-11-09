/**
 * Vellia CRM — Base de Conhecimento & Treinamento de Serviços
 * Catálogo inteligente de soluções da Veeluen Solutions e Excelência Ambiental
 * para capacitação, argumentação de vendas, objeções e scripts práticos.
 */

import { Auth } from "./auth.js";
import { Toast } from "./toast.js";
import { Calculators } from "./calculators.js";

export const Learning = {
    _eventsBound: false,
    _activeCompany: "all",
    _activeCategory: "all",
    _searchQuery: "",
    _activeServiceId: null,

    services: [
        // =====================================================================
        // EXCELÊNCIA AMBIENTAL
        // =====================================================================
        {
            id: "srv_isocinetica",
            company: "Excelência Ambiental",
            category: "Laboratorial & Emissões",
            title: "Amostragem Isocinética de Chaminés (Emissões Atmosféricas)",
            badge: "Obrigatório por Lei",
            icon: "💨",
            color: "#059669",
            bgLight: "rgba(16, 185, 129, 0.12)",
            shortSummary: "Coleta e análise de poluentes em dutos e chaminés para atendimento às normas de controle de poluição do ar.",
            fullDescription: "A amostragem isocinética é o procedimento técnico normatizado para coletar e quantificar o material particulado e gases expelidos por chaminés e dutos industriais. A velocidade de sucção da sonda de coleta precisa ser exatamente igual à velocidade do fluxo de gases no duto (isocinetismo) para garantir a precisão analítica exigida pelos órgãos ambientais.",
            targetAudience: [
                "Indústrias cerâmicas e olarias (fornos)",
                "Frigoríficos e laticínios (caldeiras a vapor)",
                "Usinas de açúcar e etanol (geradores e biomassa)",
                "Indústrias químicas, farmacêuticas e tintas",
                "Fábricas de cimento, asfalto e mineração",
                "Lavanderias industriais e hospitais com caldeira"
            ],
            clientPain: "Notificação ou condicionante de Licença Ambiental de Operação (LO) exigindo laudo de emissões sob risco de embargo, paralisação das atividades ou multas de centenas de milhares de reais pelo órgão ambiental.",
            resolutions: [
                "CONAMA nº 382/2006",
                "CONAMA nº 436/2011",
                "IN CPRH nº 01/2015",
                "ABNT NBR 12019/20"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CONAMA nº 382/2006",
                    organ: "CONAMA / MMA",
                    badgeColor: "#059669",
                    summary: "Estabelece os limites máximos de emissão de poluentes atmosféricos para fontes fixas industriais.",
                    requirement: "Exige medição periódica de poluentes (material particulado, SOx, NOx) com laudo emitido por laboratório certificado.",
                    sanction: "Condicionante compulsório da Licença de Operação (LO). Descumprimento gera autuação e embargo."
                },
                {
                    number: "Resolução CONAMA nº 436/2011",
                    organ: "CONAMA / MMA",
                    badgeColor: "#059669",
                    summary: "Institui os padrões nacionais de controle da poluição do ar para fontes fixas instaladas antes de 2007.",
                    requirement: "Fixa limites de emissão retroativos e metas de redução progressiva para indústrias consolidadas.",
                    sanction: "Multas diárias cumulativas pelo órgão ambiental competente."
                },
                {
                    number: "Instrução Normativa CPRH nº 01/2015",
                    organ: "CPRH (Pernambuco)",
                    badgeColor: "#10b981",
                    summary: "Regulamenta o monitoramento contínuo e periódico de emissões atmosféricas em Pernambuco.",
                    requirement: "Protocolo formal dos relatórios de amostragem isocinética nos prazos fixados nas licenças.",
                    sanction: "Cancelamento ou não renovação da Licença de Operação (LO)."
                },
                {
                    number: "Normas ABNT NBR 10701, NBR 12019 e NBR 12020 (EPA 5)",
                    organ: "ABNT / EPA",
                    badgeColor: "#0284c7",
                    summary: "Normatizam o método de coleta isocinética de efluentes gasosos em dutos e chaminés.",
                    requirement: "Coleta com velocidade de sucção idêntica à velocidade dos gases no duto para precisão analítica.",
                    sanction: "Laudos sem metodologia ABNT/EPA são rejeitados de imediato pela fiscalização ambiental."
                }
            ],
            legislation: "Resoluções CONAMA nº 382/2006 e nº 436/2011; Instrução Normativa CPRH nº 01/2015; Normas ABNT NBR 10701, NBR 11966, NBR 12019, NBR 12020 e EPA Método 5.",
            pricingReference: "Ticket médio: R$ 4.500 a R$ 15.000 por chaminé analisada (depende dos parâmetros e altura). Prazo de execução: 2 a 5 dias de campo + 10 dias de laudo.",
            qualificationQuestions: [
                "Quantas chaminés ativas sua empresa possui em operação?",
                "Qual é o combustível utilizado nos fornos ou caldeiras (lenha, gás natural, BPF, biomassa)?",
                "A chaminé já possui plataforma de amostragem e bocais conforme a NBR 10701 instalados?",
                "Qual é o prazo exigido pelo órgão ambiental no condicionante da sua Licença de Operação?"
            ],
            salesPitch: "Olá [Nome], tudo bem? Notei que sua indústria opera caldeiras/fornos. O órgão ambiental exige periodicamente o Laudo de Amostragem Isocinética para a renovação da sua Licença de Operação conforme as Resoluções CONAMA 382/06 e 436/11. Nós da Excelência Ambiental somos especialistas certificados com laboratório de ponta. Conseguimos realizar a coleta em campo sem interromper sua produção e emitir o laudo técnico completo com ART com rapidez para você não correr risco de penalidades. Podemos agendar uma visita técnica gratuita?",
            objectionsAndAnswers: [
                {
                    objection: "Minha licença ainda tem 6 meses para vencer.",
                    answer: "Excelente que você está se antecipando! O processo de amostragem, análises laboratoriais e protocolo no órgão ambiental leva de 30 a 45 dias. Deixar para a reta final pode gerar multas e atrasos na emissão da licença renovada."
                },
                {
                    objection: "Já faço com outra empresa.",
                    answer: "Perfeito! A maioria dos nossos clientes industriais também já possuía fornecedor. O que costumamos fazer é uma cotação comparativa sem compromisso para você avaliar nosso prazo de entrega do laudo e a agilidade da nossa equipe técnica."
                }
            ],
            calculatorRoute: "#isocinetica"
        },
        {
            id: "srv_licenciamento",
            company: "Excelência Ambiental",
            category: "Consultoria Ambiental",
            title: "Licenciamento Ambiental Completo (LP, LI e LO)",
            badge: "Compulsório",
            icon: "📋",
            color: "#10b981",
            bgLight: "rgba(16, 185, 129, 0.12)",
            shortSummary: "Assessoria técnica e jurídica para obtenção e renovação das Licenças Prévia, de Instalação e de Operação.",
            fullDescription: "O Licenciamento Ambiental é o procedimento administrativo obrigatório pelo qual o órgão ambiental competente (CPRH, IBAMA ou secretarias municipais) autoriza a localização, instalação, ampliação e a operação de empreendimentos e atividades utilizadoras de recursos ambientais.",
            targetAudience: [
                "Novos empreendimentos industriais e comerciais",
                "Loteamentos, galpões logísticos e incorporadoras",
                "Empresas notificadas por operar sem licença ativa",
                "Indústrias em fase de ampliação de capacidade produtiva",
                "Postos de combustíveis e transportadoras de produtos perigosos"
            ],
            clientPain: "Impossibilidade de emitir notas fiscais, obter financiamentos bancários (BNDES, BNB) ou vender para grandes clientes corporativos que exigem licença válida.",
            resolutions: [
                "CONAMA nº 237/1997",
                "CONAMA nº 001/1986",
                "LC nº 140/2011",
                "Lei Federal 6.938/1981"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CONAMA nº 237/1997",
                    organ: "CONAMA / MMA",
                    badgeColor: "#10b981",
                    summary: "Regulamenta os procedimentos, prazos e critérios para o Licenciamento Ambiental tripartite (LP, LI e LO).",
                    requirement: "Obrigatoriedade de Licença Prévia (planejamento), Licença de Instalação (obras) e Licença de Operação (atividade).",
                    sanction: "Operar sem licença válida é crime ambiental (Lei nº 9.605/1998) com interdição e multas pesadas."
                },
                {
                    number: "Resolução CONAMA nº 001/1986",
                    organ: "CONAMA / MMA",
                    badgeColor: "#10b981",
                    summary: "Estabelece diretrizes e critérios para Avaliação de Impacto Ambiental e estudos como EIA/RIMA, RCA e PCA.",
                    requirement: "Elaboração de estudos ambientais aprofundados com levantamento de flora, fauna e meio físico com ART.",
                    sanction: "Indeferimento do processo e embargo administrativo de obras e atividades."
                },
                {
                    number: "Lei Complementar nº 140/2011",
                    organ: "Congresso Nacional",
                    badgeColor: "#0284c7",
                    summary: "Define a divisão de competências do licenciamento entre União (IBAMA), Estado (CPRH) e Municípios.",
                    requirement: "Protocolo no órgão ambiental correto conforme impacto local, regional ou nacional da atividade.",
                    sanction: "Nulidade de licenças emitidas por órgãos incompetentes e insegurança jurídica para o negócio."
                },
                {
                    number: "Lei Federal nº 6.938/1981 (PNMA)",
                    organ: "Governo Federal",
                    badgeColor: "#4f46e5",
                    summary: "Institui a Política Nacional do Meio Ambiente e o Sistema Nacional do Meio Ambiente (SISNAMA).",
                    requirement: "Obrigação legal de controle ambiental e responsabilização civil objetiva dos sócios por danos ambientais.",
                    sanction: "Bloqueio de incentivos fiscais e impedimento de obtenção de empréstimos públicos."
                }
            ],
            legislation: "Resoluções CONAMA nº 237/1997 e nº 001/1986; Lei Complementar nº 140/2011; Lei Federal nº 6.938/1981 (Política Nacional do Meio Ambiente).",
            pricingReference: "Ticket médio: R$ 6.000 a R$ 45.000 (depende do porte e potencial poluidor). Prazo: 3 a 12 meses até emissão pelo órgão.",
            qualificationQuestions: [
                "Qual é o status atual da sua licença (nova instalação, renovação ou regularização)?",
                "Sua empresa já recebeu algum auto de infração ou termo de compromisso ambiental?",
                "Qual é a área total construída e o segmento exato da atividade?"
            ],
            salesPitch: "Olá [Nome]! Para garantir que sua empresa possa operar 100% legalizada, sem riscos de interdição e apta a obter financiamentos, cuidamos de todo o processo de Licenciamento Ambiental de ponta a ponta junto à CPRH conforme a Resolução CONAMA 237/97. Elaboramos todos os estudos técnicos, plantas e ARTs necessários.",
            objectionsAndAnswers: [
                {
                    objection: "O órgão ambiental é muito lento, não adianta dar entrada.",
                    answer: "Justamente por isso ter uma equipe técnica que protocola estudos robustos e sem erros faz toda a diferença. Estudos mal elaborados geram exigências repetidas que travam o processo por anos. Nós acompanhamos o trâmite ativamente."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_ete",
            company: "Excelência Ambiental",
            category: "Tratamento de Efluentes",
            title: "Gestão, Operação e Laudos de ETE (Efluentes)",
            badge: "Operação Contínua",
            icon: "💧",
            color: "#0284c7",
            bgLight: "rgba(2, 132, 199, 0.12)",
            shortSummary: "Operação técnica, dosagem de produtos químicos e monitoramento laboratorial de Estações de Tratamento de Efluentes.",
            fullDescription: "Serviço especializado de acompanhamento operacional de Estações de Tratamento de Efluentes Industriais e Sanitários. Garante que os efluentes tratados atinjam os padrões de descarte estabelecidos em lei (DBO, DQO, Óleos e Graxas, Metais e pH) antes do lançamento na rede ou corpo receptor.",
            targetAudience: [
                "Frigoríficos, abatedouros e curtumes",
                "Laticínios e indústrias de bebidas/alimentos",
                "Lavanderias industriais e hospitalares",
                "Condomínios residenciais e centros comerciais sem rede pública",
                "Usinas e indústrias químicas/farmacêuticas"
            ],
            clientPain: "Efluente com mau cheiro, coloração escura, entupimento de leitos filtrantes e laudos fora dos padrões da CONAMA 430, gerando risco iminente de multas gravíssimas e ações civis públicas ambientais.",
            resolutions: [
                "CONAMA nº 430/2011",
                "CONAMA nº 357/2005",
                "Portaria MS nº 888/2021",
                "Resolução CRQ nº 15/2014"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CONAMA nº 430/2011",
                    organ: "CONAMA / MMA",
                    badgeColor: "#0284c7",
                    summary: "Dispõe sobre as condições e padrões de lançamento de efluentes industriais e sanitários.",
                    requirement: "Limites mandatórios para DBO, DQO, sólidos sedimentáveis, óleos/graxas, metais pesados e pH no descarte.",
                    sanction: "Autuação gravíssima por poluição hídrica e responsabilização criminal dos gestores da empresa."
                },
                {
                    number: "Resolução CONAMA nº 357/2005",
                    organ: "CONAMA / MMA",
                    badgeColor: "#0284c7",
                    summary: "Classifica os corpos de água e estabelece diretrizes ambientais para o seu enquadramento.",
                    requirement: "Manutenção da capacidade de autodepuração do rio ou corpo receptor sem rebaixar sua classe de uso.",
                    sanction: "Revogação da outorga de descarte e paralisação das atividades poluidoras."
                },
                {
                    number: "Portaria GM/MS nº 888/2021",
                    organ: "Ministério da Saúde",
                    badgeColor: "#10b981",
                    summary: "Estabelece os padrões de potabilidade da água e critérios para reuso industrial e sanitário.",
                    requirement: "Monitoramento microbiológico e físico-químico rigoroso para águas de reuso e de contato.",
                    sanction: "Fiscalização da Vigilância Sanitária com interdição de reservatórios e redes de distribuição."
                },
                {
                    number: "Resolução Normativa CRQ nº 15/2014",
                    organ: "Conselho de Química",
                    badgeColor: "#6366f1",
                    summary: "Obriga a Anotação de Função Técnica (AFT) por Químico responsável pela operação da ETE.",
                    requirement: "Controle técnico diário de dosagem química de coagulantes, polímeros e alcalinizantes com AFT ativa.",
                    sanction: "Multas pelo Conselho Regional de Química e invalidade jurídica dos laudos de descarte."
                }
            ],
            legislation: "Resoluções CONAMA nº 430/2011 e nº 357/2005; Portaria GM/MS nº 888/2021; Resolução Normativa CRQ nº 15/2014.",
            pricingReference: "Mensalidade de operação: R$ 3.500 a R$ 18.000/mês. Laudos pontuais: R$ 1.200 a R$ 4.000.",
            qualificationQuestions: [
                "Qual é a vazão média diária da sua ETE (em metros cúbicos/dia)?",
                "Qual é a principal matéria-prima geradora do efluente (gordura, sangue, químicos, sanitário)?",
                "A empresa já possui operador fixo ou precisa de fornecimento de químicos e responsável técnico (CRQ)?"
            ],
            salesPitch: "Olá [Nome]! Uma ETE desregulada gera custos enormes em produtos químicos jogados fora e o risco iminente de ser autuado pela CPRH com base na Resolução CONAMA 430/11. Nós assumimos a responsabilidade técnica e química da sua estação, garantindo efluente cristalino dentro dos padrões legais e laudos periódicos com ART.",
            objectionsAndAnswers: [
                {
                    objection: "Meu próprio encarregado de manutenção cuida da ETE.",
                    answer: "Entendemos! Porém o órgão ambiental exige obrigatoriamente um Químico ou Engenheiro com CRQ ativo assinando os relatórios de eficiência. Além disso, ajustamos a dosagem química exata, gerando economia de até 30% em produtos."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_residuos",
            company: "Excelência Ambiental",
            category: "Gestão de Resíduos",
            title: "Gerenciamento de Resíduos Sólidos (PGRS & MTR)",
            badge: "Alta Demanda",
            icon: "♻️",
            color: "#16a34a",
            bgLight: "rgba(22, 163, 74, 0.12)",
            shortSummary: "Elaboração do Plano de Gerenciamento de Resíduos Sólidos (PGRS), emissão de MTR e destinação adequada.",
            fullDescription: "O PGRS é um documento técnico obrigatório que comprova a capacidade de uma empresa de gerenciar adequadamente todos os resíduos que gera: desde a segregação na fonte, acondicionamento, transporte até a destinação final ambientalmente correta (reciclagem, coprocessamento, aterro industrial).",
            targetAudience: [
                "Indústrias de todos os portes (geradoras de Classe I e II)",
                "Oficinas mecânicas, concessionárias e centros automotivos",
                "Construção civil e demolição (RCC)",
                "Hospitais, clínicas veterinárias e odontológicas (RSS)",
                "Supermercados e atacadistas"
            ],
            clientPain: "Fiscalização da prefeitura exigindo PGRS para emissão de Alvará de Funcionamento ou notificação no sistema SINIR (MTR online).",
            resolutions: [
                "CONAMA nº 313/2002",
                "Lei Federal 12.305/2010",
                "Portaria MMA nº 280/2020",
                "ABNT NBR 10004:2004"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CONAMA nº 313/2002",
                    organ: "CONAMA / MMA",
                    badgeColor: "#16a34a",
                    summary: "Dispõe sobre o Inventário Nacional de Resíduos Sólidos Industriais.",
                    requirement: "Declaração anual obrigatória da tipologia, volume gerado, acondicionamento e destinação de resíduos.",
                    sanction: "Bloqueio automático da renovação da Licença Ambiental de Operação (LO)."
                },
                {
                    number: "Lei Federal nº 12.305/2010 (PNRS)",
                    organ: "Congresso Nacional",
                    badgeColor: "#16a34a",
                    summary: "Institui a Política Nacional de Resíduos Sólidos e a responsabilidade pós-consumo.",
                    requirement: "Elaboração, implantação e monitoramento anual de PGRS técnico com ART assinado por responsável técnico.",
                    sanction: "Multas de até R$ 50 milhões (Lei de Crimes Ambientais) e bloqueio de alvará de funcionamento municipal."
                },
                {
                    number: "Portaria MMA nº 280/2020",
                    organ: "MMA / SINIR",
                    badgeColor: "#0284c7",
                    summary: "Institui o Manifesto de Transporte de Resíduos (MTR) nacional em meio digital obrigatório.",
                    requirement: "Emissão de MTR digital para cada carga e homologação do Certificado de Destinação Final (CDF).",
                    sanction: "Apreensão do caminhão transportador e autuação administrativa por transporte irregular de resíduos."
                },
                {
                    number: "Norma ABNT NBR 10004:2004",
                    organ: "ABNT",
                    badgeColor: "#dc2626",
                    summary: "Classifica os resíduos sólidos quanto aos seus riscos potenciais à saúde e ao meio ambiente.",
                    requirement: "Segregação técnica obrigatória de resíduos Classe I (Perigosos) e Classe II (Não Perigosos).",
                    sanction: "Descarte conjunto de resíduos perigosos com lixo comum configura crime ambiental inafiançável."
                }
            ],
            legislation: "Resolução CONAMA nº 313/2002; Lei Federal nº 12.305/2010 (PNRS); Portaria MMA nº 280/2020 (MTR Nacional); Norma ABNT NBR 10004:2004.",
            pricingReference: "PGRS avulso: R$ 3.000 a R$ 12.000. Gestão mensal de resíduos e MTR: R$ 1.500 a R$ 5.000/mês.",
            qualificationQuestions: [
                "Quais os principais tipos de resíduos gerados (óleo usado, estopas, borra, plástico, orgânico)?",
                "Sua empresa já está cadastrada no sistema SINIR / MTR online?",
                "Possui empresa homologada para coleta e certificado de destinação final (CDF)?"
            ],
            salesPitch: "Olá [Nome]! O descarte irregular de resíduos industriais pode enquadrar os sócios na Lei de Crimes Ambientais com base na Lei 12.305/10 e Resolução CONAMA 313/02. Elaboramos seu PGRS completo e gerenciamos suas emissões de MTR e CDFs para que sua empresa fique 100% blindada contra multas.",
            objectionsAndAnswers: [
                {
                    objection: "A prefeitura já recolhe o lixo comum.",
                    answer: "A prefeitura é obrigada a recolher apenas resíduos domiciliares em pequena quantidade. Todo resíduo industrial, perigoso ou gerado em grande volume é de responsabilidade integral da sua empresa."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_ruido",
            company: "Excelência Ambiental",
            category: "Acústica & Ruído",
            title: "Laudo de Ruído Ambiental e Ocupacional (NBR 10151)",
            badge: "Laudo Acústico",
            icon: "🔊",
            color: "#ea580c",
            bgLight: "rgba(234, 88, 12, 0.12)",
            shortSummary: "Medições de pressão sonora com sonômetro calibrado para atendimento a reclamações de vizinhança e licenças.",
            fullDescription: "Avaliação técnica dos níveis de ruído emitidos pela atividade industrial ou comercial em direção à comunidade vizinha (ruído ambiental) ou nos postos de trabalho dos funcionários (ruído ocupacional), realizada com sonômetros integradores Classe 1 calibrados pelo INMETRO/RBC.",
            targetAudience: [
                "Indústrias próximas a bairros residenciais ou áreas urbanas",
                "Casas de eventos, bares, restaurantes e igrejas",
                "Supermercados e centros de distribuição com geradores ou compressores",
                "Usinas, pedreiras e canteiros de obras pesadas"
            ],
            clientPain: "Boletins de ocorrência, denúncias no Ministério Público ou reclamações formais de vizinhos por perturbação do sossego com ameaça de embargo da atividade noturna.",
            resolutions: [
                "CONAMA nº 001/1990",
                "ABNT NBR 10151:2019",
                "ABNT NBR 10152:2017",
                "NR-15 Portaria 672/21"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CONAMA nº 001/1990",
                    organ: "CONAMA / MMA",
                    badgeColor: "#ea580c",
                    summary: "Fixa os critérios e limites de emissão de ruído decorrentes de quaisquer atividades industriais e comerciais.",
                    requirement: "Nenhum ruído pode ultrapassar os níveis de conforto acústico da comunidade vizinha nos períodos diurno e noturno.",
                    sanction: "Interdição imediata de máquinas emissoras (exaustores, chillers, geradores) e processos criminais."
                },
                {
                    number: "Norma ABNT NBR 10151:2019 (Emenda 2020)",
                    organ: "ABNT",
                    badgeColor: "#0284c7",
                    summary: "Acústica - Medição e avaliação de níveis de pressão sonora em áreas habitadas.",
                    requirement: "Uso obrigatório de sonômetro integrador de precisão Classe 1 com calibração RBC/INMETRO vigente e ART.",
                    sanction: "Laudos sem metodologia da NBR 10151 são rejeitados pelo Ministério Público e anulados em juízo."
                },
                {
                    number: "Norma ABNT NBR 10152:2017",
                    organ: "ABNT",
                    badgeColor: "#10b981",
                    summary: "Níveis de pressão sonora em ambientes internos a edificações para conforto acústico.",
                    requirement: "Avaliação do isolamento e conforto sonoro em salas de controle, escritórios e laboratórios.",
                    sanction: "Condicionante para expedição de Habite-se e licenças sanitárias de operação."
                },
                {
                    number: "Portaria MTP nº 672/2021 (NR-15 Anexos 1 e 2)",
                    organ: "Ministério do Trabalho",
                    badgeColor: "#dc2626",
                    summary: "Estabelece os limites de tolerância para ruído ocupacional contínuo e intermitente nos postos de trabalho.",
                    requirement: "Medição de dose de ruído (dosimetria) e fornecimento compulsório de protetor auricular se superior a 85 dB(A).",
                    sanction: "Passivos trabalhistas retroativos com cobrança de adicional de insalubridade e indenizações."
                }
            ],
            legislation: "Resolução CONAMA nº 001/1990; Normas ABNT NBR 10151:2019 e NBR 10152:2017; Portaria MTP nº 672/2021 (NR-15).",
            pricingReference: "Ticket médio: R$ 2.500 a R$ 8.000 por ponto de medição (diurno e noturno).",
            qualificationQuestions: [
                "A medição é solicitada por condicionante da licença ou por denúncia/reclamação de vizinhos?",
                "A fonte de ruído opera no período noturno (após 22h)?",
                "O local possui gerador, chillers ou exaustores instalados em área externa?"
            ],
            salesPitch: "Olá [Nome]! Para resolver denúncias de barulho ou atender exigências da CPRH com base na Resolução CONAMA 001/90 e NBR 10151, emitimos Laudo Acústico com sonômetro Classe 1 calibrado pelo INMETRO e ART. Comprovamos tecnicamente se sua empresa está dentro dos limites de decibéis permitidos por lei.",
            objectionsAndAnswers: [
                {
                    objection: "Vou esperar a polícia ou o fiscal vir medir primeiro.",
                    answer: "Quando a fiscalização mede e você está em desacordo, a autuação é imediata e pode ocorrer apreensão de equipamentos ou embargo da operação. O laudo prévio protege seu negócio e demonstra boa-fé perante as autoridades."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_outorga",
            company: "Excelência Ambiental",
            category: "Recursos Hídricos",
            title: "Outorga de Direito de Uso da Água (Poços & Captação)",
            badge: "Recursos Hídricos",
            icon: "🚰",
            color: "#0891b2",
            bgLight: "rgba(8, 145, 178, 0.12)",
            shortSummary: "Regularização legal para captação de água em poços tubulares profundos, rios, açudes ou nascentes.",
            fullDescription: "A Outorga é o ato administrativo pelo qual o poder público outorgante (APAC, ANA ou órgão estadual) faculta ao usuário o direito de uso dos recursos hídricos. Quem perfura poço artesiano ou capta água de rio sem outorga está cometendo infração administrativa e crime ambiental.",
            targetAudience: [
                "Indústrias que utilizam poços artesianos para reduzir custos de água da concessionária",
                "Laticínios, frigoríficos e cervejarias",
                "Hotéis, pousadas, clubes e condomínios",
                "Agroindústria, irrigação e granjas"
            ],
            clientPain: "Poço perfurado sem autorização com risco de lacre e multa pesada, ou falta de vazão garantida legalmente para a operação contínua da fábrica.",
            resolutions: [
                "Resolução CNRH nº 16/2001",
                "Lei Federal 9.433/1997",
                "Resolução APAC nº 01/2013",
                "ABNT NBR 12212/12244"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CNRH nº 16/2001",
                    organ: "CNRH / MMA",
                    badgeColor: "#0891b2",
                    summary: "Estabelece os critérios e diretrizes gerais para a implementação da Outorga de Recursos Hídricos.",
                    requirement: "Pedido prévio de outorga para derivação, captação ou lançamento em corpos de água superficiais e subterrâneos.",
                    sanction: "Lacre de poços artesianos e bombas hidráulicas pela fiscalização ambiental com aplicação de multas diárias."
                },
                {
                    number: "Lei Federal nº 9.433/1997 (Lei das Águas)",
                    organ: "Congresso Nacional",
                    badgeColor: "#0891b2",
                    summary: "Institui a Política Nacional de Recursos Hídricos e declara a água bem público dotado de valor econômico.",
                    requirement: "Autorização compulsória emitida pela autoridade outorgante para qualquer captação de água.",
                    sanction: "Captação clandestina tipificada como infração administrativa grave e crime ambiental inafiançável."
                },
                {
                    number: "Resoluções APAC nº 01/2013 e nº 02/2018 (PE)",
                    organ: "APAC (Pernambuco)",
                    badgeColor: "#10b981",
                    summary: "Disciplinam a regularização, outorga preventiva e definitiva para perfuração e uso de poços em PE.",
                    requirement: "Apresentação de projeto hidrogeológico, teste de vazão contínua de 24 horas e análises completas de potabilidade.",
                    sanction: "Embargo sumário de poços perfurados sem autorização prévia em áreas com estresse hídrico."
                },
                {
                    number: "Normas ABNT NBR 12212 e NBR 12244",
                    organ: "ABNT",
                    badgeColor: "#0284c7",
                    summary: "Requisitos de projeto, perfuração e ensaios de bombeamento em poços tubulares para captação de água.",
                    requirement: "Construção com laje de proteção sanitária, vedação contra contaminação superficial e hidrômetro selado.",
                    sanction: "Contaminação do lençol freático gera responsabilidade civil objetiva e obrigação de remediação milionária."
                }
            ],
            legislation: "Resolução CNRH nº 16/2001; Lei Federal nº 9.433/1997 (Política Nacional de Recursos Hídricos); Resoluções APAC nº 01/2013 e nº 02/2018; Normas ABNT NBR 12212 e NBR 12244.",
            pricingReference: "Ticket médio: R$ 5.000 a R$ 18.000 por poço (inclui teste de vazão e análises de potabilidade).",
            qualificationQuestions: [
                "O poço já está perfurado ou ainda será executado?",
                "Qual é a vazão necessária estimada (em m³/hora)?",
                "A água é usada para consumo humano, limpeza industrial ou processo produtivo?"
            ],
            salesPitch: "Olá [Nome]! Sabia que utilizar água de poço artesiano sem outorga válida gera multas pesadas e o lacre do poço conforme a Resolução CNRH 16/01 e Lei 9.433/97? Cuidamos de todo o processo geológico, teste de vazão e protocolo da outorga junto aos órgãos hídricos (APAC/ANA) para você usar sua água com tranquilidade e 100% de segurança jurídica.",
            objectionsAndAnswers: [
                {
                    objection: "O poço fica dentro da minha propriedade privada.",
                    answer: "Pela Constituição Brasileira, a água subterrânea é um bem público de domínio do Estado. Por isso, mesmo no terreno da sua empresa, a captação exige autorização formal de uso."
                }
            ],
            calculatorRoute: "#calculators"
        },

        // =====================================================================
        // VEELUEN SOLUTIONS
        // =====================================================================
        {
            id: "srv_solar",
            company: "Veeluen Solutions",
            category: "Energia & Eficiência",
            title: "Energia Solar Fotovoltaica (Industrial & Comercial)",
            badge: "Retorno Financeiro",
            icon: "☀️",
            color: "#eab308",
            bgLight: "rgba(234, 179, 8, 0.12)",
            shortSummary: "Projetos de engenharia fotovoltaica 'chave na mão' com redução de até 90% na fatura de eletricidade.",
            fullDescription: "Soluções completas de engenharia para implantação de sistemas de geração de energia solar fotovoltaica conectada à rede (on-grid), usinas em solo ou sobre telhados industriais. Inclui dimensionamento técnico, simulação de irradiação solar, projeto elétrico, fornecimento dos equipamentos (módulos Tier-1 e inversores premium), instalação e homologação na concessionária (ex: Neoenergia, Enel).",
            targetAudience: [
                "Indústrias com faturamento elétrico mensal acima de R$ 5.000",
                "Supermercados, padarias e açougues (alto consumo com refrigeração)",
                "Galpões logísticos e distribuidoras com telhados amplos",
                "Hospitais, clínicas e escolas",
                "Concessionárias e oficinas automotivas"
            ],
            clientPain: "Faturas de energia abusivas que corroem a margem de lucro da empresa e aumentos frequentes de tarifas das concessionárias de energia.",
            resolutions: [
                "REN ANEEL nº 1.000/2021",
                "Lei Federal 14.300/2022",
                "REN ANEEL nº 482/2012",
                "Resolução CONFEA nº 1.010/05"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução Normativa ANEEL nº 1.000/2021",
                    organ: "ANEEL",
                    badgeColor: "#eab308",
                    summary: "Consolida os direitos e deveres dos consumidores e as regras de conexão de micro e minigeração distribuída à rede.",
                    requirement: "Fixa prazos estritos para a concessionária emitir parecer de acesso, realizar vistoria e ligar a usina solar.",
                    sanction: "Atrasos injustificados da distribuidora geram ressarcimentos financeiros compulsórios ao cliente."
                },
                {
                    number: "Lei Federal nº 14.300/2022 (Marco Legal da GD)",
                    organ: "Congresso Nacional",
                    badgeColor: "#eab308",
                    summary: "Institui o marco legal da micro e minigeração distribuída e o Sistema de Compensação de Energia Elétrica (SCEE).",
                    requirement: "Garante segurança jurídica e regras claras para compensação de créditos solares e transição da TUSD Fio B.",
                    sanction: "Instalações clandestinas são desconectadas com perda da garantia de equipamentos e multa por adulteração."
                },
                {
                    number: "Resolução Normativa ANEEL nº 482/2012 e 687/2015",
                    organ: "ANEEL",
                    badgeColor: "#0284c7",
                    summary: "Resoluções pioneiras que criaram e consolidaram o sistema de créditos de energia e geração compartilhada.",
                    requirement: "Possibilidade de compensar a energia gerada em múltiplas filiais sob mesmo CNPJ (autoconsumo remoto).",
                    sanction: "Créditos solares expiram após 60 meses se não forem utilizados em unidades vinculadas."
                },
                {
                    number: "Resolução CONFEA nº 1.010/2005",
                    organ: "CONFEA / CREA",
                    badgeColor: "#4f46e5",
                    summary: "Define as competências e atribuições privativas de Engenheiros Eletricistas para homologação de usinas.",
                    requirement: "Emissão obrigatória de ART de projeto elétrico e ART de execução da usina solar homologada na distribuidora.",
                    sanction: "Projetos sem responsabilidade técnica de Engenheiro Eletricista habilitado são reprovados na concessionária."
                }
            ],
            legislation: "Resolução Normativa ANEEL nº 1.000/2021; Lei Federal nº 14.300/2022 (Marco Legal da GD); Resoluções Normativas ANEEL nº 482/2012 e nº 687/2015; Resolução CONFEA nº 1.010/2005.",
            pricingReference: "Ticket médio: R$ 35.000 a R$ 500.000+ (Payback médio: 2,5 a 4 anos).",
            qualificationQuestions: [
                "Qual é o valor médio da sua conta de energia nos últimos meses?",
                "Sua rede elétrica é atendida em Baixa Tensão (Grupo B) ou Alta Tensão com transformador próprio (Grupo A)?",
                "Qual é o tipo e estado da estrutura do telhado (metálico, concreto, fibrocimento) ou possui área livre em solo?"
            ],
            salesPitch: "Olá [Nome]! Com a energia solar da Veeluen Solutions homologada conforme a REN ANEEL 1.000/21 e Lei 14.300/22, sua empresa economiza até 90% da fatura todo mês. O próprio valor economizado paga o financiamento do sistema e, após isso, é lucro líquido direto no caixa por mais de 25 anos. Posso fazer um estudo de viabilidade sem custo com sua última fatura de energia?",
            objectionsAndAnswers: [
                {
                    objection: "Não tenho capital disponível para investir nisso agora.",
                    answer: "Essa é a melhor parte: você não precisa descapitalizar seu caixa! Temos linhas de financiamento bancário específicas para energia solar onde a parcela mensal é menor do que você já paga de luz todo mês. Ou seja, você troca uma conta cara por um investimento que se paga sozinho."
                },
                {
                    objection: "Disseram que com a nova lei da energia solar não vale mais a pena.",
                    answer: "Pelo contrário! A Lei 14.300 trouxe estabilidade jurídica e o retorno financeiro continua excelente, com payback médio entre 3 e 4 anos e rentabilidade acima de 2,5% ao mês, infinitamente superior a qualquer aplicação de renda fixa."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_nr13",
            company: "Veeluen Solutions",
            category: "Segurança & Engenharia",
            title: "Inspeção de Segurança NR-13 (Caldeiras & Vasos de Pressão)",
            badge: "Inspeção Obrigatória",
            icon: "🧯",
            color: "#dc2626",
            bgLight: "rgba(220, 38, 38, 0.12)",
            shortSummary: "Inspeção inicial, periódica e extraordinária em vasos sob pressão, compressores, caldeiras e tubulações.",
            fullDescription: "Avaliação técnica de segurança com base na Norma Regulamentadora NR-13 do Ministério do Trabalho. Envolve ensaios não destrutivos (medição de espessura por ultrassom das chapas metálicas, cálculo da Pressão Máxima de Trabalho Permitida - PMTP, teste hidrostático, calibração das válvulas de segurança e manômetros, reconstituição de prontuário e emissão de ART assinada por Engenheiro Mecânico Habilitado).",
            targetAudience: [
                "Todas as indústrias que utilizam ar comprimido (compressores de ar com reservatório)",
                "Indústrias têxteis, químicas e de alimentos com caldeiras a vapor",
                "Oficinas de funilaria e pintura e postos de combustíveis",
                "Hospitais (autoclaves e reservatórios de gases medicinais)",
                "Fábricas de bebidas e cervejarias (tanques pressurizados)"
            ],
            clientPain: "Risco catastrófico de explosão de reservatório de pressão, fiscalização do Ministério do Trabalho e Emprego (MTE) com multas pesadas por compressor irregular e exigência de laudo pelo Corpo de Bombeiros e seguradoras.",
            resolutions: [
                "Portaria MTP nº 1.846/2022 (NR-13)",
                "Resolução CONFEA nº 218/1973",
                "Decisão Normativa CONFEA 111/17",
                "Código ASME Seção VIII"
            ],
            resolutionsDetails: [
                {
                    number: "Portaria MTP nº 1.846/2022 (Texto da NR-13)",
                    organ: "Ministério do Trabalho",
                    badgeColor: "#dc2626",
                    summary: "Estabelece os requisitos compulsórios para integridade estrutural e segurança de caldeiras e vasos sob pressão.",
                    requirement: "Inspeção de segurança periódica por ultrassom, teste hidrostático e calibração anual das válvulas de segurança.",
                    sanction: "Interdição imediata pela Auditoria Fiscal do Trabalho e multas gravíssimas por cada compressor irregular."
                },
                {
                    number: "Resolução CONFEA nº 218/1973 e DN nº 111/2017",
                    organ: "CONFEA / CREA",
                    badgeColor: "#dc2626",
                    summary: "Fixa competência privativa de Engenheiro Mecânico como Profissional Habilitado (PH) para atuar na NR-13.",
                    requirement: "Emissão de prontuário, relatório e ART assinados exclusivamente por Engenheiro Mecânico qualificado.",
                    sanction: "Laudos assinados por técnicos ou outras modalidades são juridicamente nulos perante a fiscalização do MTE."
                },
                {
                    number: "Código ASME Seção VIII (Divisões 1 e 2)",
                    organ: "ASME Internacional",
                    badgeColor: "#0284c7",
                    summary: "Código de referência mundial de cálculo mecânico para fabricação e integridade de vasos de pressão.",
                    requirement: "Cálculo formal da Pressão Máxima de Trabalho Permitida (PMTP) e espessura mínima tolerável de chapa metálica.",
                    sanction: "Risco crítico de explosão por fadiga e corrosão do reservatório metálico com fatalidades operacionais."
                },
                {
                    number: "Consolidação das Leis do Trabalho (CLT) Arts. 187 e 188",
                    organ: "Governo Federal",
                    badgeColor: "#4f46e5",
                    summary: "Capítulo de Segurança e Saúde no Trabalho que tipifica a operação de caldeiras e aparelhos sob pressão.",
                    requirement: "Manutenção de dispositivos de segurança e livro de registro oficial de inspeções e manutenções.",
                    sanction: "Responsabilização penal dos gestores por crime de perigo comum ou homicídio culposo em acidentes."
                }
            ],
            legislation: "Norma Regulamentadora NR-13 (Portaria MTP nº 1.846/2022); Resolução CONFEA nº 218/1973; Decisão Normativa CONFEA nº 111/2017; Código ASME Seção VIII; CLT Arts. 187 e 188.",
            pricingReference: "Ticket médio: R$ 1.200 a R$ 3.500 por compressor/vaso de pressão; R$ 4.000 a R$ 15.000 por caldeira.",
            qualificationQuestions: [
                "Quantos compressores de ar ou vasos sob pressão estão em funcionamento na sua planta?",
                "Qual foi a data da última inspeção periódica realizada e você possui o prontuário do vaso?",
                "As válvulas de segurança e manômetros possuem certificado de calibração em dia?"
            ],
            salesPitch: "Olá [Nome]! Praticamente toda indústria utiliza compressores de ar, mas muitos não sabem que a Norma Regulamentadora NR-13 (Portaria 1.846/22) e a Resolução CONFEA 218/73 exigem inspeção periódica de espessura por ultrassom e calibração das válvulas por Engenheiro Mecânico com ART. A ausência desse laudo gera multas gravíssimas e até interdição na fiscalização do MTE. A Veeluen realiza a inspeção no local sem parar sua produção. Vamos agendar a verificação dos seus equipamentos?",
            objectionsAndAnswers: [
                {
                    objection: "Meu compressor é pequeno, acho que não precisa.",
                    answer: "A NR-13 enquadra qualquer vaso de pressão com produto P x V (Pressão x Volume) acima do limite mínimo da norma. A maioria esmagadora dos compressores industriais, mesmo médios, se enquadra. O fiscal sempre confere isso logo na entrada."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_engenharia_civil",
            company: "Veeluen Solutions",
            category: "Engenharia & Obras",
            title: "Projetos de Engenharia Civil e Galpões Industriais",
            badge: "Projetos & Obras",
            icon: "🏗️",
            color: "#4f46e5",
            bgLight: "rgba(79, 70, 229, 0.12)",
            shortSummary: "Projetos estruturais, arquitetônicos, fundações, pisos industriais de alta resistência e ampliações de plantas.",
            fullDescription: "Desenvolvimento completo de projetos executivos de engenharia civil para o setor produtivo. Desde a concepção estrutural (concreto armado e estruturas metálicas), terraplenagem, drenagem de águas pluviais, pavimentação pesada para tráfego de carretas, até a coordenação e fiscalização da execução da obra com rigoroso controle orçamentário.",
            targetAudience: [
                "Indústrias em expansão física ou implantação de novas linhas de montagem",
                "Operadores logísticos e galpões de estocagem",
                "Supermercados e centros de distribuição",
                "Incorporadoras e investidores imobiliários comerciais"
            ],
            clientPain: "Fissuras e afundamentos de piso por carga excessiva, infiltrações, atrasos e estouros de orçamento em obras sem projeto executivo detalhado.",
            resolutions: [
                "Resolução CONFEA nº 1.025/2009",
                "ABNT NBR 6118:2023",
                "ABNT NBR 8800:2008",
                "Código de Obras Municipal"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução CONFEA nº 1.025/2009",
                    organ: "CONFEA / CREA",
                    badgeColor: "#4f46e5",
                    summary: "Regulamenta a Anotação de Responsabilidade Técnica (ART) e a Certidão de Acervo Técnico (CAT).",
                    requirement: "Registro compulsório de ART de projeto estrutural, fundações e execução antes do início das obras civis.",
                    sanction: "Obra embargada pela fiscalização do CREA e prefeitura com multa sobre o valor venal da obra."
                },
                {
                    number: "Norma ABNT NBR 6118:2023",
                    organ: "ABNT",
                    badgeColor: "#4f46e5",
                    summary: "Projeto de estruturas de concreto armado e protendido - requisitos de cálculo estrutural.",
                    requirement: "Dimensionamento estrutural conforme as classes de agressividade ambiental e cargas de tráfego pesado.",
                    sanction: "Trincas prematuras de piso, afundamentos por carga excessiva e risco de colapso estrutural."
                },
                {
                    number: "Norma ABNT NBR 8800:2008",
                    organ: "ABNT",
                    badgeColor: "#0284c7",
                    summary: "Projeto de estruturas de aço e mistas para galpões e edifícios industriais.",
                    requirement: "Cálculo de sobrecargas de vento (NBR 6123) em coberturas metálicas e ligações estruturais soldadas e parafusadas.",
                    sanction: "Destelhamentos e colapsos de galpões metálicos durante tempestades e rajadas de vento."
                },
                {
                    number: "Código de Obras Municipal e Lei de Uso do Solo",
                    organ: "Prefeituras Municipais",
                    badgeColor: "#10b981",
                    summary: "Normatiza os parâmetros construtivos, taxas de ocupação, recuos obrigatórios e permeabilidade do solo.",
                    requirement: "Aprovação prévia do projeto arquitetônico e de engenharia para concessão do Alvará de Construção e Habite-se.",
                    sanction: "Demolição administrativa de partes irregulares da construção e recusa de emissão do Habite-se."
                }
            ],
            legislation: "Resolução CONFEA nº 1.025/2009; Normas ABNT NBR 6118:2023 (Concreto Armado), NBR 8800:2008 (Estruturas Metálicas), NBR 15575; Código de Obras Municipal.",
            pricingReference: "Projetos: R$ 8.000 a R$ 80.000+. Gestão/Acompanhamento de obra: R$ 5.000 a R$ 25.000/mês.",
            qualificationQuestions: [
                "Qual é a metragem quadrada pretendida da obra ou ampliação?",
                "Já possui levantamento topográfico e laudo de sondagem do solo (SPT)?",
                "Qual é a estimativa de carga ou peso das máquinas que serão instaladas no piso?"
            ],
            salesPitch: "Olá [Nome]! Uma obra industrial sem um projeto estrutural compatibilizado conforme a Resolução CONFEA 1.025/09 e NBR 6118 pode custar até 40% a mais por causa de desperdícios e retrabalhos. A equipe de engenheiros da Veeluen Solutions projeta sua fábrica ou galpão garantindo a máxima economia de aço e concreto, com segurança estrutural absoluta e ART de projeto.",
            objectionsAndAnswers: [
                {
                    objection: "Vou contratar direto o mestre de obras sem projeto de engenheiro.",
                    answer: "O mestre de obras executa, mas sem o cálculo exato do engenheiro ele tende a superfaturar ferragens por medo ou errar a fundação, o que pode causar trincas estruturais graves e risco de colapso, além de impedir a regularização do Habite-se na prefeitura."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_eletrica_spda",
            company: "Veeluen Solutions",
            category: "Engenharia Elétrica",
            title: "Laudos Elétricos, NR-10 e SPDA (Pára-raios)",
            badge: "Proteção Elétrica",
            icon: "⚡",
            color: "#f59e0b",
            bgLight: "rgba(245, 158, 11, 0.12)",
            shortSummary: "Inspeção e laudo de SPDA com medição de aterramento e prontuário das instalações elétricas conforme NR-10.",
            fullDescription: "Avaliação técnica das instalações elétricas industriais e do Sistema de Proteção contra Descargas Atmosféricas (SPDA/Pára-raios). Envolve medição de resistência de aterramento ôhmica com terrômetro calibrado, inspeção de captores e descidas, termografia de quadros elétricos para identificação de sobrecargas e emissão de laudo técnico com ART exigido por seguradoras e Corpo de Bombeiros.",
            targetAudience: [
                "Todas as indústrias e fábricas com transformador ou subestação",
                "Condomínios residenciais e empresariais",
                "Galpões de estocagem de inflamáveis ou materiais combustíveis",
                "Hospitais, shoppings e escolas"
            ],
            clientPain: "Queima frequente de placas eletrônicas e maquinários caros por raios, risco de incêndio por curto-circuito e recusa de indenização pela seguradora por falta de laudo de SPDA atualizado.",
            resolutions: [
                "Portaria MTE nº 598/2004 (NR-10)",
                "ABNT NBR 5419:2015",
                "ABNT NBR 5410:2004",
                "REN ANEEL nº 1.000/2021"
            ],
            resolutionsDetails: [
                {
                    number: "Portaria MTE nº 598/2004 (Norma Regulamentadora NR-10)",
                    organ: "Ministério do Trabalho",
                    badgeColor: "#f59e0b",
                    summary: "Segurança em Instalações e Serviços em Eletricidade.",
                    requirement: "Manutenção do Prontuário das Instalações Elétricas (PIE), esquemas unifilares atualizados e laudo anual com ART.",
                    sanction: "Autuação trabalhista e interdição de painéis elétricos por risco de choque e arco elétrico aos operadores."
                },
                {
                    number: "Norma ABNT NBR 5419:2015 (Partes 1 a 4)",
                    organ: "ABNT",
                    badgeColor: "#f59e0b",
                    summary: "Proteção contra descargas atmosféricas (SPDA / Pára-raios) - gerenciamento de risco e vistorias.",
                    requirement: "Medição de resistência ôhmica com terrômetro calibrado e inspeção detalhada de captores, descidas e DPS.",
                    sanction: "Seguradoras negam 100% da indenização em caso de incêndio por raio se o laudo anual estiver vencido."
                },
                {
                    number: "Norma ABNT NBR 5410:2004",
                    organ: "ABNT",
                    badgeColor: "#0284c7",
                    summary: "Instalações elétricas de baixa tensão - requisitos de segurança e dimensionamento de condutores.",
                    requirement: "Instalação obrigatória de dispositivos de proteção contra sobretensões (DPS) e corrente de fuga (DR).",
                    sanction: "Queima de equipamentos de alta tecnologia e perda de certificações de qualidade (ISO)."
                },
                {
                    number: "Resolução Normativa ANEEL nº 1.000/2021",
                    organ: "ANEEL",
                    badgeColor: "#10b981",
                    summary: "Regras de conexão de unidades industriais à rede e requisitos de fator de potência.",
                    requirement: "Manutenção do fator de potência acima de 0,92 indutivo/capacitivo e subestação em conformidade.",
                    sanction: "Cobrança mensal abusiva por Energia Reativa Excedente na conta de luz da fábrica."
                }
            ],
            legislation: "Norma Regulamentadora NR-10 (Portaria MTE nº 598/2004); Normas ABNT NBR 5419:2015 e NBR 5410:2004; Resolução Normativa ANEEL nº 1.000/2021.",
            pricingReference: "Ticket médio: R$ 2.000 a R$ 9.000 por laudo de SPDA/NR-10 (validade anual).",
            qualificationQuestions: [
                "Qual foi a data da última medição ôhmica do sistema de aterramento da sua planta?",
                "Sua apólice de seguro contra incêndio exige o Laudo de SPDA atualizado anualmente?",
                "A empresa já possui o Prontuário das Instalações Elétricas (PIE) exigido pela NR-10?"
            ],
            salesPitch: "Olá [Nome]! Você sabia que se cair um raio e sua empresa não tiver o laudo anual de SPDA conforme a NBR 5419 e NR-10 com ART, a seguradora pode negar 100% da indenização por danos elétricos ou incêndio? Nossa equipe de engenheiros eletricistas realiza a medição e emite o laudo oficial em poucos dias. Vamos proteger seu patrimônio?",
            objectionsAndAnswers: [
                {
                    objection: "Nunca caiu um raio aqui, o pára-raios está lá há anos intacto.",
                    answer: "A maresia, chuva e oxidação corroem cabos e conexões de descida com o tempo. Mesmo com o captor no teto, se o aterramento estiver rompido, a descarga elétrica desce pela fiação da fábrica e queima todas as máquinas. A medição periódica garante que o sistema realmente funciona."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_avcb",
            company: "Veeluen Solutions",
            category: "Segurança Contra Incêndio",
            title: "Projetos de Incêndio e Aprovação no Bombeiros (AVCB / PPCI)",
            badge: "Alvará Bombeiros",
            icon: "🚒",
            color: "#e11d48",
            bgLight: "rgba(225, 29, 72, 0.12)",
            shortSummary: "Elaboração de projetos de hidrantes, extintores, sprinklers, rotas de fuga e aprovação junto ao Corpo de Bombeiros.",
            fullDescription: "Desenvolvimento do Projeto de Segurança Contra Incêndio e Pânico (PPCI) e acompanhamento de todo o trâmite até a emissão ou renovação do Auto de Vistoria do Corpo de Bombeiros (AVCB / AVCBH). Dimensiona a rede de hidrantes, bombas de incêndio, reserva técnica de água, iluminação de emergência e saídas de emergência.",
            targetAudience: [
                "Edifícios comerciais, indústrias e galpões logísticos",
                "Boates, restaurantes, casas de recepção e buffets",
                "Escolas, universidades e hospitais",
                "Empresas notificadas com prazo de interdição pelo Corpo de Bombeiros"
            ],
            clientPain: "Alvará de funcionamento da prefeitura bloqueado e ameaça de interdição e lacre pelo Corpo de Bombeiros por falta do AVCB.",
            resolutions: [
                "Decreto COSCIP / CBMPE",
                "Lei Federal 13.425/2017 (Lei Kiss)",
                "Instruções Técnicas CBM",
                "ABNT NBR 9077/13714"
            ],
            resolutionsDetails: [
                {
                    number: "Decreto Estadual COSCIP / CBMPE",
                    organ: "Corpo de Bombeiros Militar",
                    badgeColor: "#e11d48",
                    summary: "Código de Segurança Contra Incêndio e Pânico do Estado de Pernambuco.",
                    requirement: "Elaboração de Projeto de Prevenção e Combate a Incêndio (PPCI) e vistoria para obtenção do AVCB/CLCB.",
                    sanction: "Lacre do imóvel, interdição pelo Corpo de Bombeiros e cancelamento do Alvará de Funcionamento da Prefeitura."
                },
                {
                    number: "Lei Federal nº 13.425/2017 (Lei Kiss)",
                    organ: "Congresso Nacional",
                    badgeColor: "#e11d48",
                    summary: "Diretrizes gerais sobre prevenção e combate a incêndio e desastres em estabelecimentos e edificações.",
                    requirement: "Responsabilidade solidária dos gestores pelo cumprimento incondicional das medidas preventivas de pânico.",
                    sanction: "Responsabilização penal dos proprietários e administradores por negligência ou dolo eventual em sinistros."
                },
                {
                    number: "Instruções Técnicas (ITs) do Corpo de Bombeiros",
                    organ: "CBM / COBOM",
                    badgeColor: "#0284c7",
                    summary: "Instruções normativas detalhadas de dimensionamento de hidrantes, extintores, sprinklers e saídas de emergência.",
                    requirement: "Cálculo preciso de vazão, pressão das bombas e autonomia da Reserva Técnica de Incêndio (RTI).",
                    sanction: "Reprovação imediata na vistoria dos Bombeiros caso as pressões ou mangueiras estejam fora de conformidade."
                },
                {
                    number: "Normas ABNT NBR 9077 e NBR 13714",
                    organ: "ABNT",
                    badgeColor: "#10b981",
                    summary: "Dimensionamento de saídas de emergência em edifícios e sistemas de combate a incêndio por hidrantes.",
                    requirement: "Rotas de fuga desobstruídas, portas corta-fogo certificadas e esguichos reguláveis com engate rápido Storz.",
                    sanction: "Impedimento de obtenção do Habite-se e bloqueio da contratação de apólices de seguro patrimonial."
                }
            ],
            legislation: "Decreto Estadual COSCIP / CBMPE; Lei Federal nº 13.425/2017 (Lei Kiss); Instruções Técnicas do CBM; Normas ABNT NBR 9077 e NBR 13714.",
            pricingReference: "Ticket médio: R$ 4.000 a R$ 35.000 (depende da área construída e risco de carga de incêndio).",
            qualificationQuestions: [
                "Qual é a área total construída do imóvel?",
                "O imóvel já possui sistema de hidrantes instalado ou apenas extintores?",
                "Seu AVCB está vencido ou é uma primeira solicitação de projeto?"
            ],
            salesPitch: "Olá [Nome]! O AVCB é o documento mais importante para manter sua empresa aberta e com alvará da prefeitura liberado conforme o COSCIP e a Lei Federal 13.425/17. Na Veeluen cuidamos do projeto arquitetônico de bombeiros, dimensionamento de hidrantes e acompanhamos a vistoria do oficial dos Bombeiros até a entrega da sua licença aprovada.",
            objectionsAndAnswers: [
                {
                    objection: "Os Bombeiros demoram muito para aprovar.",
                    answer: "Geralmente a demora ocorre quando o projeto é protocolado com inconsistências técnicas ou sem cumprir as Instruções Técnicas estaduais. Nossos engenheiros conhecem os critérios de aprovação detalhados, o que encurta o prazo para seu alvará sair sem dores de cabeça."
                }
            ],
            calculatorRoute: "#calculators"
        },
        {
            id: "srv_pmoc",
            company: "Veeluen Solutions",
            category: "Climatização & Saúde",
            title: "PMOC — Plano de Manutenção de Ar Condicionado (Lei 13.589)",
            badge: "Lei Federal 13.589",
            icon: "❄️",
            color: "#38bdf8",
            bgLight: "rgba(56, 189, 248, 0.12)",
            shortSummary: "Elaboração do PMOC obrigatório para sistemas de climatização com capacidade superior a 60.000 BTU/h.",
            fullDescription: "O PMOC (Plano de Manutenção, Operação e Controle) é uma exigência da Lei Federal nº 13.589/2018 para todos os edifícios públicos e privados de uso coletivo que possuem climatização artificial. O objetivo é garantir a qualidade do ar interior, eliminando fungos, bactérias e poluentes que causam a síndrome dos edifícios doentes.",
            targetAudience: [
                "Escritórios corporativos, coworkings e agências bancárias",
                "Clínicas médicas, odontológicas e laboratórios de análise",
                "Hotéis, pousadas e academias de ginástica",
                "Restaurantes, shoppings e centros comerciais",
                "Indústrias com salas limpas ou escritórios administrativos"
            ],
            clientPain: "Fiscalização da Vigilância Sanitária (ANVISA) e multas pesadas que variam de R$ 2.000 até R$ 1.500.000 por descumprimento da Lei Federal do PMOC.",
            resolutions: [
                "Resolução ANVISA RE nº 09/2003",
                "Lei Federal 13.589/2018",
                "Portaria MS nº 3.523/1998",
                "Resolução CONFEA nº 218/1973"
            ],
            resolutionsDetails: [
                {
                    number: "Resolução RE nº 09/2003 da ANVISA",
                    organ: "ANVISA",
                    badgeColor: "#38bdf8",
                    summary: "Estabelece os Padrões Referenciais de Qualidade do Ar Interior em ambientes climatizados artificialmente.",
                    requirement: "Análise semestral microbiológica do ar (fungos, bactérias, aerodispersóides e CO2) emitida por laboratório certificado.",
                    sanction: "Multas pesadas da Vigilância Sanitária de R$ 2.000 a R$ 1.500.000 conforme Lei Federal nº 6.437/1977."
                },
                {
                    number: "Lei Federal nº 13.589/2018",
                    organ: "Congresso Nacional",
                    badgeColor: "#38bdf8",
                    summary: "Torna compulsório o PMOC em todos os edifícios públicos e privados com capacidade a partir de 60.000 BTUs.",
                    requirement: "Elaboração formal do plano, fichas de manutenção preventiva mensal e ART emitida por Engenheiro Mecânico.",
                    sanction: "Interdição do sistema de ar condicionado e autuação sanitária gravíssima."
                },
                {
                    number: "Portaria Ministério da Saúde nº 3.523/1998",
                    organ: "Ministério da Saúde",
                    badgeColor: "#0284c7",
                    summary: "Regulamento técnico de higienização dos sistemas de climatização para prevenção da Síndrome dos Edifícios Doentes.",
                    requirement: "Limpeza periódica obrigatória de bandejas de condensado, dutos e trocas programadas de filtros de ar.",
                    sanction: "Ações trabalhistas indenizatórias por contaminação respiratória crônica de colaboradores."
                },
                {
                    number: "Resolução CONFEA nº 218/1973",
                    organ: "CONFEA / CREA",
                    badgeColor: "#4f46e5",
                    summary: "Define que a responsabilidade técnica e assinatura da ART do PMOC é atribuição do Engenheiro Mecânico.",
                    requirement: "Anotação de Responsabilidade Técnica (ART) válida registrada junto ao CREA estadual.",
                    sanction: "Planos assinados por técnicos de refrigeração sem Engenheiro Mecânico são nulos perante a ANVISA."
                }
            ],
            legislation: "Resolução RE nº 09/2003 da ANVISA; Lei Federal nº 13.589/2018; Portaria Ministério da Saúde nº 3.523/1998; Resolução CONFEA nº 218/1973.",
            pricingReference: "Ticket médio: R$ 800 a R$ 4.000/mês (manutenção e laudos semestrais de qualidade do ar).",
            qualificationQuestions: [
                "Qual é a soma aproximada da capacidade de todos os aparelhos de ar condicionado da empresa (supera 5 TR ou 60.000 BTUs)?",
                "A empresa já possui Engenheiro Mecânico emitindo ART para o sistema de climatização?",
                "Já foi realizada análise microbiológica laboratorial do ar respirável nos últimos 6 meses?"
            ],
            salesPitch: "Olá [Nome]! Pela Lei Federal 13.589 e Resolução ANVISA RE nº 09/03, qualquer empresa com ar condicionado acima de 60.000 BTUs precisa ter o PMOC assinado por Engenheiro Mecânico com laudo de qualidade do ar semestral. A Vigilância Sanitária tem multado pesado empresas sem esse plano. Nós estruturamos seu PMOC completo, cronograma de higienização e análises do ar com ART.",
            objectionsAndAnswers: [
                {
                    objection: "Já tenho um técnico que limpa os filtros todo mês.",
                    answer: "A limpeza é essencial, mas perante a Lei e a ANVISA, o técnico de refrigeração não pode assinar a responsabilidade técnica do PMOC. A Lei exige expressamente a ART emitida por Engenheiro Mecânico habilitado."
                }
            ],
            calculatorRoute: "#calculators"
        }
    ],

    init() {
        this.renderServices();
        if (!this._eventsBound) {
            this.bindEvents();
            this._eventsBound = true;
        }
    },

    bindEvents() {
        // Busca em tempo real
        const searchInput = document.getElementById("learning-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this._searchQuery = e.target.value.toLowerCase().trim();
                this.renderServices();
            });
        }

        // Seletor de Empresa (Veeluen / Excelência / Todas)
        const companyBtns = document.querySelectorAll(".learning-company-pill");
        companyBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                companyBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this._activeCompany = btn.getAttribute("data-company") || "all";
                this.renderServices();
            });
        });

        // Fechar Modal
        const btnClose = document.getElementById("btn-close-learning-modal");
        const overlay = document.getElementById("learning-modal-overlay");
        if (btnClose) btnClose.addEventListener("click", () => this.closeDetailModal());
        if (overlay) overlay.addEventListener("click", () => this.closeDetailModal());

        // Escutar tecla ESC para fechar modal
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeDetailModal();
            }
        });
    },

    getFilteredServices() {
        return this.services.filter(s => {
            // Filtro por Empresa
            if (this._activeCompany !== "all" && s.company !== this._activeCompany) {
                return false;
            }

            // Filtro por Categoria
            if (this._activeCategory !== "all" && s.category !== this._activeCategory) {
                return false;
            }

            // Filtro por Busca de Texto
            if (this._searchQuery) {
                const q = this._searchQuery;
                const matchTitle = s.title.toLowerCase().includes(q);
                const matchSummary = s.shortSummary.toLowerCase().includes(q);
                const matchCompany = s.company.toLowerCase().includes(q);
                const matchDesc = s.fullDescription.toLowerCase().includes(q);
                const matchAudience = s.targetAudience.some(a => a.toLowerCase().includes(q));
                const matchLegislation = (s.legislation || "").toLowerCase().includes(q);
                const matchResolutions = (s.resolutions || []).some(r => r.toLowerCase().includes(q)) ||
                                         (s.resolutionsDetails || []).some(rd => rd.number.toLowerCase().includes(q) || rd.organ.toLowerCase().includes(q) || rd.summary.toLowerCase().includes(q) || rd.requirement.toLowerCase().includes(q));

                if (!matchTitle && !matchSummary && !matchCompany && !matchDesc && !matchAudience && !matchLegislation && !matchResolutions) {
                    return false;
                }
            }

            return true;
        });
    },

    renderServices() {
        const grid = document.getElementById("learning-services-grid");
        const countBadge = document.getElementById("learning-count-badge");
        if (!grid) return;

        const filtered = this.getFilteredServices();

        if (countBadge) {
            countBadge.textContent = `${filtered.length} serviço${filtered.length !== 1 ? 's' : ''} disponível${filtered.length !== 1 ? 'is' : ''}`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 16px;">
                    <div style="font-size: 36px; margin-bottom: 12px;">🔍</div>
                    <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px;">Nenhum serviço encontrado</h3>
                    <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 16px;">Tente pesquisar por outros termos como "chaminé", "solar", "resíduos", "nr13" ou limpe a busca.</p>
                    <button class="btn btn-outline" onclick="document.getElementById('learning-search-input').value=''; window.Learning._searchQuery=''; window.Learning.renderServices();" style="font-size: 12px;">Limpar Filtros</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(s => {
            const isExcelencia = s.company === "Excelência Ambiental";
            const companyColor = isExcelencia ? "#10b981" : "#3b82f6";
            const companyBg = isExcelencia ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)";
            const hasCalc = ["srv_isocinetica", "srv_solar", "srv_ete", "srv_licenciamento", "srv_residuos", "srv_nr13"].includes(s.id);
            const calcBtnText = s.id === "srv_isocinetica" ? "🧮 Calculadora" : (hasCalc ? "🧮 Calcular" : "📄 Orçar");

            return `
                <div class="learning-service-card" onclick="window.Learning.openServiceDetail('${s.id}')" style="cursor: pointer; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; transition: all 0.25s ease; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${s.color};"></div>
                    
                    <div>
                        <!-- Header do Card: Ícone e Badges -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; background: ${s.bgLight}; color: ${s.color}; flex-shrink: 0; border: 1px solid ${s.color}25;">
                                ${s.icon}
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: ${companyBg}; color: ${companyColor}; border: 1px solid ${companyColor}30;">
                                    ${isExcelencia ? '🌿' : '🏢'} ${s.company}
                                </span>
                                <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.05); color: var(--text-secondary);">
                                    ${s.badge}
                                </span>
                            </div>
                        </div>

                        <!-- Título e Resumo -->
                        <h3 style="font-size: 16px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px; line-height: 1.35;">
                            ${s.title}
                        </h3>
                        <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${s.shortSummary}
                        </p>

                        <!-- Bloco de Resoluções & Base Legal no Card -->
                        <div style="background: rgba(99, 102, 241, 0.04); border: 1px solid rgba(99, 102, 241, 0.16); border-radius: 10px; padding: 9px 12px; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                <span style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary); display: flex; align-items: center; gap: 4px;">
                                    <span>📜</span> Resoluções & Base Legal
                                </span>
                                <span style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); background: var(--bg-surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-color);">
                                    ${(s.resolutions || []).length} normas
                                </span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                ${(s.resolutions || []).map(r => `
                                    <span style="font-size: 10px; font-weight: 700; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); padding: 2px 7px; border-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                        ${r}
                                    </span>
                                `).join("")}
                            </div>
                        </div>
                    </div>

                    <!-- Footer do Card com Ações Rápidas -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); window.Learning.openCalculatorForService('${s.id}')" style="font-size: 11px; padding: 4px 10px; height: 28px; font-weight: 700; border-color: ${s.color}60; color: ${s.color}; background: ${s.bgLight}; border-radius: 7px; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" title="${hasCalc ? 'Abrir calculadora técnica do serviço' : 'Gerar proposta pré-configurada'}">
                            <span>${calcBtnText}</span>
                        </button>
                        <span style="font-size: 11.5px; font-weight: 700; color: ${s.color}; display: flex; align-items: center; gap: 4px;">
                            📖 Guia &rarr;
                        </span>
                    </div>
                </div>
            `;
        }).join("");
    },

    openServiceDetail(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        this._activeServiceId = serviceId;

        const modal = document.getElementById("modal-learning-detail");
        const overlay = document.getElementById("learning-modal-overlay");
        const bodyEl = document.getElementById("learning-modal-body");
        if (!modal || !bodyEl) return;

        const isExcelencia = s.company === "Excelência Ambiental";
        const companyColor = isExcelencia ? "#10b981" : "#3b82f6";
        const companyBg = isExcelencia ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)";
        const hasCalc = ["srv_isocinetica", "srv_solar", "srv_ete", "srv_licenciamento", "srv_residuos", "srv_nr13"].includes(s.id);

        bodyEl.innerHTML = `
            <!-- Topo com Ícone e Cabeçalho -->
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 58px; height: 58px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 30px; background: ${s.bgLight}; color: ${s.color}; border: 1px solid ${s.color}35;">
                        ${s.icon}
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                            <span style="font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 6px; background: ${companyBg}; color: ${companyColor}; border: 1px solid ${companyColor}30;">
                                ${isExcelencia ? '🌿' : '🏢'} ${s.company}
                            </span>
                            <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: rgba(99,102,241,0.1); color: var(--primary);">
                                ${s.category}
                            </span>
                            <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: rgba(245,158,11,0.12); color: #d97706;">
                                ${s.badge}
                            </span>
                        </div>
                        <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0;">
                            ${s.title}
                        </h2>
                    </div>
                </div>
            </div>

            <!-- Grid de Explicação Técnica & Comercial -->
            <div style="display: flex; flex-direction: column; gap: 24px;">

                <!-- 1. O QUE É O SERVIÇO -->
                <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px;">
                    <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin: 0 0 8px; display: flex; align-items: center; gap: 8px;">
                        <span>🎯</span> O Que É Este Serviço?
                    </h4>
                    <p style="font-size: 13px; line-height: 1.6; color: var(--text-secondary); margin: 0;">
                        ${s.fullDescription}
                    </p>
                </div>

                <!-- 2. A DOR DO CLIENTE & QUANDO INDICAR -->
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 14px; padding: 18px;">
                    <h4 style="font-size: 13.5px; font-weight: 800; color: #dc2626; margin: 0 0 8px; display: flex; align-items: center; gap: 8px;">
                        <span>🚨</span> Quando Indicar / A Dor do Cliente
                    </h4>
                    <p style="font-size: 13px; line-height: 1.6; color: var(--text-primary); margin: 0; font-weight: 500;">
                        ${s.clientPain}
                    </p>
                </div>

                <!-- 3. QUEM COMPRA (PÚBLICO-ALVO) -->
                <div>
                    <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin: 0 0 12px; display: flex; align-items: center; gap: 8px;">
                        <span>🏢</span> Quem São os Clientes-Alvo? (Nichos Compradores)
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px;">
                        ${s.targetAudience.map(aud => `
                            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span style="color: ${s.color}; font-weight: 800;">✓</span> ${aud}
                            </div>
                        `).join("")}
                    </div>
                </div>

                <!-- 4. RESOLUÇÕES OFICIAIS & LEGISLAÇÃO OBRIGATÓRIA -->
                <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.22); border-radius: 16px; padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                        <h4 style="font-size: 14px; font-weight: 800; color: var(--primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                            <span>⚖️</span> Resoluções Oficiais & Legislação Obrigatória
                        </h4>
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.Learning.copyResolutions('${s.id}')" style="font-size: 11px; padding: 4px 10px; height: 28px; gap: 4px; border-color: var(--primary); color: var(--primary); font-weight: 700; background: var(--bg-surface);">
                            📋 Copiar Resoluções
                        </button>
                    </div>

                    <!-- Cards de cada Resolução Específica -->
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;">
                        ${(s.resolutionsDetails || []).map(rd => `
                            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
                                    <span style="font-size: 13px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                                        <span style="color: ${rd.badgeColor || 'var(--primary)'};">📜</span> ${rd.number}
                                    </span>
                                    <span style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 5px; background: rgba(99, 102, 241, 0.1); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.2);">
                                        ${rd.organ}
                                    </span>
                                </div>
                                <p style="font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); margin: 0 0 6px;">
                                    ${rd.summary}
                                </p>
                                <div style="display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--text-primary); line-height: 1.45; background: var(--bg-app); padding: 8px 10px; border-radius: 8px; border-left: 3px solid ${rd.badgeColor || 'var(--primary)'};">
                                    <span><strong>Exigência / Penalidade:</strong> ${rd.requirement} ${rd.sanction ? `<em style="color:#e11d48;">(${rd.sanction})</em>` : ''}</span>
                                </div>
                            </div>
                        `).join("")}
                    </div>

                    <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                        <span>💡</span> <strong>Argumentação Técnica:</strong> Mencione o número da Resolução ou Portaria durante a conversa para comprovar obrigatoriedade legal e neutralizar objeções de preço.
                    </div>
                </div>

                <!-- 5. SCRIPT DE ABORDAGEM & PITCH DE VENDAS -->
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; position: relative;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <h4 style="font-size: 13.5px; font-weight: 800; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px;">
                            <span>💬</span> Script de Abordagem para WhatsApp & Telefone
                        </h4>
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.Learning.copyPitch('${s.id}')" style="font-size: 11px; padding: 4px 10px; height: 28px; gap: 4px; border-color: #94a3b8; color: #334155; font-weight: 700;">
                            📋 Copiar Pitch
                        </button>
                    </div>
                    <div id="pitch-text-${s.id}" style="font-size: 13px; line-height: 1.6; color: #334155; font-style: italic; background: #fff; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
                        "${s.salesPitch}"
                    </div>
                </div>

                <!-- 6. PERGUNTAS DE QUALIFICAÇÃO -->
                <div>
                    <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin: 0 0 10px; display: flex; align-items: center; gap: 8px;">
                        <span>❓</span> O Que Perguntar para o Cliente? (Perguntas de Qualificação)
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${s.qualificationQuestions.map((q, idx) => `
                            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px; font-size: 12.5px; color: var(--text-primary); display: flex; align-items: flex-start; gap: 10px;">
                                <span style="font-weight: 800; color: var(--primary); font-size: 13px;">${idx + 1}.</span>
                                <span>${q}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <!-- 7. COMO CONTORNAR OBJEÇÕES COMUNS -->
                ${s.objectionsAndAnswers && s.objectionsAndAnswers.length > 0 ? `
                    <div>
                        <h4 style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin: 0 0 10px; display: flex; align-items: center; gap: 8px;">
                            <span>🛡️</span> Principais Objeções e Como Responder
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${s.objectionsAndAnswers.map(obj => `
                                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px;">
                                    <div style="font-size: 12.5px; font-weight: 800; color: #e11d48; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                        <span>✕ Objeção:</span> "${obj.objection}"
                                    </div>
                                    <div style="font-size: 12.5px; color: var(--text-primary); line-height: 1.5; padding-left: 12px; border-left: 2px solid #10b981;">
                                        <strong>Como responder:</strong> ${obj.answer}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                ` : ''}

                <!-- 8. REFERÊNCIA DE PREÇO & PRAZO -->
                <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                            Referência de Preço / Prazo
                        </div>
                        <div style="font-size: 13.5px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                            ${s.pricingReference}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-outline" onclick="window.Learning.openLeadForService('${s.id}')" style="font-size: 11.5px; padding: 7px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                            <span>🎯</span> Cadastrar Lead
                        </button>
                        ${hasCalc ? `
                            <button type="button" class="btn btn-outline" onclick="window.Learning.openCalculatorForService('${s.id}')" style="font-size: 11.5px; padding: 7px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; border-color: ${s.color}; color: ${s.color}; background: ${s.bgLight};">
                                <span>🧮</span> Abrir Calculadora
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-primary" onclick="window.Learning.openProposalForService('${s.id}')" style="font-size: 11.5px; padding: 7px 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; background: ${s.color}; border-color: ${s.color};">
                            <span>📄</span> Gerar Proposta Direta
                        </button>
                    </div>
                </div>

            </div>
        `;

        if (overlay) overlay.style.display = "block";
        modal.classList.add("open");
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    },

    closeDetailModal() {
        const modal = document.getElementById("modal-learning-detail");
        const overlay = document.getElementById("learning-modal-overlay");
        if (modal) {
            modal.classList.remove("open");
            modal.style.display = "none";
        }
        if (overlay) {
            overlay.style.display = "none";
        }
        document.body.style.overflow = "";
        this._activeServiceId = null;
    },

    copyResolutions(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        const text = `📜 *Resoluções & Base Legal — ${s.title}*\n\n` +
            (s.resolutionsDetails || []).map(r => `• *${r.number}* (${r.organ})\n  ${r.summary}\n  _Exigência / Risco:_ ${r.requirement} ${r.sanction ? `(${r.sanction})` : ''}`).join("\n\n") +
            `\n\n📌 *Empresa responsável:* ${s.company}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                Toast.success("Resoluções Copiadas!", "A base legal completa foi copiada para a área de transferência.");
            }).catch(() => {
                alert("Resoluções:\n\n" + text);
            });
        } else {
            alert("Resoluções:\n\n" + text);
        }
    },

    copyPitch(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        navigator.clipboard.writeText(s.salesPitch).then(() => {
            Toast.success("Script Copiado!", "O pitch de vendas foi copiado para a sua área de transferência.");
        }).catch(() => {
            alert("Pitch copiado: " + s.salesPitch);
        });
    },

    extractReferencePrice(refString) {
        if (!refString) return 0;
        const match = refString.match(/R\$\s*([0-9.]+)/i);
        if (match && match[1]) {
            const cleanNum = match[1].replace(/\./g, "");
            const parsed = parseFloat(cleanNum);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    },

    openLeadForService(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        this.closeDetailModal();

        window.location.hash = "#crm";
        setTimeout(() => {
            if (window.CRM && window.CRM.openNewLeadModal) {
                window.CRM.openNewLeadModal({
                    service: s.title,
                    company: s.company,
                    priceRef: s.pricingReference,
                    segment: s.category || "Outros",
                    source: "Outbound",
                    notes: "Qualificação inicial orientada pelo Manual de Serviços:\n" +
                        s.qualificationQuestions.slice(0, 3).map((q, i) => `${i + 1}. ${q}`).join("\n")
                });
                if (window.Toast) Toast.success("Novo Lead Iniciado!", `Formulário preparado para o serviço: ${s.title}`);
            }
        }, 300);
    },

    openCalculatorForService(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        this.closeDetailModal();

        // 1. Isocinética
        if (s.id === "srv_isocinetica" || s.calculatorRoute === "#isocinetica") {
            window.location.hash = "#isocinetica";
            if (window.Toast) Toast.info("Calculadora Isocinética", "Dimensionamento técnico de chaminés pronto para uso.");
            return;
        }

        // 2. Calculadoras modais integradas (Solar, ETE, Licenciamento, Resíduos, NR-13)
        const calcKeyMap = {
            "srv_solar": "solar",
            "srv_ete": "ete",
            "srv_licenciamento": "licensing",
            "srv_residuos": "waste",
            "srv_nr13": "nr13"
        };

        const calcKey = calcKeyMap[s.id];
        if (calcKey) {
            window.location.hash = "#calculators";
            setTimeout(() => {
                const calcObj = window.Calculators || Calculators;
                if (calcObj && calcObj.openCalculator) {
                    calcObj.openCalculator(calcKey);
                    if (window.Toast) Toast.info("Calculadora Técnica", `Calculadora de ${s.title} aberta para dimensionamento.`);
                }
            }, 150);
            return;
        }

        // Se não possuir calculadora matemática dedicada, direciona diretamente para o orçamento completo pré-configurado
        this.openProposalForService(serviceId);
    },

    openProposalForService(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        this.closeDetailModal();

        // Alinhar empresa/workspace
        if (s.company) {
            localStorage.setItem("activeCompany", s.company);
            if (window.Store && typeof window.Store.setActiveCompany === "function") {
                window.Store.setActiveCompany(s.company);
            }
        }

        const suggestedPrice = this.extractReferencePrice(s.pricingReference);
        const resText = (s.resolutions || []).join(", ");
        const isExcelencia = s.company === "Excelência Ambiental";

        const introText = isExcelencia 
            ? `A EXCELÊNCIA AMBIENTAL é uma empresa de engenharia e consultoria especializada em soluções ambientais, laudos técnicos laboratoriais, amostragem isocinética de emissões atmosféricas, gestão de efluentes e licenciamento ambiental com registro no CREA e CRQ.`
            : `A VEELUEN Solutions é uma empresa com mais de 12 anos de mercado especializada em engenharia mecânica, segurança do trabalho (NR-13, NR-10, AVCB), energia solar fotovoltaica e obras industriais com registro no CREA.`;

        // Construir descrição técnica robusta com as Resoluções
        let techDescription = `SERVIÇO TÉCNICO ESPECIALIZADO: ${s.title.toUpperCase()}\n\n` +
            `1. EMBASAMENTO TÉCNICO & RESOLUÇÕES OFICIAIS:\n` +
            (s.resolutionsDetails || []).map(r => `• ${r.number} (${r.organ}): ${r.summary}\n  Exigência legal: ${r.requirement}`).join("\n") +
            `\n\n2. ESCOPO DOS TRABALHOS:\n${s.fullDescription}\n\n` +
            `3. RESPONSABILIDADE TÉCNICA:\nEmissão de Anotação de Responsabilidade Técnica (ART/AFT) junto ao conselho de classe competente (CREA/CRQ), garantindo 100% de conformidade legal perante os órgãos de fiscalização.`;

        let serviceNotes = `Previsão de execução: ${s.pricingReference.includes("Prazo") ? s.pricingReference.split("Prazo")[1].replace(/^[:\s-]+/, "") : "Conforme cronograma técnico alinhado com o cliente."}\nCondições de pagamento: 50% de entrada + 50% na conclusão e entrega da ART homologada.`;

        const initialPayload = {
            company: "",
            workspace: s.company,
            techDescription,
            intro: introText,
            notes: serviceNotes,
            serviceDetails: `Atendimento técnico especializado conforme ${resText || s.legislation}`
        };

        window.location.hash = "#proposals";
        setTimeout(() => {
            if (window.Proposals && window.Proposals.openBudgetScreen) {
                window.Proposals.openBudgetScreen(null, null, s.title, suggestedPrice, initialPayload);
                
                // Garantir preenchimento dos campos no DOM
                const techEl = document.getElementById("gc-budget-tech-desc");
                if (techEl) techEl.value = techDescription;
                const introEl = document.getElementById("gc-budget-intro");
                if (introEl) introEl.value = introText;
                const notesEl = document.getElementById("gc-budget-notes");
                if (notesEl) notesEl.value = serviceNotes;

                if (window.Toast) Toast.success("Orçamento Inicializado!", `Serviço "${s.title}" pré-configurado com as resoluções aplicáveis.`);
            }
        }, 350);
    }
};

window.Learning = Learning;
