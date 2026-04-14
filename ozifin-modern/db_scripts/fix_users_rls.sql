-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy to match previous 'public' behavior
-- (ensures application functionality is not broken by the sudden RLS enablement)
-- Warning: This allows public access to user data including hashes. 
-- In production, strict policies should be applied.
CREATE POLICY "Enable unrestricted access for now"
ON public.users
FOR ALL
USING (true)
WITH CHECK (true);
