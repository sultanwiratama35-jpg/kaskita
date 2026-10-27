import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDownUp, BarChart3, Building2, CircleHelp, Coins,
  LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, Wallet, X, Crown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { getInitials } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Button } from './ui/button';
import { Select } from './ui/select';

const navItems = [
  { to: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaksi', icon: ArrowDownUp },
  { to: '/contributions', label: 'Iuran anggota', icon: Coins },
  { to: '/reports', label: 'Laporan', icon: BarChart3 },
  { to: '/members', label: 'Anggota', icon: Users },
  { to: '/organizations', label: 'Organisasi', icon: Building2 },
  { to: '/audit-logs', label: 'Riwayat aktivitas', icon: Activity },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { organizations, activeOrganization, activeRole, switchOrganization } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { if (isSupabaseConfigured && user) { supabase.rpc('is_platform_admin').then(({ data }) => setIsPlatformAdmin(data === true)); } else setIsPlatformAdmin(false); }, [user?.id]);
  const permittedNavItems = navItems.filter((item) => item.to !== '/audit-logs' || activeRole === 'treasurer' || activeRole === 'auditor');
  const visibleNavItems = isPlatformAdmin ? [...permittedNavItems, { to: '/admin', label: 'Panel administrator', icon: Crown }] : permittedNavItems;
  const pageLabel = visibleNavItems.find((item) => location.pathname.startsWith(item.to))?.label ?? 'KasKita';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200"><Wallet size={21} strokeWidth={2.4} /></div>
        <div><div className="text-lg font-extrabold tracking-tight text-slate-950">KasKita</div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Financial workspace</div></div>
        <button className="ml-auto rounded-lg p-1 text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X size={20} /></button>
      </div>
      <div className="px-4 pt-5">
        <label className="mb-2 block px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Organisasi aktif</label>
        {organizations.length ? (
          <Select value={activeOrganization?.id ?? ''} onChange={(event) => switchOrganization(event.target.value)} className="h-11 border-slate-200 bg-slate-50 text-xs font-semibold">
            {organizations.map((item) => <option key={item.organization.id} value={item.organization.id}>{item.organization.name}</option>)}
          </Select>
        ) : (
          <button onClick={() => { navigate('/organizations'); setMobileOpen(false); }} className="flex w-full items-center justify-between rounded-xl border border-dashed border-indigo-200 bg-indigo-50/70 px-3 py-3 text-left text-xs font-semibold text-indigo-700"><span>Buat organisasi</span><Building2 size={15} /></button>
        )}
      </div>
      <nav className="mt-6 flex-1 space-y-1 px-3">
        <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Menu utama</div>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.to === '/audit-logs' && <ShieldCheck className="ml-auto opacity-40" size={14} />}</NavLink>;
        })}
      </nav>
      <div className="mx-4 mb-4 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CircleHelp size={16} className="text-indigo-600" /> Butuh bantuan?</div>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500">Catat transaksi secara rutin agar laporan organisasi tetap akurat.</p>
        <button onClick={() => navigate('/reports')} className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800">Lihat laporan →</button>
      </div>
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{getInitials(profile?.full_name ?? user?.email)}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{profile?.full_name || 'Pengguna KasKita'}</div><div className="truncate text-xs text-slate-500">{user?.email}</div></div>
          <button onClick={async () => { await signOut(); navigate('/login'); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Keluar" aria-label="Keluar"><LogOut size={17} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/80">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[258px] border-r border-slate-200/80 bg-white lg:block">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-[290px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>{sidebar}</aside></div>}
      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Buka menu"><Menu size={20} /></button><div><div className="text-xs text-slate-400">KasKita / {pageLabel}</div><div className="mt-0.5 text-sm font-bold text-slate-900">{activeOrganization?.name || 'Ruang kerja Anda'}</div></div></div>
          <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Data dari database</div><button onClick={() => navigate('/settings')} className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700" title="Profil">{getInitials(profile?.full_name ?? user?.email)}</button></div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-7 lg:p-8"><Outlet /></main>
        <footer className="px-6 pb-6 text-center text-[11px] text-slate-400">KasKita · Kelola kas dengan jelas, laporkan dengan percaya diri.</footer>
      </div>
    </div>
  );
}
