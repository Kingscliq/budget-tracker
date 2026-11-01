begin;
-- Personal opt-in cloud snapshots. The original shared tables stay untouched.
create table public.budget_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 budget_data jsonb not null check (jsonb_typeof(budget_data)='array' and jsonb_array_length(budget_data) between 1 and 1200 and octet_length(budget_data::text)<=750000),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.budget_workspaces enable row level security;
revoke all on public.budget_workspaces from anon;
grant select,insert,update on public.budget_workspaces to authenticated;
grant all on public.budget_workspaces to service_role;
create policy "Read own budget" on public.budget_workspaces for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own budget" on public.budget_workspaces for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own budget" on public.budget_workspaces for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
commit;
