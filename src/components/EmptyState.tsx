import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './ui/button';

export function EmptyState({ title, description, actionLabel, onAction, icon }: {
  title: string; description: string; actionLabel?: string; onAction?: () => void; icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">{icon ?? <Inbox size={22} />}</div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && onAction && <Button className="mt-4" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
