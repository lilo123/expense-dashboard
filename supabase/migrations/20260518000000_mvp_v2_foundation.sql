-- 20260518000000_mvp_v2_foundation.sql

-- 1. ALTER PROFILES TABLE
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (onboarding_status IN ('pending', 'completed'));

-- 2. ALTER CATEGORIES TABLE
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) NOT NULL DEFAULT 'Folder';

-- 3. ALTER BUDGETS TABLE
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS month VARCHAR(7) NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'CAD';

DROP INDEX IF EXISTS idx_budgets_category_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_category_month 
    ON public.budgets (user_id, category_id, month) WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_surplus_month 
    ON public.budgets (user_id, month) WHERE category_id IS NULL;

-- 4. UPDATE DEFAULT CATEGORIES SEEDING (18 Categories for E2E & Onboarding Compatibility)
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER AS $$
DECLARE
    default_display_name TEXT;
BEGIN
    BEGIN
        default_display_name := split_part(NEW.email, '@', 1);

        INSERT INTO public.profiles (id, display_name, base_currency, display_currency, budget_reset_day, ai_tone, onboarding_status)
        VALUES (NEW.id, default_display_name, 'CAD', 'CAD', 1, 'nurturing', 'pending')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.categories (user_id, name, icon)
        VALUES
            (NEW.id, 'Housing', 'Home'),
            (NEW.id, 'Utilities', 'Zap'),
            (NEW.id, 'Insurance', 'Shield'),
            (NEW.id, 'Groceries', 'ShoppingCart'),
            (NEW.id, 'Dining Out', 'Utensils'),
            (NEW.id, 'Transportation', 'Car'),
            (NEW.id, 'Household', 'Home'),
            (NEW.id, 'Health & Care', 'Heart'),
            (NEW.id, 'Subscriptions', 'Repeat'),
            (NEW.id, 'Shopping', 'Bag'),
            (NEW.id, 'Entertainment', 'Film'),
            (NEW.id, 'Travel', 'Plane'),
            (NEW.id, 'Gifts', 'Gift'),
            (NEW.id, 'Education', 'Book'),
            (NEW.id, 'Misc', 'Box'),
            (NEW.id, 'Sport', 'Activity'),
            (NEW.id, 'Food & Dining', 'Utensils'),
            (NEW.id, 'Personal/Entertainment', 'Smile')
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to seed user profile or default categories for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. REALLOCATION ENGINE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.reallocate_budget(
    p_user_id UUID,
    p_month VARCHAR(7),
    p_source_category_id UUID, -- NULL represents 'Ready to Assign' surplus
    p_target_category_id UUID,
    p_amount DECIMAL(12, 2)
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_currency VARCHAR(3);
    v_rates JSONB;
    v_rate_display NUMERIC;
    v_source_limit DECIMAL(12, 2);
    v_source_spent_cad DECIMAL(12, 2) := 0;
    v_source_spent_display DECIMAL(12, 2) := 0;
    v_target_limit DECIMAL(12, 2);
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Reallocation amount must be greater than zero.';
    END IF;

    SELECT display_currency INTO v_display_currency
    FROM public.profiles WHERE id = p_user_id;

    SELECT rates INTO v_rates
    FROM public.exchange_rates
    WHERE base_currency = 'CAD'
    ORDER BY updated_at DESC LIMIT 1;

    IF v_display_currency = 'CAD' THEN
        v_rate_display := 1.0;
    ELSE
        v_rate_display := COALESCE((v_rates->>v_display_currency)::NUMERIC, 1.0);
    END IF;

    IF p_source_category_id IS NULL THEN
        SELECT limit_amount INTO v_source_limit
        FROM public.budgets
        WHERE user_id = p_user_id AND month = p_month AND category_id IS NULL
        FOR UPDATE;
    ELSE
        SELECT limit_amount INTO v_source_limit
        FROM public.budgets
        WHERE user_id = p_user_id AND month = p_month AND category_id = p_source_category_id
        FOR UPDATE;
    END IF;

    IF v_source_limit IS NULL THEN
        RAISE EXCEPTION 'Source budget line item not found for %.', p_month;
    END IF;

    IF p_source_category_id IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_source_spent_cad
        FROM public.expenses
        WHERE user_id = p_user_id AND category_id = p_source_category_id 
          AND to_char(date, 'YYYY-MM') = p_month;
    END IF;

    v_source_spent_display := ROUND((v_source_spent_cad * v_rate_display)::NUMERIC, 2);

    IF (v_source_limit - v_source_spent_display) < p_amount THEN
        RAISE EXCEPTION 'Insufficient available surplus in source category to perform reallocation.';
    END IF;

    SELECT limit_amount INTO v_target_limit
    FROM public.budgets
    WHERE user_id = p_user_id AND month = p_month AND category_id = p_target_category_id
    FOR UPDATE;

    IF v_target_limit IS NULL THEN
        RAISE EXCEPTION 'Target budget line item not found for %.', p_month;
    END IF;

    IF p_source_category_id IS NULL THEN
        UPDATE public.budgets
        SET limit_amount = limit_amount - p_amount
        WHERE user_id = p_user_id AND month = p_month AND category_id IS NULL;
    ELSE
        UPDATE public.budgets
        SET limit_amount = limit_amount - p_amount
        WHERE user_id = p_user_id AND month = p_month AND category_id = p_source_category_id;
    END IF;

    UPDATE public.budgets
    SET limit_amount = limit_amount + p_amount
    WHERE user_id = p_user_id AND month = p_month AND category_id = p_target_category_id;

    RETURN TRUE;
END;
$$;

-- 6. COMPLETE CRON EXECUTION LOGIC
CREATE OR REPLACE FUNCTION public.process_recurring_expenses()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    flow RECORD;
    new_date DATE;
    updated_occurrences INT;
    has_expired BOOLEAN := false;
BEGIN
    FOR flow IN 
        SELECT r.*, COALESCE(p.timezone, 'UTC') as timezone
        FROM public.recurring_expenses r
        JOIN public.profiles p ON r.user_id = p.id
        WHERE r.is_active = true 
          AND r.next_occurrence <= (timezone(COALESCE(p.timezone, 'UTC'), now())::date)
    LOOP
        INSERT INTO public.expenses (
            user_id, item, amount, original_amount, original_currency, currency, category_id, date, recurring_expense_id
        ) VALUES (
            flow.user_id, flow.item, flow.amount, flow.amount, flow.currency, flow.currency, flow.category_id, flow.next_occurrence, flow.id
        );

        updated_occurrences := flow.num_occurrences + 1;
        new_date := public.calculate_next_occurrence_v2(
            flow.next_occurrence, 
            flow.frequency, 
            flow.day_of_week, 
            flow.day_of_month, 
            flow.is_last_day_of_month
        );
        
        IF flow.end_date IS NOT NULL AND new_date > flow.end_date THEN
            has_expired := true;
        END IF;
        
        IF flow.max_occurrences IS NOT NULL AND updated_occurrences >= flow.max_occurrences THEN
            has_expired := true;
        END IF;

        UPDATE public.recurring_expenses 
        SET next_occurrence = new_date,
            num_occurrences = updated_occurrences,
            is_active = CASE WHEN has_expired THEN false ELSE is_active END
        WHERE id = flow.id;
        
    END LOOP;
END;
$$;

-- 7. JANITOR SCHEDULE
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-cron-logs-daily';
SELECT cron.schedule(
    'cleanup-cron-logs-daily',
    '0 0 * * *', -- Executed once a day at midnight
    $$DELETE FROM cron.job_run_details WHERE end_time < now() - INTERVAL '7 days'$$
);
