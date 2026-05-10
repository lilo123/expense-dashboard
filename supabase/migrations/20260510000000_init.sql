-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- 2. Create Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    item TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    limit_amount DECIMAL(12, 2) NOT NULL,
    period TEXT DEFAULT 'monthly'
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;
CREATE POLICY "Users can manage their own categories"
ON categories FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;
CREATE POLICY "Users can manage their own expenses"
ON expenses FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
CREATE POLICY "Users can manage their own budgets"
ON budgets FOR ALL USING (auth.uid() = user_id);
