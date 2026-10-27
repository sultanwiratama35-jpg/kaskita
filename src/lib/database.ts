import { supabase } from './supabase';

/** Read all matching transaction rows in bounded pages so Supabase's API row limit does not truncate balances or reports. */
export async function fetchAllTransactions(
  organizationId: string,
  options: { select?: string; status?: string; fromDate?: string; toDate?: string; ascending?: boolean } = {},
) {
  const pageSize = 1000;
  let offset = 0;
  const rows: any[] = [];
  while (true) {
    let query = supabase.from('transactions').select(options.select ?? '*, category:transaction_categories(name)').eq('organization_id', organizationId);
    if (options.status) query = query.eq('status', options.status);
    if (options.fromDate) query = query.gte('transaction_date', options.fromDate);
    if (options.toDate) query = query.lte('transaction_date', options.toDate);
    const ascending = options.ascending ?? false;
    const { data, error } = await query.order('transaction_date', { ascending }).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export async function fetchAllContributionPlans(organizationId: string) {
  const pageSize = 1000;
  let offset = 0;
  const rows: any[] = [];
  while (true) {
    const { data, error } = await supabase.from('contribution_plans').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export async function fetchAllContributionObligations(organizationId: string, select = '*') {
  const pageSize = 1000;
  let offset = 0;
  const rows: any[] = [];
  while (true) {
    const { data, error } = await supabase.from('contribution_obligations').select(select).eq('organization_id', organizationId).order('created_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export async function fetchAllContributionPayments(organizationId: string, fromDate?: string, toDate?: string) {
  const pageSize = 1000;
  let offset = 0;
  const rows: any[] = [];
  while (true) {
    let query = supabase.from('contribution_payments').select('*').eq('organization_id', organizationId);
    if (fromDate) query = query.gte('payment_date', fromDate);
    if (toDate) query = query.lte('payment_date', toDate);
    const { data, error } = await query.order('payment_date', { ascending: false }).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}
