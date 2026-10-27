import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, CheckCircle2, Coins, Plus, ReceiptText, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { fetchAllContributionPlans, fetchAllContributionObligations, fetchAllContributionPayments } from '../lib/database';
import { errorMessage } from '../lib/utils';
import { formatCurrency, formatDate, todayISO } from '../lib/format';
import { contributionPlanSchema, type ContributionPlanInput } from '../lib/validation';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import type { ContributionObligation, ContributionPayment, ContributionPlan, ContributionStatus } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field, FieldError, FieldLabel } from '../components/ui/field';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

interface EnrichedObligation extends ContributionObligation {
  plan?: ContributionPlan | null;
  member?: { full_name: string | null; email: string | null } | null;
  payments: ContributionPayment[];
}

const statusText: Record<ContributionStatus, string> = { unpaid: 'Belum bayar', partial: 'Dibayar sebagian', paid: 'Lunas' };
const statusTone: Record<ContributionStatus, 'warning' | 'primary' | 'success'> = { unpaid: 'warning', partial: 'primary', paid: 'success' };

function paidAmount(item: EnrichedObligation) { return item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0); }

export function ContributionsPage() {
  const { activeOrganization, activeRole } = useOrganization();
  const { user } = useAuth();
  const [plans, setPlans] = useState<ContributionPlan[]>([]);
  const [obligations, setObligations] = useState<EnrichedObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<EnrichedObligation | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContributionPlanInput>({
    resolver: zodResolver(contributionPlanSchema),
    defaultValues: { name: '', amount: 0, due_date: '', description: '' },
  });

  const load = async () => {
    if (!activeOrganization) { setPlans([]); setObligations([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [planRows, obligationRows, paymentRows] = await Promise.all([
        fetchAllContributionPlans(activeOrganization.id),
        fetchAllContributionObligations(activeOrganization.id, '*, plan:contribution_plans(name,due_date,amount), member:profiles!contribution_obligations_member_id_fkey(full_name,email)'),
        fetchAllContributionPayments(activeOrganization.id),
      ]);
      const allPayments = paymentRows as ContributionPayment[];
      setPlans((planRows as ContributionPlan[]) ?? []);
      setObligations(((obligationRows as unknown as EnrichedObligation[]) ?? []).map((item) => ({ ...item, payments: allPayments.filter((payment) => payment.obligation_id === item.id) })));
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memuat data iuran.'));
      setPlans([]); setObligations([]);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [activeOrganization?.id]);

  const summary = useMemo(() => {
    const required = obligations.reduce((sum, item) => sum + Number(item.required_amount), 0);
    const paid = obligations.reduce((sum, item) => sum + paidAmount(item), 0);
    return { required, paid, remaining: Math.max(0, required - paid), unpaid: obligations.filter((item) => item.status !== 'paid').length };
  }, [obligations]);

  const createPlan = async (values: ContributionPlanInput) => {
    if (!activeOrganization) return toast.error('Pilih organisasi terlebih dahulu.');
    const { error } = await supabase.rpc('create_contribution_plan', {
      p_organization_id: activeOrganization.id,
      p_name: values.name.trim(),
      p_amount: Math.round(Number(values.amount)),
      p_due_date: values.due_date || null,
      p_description: values.description?.trim() || null,
    });
    if (error) return toast.error(errorMessage(error, 'Rencana iuran gagal dibuat.'));
    toast.success('Rencana iuran dibuat dan tagihan anggota berhasil disiapkan.');
    reset({ name: '', amount: 0, due_date: '', description: '' });
    setPlanDialogOpen(false);
    void load();
  };

  const openPayment = (item: EnrichedObligation) => {
    setPaymentTarget(item);
    setPaymentAmount(String(Math.max(0, Number(item.required_amount) - paidAmount(item))));
    setPaymentDate(todayISO());
    setPaymentNotes('');
  };

  const recordPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!paymentTarget || !activeOrganization || !user) return;
    const amount = Number(paymentAmount);
    const remaining = Math.max(0, Number(paymentTarget.required_amount) - paidAmount(paymentTarget));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Nominal pembayaran harus lebih dari nol.');
    if (amount > remaining) return toast.error(`Nominal melebihi sisa tagihan ${formatCurrency(remaining)}.`);
    setPaymentSaving(true);
    const { error } = await supabase.rpc('record_contribution_payment', {
      p_obligation_id: paymentTarget.id,
      p_amount: Math.round(amount),
      p_payment_date: paymentDate,
      p_notes: paymentNotes.trim() || null,
    });
    setPaymentSaving(false);
    if (error) return toast.error(errorMessage(error, 'Pembayaran gagal dicatat.'));
    toast.success('Pembayaran tercatat. Saldo organisasi diperbarui secara otomatis.');
    setPaymentTarget(null);
    void load();
  };

  if (loading) return <Loading label="Memuat data iuran..." />;
  if (!activeOrganization) return <Card><EmptyState title="Pilih organisasi terlebih dahulu" description="Iuran dan pembayaran disimpan di ruang kerja organisasi." /></Card>;

  return <>
    <PageHeader title="Iuran anggota" description="Kelola rencana iuran, status tagihan, dan pembayaran yang diterima." actions={activeRole === 'treasurer' ? <Button onClick={() => setPlanDialogOpen(true)}><Plus size={16} /> Buat rencana iuran</Button> : undefined} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Total tagihan</span><Coins size={18} className="text-indigo-600" /></div><div className="mt-3 text-xl font-extrabold">{formatCurrency(summary.required)}</div><div className="mt-1 text-xs text-slate-400">Berdasarkan tagihan yang dapat Anda akses</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Sudah diterima</span><CheckCircle2 size={18} className="text-emerald-600" /></div><div className="mt-3 text-xl font-extrabold text-emerald-700">{formatCurrency(summary.paid)}</div><div className="mt-1 text-xs text-slate-400">Pembayaran yang telah dicatat</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Sisa tagihan</span><Wallet size={18} className="text-amber-600" /></div><div className="mt-3 text-xl font-extrabold">{formatCurrency(summary.remaining)}</div><div className="mt-1 text-xs text-slate-400">Belum diterima sebagai kas</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Belum lunas</span><CalendarClock size={18} className="text-red-600" /></div><div className="mt-3 text-xl font-extrabold">{summary.unpaid}</div><div className="mt-1 text-xs text-slate-400">Tagihan belum selesai</div></CardContent></Card></div>

    <Card className="mt-5"><CardHeader><CardTitle>Rincian tagihan anggota</CardTitle><p className="text-xs text-slate-500">Status dan sisa tagihan dihitung dari pembayaran yang benar-benar tercatat.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Anggota / Rencana</th><th>Jatuh tempo</th><th>Tagihan</th><th>Dibayar</th><th>Status</th><th className="text-right">Aksi</th></tr></thead><tbody>{obligations.map((item) => { const paid = paidAmount(item); const remaining = Math.max(0, Number(item.required_amount) - paid); return <tr key={item.id}><td><div className="min-w-[200px]"><div className="text-sm font-semibold text-slate-800">{item.member?.full_name || item.member?.email || 'Anggota'}</div><div className="mt-0.5 text-xs text-slate-500">{item.plan?.name || 'Rencana iuran'}</div></div></td><td>{formatDate(item.plan?.due_date ?? null, 'd MMM yyyy')}</td><td className="whitespace-nowrap font-medium">{formatCurrency(item.required_amount)}</td><td className="whitespace-nowrap font-medium text-emerald-700">{formatCurrency(paid)}</td><td><Badge tone={statusTone[item.status]}>{statusText[item.status]}</Badge>{item.status !== 'paid' && <div className="mt-1 text-[10px] text-slate-400">Sisa {formatCurrency(remaining)}</div>}</td><td className="text-right">{activeRole === 'treasurer' && item.status !== 'paid' && <Button size="sm" variant="outline" onClick={() => openPayment(item)}>Catat bayar</Button>}{activeRole !== 'treasurer' && item.status !== 'paid' && <span className="text-xs text-slate-400">Menunggu pembayaran</span>}{item.status === 'paid' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> Selesai</span>}</td></tr>; })}</tbody></table>{obligations.length === 0 && <EmptyState title="Belum ada tagihan iuran" description={activeRole === 'treasurer' ? 'Buat rencana iuran untuk membuat tagihan bagi anggota organisasi.' : 'Tagihan iuran Anda akan muncul di sini jika sudah dibuat bendahara.'} actionLabel={activeRole === 'treasurer' ? 'Buat rencana iuran' : undefined} onAction={activeRole === 'treasurer' ? () => setPlanDialogOpen(true) : undefined} icon={<ReceiptText size={22} />} />}</div></CardContent></Card>

    <Card className="mt-5"><CardHeader><CardTitle>Rencana iuran</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Nama rencana</th><th>Nominal per anggota</th><th>Jatuh tempo</th><th>Dibuat</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}><td><div className="font-semibold text-slate-800">{plan.name}</div>{plan.description && <div className="mt-1 max-w-md text-xs text-slate-500">{plan.description}</div>}</td><td className="font-semibold">{formatCurrency(plan.amount)}</td><td>{formatDate(plan.due_date, 'd MMM yyyy')}</td><td>{formatDate(plan.created_at, 'd MMM yyyy')}</td></tr>)}</tbody></table>{plans.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-500">Belum ada rencana iuran.</div>}</div></CardContent></Card>

    <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}><DialogContent><DialogHeader><DialogTitle>Buat rencana iuran</DialogTitle><DialogDescription>Tagihan akan dibuat untuk anggota yang terdaftar pada organisasi saat ini.</DialogDescription></DialogHeader><form onSubmit={handleSubmit(createPlan)} className="space-y-4"><Field><FieldLabel htmlFor="name">Nama iuran</FieldLabel><Input id="name" placeholder="Contoh: Iuran kegiatan semester" {...register('name')} /><FieldError>{errors.name?.message}</FieldError></Field><Field><FieldLabel htmlFor="amount">Nominal per anggota (Rupiah)</FieldLabel><Input id="amount" type="number" min="1" step="1" {...register('amount', { valueAsNumber: true })} /><FieldError>{errors.amount?.message}</FieldError></Field><Field><FieldLabel htmlFor="due_date">Jatuh tempo (opsional)</FieldLabel><Input id="due_date" type="date" {...register('due_date')} /><FieldError>{errors.due_date?.message}</FieldError></Field><Field><FieldLabel htmlFor="description">Keterangan (opsional)</FieldLabel><Input id="description" placeholder="Tujuan penggunaan iuran" {...register('description')} /><FieldError>{errors.description?.message}</FieldError></Field><Button type="submit" className="w-full" disabled={isSubmitting}><Plus size={16} />{isSubmitting ? 'Menyimpan...' : 'Buat Tagihan'}</Button></form></DialogContent></Dialog>

    <Dialog open={!!paymentTarget} onOpenChange={(open) => !open && setPaymentTarget(null)}><DialogContent><DialogHeader><DialogTitle>Catat pembayaran iuran</DialogTitle><DialogDescription>Pembayaran yang dicatat akan otomatis menjadi transaksi pemasukan organisasi.</DialogDescription></DialogHeader>{paymentTarget && <form onSubmit={recordPayment} className="space-y-4"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{paymentTarget.member?.full_name || paymentTarget.member?.email}</div><div className="mt-1 font-semibold">{paymentTarget.plan?.name}</div><div className="mt-2 text-xs text-slate-500">Sisa tagihan: <strong className="text-slate-800">{formatCurrency(Number(paymentTarget.required_amount) - paidAmount(paymentTarget))}</strong></div></div><Field><FieldLabel htmlFor="paymentAmount">Nominal diterima (Rupiah)</FieldLabel><Input id="paymentAmount" type="number" min="1" step="1" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required /></Field><Field><FieldLabel htmlFor="paymentDate">Tanggal diterima</FieldLabel><Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></Field><Field><FieldLabel htmlFor="paymentNotes">Catatan (opsional)</FieldLabel><Input id="paymentNotes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Contoh: Transfer bank" /></Field><Button type="submit" className="w-full" disabled={paymentSaving}><CheckCircle2 size={16} />{paymentSaving ? 'Mencatat...' : 'Konfirmasi Pembayaran'}</Button></form>}</DialogContent></Dialog>
  </>;
}
