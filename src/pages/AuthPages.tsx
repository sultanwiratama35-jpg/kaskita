import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Eye, EyeOff, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { errorMessage } from '../lib/utils';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../lib/validation';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field, FieldError, FieldLabel } from '../components/ui/field';

function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex min-h-screen bg-white"><div className="hidden w-[44%] flex-col justify-between bg-slate-950 p-10 text-white lg:flex"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600"><Wallet size={21} /></span><span className="text-xl font-extrabold">KasKita</span></Link><div className="max-w-lg"><div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-indigo-200">Keuangan organisasi, satu ruang kerja</div><h1 className="text-4xl font-extrabold leading-tight">Catatan rapi. <span className="text-indigo-300">Keputusan lebih pasti.</span></h1><p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Kelola pemasukan, pengeluaran, dan iuran anggota dengan data yang terstruktur dan dapat ditelusuri.</p><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-sm font-semibold">Saldo aktual</div><div className="mt-1 text-xs leading-5 text-slate-400">Berdasarkan transaksi yang tercatat.</div></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-sm font-semibold">Riwayat aktivitas</div><div className="mt-1 text-xs leading-5 text-slate-400">Perubahan penting tetap terlacak.</div></div></div></div><div className="text-xs text-slate-500">© {new Date().getFullYear()} KasKita</div></div><div className="flex flex-1 items-center justify-center px-5 py-12"><div className="w-full max-w-md"><Link to="/" className="mb-9 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 lg:hidden"><ArrowLeft size={16} /> KasKita</Link><div className="mb-8"><h2 className="text-2xl font-extrabold tracking-tight text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div>{!isSupabaseConfigured && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Supabase belum dikonfigurasi.</strong><br />Salin <code>.env.example</code> menjadi <code>.env</code>, lalu isi URL proyek dan anon key dari Supabase sebelum masuk atau membuat akun.</div>}{children}<p className="mt-8 text-center text-xs text-slate-400">Dengan menggunakan KasKita, data keuangan Anda disimpan pada proyek Supabase yang dikonfigurasi.</p></div></div></div>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  useEffect(() => { if (user) navigate('/dashboard', { replace: true }); }, [user, navigate]);

  const onSubmit = async (values: LoginInput) => {
    if (!isSupabaseConfigured) return toast.error('Konfigurasikan Supabase terlebih dahulu.');
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) return toast.error(errorMessage(error, 'Gagal masuk.'));
    toast.success('Berhasil masuk.');
    const fromLocation = (location.state as any)?.from;
    const from = fromLocation ? `${fromLocation.pathname ?? ''}${fromLocation.search ?? ''}` : undefined;
    const redirect = searchParams.get('redirect');
    navigate(from || redirect || '/dashboard', { replace: true });
  };
  return <AuthShell title="Selamat datang kembali" description="Masuk untuk melihat dan mengelola keuangan organisasi Anda."><form onSubmit={handleSubmit(onSubmit)} className="space-y-5"><Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" type="email" autoComplete="email" placeholder="nama@email.com" {...register('email')} /><FieldError>{errors.email?.message}</FieldError></Field><Field><div className="flex items-center justify-between"><FieldLabel htmlFor="password">Kata sandi</FieldLabel><Link to="/forgot-password" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Lupa kata sandi?</Link></div><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Masukkan kata sandi" className="pr-11" {...register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><FieldError>{errors.password?.message}</FieldError></Field><Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !isSupabaseConfigured}>{isSubmitting ? 'Memproses...' : 'Masuk ke KasKita'}</Button></form><div className="mt-6 text-center text-sm text-slate-500">Belum punya akun? <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-800">Daftar sekarang</Link></div></AuthShell>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuth();
  useEffect(() => { if (user) navigate('/dashboard', { replace: true }); }, [user, navigate]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { full_name: '', email: '', password: '' } });

  const onSubmit = async (values: RegisterInput) => {
    if (!isSupabaseConfigured) return toast.error('Konfigurasikan Supabase terlebih dahulu.');
    const inviteToken = searchParams.get('invite');
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.full_name }, emailRedirectTo: inviteToken ? `${window.location.origin}/accept-invitation?token=${encodeURIComponent(inviteToken)}` : `${window.location.origin}/dashboard` },
    });
    if (error) return toast.error(errorMessage(error, 'Pendaftaran gagal.'));
    if (data.session && inviteToken) {
      const { error: inviteError } = await supabase.rpc('accept_invitation', { p_token: inviteToken });
      if (inviteError) toast.error(`Akun dibuat, tetapi undangan belum diterima: ${inviteError.message}`);
    }
    toast.success(data.session ? 'Akun berhasil dibuat.' : 'Akun dibuat. Periksa email untuk mengonfirmasi pendaftaran.');
    if (data.session) navigate('/dashboard', { replace: true });
  };
  return <AuthShell title="Buat akun KasKita" description="Mulai kelola kas organisasi dengan pencatatan yang lebih teratur."><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><Field><FieldLabel htmlFor="full_name">Nama lengkap</FieldLabel><Input id="full_name" autoComplete="name" placeholder="Nama Anda" {...register('full_name')} /><FieldError>{errors.full_name?.message}</FieldError></Field><Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" type="email" autoComplete="email" placeholder="nama@email.com" {...register('email')} /><FieldError>{errors.email?.message}</FieldError></Field><Field><FieldLabel htmlFor="password">Kata sandi</FieldLabel><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Minimal 8 karakter" className="pr-11" {...register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Tampilkan atau sembunyikan kata sandi">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><FieldError>{errors.password?.message}</FieldError></Field><Button type="submit" className="mt-2 w-full" size="lg" disabled={isSubmitting || !isSupabaseConfigured}>{isSubmitting ? 'Membuat akun...' : 'Buat Akun'}</Button><p className="text-xs leading-5 text-slate-400">Gunakan email aktif untuk menerima tautan konfirmasi akun jika verifikasi email diaktifkan.</p></form><div className="mt-6 text-center text-sm text-slate-500">Sudah punya akun? <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-800">Masuk</Link></div></AuthShell>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) return toast.error('Konfigurasikan Supabase terlebih dahulu.');
    if (!email.trim()) return toast.error('Masukkan alamat email.');
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setSubmitting(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk Anda.');
  };
  return <AuthShell title="Pulihkan kata sandi" description="Kami akan mengirimkan tautan untuk membuat kata sandi baru."><form onSubmit={onSubmit} className="space-y-5"><Field><FieldLabel htmlFor="email">Email akun</FieldLabel><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" required /></Field><Button type="submit" className="w-full" size="lg" disabled={submitting || !isSupabaseConfigured}>{submitting ? 'Mengirim...' : 'Kirim Tautan Pemulihan'}</Button></form><div className="mt-6 text-center"><Link to="/login" className="text-sm font-semibold text-indigo-600">Kembali ke halaman masuk</Link></div></AuthShell>;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured) return toast.error('Konfigurasikan Supabase terlebih dahulu.');
    if (password.length < 8) return toast.error('Kata sandi minimal 8 karakter.');
    if (password !== confirmPassword) return toast.error('Konfirmasi kata sandi tidak sama.');
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Kata sandi berhasil diperbarui.');
    navigate('/dashboard', { replace: true });
  };
  return <AuthShell title="Buat kata sandi baru" description="Pilih kata sandi yang kuat dan mudah Anda ingat."><form onSubmit={onSubmit} className="space-y-4"><Field><FieldLabel htmlFor="password">Kata sandi baru</FieldLabel><Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field><Field><FieldLabel htmlFor="confirm">Konfirmasi kata sandi</FieldLabel><Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></Field><Button className="w-full" size="lg" type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan Kata Sandi'}</Button></form></AuthShell>;
}
