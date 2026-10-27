import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText, Filter, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fetchAllTransactions, fetchAllContributionPayments } from '../lib/database';
import { errorMessage } from '../lib/utils';
import { formatCurrency, formatDate, todayISO } from '../lib/format';
import { useOrganization } from '../contexts/OrganizationContext';
import type { ContributionPayment, Transaction } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

function firstDayOfMonth() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; }

export function ReportsPage() {
  const { activeOrganization } = useOrganization();
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayISO());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<ContributionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeOrganization) { setTransactions([]); setPayments([]); setLoading(false); return; }
    if (fromDate && toDate && fromDate > toDate) return toast.error('Tanggal awal tidak boleh melebihi tanggal akhir.');
    setLoading(true);
    try {
      const [txRows, payRes] = await Promise.all([
        fetchAllTransactions(activeOrganization.id, { select: '*, category:transaction_categories(name)', status: 'posted', fromDate: fromDate || '1900-01-01', toDate: toDate || '2999-12-31', ascending: true }),
        fetchAllContributionPayments(activeOrganization.id, fromDate || '1900-01-01', toDate || '2999-12-31'),
      ]);
      setTransactions((txRows as unknown as Transaction[]) ?? []);
      setPayments((payRes as ContributionPayment[]) ?? []);
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memuat laporan transaksi.'));
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [activeOrganization?.id]);

  const totals = useMemo(() => transactions.reduce((acc, tx) => {
    if (tx.transaction_type === 'income') acc.income += Number(tx.amount);
    else acc.expense += Number(tx.amount);
    return acc;
  }, { income: 0, expense: 0 }), [transactions]);
  const categoryRows = useMemo(() => {
    const map = new Map<string, { category: string; type: string; total: number; count: number }>();
    transactions.forEach((tx) => {
      const category = (tx as any).category?.name ?? 'Tanpa kategori';
      const type = tx.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const key = `${type}:${category}`;
      const current = map.get(key) ?? { category, type, total: 0, count: 0 };
      current.total += Number(tx.amount); current.count += 1; map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [transactions]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      { Keterangan: 'Organisasi', Nilai: activeOrganization?.name ?? '' },
      { Keterangan: 'Periode', Nilai: `${fromDate} s.d. ${toDate}` },
      { Keterangan: 'Total pemasukan', Nilai: totals.income },
      { Keterangan: 'Total pengeluaran', Nilai: totals.expense },
      { Keterangan: 'Saldo periode', Nilai: totals.income - totals.expense },
      { Keterangan: 'Pembayaran iuran diterima', Nilai: payments.reduce((sum, payment) => sum + Number(payment.amount), 0) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Ringkasan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transactions.map((tx) => ({ Tanggal: tx.transaction_date, Jenis: tx.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran', Kategori: (tx as any).category?.name ?? '', Keterangan: tx.description, Nominal: Number(tx.amount), Status: tx.status }))), 'Transaksi');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoryRows.map((row) => ({ Kategori: row.category, Jenis: row.type, Jumlah: row.count, Total: row.total }))), 'Kategori');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments.map((payment) => ({ Tanggal: payment.payment_date, Nominal: Number(payment.amount), Catatan: payment.notes ?? '' }))), 'Pembayaran Iuran');
    XLSX.writeFile(wb, `Laporan-KasKita-${fromDate}-${toDate}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Laporan Keuangan KasKita', 14, 18);
    doc.setFontSize(10); doc.text(`Organisasi: ${activeOrganization?.name ?? '-'}`, 14, 26); doc.text(`Periode: ${formatDate(fromDate)} - ${formatDate(toDate)}`, 14, 32);
    autoTable(doc, { startY: 40, head: [['Ringkasan', 'Nominal']], body: [['Total pemasukan', formatCurrency(totals.income)], ['Total pengeluaran', formatCurrency(totals.expense)], ['Saldo periode', formatCurrency(totals.income - totals.expense)], ['Pembayaran iuran diterima', formatCurrency(payments.reduce((sum, payment) => sum + Number(payment.amount), 0))]], theme: 'grid', headStyles: { fillColor: [79, 70, 229] } });
    const nextY = (doc as any).lastAutoTable?.finalY + 8 || 80;
    autoTable(doc, { startY: nextY, head: [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Nominal']], body: transactions.map((tx) => [formatDate(tx.transaction_date, 'd MMM yyyy'), tx.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran', (tx as any).category?.name ?? '-', tx.description, formatCurrency(tx.amount)]), styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [79, 70, 229] }, columnStyles: { 3: { cellWidth: 62 } } });
    doc.save(`Laporan-KasKita-${fromDate}-${toDate}.pdf`);
  };

  if (loading) return <Loading label="Menyiapkan laporan keuangan..." />;
  if (!activeOrganization) return <Card><EmptyState title="Pilih organisasi terlebih dahulu" description="Laporan diambil dari transaksi aktual pada organisasi aktif." /></Card>;
  const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return <>
    <PageHeader title="Laporan keuangan" description="Ringkasan dihitung dari data transaksi dan pembayaran aktual." actions={<><Button variant="outline" onClick={exportPdf}><FileText size={16} /> Ekspor PDF</Button><Button onClick={exportExcel}><FileSpreadsheet size={16} /> Ekspor Excel</Button></>} />
    <Card><CardContent className="p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Dari tanggal</label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div><div><label className="mb-1.5 block text-xs font-semibold text-slate-600">Sampai tanggal</label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div><div className="flex items-end"><Button onClick={() => void load()}><Filter size={15} /> Terapkan Filter</Button></div></div><div className="mt-3 text-xs text-slate-400">Periode laporan: {formatDate(fromDate)} sampai {formatDate(toDate)}.</div></CardContent></Card>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ title: 'Total pemasukan', value: totals.income, tone: 'text-emerald-700', icon: '↙' }, { title: 'Total pengeluaran', value: totals.expense, tone: 'text-red-600', icon: '↗' }, { title: 'Saldo periode', value: totals.income - totals.expense, tone: 'text-indigo-700', icon: '−' }, { title: 'Iuran diterima', value: totalCollected, tone: 'text-slate-900', icon: '✓' }].map((item) => <Card key={item.title}><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">{item.title}<span className={`text-lg ${item.tone}`}>{item.icon}</span></div><div className={`mt-3 break-words text-xl font-extrabold ${item.tone}`}>{formatCurrency(item.value)}</div></CardContent></Card>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><Card><CardHeader><CardTitle>Ringkasan kategori</CardTitle><p className="text-xs text-slate-500">Pengelompokan berdasarkan kategori transaksi valid.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Kategori</th><th>Jenis</th><th>Jumlah transaksi</th><th className="text-right">Total</th></tr></thead><tbody>{categoryRows.map((row) => <tr key={`${row.type}-${row.category}`}><td className="font-semibold text-slate-800">{row.category}</td><td>{row.type}</td><td>{row.count}</td><td className="text-right font-semibold">{formatCurrency(row.total)}</td></tr>)}</tbody></table>{categoryRows.length === 0 && <EmptyState title="Belum ada data untuk periode ini" description="Ubah rentang tanggal atau catat transaksi terlebih dahulu." icon={<BarChart3 size={22} />} />}</div></CardContent></Card><Card><CardHeader><CardTitle>Rincian pembayaran iuran</CardTitle><p className="text-xs text-slate-500">Pembayaran yang diterima dalam periode laporan.</p></CardHeader><CardContent><div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4"><div className="rounded-xl bg-white p-2 text-emerald-600"><Wallet size={20} /></div><div><div className="text-xs text-emerald-800">Total diterima</div><div className="mt-1 text-xl font-extrabold text-emerald-800">{formatCurrency(totalCollected)}</div></div></div><div className="mt-4 space-y-3">{payments.slice(0, 8).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"><div><div className="text-sm font-semibold text-slate-800">Pembayaran iuran</div><div className="mt-0.5 text-xs text-slate-400">{formatDate(payment.payment_date, 'd MMM yyyy')}{payment.notes ? ` · ${payment.notes}` : ''}</div></div><div className="whitespace-nowrap text-sm font-semibold text-emerald-700">+{formatCurrency(payment.amount)}</div></div>)}{payments.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Belum ada pembayaran iuran pada periode ini.</p>}</div></CardContent></Card></div>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="rounded-xl bg-white p-2 text-indigo-600"><Download size={18} /></div><div><div className="text-sm font-semibold text-indigo-950">Catatan laporan</div><p className="mt-1 text-xs leading-5 text-indigo-800">Saldo periode adalah pemasukan dikurangi pengeluaran dalam rentang tanggal yang dipilih, bukan saldo kumulatif sepanjang waktu. Pembayaran iuran sudah tercatat sebagai transaksi pemasukan agar tidak dihitung dua kali.</p></div></div>
  </>;
}
