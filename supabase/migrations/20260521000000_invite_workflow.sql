-- 1. Ensure profiles.role column exists prior to RLS policy definition
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 2. Ensure baseline table structure exists
CREATE TABLE IF NOT EXISTS public.invite_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Ensure Row Level Security is explicitly enabled
ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

-- 4. Add workflow tracking status with 4-tier lifecycle and timestamps
ALTER TABLE public.invite_requests
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'claimed')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 5. Secure RLS UPDATE policy restricting table state mutations strictly to administrator profiles
DROP POLICY IF EXISTS "Admin users can update invite requests" ON public.invite_requests;
CREATE POLICY "Admin users can update invite requests"
ON public.invite_requests FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
