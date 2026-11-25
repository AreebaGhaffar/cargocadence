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