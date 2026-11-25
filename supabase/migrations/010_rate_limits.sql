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