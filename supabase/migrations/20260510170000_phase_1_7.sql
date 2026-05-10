-- 1. Create profiles table referencing auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    base_currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
    budget_reset_day INT NOT NULL DEFAULT 1,
    ai_tone TEXT NOT NULL DEFAULT 'nurturing',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow users to select their own profile row
DROP POLICY IF EXISTS "Allow users to select their own profile" ON public.profiles;
CREATE POLICY "Allow users to select their own profile"
ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- RLS Policy: Allow users to update their own profile row
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Refactor Categories trigger function to perform both profile and categories seeding
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER AS $$
DECLARE
    default_display_name TEXT;
BEGIN
    -- Wrap entire metadata initialization block in a nested exception catch
    BEGIN
        -- Parse default display name from email prefix (e.g. katherine from katherine@example.com)
        default_display_name := split_part(NEW.email, '@', 1);

        -- A. Seed default profile row
        INSERT INTO public.profiles (id, display_name, base_currency, budget_reset_day, ai_tone)
        VALUES (NEW.id, default_display_name, 'CAD', 1, 'nurturing')
        ON CONFLICT (id) DO NOTHING;

        -- B. Seed default categories
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
            (NEW.id, 'Sport')
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Graceful degradation: Log postgres warning but let auth user signup complete!
        RAISE WARNING 'Failed to seed user profile or default categories for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
