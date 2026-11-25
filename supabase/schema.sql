-- CargoCadence full database schema (migrations 001-010, in order).
-- Run once in an EMPTY Supabase project: SQL Editor -> New query -> paste -> Run.
-- Then promote your first admin by hand (see README).

-- ======== 001_profiles_and_roles.sql ========
-- Profiles: one row per user, with a role (client or admin)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Users can read only their own profile
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Admins can read every profile
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Auto-create a profile whenever someone registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ======== 002_grant_profiles_select.sql ========
-- Allow logged-in users to read profiles (RLS policies still limit which rows).
-- No insert/update/delete grant: roles can only be changed from the database.
grant select on public.profiles to authenticated;

-- ======== 003_rates_and_surcharges.sql ========
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

-- ======== 004_seed_rates.sql ========
insert into public.truck_types (name, base_fee, rate_per_mile, max_weight_lbs) values
  ('Box Truck', 150.00, 2.50, 10000),
  ('Dry Van', 250.00, 2.90, 45000),
  ('Flatbed', 300.00, 3.20, 48000),
  ('Refrigerated', 350.00, 3.60, 42000);

insert into public.surcharges (name, kind, amount) values
  ('Fuel surcharge', 'percent', 8.00),
  ('Liftgate service', 'flat', 75.00),
  ('Weekend pickup', 'flat', 100.00);

-- ======== 005_bookings.sql ========
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

-- ======== 006_surcharge_applies_when.sql ========
alter table public.surcharges
  add column applies_when text not null default 'manual'
  check (applies_when in ('always', 'weekend', 'manual'));

update public.surcharges set applies_when = 'always' where name = 'Fuel surcharge';
update public.surcharges set applies_when = 'weekend' where name = 'Weekend pickup';

-- ======== 007_bookings_timezone.sql ========
alter table public.bookings add column pickup_timezone text;

-- ======== 008_payments.sql ========
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  user_id uuid not null references auth.users(id),

  -- Amount in dollars, same unit as bookings.final_total
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'usd',
  status text not null check (status in ('succeeded', 'failed', 'refunded')),

  -- Stripe references (unique so a retried webhook cannot record twice)
  payment_intent text unique,
  checkout_session_id text not null unique,

  created_at timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments (booking_id);
create index payments_user_id_idx on public.payments (user_id);
create index payments_created_at_idx on public.payments (created_at desc);

alter table public.payments enable row level security;

-- Customers see their own payments; admins see all
create policy "Read own payments or admin"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

-- No insert, update or delete policies on purpose:
-- only the server (Stripe webhook, using the secret key) writes payments.

grant select on public.payments to authenticated;

-- ======== 009_platform_settings.sql ========
create table public.platform_settings (
  -- Single-row table: the check forces id to always be 1
  id integer primary key default 1 check (id = 1),

  company_name text not null default 'CargoCadence',
  support_email text,
  support_phone text,
  whatsapp_number text,
  support_hours text,
  office_address text,

  updated_at timestamptz not null default now(),

  constraint platform_settings_lengths check (
    char_length(company_name) <= 100
    and char_length(coalesce(support_email, '')) <= 200
    and char_length(coalesce(support_phone, '')) <= 50
    and char_length(coalesce(whatsapp_number, '')) <= 50
    and char_length(coalesce(support_hours, '')) <= 200
    and char_length(coalesce(office_address, '')) <= 300
  )
);

create trigger platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

-- Contact details are public: shown in the footer and on the dashboard
create policy "Anyone can read platform settings"
  on public.platform_settings for select to anon, authenticated
  using (true);

-- Only admins can edit
create policy "Admins update platform settings"
  on public.platform_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No insert or delete policies on purpose: the single row is seeded below.

grant select on public.platform_settings to anon, authenticated;
grant update on public.platform_settings to authenticated;

-- Seed the one row. Contact details stay empty until the admin fills them in.
insert into public.platform_settings (id) values (1);

-- ======== 010_rate_limits.sql ========
create table public.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

-- RLS on with no policies: nobody can touch the table directly.
-- Only the security definer function below reads and writes it.
alter table public.rate_limits enable row level security;

-- Returns true if the request is allowed, false if the limit is exceeded.
-- Fixed time windows; the counter is incremented atomically.
create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_user_id is null or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid arguments';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as r (user_id, bucket, window_start, request_count)
  values (p_user_id, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set request_count = r.request_count + 1
  returning r.request_count into v_count;

  -- Clean up this user's old windows
  delete from public.rate_limits
  where user_id = p_user_id and window_start < now() - interval '2 days';

  return v_count <= p_limit;
end;
$$;

-- Only the server (secret key = service_role) may call it
revoke all on function public.check_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, integer, integer)
  to service_role;
