-- 20260518000001_save_bulk_budgets_rpc.sql

CREATE OR REPLACE FUNCTION save_bulk_budgets_rpc(
    p_user_id UUID,
    p_target_months TEXT[],
    p_allocations JSONB
) RETURNS VOID AS $$
BEGIN
    -- Validate user and enforce Row Level Security inside SECURITY DEFINER
    IF p_user_id IS NULL OR auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Cannot modify budgets for another user.';
    END IF;

    -- 1. Bulk Delete existing budgets for all target months in a single statement
    DELETE FROM budgets 
    WHERE user_id = p_user_id AND month = ANY(p_target_months);

    -- 2. Bulk Insert new allocations using set-based expansion
    INSERT INTO budgets (user_id, category_id, limit_amount, currency, month)
    SELECT 
        p_user_id,
        a.category_id,
        a.limit_amount,
        a.currency,
        m.month
    FROM unnest(p_target_months) AS m(month)
    CROSS JOIN jsonb_to_recordset(p_allocations) AS a(
        category_id UUID, 
        limit_amount NUMERIC, 
        currency TEXT
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Patch reallocate_budget to include auth.uid() validation
CREATE OR REPLACE FUNCTION public.reallocate_budget(
    p_user_id UUID,
    p_month VARCHAR(7),
    p_source_category_id UUID,
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
    -- Validate user and enforce Row Level Security inside SECURITY DEFINER
    IF p_user_id IS NULL OR auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Cannot modify budgets for another user.';
    END IF;

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
