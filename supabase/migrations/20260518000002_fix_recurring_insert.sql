-- 20260518000002_fix_recurring_insert.sql
-- Hotfix: Explicitly restore is_recurring = true flag during automated process_recurring_expenses inserts
-- Incorporates row concurrency locking (FOR UPDATE OF r) and null-safety occurrence calculations

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
    -- Loop through due configurations based on user's local timezone date
    -- Locks the rows (FOR UPDATE OF r) to prevent concurrent cron instances from double logging
    FOR flow IN 
        SELECT r.*, COALESCE(p.timezone, 'UTC') as timezone
        FROM public.recurring_expenses r
        JOIN public.profiles p ON r.user_id = p.id
        WHERE r.is_active = true 
          AND r.next_occurrence <= (timezone(COALESCE(p.timezone, 'UTC'), now())::date)
        FOR UPDATE OF r
    LOOP
        -- Log the expense matching next_occurrence with is_recurring = true
        INSERT INTO public.expenses (
            user_id, 
            item, 
            amount, 
            original_amount, 
            original_currency, 
            currency, 
            category_id, 
            date, 
            recurring_expense_id,
            is_recurring
        ) VALUES (
            flow.user_id, 
            flow.item, 
            flow.amount, 
            flow.amount, 
            flow.currency, 
            flow.currency, 
            flow.category_id, 
            flow.next_occurrence, 
            flow.id,
            true
        );

        -- Safe increment of running execution counts (coalesce null checks)
        updated_occurrences := COALESCE(flow.num_occurrences, 0) + 1;
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

        -- Advance scheduling and deactivate if expired
        UPDATE public.recurring_expenses 
        SET next_occurrence = new_date,
            num_occurrences = updated_occurrences,
            is_active = CASE WHEN has_expired THEN false ELSE is_active END
        WHERE id = flow.id;
        
    END LOOP;
END;
$$;
