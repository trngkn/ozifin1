-- Hàm tạo dữ liệu mẫu cho danh sách users cụ thể với tên khách hàng thật
-- Copy toàn bộ và chạy trong SQL Editor của Supabase

DO $$
DECLARE
    -- Danh sách users từ file CSV
    user_record RECORD;
    users_list CURSOR FOR 
        SELECT * FROM (VALUES 
            ('hau', 'Hậu'),
            ('thao', 'Thảo'),
            ('admin', 'ShankS'),
            ('phuong', 'Phương'),
            ('hung', 'Hùng Béo'),
            ('thanh', 'Thành')
        ) AS t(username, display_name);
        
    i INTEGER;
    v_date DATE;
    v_timestamp TIMESTAMPTZ;
    v_agency TEXT;
    v_customer TEXT;
    v_bank TEXT;
    v_card_type TEXT;
    v_last4 TEXT;
    v_type TEXT;
    v_amount NUMERIC;
    v_fee_rate NUMERIC;
    v_profit NUMERIC;
    v_id TEXT;
    v_prefix TEXT;
    v_max_num INTEGER;
    
    -- Biến cho việc random tên
    v_ho TEXT;
    v_dem TEXT;
    v_ten TEXT;
BEGIN
    FOR user_record IN users_list LOOP
        
        -- Tạo 15 giao dịch cho mỗi user
        FOR i IN 1..15 LOOP
            -- 1. Random ngày trong 60 ngày gần đây
            v_timestamp := NOW() - (floor(random() * 60) || ' days')::interval - (floor(random() * 24) || ' hours')::interval;
            v_date := v_timestamp::DATE;

            -- 2. Tạo ID (Ozi-YYYY-MM-XXX)
            v_prefix := 'Ozi-' || TO_CHAR(v_date, 'YYYY-MM-');
            
            SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM LENGTH(v_prefix) + 1) AS INTEGER)), 0)
            INTO v_max_num
            FROM transactions
            WHERE id LIKE v_prefix || '%';

            v_id := v_prefix || LPAD((v_max_num + 1)::TEXT, 3, '0');

            -- 3. Random Tên Khách Hàng Tiếng Việt
            v_ho := (ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'])[floor(random()*16)+1];
            v_dem := (ARRAY['Văn', 'Thị', 'Đức', 'Ngọc', 'Xuân', 'Minh', 'Thanh', 'Kim', 'Gia', 'Bảo', 'Hữu', 'Tuấn', 'Hoài'])[floor(random()*13)+1];
            v_ten := (ARRAY['Hùng', 'Dũng', 'Tuấn', 'Anh', 'Lan', 'Hương', 'Thúy', 'Hoa', 'Mai', 'Cường', 'Bình', 'Minh', 'Hiếu', 'Nghĩa', 'Trang', 'Linh', 'Vy', 'My', 'Tâm', 'Thảo', 'Hải', 'Sơn', 'Kiên'])[floor(random()*23)+1];
            
            v_customer := v_ho || ' ' || v_dem || ' ' || v_ten;

            -- 4. Random dữ liệu khác
            v_agency := (ARRAY['Đại lý A', 'Đại lý B', 'Đại lý C', 'Đại lý D'])[floor(random()*4)+1];
            v_bank := (ARRAY['Techcombank', 'Vietcombank', 'VPBank', 'MBBank', 'ACB', 'VIB', 'TPBank'])[floor(random()*7)+1];
            v_card_type := (ARRAY['Visa', 'Mastercard', 'JCB'])[floor(random()*3)+1];
            v_last4 := LPAD(floor(random() * 10000)::TEXT, 4, '0');
            v_type := (ARRAY['Rút', 'Đáo', 'Rút+Đáo'])[floor(random()*3)+1];
            
            v_amount := floor(random() * 95 + 5) * 1000000;
            v_fee_rate := 1.2 + (random() * 1.8);
            v_profit := v_amount * (0.3 + random() * 0.7) / 100;

            -- 5. Insert vào DB
            INSERT INTO transactions (
                id, timestamp, sale, agency, customer, bank, card_type, last4, type,
                amount, withdraw_amt, pos, pos_fee, pos_amt, cust_fee, cust_amt, profit,
                status, img_deposit, img_withdraw, img_invoice, created_by, edit_count
            ) VALUES (
                v_id,
                v_timestamp,
                user_record.display_name,
                v_agency,
                v_customer,
                v_bank,
                v_card_type,
                v_last4,
                v_type,
                v_amount,
                v_amount,
                'POS ' || (floor(random()*5)+1)::TEXT,
                v_fee_rate - 0.3,
                v_amount * (v_fee_rate - 0.3) / 100,
                v_fee_rate,
                v_amount * v_fee_rate / 100,
                v_profit,
                'Đã thanh toán',
                ARRAY[]::TEXT[],
                ARRAY[]::TEXT[],
                ARRAY[]::TEXT[],
                user_record.username,
                0
            );
        END LOOP;
    END LOOP;
END $$;
