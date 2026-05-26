-- supabase/migrations/20260526000000_gtm_hardening.sql

-- 1. DDL Pre-cleanup: Delete orphaned records
DELETE FROM public.categories WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.budgets WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.expenses WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2. Enforce relational integrity constraints with ON DELETE CASCADE
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS fk_categories_user_id,
  ADD CONSTRAINT fk_categories_user_id
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS fk_budgets_user_id,
  ADD CONSTRAINT fk_budgets_user_id
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 3. Enforce relational integrity constraints with ON DELETE CASCADE on expenses
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS fk_expenses_user_id,
  ADD CONSTRAINT fk_expenses_user_id
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 4. Revoke EXECUTE permissions on public.check_rate_limit_rpc and grant strictly to service_role
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_rpc(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_rpc(TEXT, INT, INT) TO service_role;

-- 5. Drop the dangerous insertion policy on public.exchange_rates
DROP POLICY IF EXISTS "Allow authenticated users to insert exchange rates" ON public.exchange_rates;
