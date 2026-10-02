-- Additive migration: existing catalogue files, orders and accounts stay intact.
begin;
create table if not exists public.nicoo_products (
  id integer generated always as identity (start with 10000) primary key,
  upload_key uuid not null unique,
  created_by text not null,
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (category in ('Seating','Desks','Standing desks','Workspace sets','Conference tables','Reception desks','Accessories')),
  price integer not null check (price between 1 and 150000),
  image text not null,
  created_at timestamptz not null default now()
);
alter table public.nicoo_products enable row level security;
revoke all on public.nicoo_products from anon, authenticated;
grant select, insert on public.nicoo_products to service_role;
grant usage, select on sequence public.nicoo_products_id_seq to service_role;
create index if not exists nicoo_products_created on public.nicoo_products (created_at desc, id desc);
-- Public read URLs for catalogue photos. Upload/delete are server-only; no
-- anon/authenticated storage write policy is added.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('nicoo-products','nicoo-products',true,3000000,array['image/jpeg'])
on conflict (id) do update set public=true,file_size_limit=3000000,allowed_mime_types=array['image/jpeg'];
commit;
notify pgrst, 'reload schema';
