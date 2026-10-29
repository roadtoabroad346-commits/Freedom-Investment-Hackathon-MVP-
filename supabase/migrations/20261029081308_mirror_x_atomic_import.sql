create table mirror_x.write_buckets (
 user_id uuid not null references auth.users(id) on delete cascade,
 window_start timestamptz not null, hits integer not null check(hits>0),
 primary key(user_id,window_start)
);
alter table mirror_x.write_buckets enable row level security;
revoke all on mirror_x.write_buckets from public,anon,authenticated;
grant select,insert,update,delete on mirror_x.write_buckets to authenticated;
create policy mx_bucket_owner on mirror_x.write_buckets for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create or replace function public.mx_write_research(p_ticker text,p_operation text,p_note text default null,p_assumptions jsonb default null)
returns setof mirror_x.research language plpgsql security invoker set search_path='' as $$
declare write_hits integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_operation not in ('watch','note','valuation','import') then raise exception 'Invalid operation' using errcode='22023'; end if;
 if p_operation='note' and p_note is null then raise exception 'Note required' using errcode='22023'; end if;
 if p_operation='valuation' and p_assumptions is null then raise exception 'Assumptions required' using errcode='22023'; end if;

 delete from mirror_x.write_buckets where user_id=auth.uid() and window_start<now()-interval '10 minutes';
 insert into mirror_x.write_buckets as b(user_id,window_start,hits) values(auth.uid(),date_trunc('minute',now()),1)
 on conflict(user_id,window_start) do update set hits=b.hits+1 returning b.hits into write_hits;
 if write_hits>120 then raise exception 'MX_RATE_LIMIT' using errcode='P0001'; end if;
 if p_operation='import' then
   return query insert into mirror_x.research as r(user_id,ticker,note,assumptions,is_watchlisted)
   values(auth.uid(),p_ticker,coalesce(p_note,''),p_assumptions,true)
   on conflict(user_id,ticker) do nothing returning r.*;
   if not found then return query select r.* from mirror_x.research r where r.user_id=auth.uid() and r.ticker=p_ticker;end if;
   return;
 end if;
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
