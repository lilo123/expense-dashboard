-- supabase/migrations/20260603000001_production_optimizations.sql

-- 1. Create index idx_deals_type on deals(type)
CREATE INDEX IF NOT EXISTS idx_deals_type ON public.deals(type);

-- 2. Create index idx_deal_checklist_items_deal_id on deal_checklist_items(deal_id)
CREATE INDEX IF NOT EXISTS idx_deal_checklist_items_deal_id ON public.deal_checklist_items(deal_id);

-- 3. Add updated_at column to deal_checklist_items and attach dedicated trigger function
ALTER TABLE public.deal_checklist_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_deal_checklist_items_updated_at ON public.deal_checklist_items;
CREATE TRIGGER trg_deal_checklist_items_updated_at
    BEFORE UPDATE ON public.deal_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Secure Denormalization of user_id via Composite Foreign Key & Zero-Downtime NOT NULL
ALTER TABLE public.deals ADD CONSTRAINT uk_deals_id_user_id UNIQUE (id, user_id);

ALTER TABLE public.deal_checklist_items
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id from deals table for existing rows
UPDATE public.deal_checklist_items dci
SET user_id = d.user_id
FROM public.deals d
WHERE dci.deal_id = d.id AND dci.user_id IS NULL;

-- Remove orphaned rows if any before applying constraint
DELETE FROM public.deal_checklist_items WHERE user_id IS NULL;

-- Add zero-downtime check constraint instead of direct table lock
ALTER TABLE public.deal_checklist_items ADD CONSTRAINT chk_deal_checklist_items_user_id_not_null CHECK (user_id IS NOT NULL) NOT VALID;
ALTER TABLE public.deal_checklist_items VALIDATE CONSTRAINT chk_deal_checklist_items_user_id_not_null;

-- Enforce denormalization integrity composite foreign key
ALTER TABLE public.deal_checklist_items ADD CONSTRAINT fk_deal_checklist_items_composite FOREIGN KEY (deal_id, user_id) REFERENCES public.deals(id, user_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_deal_checklist_items_user_id ON public.deal_checklist_items(user_id);

-- Simplify RLS policy with explicit WITH CHECK clause
DROP POLICY IF EXISTS "Users can manage their own deal checklists" ON public.deal_checklist_items;
CREATE POLICY "Users can manage their own deal checklists"
    ON public.deal_checklist_items
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
