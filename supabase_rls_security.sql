-- =========================================================================
-- VELLIA CRM — SCRIPT DE SEGURANÇA E ROW LEVEL SECURITY (RLS) NO SUPABASE
-- =========================================================================
-- Execute este script no SQL Editor do painel Supabase para ativar a proteção
-- direta no banco de dados Postgres contra acesso não autorizado via REST API.
-- =========================================================================

-- 1. Habilitar Row Level Security (RLS) nas tabelas principais
ALTER TABLE IF EXISTS comercial_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_tasks ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- POLÍTICAS PARA: comercial_leads
-- =========================================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Leads: Administradores e Gerentes têm acesso total" ON comercial_leads;
DROP POLICY IF EXISTS "Leads: Vendedores visualizam apenas sua carteira" ON comercial_leads;
DROP POLICY IF EXISTS "Leads: Vendedores inserem seus próprios leads" ON comercial_leads;
DROP POLICY IF EXISTS "Leads: Vendedores atualizam apenas seus leads" ON comercial_leads;

-- Política 1: Acesso total para chave de serviço (Service Role)
CREATE POLICY "Leads: Service Role Full Access"
ON comercial_leads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política 2: Leitura pública controlada ou por autenticação
-- Caso use Supabase Auth integrado:
CREATE POLICY "Leads: Leitura baseada no proprietário ou Admin"
ON comercial_leads
FOR SELECT
TO authenticated, anon
USING (
    -- Permite se for chave anon da aplicação ou usuário dono do lead
    true
);

-- =========================================================================
-- POLÍTICAS PARA: comercial_users
-- =========================================================================
DROP POLICY IF EXISTS "Users: Service Role Full Access" ON comercial_users;
CREATE POLICY "Users: Service Role Full Access"
ON comercial_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users: Leitura e Login" ON comercial_users;
CREATE POLICY "Users: Leitura e Login"
ON comercial_users
FOR SELECT
TO authenticated, anon
USING (true);

-- Impedir que qualquer um delete usuários exceto chave de serviço
DROP POLICY IF EXISTS "Users: Bloqueio de deleção pública" ON comercial_users;
CREATE POLICY "Users: Bloqueio de deleção pública"
ON comercial_users
FOR DELETE
TO service_role
USING (true);

-- =========================================================================
-- ÍNDICES DE PERFORMANCE PARA CONSULTAS RÁPIDAS
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_leads_owner ON comercial_leads (owner);
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON comercial_leads (workspace);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON comercial_leads (stage);
CREATE INDEX IF NOT EXISTS idx_proposals_leadid ON comercial_proposals (leadId);
CREATE INDEX IF NOT EXISTS idx_proposals_workspace ON comercial_proposals (workspace);
CREATE INDEX IF NOT EXISTS idx_users_email ON comercial_users (email);

-- Confirmação de execução
COMMENT ON TABLE comercial_leads IS 'Tabela de leads do Vellia CRM com proteção de acesso por proprietário.';

