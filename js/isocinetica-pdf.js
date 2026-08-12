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

        // Estilos
        const setHeaderStyle = () => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(30, 41, 59); // var(--text-primary) equivalent
        };

        const setSubHeaderStyle = () => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(51, 65, 85);
        };

        const setNormalStyle = () => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(71, 85, 105); // var(--text-muted) equivalent
        };

        // --- CAPA DA PROPOSTA ---
        setHeaderStyle();
        doc.text("PROPOSTA COMERCIAL", pageWidth / 2, yPos, { align: "center" });
        yPos += 10;
        
        setSubHeaderStyle();
        doc.text("Amostragem Isocinética", pageWidth / 2, yPos, { align: "center" });
        yPos += 30;

        setNormalStyle();
        const dataAtual = new Date().toLocaleDateString('pt-BR');
        doc.text(`Data: ${dataAtual}`, margin, yPos);
        yPos += 10;
        doc.text(`Cliente: ${clientName}`, margin, yPos);
        yPos += 20;

        // --- OBJETO DA PROPOSTA ---
        setSubHeaderStyle();
        doc.text("1. Objeto", margin, yPos);
        yPos += 10;

        setNormalStyle();
        const objetoTexto = "Prestação de serviços técnicos especializados para realização de amostragem isocinética e monitoramento de emissões atmosféricas nas fontes indicadas pelo cliente, contemplando mobilização da equipe, execução das medições, análises aplicáveis e emissão de relatório técnico.";
        const splitObjeto = doc.splitTextToSize(objetoTexto, pageWidth - margin * 2);
        doc.text(splitObjeto, margin, yPos);
        yPos += splitObjeto.length * 6 + 10;

        // --- ENTREGÁVEIS ---
        setSubHeaderStyle();
        doc.text("2. Entregáveis", margin, yPos);
        yPos += 10;

        setNormalStyle();
        const entregaveis = [
            "- Relatório técnico com os resultados obtidos;",
            "- Apresentação da metodologia aplicada;",
            "- Registros das condições de amostragem;",
            "- Documento digital em formato PDF."
        ];
        
        entregaveis.forEach(item => {
            doc.text(item, margin + 5, yPos);
            yPos += 7;
        });
        yPos += 10;

        // --- INVESTIMENTO ---
        setSubHeaderStyle();
        doc.text("3. Investimento Total", margin, yPos);
        yPos += 15;

        // Caixa de destaque para o valor
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 25, 3, 3, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text(`Valor Total: ${finalPrice}`, pageWidth / 2, yPos + 10, { align: "center" });
        
        yPos += 35;

        // --- VALIDADE ---
        setNormalStyle();
        doc.text("Validade desta proposta: 15 dias.", margin, yPos);
        yPos += 30;

        // --- ASSINATURA ---
        doc.line(margin, yPos, margin + 80, yPos);
        yPos += 5;
        doc.setFont("helvetica", "bold");
        doc.text("Veeluen Solutions", margin, yPos);
        setNormalStyle();
        yPos += 5;
        doc.text("Departamento Comercial", margin, yPos);

        // --- RODAPÉ ---
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${i} de ${totalPages} - Veeluen Solutions`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
        }

        // Salvar Arquivo
        const safeName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Proposta_Isocinetica_${safeName}.pdf`);
    }
};
