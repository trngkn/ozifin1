# OZIFIN Modern - Hệ thống Quản lý Dòng Tiền

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)

Hệ thống quản lý giao dịch thẻ tín dụng hiện đại, được xây dựng với công nghệ mới nhất.

## ✨ Tính Năng

### 🔐 Xác Thực & Phân Quyền
- Đăng nhập an toàn với Supabase Auth
- 3 cấp độ người dùng: Admin, Manager, Sale
- Row Level Security (RLS) cho bảo mật dữ liệu

### 📊 Dashboard Thống Kê
- Biểu đồ doanh thu và lợi nhuận theo ngày
- Thống kê tổng quan (Volume, Profit, Số GD)
- Lọc theo tháng/năm
- Giao dịch gần đây

### 💳 Quản Lý Giao Dịch
- Tạo/Sửa/Xóa giao dịch
- Mã giao dịch tự động: `Ozi-YYYY-MM-###`
- 3 loại giao dịch: Rút, Đáo, Rút+Đáo
- Tính toán phí và lợi nhuận tự động
- Giới hạn sửa: 2 lần cho Sale, không giới hạn cho Admin/Manager

### 🔍 Tìm Kiếm & Lọc
- Lọc theo ngày, khách hàng, loại GD
- Tìm kiếm nhanh
- Phân trang 10 items/trang
- Xuất CSV

### 🖼️ Quản Lý Ảnh
- Upload nhiều ảnh cùng lúc
- Lưu trữ trên ImgBB (miễn phí)
- 3 loại chứng từ: Bill nạp, Bill rút, Hoá đơn
- Xem ảnh full size

### 🎨 Giao Diện Hiện Đại
- Design gradient đẹp mắt
- Glassmorphism effects
- Responsive 100% (Mobile, Tablet, Desktop)
- Dark mode ready
- Animations mượt mà

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + Custom animations
- **Database**: Supabase (PostgreSQL)
- **Image Storage**: ImgBB API
- **Charts**: Chart.js + react-chartjs-2
- **Deployment**: Vercel
- **Icons**: Lucide React

## 📦 Cài Đặt

### Yêu Cầu

- Node.js 18+
- npm hoặc yarn

### Bước 1: Clone Project

```bash
git clone <repository-url>
cd ozifin-modern
```

### Bước 2: Cài Dependencies

```bash
npm install
```

### Bước 3: Cấu Hình Environment Variables

Tạo file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_IMGBB_API_KEY=your_imgbb_api_key
```

### Bước 4: Setup Database

1. Tạo project trên [Supabase](https://supabase.com)
2. Chạy SQL trong file `supabase-schema.sql`
3. Copy URL và API key vào `.env.local`

### Bước 5: Chạy Development Server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

### Bước 6: Login

- **Username**: `admin`
- **Password**: `admin123`

## 📖 Hướng Dẫn Deploy

Xem file **DEPLOYMENT_GUIDE.md** trong thư mục artifacts để biết chi tiết.

**Tóm tắt**:
1. Setup Supabase project
2. Lấy ImgBB API key
3. Push code lên GitHub
4. Deploy với Vercel
5. Thêm environment variables
6. Done! 🎉

## 📁 Cấu Trúc Project

```
ozifin-modern/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # Dashboard pages
│   │   │   ├── page.tsx        # Dashboard chính
│   │   │   └── transactions/   # Quản lý giao dịch
│   │   │       ├── page.tsx    # Danh sách
│   │   │       └── [id]/       # Form tạo/sửa
│   │   ├── login/              # Trang đăng nhập
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── lib/                    # Utilities
│   │   ├── supabase.ts         # Supabase client
│   │   ├── imgbb.ts            # ImgBB upload
│   │   └── utils.ts            # Helper functions
│   └── types/                  # TypeScript types
│       └── index.ts
├── supabase-schema.sql         # Database schema
└── package.json
```

## 🎯 Tính Năng Nổi Bật

### Auto-ID Generation
Mã giao dịch tự động theo format `Ozi-YYYY-MM-###`:
- `Ozi-2026-01-001`
- `Ozi-2026-01-002`
- ...

### Auto-Calculation
Tự động tính:
- Phí POS = Số tiền × % Phí POS
- Thu khách = Số tiền × % Phí khách
- Lợi nhuận = Thu khách - Phí POS

### Edit Tracking
- Sale: Tối đa 2 lần sửa
- Manager/Admin: Không giới hạn
- Đếm số lần sửa tự động

### Image Upload
- Drag & drop hoặc click để chọn
- Upload lên ImgBB
- Lưu URL vào database
- Xóa ảnh dễ dàng

## 🔒 Bảo Mật

- ✅ Row Level Security (RLS) với Supabase
- ✅ Environment variables cho sensitive data
- ✅ HTTPS mặc định với Vercel
- ✅ Input validation
- ✅ SQL injection protection (Supabase)

## 📊 Database Schema

### Users Table
```sql
- id (UUID)
- username (TEXT, unique)
- password_hash (TEXT)
- role (admin | manager | sale)
- display_name (TEXT)
- created_at, updated_at
```

### Transactions Table
```sql
- id (TEXT, PK)
- timestamp (TIMESTAMPTZ)
- sale, agency, customer
- bank, card_type, last4
- type (Rút | Đáo | Rút+Đáo)
- amount, profit, status
- img_deposit[], img_withdraw[], img_invoice[]
- created_by, edit_count
- created_at, updated_at
```

### Settings Table
```sql
- id (UUID)
- category (TEXT)
- value (TEXT)
```

## 🎨 Design System

### Colors
- **Primary**: Indigo (600-700)
- **Secondary**: Purple (500-600)
- **Success**: Emerald (500-600)
- **Warning**: Orange (500-600)
- **Danger**: Red (500-600)

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: Bold, Black weights
- **Body**: Regular, Medium weights

### Components
- Rounded corners: `rounded-xl` (12px)
- Shadows: Soft, layered
- Borders: 2px solid
- Transitions: 200-300ms

## 📈 Performance

- ⚡ Next.js 14 với App Router
- 🚀 Server-side rendering
- 📦 Code splitting tự động
- 🎯 Optimized images
- 💾 Database indexing

## 🐛 Troubleshooting

### Lỗi kết nối Supabase
```bash
# Kiểm tra .env.local
# Restart dev server
npm run dev
```

### Lỗi upload ảnh
```bash
# Kiểm tra ImgBB API key
# Giới hạn: 32MB/ảnh
```

### Lỗi build
```bash
# Clear cache và rebuild
rm -rf .next
npm run build
```

## 📝 License

MIT License - Tự do sử dụng cho mục đích cá nhân và thương mại.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra DEPLOYMENT_GUIDE.md trong artifacts
2. Xem phần Troubleshooting
3. Tạo issue trên GitHub

---

**Made with ❤️ using Next.js, Supabase, and Tailwind CSS**

© 2026 OZIFIN - Giải pháp tài chính toàn diện cho doanh nghiệp
