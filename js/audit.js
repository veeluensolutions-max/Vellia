import { Store } from "./store.js";

export const Audit = {
    logStageChange(userEmail, leadName, oldStage, newStage, reason = "") {
        const details = `Mudança de etapa do lead "${leadName}": de "${oldStage}" para "${newStage}".${reason ? ' Motivo: ' + reason : ''}`;
        return Store.addLog(userEmail, "LEAD_STAGE_CHANGE", details, "SUCCESS");
    },

    logProposalSent(userEmail, leadName, value, numProposta) {
        const details = `Nova proposta comercial nº ${numProposta} enviada para "${leadName}". Valor: R$ ${value}.`;
        return Store.addLog(userEmail, "PROPOSAL_SENT", details, "SUCCESS");
    },

    logSaleWon(userEmail, leadName, value) {
        const details = `Venda fechada com sucesso para "${leadName}". Receita gerada: R$ ${value}.`;
        return Store.addLog(userEmail, "SALE_WON", details, "SUCCESS");
    },

    logSaleLost(userEmail, leadName, reason, competitor = "Nenhum") {
        const details = `Oportunidade perdida com "${leadName}". Motivo: ${reason}. Concorrente vencedor: ${competitor}.`;
        return Store.addLog(userEmail, "SALE_LOST", details, "WARN");
    },

    logAccessDenied(userEmail, route) {
        const details = `Acesso negado para rota/recurso "${route}".`;
        return Store.addLog(userEmail, "ACCESS_DENIED", details, "ERROR");
    },

    logConfigChange(userEmail, setting, description) {
        const details = `Configuração alterada: "${setting}" - ${description}.`;
        return Store.addLog(userEmail, "CONFIG_CHANGE", details, "SUCCESS");
    },

    logUserCreated(userEmail, createdEmail, role) {
        const details = `Novo usuário criado: ${createdEmail} com perfil ${role}.`;
        return Store.addLog(userEmail, "USER_CREATED", details, "SUCCESS");
    }
};
