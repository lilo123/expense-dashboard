-- supabase/migrations/20260603000002_fix_postgrest_join_compatibility.sql

-- Drop the composite foreign key that breaks PostgREST embedded joins (PGRST201/PGRST200)
ALTER TABLE public.deal_checklist_items DROP CONSTRAINT IF EXISTS fk_deal_checklist_items_composite;

-- Ensure the standard single foreign key on deal_id is active for clean resource embedding
ALTER TABLE public.deal_checklist_items DROP CONSTRAINT IF EXISTS deal_checklist_items_deal_id_fkey;
ALTER TABLE public.deal_checklist_items ADD CONSTRAINT deal_checklist_items_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
