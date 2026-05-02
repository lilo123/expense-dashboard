-- 1. Create tables ONLY if they don't exist at all (safe, won't drop data)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    limit_amount DECIMAL(12, 2) NOT NULL,
    period TEXT DEFAULT 'monthly'
);

-- 2. Safely add our new columns if the tables ALREADY existed
-- (This prevents the 'IF NOT EXISTS' from silently ignoring our new fields)
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE CASCADE;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- 4. Create policies so users can only see and edit their own data
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;
CREATE POLICY "Users can manage their own categories"
ON categories FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
CREATE POLICY "Users can manage their own budgets"
ON budgets FOR ALL USING (auth.uid() = user_id);
