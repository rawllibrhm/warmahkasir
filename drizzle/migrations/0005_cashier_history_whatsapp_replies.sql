-- Cashier transaction history support, configurable WhatsApp target, and admin acknowledgements.
-- Safe to run repeatedly in the Supabase SQL Editor.
insert into public.app_settings (key, value)
values ('cashier_whatsapp_number', '"6285142274765"'::jsonb)
on conflict (key) do nothing;

create table if not exists public.pos_message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.pos_messages(id) on delete cascade,
  reply text not null default 'Oke' check (reply = 'Oke'),
  created_at timestamptz not null default now(),
  replied_by text
);
alter table public.pos_message_replies enable row level security;
grant all on public.pos_message_replies to service_role;

notify pgrst, 'reload schema';
