-- Disable stricter RLS policies that rely on session variables
-- and allow anonymous access for now (since we use client-side auth).

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users read own transactions" ON transactions;
DROP POLICY IF EXISTS "Users insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users update with limits" ON transactions;
DROP POLICY IF EXISTS "Admins can delete" ON transactions;

-- 2. Create permissive policies for the anonymous role
-- This allows any user with the API key to perform these actions.
-- Security is handled by the application logic (filtering by user role in the UI).

CREATE POLICY "Enable all for anon"
ON transactions
FOR ALL
USING (true)
WITH CHECK (true);

-- Note: In a production environment with sensitive data, you should implement
-- proper Supabase Auth (GoTrue) instead of relying on localStorage.
