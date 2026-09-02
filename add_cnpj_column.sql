-- =========================================================================
-- Vellia CRM - Migration: Adicionar coluna CNPJ na tabela comercial_leads
-- Execute este comando no SQL Editor do Supabase se desejar persistir o CNPJ nativamente
-- =========================================================================

ALTER TABLE IF EXISTS comercial_leads 
ADD COLUMN IF NOT EXISTS cnpj text;

-- Índice para acelerar buscas por CNPJ
CREATE INDEX IF NOT EXISTS idx_comercial_leads_cnpj ON comercial_leads (cnpj);
