create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  old_stock integer not null,
  new_stock integer not null,
  note text,
  created_by text not null default 'kasir',
  created_at timestamptz not null default now()
);
grant all on public.stock_adjustments to service_role;
alter table public.stock_adjustments enable row level security;