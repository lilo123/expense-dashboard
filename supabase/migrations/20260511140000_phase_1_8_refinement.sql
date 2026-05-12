-- 1. Alter Recurring Expenses Table to Support Refined Schedules and Expiration
ALTER TABLE public.recurring_expenses 
ADD COLUMN IF NOT EXISTS day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 (Sunday) to 6 (Saturday), weekly only
ADD COLUMN IF NOT EXISTS day_of_month INT CHECK (day_of_month >= 1 AND day_of_month <= 31), -- 1 to 31, monthly specific only
ADD COLUMN IF NOT EXISTS is_last_day_of_month BOOLEAN DEFAULT false, -- monthly last day only
ADD COLUMN IF NOT EXISTS end_date DATE, -- optional expiration date
ADD COLUMN IF NOT EXISTS max_occurrences INT, -- optional occurrences cap
ADD COLUMN IF NOT EXISTS num_occurrences INT DEFAULT 0; -- track running total of executions

-- 2. Helper Function: Calculate Initial Next Occurrence Date (Trigger-Bound)
CREATE OR REPLACE FUNCTION public.calculate_first_occurrence(
    start_date DATE, 
    freq TEXT, 
    dow INT, 
    dom INT, 
    last_day BOOLEAN
)
RETURNS DATE 
LANGUAGE plpgsql
AS $$
DECLARE
    first_date DATE;
BEGIN
    IF freq = 'weekly' THEN
        -- dow: 0 (Sunday) to 6 (Saturday). Align start_date forward to target dow.
        first_date := start_date + ((dow - extract(dow from start_date)::int + 7) % 7);
        RETURN first_date;
    ELSIF freq = 'monthly' THEN
        IF last_day THEN
            -- Last day of the current month
            first_date := (date_trunc('month', start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
            RETURN first_date;
        ELSE
            -- Specific day of the month (dom)
            DECLARE
                current_month_first DATE;
                days_in_month INT;
                target_day INT;
            BEGIN
                current_month_first := date_trunc('month', start_date)::date;
                days_in_month := extract(day from (current_month_first + INTERVAL '1 month' - INTERVAL '1 day'))::int;
                target_day := least(dom, days_in_month);
                first_date := current_month_first + (target_day - 1) * INTERVAL '1 day';
                
                -- If target day is in the past relative to start_date, advance to next month
                IF first_date < start_date THEN
                    DECLARE
                        next_month_first DATE;
                        days_in_next_month INT;
                    BEGIN
                        next_month_first := (current_month_first + INTERVAL '1 month')::date;
                        days_in_next_month := extract(day from (next_month_first + INTERVAL '1 month' - INTERVAL '1 day'))::int;
                        target_day := least(dom, days_in_next_month);
                        first_date := next_month_first + (target_day - 1) * INTERVAL '1 day';
                    END;
                END IF;
                RETURN first_date;
            END;
        END IF;
    END IF;
    RETURN start_date;
END;
$$;

-- 3. Trigger Function: Set Initial next_occurrence automatically
CREATE OR REPLACE FUNCTION public.set_initial_next_occurrence()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.next_occurrence := public.calculate_first_occurrence(
        NEW.start_date, 
        NEW.frequency, 
        NEW.day_of_week, 
        NEW.day_of_month, 
        NEW.is_last_day_of_month
    );
    RETURN NEW;
END;
$$;

-- Wire up Trigger
DROP TRIGGER IF EXISTS trigger_set_initial_next_occurrence ON public.recurring_expenses;
CREATE TRIGGER trigger_set_initial_next_occurrence
BEFORE INSERT ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.set_initial_next_occurrence();

-- 4. Helper Function: Calculate Next Occurrence from Current Occurrence
CREATE OR REPLACE FUNCTION public.calculate_next_occurrence_v2(
    base_date DATE, 
    freq TEXT, 
    dow INT, 
    dom INT, 
    last_day BOOLEAN
)
RETURNS DATE 
LANGUAGE plpgsql
AS $$
DECLARE
    next_date DATE;
BEGIN
    IF freq = 'weekly' THEN
        next_date := base_date + ((dow - extract(dow from base_date)::int + 7) % 7);
        IF next_date <= base_date THEN
            next_date := next_date + INTERVAL '1 week';
        END IF;
        RETURN next_date;
        
    ELSIF freq = 'monthly' THEN
        IF last_day THEN
            next_date := (date_trunc('month', base_date) + INTERVAL '2 month' - INTERVAL '1 day')::date;
            RETURN next_date;
        ELSE
            DECLARE
                next_month_first DATE;
                days_in_next_month INT;
                target_day INT;
            BEGIN
                next_month_first := (date_trunc('month', base_date) + INTERVAL '1 month')::date;
                days_in_next_month := extract(day from (date_trunc('month', next_month_first) + INTERVAL '1 month' - INTERVAL '1 day'))::int;
                target_day := least(dom, days_in_next_month);
                next_date := next_month_first + (target_day - 1) * INTERVAL '1 day';
                RETURN next_date;
            END;
        END IF;
    END IF;
    RETURN base_date;
END;
$$;

-- 5. Worker Function: Refactored to Handle Timezone-Aware Recur Math & Expirations (Replaced previous process_recurring_expenses)
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
        -- A. Log the expense matching next_occurrence
        INSERT INTO public.expenses (
            user_id, item, amount, original_amount, original_currency, currency, category_id, date, recurring_expense_id
        ) VALUES (
            flow.user_id, flow.item, flow.amount, flow.amount, flow.currency, flow.currency, flow.category_id, flow.next_occurrence, flow.id
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
