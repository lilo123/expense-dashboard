-- 20260625000000_add_canceled_deal_status.sql

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'deals_status_check' AND table_name = 'deals'
    ) THEN
        ALTER TABLE public.deals DROP CONSTRAINT deals_status_check;
    END IF;
END $$;

ALTER TABLE public.deals ADD CONSTRAINT deals_status_check 
    CHECK (status IN ('exploring', 'active', 'ready_to_claim', 'claimed', 'closed', 'canceled'));

NOTIFY pgrst, 'reload schema';
