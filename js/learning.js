/**
 * Vellia CRM — Base de Conhecimento & Treinamento de Serviços
 * Catálogo inteligente de soluções da Veeluen Solutions e Excelência Ambiental
 * para capacitação, argumentação de vendas, objeções e scripts práticos.
 */

import { Auth } from "./auth.js";
import { Toast } from "./toast.js";

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
            legislation: "Resoluções CONAMA nº 382/2006 e nº 436/2011; Normas ABNT NBR 10701, NBR 11966, NBR 11967, NBR 12019, NBR 12020 e NBR 12021; Portarias estaduais (ex: CPRH).",
            pricingReference: "Ticket médio: R$ 4.500 a R$ 15.000 por chaminé analisada (depende dos parâmetros e altura). Prazo de execução: 2 a 5 dias de campo + 10 dias de laudo.",
            qualificationQuestions: [
                "Quantas chaminés ativas sua empresa possui em operação?",
                "Qual é o combustível utilizado nos fornos ou caldeiras (lenha, gás natural, BPF, biomassa)?",
                "A chaminé já possui plataforma de amostragem e bocais conforme a NBR 10701 instalados?",
                "Qual é o prazo exigido pelo órgão ambiental no condicionante da sua Licença de Operação?"
            ],
            salesPitch: "Olá [Nome], tudo bem? Notei que sua indústria opera caldeiras/fornos. O órgão ambiental exige periodicamente o Laudo de Amostragem Isocinética para a renovação da sua Licença de Operação. Nós da Excelência Ambiental somos especialistas certificados com laboratório de ponta. Conseguimos realizar a coleta em campo sem interromper sua produção e emitir o laudo técnico completo com ART com rapidez para você não correr risco de penalidades. Podemos agendar uma visita técnica gratuita?",
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
            legislation: "Lei Federal nº 6.938/1981 (Política Nacional do Meio Ambiente); Resoluções CONAMA nº 001/86 e nº 237/97; Lei Complementar 140/2011.",
            pricingReference: "Ticket médio: R$ 6.000 a R$ 45.000 (depende do porte e potencial poluidor). Prazo: 3 a 12 meses até emissão pelo órgão.",
            qualificationQuestions: [
                "Qual é o status atual da sua licença (nova instalação, renovação ou regularização)?",
                "Sua empresa já recebeu algum auto de infração ou termo de compromisso ambiental?",
                "Qual é a área total construída e o segmento exato da atividade?"
            ],
            salesPitch: "Olá [Nome]! Para garantir que sua empresa possa operar 100% legalizada, sem riscos de interdição e apta a obter financiamentos, cuidamos de todo o processo de Licenciamento Ambiental de ponta a ponta junto à CPRH e órgãos competentes. Elaboramos todos os estudos, plantas e ARTs necessários.",
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
            legislation: "Resolução CONAMA nº 430/2011; Resolução CONAMA nº 357/2005; Legislações estaduais de recursos hídricos.",
            pricingReference: "Mensalidade de operação: R$ 3.500 a R$ 18.000/mês. Laudos pontuais: R$ 1.200 a R$ 4.000.",
            qualificationQuestions: [
                "Qual é a vazão média diária da sua ETE (em metros cúbicos/dia)?",
                "Qual é a principal matéria-prima geradora do efluente (gordura, sangue, químicos, sanitário)?",
                "A empresa já possui operador fixo ou precisa de fornecimento de químicos e responsável técnico (CRQ)?"
            ],
            salesPitch: "Olá [Nome]! Uma ETE desregulada gera custos enormes em produtos químicos jogados fora e o risco de ser autuado pela CPRH. Nós assumimos a responsabilidade técnica e química da sua estação, garantindo efluente cristalino dentro dos padrões e laudos periódicos com ART.",
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
            legislation: "Lei Federal nº 12.305/2010 (PNRS); Portaria MMA nº 280/2020 (MTR Nacional); NBR 10004 (Classificação de Resíduos).",
            pricingReference: "PGRS avulso: R$ 3.000 a R$ 12.000. Gestão mensal de resíduos e MTR: R$ 1.500 a R$ 5.000/mês.",
            qualificationQuestions: [
                "Quais os principais tipos de resíduos gerados (óleo usado, estopas, borra, plástico, orgânico)?",
                "Sua empresa já está cadastrada no sistema SINIR / MTR online?",
                "Possui empresa homologada para coleta e certificado de destinação final (CDF)?"
            ],
            salesPitch: "Olá [Nome]! O descarte irregular de resíduos industriais pode enquadrar os sócios na Lei de Crimes Ambientais. Elaboramos seu PGRS completo e gerenciamos suas emissões de MTR e CDFs para que sua empresa fique 100% blindada contra multas.",
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
            legislation: "Normas ABNT NBR 10151:2019 (Acústica - Medição e avaliação de níveis de pressão sonora em áreas habitadas) e NBR 10152; Resolução CONAMA nº 001/90.",
            pricingReference: "Ticket médio: R$ 2.500 a R$ 8.000 por ponto de medição (diurno e noturno).",
            qualificationQuestions: [
                "A medição é solicitada por condicionante da licença ou por denúncia/reclamação de vizinhos?",
                "A fonte de ruído opera no período noturno (após 22h)?",
                "O local possui gerador, chillers ou exaustores instalados em área externa?"
            ],
            salesPitch: "Olá [Nome]! Para resolver denúncias de barulho ou atender exigências da CPRH, emitimos Laudo Acústico NBR 10151 com equipamento calibrado pelo INMETRO e ART. Comprovamos tecnicamente se sua empresa está dentro dos limites de decibéis permitidos por lei.",
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
            legislation: "Lei Federal nº 9.433/1997 (Política Nacional de Recursos Hídricos); Resoluções dos órgãos estaduais gestores de águas (ex: APAC-PE).",
            pricingReference: "Ticket médio: R$ 5.000 a R$ 18.000 por poço (inclui teste de vazão e análises de potabilidade).",
            qualificationQuestions: [
                "O poço já está perfurado ou ainda será executado?",
                "Qual é a vazão necessária estimada (em m³/hora)?",
                "A água é usada para consumo humano, limpeza industrial ou processo produtivo?"
            ],
            salesPitch: "Olá [Nome]! Sabia que utilizar água de poço artesiano sem outorga válida gera multas pesadas e o lacre do poço? Cuidamos de todo o processo geológico, teste de vazão e protocolo da outorga junto aos órgãos hídricos para você usar sua água com tranquilidade e 100% de segurança jurídica.",
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
            legislation: "Lei Federal nº 14.300/2022 (Marco Legal da Micro e Minigeração Distribuída); Resoluções Normativas ANEEL nº 482/2012 e nº 1.000/2021.",
            pricingReference: "Ticket médio: R$ 35.000 a R$ 500.000+ (Payback médio: 2,5 a 4 anos).",
            qualificationQuestions: [
                "Qual é o valor médio da sua conta de energia nos últimos meses?",
                "Sua rede elétrica é atendida em Baixa Tensão (Grupo B) ou Alta Tensão com transformador próprio (Grupo A)?",
                "Qual é o tipo e estado da estrutura do telhado (metálico, concreto, fibrocimento) ou possui área livre em solo?"
            ],
            salesPitch: "Olá [Nome]! Avaliando o segmento da sua empresa, o gasto com energia elétrica é certamente um dos maiores custos fixos da sua operação. Com a energia solar da Veeluen Solutions, sua empresa pode economizar até 90% da fatura todo mês. O próprio valor economizado paga o financiamento do sistema e, após isso, é lucro líquido direto no caixa por mais de 25 anos. Posso fazer um estudo de viabilidade sem custo com sua última fatura de energia?",
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
            legislation: "Norma Regulamentadora NR-13 (Portaria MTP nº 1.846/2022); Código ASME Seção VIII; CLT Artigo 187 e 188.",
            pricingReference: "Ticket médio: R$ 1.200 a R$ 3.500 por compressor/vaso de pressão; R$ 4.000 a R$ 15.000 por caldeira.",
            qualificationQuestions: [
                "Quantos compressores de ar ou vasos sob pressão estão em funcionamento na sua planta?",
                "Qual foi a data da última inspeção periódica realizada e você possui o prontuário do vaso?",
                "As válvulas de segurança e manômetros possuem certificado de calibração em dia?"
            ],
            salesPitch: "Olá [Nome]! Praticamente toda indústria utiliza compressores de ar, mas muitos não sabem que a NR-13 exige que o reservatório metálico passe por inspeção de espessura por ultrassom e calibração periódica da válvula por Engenheiro Mecânico com ART. A ausência desse laudo gera multas gravíssimas e até interdição na fiscalização. A Veeluen realiza a inspeção no local com mínima parada de produção. Vamos agendar a verificação dos seus equipamentos?",
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
            legislation: "Normas da ABNT: NBR 6118 (Concreto Armado), NBR 8800 (Estruturas Metálicas), NBR 15575; Código de Obras Municipal e CREA.",
            pricingReference: "Projetos: R$ 8.000 a R$ 80.000+. Gestão/Acompanhamento de obra: R$ 5.000 a R$ 25.000/mês.",
            qualificationQuestions: [
                "Qual é a metragem quadrada pretendida da obra ou ampliação?",
                "Já possui levantamento topográfico e laudo de sondagem do solo (SPT)?",
                "Qual é a estimativa de carga ou peso das máquinas que serão instaladas no piso?"
            ],
            salesPitch: "Olá [Nome]! Uma obra industrial sem um projeto estrutural compatibilizado pode custar até 40% a mais por causa de desperdícios e retrabalhos. A equipe de engenheiros da Veeluen Solutions projeta sua fábrica ou galpão garantindo a máxima economia de aço e concreto, com segurança estrutural absoluta e ART de projeto.",
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
            legislation: "Norma Regulamentadora NR-10 (Segurança em Instalações e Serviços em Eletricidade); ABNT NBR 5419:2015 (Proteção contra Descargas Atmosféricas); ABNT NBR 5410.",
            pricingReference: "Ticket médio: R$ 2.000 a R$ 9.000 por laudo de SPDA/NR-10 (validade anual).",
            qualificationQuestions: [
                "Qual foi a data da última medição ôhmica do sistema de aterramento da sua planta?",
                "Sua apólice de seguro contra incêndio exige o Laudo de SPDA atualizado anualmente?",
                "A empresa já possui o Prontuário das Instalações Elétricas (PIE) exigido pela NR-10?"
            ],
            salesPitch: "Olá [Nome]! Você sabia que se cair um raio e sua empresa não tiver o laudo anual de SPDA conforme a NBR 5419 com ART, a seguradora pode negar 100% da indenização por danos elétricos ou incêndio? Nossa equipe de engenheiros eletricistas realiza a medição e emite o laudo oficial em poucos dias. Vamos proteger seu patrimônio?",
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
            legislation: "Código de Segurança Contra Incêndio e Pânico do Estado (COSCIP); Instruções Técnicas do Corpo de Bombeiros Militar; Normas ABNT NBR 9077, NBR 13714.",
            pricingReference: "Ticket médio: R$ 4.000 a R$ 35.000 (depende da área construída e risco de carga de incêndio).",
            qualificationQuestions: [
                "Qual é a área total construída do imóvel?",
                "O imóvel já possui sistema de hidrantes instalado ou apenas extintores?",
                "Seu AVCB está vencido ou é uma primeira solicitação de projeto?"
            ],
            salesPitch: "Olá [Nome]! O AVCB é o documento mais importante para manter sua empresa aberta e com alvará da prefeitura liberado. Na Veeluen cuidamos do projeto arquitetônico de bombeiros, dimensionamento de hidrantes e acompanhamos a vistoria do oficial dos Bombeiros até a entrega da sua licença aprovada.",
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
            legislation: "Lei Federal nº 13.589/2018; Portaria MS nº 3.523/1998; Resolução RE nº 09/2003 da ANVISA.",
            pricingReference: "Ticket médio: R$ 800 a R$ 4.000/mês (manutenção e laudos semestrais de qualidade do ar).",
            qualificationQuestions: [
                "Qual é a soma aproximada da capacidade de todos os aparelhos de ar condicionado da empresa (supera 5 TR ou 60.000 BTUs)?",
                "A empresa já possui Engenheiro Mecânico emitindo ART para o sistema de climatização?",
                "Já foi realizada análise microbiológica laboratorial do ar respirável nos últimos 6 meses?"
            ],
            salesPitch: "Olá [Nome]! Pela Lei Federal 13.589, qualquer empresa com ar condicionado acima de 60.000 BTUs precisa ter o PMOC assinado por Engenheiro Mecânico. A Vigilância Sanitária tem multado pesado empresas sem esse plano. Nós estruturamos seu PMOC completo, cronograma de trocas de filtro e análises do ar com ART.",
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
                const matchLegislation = s.legislation.toLowerCase().includes(q);

                if (!matchTitle && !matchSummary && !matchCompany && !matchDesc && !matchAudience && !matchLegislation) {
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
                        <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin: 0 0 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                            ${s.shortSummary}
                        </p>
                    </div>

                    <!-- Footer do Card -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 11.5px; font-weight: 700; color: ${s.color}; display: flex; align-items: center; gap: 4px;">
                            📖 Ver Guia & Pitch de Vendas &rarr;
                        </span>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">
                            3 min leitura
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

                <!-- 4. LEGISLAÇÃO & NORMAS COMPULSÓRIAS -->
                <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px; padding: 18px;">
                    <h4 style="font-size: 13.5px; font-weight: 800; color: var(--primary); margin: 0 0 6px; display: flex; align-items: center; gap: 8px;">
                        <span>⚖️</span> Legislação & Normas Técnicas Obrigatórias
                    </h4>
                    <p style="font-size: 12.5px; line-height: 1.5; color: var(--text-primary); margin: 0 0 8px; font-weight: 600;">
                        ${s.legislation}
                    </p>
                    <span style="font-size: 11px; color: var(--text-muted);">
                        💡 <strong>Dica de Vendedor:</strong> Mencionar a norma ou a resolução CONAMA na conversa transmite autoridade imediata ao cliente.
                    </span>
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
                    <div style="display: flex; gap: 10px;">
                        <button type="button" class="btn btn-primary" onclick="window.Learning.openProposalForService('${s.id}')" style="font-size: 12px; padding: 8px 16px;">
                            📄 Gerar Orçamento Deste Serviço
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

    copyPitch(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        navigator.clipboard.writeText(s.salesPitch).then(() => {
            Toast.success("Script Copiado!", "O pitch de vendas foi copiado para a sua área de transferência.");
        }).catch(() => {
            alert("Pitch copiado: " + s.salesPitch);
        });
    },

    openProposalForService(serviceId) {
        const s = this.services.find(srv => srv.id === serviceId);
        if (!s) return;

        this.closeDetailModal();

        // Se tiver calculadora específica (ex: isocinética)
        if (s.calculatorRoute === "#isocinetica") {
            window.location.hash = "#isocinetica";
            return;
        }

        // Navegar para propostas e abrir tela de orçamento preenchida
        window.location.hash = "#proposals";
        setTimeout(() => {
            if (window.Proposals && window.Proposals.openBudgetScreen) {
                window.Proposals.openBudgetScreen();
                const titleInput = document.getElementById("gc-budget-title");
                if (titleInput) {
                    titleInput.value = `Proposta — ${s.title}`;
                }
            }
        }, 300);
    }
};

window.Learning = Learning;
