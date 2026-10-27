import { useEffect, useState, type FormEvent } from 'react';
import { Check, LockKeyhole, Save, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field, FieldLabel } from '../components/ui/field';

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { activeOrganization, activeRole, reloadOrganizations } = useOrganization();
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [membersCanView, setMembersCanView] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);
  useEffect(() => {
    setOrgName(activeOrganization?.name ?? '');
    setOrgDescription(activeOrganization?.description ?? '');
    setMembersCanView(activeOrganization?.members_can_view_transactions ?? true);
  }, [activeOrganization?.id, activeOrganization?.name, activeOrganization?.description, activeOrganization?.members_can_view_transactions]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (fullName.trim().length < 2) return toast.error('Nama minimal 2 karakter.');
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id);
    setSavingProfile(false);
    if (error) return toast.error(errorMessage(error, 'Profil gagal diperbarui.'));
    await refreshProfile();
    toast.success('Profil berhasil diperbarui.');
  };

  const saveOrganization = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeOrganization) return;
    if (activeRole !== 'treasurer') return toast.error('Hanya bendahara yang dapat mengubah pengaturan organisasi.');
    if (orgName.trim().length < 2) return toast.error('Nama organisasi minimal 2 karakter.');
    setSavingOrg(true);
    const { error } = await supabase.from('organizations').update({ name: orgName.trim(), description: orgDescription.trim() || null, members_can_view_transactions: membersCanView }).eq('id', activeOrganization.id);
    setSavingOrg(false);
    if (error) return toast.error(errorMessage(error, 'Pengaturan organisasi gagal disimpan.'));
    await reloadOrganizations();
    toast.success('Pengaturan organisasi berhasil disimpan.');
  };

  return <>
    <PageHeader title="Pengaturan" description="Perbarui profil dan preferensi ruang kerja organisasi." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card><CardHeader><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><UserRound size={19} /></div><div><CardTitle>Profil pengguna</CardTitle><p className="mt-1 text-xs text-slate-500">Informasi akun Anda di KasKita.</p></div></div></CardHeader><CardContent><form onSubmit={saveProfile} className="space-y-4"><Field><FieldLabel htmlFor="fullName">Nama lengkap</FieldLabel><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" required /></Field><Field><FieldLabel htmlFor="email">Email akun</FieldLabel><Input id="email" value={user?.email ?? ''} disabled readOnly /></Field><div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Email digunakan untuk masuk dan menerima undangan organisasi. Perubahan email akun dilakukan melalui pengaturan autentikasi.</div><Button type="submit" disabled={savingProfile}><Save size={16} />{savingProfile ? 'Menyimpan...' : 'Simpan Profil'}</Button></form></CardContent></Card>

      <Card><CardHeader><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><Users size={19} /></div><div><CardTitle>Pengaturan organisasi</CardTitle><p className="mt-1 text-xs text-slate-500">Preferensi organisasi yang sedang aktif.</p></div></div></CardHeader><CardContent>{activeOrganization ? <form onSubmit={saveOrganization} className="space-y-4"><Field><FieldLabel htmlFor="orgName">Nama organisasi</FieldLabel><Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={activeRole !== 'treasurer'} required /></Field><Field><FieldLabel htmlFor="orgDescription">Deskripsi</FieldLabel><Input id="orgDescription" value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} disabled={activeRole !== 'treasurer'} placeholder="Deskripsi singkat organisasi" /></Field><label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 ${activeRole !== 'treasurer' ? 'opacity-70' : ''}`}><input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={membersCanView} disabled={activeRole !== 'treasurer'} onChange={(e) => setMembersCanView(e.target.checked)} /><span><span className="block text-sm font-semibold text-slate-800">Anggota dapat melihat transaksi</span><span className="mt-1 block text-xs leading-5 text-slate-500">Jika dinonaktifkan, daftar transaksi hanya dapat dilihat bendahara dan auditor. Anggota tetap dapat melihat status iurannya sendiri.</span></span></label>{activeRole === 'treasurer' ? <Button type="submit" disabled={savingOrg}><Save size={16} />{savingOrg ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button> : <p className="text-xs text-slate-400">Hanya bendahara yang dapat mengubah pengaturan organisasi.</p>}</form> : <p className="text-sm text-slate-500">Buat atau pilih organisasi untuk mengatur preferensinya.</p>}</CardContent></Card>
    </div>

    <Card className="mt-5"><CardHeader><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><LockKeyhole size={19} /></div><div><CardTitle>Keamanan dan privasi</CardTitle><p className="mt-1 text-xs text-slate-500">Perlindungan data pada level database.</p></div></div></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-3">{[{ title: 'Isolasi organisasi', text: 'Data dibatasi berdasarkan keanggotaan organisasi.' }, { title: 'Hak akses berbasis peran', text: 'Bendahara, anggota, dan auditor memiliki izin berbeda.' }, { title: 'Jejak audit', text: 'Perubahan transaksi dan peran dicatat dalam riwayat.' }].map((item) => <div key={item.title} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Check size={15} className="text-emerald-600" />{item.title}</div><p className="mt-2 text-xs leading-5 text-slate-500">{item.text}</p></div>)}</div></CardContent></Card>
  </>;
}
