-- Run once in the Supabase SQL Editor for the /visit enquiry form.
begin;
create table if not exists public.nicoo_enquiries(
  id text primary key,
  name text not null,
  phone text not null,
  email text,
  topic text not null,
  product_id integer,
  product_name text,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists nicoo_enquiries_created_at on public.nicoo_enquiries(created_at desc);
alter table public.nicoo_enquiries enable row level security;
revoke all on public.nicoo_enquiries from public,anon,authenticated;
grant all on public.nicoo_enquiries to service_role;
notify pgrst,'reload schema';
commit;
