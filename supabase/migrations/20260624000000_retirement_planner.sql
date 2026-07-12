-- Migration: Financial Retirement Planner Tables & Strict RLS
-- Description: Creates tables for households, accounts, spendings, pensions, life events, simulation configs, and results summaries with strict RLS policies and Premium tier trigger.

CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    province_or_state TEXT NOT NULL,
    country TEXT NOT NULL CHECK (country IN ('US', 'CA')),
    retirement_age INT NOT NULL DEFAULT 65,
    current_age INT NOT NULL DEFAULT 40,
    target_spending NUMERIC NOT NULL DEFAULT 50000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('RRSP', 'TFSA', 'NonRegistered', 'TraditionalIRA', 'RothIRA', '401k', 'Taxable')),
    balance NUMERIC NOT NULL DEFAULT 0,
    annual_contribution NUMERIC NOT NULL DEFAULT 0,
    equities INT NOT NULL DEFAULT 60,
    bonds INT NOT NULL DEFAULT 40,
    cash INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.spendings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'annually')),
    inflation_adjusted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('CPP', 'OAS', 'SocialSecurity', 'DefinedBenefit')),
    estimated_amount NUMERIC NOT NULL DEFAULT 0,
    start_age INT NOT NULL DEFAULT 65,
    inflation_adjusted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.life_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INT NOT NULL,
    net_cash_flow NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.simulation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    historical_range TEXT DEFAULT '50',
    simulation_paths INT DEFAULT 1000,
    market_data_mode TEXT DEFAULT 'us',
    withdrawal_strategy TEXT DEFAULT 'constant_dollar',
    rebalance_frequency INT DEFAULT 1,
    guardrails_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.simulation_results_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    success_rate DECIMAL(5, 2) NOT NULL,
    median_ending_balance DECIMAL(15, 2) NOT NULL,
    worst_ending_balance DECIMAL(15, 2) NOT NULL,
    best_ending_balance DECIMAL(15, 2) NOT NULL,
    total_runs INT NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Strict Row Level Security (RLS)
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spendings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_results_summaries ENABLE ROW LEVEL SECURITY;

-- Create Strict RLS Policies (auth.uid() = user_id)
CREATE POLICY "Users can view own households" ON public.households FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own households" ON public.households FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own households" ON public.households FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own households" ON public.households FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own spendings" ON public.spendings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spendings" ON public.spendings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spendings" ON public.spendings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spendings" ON public.spendings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own pensions" ON public.pensions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pensions" ON public.pensions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pensions" ON public.pensions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pensions" ON public.pensions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own life events" ON public.life_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own life events" ON public.life_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own life events" ON public.life_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own life events" ON public.life_events FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own simulation configs" ON public.simulation_configs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own simulation results summaries" ON public.simulation_results_summaries FOR ALL USING (auth.uid() = user_id);

-- Grant permissions to authenticated and service_role
GRANT ALL ON public.households TO anon, authenticated, service_role;
GRANT ALL ON public.accounts TO anon, authenticated, service_role;
GRANT ALL ON public.spendings TO anon, authenticated, service_role;
GRANT ALL ON public.pensions TO anon, authenticated, service_role;
GRANT ALL ON public.life_events TO anon, authenticated, service_role;
GRANT ALL ON public.simulation_configs TO anon, authenticated, service_role;
GRANT ALL ON public.simulation_results_summaries TO anon, authenticated, service_role;

-- Create Premium Tier Check Function & Trigger for Premium Range Selector (125 yr)
CREATE OR REPLACE FUNCTION public.check_premium_simulation_range()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.historical_range = '125' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND tier = 'premium'
        ) THEN
            RAISE EXCEPTION 'Premium tier required to access 125-year historical range simulation.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_simulation_configs_premium_guard ON public.simulation_configs;
CREATE TRIGGER tr_simulation_configs_premium_guard
BEFORE INSERT OR UPDATE ON public.simulation_configs
FOR EACH ROW
EXECUTE FUNCTION public.check_premium_simulation_range();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
