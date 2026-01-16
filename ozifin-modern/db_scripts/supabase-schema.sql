-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'sale')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  sale TEXT NOT NULL,
  agency TEXT NOT NULL,
  customer TEXT NOT NULL,
  bank TEXT NOT NULL,
  card_type TEXT NOT NULL,
  last4 TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Rút', 'Đáo', 'Rút+Đáo')),
  amount NUMERIC(15,2) NOT NULL,
  withdraw_amt NUMERIC(15,2),
  pos TEXT,
  pos_fee NUMERIC(5,2),
  pos_amt NUMERIC(15,2),
  cust_fee NUMERIC(5,2),
  cust_amt NUMERIC(15,2),
  profit NUMERIC(15,2),
  status TEXT NOT NULL CHECK (status IN ('Chưa thanh toán', 'Đã thanh toán')),
  img_deposit TEXT[],
  img_withdraw TEXT[],
  img_invoice TEXT[],
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edit_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (for dropdown options)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_customer ON transactions(customer);
CREATE INDEX idx_transactions_sale ON transactions(sale);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);

-- Function to generate transaction ID
CREATE OR REPLACE FUNCTION generate_transaction_id(txn_date DATE)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  max_num INTEGER;
  next_num INTEGER;
  result TEXT;
BEGIN
  prefix := 'Ozi-' || TO_CHAR(txn_date, 'YYYY-MM-');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(id FROM LENGTH(prefix) + 1) AS INTEGER)
  ), 0) INTO max_num
  FROM transactions
  WHERE id LIKE prefix || '%';
  
  next_num := max_num + 1;
  result := prefix || LPAD(next_num::TEXT, 3, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password: admin123)
-- Note: In production, use proper password hashing
INSERT INTO users (username, password_hash, role, display_name) 
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 'Administrator');

-- Insert default settings
INSERT INTO settings (category, value) VALUES
  ('agency', 'Đại lý A'),
  ('agency', 'Đại lý B'),
  ('pos', 'POS 1'),
  ('pos', 'POS 2'),
  ('bank', 'Techcombank'),
  ('bank', 'Vietcombank'),
  ('bank', 'VPBank'),
  ('bank', 'ACB'),
  ('cardType', 'Visa'),
  ('cardType', 'Mastercard'),
  ('cardType', 'JCB');

-- Row Level Security Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions or if they're admin/manager
CREATE POLICY "Users read own transactions"
  ON transactions FOR SELECT
  USING (
    created_by = current_setting('app.current_user', true) OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE username = current_setting('app.current_user', true) 
      AND role IN ('admin', 'manager')
    )
  );

-- Users can insert their own transactions
CREATE POLICY "Users insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.current_user', true)
  );

-- Users can update with edit count limits
CREATE POLICY "Users update with limits"
  ON transactions FOR UPDATE
  USING (
    (created_by = current_setting('app.current_user', true) AND edit_count < 2) OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE username = current_setting('app.current_user', true) 
      AND role IN ('admin', 'manager')
    )
  );

-- Admins can delete
CREATE POLICY "Admins can delete"
  ON transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE username = current_setting('app.current_user', true) 
      AND role = 'admin'
    )
  );
