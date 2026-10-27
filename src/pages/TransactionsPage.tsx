import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ArrowUpDown, Eye, FileDown, Filter, Pencil, Plus, Search, Slash, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { fetchAllTransactions } from '../lib/database';
import { errorMessage } from '../lib/utils';
import { formatCurrency, formatDate, todayISO } from '../lib/format';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import type { Transaction, TransactionCategory } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

export function TransactionsPage() {
  const { activeOrganization, activeRole } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('posted');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const load = async () => {
    if (!activeOrganization) { setTransactions([]); setCategories([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [txRows, catRes] = await Promise.all([
        fetchAllTransactions(activeOrganization.id, { select: '*, category:transaction_categories(id,name,transaction_type), creator:profiles!transactions_created_by_fkey(full_name,email)', ascending: false }),
        supabase.from('transaction_categories').select('*').eq('organization_id', activeOrganization.id).order('name'),
      ]);
      if (catRes.error) toast.error(errorMessage(catRes.error, 'Gagal memuat kategori.'));
      setTransactions((txRows as unknown as Transaction[]) ?? []);
      setCategories((catRes.data as TransactionCategory[]) ?? []);
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memuat transaksi.'));
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [activeOrganization?.id]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) return false;
      if (categoryFilter !== 'all' && tx.category_id !== categoryFilter) return false;
      if (fromDate && tx.transaction_date < fromDate) return false;
      if (toDate && tx.transaction_date > toDate) return false;
      if (needle && !`${tx.description} ${(tx as any).category?.name ?? ''} ${tx.id}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => sortDesc ? b.transaction_date.localeCompare(a.transaction_date) : a.transaction_date.localeCompare(b.transaction_date));
  }, [transactions, search, typeFilter, categoryFilter, statusFilter, fromDate, toDate, sortDesc]);

  const voidTransaction = async (tx: Transaction) => {
    if (!user || !activeOrganization) return;
    if (!window.confirm(`Batalkan transaksi “${tx.description}”? Transaksi tidak akan dihapus permanen dan saldo akan dihitung ulang.`)) return;
    const { error } = await supabase.from('transactions').update({ status: 'voided', updated_at: new Date().toISOString() }).eq('id', tx.id).eq('organization_id', activeOrganization.id);
    if (error) return toast.error(errorMessage(error, 'Transaksi gagal dibatalkan.'));
    toast.success('Transaksi dibatalkan dan tetap tersimpan di riwayat.');
    setSelected(null);
    void load();
  };

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error('Bukti transaksi tidak dapat dibuka. Periksa konfigurasi Storage.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <Loading label="Memuat daftar transaksi..." />;
  if (!activeOrganization) return <Card><EmptyState title="Pilih organisasi terlebih dahulu" description="Transaksi dicatat pada organisasi tertentu. Buat atau pilih organisasi untuk melanjutkan." actionLabel="Buka organisasi" onAction={() => navigate('/organizations')} /></Card>;

  return <>
    <PageHeader title="Transaksi" description="Catat, telusuri, dan periksa semua arus kas organisasi." actions={<>{activeRole === 'treasurer' && <Link to="/transactions/new"><Button><Plus size={16} /> Transaksi baru</Button></Link>}<Button variant="outline" onClick={() => { const rows = filtered.map((tx) => ({ Tanggal: tx.transaction_date, Jenis: tx.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran', Kategori: (tx as any).category?.name ?? '', Keterangan: tx.description, Nominal: Number(tx.amount), Status: tx.status === 'posted' ? 'Valid' : 'Dibatalkan' })); const blob = new Blob([['Tanggal,Jenis,Kategori,Keterangan,Nominal,Status', ...rows.map((r) => [r.Tanggal, r.Jenis, r.Kategori, `"${r.Keterangan.replaceAll('"', '""')}"`, r.Nominal, r.Status].join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'transaksi-kaskita.csv'; a.click(); URL.revokeObjectURL(url); }}><FileDown size={16} /> Ekspor CSV</Button></>} />

    <Card><CardContent className="p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Cari keterangan atau ID..." /></div><Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option></Select><Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">Semua kategori</option>{categories.filter((c) => typeFilter === 'all' || c.transaction_type === typeFilter).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="posted">Transaksi valid</option><option value="voided">Dibatalkan</option><option value="all">Semua status</option></Select><Button variant="outline" onClick={() => setSortDesc(!sortDesc)}><ArrowUpDown size={15} /> Tanggal {sortDesc ? 'terbaru' : 'terlama'}</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-2"><span className="whitespace-nowrap text-xs text-slate-500">Dari tanggal</span><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div><div className="flex items-center gap-2"><span className="whitespace-nowrap text-xs text-slate-500">Sampai</span><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span className="flex items-center gap-1"><Filter size={13} /> {filtered.length} transaksi ditemukan</span><button onClick={() => { setSearch(''); setTypeFilter('all'); setCategoryFilter('all'); setStatusFilter('posted'); setFromDate(''); setToDate(''); }} className="flex items-center gap-1 font-semibold text-indigo-600"><X size={13} /> Reset filter</button></div></CardContent></Card>

    <Card className="mt-5"><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Transaksi</th><th>Kategori</th><th>Tanggal</th><th>Status</th><th className="text-right">Nominal</th><th className="text-right">Aksi</th></tr></thead><tbody>{filtered.map((tx) => <tr key={tx.id}><td><div className="flex min-w-[220px] items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tx.transaction_type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{tx.transaction_type === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div><div className="min-w-0"><div className={`max-w-[300px] truncate text-sm font-semibold ${tx.status === 'voided' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{tx.description}</div><div className="mt-0.5 text-[10px] text-slate-400">ID {tx.id.slice(0, 8).toUpperCase()}</div></div></div></td><td>{(tx as any).category?.name ?? '—'}</td><td>{formatDate(tx.transaction_date, 'd MMM yyyy')}</td><td><Badge tone={tx.status === 'posted' ? 'success' : 'danger'}>{tx.status === 'posted' ? 'Valid' : 'Dibatalkan'}</Badge></td><td className={`whitespace-nowrap text-right font-semibold ${tx.status === 'voided' ? 'text-slate-400 line-through' : tx.transaction_type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>{tx.transaction_type === 'income' ? '+' : '−'}{formatCurrency(tx.amount)}</td><td><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Lihat detail" onClick={() => setSelected(tx)}><Eye size={16} /></Button>{activeRole === 'treasurer' && tx.status === 'posted' && !(tx as any).source_payment_id && <Link to={`/transactions/${tx.id}/edit`}><Button size="icon" variant="ghost" title="Edit transaksi"><Pencil size={16} /></Button></Link>}{activeRole === 'treasurer' && tx.status === 'posted' && !(tx as any).source_payment_id && <Button size="icon" variant="ghost" title="Batalkan transaksi" onClick={() => voidTransaction(tx)}><Slash size={16} className="text-red-500" /></Button>}</div></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState title="Transaksi tidak ditemukan" description={transactions.length ? 'Coba ubah kata kunci atau filter tanggal.' : 'Belum ada transaksi yang tercatat pada organisasi ini.'} actionLabel={activeRole === 'treasurer' ? 'Catat transaksi' : undefined} onAction={activeRole === 'treasurer' ? () => navigate('/transactions/new') : undefined} />}</div></CardContent></Card>

    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Detail transaksi</DialogTitle><DialogDescription>Informasi transaksi dan status pencatatannya.</DialogDescription></DialogHeader>{selected && <div className="space-y-4"><div className={`rounded-2xl p-4 ${selected.transaction_type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}><div className="text-xs text-slate-500">{selected.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</div><div className={`mt-1 text-2xl font-extrabold ${selected.transaction_type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(selected.amount)}</div></div><div className="grid grid-cols-2 gap-4 text-sm"><div><div className="text-xs text-slate-400">Tanggal</div><div className="mt-1 font-semibold">{formatDate(selected.transaction_date)}</div></div><div><div className="text-xs text-slate-400">Kategori</div><div className="mt-1 font-semibold">{(selected as any).category?.name ?? '—'}</div></div><div><div className="text-xs text-slate-400">Dibuat oleh</div><div className="mt-1 font-semibold">{(selected as any).creator?.full_name || (selected as any).creator?.email || 'Pengguna'}</div></div><div><div className="text-xs text-slate-400">Status</div><div className="mt-1"><Badge tone={selected.status === 'posted' ? 'success' : 'danger'}>{selected.status === 'posted' ? 'Valid' : 'Dibatalkan'}</Badge></div></div></div><div><div className="text-xs text-slate-400">Keterangan</div><p className="mt-1 text-sm leading-6 text-slate-700">{selected.description}</p></div>{selected.receipt_url && <Button variant="outline" className="w-full" onClick={() => openReceipt(selected.receipt_url!)}><Eye size={16} /> Buka bukti transaksi</Button>}{(selected as any).source_payment_id && <div className="rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">Transaksi ini dibuat otomatis dari pembayaran iuran. Perubahan pembayaran dikelola melalui menu Iuran anggota.</div>}{activeRole === 'treasurer' && selected.status === 'posted' && !(selected as any).source_payment_id && <div className="flex gap-2"><Link to={`/transactions/${selected.id}/edit`} className="flex-1"><Button variant="outline" className="w-full"><Pencil size={15} /> Edit</Button></Link><Button variant="danger" className="flex-1" onClick={() => voidTransaction(selected)}><Slash size={15} /> Batalkan</Button></div>}<div className="text-[10px] text-slate-400">ID lengkap: {selected.id}</div></div>}</DialogContent></Dialog>
  </>;
}
