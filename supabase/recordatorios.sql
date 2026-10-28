-- Meeting reminders on phones (web push). Applied once in Supabase; kept here for reference.
-- Each phone or computer that turns reminders on is one row in push_subs. The page writes it through key-checked functions;
-- the function `recordatorios` reads it with the service key, every minute, and sends what is due.

create table if not exists public.push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  member_key text not null default '',
  scope text not null default 'mine' check (scope in ('mine', 'all')),
  leads int[] not null default '{60,30,10}',      -- minutes before each meeting, any of 60, 30, 10
  morning boolean not null default true,          -- the 7:00 summary of the day's meetings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;

-- one row per reminder already sent (each lead of each meeting date, and each day's summary), so nothing goes out twice; old rows are cleared by the function
create table if not exists public.push_sent (
  endpoint text not null,
  occ text not null,
  sent_at timestamptz not null default now(),
  primary key (endpoint, occ)
);
alter table public.push_sent enable row level security;

create or replace function public.push_sub_set(p_key text, p_endpoint text, p_p256dh text, p_auth text, p_member text, p_scope text, p_leads int[], p_morning boolean)
returns void language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_key(p_key);
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = ''
     or length(p_p256dh) > 200 or length(p_auth) > 100 or length(coalesce(p_member, '')) > 20 then
    raise exception 'datos no válidos' using errcode = '22023';
  end if;
  if (select count(*) from public.push_subs) >= 200 and not exists (select 1 from public.push_subs where endpoint = p_endpoint) then
    raise exception 'demasiados dispositivos' using errcode = '54000';
  end if;
  insert into public.push_subs (endpoint, p256dh, auth, member_key, scope, leads, morning)
  values (p_endpoint, p_p256dh, p_auth, coalesce(p_member, ''), case when p_scope = 'all' then 'all' else 'mine' end,
    array(select distinct x from unnest(coalesce(p_leads, '{}'::int[])) x where x in (60, 30, 10) order by x desc),
    coalesce(p_morning, false))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, member_key = excluded.member_key,
    scope = excluded.scope, leads = excluded.leads, morning = excluded.morning, updated_at = now();
end $$;

create or replace function public.push_sub_delete(p_key text, p_endpoint text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_key(p_key);
  delete from public.push_subs where endpoint = p_endpoint;
  delete from public.push_sent where endpoint = p_endpoint;
end $$;

revoke all on function public.push_sub_set(text, text, text, text, text, text, int[], boolean) from public;
revoke all on function public.push_sub_delete(text, text) from public;
grant execute on function public.push_sub_set(text, text, text, text, text, text, int[], boolean) to anon;
grant execute on function public.push_sub_delete(text, text) to anon;

-- every minute: ask the function to send the reminders that are due (it does nothing when none are)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('recordatorios-reuniones', '* * * * *', $$
  select net.http_post(
    url := 'https://twtenusvpnqntkeiejvk.supabase.co/functions/v1/recordatorios',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON KEY>"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
$$);
