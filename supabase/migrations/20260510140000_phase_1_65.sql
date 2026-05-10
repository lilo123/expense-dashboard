-- 1. Alter expenses table to support dual amounts and currencies
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS original_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- Ensure existing rows have original_amount initialized to amount
UPDATE public.expenses
SET original_amount = amount
WHERE original_amount = 0.00;

-- 2. Create exchange_rates Table for caching FX rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    rates JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read cached exchange rates
DROP POLICY IF EXISTS "Allow authenticated users to read exchange rates" ON public.exchange_rates;
CREATE POLICY "Allow authenticated users to read exchange rates"
ON public.exchange_rates FOR SELECT TO authenticated USING (true);

-- 3. Create PL/pgSQL trigger function for bulletproof category seeding
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Wrap DML in a nested exception block to guarantee user signup never fails!
    BEGIN
        INSERT INTO public.categories (user_id, name)
        VALUES
            (NEW.id, 'Housing'),
            (NEW.id, 'Utilities'),
            (NEW.id, 'Insurance'),
            (NEW.id, 'Groceries'),
            (NEW.id, 'Dining Out'),
            (NEW.id, 'Transportation'),
            (NEW.id, 'Household'),
            (NEW.id, 'Health & Care'),
            (NEW.id, 'Subscriptions'),
            (NEW.id, 'Shopping'),
            (NEW.id, 'Entertainment'),
            (NEW.id, 'Travel'),
            (NEW.id, 'Gifts'),
            (NEW.id, 'Education'),
            (NEW.id, 'Misc'),
            (NEW.id, 'Sport');
    EXCEPTION WHEN OTHERS THEN
        -- Log warning but swallow the exception to protect the signup transaction
        RAISE WARNING 'Failed to seed default categories for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Wire up trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();
