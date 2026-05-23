-- Policy: Allow authenticated users to insert cached exchange rates
CREATE POLICY "Allow authenticated users to insert exchange rates"
ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (true);
