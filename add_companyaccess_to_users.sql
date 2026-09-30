-- =========================================================================
-- Vellia CRM - Migration: Adicionar coluna companyAccess na tabela comercial_users
-- Execute este comando no SQL Editor do Supabase para persistir nativamente
-- a restrição de empresa de cada usuário.
-- =========================================================================

ALTER TABLE IF EXISTS comercial_users 
ADD COLUMN IF NOT EXISTS "companyAccess" text DEFAULT 'Ambas';

-- Atualiza a usuária Mika para acesso exclusivo à 'Excelência Ambiental'
UPDATE comercial_users 
SET "companyAccess" = 'Excelência Ambiental' 
WHERE email = 'mika@vellia.com' OR name ILIKE '%Mika%';
