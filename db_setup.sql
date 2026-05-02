-- Create Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Create Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    limit_amount DECIMAL(12, 2) NOT NULL,
    period TEXT DEFAULT 'monthly'
);
