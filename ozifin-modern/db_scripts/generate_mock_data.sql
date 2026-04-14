-- Hàm tạo giao dịch mẫu
-- Copy toàn bộ đoạn này và chạy trong SQL Editor của Supabase

DO $$
DECLARE
    i INTEGER;
    v_date DATE;
    v_timestamp TIMESTAMPTZ;
    v_sale TEXT;
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
BEGIN
    FOR i IN 1..38 LOOP
        -- 1. Random ngày trong 3 tháng gần đây
        v_timestamp := NOW() - (floor(random() * 90) || ' days')::interval - (floor(random() * 24) || ' hours')::interval;
        v_date := v_timestamp::DATE;

        -- 2. Tạo ID (Ozi-YYYY-MM-XXX)
        -- Tự tính toán lại ID để đảm bảo không trùng trong cùng 1 transaction
        v_prefix := 'Ozi-' || TO_CHAR(v_date, 'YYYY-MM-');
        
        -- Lấy max ID hiện tại trong DB hoặc trong vòng lặp này (nếu có thể check, nhưng đơn giản dùng logic đếm)
        -- Lưu ý: Cách này có thể chậm nếu bảng lớn, nhưng với data mẫu thì ok.
        -- Cần lock hoặc đảm bảo unique. Trong script mẫu này ta dùng random sequence giả định hoặc query trực tiếp.
        -- Để an toàn và chính xác nhất, ta dùng function generate_transaction_id nếu nó đã tồn tại,
        -- Nhưng function đó select từ bảng, có thể không thấy dòng vừa insert trong cùng transaction block nếu isolation level không cho phép?
        -- Trong Postgres, SELECT nhìn thấy data chưa commit của cùng transaction.
        -- Tuy nhiên để chắc ăn, ta query lại chính xác.
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM LENGTH(v_prefix) + 1) AS INTEGER)), 0)
        INTO v_max_num
        FROM transactions
        WHERE id LIKE v_prefix || '%';

        v_id := v_prefix || LPAD((v_max_num + 1)::TEXT, 3, '0');

        -- 3. Random dữ liệu khác
        v_sale := (ARRAY['Nguyen Van A', 'Tran Thi B', 'Admin User'])[floor(random()*3)+1];
        v_agency := (ARRAY['Đại lý A', 'Đại lý B', 'Đại lý C'])[floor(random()*3)+1];
        v_customer := 'Khách hàng Demo ' || floor(random() * 100 + 1)::TEXT;
        v_bank := (ARRAY['Techcombank', 'Vietcombank', 'VPBank', 'MBBank'])[floor(random()*4)+1];
        v_card_type := (ARRAY['Visa', 'Mastercard', 'JCB'])[floor(random()*3)+1];
        v_last4 := LPAD(floor(random() * 10000)::TEXT, 4, '0');
        v_type := (ARRAY['Rút', 'Đáo', 'Rút+Đáo'])[floor(random()*3)+1];
        
        -- Số tiền từ 5tr đến 500tr
        v_amount := floor(random() * 50 + 1) * 1000000; 
        
        -- Phí từ 1.5% đến 3%
        v_fee_rate := 1.5 + (random() * 1.5);
        
        -- Lợi nhuận giả định khoảng 0.5% - 1% số tiền
        v_profit := v_amount * (0.5 + random() * 0.5) / 100;

        -- 4. Insert
        INSERT INTO transactions (
            id,
            timestamp,
            sale,
            agency,
            customer,
            bank,
            card_type,
            last4,
            type,
            amount,
            withdraw_amt,
            pos,
            pos_fee,
            pos_amt,
            cust_fee,
            cust_amt,
            profit,
            status,
            img_deposit,
            img_withdraw,
            img_invoice,
            created_by,
            edit_count
        ) VALUES (
            v_id,
            v_timestamp,
            v_sale,
            v_agency,
            v_customer,
            v_bank,
            v_card_type,
            v_last4,
            v_type,
            v_amount,
            v_amount, -- withdraw_amt (giả định bằng amount)
            'POS Demo',
            v_fee_rate - 0.5, -- pos_fee thấp hơn cust_fee
            v_amount * (v_fee_rate - 0.5) / 100,
            v_fee_rate, -- cust_fee
            v_amount * v_fee_rate / 100,
            v_profit,
            'Đã thanh toán',
            ARRAY[]::TEXT[], -- Không ảnh
            ARRAY[]::TEXT[],
            ARRAY[]::TEXT[],
            'admin', -- Giả định user tạo là admin
            0
        );
    END LOOP;
END $$;
