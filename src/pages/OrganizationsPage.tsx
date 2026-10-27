import { useState } from 'react';
import { Building2, Check, Plus, Users, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { errorMessage, getInitials } from '../lib/utils';
import { organizationSchema, type OrganizationInput } from '../lib/validation';
import { useOrganization } from '../contexts/OrganizationContext';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field, FieldError, FieldLabel } from '../components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { EmptyState } from '../components/EmptyState';

export function OrganizationsPage() {
  const { organizations, activeOrganization, switchOrganization, reloadOrganizations } = useOrganization();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OrganizationInput>({ resolver: zodResolver(organizationSchema), defaultValues: { name: '', description: '' } });

  const createOrganization = async (values: OrganizationInput) => {
    const { data, error } = await supabase.rpc('create_organization', { p_name: values.name.trim(), p_description: values.description?.trim() || null });
    if (error) return toast.error(errorMessage(error, 'Organisasi gagal dibuat.'));
    const id = data as string;
    await reloadOrganizations();
    if (id) switchOrganization(id);
    reset({ name: '', description: '' });
    setOpen(false);
    toast.success('Organisasi berhasil dibuat. Anda terdaftar sebagai bendahara.');
  };

  return <>
    <PageHeader title="Organisasi" description="Kelola ruang kerja keuangan dan berpindah antarorganisasi." actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Buat organisasi</Button>} />
    {organizations.length === 0 ? <Card><EmptyState title="Belum ada organisasi" description="Buat ruang kerja pertama agar Anda dapat mulai mencatat pemasukan, pengeluaran, dan iuran." actionLabel="Buat organisasi" onAction={() => setOpen(true)} icon={<Building2 size={22} />} /></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{organizations.map((item) => { const active = item.organization.id === activeOrganization?.id; return <Card key={item.organization.id} className={active ? 'border-indigo-200 ring-1 ring-indigo-100' : ''}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Building2 size={22} /></div>{active && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700"><Check size={12} /> Aktif</span>}</div><h3 className="mt-5 text-lg font-bold text-slate-900">{item.organization.name}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{item.organization.description || 'Tidak ada deskripsi organisasi.'}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><div><div className="text-[10px] uppercase tracking-wide text-slate-400">Peran Anda</div><div className="mt-1 text-sm font-semibold capitalize text-slate-700">{item.role === 'treasurer' ? 'Bendahara' : item.role === 'auditor' ? 'Auditor / Viewer' : 'Anggota'}</div></div><Button variant={active ? 'secondary' : 'outline'} size="sm" onClick={() => { switchOrganization(item.organization.id); toast.success(`Organisasi aktif: ${item.organization.name}`); }}>{active ? 'Dipilih' : 'Pilih organisasi'}</Button></div><div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><Users size={14} /> Ruang kerja terpisah <span className="mx-1">·</span><Wallet size={14} /> Data keuangan terisolasi</div></CardContent></Card>; })}</div>}
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Check size={18} /></div><div><h3 className="text-sm font-bold">Data setiap organisasi terpisah</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Transaksi, anggota, iuran, dan laporan mengikuti organisasi aktif. Akses ke data dibatasi oleh keanggotaan dan kebijakan keamanan database.</p></div></div></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Buat organisasi baru</DialogTitle><DialogDescription>Anda akan menjadi bendahara pertama dan dapat mengundang anggota setelah organisasi dibuat.</DialogDescription></DialogHeader><form onSubmit={handleSubmit(createOrganization)} className="space-y-4"><Field><FieldLabel htmlFor="name">Nama organisasi</FieldLabel><Input id="name" placeholder="Contoh: BEM Fakultas Ekonomi" {...register('name')} /><FieldError>{errors.name?.message}</FieldError></Field><Field><FieldLabel htmlFor="description">Deskripsi (opsional)</FieldLabel><Input id="description" placeholder="Tujuan atau informasi singkat organisasi" {...register('description')} /><FieldError>{errors.description?.message}</FieldError></Field><Button type="submit" className="w-full" disabled={isSubmitting}><Plus size={16} />{isSubmitting ? 'Membuat...' : 'Buat Organisasi'}</Button></form></DialogContent></Dialog>
  </>;
}
