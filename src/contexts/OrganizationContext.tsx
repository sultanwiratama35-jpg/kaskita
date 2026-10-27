import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Organization, OrgRole } from '../types';

interface OrganizationWithRole { organization: Organization; role: OrgRole; membership_id: string; }
interface OrganizationContextValue {
  organizations: OrganizationWithRole[];
  activeOrganization: Organization | null;
  activeRole: OrgRole | null;
  canManage: boolean;
  loading: boolean;
  switchOrganization: (organizationId: string) => void;
  reloadOrganizations: () => Promise<void>;
}
const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);
const STORAGE_KEY = 'kaskita-active-organization';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(true);

  const reloadOrganizations = useCallback(async () => {
    if (!user || !isSupabaseConfigured) { setOrganizations([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, organization_id, role, organizations(id,name,description,logo_url,created_by,members_can_view_transactions,created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });
    if (error) {
      console.error('Gagal memuat organisasi:', error.message);
      setOrganizations([]);
    } else {
      const mapped = (data ?? []).flatMap((item: any) => item.organizations ? [{
        organization: item.organizations as Organization,
        role: item.role as OrgRole,
        membership_id: item.id as string,
      }] : []);
      setOrganizations(mapped);
      const stillExists = mapped.some((item) => item.organization.id === activeId);
      if (!stillExists && mapped[0]) setActiveId(mapped[0].organization.id);
      if (!mapped.length) setActiveId('');
    }
    setLoading(false);
  }, [user?.id, activeId]);

  useEffect(() => { void reloadOrganizations(); }, [reloadOrganizations]);
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(STORAGE_KEY, activeId);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* browser storage is optional */ }
  }, [activeId]);

  const active = organizations.find((item) => item.organization.id === activeId) ?? organizations[0] ?? null;
  const value = useMemo(() => ({
    organizations,
    activeOrganization: active?.organization ?? null,
    activeRole: active?.role ?? null,
    canManage: active?.role === 'treasurer',
    loading,
    switchOrganization: (organizationId: string) => setActiveId(organizationId),
    reloadOrganizations,
  }), [organizations, active, loading, reloadOrganizations]);
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization harus digunakan di dalam OrganizationProvider');
  return context;
}
