-- Run once in the Supabase SQL Editor for the private owner price-capture page.
begin;
create table if not exists public.nicoo_owner_prices(
  product_id integer primary key,
  product_name text not null,
  price integer not null check(price>0 and price<=5000000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nicoo_owner_prices enable row level security;
revoke all on public.nicoo_owner_prices from public,anon,authenticated;
grant all on public.nicoo_owner_prices to service_role;
notify pgrst,'reload schema';
commit;
