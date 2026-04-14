-- Enable RLS on app_config table to resolve Supabase issue
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
