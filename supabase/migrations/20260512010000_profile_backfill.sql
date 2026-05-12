-- 20260512010000_profile_backfill.sql
-- Retroactively seed missing profiles for all existing auth.users (Data backfill)

INSERT INTO public.profiles (id, display_name, base_currency, budget_reset_day, ai_tone)
SELECT 
  u.id, 
  split_part(u.email, '@', 1) as display_name, 
  'CAD' as base_currency, 
  1 as budget_reset_day, 
  'nurturing' as ai_tone
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
