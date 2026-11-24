alter table public.surcharges
  add column applies_when text not null default 'manual'
  check (applies_when in ('always', 'weekend', 'manual'));

update public.surcharges set applies_when = 'always' where name = 'Fuel surcharge';
update public.surcharges set applies_when = 'weekend' where name = 'Weekend pickup';