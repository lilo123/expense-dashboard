-- 20260603000000_redesign_finance_deal_tracker.sql

-- 1. Ensure deals table exists (fallback if starting fresh)
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'exploring',
    open_date DATE,
    note TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    type_specific_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Alter existing deals table to rename old columns if they exist (from 20260602)
DO $$
BEGIN
    -- Rename institution to company
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'institution') THEN
        ALTER TABLE public.deals RENAME COLUMN institution TO company;
    END IF;

    -- Rename notes to note
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'notes') THEN
        ALTER TABLE public.deals RENAME COLUMN notes TO note;
    END IF;
    
    -- Rename reward_value to bonus_amount
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'reward_value') THEN
        ALTER TABLE public.deals RENAME COLUMN reward_value TO bonus_amount;
    END IF;
END $$;

-- 3. Add new columns safely
ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS open_date DATE,
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS type_specific_data JSONB;

-- Backfill company if it was null before enforcing NOT NULL
UPDATE public.deals SET company = 'Unknown' WHERE company IS NULL;
ALTER TABLE public.deals ALTER COLUMN company SET NOT NULL;

-- 4. Safely map reward_description to note and drop legacy columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'reward_description') THEN
        EXECUTE 'UPDATE public.deals SET note = CONCAT(COALESCE(note, ''''), '' | Legacy Reward: '', reward_description) WHERE reward_description IS NOT NULL AND reward_description != ''''';
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN reward_description';
    END IF;
    
    -- Drop other legacy columns we moved to JSONB or renamed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'title') THEN
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN title';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'description') THEN
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN description';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'target_threshold') THEN
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN target_threshold';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'current_progress') THEN
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN current_progress';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'deadline') THEN
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN deadline';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'terms_url') THEN
        EXECUTE 'ALTER TABLE public.deals DROP COLUMN terms_url';
    END IF;
END $$;

-- 5. Map legacy types
UPDATE public.deals SET type = 'bank_account' WHERE type = 'chequing_savings';
UPDATE public.deals SET type = 'brokerage_account' WHERE type = 'brokerage_match';

-- 6. Modify type constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'deals_type_check' AND table_name = 'deals'
    ) THEN
        ALTER TABLE public.deals DROP CONSTRAINT deals_type_check;
    END IF;
END $$;
ALTER TABLE public.deals ADD CONSTRAINT deals_type_check CHECK (type IN ('credit_card', 'bank_account', 'brokerage_account', 'other'));

-- 7. Modify status constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'deals_status_check' AND table_name = 'deals'
    ) THEN
        ALTER TABLE public.deals DROP CONSTRAINT deals_status_check;
    END IF;
END $$;
ALTER TABLE public.deals ADD CONSTRAINT deals_status_check CHECK (status IN ('exploring', 'active', 'ready_to_claim', 'claimed', 'closed'));

-- 8. Create deal_checklist_items table
CREATE TABLE IF NOT EXISTS public.deal_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    deadline DATE,
    is_done BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Setup RLS for checklist items
ALTER TABLE public.deal_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own deal checklists" ON public.deal_checklist_items;
CREATE POLICY "Users can manage their own deal checklists"
    ON public.deal_checklist_items
    FOR ALL
    USING (
        deal_id IN (SELECT id FROM public.deals WHERE user_id = auth.uid())
    );

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
