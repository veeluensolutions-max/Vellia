-- =========================================================================
-- VELLIA CRM - SCHEMA CONSOLIDADO E ATUALIZADO PARA O SUPABASE
-- Execute este script completo no SQL Editor do Supabase para garantir
-- que todas as tabelas, colunas e permissões estejam 100% sincronizadas.
-- =========================================================================

-- 1. TABELA DE USUÁRIOS: Adicionar coluna companyAccess
ALTER TABLE IF EXISTS comercial_users 
ADD COLUMN IF NOT EXISTS "companyAccess" text DEFAULT 'Ambas';

-- 2. TABELA DE LEADS: Adicionar coluna CNPJ e índice de busca rápida
ALTER TABLE IF EXISTS comercial_leads 
ADD COLUMN IF NOT EXISTS cnpj text;

CREATE INDEX IF NOT EXISTS idx_comercial_leads_cnpj ON comercial_leads (cnpj);

-- 3. TABELA DE PROPOSTAS / ORÇAMENTOS: Adicionar colunas completas do GestãoClick
ALTER TABLE IF EXISTS comercial_proposals
ADD COLUMN IF NOT EXISTS "budgetNumber" text,
ADD COLUMN IF NOT EXISTS seller text,
ADD COLUMN IF NOT EXISTS "deliveryDate" text,
ADD COLUMN IF NOT EXISTS "validityText" text,
ADD COLUMN IF NOT EXISTS channel text,
ADD COLUMN IF NOT EXISTS "costCenter" text,
ADD COLUMN IF NOT EXISTS intro text,
ADD COLUMN IF NOT EXISTS "techDescription" text,
ADD COLUMN IF NOT EXISTS freight numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS carrier text,
ADD COLUMN IF NOT EXISTS "deliveryAddress" jsonb,
ADD COLUMN IF NOT EXISTS "generatePayment" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "paymentType" text DEFAULT 'vista',
ADD COLUMN IF NOT EXISTS "servicesList" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "productsList" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "internalNotes" text;

-- 4. TABELA DE CONTRATOS E REGRAS
CREATE TABLE IF NOT EXISTS comercial_contracts (
    id text PRIMARY KEY,
    workspace text DEFAULT 'Veeluen Solutions',
    "leadId" text,
    "proposalId" text,
    number text,
    status text DEFAULT 'Ativo',
    "totalValue" numeric DEFAULT 0,
    "recurringValue" numeric DEFAULT 0,
    periodicity text DEFAULT 'Mensal',
    "startDate" text,
    "endDate" text,
    "autoRenew" boolean DEFAULT false,
    "warningDays" integer DEFAULT 30,
    owner text,
    "createdBy" text,
    notes text,
    "createdAt" text,
    "updatedAt" text
);

CREATE TABLE IF NOT EXISTS comercial_contract_services (
    id bigserial PRIMARY KEY,
    "contractId" text REFERENCES comercial_contracts(id) ON DELETE CASCADE,
    "serviceId" text,
    quantity integer DEFAULT 1,
    "unitValue" numeric DEFAULT 0
);

-- 5. TABELA DE TAREFAS DOS VENDEDORES E ATIVIDADES EXTRAS
CREATE TABLE IF NOT EXISTS comercial_tasks (
    id text PRIMARY KEY,
    workspace text DEFAULT 'Veeluen Solutions',
    owner text,
    text text,
    done boolean DEFAULT false,
    date text,
    priority text DEFAULT 'normal',
    "assignedBy" text
);

-- 6. HABILITAR PERMISSÕES PÚBLICAS (ANON / SERVICE) PARA TODAS AS TABELAS
-- Desabilita RLS restritivo para permitir gravação contínua via REST API
ALTER TABLE IF EXISTS comercial_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comercial_contract_services DISABLE ROW LEVEL SECURITY;

-- 7. SUPABASE REALTIME EM TEMPO REAL PARA USUÁRIOS
ALTER TABLE IF EXISTS comercial_users REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE comercial_users;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 8. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
