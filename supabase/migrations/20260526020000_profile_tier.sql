ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'standard' CHECK (tier IN ('standard', 'premium'));

-- Database trigger to prevent standard client users from spoofing premium status via REST API updates or inserts
CREATE OR REPLACE FUNCTION public.prevent_tier_modification_trig()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(auth.role(), 'service_role') != 'service_role' THEN
            NEW.tier = 'standard';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.tier IS DISTINCT FROM OLD.tier THEN
            IF COALESCE(auth.role(), 'service_role') != 'service_role' THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                ) THEN
                    NEW.tier = OLD.tier;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_profiles_tier_guard ON public.profiles;
CREATE TRIGGER tr_profiles_tier_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_tier_modification_trig();

-- Admin users RLS SELECT policy for viewing all user profiles
DROP POLICY IF EXISTS "Admin users can select all user profiles" ON public.profiles;
CREATE POLICY "Admin users can select all user profiles"
ON public.profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Admin users RLS UPDATE policy for modifying user subscription tiers
DROP POLICY IF EXISTS "Admin users can update user profiles" ON public.profiles;
CREATE POLICY "Admin users can update user profiles"
ON public.profiles FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
