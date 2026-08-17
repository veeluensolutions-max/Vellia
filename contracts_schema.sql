-- ==============================================================================
-- VELLIA CRM - MÓDULO DE CONTRATOS (FASE 2)
-- Execute este script no painel SQL do seu Supabase
-- ==============================================================================

-- Tabela principal de contratos
CREATE TABLE IF NOT EXISTS comercial_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace TEXT NOT NULL,
    leadId TEXT NOT NULL,          -- Referência ao cliente (comercial_leads.id)
    proposalId TEXT,               -- Referência à proposta que originou (opcional)
    number TEXT NOT NULL,          -- Número do contrato (ex: CT-2023-001)
    status TEXT NOT NULL DEFAULT 'Em formalização', -- Ativo, Encerrado, Renovado, etc
    
    totalValue NUMERIC(10, 2) DEFAULT 0,
    recurringValue NUMERIC(10, 2) DEFAULT 0,
    periodicity TEXT DEFAULT 'Mensal', -- Mensal, Anual, Único
    
    startDate DATE,
    endDate DATE,
    autoRenew BOOLEAN DEFAULT false,
    warningDays INTEGER DEFAULT 30, -- Quantidade de dias para alertar vencimento
    
    owner TEXT NOT NULL,           -- Responsável comercial (email ou ID do vendedor)
    createdBy TEXT NOT NULL,
    notes TEXT,
    
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabela associativa para permitir vários serviços por contrato
CREATE TABLE IF NOT EXISTS comercial_contract_services (
    contractId UUID REFERENCES comercial_contracts(id) ON DELETE CASCADE,
    serviceId TEXT NOT NULL,       -- ID do serviço no comercial_services
    quantity INTEGER DEFAULT 1,
    unitValue NUMERIC(10, 2) DEFAULT 0,
    
    PRIMARY KEY (contractId, serviceId)
);

-- Políticas de RLS (Row Level Security) - Caso você use RLS habilitado, permita leitura e escrita:
-- (Se RLS não estiver ativo para as tabelas comerciais, pode ignorar esta parte)
-- ALTER TABLE comercial_contracts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable all for authenticated users only" ON comercial_contracts FOR ALL USING (true);

-- Índices para facilitar buscas no dashboard e telas
CREATE INDEX IF NOT EXISTS idx_contracts_workspace ON comercial_contracts(workspace);
CREATE INDEX IF NOT EXISTS idx_contracts_leadId ON comercial_contracts(leadId);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON comercial_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_endDate ON comercial_contracts(endDate);
