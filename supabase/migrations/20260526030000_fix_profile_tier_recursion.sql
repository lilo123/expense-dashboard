-- Alter invite_requests status check constraint to permit optimistic concurrency 'processing' lock state
ALTER TABLE public.invite_requests DROP CONSTRAINT IF EXISTS invite_requests_status_check;
ALTER TABLE public.invite_requests ADD CONSTRAINT invite_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'claimed', 'processing'));

-- STABLE Helper function bypassing RLS to safely evaluate user admin role without triggering error 42P17 infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Safely evaluate JWT claims individually using logical OR to completely bypass recursive public.profiles table lookups
    IF (auth.jwt()->>'role' = 'admin') OR (auth.jwt()->'user_metadata'->>'role' = 'admin') OR (auth.jwt()->'app_metadata'->>'role' = 'admin') THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- VOLATILE Database trigger to prevent standard client users from spoofing premium status or escalating privileges via REST API updates/inserts
CREATE OR REPLACE FUNCTION public.prevent_tier_modification_trig()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(auth.role(), 'service_role') != 'service_role' THEN
            IF NOT public.is_admin() THEN
                NEW.tier = 'standard';
                NEW.role = 'user';
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.tier IS DISTINCT FROM OLD.tier OR NEW.role IS DISTINCT FROM OLD.role THEN
            IF COALESCE(auth.role(), 'service_role') != 'service_role' THEN
                IF NOT public.is_admin() THEN
                    NEW.tier = OLD.tier;
                    NEW.role = OLD.role;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_profiles_tier_guard ON public.profiles;
CREATE TRIGGER tr_profiles_tier_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_tier_modification_trig();

-- Admin users RLS SELECT policy for viewing all user profiles
DROP POLICY IF EXISTS "Admin users can select all user profiles" ON public.profiles;
CREATE POLICY "Admin users can select all user profiles"
ON public.profiles FOR SELECT USING (public.is_admin());

-- Admin users RLS UPDATE policy for modifying user subscription tiers
DROP POLICY IF EXISTS "Admin users can update user profiles" ON public.profiles;
CREATE POLICY "Admin users can update user profiles"
ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Update historical invite_requests RLS policies to evaluate public.is_admin() to prevent relational transitive recursion
DROP POLICY IF EXISTS "Admin users can view invite requests" ON public.invite_requests;
DROP POLICY IF EXISTS "Admin users can select all invite requests" ON public.invite_requests;
CREATE POLICY "Admin users can select all invite requests"
ON public.invite_requests FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin users can update invite requests" ON public.invite_requests;
CREATE POLICY "Admin users can update invite requests"
ON public.invite_requests FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Update historical email_templates RLS policies to evaluate public.is_admin() to prevent relational transitive recursion
DROP POLICY IF EXISTS "Admin users can select email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admin users can view email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admin users can select all email templates" ON public.email_templates;
CREATE POLICY "Admin users can select all email templates"
ON public.email_templates FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin users can insert email templates" ON public.email_templates;
CREATE POLICY "Admin users can insert email templates"
ON public.email_templates FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin users can update email templates" ON public.email_templates;
CREATE POLICY "Admin users can update email templates"
ON public.email_templates FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
