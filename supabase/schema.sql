-- Run this entire file in the Supabase SQL Editor. Safe to run again.
begin;
create table if not exists public.nicoo_orders (
 id text primary key, user_id text not null, idempotency_key text not null,
 fingerprint text not null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 status text not null check(status in ('draft','cancelled','requesting','pending','uncertain','failed','paid')),
 total integer not null check(total>0), details jsonb not null,
 provider_id text unique, receipt text unique, payment_note text,
 version integer not null default 1, unique(user_id,idempotency_key)
);
create index if not exists nicoo_orders_user_date on public.nicoo_orders(user_id,created_at desc);
create table if not exists public.nicoo_profiles(user_id text primary key,details jsonb not null);
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
create table if not exists public.nicoo_owner_prices(
 product_id integer primary key,
 product_name text not null,
 price integer not null check(price>0 and price<=5000000),
 submitted_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.nicoo_payment_callbacks(
 id text primary key,provider_id text not null,reference text not null,payload jsonb not null,
 received_at timestamptz not null default now(),applied boolean not null default false
);
create index if not exists nicoo_callbacks_provider on public.nicoo_payment_callbacks(provider_id) where not applied;
create index if not exists nicoo_callbacks_reference on public.nicoo_payment_callbacks(reference) where not applied;
create table if not exists public.nicoo_checkout_attempts(
 user_id text not null, attempt_key text not null, fingerprint text not null,
 order_id text not null references public.nicoo_orders(id), primary key(user_id,attempt_key)
);
alter table public.nicoo_orders enable row level security;
alter table public.nicoo_profiles enable row level security;
alter table public.nicoo_enquiries enable row level security;
alter table public.nicoo_owner_prices enable row level security;
alter table public.nicoo_payment_callbacks enable row level security;
alter table public.nicoo_checkout_attempts enable row level security;
revoke all on public.nicoo_orders,public.nicoo_profiles,public.nicoo_owner_prices,public.nicoo_enquiries,public.nicoo_payment_callbacks,public.nicoo_checkout_attempts from public,anon,authenticated;
grant all on public.nicoo_orders,public.nicoo_profiles,public.nicoo_owner_prices,public.nicoo_enquiries,public.nicoo_payment_callbacks,public.nicoo_checkout_attempts to service_role;

create or replace function public.nicoo_mutate_order(p_action text,p_user_id text,p_id text,p_version integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r nicoo_orders; existing nicoo_orders; attempt nicoo_checkout_attempts;
begin
 perform pg_advisory_xact_lock(hashtextextended('nicoo-user:'||p_user_id,0));
 if p_action='create' then
  select * into attempt from nicoo_checkout_attempts where user_id=p_user_id and attempt_key=p_data->>'key';
  if found then
   if attempt.fingerprint<>p_data->>'fingerprint' then raise sqlstate 'PT409' using message='This checkout attempt already exists.'; end if;
   select * into r from nicoo_orders where id=attempt.order_id;
   return jsonb_build_object('row',to_jsonb(r),'created',false);
  end if;
  select * into r from nicoo_orders where user_id=p_user_id and idempotency_key=p_data->>'key';
  if found then
   if r.fingerprint<>p_data->>'fingerprint' then raise sqlstate 'PT409' using message='This checkout attempt already exists.'; end if;
   return jsonb_build_object('row',to_jsonb(r),'created',false);
  end if;
  if p_data->>'status'='requesting' then
   select * into r from nicoo_orders where user_id=p_user_id and fingerprint=p_data->>'fingerprint' and status in ('requesting','pending','uncertain') and created_at>now()-interval '2 minutes' order by created_at desc limit 1;
   if found then
    insert into nicoo_checkout_attempts values(p_user_id,p_data->>'key',p_data->>'fingerprint',r.id);
    return jsonb_build_object('row',to_jsonb(r),'created',false);
   end if;
   if (select count(*) from nicoo_orders where user_id=p_user_id and status not in ('draft','cancelled') and created_at>now()-interval '10 minutes')>=5 then raise sqlstate 'PT429' using message='Please wait ten minutes before another payment attempt.'; end if;
  elsif p_data->>'status'<>'draft' then raise sqlstate 'PT400' using message='Invalid initial order status.';
  end if;
  if p_data->>'status'='draft' and (select count(*) from nicoo_orders where user_id=p_user_id and status='draft')>=20 then raise sqlstate 'PT409' using message='Finish or cancel one of your 20 drafts first.'; end if;
  insert into nicoo_orders(id,user_id,idempotency_key,fingerprint,status,total,details) values(p_id,p_user_id,p_data->>'key',p_data->>'fingerprint',p_data->>'status',(p_data->>'total')::integer,p_data->'details') returning * into r;
  return jsonb_build_object('row',to_jsonb(r),'created',true);
 end if;
 select * into r from nicoo_orders where id=p_id and user_id=p_user_id for update;
 if not found then raise sqlstate 'PT404' using message='Order not found.'; end if;
 if p_action='pay' and r.status in ('requesting','pending','uncertain','paid','failed') then return jsonb_build_object('row',to_jsonb(r),'claimed',false); end if;
 if p_version is distinct from r.version then raise sqlstate 'PT409' using message='This order changed. Refresh your orders before editing again.'; end if;
 if p_action='copy' then
  if r.status not in ('paid','failed','cancelled') then raise sqlstate 'PT409' using message='Wait for the payment result before creating a revised order.'; end if;
  select * into existing from nicoo_orders where user_id=p_user_id and status='draft' and details->>'sourceOrderId'=p_id limit 1;
  if found then return jsonb_build_object('row',to_jsonb(existing)); end if;
  if (select count(*) from nicoo_orders where user_id=p_user_id and status='draft')>=20 then raise sqlstate 'PT409' using message='Finish or cancel one of your 20 drafts first.'; end if;
  insert into nicoo_orders(id,user_id,idempotency_key,fingerprint,status,total,details) values(p_data->>'id',p_user_id,p_data->>'key','draft','draft',(p_data->>'total')::integer,p_data->'details') returning * into r;
 elsif p_action='edit' then
  if r.status='cancelled' then raise sqlstate 'PT409' using message='This draft has been cancelled.'; end if;
  update nicoo_orders set details=p_data->'details',total=(p_data->>'total')::integer,updated_at=now(),version=version+1 where id=p_id returning * into r;
 elsif p_action in ('pay','cancel') then
  if r.status<>'draft' then raise sqlstate 'PT409' using message='Only an unpaid draft supports this action.'; end if;
  if p_action='pay' and (select count(*) from nicoo_orders where user_id=p_user_id and status not in ('draft','cancelled') and updated_at>now()-interval '10 minutes')>=5 then raise sqlstate 'PT429' using message='Please wait ten minutes before another payment attempt.'; end if;
  update nicoo_orders set details=p_data->'details',status=case when p_action='pay' then 'requesting' else 'cancelled' end,updated_at=now(),version=version+1 where id=p_id returning * into r;
 else raise sqlstate 'PT400' using message='Invalid order action.';
 end if;
 return jsonb_build_object('row',to_jsonb(r),'claimed',p_action='pay');
end $$;

create or replace function public.nicoo_apply_callbacks(p_provider_id text,p_reference text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare r nicoo_orders; e nicoo_payment_callbacks; succeeded boolean;
begin
 -- Shared payment lock also covers callbacks arriving before the STK response.
 perform pg_advisory_xact_lock(hashtextextended('nicoo-payments',0));
 select * into r from nicoo_orders where (provider_id=p_provider_id and p_provider_id<>'') or (id=p_reference and p_reference<>'') order by id limit 1 for update;
 if not found or r.status in ('draft','cancelled') then return; end if;
 for e in select * from nicoo_payment_callbacks where not applied and ((provider_id=r.provider_id and provider_id<>'') or reference=r.id) order by received_at,id for update loop
  if coalesce(e.payload->>'reference','')<>'' and e.payload->>'reference'<>r.id then continue; end if;
  if coalesce(e.payload->>'providerId','')<>'' and r.provider_id is not null and e.payload->>'providerId'<>r.provider_id then continue; end if;
  succeeded=(e.payload->>'code')::integer=0;
  if succeeded and ((e.payload->>'amount')::integer<>r.total or e.payload->>'phone' is distinct from coalesce(r.details->>'paymentPhone',r.details->'customer'->>'phone')) then continue; end if;
  update nicoo_orders set status=case when succeeded then 'paid' else 'failed' end,
   receipt=case when succeeded then e.payload->>'receipt' else null end,
   payment_note=case when succeeded then 'Your M-Pesa payment is confirmed. Thank you! Contact the shop to arrange delivery or pickup.' else 'The M-Pesa payment was not completed. You can create a revised draft and try again.' end,
   updated_at=now(),version=version+1 where id=r.id and status<>'paid';
  update nicoo_payment_callbacks set applied=true where id=e.id;
 end loop;
end $$;

create or replace function public.nicoo_receive_callback(p_id text,p_payload jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('nicoo-payments',0));
 insert into nicoo_payment_callbacks(id,provider_id,reference,payload) values(p_id,p_payload->>'providerId',p_payload->>'reference',p_payload) on conflict(id) do nothing;
 perform nicoo_apply_callbacks(p_payload->>'providerId',p_payload->>'reference');
end $$;

create or replace function public.nicoo_payment_result(p_id text,p_status text,p_provider_id text,p_note text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('nicoo-payments',0));
 if p_status not in ('pending','uncertain','failed') then raise sqlstate 'PT400' using message='Invalid payment response.'; end if;
 update nicoo_orders set provider_id=coalesce(provider_id,nullif(p_provider_id,'')) where id=p_id;
 update nicoo_orders set status=p_status,payment_note=p_note,updated_at=now(),version=version+1 where id=p_id and status='requesting';
 perform nicoo_apply_callbacks(coalesce(p_provider_id,''),p_id);
end $$;

create or replace function public.nicoo_reconcile_order(p_id text,p_status text,p_receipt text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_status not in ('paid','failed') or (p_status='paid' and (p_receipt is null or p_receipt !~ '^[A-Z0-9]{8,30}$')) then raise sqlstate 'PT400' using message='Invalid reconciliation.'; end if;
 update nicoo_orders set status=p_status,receipt=case when p_status='paid' then p_receipt else null end,payment_note=case when p_status='paid' then 'Your payment has been confirmed by the shop.' else 'The shop confirmed this payment was not completed.' end,updated_at=now(),version=version+1 where id=p_id and status not in ('paid','draft','cancelled');
 if not found then raise sqlstate 'PT409' using message='Order missing, already paid, or has no payment to reconcile.'; end if;
end $$;
revoke all on function public.nicoo_mutate_order(text,text,text,integer,jsonb),public.nicoo_apply_callbacks(text,text),public.nicoo_receive_callback(text,jsonb),public.nicoo_payment_result(text,text,text,text),public.nicoo_reconcile_order(text,text,text) from public,anon,authenticated;
grant execute on function public.nicoo_mutate_order(text,text,text,integer,jsonb),public.nicoo_apply_callbacks(text,text),public.nicoo_receive_callback(text,jsonb),public.nicoo_payment_result(text,text,text,text),public.nicoo_reconcile_order(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
