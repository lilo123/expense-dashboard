-- Add B-Tree index to foreign key category_id on budgets table to optimize relational cascading lookups and deletions
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON public.budgets(category_id);

-- SQL RPC Function to offload chart category aggregates from Client memory loops to PostgreSQL engine
CREATE OR REPLACE FUNCTION public.get_monthly_aggregates(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    category_id UUID,
    category_name TEXT,
    total_amount DECIMAL(12, 2)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.category_id,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        COALESCE(SUM(e.amount), 0)::DECIMAL(12, 2) AS total_amount
    FROM public.expenses e
    LEFT JOIN public.categories c ON e.category_id = c.id
    WHERE e.user_id = p_user_id
      AND e.date >= p_start_date
      AND e.date <= p_end_date
    GROUP BY e.category_id, c.name
    ORDER BY total_amount DESC;
END;
$$;

