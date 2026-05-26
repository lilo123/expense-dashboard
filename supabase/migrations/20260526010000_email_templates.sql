CREATE TABLE IF NOT EXISTS public.email_templates (
    id TEXT PRIMARY KEY DEFAULT 'invite_approval',
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can select email templates" ON public.email_templates;
CREATE POLICY "Admin users can select email templates"
ON public.email_templates FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admin users can insert email templates" ON public.email_templates;
CREATE POLICY "Admin users can insert email templates"
ON public.email_templates FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admin users can update email templates" ON public.email_templates;
CREATE POLICY "Admin users can update email templates"
ON public.email_templates FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

INSERT INTO public.email_templates (id, subject, html_body, updated_at)
VALUES (
    'invite_approval',
    'Welcome to An-yen — Your Private Early Adopter Access',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; color: #1c1917;"><h1 style="color: #1c1917; font-size: 24px; font-weight: bold;">Your Private Access Granted</h1><p style="font-size: 16px; line-height: 1.5; color: #444;">Thank you for sharing your motivation with us. We are incredibly thrilled to welcome you into the An-yen early adopter cohort!</p><div style="margin: 30px 0;"><a href="https://an-yen.com/login?secret=flow-vip#toggle-to-signup" style="background-color: #1c1917; color: #fbf9f4; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Access An-yen Platform</a></div><p style="font-size: 13px; color: #888;">Please note: This access URL is protected. Our backend verifies your exact email address prior to profile creation.</p></div>',
    now()
) ON CONFLICT (id) DO NOTHING;
