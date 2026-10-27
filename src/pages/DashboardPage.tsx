import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays, CirclePlus, Coins, ReceiptText, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { subMonths, startOfMonth, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { fetchAllTransactions, fetchAllContributionObligations, fetchAllContributionPayments } from '../lib/database';
import { formatCurrency, formatDate } from '../lib/format';
import { errorMessage } from '../lib/utils';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import type { ContributionObligation, Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';

function MetricCard({ title, value, note, icon, tone }: { title: string; value: string; note: string; icon: ReactNode; tone: 'indigo' | 'green' | 'red' | 'amber' }) {
  const tones = { indigo: 'bg-indigo-50 text-indigo-600', green: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600' };
  return <Card><CardContent className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><div className="text-xs font-semibold text-slate-500">{title}</div><div className="mt-3 break-words text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">{value}</div><div className="mt-2 text-[11px] leading-5 text-slate-400">{note}</div></div><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div></CardContent></Card>;
}

export function DashboardPage() {
  const { activeOrganization, activeRole } = useOrganization();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [obligations, setObligations] = useState<ContributionObligation[]>([]);

  useEffect(() => {
    if (!activeOrganization) { setTransactions([]); setObligations([]); setMemberCount(0); setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [txRows, memberRes, obligationRows, paymentRows] = await Promise.all([
        fetchAllTransactions(activeOrganization.id, { select: '*, category:transaction_categories(name)', status: 'posted', ascending: false }),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', activeOrganization.id),
        fetchAllContributionObligations(activeOrganization.id, 'id,required_amount,status'),
        fetchAllContributionPayments(activeOrganization.id),
      ]);
      if (!mounted) return;
      setTransactions((txRows as unknown as Transaction[]) ?? []);
      if (memberRes.error) toast.error(errorMessage(memberRes.error, 'Gagal memuat anggota.'));
      setMemberCount(memberRes.count ?? 0);
      setObligations((obligationRows as unknown as ContributionObligation[]).map((item) => ({ ...item, payments: paymentRows.filter((payment: any) => payment.obligation_id === item.id) })));
      setLoading(false);
    };
    void load().catch((error) => { if (mounted) { setTransactions([]); setObligations([]); setMemberCount(0); toast.error(errorMessage(error, 'Gagal memuat ringkasan.')); setLoading(false); } });
    return () => { mounted = false; };
  }, [activeOrganization?.id]);

  const totals = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.transaction_type === 'income') acc.income += Number(tx.amount);
      if (tx.transaction_type === 'expense') acc.expense += Number(tx.amount);
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => startOfMonth(subMonths(new Date(), 5 - index)));
    return months.map((month) => {
      const key = format(month, 'yyyy-MM');
      const inMonth = transactions.filter((tx) => tx.transaction_date.slice(0, 7) === key);
      return {
        month: format(month, 'MMM', { locale: id }),
        pemasukan: inMonth.filter((tx) => tx.transaction_type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0),
        pengeluaran: inMonth.filter((tx) => tx.transaction_type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0),
      };
    });
  }, [transactions]);
  const contributionStats = useMemo(() => {
    const required = obligations.reduce((sum, item) => sum + Number(item.required_amount), 0);
    const paid = obligations.reduce((sum, item) => sum + (item.payments ?? []).reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0), 0);
    return { required, paid, percentage: required > 0 ? Math.min(100, Math.round(paid / required * 100)) : 0, outstanding: Math.max(0, required - paid) };
  }, [obligations]);
  const recent = transactions.slice(0, 5);
  const transactionVisibilityRestricted = activeRole === 'member' && activeOrganization?.members_can_view_transactions === false;

  if (!activeOrganization && !loading) return <><PageHeader title="Ringkasan" description="Selamat datang di ruang kerja keuangan Anda." /><Card><EmptyState title="Belum ada organisasi" description="Buat organisasi terlebih dahulu untuk mulai mencatat transaksi dan mengelola iuran anggota." actionLabel="Buat organisasi" onAction={() => window.location.assign('/organizations')} icon={<Users size={22} />} /></Card></>;
  if (loading) return <Loading label="Memuat ringkasan keuangan..." />;

  return <>
    <PageHeader title="Ringkasan keuangan" description={`${formatDate(new Date().toISOString().slice(0, 10))} · Ikhtisar data organisasi Anda`} actions={<>{activeRole === 'treasurer' && <Link to="/transactions/new"><Button><CirclePlus size={16} /> Catat transaksi</Button></Link>}{activeRole === 'treasurer' && <Link to="/contributions"><Button variant="outline"><Coins size={16} /> Kelola iuran</Button></Link>}</>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Saldo saat ini" value={transactionVisibilityRestricted ? '—' : formatCurrency(totals.income - totals.expense)} note={transactionVisibilityRestricted ? 'Visibilitas transaksi dibatasi pengurus' : 'Pemasukan dikurangi pengeluaran valid'} icon={<Banknote size={20} />} tone="indigo" />
      <MetricCard title="Total pemasukan" value={transactionVisibilityRestricted ? '—' : formatCurrency(totals.income)} note={transactionVisibilityRestricted ? 'Visibilitas transaksi dibatasi pengurus' : 'Termasuk pembayaran iuran yang diterima'} icon={<ArrowDownLeft size={20} />} tone="green" />
      <MetricCard title="Total pengeluaran" value={transactionVisibilityRestricted ? '—' : formatCurrency(totals.expense)} note={transactionVisibilityRestricted ? 'Visibilitas transaksi dibatasi pengurus' : 'Transaksi berstatus valid'} icon={<ArrowUpRight size={20} />} tone="red" />
      <MetricCard title="Anggota organisasi" value={String(memberCount)} note="Anggota dengan akses ke ruang kerja" icon={<Users size={20} />} tone="amber" />
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Arus kas bulanan</CardTitle><p className="mt-1 text-xs text-slate-500">Perbandingan pemasukan dan pengeluaran enam bulan terakhir</p></div><Badge tone="primary">6 bulan</Badge></CardHeader><CardContent><div className="h-[280px] w-full">{transactions.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={5}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(0)} jt` : value >= 1000 ? `${(value / 1000).toFixed(0)} rb` : String(value)} /><Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="pemasukan" name="Pemasukan" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={28} /><Bar dataKey="pengeluaran" name="Pengeluaran" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer> : <div className="flex h-full flex-col items-center justify-center text-center"><BarChart3Empty /><p className="mt-3 text-sm font-semibold text-slate-700">{transactionVisibilityRestricted ? 'Akses transaksi dibatasi' : 'Belum ada data transaksi'}</p><p className="mt-1 text-xs text-slate-500">{transactionVisibilityRestricted ? 'Pengurus membatasi visibilitas transaksi untuk anggota.' : 'Grafik akan terisi setelah transaksi dicatat.'}</p><Link to="/transactions/new" className="mt-3 text-xs font-semibold text-indigo-600">Catat transaksi pertama →</Link></div>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Ringkasan iuran</CardTitle><p className="mt-1 text-xs text-slate-500">Status berdasarkan tagihan yang dapat Anda akses</p></CardHeader><CardContent><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between text-xs text-slate-500"><span>Total terkumpul</span><span className="font-semibold text-emerald-700">{contributionStats.percentage}%</span></div><div className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(contributionStats.paid)}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${contributionStats.percentage}%` }} /></div><div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-400"><span>Tagihan {formatCurrency(contributionStats.required)}</span><span>Sisa {formatCurrency(contributionStats.outstanding)}</span></div></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-100 p-3"><div className="text-xs text-slate-500">Jumlah tagihan</div><div className="mt-1 text-lg font-bold">{obligations.length}</div></div><div className="rounded-xl border border-slate-100 p-3"><div className="text-xs text-slate-500">Belum lunas</div><div className="mt-1 text-lg font-bold">{obligations.filter((item) => item.status !== 'paid').length}</div></div></div><Link to="/contributions" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">Lihat rincian iuran <span>→</span></Link></CardContent></Card>
    </div>

    <Card className="mt-5"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Transaksi terbaru</CardTitle><p className="mt-1 text-xs text-slate-500">Lima transaksi terakhir yang berstatus valid</p></div><Link to="/transactions" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Lihat semua</Link></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Transaksi</th><th>Kategori</th><th>Tanggal</th><th className="text-right">Nominal</th></tr></thead><tbody>{recent.map((tx) => <tr key={tx.id}><td><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tx.transaction_type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{tx.transaction_type === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div><div><div className="max-w-[250px] truncate text-sm font-semibold text-slate-800">{tx.description}</div><div className="mt-0.5 text-[10px] text-slate-400">{tx.id.slice(0, 8).toUpperCase()}</div></div></div></td><td>{(tx as any).category?.name ?? 'Tanpa kategori'}</td><td>{formatDate(tx.transaction_date, 'd MMM yyyy')}</td><td className={`text-right font-semibold ${tx.transaction_type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>{tx.transaction_type === 'income' ? '+' : '−'}{formatCurrency(tx.amount)}</td></tr>)}</tbody></table>{recent.length === 0 && <EmptyState title={transactionVisibilityRestricted ? 'Akses transaksi dibatasi' : 'Belum ada transaksi'} description={transactionVisibilityRestricted ? 'Pengurus membatasi visibilitas transaksi untuk anggota.' : 'Transaksi yang sudah dicatat akan muncul di bagian ini.'} actionLabel={activeRole === 'treasurer' ? 'Catat transaksi' : undefined} onAction={activeRole === 'treasurer' ? () => window.location.assign('/transactions/new') : undefined} icon={<ReceiptText size={22} />} />}</div></CardContent></Card>
  </>;
}

function BarChart3Empty() { return <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><CalendarDays size={22} /></div>; }
