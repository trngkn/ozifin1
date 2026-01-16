-- Migration script to add avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- (Optional) Update existing users slightly to ensure they have valid timestamps if any are null
UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL;
