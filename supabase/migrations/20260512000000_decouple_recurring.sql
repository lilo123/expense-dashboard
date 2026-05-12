-- 1. Add is_recurring column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

-- 2. Data Migration: Update all existing historically logged recurring expenses
UPDATE public.expenses 
SET is_recurring = true 
WHERE recurring_expense_id IS NOT NULL;

-- 3. Update process_recurring_expenses() function to write is_recurring = true
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
        -- A. Log the expense matching the scheduled date (next_occurrence), explicitly setting is_recurring to true
        INSERT INTO public.expenses (
            user_id, item, amount, original_amount, original_currency, currency, category_id, date, recurring_expense_id, is_recurring
        ) VALUES (
            flow.user_id, flow.item, flow.amount, flow.amount, flow.currency, flow.currency, flow.category_id, flow.next_occurrence, flow.id, true
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
