-- Repair POS tables and the active-table RPC.
-- This migration is idempotent and also fixes the malformed function in 0001_pos_controls.sql.
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
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.pos_tables where table_no = _table_no
    ) then exists (
      select 1 from public.pos_tables where table_no = _table_no and active = true
    )
    else _table_no ~ '^[0-9]{1,3}
  end
$$;

grant execute on function public.is_active_pos_table(text) to anon, authenticated, service_role;

-- Tell PostgREST/Supabase API to refresh its schema cache after the DDL.
notify pgrst, 'reload schema';

      and _table_no::integer between 1 and 100
  end
$$;

grant execute on function public.is_active_pos_table(text) to anon, authenticated, service_role;

-- Tell PostgREST/Supabase API to refresh its schema cache after the DDL.
notify pgrst, 'reload schema';
