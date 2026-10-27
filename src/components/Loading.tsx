import { LoaderCircle } from 'lucide-react';
export function Loading({ label = 'Memuat data...' }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} />{label}</div>;
}
