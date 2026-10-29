-- CANDIDATE ONLY. Not executed. Generate a proper timestamped migration with
-- `supabase migration new mirror_x` after selecting a NEW isolated target.
-- No production credentials or existing application resources are required here.
create table public.mx_instruments (
 ticker text primary key, name text not null, sector text not null,
 payload jsonb not null, updated_at timestamptz not null default now()
);
create table public.mx_snapshots (
 id text primary key, status text not null check(status in ('PRELIMINARY','FINAL')),
 payload jsonb not null, published boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.mx_research (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 ticker text not null references public.mx_instruments(ticker),
 thesis text not null default '', assumptions jsonb,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), unique(user_id,ticker,version)
);
alter table public.mx_instruments enable row level security;
alter table public.mx_snapshots enable row level security;
alter table public.mx_research enable row level security;
revoke all on public.mx_instruments,public.mx_snapshots,public.mx_research from anon,authenticated;
grant select on public.mx_instruments,public.mx_snapshots to anon,authenticated;
grant select,insert,update,delete on public.mx_research to authenticated;
create policy "read_reference_data" on public.mx_instruments for select to anon,authenticated using(true);
create policy "read_published_snapshots" on public.mx_snapshots for select to anon,authenticated using(published);
create policy "read_own_research" on public.mx_research for select to authenticated using((select auth.uid())=user_id);
create policy "insert_own_research" on public.mx_research for insert to authenticated with check((select auth.uid())=user_id);
create policy "update_own_research" on public.mx_research for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "delete_own_research" on public.mx_research for delete to authenticated using((select auth.uid())=user_id);
create index mx_instruments_sector_idx on public.mx_instruments(sector,ticker);
create index mx_research_owner_idx on public.mx_research(user_id,ticker);
-- Required before release: anon cannot read unpublished snapshot/private notes;
-- user A cannot read/update user B; owner cannot change user_id; viewer read-only.
-- Test GRANT + RLS in isolated Postgres/Supabase before applying to remote.
