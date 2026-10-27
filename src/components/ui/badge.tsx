import * as React from 'react';
import { cn } from '../../lib/utils';

const styles: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  primary: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
};
export function Badge({ className, tone = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof styles }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', styles[tone], className)} {...props} />;
}
