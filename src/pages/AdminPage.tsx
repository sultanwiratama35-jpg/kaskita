import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, ShieldCheck, Users, UserCog, Pencil, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage, getInitials } from '../lib/utils';
import { formatDate } from '../lib/format';
import type { Organization, OrgRole, Profile, OrganizationMember } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Field, FieldLabel } from '../components/ui/field';
import { Badge } from '../components/ui/badge';
import { Loading } from '../components/Loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

interface AdminMembership extends OrganizationMember { profile?: { full_name: string | null; email: string | null } | null; organization?: { name: string } | null; }

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: adminFlag, error: adminError } = await supabase.rpc('is_platform_admin');
    if (adminError || adminFlag !== true) {
      setIsAdmin(false); setLoading(false); navigate('/dashboard', { replace: true });
      if (adminError) toast.error(errorMessage(adminError, 'Tidak dapat memeriksa hak administrator.'));
      return;
    }
    setIsAdmin(true);
    const [orgRes, profileRes, membershipRes] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('organization_members').select('*, profile:profiles!organization_members_user_id_fkey(full_name,email), organization:organizations(name)').order('joined_at', { ascending: false }).limit(2000),
    ]);
    if (orgRes.error) toast.error(errorMessage(orgRes.error));
    if (profileRes.error) toast.error(errorMessage(profileRes.error));
    if (membershipRes.error) toast.error(errorMessage(membershipRes.error));
    setOrganizations((orgRes.data as Organization[]) ?? []);
    setProfiles((profileRes.data as Profile[]) ?? []);
    setMemberships((membershipRes.data as unknown as AdminMembership[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const openEdit = (org: Organization) => { setEditOrg(org); setOrgName(org.name); setOrgDescription(org.description ?? ''); };
  const saveOrg = async (event: FormEvent) => {
    event.preventDefault();
    if (!editOrg) return;
    if (orgName.trim().length < 2) return toast.error('Nama organisasi minimal 2 karakter.');
    setSavingOrg(true);
    const { error } = await supabase.from('organizations').update({ name: orgName.trim(), description: orgDescription.trim() || null }).eq('id', editOrg.id);
    setSavingOrg(false);
    if (error) return toast.error(errorMessage(error, 'Organisasi gagal diperbarui.'));
    toast.success('Organisasi diperbarui.'); setEditOrg(null); void load();
  };
  const changeRole = async (membership: AdminMembership, role: OrgRole) => {
    if (membership.role === role) return;
    const { error } = await supabase.from('organization_members').update({ role }).eq('id', membership.id);
    if (error) return toast.error(errorMessage(error, 'Peran gagal diubah.'));
    toast.success('Peran anggota diperbarui.'); void load();
  };
  const removeMembership = async (membership: AdminMembership) => {
    if (!window.confirm(`Keluarkan ${membership.profile?.email || 'anggota'} dari ${membership.organization?.name || 'organisasi'}? Catatan keuangan tidak dihapus.`)) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', membership.id);
    if (error) return toast.error(errorMessage(error, 'Keanggotaan gagal dihapus.'));
    toast.success('Keanggotaan dihapus.'); void load();
  };

  if (loading) return <Loading label="Memeriksa akses administrator..." />;
  if (!isAdmin) return null;
  return <>
    <PageHeader title="Panel administrator" description="Pemantauan tingkat platform. Perubahan hak akses dicatat dalam audit organisasi." />
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Organisasi <Building2 size={18} className="text-indigo-600" /></div><div className="mt-3 text-2xl font-extrabold">{organizations.length}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Akun pengguna <Users size={18} className="text-emerald-600" /></div><div className="mt-3 text-2xl font-extrabold">{profiles.length}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Keanggotaan <UserCog size={18} className="text-amber-600" /></div><div className="mt-3 text-2xl font-extrabold">{memberships.length}</div></CardContent></Card></div>

    <Card className="mt-5"><CardHeader><CardTitle>Organisasi di platform</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Organisasi</th><th>Pembuat</th><th>Visibilitas transaksi</th><th>Dibuat</th><th className="text-right">Aksi</th></tr></thead><tbody>{organizations.map((org) => <tr key={org.id}><td><div className="font-semibold text-slate-800">{org.name}</div><div className="mt-1 text-[10px] text-slate-400">{org.id}</div></td><td>{profiles.find((p) => p.id === org.created_by)?.email ?? '—'}</td><td><Badge tone={org.members_can_view_transactions ? 'success' : 'warning'}>{org.members_can_view_transactions ? 'Anggota dapat melihat' : 'Terbatas'}</Badge></td><td>{formatDate(org.created_at, 'd MMM yyyy')}</td><td className="text-right"><Button size="sm" variant="outline" onClick={() => openEdit(org)}><Pencil size={14} /> Edit</Button></td></tr>)}</tbody></table>{organizations.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Belum ada organisasi.</div>}</div></CardContent></Card>

    <Card className="mt-5"><CardHeader><CardTitle>Keanggotaan dan peran</CardTitle><p className="text-xs text-slate-500">Mengubah peran memengaruhi izin akses pada organisasi terkait.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Pengguna</th><th>Organisasi</th><th>Peran</th><th>Bergabung</th><th className="text-right">Aksi</th></tr></thead><tbody>{memberships.map((membership) => <tr key={membership.id}><td><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">{getInitials(membership.profile?.full_name || membership.profile?.email)}</div><div><div className="font-semibold text-slate-800">{membership.profile?.full_name || 'Pengguna'}</div><div className="text-[10px] text-slate-400">{membership.profile?.email}</div></div></div></td><td>{membership.organization?.name ?? '—'}</td><td><Select className="h-8 w-[140px] text-xs" value={membership.role} disabled={membership.user_id === user?.id} onChange={(e) => void changeRole(membership, e.target.value as OrgRole)}><option value="treasurer">Bendahara</option><option value="member">Anggota</option><option value="auditor">Auditor / Viewer</option></Select></td><td>{formatDate(membership.joined_at, 'd MMM yyyy')}</td><td className="text-right"><Button size="sm" variant="ghost" disabled={membership.user_id === user?.id} onClick={() => void removeMembership(membership)}><UserCog size={14} className="text-red-500" /> Keluarkan</Button></td></tr>)}</tbody></table>{memberships.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Belum ada keanggotaan.</div>}</div></CardContent></Card>

    <Card className="mt-5"><CardContent className="flex items-start gap-3 p-5"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><CheckCircle2 size={18} /></div><div><div className="text-sm font-semibold text-slate-900">Akses sistem dibatasi</div><p className="mt-1 text-xs leading-5 text-slate-500">Panel ini hanya tersedia untuk UUID yang dimasukkan secara manual ke tabel <code>platform_admins</code> oleh operator Supabase. Pengguna biasa tidak dapat mempromosikan dirinya menjadi administrator.</p></div></CardContent></Card>

    <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}><DialogContent><DialogHeader><DialogTitle>Edit organisasi</DialogTitle><DialogDescription>Perubahan nama dan deskripsi dicatat di riwayat aktivitas organisasi.</DialogDescription></DialogHeader><form onSubmit={saveOrg} className="space-y-4"><Field><FieldLabel htmlFor="adminOrgName">Nama organisasi</FieldLabel><Input id="adminOrgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required /></Field><Field><FieldLabel htmlFor="adminOrgDescription">Deskripsi</FieldLabel><Input id="adminOrgDescription" value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} /></Field><Button type="submit" className="w-full" disabled={savingOrg}><Pencil size={15} />{savingOrg ? 'Menyimpan...' : 'Simpan Perubahan'}</Button></form></DialogContent></Dialog>
  </>;
}
