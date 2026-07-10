export const Integrations = {
    init() {
        const container = document.getElementById("integrations-container");
        if (!container) return;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                <!-- Meta Ads Card -->
                <div class="card stat-card" style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </div>
                        <div>
                            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">Meta Ads (Facebook)</h3>
                            <span style="font-size: 12px; color: var(--text-muted);">Recepção de Leads via Webhook</span>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-body); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 8px 0;">URL do Webhook para configurar na campanha (Requer Banco de Dados ativo):</p>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" class="form-control" value="https://velliacrm.vercel.app/api/meta-webhook" readonly style="font-size: 12px; background: var(--bg-app); cursor: copy;" id="webhook-url-input">
                            <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('webhook-url-input').value); alert('URL Copiada!')" style="padding: 0 12px;">
                                Copiar
                            </button>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-primary);">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Status da Conexão</span>
                            <span class="badge badge-warning" style="background: #fef08a; color: #854d0e;">Pendente: Setup DB</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Leads Recebidos (Hoje)</span>
                            <span style="font-weight: 700;">0</span>
                        </div>
                    </div>

                    <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-outline" style="width: 100%;" onclick="alert('Funcionalidade em desenvolvimento: O fluxo de autenticação com o Banco de Dados será liberado em breve.')">Configurar Banco de Dados</button>
                    </div>
                </div>

                <!-- Adicionar futuras integrações aqui -->
                <div class="card stat-card" style="display: flex; flex-direction: column; gap: 16px; opacity: 0.6; cursor: not-allowed;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">WhatsApp API</h3>
                            <span style="font-size: 12px; color: var(--text-muted);">Em breve</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
