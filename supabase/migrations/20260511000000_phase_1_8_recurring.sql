-- 1. Enable pg_cron Extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add Timezone Column to Profiles (Frontend will silently sync browser timezone here on mount)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- 3. Create Recurring Expenses Configuration Table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item TEXT NOT NULL, -- Matches 'item' in public.expenses
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_occurrence DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Alter Expenses Table to Link to the Recurring Configuration
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL;

-- 5. Enable Row Level Security (RLS) on Recurring Expenses
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: Users can only manage their own configurations
DROP POLICY IF EXISTS "Users can manage their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can manage their own recurring expenses"
ON public.recurring_expenses FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 7. Helper Function: Calculate Next Occurrence Date
CREATE OR REPLACE FUNCTION public.calculate_next_occurrence(start_date DATE, freq TEXT)
RETURNS DATE 
LANGUAGE plpgsql
AS $$
BEGIN
    CASE freq
        WHEN 'daily' THEN RETURN start_date + INTERVAL '1 day';
        WHEN 'weekly' THEN RETURN start_date + INTERVAL '1 week';
        WHEN 'monthly' THEN RETURN start_date + INTERVAL '1 month';
        WHEN 'yearly' THEN RETURN start_date + INTERVAL '1 year';
        ELSE RETURN start_date;
    END CASE;
END;
$$;

-- 8. Worker Function: Timezone-Aware Processing (Security Definer, Secure Search Path)
CREATE OR REPLACE FUNCTION public.process_recurring_expenses()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    flow RECORD;
    new_date DATE;
BEGIN
    -- Loop through due configurations based on user's local timezone date
    FOR flow IN 
        SELECT r.*, COALESCE(p.timezone, 'UTC') as timezone
        FROM public.recurring_expenses r
        JOIN public.profiles p ON r.user_id = p.id
        WHERE r.is_active = true 
          AND r.next_occurrence <= (timezone(COALESCE(p.timezone, 'UTC'), now())::date)
    LOOP
        -- A. Log the expense matching the scheduled date (next_occurrence)
        INSERT INTO public.expenses (
            user_id, item, amount, original_amount, original_currency, currency, category_id, date, recurring_expense_id
        ) VALUES (
            flow.user_id, flow.item, flow.amount, flow.amount, flow.currency, flow.currency, flow.category_id, flow.next_occurrence, flow.id
        );

        -- B. Calculate the next occurrence relative to the processed date
        new_date := public.calculate_next_occurrence(flow.next_occurrence, flow.frequency);
        
        -- C. Advance the schedule in recurring_expenses
        UPDATE public.recurring_expenses 
        SET next_occurrence = new_date
        WHERE id = flow.id;
        
    END LOOP;
END;
$$;

-- 9. Worker Schedule: Timezone-Aware Hourly Execution (Minimizes delay across timezones)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-recurring-expenses-hourly';
SELECT cron.schedule(
    'process-recurring-expenses-hourly',
    '0 * * * *', -- Executed every hour on the hour
    'SELECT public.process_recurring_expenses()'
);

-- 10. Janitor Schedule: Daily Storage Protection Log Cleanup (Purges logs older than 7 days)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-cron-logs-daily';
SELECT cron.schedule(
    'cleanup-cron-logs-daily',
    '0 0 * * *', -- Executed once a day at midnight
    $$DELETE FROM cron.job_run_details WHERE end_time < now() - INTERVAL '7 days'$$
);
