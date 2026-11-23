-- Keeps updated_at current on every change
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Truck types with admin-defined rates
create table public.truck_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_fee numeric(10,2) not null default 0 check (base_fee >= 0),
  rate_per_mile numeric(10,2) not null check (rate_per_mile >= 0),
  max_weight_lbs integer check (max_weight_lbs > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Surcharges: a flat dollar amount or a percentage of the estimate
create table public.surcharges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('flat', 'percent')),
  amount numeric(10,2) not null check (amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger truck_types_updated_at
  before update on public.truck_types
  for each row execute function public.set_updated_at();

create trigger surcharges_updated_at
  before update on public.surcharges
  for each row execute function public.set_updated_at();

alter table public.truck_types enable row level security;
alter table public.surcharges enable row level security;

-- Logged-in users can read active rows; admins can read everything
create policy "Read active truck types"
  on public.truck_types for select to authenticated
  using (active or (select public.is_admin()));

create policy "Read active surcharges"
  on public.surcharges for select to authenticated
  using (active or (select public.is_admin()));

-- Only admins can write
create policy "Admins insert truck types"
  on public.truck_types for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update truck types"
  on public.truck_types for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete truck types"
  on public.truck_types for delete to authenticated
  using ((select public.is_admin()));

create policy "Admins insert surcharges"
  on public.surcharges for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update surcharges"
  on public.surcharges for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete surcharges"
  on public.surcharges for delete to authenticated
  using ((select public.is_admin()));

-- Table privileges (RLS above still decides who can actually write)
grant select, insert, update, delete on public.truck_types to authenticated;
grant select, insert, update, delete on public.surcharges to authenticated;