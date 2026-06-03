-- Create Deals Table for Premium Finance Deal Tracker
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    institution TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit_card', 'chequing_savings', 'brokerage_match', 'other')),
    status TEXT NOT NULL DEFAULT 'exploring' CHECK (status IN ('exploring', 'active', 'ready_to_claim', 'claimed')),
    reward_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    reward_description TEXT NOT NULL,
    target_threshold DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    current_progress DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'CAD',
    deadline TEXT,
    terms_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speedy retrieval per user and status
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own deals"
    ON public.deals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deals"
    ON public.deals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deals"
    ON public.deals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deals"
    ON public.deals FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deals_updated_at ON public.deals;
CREATE TRIGGER trg_deals_updated_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.set_deals_updated_at();
