-- Additive, MIRROR X only. One bounded workspace per owner; optimistic concurrency.
create table mirror_x.market_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=2000000),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table mirror_x.market_workspaces enable row level security;
revoke all on mirror_x.market_workspaces from public,anon,authenticated;
grant select,insert,update,delete on mirror_x.market_workspaces to authenticated;
create policy mx_workspace_owner on mirror_x.market_workspaces for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create view public.mx_market_workspaces with(security_invoker=true) as select * from mirror_x.market_workspaces;
revoke all on public.mx_market_workspaces from public,anon;
grant select,delete on public.mx_market_workspaces to authenticated;
create function public.mx_save_market_workspace(p_payload jsonb,p_expected integer) returns setof mirror_x.market_workspaces language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'MX_AUTH_REQUIRED';end if;
 if p_expected<0 then raise exception 'MX_BAD_REVISION';end if;
 if p_expected=0 then
  insert into mirror_x.market_workspaces(user_id,payload) values(auth.uid(),p_payload) on conflict(user_id) do nothing;
  if not found then raise exception 'MX_CONFLICT';end if;
 else
  update mirror_x.market_workspaces set payload=p_payload,revision=revision+1,updated_at=now() where user_id=auth.uid() and revision=p_expected;
  if not found then raise exception 'MX_CONFLICT';end if;
 end if;
 return query select * from mirror_x.market_workspaces where user_id=auth.uid();
end;$$;
revoke all on function public.mx_save_market_workspace(jsonb,integer) from public,anon;
grant execute on function public.mx_save_market_workspace(jsonb,integer) to authenticated;
-- Only this function can mutate AI quota. This intentional DEFINER prevents callers resetting their quota.
create table mirror_x.ai_usage(user_id uuid references auth.users(id) on delete cascade,day date not null,hits integer not null check(hits between 1 and 10),primary key(user_id,day));
alter table mirror_x.ai_usage enable row level security;
revoke all on mirror_x.ai_usage from public,anon,authenticated;
create function mirror_x.claim_ai_request() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'MX_AUTH_REQUIRED';end if;
 delete from mirror_x.ai_usage where user_id=auth.uid() and day<(now() at time zone 'UTC')::date-7;
 insert into mirror_x.ai_usage as u(user_id,day,hits) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set hits=u.hits+1 where u.hits<10 returning hits into n;
 return n is not null;
end;$$;
revoke all on function mirror_x.claim_ai_request() from public,anon;
grant execute on function mirror_x.claim_ai_request() to authenticated;
create function public.mx_claim_ai_request() returns boolean language sql security invoker set search_path='' as $$select mirror_x.claim_ai_request();$$;
revoke all on function public.mx_claim_ai_request() from public,anon;
grant execute on function public.mx_claim_ai_request() to authenticated;
