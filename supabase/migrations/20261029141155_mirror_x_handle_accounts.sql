-- Handle identities use official Supabase Admin APIs. These tables hold recovery hashes, never passwords.
create table mirror_x.handle_accounts (
 handle text primary key check(handle ~ '^[a-z][a-z0-9_]{2,29}$'),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 recovery_hash text not null check(recovery_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create table mirror_x.handle_budgets (
 bucket text primary key,hits integer not null check(hits>0),updated_at timestamptz not null default now()
);
alter table mirror_x.handle_accounts enable row level security;
alter table mirror_x.handle_budgets enable row level security;
revoke all on mirror_x.handle_accounts,mirror_x.handle_budgets from public,anon,authenticated;
grant usage on schema mirror_x to service_role;
grant select,insert,update,delete on mirror_x.handle_accounts,mirror_x.handle_budgets to service_role;
create policy mx_handle_private on mirror_x.handle_accounts for all to authenticated using(false) with check(false);
create policy mx_handle_budget_private on mirror_x.handle_budgets for all to authenticated using(false) with check(false);
create function public.mx_handle_budget(p_fingerprint text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;g text:='day:'||(now() at time zone 'UTC')::date::text;i text;
begin
 if p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'MX_INVALID_FINGERPRINT';end if;
 i:='ip:'||p_fingerprint||':'||floor(extract(epoch from now())/600)::text;
 delete from mirror_x.handle_budgets where updated_at<now()-interval '2 days';
 insert into mirror_x.handle_budgets as b(bucket,hits)values(g,1)on conflict(bucket)do update set hits=b.hits+1,updated_at=now()where b.hits<1000 returning hits into n;
 if n is null then return false;end if;
 insert into mirror_x.handle_budgets as b(bucket,hits)values(i,1)on conflict(bucket)do update set hits=b.hits+1,updated_at=now()where b.hits<10 returning hits into n;
 return n is not null;
end;$$;
create function public.mx_initialize_handle(p_handle text,p_user_id uuid,p_hash text) returns void language sql security invoker set search_path='' as $$insert into mirror_x.handle_accounts(handle,user_id,recovery_hash)values(p_handle,p_user_id,p_hash);$$;
create function public.mx_exchange_handle_recovery(p_handle text,p_old_hash text,p_new_hash text) returns uuid language sql security invoker set search_path='' as $$update mirror_x.handle_accounts set recovery_hash=p_new_hash where handle=p_handle and recovery_hash=p_old_hash returning user_id;$$;
create function public.mx_rotate_handle_recovery(p_user_id uuid,p_new_hash text) returns text language sql security invoker set search_path='' as $$update mirror_x.handle_accounts set recovery_hash=p_new_hash where user_id=p_user_id returning handle;$$;
revoke all on function public.mx_handle_budget(text),public.mx_initialize_handle(text,uuid,text),public.mx_exchange_handle_recovery(text,text,text),public.mx_rotate_handle_recovery(uuid,text) from public,anon,authenticated;
grant execute on function public.mx_handle_budget(text),public.mx_initialize_handle(text,uuid,text),public.mx_exchange_handle_recovery(text,text,text),public.mx_rotate_handle_recovery(uuid,text) to service_role;
