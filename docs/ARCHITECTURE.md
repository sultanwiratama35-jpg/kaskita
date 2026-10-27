# KasKita — Analisis Kebutuhan dan Arsitektur

## 1. Analisis kebutuhan

### Kebutuhan fungsional

1. Autentikasi pengguna melalui Supabase Auth: pendaftaran, masuk, keluar, pemulihan kata sandi, dan pembaruan kata sandi.
2. Organisasi: pembuatan ruang kerja, pergantian organisasi aktif, pengubahan informasi organisasi, serta undangan anggota berbasis tautan.
3. Hak akses: bendahara mengelola transaksi dan iuran; anggota melihat ringkasan serta tagihannya sendiri; auditor melihat catatan dan audit tanpa mengubah transaksi; administrator platform mengelola organisasi dan keanggotaan lintas organisasi.
4. Transaksi: pemasukan/pengeluaran, kategori, tanggal, nominal, keterangan, bukti, pencarian, filter, pengurutan, ekspor CSV, pengubahan, dan pembatalan tanpa penghapusan permanen.
5. Iuran: rencana iuran, tagihan per anggota, jatuh tempo, pembayaran sebagian/penuh, status, serta rekap.
6. Laporan: saldo periode, pemasukan, pengeluaran, kategori, pembayaran iuran, ekspor PDF dan Excel.
7. Audit: pencatatan perubahan transaksi, pembayaran, keanggotaan, undangan, dan pengaturan organisasi.

### Kebutuhan nonfungsional

- Bahasa antarmuka Indonesia, mata uang IDR, dan format tanggal Indonesia.
- Layout responsif dan hierarki informasi yang ringkas.
- Isolasi data antarorganisasi pada level database, bukan hanya menyembunyikan menu di frontend.
- Perhitungan uang menggunakan `numeric(14,0)` untuk nominal Rupiah bulat, bukan aritmetika floating-point di database.
- Data saldo berasal dari transaksi `posted`; tagihan yang belum diterima tidak menambah kas.
- Transaksi dibatalkan menjadi `voided` sehingga tidak masuk saldo tetapi tetap tersimpan.
- Tidak ada seed transaksi dummy. Kondisi kosong ditampilkan sampai pengguna memasukkan data riil.

## 2. Struktur proyek

```text
kaskita/
├── index.html
├── package.json
├── .env.example
├── README.md
├── docs/
│   └── ARCHITECTURE.md
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── AppLayout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── PageHeader.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Loading.tsx
│   │   └── ui/
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── OrganizationContext.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── database.ts
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   └── utils.ts
│   ├── pages/
│   └── types/
└── supabase/
    └── migrations/
        └── 202610270001_initial_schema.sql
```

## 3. Relasi database

- `auth.users` → `profiles`: satu akun autentikasi memiliki satu profil; trigger membuat profil setelah pendaftaran.
- `profiles` → `organizations`: `created_by` mencatat pengguna pembuat organisasi.
- `organizations` → `organization_members`: satu organisasi memiliki banyak anggota; kombinasi `organization_id` dan `user_id` unik.
- `organizations` → `transaction_categories`: kategori pemasukan/pengeluaran terpisah per organisasi.
- `organizations` → `transactions`: semua transaksi memiliki `organization_id`; kategori harus berasal dari organisasi yang sama.
- `transaction_categories` → `transactions`: satu kategori dapat digunakan oleh banyak transaksi.
- `organizations` → `contribution_plans`: satu organisasi memiliki banyak rencana iuran.
- `contribution_plans` → `contribution_obligations`: setiap rencana membentuk tagihan untuk anggota yang ada pada saat rencana dibuat.
- `profiles` → `contribution_obligations`: setiap tagihan terkait dengan anggota yang wajib membayar. Anggota baru juga mendapat tagihan untuk rencana yang sudah ada.
- `contribution_obligations` → `contribution_payments`: satu tagihan dapat menerima beberapa pembayaran sampai lunas.
- `contribution_payments` → `transactions`: setiap pembayaran yang diterima membuat satu transaksi pemasukan otomatis lewat trigger; `source_payment_id` unik mencegah duplikasi.
- `organizations` → `audit_logs`: aktivitas penting menyimpan organisasi, aktor, aksi, entitas terkait, perubahan, dan waktu.
- `organizations` → `invitations`: undangan menyimpan email, peran, token unik, kedaluwarsa, dan waktu penerimaan.
- `platform_admins` → `auth.users`: daftar administrator tingkat platform dikelola operator tepercaya melalui SQL, tidak melalui UI pengguna biasa.

### Aturan saldo dan pembayaran

`Saldo aktual = SUM(pemasukan berstatus posted) - SUM(pengeluaran berstatus posted)`.

Tagihan iuran bukan kas. Hanya pembayaran yang berhasil direkam oleh RPC `record_contribution_payment` yang membuat transaksi pemasukan. RPC mengunci tagihan, menghitung sisa kewajiban, dan menolak pembayaran yang melebihi sisa tagihan. Pembayaran iuran otomatis tidak dapat diedit atau dibatalkan langsung dari tabel transaksi agar catatan iuran dan kas tidak berbeda.

## 4. Konfigurasi Supabase yang diperlukan

1. Buat proyek Supabase dan jalankan migrasi SQL pada `supabase/migrations/202610270001_initial_schema.sql`.
2. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada file `.env` lokal.
3. Konfigurasikan Authentication Site URL serta redirect URL lokal dan produksi.
4. Konfigurasikan SMTP/email provider untuk konfirmasi pendaftaran dan reset kata sandi.
5. Migrasi membuat bucket privat `receipts` dan kebijakan Storage untuk membatasi unggah serta akses berdasarkan organisasi.
6. Administrator platform ditambahkan manual ke `public.platform_admins` oleh operator Supabase.
7. Jangan gunakan service-role key di frontend. Validasi dan otorisasi sensitif dilakukan oleh RLS, trigger, dan fungsi RPC `SECURITY DEFINER`.

## 5. Urutan implementasi

1. Foundation: Vite, React/TypeScript, Tailwind, komponen UI, routing, client Supabase, dan konteks autentikasi.
2. Organisasi dan akses: tabel inti, pembuatan organisasi melalui RPC, keanggotaan, pergantian organisasi, dan kebijakan RLS.
3. Transaksi: kategori awal, form transaksi, bukti Storage, pencarian/filter, edit, pembatalan, dan audit.
4. Iuran: rencana, tagihan anggota, pencatatan pembayaran melalui RPC, pembaruan status, dan transaksi pemasukan otomatis.
5. Dashboard dan laporan: saldo aktual, arus kas bulanan, rekap kategori, filter tanggal, ekspor PDF/Excel.
6. Pengelolaan anggota: undangan berbasis token, penerimaan undangan, perubahan peran, dan pengeluaran anggota.
7. Hardening: validasi input, batasan database, kebijakan Storage, audit log, kondisi loading/kosong/error, dan pengujian lintas organisasi.

## 6. Batasan yang perlu dituntaskan sebelum produksi

- Email undangan otomatis memerlukan Supabase Edge Function atau layanan email server-side; MVP menyediakan tautan undangan yang dapat dibagikan manual.
- Pembayaran iuran dicatat manual oleh bendahara; belum terhubung ke payment gateway.
- Administrator platform dikelola melalui SQL; panel `/admin` tidak menyediakan promosi admin, penghapusan akun Auth, atau pengaturan infrastruktur Supabase.
- Paket belum dapat di-build di lingkungan pembuatan ini karena akses ke npm registry mengalami kegagalan DNS. Sintaks seluruh file TS/TSX sudah diperiksa, tetapi `npm install`, type-check penuh, dan build Vite perlu dijalankan pada mesin yang memiliki akses registry.
- Sebelum produksi, uji RLS menggunakan dua akun dan dua organisasi, uji alur undangan dan reset email, lakukan pemeriksaan keamanan independen, serta siapkan backup database.
