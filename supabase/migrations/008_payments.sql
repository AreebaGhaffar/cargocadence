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