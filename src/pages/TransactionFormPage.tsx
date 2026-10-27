import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Paperclip, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/utils';
import { todayISO } from '../lib/format';
import { transactionSchema, type TransactionInput } from '../lib/validation';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import type { Transaction, TransactionCategory } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Field, FieldError, FieldLabel } from '../components/ui/field';
import { Loading } from '../components/Loading';

export function TransactionFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeOrganization, activeRole } = useOrganization();
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [existing, setExisting] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(editing);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { transaction_type: 'expense', category_id: '', amount: 0, description: '', transaction_date: todayISO() },
  });
  const transactionType = watch('transaction_type');

  useEffect(() => {
    if (!activeOrganization) { setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [catRes, txRes] = await Promise.all([
        supabase.from('transaction_categories').select('*').eq('organization_id', activeOrganization.id).order('name'),
        editing ? supabase.from('transactions').select('*').eq('organization_id', activeOrganization.id).eq('id', id!).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
      ]);
      if (!mounted) return;
      if (catRes.error) toast.error(errorMessage(catRes.error, 'Gagal memuat kategori.'));
      setCategories((catRes.data as TransactionCategory[]) ?? []);
      if (editing) {
        if (txRes.error || !txRes.data) {
          toast.error('Transaksi tidak ditemukan atau Anda tidak memiliki akses.');
          navigate('/transactions', { replace: true });
          return;
        }
        const tx = txRes.data as Transaction;
        if (tx.status !== 'posted' || (tx as any).source_payment_id) {
          toast.error('Transaksi ini tidak dapat diedit.'); navigate('/transactions', { replace: true }); return;
        }
        setExisting(tx);
        reset({ transaction_type: tx.transaction_type, category_id: tx.category_id ?? '', amount: Number(tx.amount), description: tx.description, transaction_date: tx.transaction_date });
      }
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [activeOrganization?.id, editing, id]);

  useEffect(() => {
    const eligible = categories.filter((category) => category.transaction_type === transactionType);
    if (watch('category_id') && !eligible.some((category) => category.id === watch('category_id'))) setValue('category_id', '');
  }, [transactionType, categories]);

  const onSubmit = async (values: TransactionInput) => {
    if (!activeOrganization || !user) return toast.error('Organisasi atau sesi pengguna tidak tersedia.');
    if (activeRole !== 'treasurer') return toast.error('Hanya bendahara yang dapat mencatat transaksi.');
    if (receiptFile && receiptFile.size > 10 * 1024 * 1024) return toast.error('Ukuran bukti maksimal 10 MB.');
    let receiptPath = removeReceipt ? null : existing?.receipt_url ?? null;
    if (receiptFile) {
      const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      receiptPath = `${activeOrganization.id}/${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(receiptPath, receiptFile, { upsert: false, contentType: receiptFile.type || 'application/octet-stream' });
      if (uploadError) return toast.error(`Bukti gagal diunggah: ${errorMessage(uploadError)}`);
    }
    const payload = {
      transaction_type: values.transaction_type,
      category_id: values.category_id,
      amount: Math.round(Number(values.amount)),
      description: values.description.trim(),
      transaction_date: values.transaction_date,
      receipt_url: receiptPath,
      updated_at: new Date().toISOString(),
    };
    const result = editing && existing
      ? await supabase.from('transactions').update(payload).eq('id', existing.id).eq('organization_id', activeOrganization.id)
      : await supabase.from('transactions').insert({ ...payload, organization_id: activeOrganization.id, created_by: user.id, status: 'posted' });
    if (result.error) {
      if (receiptFile && receiptPath) await supabase.storage.from('receipts').remove([receiptPath]);
      return toast.error(errorMessage(result.error, 'Transaksi gagal disimpan.'));
    }
    if (existing?.receipt_url && existing.receipt_url !== receiptPath) {
      await supabase.storage.from('receipts').remove([existing.receipt_url]);
    }
    toast.success(editing ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil dicatat.');
    navigate('/transactions', { replace: true });
  };

  if (loading) return <Loading label="Memuat formulir transaksi..." />;
  if (!activeOrganization) return <Card><CardContent className="p-6 text-sm text-slate-600">Pilih atau buat organisasi sebelum mencatat transaksi.</CardContent></Card>;
  if (activeRole !== 'treasurer') return <Card><CardContent className="p-6 text-sm text-slate-600">Akses dibatasi. Hanya bendahara yang dapat menambah atau mengubah transaksi.</CardContent></Card>;

  return <>
    <PageHeader title={editing ? 'Edit transaksi' : 'Catat transaksi'} description={editing ? 'Perbarui detail transaksi yang sudah tercatat.' : 'Masukkan transaksi aktual agar saldo dan laporan tetap akurat.'} actions={<Link to="/transactions"><Button variant="outline"><ArrowLeft size={16} /> Kembali</Button></Link>} />
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card><CardHeader><CardTitle>Informasi transaksi</CardTitle><p className="text-xs text-slate-500">Nominal disimpan sebagai angka Rupiah dan saldo dihitung dari transaksi valid.</p></CardHeader><CardContent className="space-y-5">
        <Field><FieldLabel htmlFor="transaction_type">Jenis transaksi</FieldLabel><Select id="transaction_type" {...register('transaction_type')}><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></Select><FieldError>{errors.transaction_type?.message}</FieldError></Field>
        <Field><FieldLabel htmlFor="category_id">Kategori</FieldLabel><Select id="category_id" {...register('category_id')}><option value="">Pilih kategori</option>{categories.filter((category) => category.transaction_type === transactionType).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><FieldError>{errors.category_id?.message}</FieldError>{categories.filter((category) => category.transaction_type === transactionType).length === 0 && <p className="text-xs text-amber-700">Belum ada kategori untuk jenis ini. Jalankan migrasi database agar kategori awal dibuat otomatis.</p>}</Field>
        <Field><FieldLabel htmlFor="amount">Nominal (Rupiah)</FieldLabel><Input id="amount" type="number" min="1" step="1" placeholder="Contoh: 150000" {...register('amount', { valueAsNumber: true })} /><FieldError>{errors.amount?.message}</FieldError><p className="text-xs text-slate-400">Masukkan angka tanpa titik atau simbol mata uang.</p></Field>
        <Field><FieldLabel htmlFor="description">Keterangan</FieldLabel><Input id="description" placeholder="Contoh: Pembelian perlengkapan acara" {...register('description')} /><FieldError>{errors.description?.message}</FieldError></Field>
        <Field><FieldLabel htmlFor="transaction_date">Tanggal transaksi</FieldLabel><Input id="transaction_date" type="date" {...register('transaction_date')} /><FieldError>{errors.transaction_date?.message}</FieldError></Field>
      </CardContent></Card>
      <div className="space-y-5"><Card><CardHeader><CardTitle>Bukti transaksi</CardTitle><p className="text-xs text-slate-500">Opsional · JPG, PNG, atau PDF · maksimal 10 MB</p></CardHeader><CardContent><label htmlFor="receipt" className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40"><Paperclip size={22} className="text-indigo-600" /><span className="mt-2 text-sm font-semibold text-slate-700">{receiptFile?.name ?? 'Pilih file bukti'}</span><span className="mt-1 text-xs text-slate-400">Klik untuk memilih file</span><input id="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => { setReceiptFile(e.target.files?.[0] ?? null); setRemoveReceipt(false); }} /></label>{existing?.receipt_url && !removeReceipt && !receiptFile && <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><div className="text-xs font-semibold">Bukti tersimpan</div><div className="truncate text-[10px] text-slate-400">{existing.receipt_url.split('/').pop()}</div></div><Button type="button" size="icon" variant="ghost" onClick={() => setRemoveReceipt(true)} title="Hapus bukti dari transaksi"><Trash2 size={15} className="text-red-500" /></Button></div>}{removeReceipt && <button type="button" onClick={() => setRemoveReceipt(false)} className="mt-3 text-xs font-semibold text-indigo-600">Batalkan penghapusan bukti</button>}</CardContent></Card><Card><CardHeader><CardTitle>Ringkasan</CardTitle></CardHeader><CardContent><div className="text-xs text-slate-500">Organisasi</div><div className="mt-1 font-semibold text-slate-900">{activeOrganization.name}</div><div className="mt-4 text-xs text-slate-500">Jenis</div><div className="mt-1 font-semibold text-slate-900">{transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran'}</div><div className="mt-4 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">Pastikan nominal dan tanggal sesuai bukti transaksi. Transaksi yang dibatalkan tetap tersimpan dalam riwayat audit.</div></CardContent></Card><Button type="submit" className="w-full" size="lg" disabled={isSubmitting}><Save size={16} />{isSubmitting ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan Transaksi'}</Button></div>
    </form>
  </>;
}
