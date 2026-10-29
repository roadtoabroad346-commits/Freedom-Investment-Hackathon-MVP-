create schema if not exists mirror_x;
revoke all on schema mirror_x from public;
grant usage on schema mirror_x to anon, authenticated;

create table mirror_x.instruments (
 ticker text primary key check(ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,11}$'),
 name text not null, sector text not null, payload jsonb not null,
 price numeric, price_asof date, market_cap numeric, pe numeric, ebitda numeric,
 positive_pe numeric generated always as (case when pe>0 then pe else null end) stored,
 score integer check(score between 0 and 100), score_details jsonb not null,
 updated_at timestamptz not null default now()
);
create index mx_instruments_sector_ticker_idx on mirror_x.instruments(sector,ticker);
create index mx_instruments_score_idx on mirror_x.instruments(score desc nulls last,ticker);
create table mirror_x.annual_facts (
 ticker text primary key references mirror_x.instruments(ticker),
 payload jsonb not null, period_end date not null, filed_at date not null,
 check(filed_at>=period_end)
);
create table mirror_x.snapshots (
 id text primary key, payload jsonb not null, published boolean not null default false,
 created_at timestamptz not null default now()
);
create table mirror_x.research (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 ticker text not null references mirror_x.instruments(ticker),
 note text not null default '' check(char_length(note)<=6000),
 assumptions jsonb check(assumptions is null or (jsonb_typeof(assumptions)='object' and octet_length(assumptions::text)<=16000)),
 is_watchlisted boolean not null default true,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,ticker)
);
create index mx_research_owner_updated_idx on mirror_x.research(user_id,updated_at desc);
create table mirror_x.pilot_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check(char_length(message) between 10 and 6000),
 created_at timestamptz not null default now()
);
alter table mirror_x.instruments enable row level security;
alter table mirror_x.annual_facts enable row level security;
alter table mirror_x.snapshots enable row level security;
alter table mirror_x.research enable row level security;
alter table mirror_x.pilot_requests enable row level security;
revoke all on all tables in schema mirror_x from public,anon,authenticated;
grant select on mirror_x.instruments,mirror_x.annual_facts,mirror_x.snapshots to anon,authenticated;
grant select,insert,update,delete on mirror_x.research to authenticated;
grant select,insert on mirror_x.pilot_requests to authenticated;
create policy mx_public_instruments on mirror_x.instruments for select to anon,authenticated using(true);
create policy mx_public_facts on mirror_x.annual_facts for select to anon,authenticated using(true);
create policy mx_published_snapshots on mirror_x.snapshots for select to anon,authenticated using(published);
create policy mx_research_read on mirror_x.research for select to authenticated using((select auth.uid())=user_id);
create policy mx_research_insert on mirror_x.research for insert to authenticated with check((select auth.uid())=user_id);
create policy mx_research_update on mirror_x.research for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy mx_research_delete on mirror_x.research for delete to authenticated using((select auth.uid())=user_id);
create policy mx_pilot_read on mirror_x.pilot_requests for select to authenticated using((select auth.uid())=user_id);
create policy mx_pilot_insert on mirror_x.pilot_requests for insert to authenticated with check((select auth.uid())=user_id);

-- API views use the caller's privileges and RLS, not view-owner privileges.
-- Existing application tables, Auth configuration and API exposed schemas are untouched.
create view public.mx_instruments with(security_invoker=true) as select * from mirror_x.instruments;
create view public.mx_annual_facts with(security_invoker=true) as select * from mirror_x.annual_facts;
create view public.mx_snapshots with(security_invoker=true) as select * from mirror_x.snapshots;
create view public.mx_research with(security_invoker=true) as select * from mirror_x.research;
create view public.mx_pilot_requests with(security_invoker=true) as select * from mirror_x.pilot_requests;
revoke all on public.mx_instruments,public.mx_annual_facts,public.mx_snapshots,public.mx_research,public.mx_pilot_requests from public,anon,authenticated;
grant select on public.mx_instruments,public.mx_annual_facts,public.mx_snapshots to anon,authenticated;
grant select,delete on public.mx_research to authenticated;
grant select,insert on public.mx_pilot_requests to authenticated;

create function public.mx_write_research(p_ticker text,p_operation text,p_note text default null,p_assumptions jsonb default null)
returns setof mirror_x.research language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_operation not in ('watch','note','valuation') then raise exception 'Invalid operation' using errcode='22023'; end if;
 if p_operation='note' and p_note is null then raise exception 'Note required' using errcode='22023'; end if;
 if p_operation='valuation' and p_assumptions is null then raise exception 'Assumptions required' using errcode='22023'; end if;
 return query insert into mirror_x.research as r(user_id,ticker,note,assumptions,is_watchlisted)
 values(auth.uid(),p_ticker,coalesce(p_note,''),p_assumptions,p_operation<>'valuation')
 on conflict(user_id,ticker) do update set
 note=case when p_operation='note' then excluded.note else r.note end,
 assumptions=case when p_operation='valuation' then excluded.assumptions else r.assumptions end,
 is_watchlisted=case when p_operation in ('watch','note') then true else r.is_watchlisted end,
 revision=r.revision+1, updated_at=now()
 returning r.*;
end;
$$;
revoke all on function public.mx_write_research(text,text,text,jsonb) from public,anon;
grant execute on function public.mx_write_research(text,text,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
