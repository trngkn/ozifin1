-- Create app_config table for system settings
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default values
INSERT INTO app_config (key, value, description) VALUES
  ('login_title', 'OZIFIN', 'Tiêu đề trang đăng nhập'),
  ('login_slogan', 'Hệ thống quản lý dòng tiền chuyên nghiệp', 'Khẩu hiệu trang đăng nhập'),
  ('sidebar_title', 'OZIFIN', 'Tên hệ thống trên Sidebar'),
  ('sidebar_slogan', 'Transaction System', 'Mô tả hệ thống trên Sidebar')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read config
CREATE POLICY "Everyone can read config"
  ON app_config FOR SELECT
  USING (true);

-- Policy: Only admins can update config
CREATE POLICY "Admins can update config"
  ON app_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE username = current_setting('app.current_user', true) 
      AND role = 'admin'
    )
  );
