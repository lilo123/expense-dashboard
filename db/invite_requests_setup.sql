-- Create invite_requests table for invite-only flow
CREATE TABLE IF NOT EXISTS invite_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE invite_requests ENABLE ROW LEVEL SECURITY;

-- Allow unauthenticated public inserts (so prospective users can request access!)
DROP POLICY IF EXISTS "Anyone can insert invite requests" ON invite_requests;
CREATE POLICY "Anyone can insert invite requests"
ON invite_requests FOR INSERT WITH CHECK (true);

-- Allow authenticated users to view requests (for admin purposes)
DROP POLICY IF EXISTS "Authenticated users can view invite requests" ON invite_requests;
CREATE POLICY "Authenticated users can view invite requests"
ON invite_requests FOR SELECT USING (auth.role() = 'authenticated');
