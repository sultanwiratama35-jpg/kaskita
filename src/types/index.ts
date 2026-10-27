export type OrgRole = 'treasurer' | 'member' | 'auditor';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'posted' | 'voided';
export type ContributionStatus = 'unpaid' | 'partial' | 'paid';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_by: string;
  members_can_view_transactions: boolean;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  profile?: Partial<Profile> | null;
}

export interface TransactionCategory {
  id: string;
  organization_id: string;
  name: string;
  transaction_type: TransactionType;
  created_at: string;
}

export interface Transaction {
  id: string;
  organization_id: string;
  category_id: string | null;
  transaction_type: TransactionType;
  amount: number | string;
  description: string;
  transaction_date: string;
  receipt_url: string | null;
  created_by: string;
  status: TransactionStatus;
  source_payment_id?: string | null;
  created_at: string;
  updated_at: string;
  category?: TransactionCategory | null;
  creator?: Profile | null;
}

export interface ContributionPlan {
  id: string;
  organization_id: string;
  name: string;
  amount: number | string;
  description: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
}

export interface ContributionObligation {
  id: string;
  contribution_plan_id: string;
  organization_id: string;
  member_id: string;
  required_amount: number | string;
  status: ContributionStatus;
  created_at: string;
  plan?: ContributionPlan | null;
  profile?: Profile | null;
  payments?: ContributionPayment[];
}

export interface ContributionPayment {
  id: string;
  organization_id: string;
  obligation_id: string;
  amount: number | string;
  payment_date: string;
  recorded_by: string;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
  profile?: Profile | null;
}
