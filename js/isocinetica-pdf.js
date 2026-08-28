/**
 * Isocinética PDF Generator
 * Integração com jsPDF para geração de Propostas Comerciais
 */

const IsocineticaPDF = {
    generateProposal: function(clientName, finalPrice) {
        if (!window.jspdf) {
            console.error("jsPDF não está carregado.");
            alert("Erro: Biblioteca PDF não carregada.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        // Configurações Globais
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPos = 20;

        // Gerar Hash de Autenticidade Único
        const authHash = `AUTH-ISO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // --- SELO DE AUTENTICIDADE TÉCNICA (Canto Superior Direito) ---
        doc.setDrawColor(24, 119, 242);
        doc.setFillColor(240, 246, 255);
        doc.roundedRect(pageWidth - 70, 12, 55, 24, 2, 2, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(24, 119, 242);
        doc.text("🛡️ SELO DE AUTENTICIDADE", pageWidth - 42.5, 17, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(51, 65, 85);
        doc.text(`HASH: ${authHash}`, pageWidth - 42.5, 22, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text("Certificado Vellia CRM • ABNT ISO 17025", pageWidth - 42.5, 27, { align: "center" });
        doc.text("Validação Digital Garantida", pageWidth - 42.5, 31, { align: "center" });

        // Estilos
        const setHeaderStyle = () => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.setTextColor(30, 41, 59); // var(--text-primary) equivalent
        };

        const setSubHeaderStyle = () => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(51, 65, 85);
        };

        const setNormalStyle = () => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105); // var(--text-muted) equivalent
        };

        // --- CAPA DA PROPOSTA ---
        setHeaderStyle();
        doc.text("PROPOSTA COMERCIAL", margin, yPos + 5);
        yPos += 12;
        
        setSubHeaderStyle();
        doc.text("Amostragem Isocinética & Monitoramento de Fontes", margin, yPos);
        yPos += 25;

        setNormalStyle();
        const dataAtual = new Date().toLocaleDateString('pt-BR');
        doc.text(`Data de Emissão: ${dataAtual}`, margin, yPos);
        doc.text(`Código de Rastreio: ${authHash}`, margin + 80, yPos);
        yPos += 8;
        doc.text(`Cliente: ${clientName}`, margin, yPos);
        yPos += 18;

        // --- OBJETO DA PROPOSTA ---
        setSubHeaderStyle();
        doc.text("1. Objeto", margin, yPos);
        yPos += 8;

        setNormalStyle();
        const objetoTexto = "Prestação de serviços técnicos especializados para realização de amostragem isocinética e monitoramento de emissões atmosféricas nas fontes indicadas pelo cliente, contemplando mobilização da equipe, execução das medições, análises aplicáveis e emissão de relatório técnico oficial com selo de autenticidade.";
        const splitObjeto = doc.splitTextToSize(objetoTexto, pageWidth - margin * 2);
        doc.text(splitObjeto, margin, yPos);
        yPos += splitObjeto.length * 5 + 8;

        // --- ENTREGÁVEIS ---
        setSubHeaderStyle();
        doc.text("2. Entregáveis Técnicos", margin, yPos);
        yPos += 8;

        setNormalStyle();
        const entregaveis = [
            "- Relatório técnico com selo de autenticidade QR Code;",
            "- Apresentação da metodologia de amostragem ABNT/USEPA;",
            "- Registros das condições operacionais e analíticas;",
            "- Documento digital assinado em formato PDF."
        ];
        
        entregaveis.forEach(item => {
            doc.text(item, margin + 5, yPos);
            yPos += 6;
        });
        yPos += 8;

        // --- INVESTIMENTO ---
        setSubHeaderStyle();
        doc.text("3. Investimento Total", margin, yPos);
        yPos += 12;

        // Caixa de destaque para o valor
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 22, 3, 3, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42);
        doc.text(`Valor Total: ${finalPrice}`, pageWidth / 2, yPos + 8, { align: "center" });
        
        yPos += 30;

        // --- VALIDADE ---
        setNormalStyle();
        doc.text("Validade desta proposta: 15 dias corridos.", margin, yPos);
        yPos += 25;

        // --- ASSINATURA ---
        doc.line(margin, yPos, margin + 80, yPos);
        yPos += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Excelência Ambiental & Engenharia", margin, yPos);
        setNormalStyle();
        yPos += 5;
        doc.text("Departamento Técnico Comercial", margin, yPos);

        // --- RODAPÉ ---
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${i} de ${totalPages} • Autenticidade: ${authHash} • Vellia CRM`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
        }

        // Salvar Arquivo
        const safeName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Proposta_Isocinetica_${safeName}.pdf`);
    }
};

