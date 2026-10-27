import { useEffect, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, CircleSlash, History, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/utils';
import { formatDate } from '../lib/format';
import { useOrganization } from '../contexts/OrganizationContext';
import type { AuditLog } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';

const actionNames: Record<string, string> = {
  transaction_created: 'Transaksi dibuat',
  transaction_updated: 'Transaksi diperbarui',
  transaction_voided: 'Transaksi dibatalkan',
  contribution_payment_recorded: 'Pembayaran iuran dicatat',
  contribution_plan_created: 'Rencana iuran dibuat',
  member_role_changed: 'Peran anggota diubah',
  member_added: 'Anggota ditambahkan',
  member_removed: 'Anggota dikeluarkan',
  invitation_created: 'Undangan dibuat',
  invitation_accepted: 'Undangan diterima',
  organization_created: 'Organisasi dibuat',
  organization_updated: 'Pengaturan organisasi diperbarui',
};
function actionIcon(action: string) {
  if (action.includes('void')) return <CircleSlash size={17} />;
  if (action.includes('transaction') && action.includes('income')) return <ArrowDownLeft size={17} />;
  if (action.includes('transaction')) return <ArrowUpRight size={17} />;
  if (action.includes('member') || action.includes('invitation')) return <UserCog size={17} />;
  return <ShieldCheck size={17} />;
}

export function AuditLogsPage() {
  const { activeOrganization, activeRole } = useOrganization();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    if (!activeOrganization || activeRole === 'member' || !activeRole) { setLogs([]); setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('audit_logs').select('*, profile:profiles!audit_logs_user_id_fkey(full_name,email)').eq('organization_id', activeOrganization.id).order('created_at', { ascending: false }).limit(300);
      if (!mounted) return;
      if (error) toast.error(errorMessage(error, 'Gagal memuat riwayat aktivitas.'));
      setLogs((data as unknown as AuditLog[]) ?? []);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [activeOrganization?.id, activeRole]);
  const filtered = logs.filter((log) => filter === 'all' || log.entity_type === filter);

  if (loading) return <Loading label="Memuat riwayat aktivitas..." />;
  if (!activeOrganization) return <Card><EmptyState title="Pilih organisasi terlebih dahulu" description="Riwayat aktivitas ditampilkan sesuai organisasi yang sedang dipilih." /></Card>;
  if (activeRole === 'member') return <Card><EmptyState title="Akses terbatas" description="Riwayat audit hanya tersedia untuk bendahara dan auditor organisasi." icon={<ShieldCheck size={22} />} /></Card>;
  return <>
    <PageHeader title="Riwayat aktivitas" description="Jejak perubahan penting pada transaksi, pembayaran, dan keanggotaan." />
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Aktivitas tersimpan <Activity size={17} className="text-indigo-600" /></div><div className="mt-3 text-2xl font-extrabold">{logs.length}</div><div className="mt-1 text-xs text-slate-400">Maksimal 300 aktivitas terbaru</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Transaksi <ArrowUpRight size={17} className="text-emerald-600" /></div><div className="mt-3 text-2xl font-extrabold">{logs.filter((log) => log.entity_type === 'transaction').length}</div><div className="mt-1 text-xs text-slate-400">Pembuatan, perubahan, pembatalan</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Keanggotaan & iuran <UserCog size={17} className="text-amber-600" /></div><div className="mt-3 text-2xl font-extrabold">{logs.filter((log) => ['organization_member', 'invitation', 'contribution_payment', 'contribution_plan'].includes(log.entity_type)).length}</div><div className="mt-1 text-xs text-slate-400">Aktivitas administrasi organisasi</div></CardContent></Card></div>
    <Card className="mt-5"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Log audit</CardTitle><p className="mt-1 text-xs text-slate-500">Data dibaca langsung dari database.</p></div><Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-[180px]"><option value="all">Semua aktivitas</option><option value="transaction">Transaksi</option><option value="contribution_payment">Pembayaran iuran</option><option value="contribution_plan">Rencana iuran</option><option value="organization_member">Keanggotaan</option><option value="invitation">Undangan</option><option value="organization">Organisasi</option></Select></CardHeader><CardContent className="p-0"><div className="divide-y divide-slate-100">{filtered.map((log) => <div key={log.id} className="flex gap-3 px-5 py-4 sm:px-6"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{actionIcon(log.action)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-800">{actionNames[log.action] ?? log.action.replaceAll('_', ' ')}</span><Badge>{log.entity_type}</Badge></div><div className="mt-1 text-xs text-slate-500">{(log as any).profile?.full_name || (log as any).profile?.email || 'Sistem'} · {formatDate(log.created_at, 'd MMM yyyy, HH:mm')}</div>{log.changes && Object.keys(log.changes).length > 0 && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-indigo-600">Lihat detail perubahan</summary><pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">{JSON.stringify(log.changes, null, 2)}</pre></details>}<div className="mt-1 truncate text-[10px] text-slate-300">ID referensi: {log.entity_id || '—'}</div></div></div>)}</div>{filtered.length === 0 && <EmptyState title="Belum ada aktivitas" description="Aktivitas penting akan muncul setelah ada transaksi, perubahan anggota, atau pembayaran iuran." icon={<History size={22} />} />}</CardContent></Card>
  </>;
}
