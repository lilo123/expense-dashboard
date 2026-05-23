-- supabase/migrations/20260522000000_architectural_fixes.sql
-- 1. Create api_rate_limits Cache table
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    key TEXT PRIMARY KEY,
    requests_count INTEGER DEFAULT 0,
    reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY; -- PRIVATE, Service Role Only

-- 2. Add role column to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 3. Secure invite_requests SELECT Policy for Admin Role
DROP POLICY IF EXISTS "Authenticated users can view invite requests" ON public.invite_requests;
CREATE POLICY "Admin users can view invite requests"
ON public.invite_requests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 4. Timezone Validation Trigger (Case-Insensitive Olson Lookup & Normalization)
CREATE OR REPLACE FUNCTION public.validate_profile_timezone()
RETURNS TRIGGER AS $$
DECLARE
    normalized_tz TEXT;
BEGIN
    IF NEW.timezone IS NULL THEN
        NEW.timezone := 'UTC';
    ELSE
        SELECT name INTO normalized_tz 
        FROM pg_timezone_names 
        WHERE LOWER(name) = LOWER(NEW.timezone) 
        LIMIT 1;

        IF normalized_tz IS NULL AND LOWER(NEW.timezone) != 'utc' THEN
            NEW.timezone := 'UTC';
        ELSIF normalized_tz IS NOT NULL THEN
            NEW.timezone := normalized_tz;
        ELSE
            NEW.timezone := 'UTC';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_profile_timezone ON public.profiles;
CREATE TRIGGER trigger_validate_profile_timezone
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_timezone();

-- 5. Complete calculate_next_occurrence_v2 (support daily & yearly cases)
CREATE OR REPLACE FUNCTION public.calculate_next_occurrence_v2(
    base_date DATE, freq TEXT, dow INT, dom INT, last_day BOOLEAN
) RETURNS DATE LANGUAGE plpgsql AS $$
DECLARE
    next_date DATE;
BEGIN
    IF freq = 'daily' THEN
        RETURN base_date + INTERVAL '1 day';
    ELSIF freq = 'weekly' THEN
        next_date := base_date + ((dow - extract(dow from base_date)::int + 7) % 7);
        IF next_date <= base_date THEN
            next_date := next_date + INTERVAL '1 week';
        END IF;
        RETURN next_date;
    ELSIF freq = 'monthly' THEN
        IF last_day THEN
            RETURN (date_trunc('month', base_date) + INTERVAL '2 month' - INTERVAL '1 day')::date;
        ELSE
            DECLARE
                next_month_first DATE;
                days_in_next_month INT;
            BEGIN
                next_month_first := (date_trunc('month', base_date) + INTERVAL '1 month')::date;
                days_in_next_month := extract(day from (date_trunc('month', next_month_first) + INTERVAL '1 month' - INTERVAL '1 day'))::int;
                RETURN next_month_first + (least(dom, days_in_next_month) - 1) * INTERVAL '1 day';
            END;
        END IF;
    ELSIF freq = 'yearly' THEN
        RETURN base_date + INTERVAL '1 year';
    END IF;
    RETURN base_date + INTERVAL '1 month';
END;
$$;

-- 6. Concurrency-Safe Currency-Converting Recurring Expenses Worker
CREATE OR REPLACE FUNCTION public.process_recurring_expenses()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    flow RECORD;
    new_date DATE;
    updated_occurrences INT;
    has_expired BOOLEAN;
    latest_rates JSONB;
    rate_from NUMERIC;
    rate_to NUMERIC;
    converted_amount NUMERIC;
BEGIN
    -- Fetch latest exchange rates (Base: CAD)
    SELECT rates INTO latest_rates FROM public.exchange_rates ORDER BY updated_at DESC LIMIT 1;
    IF latest_rates IS NULL THEN
        latest_rates := '{"CAD": 1.0, "VND": 18500.0, "USD": 0.73, "EUR": 0.68, "JPY": 114.0, "GBP": 0.58, "SGD": 0.99}'::jsonb;
    END IF;

    FOR flow IN 
        SELECT r.*, COALESCE(p.timezone, 'UTC') as timezone, p.base_currency
        FROM public.recurring_expenses r
        JOIN public.profiles p ON r.user_id = p.id
        WHERE r.is_active = true 
          AND r.next_occurrence <= (timezone(COALESCE(p.timezone, 'UTC'), now())::date)
        FOR UPDATE OF r SKIP LOCKED
    LOOP
        -- RESET EXPIRED STATE
        has_expired := false;

        -- Calculate converted amount in user's base currency using the CAD baseline rates
        rate_from := COALESCE((latest_rates->>flow.currency)::numeric, 1.0);
        rate_to := COALESCE((latest_rates->>flow.base_currency)::numeric, 1.0);
        
        IF flow.currency = flow.base_currency THEN
            converted_amount := flow.amount;
        ELSE
            converted_amount := flow.amount * (rate_to / rate_from);
        END IF;

        -- Round converted amount according to currency decimal specs
        IF flow.base_currency IN ('VND', 'JPY') THEN
            converted_amount := ROUND(converted_amount, 0);
        ELSE
            converted_amount := ROUND(converted_amount, 2);
        END IF;

        -- Insert converted amount as base "amount" and raw amount as "original_amount"
        INSERT INTO public.expenses (
            user_id, item, amount, original_amount, original_currency, currency, category_id, date, recurring_expense_id, is_recurring
        ) VALUES (
            flow.user_id, flow.item, converted_amount, flow.amount, flow.currency, flow.currency, flow.category_id, flow.next_occurrence, flow.id, true
        );

        updated_occurrences := COALESCE(flow.num_occurrences, 0) + 1;
        new_date := public.calculate_next_occurrence_v2(
            flow.next_occurrence, flow.frequency, flow.day_of_week, flow.day_of_month, flow.is_last_day_of_month
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

-- 7. Atomic DB-Backed Sliding-Window Rate Limiter RPC
CREATE OR REPLACE FUNCTION public.check_rate_limit_rpc(
    p_key TEXT,
    p_limit INT,
    p_window_ms INT
) RETURNS TABLE (
    success BOOLEAN,
    remaining INT,
    reset_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_reset_at TIMESTAMPTZ;
    v_requests_count INT;
BEGIN
    INSERT INTO public.api_rate_limits (key, requests_count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_ms * INTERVAL '1 millisecond'))
    ON CONFLICT (key) DO UPDATE
    SET requests_count = CASE 
            WHEN api_rate_limits.reset_at < v_now THEN 1
            ELSE api_rate_limits.requests_count + 1
        END,
        reset_at = CASE 
            WHEN api_rate_limits.reset_at < v_now THEN v_now + (p_window_ms * INTERVAL '1 millisecond')
            ELSE api_rate_limits.reset_at
        END
    RETURNING api_rate_limits.requests_count, api_rate_limits.reset_at INTO v_requests_count, v_reset_at;

    IF v_requests_count > p_limit THEN
        RETURN QUERY SELECT false, 0, v_reset_at;
    ELSE
        RETURN QUERY SELECT true, p_limit - v_requests_count, v_reset_at;
    END IF;
END;
$$;

-- 8. Daily Cron Job to Purge Expired Rate Limits
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-rate-limits-daily';
SELECT cron.schedule(
    'purge-expired-rate-limits-daily',
    '0 0 * * *', -- Once a day at midnight
    $$DELETE FROM public.api_rate_limits WHERE reset_at < now()$$
);

-- 9. High-Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_id ON public.expenses(recurring_expense_id);

-- Optimized partial index (redundant is_active key removed from keys)
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active_occurrence 
ON public.recurring_expenses(next_occurrence) 
WHERE is_active = true;
