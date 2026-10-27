import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, MailPlus, MoreHorizontal, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage, getInitials } from '../lib/utils';
import { formatDate } from '../lib/format';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import type { OrgRole, OrganizationMember } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Field, FieldLabel } from '../components/ui/field';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

interface MemberRow extends OrganizationMember { profile?: { full_name: string | null; email: string | null } | null; }
interface InvitationRow { id: string; email: string; role: OrgRole; invitation_token: string; expires_at: string; accepted_at: string | null; created_at: string; }
const roleLabel: Record<OrgRole, string> = { treasurer: 'Bendahara', member: 'Anggota', auditor: 'Auditor / Viewer' };

export function MembersPage() {
  const { activeOrganization, activeRole } = useOrganization();
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);

  const load = async () => {
    if (!activeOrganization) { setMembers([]); setInvitations([]); setLoading(false); return; }
    setLoading(true);
    const [memberRes, inviteRes] = await Promise.all([
      supabase.from('organization_members').select('id,organization_id,user_id,role,joined_at,profile:profiles!organization_members_user_id_fkey(full_name,email)').eq('organization_id', activeOrganization.id).order('joined_at', { ascending: true }),
      supabase.from('invitations').select('*').eq('organization_id', activeOrganization.id).order('created_at', { ascending: false }),
    ]);
    if (memberRes.error) toast.error(errorMessage(memberRes.error, 'Gagal memuat anggota.'));
    if (inviteRes.error && activeRole === 'treasurer') toast.error(errorMessage(inviteRes.error, 'Gagal memuat undangan.'));
    setMembers((memberRes.data as unknown as MemberRow[]) ?? []);
    setInvitations((inviteRes.data as InvitationRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [activeOrganization?.id, activeRole]);

  const createInvitation = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeOrganization) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error('Masukkan alamat email yang valid.');
    if (members.some((member) => member.profile?.email?.toLowerCase() === email)) return toast.error('Email tersebut sudah menjadi anggota organisasi.');
    if (invitations.some((inv) => inv.email.toLowerCase() === email && !inv.accepted_at && new Date(inv.expires_at) > new Date())) return toast.error('Undangan yang masih aktif untuk email tersebut sudah ada.');
    if (!user) return toast.error('Sesi pengguna tidak tersedia. Silakan masuk kembali.');
    setInviteSaving(true);
    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('invitations').insert({ organization_id: activeOrganization.id, email, role: inviteRole, invitation_token: token, expires_at: expires, invited_by: user?.id });
    setInviteSaving(false);
    if (error) return toast.error(errorMessage(error, 'Undangan gagal dibuat.'));
    const link = `${window.location.origin}/accept-invitation?token=${token}`;
    setInviteLink(link); setInviteToken(token); setInviteLinkOpen(true); setInviteOpen(false); setInviteEmail('');
    toast.success('Tautan undangan dibuat. Bagikan tautan ini kepada calon anggota.');
    void load();
  };

  const changeRole = async (member: MemberRow, role: OrgRole) => {
    if (member.role === role) return;
    if (!window.confirm(`Ubah peran ${member.profile?.full_name || member.profile?.email || 'anggota'} menjadi ${roleLabel[role]}?`)) return;
    const { error } = await supabase.from('organization_members').update({ role }).eq('id', member.id).eq('organization_id', activeOrganization?.id);
    if (error) return toast.error(errorMessage(error, 'Peran anggota gagal diubah.'));
    toast.success('Peran anggota diperbarui.'); void load();
  };

  const removeMember = async (member: MemberRow) => {
    if (!window.confirm(`Keluarkan ${member.profile?.full_name || member.profile?.email || 'anggota'} dari organisasi? Riwayat transaksi tetap dipertahankan.`)) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', member.id).eq('organization_id', activeOrganization?.id);
    if (error) return toast.error(errorMessage(error, 'Anggota gagal dikeluarkan.'));
    toast.success('Anggota dikeluarkan dari organisasi.'); void load();
  };

  const copyText = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Tautan disalin.'); }
    catch { toast.error('Gagal menyalin otomatis. Silakan salin teks secara manual.'); }
  };

  if (loading) return <Loading label="Memuat anggota organisasi..." />;
  if (!activeOrganization) return <Card><EmptyState title="Pilih organisasi terlebih dahulu" description="Daftar anggota tersedia setelah organisasi dipilih." /></Card>;

  return <>
    <PageHeader title="Anggota" description="Atur keanggotaan dan peran yang sesuai dengan tanggung jawab." actions={activeRole === 'treasurer' ? <Button onClick={() => setInviteOpen(true)}><MailPlus size={16} /> Undang anggota</Button> : undefined} />
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Total anggota <Users size={17} className="text-indigo-600" /></div><div className="mt-3 text-2xl font-extrabold">{members.length}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Bendahara <ShieldCheck size={17} className="text-emerald-600" /></div><div className="mt-3 text-2xl font-extrabold">{members.filter((m) => m.role === 'treasurer').length}</div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">Undangan menunggu <MailPlus size={17} className="text-amber-600" /></div><div className="mt-3 text-2xl font-extrabold">{invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date()).length}</div></CardContent></Card></div>

    <Card className="mt-5"><CardHeader><CardTitle>Daftar anggota</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Anggota</th><th>Peran</th><th>Bergabung</th><th>Status akses</th><th className="text-right">Pengaturan</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><div className="flex min-w-[220px] items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">{getInitials(member.profile?.full_name || member.profile?.email)}</div><div><div className="text-sm font-semibold text-slate-800">{member.profile?.full_name || 'Nama belum diatur'}</div><div className="mt-0.5 text-xs text-slate-500">{member.profile?.email || 'Email tidak tersedia'}</div></div></div></td><td><Badge tone={member.role === 'treasurer' ? 'primary' : member.role === 'auditor' ? 'warning' : 'default'}>{roleLabel[member.role]}</Badge></td><td>{formatDate(member.joined_at, 'd MMM yyyy')}</td><td><span className="inline-flex items-center gap-1.5 text-xs text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktif</span></td><td className="text-right">{activeRole === 'treasurer' ? <div className="flex justify-end gap-2"><Select aria-label="Ubah peran anggota" className="h-8 w-[145px] text-xs" value={member.role} disabled={member.user_id === user?.id} onChange={(e) => void changeRole(member, e.target.value as OrgRole)}><option value="treasurer">Bendahara</option><option value="member">Anggota</option><option value="auditor">Auditor / Viewer</option></Select><Button size="icon" variant="ghost" title="Keluarkan anggota" disabled={member.user_id === user?.id} onClick={() => void removeMember(member)}><UserMinus size={16} className="text-red-500" /></Button></div> : <span className="text-xs text-slate-400">Hanya bendahara yang dapat mengubah</span>}</td></tr>)}</tbody></table>{members.length === 0 && <EmptyState title="Belum ada anggota" description="Buat organisasi dan undang anggota untuk mulai bekerja bersama." />}</div></CardContent></Card>

    <Card className="mt-5"><CardHeader><CardTitle>Undangan organisasi</CardTitle><p className="text-xs text-slate-500">Tautan undangan berlaku selama 7 hari. Tautan perlu dibagikan secara manual.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Email</th><th>Peran</th><th>Dibuat</th><th>Kedaluwarsa</th><th>Status</th><th className="text-right">Tautan</th></tr></thead><tbody>{invitations.map((inv) => { const expired = new Date(inv.expires_at) < new Date(); const status = inv.accepted_at ? 'Diterima' : expired ? 'Kedaluwarsa' : 'Menunggu'; return <tr key={inv.id}><td className="font-medium">{inv.email}</td><td>{roleLabel[inv.role]}</td><td>{formatDate(inv.created_at, 'd MMM yyyy')}</td><td>{formatDate(inv.expires_at, 'd MMM yyyy')}</td><td><Badge tone={inv.accepted_at ? 'success' : expired ? 'danger' : 'warning'}>{status}</Badge></td><td className="text-right">{!inv.accepted_at && !expired && activeRole === 'treasurer' && <Button size="sm" variant="outline" onClick={() => { setInviteLink(`${window.location.origin}/accept-invitation?token=${inv.invitation_token}`); setInviteToken(inv.invitation_token); setInviteLinkOpen(true); }}><Copy size={14} /> Salin tautan</Button>}</td></tr>; })}</tbody></table>{invitations.length === 0 && <div className="px-5 py-7 text-center text-sm text-slate-500">Belum ada undangan yang dibuat.</div>}</div></CardContent></Card>

    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent><DialogHeader><DialogTitle>Undang anggota</DialogTitle><DialogDescription>KasKita membuat tautan undangan yang dapat dibagikan. Pengiriman email otomatis belum diaktifkan.</DialogDescription></DialogHeader><form onSubmit={createInvitation} className="space-y-4"><Field><FieldLabel htmlFor="inviteEmail">Email calon anggota</FieldLabel><Input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="anggota@email.com" required /></Field><Field><FieldLabel htmlFor="inviteRole">Peran</FieldLabel><Select id="inviteRole" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}><option value="member">Anggota</option><option value="auditor">Auditor / Viewer</option><option value="treasurer">Bendahara</option></Select></Field><Button type="submit" className="w-full" disabled={inviteSaving}><MailPlus size={16} />{inviteSaving ? 'Membuat undangan...' : 'Buat Tautan Undangan'}</Button></form></DialogContent></Dialog>
    <Dialog open={inviteLinkOpen} onOpenChange={setInviteLinkOpen}><DialogContent><DialogHeader><DialogTitle>Tautan undangan siap</DialogTitle><DialogDescription>Bagikan tautan ini hanya kepada email yang Anda undang. Tautan berlaku 7 hari.</DialogDescription></DialogHeader><div className="space-y-3"><div className="rounded-xl bg-slate-50 p-3"><div className="break-all text-xs leading-5 text-slate-700">{inviteLink}</div></div><Button className="w-full" onClick={() => copyText(inviteLink)}><Copy size={16} /> Salin tautan</Button><div className="text-[11px] leading-5 text-slate-400">Token: {inviteToken}</div></div></DialogContent></Dialog>
  </>;
}
