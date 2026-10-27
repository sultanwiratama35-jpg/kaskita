import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Masukkan alamat email yang valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Nama minimal 2 karakter.'),
  email: z.string().email('Masukkan alamat email yang valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
});

export const transactionSchema = z.object({
  transaction_type: z.enum(['income', 'expense']),
  category_id: z.string().min(1, 'Pilih kategori.'),
  amount: z.number().positive('Nominal harus lebih dari nol.').max(999999999999, 'Nominal terlalu besar.'),
  description: z.string().trim().min(3, 'Keterangan minimal 3 karakter.'),
  transaction_date: z.string().min(1, 'Tanggal wajib diisi.'),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Nama organisasi minimal 2 karakter.'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter.').optional(),
});

export const contributionPlanSchema = z.object({
  name: z.string().trim().min(2, 'Nama iuran minimal 2 karakter.'),
  amount: z.number().positive('Nominal harus lebih dari nol.'),
  due_date: z.string().optional(),
  description: z.string().trim().max(500).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type OrganizationInput = z.infer<typeof organizationSchema>;
export type ContributionPlanInput = z.infer<typeof contributionPlanSchema>;
