begin;
create table public.budgets (
 id uuid primary key default gen_random_uuid(),
 month integer not null check (month between 1 and 12),
 year integer not null check (year between 2000 and 2100),
 salary bigint not null default 60000000 check (salary between 0 and 100000000000),
 created_at timestamptz not null default now(),
 unique (month,year)
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),
 budget_id uuid not null references public.budgets(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100),
 category text not null check (category in ('Connectivity','Subscriptions','Living','Transport','Personal','Family','Other','Savings','Forex')),
 expected_amount bigint not null check (expected_amount between 1 and 100000000000),
 is_active boolean not null default true,
 is_recurring boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),
 expense_id uuid not null references public.expenses(id) on delete cascade,
 amount bigint not null check (amount between 1 and 100000000000),
 paid_at date not null default current_date,
 created_at timestamptz not null default now()
);
create index on public.expenses(budget_id);
create index on public.payments(expense_id);
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
-- No anonymous/client policies: the private Next.js server alone accesses data.
revoke all on public.budgets,public.expenses,public.payments from anon,authenticated;
grant all on public.budgets,public.expenses,public.payments to service_role;

create function public.create_budget_month(p_month integer,p_year integer,p_seed boolean default false)
returns uuid language plpgsql set search_path = public as $$
declare result uuid; was_empty boolean;
begin
 perform pg_advisory_xact_lock(382751);
 was_empty := not exists(select 1 from budgets);
 insert into budgets(month,year) values(p_month,p_year) on conflict(month,year) do nothing returning id into result;
 if result is null then select id into result from budgets where month=p_month and year=p_year; return result; end if;
 if p_seed and was_empty then
 insert into expenses(budget_id,name,category,expected_amount) values
 (result,'Starlink','Connectivity',6000000),(result,'Codex','Subscriptions',3100000),
 (result,'X','Subscriptions',800000),(result,'Mobile data & airtime','Connectivity',2000000),
 (result,'Food','Living',7500000),(result,'Cooking','Living',2500000),
 (result,'Transport','Transport',4000000),(result,'Personal expenses','Personal',3000000),
 (result,'Family/support','Family',4000000),(result,'Unexpected expenses','Other',3000000),
 (result,'Savings','Savings',10000000),(result,'Forex','Forex',5000000);
 end if;
 return result;
end; $$;
create function public.copy_previous_budget(target_id uuid)
returns void language plpgsql set search_path = public as $$
declare target budgets; previous budgets; previous_date date;
begin
 select * into strict target from budgets where id=target_id for update;
 if exists(select 1 from expenses where budget_id=target_id) then raise exception 'Target month must be empty'; end if;
 previous_date:=make_date(target.year,target.month,1)-interval '1 month';
 select * into strict previous from budgets where month=extract(month from previous_date) and year=extract(year from previous_date);
 update budgets set salary=previous.salary where id=target_id;
 insert into expenses(budget_id,name,category,expected_amount,is_active,is_recurring)
 select target_id,name,category,expected_amount,true,true from expenses where budget_id=previous.id and is_recurring and is_active;
end; $$;
create function public.record_budget_payment(p_expense_id uuid,p_amount bigint,p_paid_at date)
returns uuid language plpgsql set search_path = public as $$
declare active boolean; result uuid;
begin
 select is_active into strict active from expenses where id=p_expense_id for update;
 if not active then raise exception 'Restore the expense before recording a payment'; end if;
 insert into payments(expense_id,amount,paid_at) values(p_expense_id,p_amount,p_paid_at) returning id into result;
 return result;
end; $$;
revoke all on function public.create_budget_month(integer,integer,boolean),public.copy_previous_budget(uuid),public.record_budget_payment(uuid,bigint,date) from public,anon,authenticated;
grant execute on function public.create_budget_month(integer,integer,boolean),public.copy_previous_budget(uuid),public.record_budget_payment(uuid,bigint,date) to service_role;
commit;
