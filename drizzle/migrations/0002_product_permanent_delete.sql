-- Permanently deleting a product must not erase its historical restock records.
-- order_items.product_id already uses ON DELETE SET NULL, preserving the sale snapshot.
alter table public.restocks
  drop constraint if exists restocks_product_id_fkey;

alter table public.restocks
  add constraint restocks_product_id_fkey
  foreign key (product_id)
  references public.products(id)
  on delete set null;
