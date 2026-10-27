-- KasKita initial schema for Supabase PostgreSQL.
-- Run this migration in the Supabase SQL Editor or with `supabase db push`.

create extension if not exists pgcrypto;

do $$ begin
  create type public.org_role as enum ('treasurer', 'member', 'auditor');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transaction_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transaction_status as enum ('posted', 'voided');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contribution_status as enum ('unpaid', 'partial', 'paid');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  description text,
  logo_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  members_can_view_transactions boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_role not null default 'member',
  joined_at timestamptz not null default now(),
  constraint organization_members_org_user_unique unique (organization_id, user_id)
);

create table if not exists public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1),
  transaction_type public.transaction_type not null,
  created_at timestamptz not null default now(),
  constraint transaction_categories_org_name_type_unique unique (organization_id, name, transaction_type)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  category_id uuid references public.transaction_categories(id) on delete set null,
  transaction_type public.transaction_type not null,
  amount numeric(14,0) not null check (amount > 0),
  description text not null check (char_length(trim(description)) >= 3),
  transaction_date date not null default current_date,
  receipt_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status public.transaction_status not null default 'posted',
  source_payment_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contribution_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) >= 2),
  amount numeric(14,0) not null check (amount > 0),
  description text,
  due_date date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.contribution_obligations (
  id uuid primary key default gen_random_uuid(),
  contribution_plan_id uuid not null references public.contribution_plans(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  required_amount numeric(14,0) not null check (required_amount > 0),
  status public.contribution_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  constraint contribution_obligations_plan_member_unique unique (contribution_plan_id, member_id)
);

create table if not exists public.contribution_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  obligation_id uuid not null references public.contribution_obligations(id) on delete restrict,
  amount numeric(14,0) not null check (amount > 0),
  payment_date date not null default current_date,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.transactions
  drop constraint if exists transactions_source_payment_id_fkey;
alter table public.transactions
  add constraint transactions_source_payment_id_fkey
  foreign key (source_payment_id) references public.contribution_payments(id) on delete restrict;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.org_role not null default 'member',
  invitation_token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_members_user on public.organization_members(user_id);
create index if not exists idx_organization_members_org on public.organization_members(organization_id);
create index if not exists idx_transactions_org_date on public.transactions(organization_id, transaction_date desc);
create index if not exists idx_transactions_org_status on public.transactions(organization_id, status);
create index if not exists idx_transactions_category on public.transactions(category_id);
create index if not exists idx_contribution_plans_org on public.contribution_plans(organization_id, created_at desc);
create index if not exists idx_obligations_org_member on public.contribution_obligations(organization_id, member_id);
create index if not exists idx_obligations_plan on public.contribution_obligations(contribution_plan_id);
create index if not exists idx_contribution_payments_org_date on public.contribution_payments(organization_id, payment_date desc);
create index if not exists idx_contribution_payments_obligation on public.contribution_payments(obligation_id);
create index if not exists idx_audit_logs_org_created on public.audit_logs(organization_id, created_at desc);
create index if not exists idx_invitations_org_email on public.invitations(organization_id, lower(email));

-- Create profile records for new auth users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

insert into public.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), email from auth.users
on conflict (id) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()); $$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_org(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.role = 'treasurer'
  );
$$;

create or replace function public.can_view_transactions(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and (om.role in ('treasurer', 'auditor') or (om.role = 'member' and o.members_can_view_transactions))
  );
$$;

create or replace function public.can_view_audit(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.role in ('treasurer', 'auditor')
  );
$$;

create or replace function public.can_view_profile(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- Atomic organization creation and default categories.
create or replace function public.create_organization(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Anda harus masuk terlebih dahulu.'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'Nama organisasi minimal 2 karakter.'; end if;

  insert into public.organizations (name, description, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), auth.uid())
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, auth.uid(), 'treasurer');

  insert into public.transaction_categories (organization_id, name, transaction_type) values
    (v_organization_id, 'Iuran Anggota', 'income'),
    (v_organization_id, 'Donasi', 'income'),
    (v_organization_id, 'Penjualan', 'income'),
    (v_organization_id, 'Pemasukan Lainnya', 'income'),
    (v_organization_id, 'Operasional', 'expense'),
    (v_organization_id, 'Konsumsi', 'expense'),
    (v_organization_id, 'Transportasi', 'expense'),
    (v_organization_id, 'Perlengkapan', 'expense'),
    (v_organization_id, 'Pengeluaran Lainnya', 'expense');

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (v_organization_id, auth.uid(), 'organization_created', 'organization', v_organization_id, jsonb_build_object('name', trim(p_name)));
  return v_organization_id;
end;
$$;

create or replace function public.create_contribution_plan(
  p_organization_id uuid,
  p_name text,
  p_amount numeric,
  p_due_date date default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_plan_id uuid;
begin
  if not public.can_manage_org(p_organization_id) then raise exception 'Hanya bendahara yang dapat membuat rencana iuran.'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 then raise exception 'Nama iuran minimal 2 karakter.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal iuran harus lebih dari nol.'; end if;

  insert into public.contribution_plans (organization_id, name, amount, description, due_date, created_by)
  values (p_organization_id, trim(p_name), round(p_amount), nullif(trim(coalesce(p_description, '')), ''), p_due_date, auth.uid())
  returning id into v_plan_id;

  insert into public.contribution_obligations (contribution_plan_id, organization_id, member_id, required_amount)
  select v_plan_id, p_organization_id, om.user_id, round(p_amount)
  from public.organization_members om
  where om.organization_id = p_organization_id
  on conflict (contribution_plan_id, member_id) do nothing;

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (p_organization_id, auth.uid(), 'contribution_plan_created', 'contribution_plan', v_plan_id,
          jsonb_build_object('name', trim(p_name), 'amount', round(p_amount), 'due_date', p_due_date));
  return v_plan_id;
end;
$$;

create or replace function public.record_contribution_payment(
  p_obligation_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_obligation public.contribution_obligations%rowtype; v_paid numeric; v_payment_id uuid;
begin
  if auth.uid() is null then raise exception 'Anda harus masuk terlebih dahulu.'; end if;
  select * into v_obligation from public.contribution_obligations where id = p_obligation_id for update;
  if not found then raise exception 'Tagihan iuran tidak ditemukan.'; end if;
  if not public.can_manage_org(v_obligation.organization_id) then raise exception 'Hanya bendahara yang dapat mencatat pembayaran.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal pembayaran harus lebih dari nol.'; end if;
  select coalesce(sum(cp.amount), 0) into v_paid from public.contribution_payments cp where cp.obligation_id = p_obligation_id;
  if round(p_amount) > v_obligation.required_amount - v_paid then raise exception 'Nominal pembayaran melebihi sisa tagihan.'; end if;

  insert into public.contribution_payments (organization_id, obligation_id, amount, payment_date, recorded_by, notes)
  values (v_obligation.organization_id, p_obligation_id, round(p_amount), coalesce(p_payment_date, current_date), auth.uid(), nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_payment_id;
  return v_payment_id;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_invitation public.invitations%rowtype; v_email text;
begin
  if auth.uid() is null then raise exception 'Masuk atau daftar sebelum menerima undangan.'; end if;
  if p_token is null or length(trim(p_token)) < 20 then raise exception 'Token undangan tidak valid.'; end if;
  select * into v_invitation from public.invitations where invitation_token = p_token for update;
  if not found then raise exception 'Undangan tidak ditemukan.'; end if;
  if v_invitation.accepted_at is not null then raise exception 'Undangan ini sudah digunakan.'; end if;
  if v_invitation.expires_at <= now() then raise exception 'Undangan telah kedaluwarsa.'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email is null or v_email <> lower(v_invitation.email) then raise exception 'Email akun harus sama dengan email yang diundang.'; end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_invitation.organization_id, auth.uid(), v_invitation.role)
  on conflict (organization_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = v_invitation.id;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (v_invitation.organization_id, auth.uid(), 'invitation_accepted', 'invitation', v_invitation.id, jsonb_build_object('email', v_invitation.email, 'role', v_invitation.role));
  return v_invitation.organization_id;
end;
$$;

-- A received contribution payment creates exactly one income transaction.
create or replace function public.handle_contribution_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_plan_name text; v_category_id uuid; v_paid numeric; v_required numeric;
begin
  select cp.name into v_plan_name
  from public.contribution_obligations co
  join public.contribution_plans cp on cp.id = co.contribution_plan_id
  where co.id = new.obligation_id;

  insert into public.transaction_categories (organization_id, name, transaction_type)
  values (new.organization_id, 'Iuran Anggota', 'income')
  on conflict (organization_id, name, transaction_type) do update set name = excluded.name
  returning id into v_category_id;

  insert into public.transactions (organization_id, category_id, transaction_type, amount, description, transaction_date, created_by, status, source_payment_id)
  values (new.organization_id, v_category_id, 'income', new.amount, 'Pembayaran iuran: ' || coalesce(v_plan_name, 'Iuran anggota'), new.payment_date, new.recorded_by, 'posted', new.id);

  select coalesce(sum(amount), 0) into v_paid from public.contribution_payments where obligation_id = new.obligation_id;
  select required_amount into v_required from public.contribution_obligations where id = new.obligation_id;
  update public.contribution_obligations
  set status = case when v_paid >= v_required then 'paid'::public.contribution_status when v_paid > 0 then 'partial'::public.contribution_status else 'unpaid'::public.contribution_status end
  where id = new.obligation_id;

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (new.organization_id, new.recorded_by, 'contribution_payment_recorded', 'contribution_payment', new.id,
          jsonb_build_object('obligation_id', new.obligation_id, 'amount', new.amount, 'payment_date', new.payment_date));
  return new;
end;
$$;

drop trigger if exists contribution_payment_after_insert on public.contribution_payments;
create trigger contribution_payment_after_insert
after insert on public.contribution_payments
for each row execute procedure public.handle_contribution_payment_insert();

create or replace function public.protect_transaction_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.organization_id <> old.organization_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Identitas dan pembuat transaksi tidak dapat diubah.';
  end if;
  if new.source_payment_id is distinct from old.source_payment_id then raise exception 'Relasi pembayaran otomatis tidak dapat diubah.'; end if;
  if old.source_payment_id is not null then raise exception 'Transaksi pembayaran iuran dikelola otomatis dan tidak dapat diedit atau dibatalkan langsung.'; end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protect_transaction_update_trigger on public.transactions;
create trigger protect_transaction_update_trigger
before update on public.transactions
for each row execute procedure public.protect_transaction_update();


create or replace function public.validate_transaction_tenant_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_category_org uuid; v_payment_org uuid; v_payment_amount numeric;
begin
  if new.category_id is not null then
    select organization_id into v_category_org from public.transaction_categories where id = new.category_id;
    if v_category_org is null or v_category_org <> new.organization_id then
      raise exception 'Kategori transaksi harus berasal dari organisasi yang sama.';
    end if;
  end if;
  if new.receipt_url is not null and split_part(new.receipt_url, '/', 1) <> new.organization_id::text then
    raise exception 'Bukti transaksi harus berasal dari folder organisasi yang sama.';
  end if;
  if new.source_payment_id is not null then
    select organization_id, amount into v_payment_org, v_payment_amount from public.contribution_payments where id = new.source_payment_id;
    if v_payment_org is null or v_payment_org <> new.organization_id or v_payment_amount <> new.amount or new.transaction_type <> 'income' then
      raise exception 'Transaksi pembayaran iuran tidak sesuai dengan catatan pembayaran.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_transaction_tenant_fields_trigger on public.transactions;
create trigger validate_transaction_tenant_fields_trigger
before insert or update on public.transactions
for each row execute procedure public.validate_transaction_tenant_fields();

create or replace function public.protect_membership_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.organization_id <> old.organization_id or new.user_id <> old.user_id or new.joined_at <> old.joined_at then
    raise exception 'Identitas anggota tidak dapat dipindahkan atau diubah.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_membership_identity_trigger on public.organization_members;
create trigger protect_membership_identity_trigger
before update on public.organization_members
for each row execute procedure public.protect_membership_identity();


create or replace function public.protect_category_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.organization_id <> old.organization_id or new.transaction_type <> old.transaction_type or new.created_at <> old.created_at then
    raise exception 'Identitas kategori tidak dapat diubah; ubah nama kategori saja.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_category_identity_trigger on public.transaction_categories;
create trigger protect_category_identity_trigger
before update on public.transaction_categories
for each row execute procedure public.protect_category_identity();

create or replace function public.protect_organization_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.created_by <> old.created_by or new.created_at <> old.created_at then raise exception 'Identitas dan pembuat organisasi tidak dapat diubah.'; end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_creator_trigger on public.organizations;
create trigger protect_organization_creator_trigger
before update on public.organizations
for each row execute procedure public.protect_organization_creator();

create or replace function public.log_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_action text; v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'transaction_created';
    v_changes := jsonb_build_object('type', new.transaction_type, 'amount', new.amount, 'description', new.description, 'status', new.status);
    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
    values (new.organization_id, new.created_by, v_action, 'transaction', new.id, v_changes);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status <> new.status and new.status = 'voided' then v_action := 'transaction_voided'; else v_action := 'transaction_updated'; end if;
    v_changes := jsonb_build_object(
      'before', jsonb_build_object('type', old.transaction_type, 'amount', old.amount, 'description', old.description, 'date', old.transaction_date, 'status', old.status),
      'after', jsonb_build_object('type', new.transaction_type, 'amount', new.amount, 'description', new.description, 'date', new.transaction_date, 'status', new.status)
    );
    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
    values (new.organization_id, auth.uid(), v_action, 'transaction', new.id, v_changes);
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists transaction_audit_trigger on public.transactions;
create trigger transaction_audit_trigger
after insert or update on public.transactions
for each row execute procedure public.log_transaction_change();

create or replace function public.log_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_org_id uuid; v_user_id uuid; v_member_id uuid; v_action text; v_changes jsonb;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.organization_id; v_user_id := old.user_id; v_member_id := old.id; v_action := 'member_removed';
    v_changes := jsonb_build_object('user_id', old.user_id, 'role', old.role);
  elsif tg_op = 'UPDATE' then
    v_org_id := new.organization_id; v_user_id := new.user_id; v_member_id := new.id; v_action := 'member_role_changed';
    v_changes := jsonb_build_object('user_id', new.user_id, 'before_role', old.role, 'after_role', new.role);
  else
    v_org_id := new.organization_id; v_user_id := new.user_id; v_member_id := new.id; v_action := 'member_added';
    v_changes := jsonb_build_object('user_id', new.user_id, 'role', new.role);
  end if;
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (v_org_id, coalesce(auth.uid(), v_user_id), v_action, 'organization_member', v_member_id, v_changes);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists organization_member_audit_trigger on public.organization_members;
create trigger organization_member_audit_trigger
after insert or update or delete on public.organization_members
for each row execute procedure public.log_membership_change();


create or replace function public.assign_existing_plans_to_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.contribution_obligations (contribution_plan_id, organization_id, member_id, required_amount)
  select cp.id, cp.organization_id, new.user_id, cp.amount
  from public.contribution_plans cp
  where cp.organization_id = new.organization_id
  on conflict (contribution_plan_id, member_id) do nothing;
  return new;
end;
$$;

drop trigger if exists assign_existing_plans_to_new_member_trigger on public.organization_members;
create trigger assign_existing_plans_to_new_member_trigger
after insert on public.organization_members
for each row execute procedure public.assign_existing_plans_to_new_member();

create or replace function public.log_organization_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (new.id, auth.uid(), 'organization_updated', 'organization', new.id,
    jsonb_build_object('before', jsonb_build_object('name', old.name, 'description', old.description, 'members_can_view_transactions', old.members_can_view_transactions),
                       'after', jsonb_build_object('name', new.name, 'description', new.description, 'members_can_view_transactions', new.members_can_view_transactions)));
  return new;
end;
$$;

drop trigger if exists organization_update_audit_trigger on public.organizations;
create trigger organization_update_audit_trigger
after update on public.organizations
for each row execute procedure public.log_organization_update();

create or replace function public.log_invitation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
  values (new.organization_id, new.invited_by, 'invitation_created', 'invitation', new.id,
          jsonb_build_object('email', new.email, 'role', new.role, 'expires_at', new.expires_at));
  return new;
end;
$$;

drop trigger if exists invitation_created_audit_trigger on public.invitations;
create trigger invitation_created_audit_trigger
after insert on public.invitations
for each row execute procedure public.log_invitation_created();

-- RLS: tenant-level isolation and role-based authorization.
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.transactions enable row level security;
alter table public.contribution_plans enable row level security;
alter table public.contribution_obligations enable row level security;
alter table public.contribution_payments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.invitations enable row level security;

-- profiles
 drop policy if exists profiles_select_own_or_shared on public.profiles;
create policy profiles_select_own_or_shared on public.profiles for select to authenticated
using (id = auth.uid() or public.can_view_profile(id));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- platform_admins has no client-facing policies. Add trusted admins manually through SQL.

-- organizations
 drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations for select to authenticated
using (public.is_org_member(id));
drop policy if exists organizations_update_manager on public.organizations;
create policy organizations_update_manager on public.organizations for update to authenticated
using (public.can_manage_org(id)) with check (public.can_manage_org(id));

-- organization members
 drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_select_member on public.organization_members for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists organization_members_update_manager on public.organization_members;
create policy organization_members_update_manager on public.organization_members for update to authenticated
using (public.can_manage_org(organization_id) and user_id <> auth.uid())
with check (public.can_manage_org(organization_id) and user_id <> auth.uid());
drop policy if exists organization_members_delete_manager on public.organization_members;
create policy organization_members_delete_manager on public.organization_members for delete to authenticated
using (public.can_manage_org(organization_id) and user_id <> auth.uid());

-- categories
 drop policy if exists categories_select_member on public.transaction_categories;
create policy categories_select_member on public.transaction_categories for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists categories_manage_manager on public.transaction_categories;
create policy categories_manage_manager on public.transaction_categories for all to authenticated
using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));

-- transactions: no delete policy; use voiding to preserve audit trail.
drop policy if exists transactions_select_allowed on public.transactions;
create policy transactions_select_allowed on public.transactions for select to authenticated
using (public.can_view_transactions(organization_id));
drop policy if exists transactions_insert_manager on public.transactions;
create policy transactions_insert_manager on public.transactions for insert to authenticated
with check (public.can_manage_org(organization_id) and created_by = auth.uid());
drop policy if exists transactions_update_manager on public.transactions;
create policy transactions_update_manager on public.transactions for update to authenticated
using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));

-- contribution plans
 drop policy if exists contribution_plans_select_member on public.contribution_plans;
create policy contribution_plans_select_member on public.contribution_plans for select to authenticated
using (public.is_org_member(organization_id));

-- obligations: members see only their own; managers see the full register.
drop policy if exists obligations_select_owner_or_manager on public.contribution_obligations;
create policy obligations_select_owner_or_manager on public.contribution_obligations for select to authenticated
using (public.can_manage_org(organization_id) or public.can_view_audit(organization_id) or member_id = auth.uid() or public.is_platform_admin());

-- payments: no direct insert/update/delete; the validated RPC records payment atomically.
drop policy if exists payments_select_owner_or_manager on public.contribution_payments;
create policy payments_select_owner_or_manager on public.contribution_payments for select to authenticated
using (public.can_manage_org(organization_id) or public.can_view_audit(organization_id) or exists (
  select 1 from public.contribution_obligations co where co.id = obligation_id and co.member_id = auth.uid()
));

-- audit logs: read-only for bendahara and auditor.
drop policy if exists audit_logs_select_auditor_manager on public.audit_logs;
create policy audit_logs_select_auditor_manager on public.audit_logs for select to authenticated
using (public.can_view_audit(organization_id));

-- invitations: managers can create and view invitations; acceptance is handled by a security-definer RPC.
drop policy if exists invitations_select_manager on public.invitations;
create policy invitations_select_manager on public.invitations for select to authenticated
using (public.can_manage_org(organization_id));
drop policy if exists invitations_insert_manager on public.invitations;
create policy invitations_insert_manager on public.invitations for insert to authenticated
with check (public.can_manage_org(organization_id) and invited_by = auth.uid());

-- Private receipt bucket. Uploads are limited to 10 MB and common image/PDF types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists receipts_select_org on storage.objects;
create policy receipts_select_org on storage.objects for select to authenticated
using (bucket_id = 'receipts' and exists (
  select 1 from public.organizations o
  where o.id::text = (storage.foldername(name))[1] and public.can_view_transactions(o.id)
));
drop policy if exists receipts_insert_treasurer on storage.objects;
create policy receipts_insert_treasurer on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and (storage.foldername(name))[2] = auth.uid()::text and exists (
  select 1 from public.organizations o
  where o.id::text = (storage.foldername(name))[1] and public.can_manage_org(o.id)
));
drop policy if exists receipts_delete_treasurer on storage.objects;
create policy receipts_delete_treasurer on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and exists (
  select 1 from public.organizations o
  where o.id::text = (storage.foldername(name))[1] and public.can_manage_org(o.id)
));

-- Explicit table grants; RLS remains the authoritative row-level permission layer.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.transaction_categories to authenticated;
grant select, insert, update on public.transactions to authenticated;
grant select on public.contribution_plans to authenticated;
grant select on public.contribution_obligations to authenticated;
grant select on public.contribution_payments to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.invitations to authenticated;

-- Lock down RPC execution to authenticated users where appropriate.
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;
revoke all on function public.create_contribution_plan(uuid, text, numeric, date, text) from public;
grant execute on function public.create_contribution_plan(uuid, text, numeric, date, text) to authenticated;
revoke all on function public.record_contribution_payment(uuid, numeric, date, text) from public;
grant execute on function public.record_contribution_payment(uuid, numeric, date, text) to authenticated;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- Important: platform administrators are not assigned from the client. To promote a trusted admin:
-- insert into public.platform_admins(user_id) values ('<auth.users UUID>');
