-- Enable RLS on settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (matches previous public state)
CREATE POLICY "Enable all access for settings"
ON public.settings
FOR ALL
USING (true)
WITH CHECK (true);
