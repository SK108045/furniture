-- Run after schema.sql. Receipts are queued atomically with payment confirmation.
begin;
create table if not exists public.nicoo_receipt_emails(
 order_id text primary key references public.nicoo_orders(id),
 user_id text not null, snapshot jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','review')),
 created_at timestamptz not null default now(),next_attempt_at timestamptz not null default now(),
 first_attempt_at timestamptz,locked_until timestamptz,lease text,
 attempts integer not null default 0,provider_id text,sent_at timestamptz,last_error text,
 message jsonb
);
alter table public.nicoo_receipt_emails enable row level security;
revoke all on public.nicoo_receipt_emails from public,anon,authenticated;
grant all on public.nicoo_receipt_emails to service_role;
create index if not exists nicoo_receipt_queue on public.nicoo_receipt_emails(next_attempt_at) where status in ('pending','sending');
create or replace function public.nicoo_queue_receipt() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.status='paid' and new.receipt is not null and coalesce(new.details->>'email','')<>'' then
  insert into nicoo_receipt_emails(order_id,user_id,snapshot) values(new.id,new.user_id,to_jsonb(new)) on conflict(order_id) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists nicoo_paid_receipt on public.nicoo_orders;
create trigger nicoo_paid_receipt after insert or update of status on public.nicoo_orders for each row execute function public.nicoo_queue_receipt();

create or replace function public.nicoo_claim_receipts(p_order_id text default null,p_user_id text default null,p_limit integer default 1)
returns setof public.nicoo_receipt_emails language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 -- Resend deduplicates only within 24h. Ambiguous older attempts need review.
 update nicoo_receipt_emails set status='review',last_error='Retry window expired. Check provider delivery logs before resending.'
 where status in ('pending','sending') and first_attempt_at<now()-interval '23 hours' and (locked_until is null or locked_until<now());
 return query
 with candidates as (
  select order_id from nicoo_receipt_emails where status in ('pending','sending')
   and next_attempt_at<=now() and (locked_until is null or locked_until<now())
   and (p_order_id is null or order_id=p_order_id) and (p_user_id is null or user_id=p_user_id)
  order by created_at for update skip locked limit greatest(1,least(p_limit,5))
 ) update nicoo_receipt_emails e set status='sending',locked_until=now()+interval '2 minutes',
  lease=gen_random_uuid()::text,first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
 from candidates c where e.order_id=c.order_id returning e.*;
end $$;
revoke all on function public.nicoo_queue_receipt(),public.nicoo_claim_receipts(text,text,integer) from public,anon,authenticated;
grant execute on function public.nicoo_queue_receipt(),public.nicoo_claim_receipts(text,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
-- Deliberately does not send emails for historical paid orders.
