-- 1. Alter expenses table to change defaults to 'CAD'
ALTER TABLE public.expenses
ALTER COLUMN original_currency SET DEFAULT 'CAD',
ALTER COLUMN currency SET DEFAULT 'CAD';

-- Update existing records logged in previous migrations to CAD
UPDATE public.expenses
SET original_currency = 'CAD', currency = 'CAD'
WHERE original_currency = 'USD';

-- 2. Alter exchange_rates table to default base to 'CAD'
ALTER TABLE public.exchange_rates
ALTER COLUMN base_currency SET DEFAULT 'CAD';

-- Update existing exchange rates base to CAD if any
UPDATE public.exchange_rates
SET base_currency = 'CAD'
WHERE base_currency = 'USD';
