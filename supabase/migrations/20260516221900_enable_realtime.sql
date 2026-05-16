-- Enable Realtime for expenses table
BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
COMMIT;
