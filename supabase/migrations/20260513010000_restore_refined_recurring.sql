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
    FOR flow IN 
        SELECT r.*, COALESCE(p.timezone, 'UTC') as timezone
        FROM public.recurring_expenses r
        JOIN public.profiles p ON r.user_id = p.id
        WHERE r.is_active = true 
          AND r.next_occurrence <= (timezone(COALESCE(p.timezone, 'UTC'), now())::date)
    LOOP
        -- A. Log the expense matching next_occurrence with is_recurring = true
        INSERT INTO public.expenses (
            user_id, item, amount, original_amount, original_currency, currency, category_id, date, recurring_expense_id, is_recurring
        ) VALUES (
            flow.user_id, flow.item, flow.amount, flow.amount, flow.currency, flow.currency, flow.category_id, flow.next_occurrence, flow.id, true
        );

        -- B. Increment occurrences and calculate the next recurrence date
        DECLARE
            updated_occurrences INT;
            has_expired BOOLEAN := false;
        BEGIN
            updated_occurrences := flow.num_occurrences + 1;
            new_date := public.calculate_next_occurrence_v2(
                flow.next_occurrence, 
                flow.frequency, 
                flow.day_of_week, 
                flow.day_of_month, 
                flow.is_last_day_of_month
            );
            
            -- C. Check expiration bounds
            IF flow.end_date IS NOT NULL AND new_date > flow.end_date THEN
                has_expired := true;
            END IF;
            
            IF flow.max_occurrences IS NOT NULL AND updated_occurrences >= flow.max_occurrences THEN
                has_expired := true;
            END IF;

            -- D. Update the recurring configuration
            UPDATE public.recurring_expenses 
            SET next_occurrence = new_date,
                num_occurrences = updated_occurrences,
                is_active = CASE WHEN has_expired THEN false ELSE is_active END
            WHERE id = flow.id;
        END;
        
    END LOOP;
END;
$$;
