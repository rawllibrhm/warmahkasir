-- Repair POS schema and add cashier messaging/customer feedback.
-- Safe to run more than once. Run this file in the Supabase SQL Editor for the
-- exact project used by the deployed app.
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

create or replace function public.is_active_pos_table(_table_no text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.pos_tables where table_no = _table_no)
      then exists (select 1 from public.pos_tables where table_no = _table_no and active = true)
    when _table_no ~ '^[0-9]{1,3}$' then _table_no::integer between 1 and 100
    else false
  end
$$;
grant execute on function public.is_active_pos_table(text) to anon, authenticated, service_role;

create table if not exists public.pos_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by text,
  active boolean not null default true
);
alter table public.pos_messages enable row level security;
grant all on public.pos_messages to service_role;

create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  table_no text not null,
  customer_name text,
  kind text not null check (kind in ('kritik','saran')),
  message text not null check (char_length(message) between 3 and 1000),
  created_at timestamptz not null default now(),
  status text not null default 'baru'
);
alter table public.customer_feedback enable row level security;
grant all on public.customer_feedback to service_role;

insert into public.user_roles (user_id, role)
select id, 'super_admin'::public.app_role
from auth.users where lower(email) = 'warmah@kediri.com'
on conflict (user_id, role) do nothing;

notify pgrst, 'reload schema';
