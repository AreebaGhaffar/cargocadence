create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'quoted' check (
    status in ('quoted', 'pending_approval', 'confirmed', 'paid', 'completed', 'cancelled')
  ),

  -- What the customer asked for (collected by the AI chat)
  pickup_location text not null,
  dropoff_location text not null,
  cargo_description text not null,
  cargo_weight_lbs integer check (cargo_weight_lbs > 0),
  pickup_at timestamptz not null,

  -- Pricing
  truck_type_id uuid references public.truck_types(id),
  distance_miles numeric(8,1) check (distance_miles >= 0),
  estimate_breakdown jsonb,
  estimated_total numeric(10,2) check (estimated_total >= 0),

  -- Custom / negotiated deals need admin approval
  is_custom_deal boolean not null default false,
  custom_deal_notes text,
  final_total numeric(10,2) check (final_total >= 0),
  admin_notes text,

  -- Used by the reminder system later
  reminder_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_pickup_at_idx on public.bookings (pickup_at);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

-- Customers see their own bookings; admins see all
create policy "Read own bookings or admin"
  on public.bookings for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

-- Customers can create bookings only for themselves, and cannot set
-- admin-controlled fields or skip approval
create policy "Customers create own bookings"
  on public.bookings for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status in ('quoted', 'pending_approval')
    and final_total is null
    and admin_notes is null
    and reminder_sent_at is null
  );

-- Only admins can modify bookings after creation
create policy "Admins update bookings"
  on public.bookings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No delete policy on purpose: bookings are a record, they get cancelled
grant select, insert, update on public.bookings to authenticated;