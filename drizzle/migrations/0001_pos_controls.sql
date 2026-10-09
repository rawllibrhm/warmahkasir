-- POS configuration and table registry. Existing product/order data is preserved.
alter type public.app_role add value if not exists 'super_admin';
alter type public.app_role add value if not exists 'kasir';

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
grant all on public.app_settings to service_role;

insert into public.app_settings (key, value)
values ('cashier_can_add_products', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists public.pos_tables (
  table_no text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.pos_tables enable row level security;
grant all on public.pos_tables to service_role;

insert into public.pos_tables (table_no)
select n::text from generate_series(1, 10) as n
on conflict (table_no) do nothing;

-- Keep a deleted table number unavailable for new public orders.
create or replace function public.is_active_pos_table(_table_no text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pos_tables
    where table_no = _table_no and active = true
  )
$$;
grant execute on function public.is_active_pos_table(text) to anon, authenticated, service_role;
