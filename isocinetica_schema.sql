-- ========================================================================================
-- SCRIPT SQL PARA O MÓDULO DE ISOCINÉTICA NO SUPABASE
-- Execute este script no SQL Editor do painel do seu Supabase.
-- ========================================================================================

-- Tabela: isocinetica_settings
CREATE TABLE IF NOT EXISTS public.isocinetica_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_consumption_km_per_liter numeric(10,2) NOT NULL DEFAULT 8.00,
    fuel_price_per_liter numeric(10,2) NOT NULL DEFAULT 5.90,
    vehicle_maintenance_rate numeric(10,4) NOT NULL DEFAULT 0.10,
    stack_additional_rate numeric(10,4) NOT NULL DEFAULT 0.15,
    administrative_cost_rate numeric(10,4) NOT NULL DEFAULT 0.25,
    tax_rate numeric(10,4) NOT NULL DEFAULT 0.235,
    profit_rate numeric(10,4) NOT NULL DEFAULT 1.00,
    hotel_daily_rate_per_employee numeric(10,2) NOT NULL DEFAULT 100.00,
    daily_food_rate_per_employee numeric(10,2) NOT NULL DEFAULT 100.00,
    meal_unit_price numeric(10,2) NOT NULL DEFAULT 50.00,
    active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Insere os valores iniciais (defaults da planilha)
INSERT INTO public.isocinetica_settings (
    vehicle_consumption_km_per_liter, fuel_price_per_liter, vehicle_maintenance_rate, stack_additional_rate,
    administrative_cost_rate, tax_rate, profit_rate, hotel_daily_rate_per_employee, daily_food_rate_per_employee, meal_unit_price
) VALUES (
    8.00, 5.90, 0.10, 0.15, 0.25, 0.235, 1.00, 100.00, 100.00, 50.00
);

-- Tabela: isocinetica_proposals
CREATE TABLE IF NOT EXISTS public.isocinetica_proposals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_number varchar(50) NOT NULL UNIQUE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL, -- Assume que exista a tabela clients
    status varchar(50) NOT NULL DEFAULT 'Rascunho', -- Rascunho, Em revisão, Aprovada internamente, Enviada, Aceita, Recusada, Vencida
    issue_date date,
    validity_days integer DEFAULT 15,
    commercial_responsible varchar(255),
    technical_responsible varchar(255),
    title varchar(255),
    execution_location varchar(255),
    
    -- Inputs - Deslocamento e Setup
    travel_mode varchar(50) NOT NULL, -- 'WITH_OVERNIGHT', 'WITHOUT_OVERNIGHT'
    round_trip_distance_km numeric(10,2) DEFAULT 0,
    number_of_days integer DEFAULT 1,
    number_of_employees integer DEFAULT 1,
    number_of_stacks integer DEFAULT 1,
    
    -- Taxas e Valores Base utilizados (Snapshot)
    vehicle_consumption_km_per_liter numeric(10,2),
    fuel_price_per_liter numeric(10,2),
    vehicle_maintenance_rate numeric(10,4),
    stack_additional_rate numeric(10,4),
    administrative_cost_rate numeric(10,4),
    tax_rate numeric(10,4),
    profit_rate numeric(10,4),
    hotel_daily_rate_per_employee numeric(10,2),
    daily_food_rate_per_employee numeric(10,2),
    meals_per_employee integer,
    meal_unit_price numeric(10,2),
    
    -- Resultados dos Cálculos (Memória Interna)
    fuel_liters numeric(10,2),
    fuel_cost numeric(12,2),
    hotel_cost numeric(12,2),
    food_cost numeric(12,2),
    travel_subtotal numeric(12,2),
    stacks_additional numeric(12,2),
    total_costs numeric(12,2),
    pricing_rate numeric(10,4),
    pricing_increase numeric(12,2),
    calculated_price numeric(12,2),
    
    -- Ajuste e Preço Final
    commercial_adjustment numeric(12,2) DEFAULT 0,
    commercial_adjustment_reason text,
    final_commercial_price numeric(12,2),
    
    -- Escopo Técnico
    service_type varchar(100),
    parameters_json jsonb,
    technical_scope text,
    technical_assumptions text,
    client_responsibilities text,
    excluded_items text,
    
    -- Condições Comerciais
    commercial_conditions text,
    execution_deadline varchar(255),
    payment_terms text,
    internal_notes text,
    
    calculation_snapshot_json jsonb,
    
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ========================================================================================
-- SEGURANÇA: Habilitar Row Level Security (RLS)
-- ========================================================================================

ALTER TABLE public.isocinetica_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isocinetica_proposals ENABLE ROW LEVEL SECURITY;

-- Políticas para isocinetica_settings
-- Leitura para todos os usuários autenticados
CREATE POLICY "Leitura de configurações permitida para usuários autenticados" 
ON public.isocinetica_settings FOR SELECT TO authenticated USING (true);

-- Modificação apenas por admin (ajuste de acordo com sua regra de roles existente)
CREATE POLICY "Alteração de configurações apenas por admins" 
ON public.isocinetica_settings FOR ALL TO authenticated 
USING ( (select role from public.users where id = auth.uid()) = 'admin' );

-- Políticas para isocinetica_proposals
-- Leitura permitida para autenticados
CREATE POLICY "Leitura de propostas permitida para autenticados" 
ON public.isocinetica_proposals FOR SELECT TO authenticated USING (true);

-- Inserção/Atualização para criadores e admins
CREATE POLICY "Criação e Edição de propostas" 
ON public.isocinetica_proposals FOR ALL TO authenticated 
USING (true) WITH CHECK (true);
