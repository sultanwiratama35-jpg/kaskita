# KasKita — Financial Management SaaS

KasKita adalah aplikasi pengelolaan keuangan organisasi berbasis React, TypeScript, Vite, Tailwind CSS, dan Supabase. Antarmuka menggunakan Bahasa Indonesia dan nominal Rupiah. Data tidak diisi dengan seed/mock data; dashboard, transaksi, iuran, laporan, dan riwayat mengambil data dari database Supabase yang Anda konfigurasi.

## Fitur yang tersedia

- Autentikasi: daftar, masuk, keluar, pemulihan dan penggantian kata sandi.
- Organisasi: membuat organisasi, berpindah organisasi, dan pengaturan organisasi.
- Peran: bendahara, anggota, auditor/viewer; kebijakan otorisasi diterapkan pada database.
- Transaksi: pencatatan pemasukan/pengeluaran, kategori, pencarian/filter, urut tanggal, unggah bukti, ekspor CSV, edit, dan pembatalan tanpa menghapus riwayat.
- Iuran: rencana iuran, pembuatan tagihan untuk anggota saat ini, pembayaran sebagian/penuh, status, dan transaksi pemasukan otomatis ketika pembayaran dicatat.
- Laporan: filter tanggal, ringkasan pemasukan/pengeluaran/saldo, ringkasan kategori, pembayaran iuran, ekspor PDF dan Excel.
- Anggota: undangan berbasis tautan, perubahan peran, dan pengeluaran anggota.
- Audit: riwayat perubahan transaksi, pembayaran, anggota, undangan, dan pengaturan organisasi.
- Supabase Storage: bucket bukti transaksi privat dengan pembatasan jenis dan ukuran file.

## 1. Prasyarat

- Node.js 20 atau lebih baru dan npm.
- Proyek Supabase aktif.
- URL dan anon/public key proyek Supabase.

## 2. Konfigurasi Supabase

1. Buat proyek di Supabase.
2. Buka **SQL Editor** pada proyek tersebut.
3. Jalankan isi `supabase/migrations/202610270001_initial_schema.sql` satu kali.
4. Buka **Project Settings → API** dan salin Project URL serta anon/public key.
5. Salin `.env.example` menjadi `.env`, kemudian isi:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

6. Pada **Authentication → URL Configuration**, atur Site URL ke alamat aplikasi lokal/deployment. Tambahkan redirect URL yang dipakai, misalnya `http://localhost:5173/**` dan domain produksi Anda.
7. Untuk produksi, konfigurasi SMTP/Email Provider Supabase agar konfirmasi pendaftaran dan pemulihan kata sandi dapat terkirim.

> Jangan menaruh `service_role` key di `.env` frontend. Aplikasi hanya menggunakan anon/public key dan operasi sensitif dilindungi RLS atau RPC `SECURITY DEFINER` yang melakukan validasi.

## 3. Menjalankan aplikasi

```bash
npm install
npm run dev
```

Buka URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

Untuk memeriksa TypeScript dan membuat build produksi:

```bash
npm run typecheck
npm run build
npm run preview
```

## 4. Menjalankan migrasi melalui Supabase CLI (opsional)

Jika memakai Supabase CLI, hubungkan folder proyek ke proyek Supabase lalu jalankan `supabase db push`. Jika memakai SQL Editor, jalankan file migrasi secara langsung dan jangan jalankan migrasi yang sama berulang kali pada proyek yang sudah terisi.

## 5. Undangan anggota

Bendahara dapat membuat tautan undangan dari menu **Anggota**. Tautan perlu dibagikan secara manual melalui kanal yang Anda pilih; pengiriman email otomatis belum diaktifkan. Penerima harus mendaftar/masuk menggunakan alamat email yang sama dengan alamat undangan. Token berlaku tujuh hari.

## 6. Peran platform administrator

Tabel `public.platform_admins` disediakan untuk admin tingkat sistem. Panel administrator pada `/admin` hanya tampil untuk akun yang sudah ada di tabel ini; tidak ada halaman publik yang dapat menaikkan peran tersebut. Untuk memberikan akses kepada akun yang tepercaya, jalankan perintah berikut dari SQL Editor dengan UUID pengguna yang benar:

```sql
insert into public.platform_admins (user_id)
values ('UUID_PENGGUNA_DARI_AUTH_USERS');
```

Jangan menyediakan fungsi promosi admin melalui UI biasa. Pengelolaan platform administrator harus dilakukan oleh operator proyek Supabase yang berwenang.

## 7. Keputusan data dan keamanan

- Saldo dihitung sebagai total transaksi pemasukan berstatus `posted` dikurangi total pengeluaran berstatus `posted`.
- Tagihan yang belum dibayar tidak masuk saldo.
- RPC `record_contribution_payment` memvalidasi sisa tagihan; trigger membuat tepat satu transaksi pemasukan untuk pembayaran yang tercatat.
- Transaksi yang dibatalkan berstatus `voided`, tidak dihitung dalam saldo, dan tidak dihapus permanen.
- Transaksi yang dihasilkan dari pembayaran iuran dikelola otomatis agar tidak terjadi selisih antara catatan pembayaran dan kas.
- RLS mengisolasi data organisasi. Anggota hanya dapat melihat tagihannya sendiri; bendahara dapat mengelola catatan; auditor dapat melihat catatan dan audit tanpa mengubah transaksi.
- Bukti transaksi disimpan dalam bucket privat `receipts`; tautan akses dibuat sementara melalui signed URL.

## 8. Batasan MVP yang diketahui

- Tautan undangan dibuat di aplikasi, tetapi pengiriman email otomatis memerlukan Supabase Edge Function atau layanan email dengan secret yang disimpan di server.
- Pembayaran iuran dicatat manual oleh bendahara; belum ada integrasi payment gateway.
- Pengguna platform administrator ditambahkan secara manual melalui SQL, bukan dari antarmuka.
- Sebelum penggunaan produksi, lakukan pengujian RLS dengan setidaknya dua akun dan dua organisasi berbeda, verifikasi SMTP/redirect URL, serta siapkan backup dan kebijakan retensi data.

## Struktur utama

```text
src/
  components/       UI bersama, layout, dan komponen tabel
  contexts/         autentikasi dan organisasi aktif
  lib/              Supabase client, format, validasi, utilitas
  pages/             halaman aplikasi
  types/             tipe domain
supabase/
  migrations/        skema PostgreSQL, RPC, trigger, RLS, Storage
```
