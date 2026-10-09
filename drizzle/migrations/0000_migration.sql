
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  category text not null default 'Makanan',
  price integer not null default 0,
  cost integer not null default 0,
  stock integer not null default 0,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "menu public" on public.products for select to anon, authenticated using (active = true);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no serial,
  source text not null default 'meja',
  table_no text,
  customer_name text,
  payment_method text not null,
  status text not null default 'menunggu_pembayaran',
  total integer not null default 0,
  cost_total integer not null default 0,
  cash_received integer,
  change_amount integer,
  proof_path text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  price integer not null,
  cost integer not null,
  qty integer not null
);
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;

create table public.restocks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  qty integer not null,
  cost integer,
  created_at timestamptz not null default now()
);
grant all on public.restocks to service_role;
alter table public.restocks enable row level security;

create policy "upload bukti" on storage.objects for insert to anon, authenticated with check (bucket_id = 'bukti');

insert into public.products (name, barcode, category, price, cost, stock) values
('Nasi Goreng Spesial','8990001','Makanan',18000,9000,50),
('Mie Ayam Bakso','8990002','Makanan',16000,8000,40),
('Ayam Geprek Keju','8990003','Makanan',20000,11000,35),
('Pisang Keju Coklat','8990004','Camilan',12000,5000,30),
('Roti Bakar Keju','8990005','Camilan',14000,6000,30),
('Es Teh Manis','8990006','Minuman',5000,1500,100),
('Es Jeruk','8990007','Minuman',7000,2500,80),
('Kopi Susu Gula Aren','8990008','Minuman',15000,6000,60);
