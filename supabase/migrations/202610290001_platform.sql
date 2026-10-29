-- Review before applying to a designated development Supabase project.
-- This migration is NOT applied by npm install/build and contains no demo rewards.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '여행자' check (char_length(display_name) between 1 and 30),
  balance integer not null default 0 check (balance >= 0),
  interests text[] not null default '{}' check (
    cardinality(interests) <= 8
    and interests <@ array['문화·예술','공연·음악','전시·박물관','스포츠·레저','자연·생태','여행·관광','축제·행사','맛집·미식','공예·원데이','역사·전통','가족·키즈','교육·배움','봉사·커뮤니티','웰니스·휴식']::text[]
  ),
  gender text not null default 'unspecified' check (gender in ('unspecified','woman','man','other')),
  created_at timestamptz not null default now()
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 200), region text not null,
  city text not null, category text not null check (category in ('문화·예술','공연·음악','전시·박물관','스포츠·레저','자연·생태','여행·관광','축제·행사','맛집·미식','공예·원데이','역사·전통','가족·키즈','교육·배움','봉사·커뮤니티','웰니스·휴식')),
  description text not null check(char_length(description) <= 5000), duration text not null, price integer not null check (price between 0 and 1000000),
  image text not null default 'garden', date text not null, tags text[] not null default '{}' check(cardinality(tags) <= 10),
  reward integer not null default 0 check (reward between 0 and 100000),
  is_demo boolean not null default true, active boolean not null default false,
  source_url text, updated_at timestamptz not null default now()
);
create index activities_region_category on public.activities(region, category) where active;
create table public.offers (
  id uuid primary key default gen_random_uuid(), title text not null, merchant text not null,
  region text not null, description text not null, cost integer not null check(cost > 0),
  stock integer not null default 0 check(stock >= 0), is_demo boolean not null default true,
  active boolean not null default false, expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.saved_activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id), note text not null default '' check(char_length(note) <= 300),
  created_at timestamptz not null default now(), unique(user_id, activity_id)
);
create index saved_by_user on public.saved_activities(user_id, created_at desc);
create table public.redemptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  offer_id uuid not null references public.offers(id), request_id uuid not null,
  redeem_code text not null default ('GGT-' || upper(replace(gen_random_uuid()::text, '-', ''))) unique,
  cost integer not null check(cost > 0), status text not null default 'issued' check(status in ('issued','used','cancelled')),
  expires_at timestamptz not null, created_at timestamptz not null default now(), unique(user_id, request_id)
);
create index redemptions_by_user on public.redemptions(user_id, created_at desc);
create table public.point_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  amount integer not null, description text not null, redemption_id uuid unique references public.redemptions(id),
  created_at timestamptz not null default now()
);
create index ledger_by_user on public.point_ledger(user_id, created_at desc);
create table public.participations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  activity_id uuid not null references public.activities(id), region text not null,
  note text not null check(char_length(note) between 10 and 500),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), unique(user_id, activity_id)
);
create index participations_by_user on public.participations(user_id, created_at desc);
create table public.recommendation_runs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  preferences jsonb not null check(jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 4096),
  result jsonb not null check(jsonb_typeof(result) = 'object' and octet_length(result::text) <= 8192),
  created_at timestamptz not null default now()
);
create index recommendations_by_user on public.recommendation_runs(user_id, created_at desc);
create table public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null, count integer not null default 0, primary key(user_id, day)
);

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values(new.id);
  return new;
end; $$;
create trigger gotgot_create_profile after insert on auth.users for each row execute function public.create_profile();
-- Existing accounts also need an application profile; no account data is overwritten.
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.offers enable row level security;
alter table public.saved_activities enable row level security;
alter table public.redemptions enable row level security;
alter table public.point_ledger enable row level security;
alter table public.participations enable row level security;
alter table public.recommendation_runs enable row level security;
alter table public.ai_usage enable row level security;

-- Remove Supabase default grants; explicitly grant only the required operations.
revoke all on public.profiles, public.activities, public.offers, public.saved_activities, public.redemptions, public.point_ledger, public.participations, public.recommendation_runs, public.ai_usage from anon, authenticated;
grant select on public.activities, public.offers to anon, authenticated;
grant select on public.profiles, public.saved_activities, public.redemptions, public.point_ledger, public.participations, public.recommendation_runs to authenticated;
grant update(display_name, interests, gender) on public.profiles to authenticated;
grant insert(user_id, activity_id, note), update(note), delete on public.saved_activities to authenticated;
grant insert(user_id, activity_id, region, note) on public.participations to authenticated;
-- The member token is used by the server; direct access can write only that member's own history.
grant insert(user_id, preferences, result) on public.recommendation_runs to authenticated;

create policy profiles_read on public.profiles for select to authenticated using(id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using(id = (select auth.uid())) with check(id = (select auth.uid()));
create policy activities_public on public.activities for select using(active);
create policy offers_public on public.offers for select using(active);
-- Retain readable titles/details for a member's saved activities and issued coupons
-- when the operator later archives the underlying catalog record.
-- Security-definer boolean checks avoid cycles between activity read and saved/participation RLS.
-- They can reveal only whether the caller owns a history record, never another member's data.
create function public.has_saved_activity(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.saved_activities s where s.activity_id = p_id and s.user_id = auth.uid());
$$;
create function public.has_participated_activity(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.participations p where p.activity_id = p_id and p.user_id = auth.uid());
$$;
create function public.has_redeemed_offer(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.redemptions r where r.offer_id = p_id and r.user_id = auth.uid());
$$;
revoke all on function public.has_saved_activity(uuid), public.has_participated_activity(uuid), public.has_redeemed_offer(uuid) from public, anon, authenticated;
grant execute on function public.has_saved_activity(uuid), public.has_participated_activity(uuid), public.has_redeemed_offer(uuid) to authenticated;
create policy activities_saved_read on public.activities for select to authenticated using(
  public.has_saved_activity(id)
);
create policy activities_participation_read on public.activities for select to authenticated using(
  public.has_participated_activity(id)
);
create policy offers_redemption_read on public.offers for select to authenticated using(
  public.has_redeemed_offer(id)
);
create policy saved_read on public.saved_activities for select to authenticated using(user_id = (select auth.uid()));
create policy saved_insert on public.saved_activities for insert to authenticated with check(user_id = (select auth.uid()) and exists(select 1 from public.activities a where a.id = activity_id and a.active and not a.is_demo));
create policy saved_update on public.saved_activities for update to authenticated using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
create policy saved_delete on public.saved_activities for delete to authenticated using(user_id = (select auth.uid()));
create policy redemptions_read on public.redemptions for select to authenticated using(user_id = (select auth.uid()));
create policy ledger_read on public.point_ledger for select to authenticated using(user_id = (select auth.uid()));
create policy participations_read on public.participations for select to authenticated using(user_id = (select auth.uid()));
create policy participations_insert on public.participations for insert to authenticated with check(user_id = (select auth.uid()) and status = 'pending' and exists(select 1 from public.activities a where a.id = activity_id and a.active and not a.is_demo and a.region = participations.region));
create policy recommendations_read on public.recommendation_runs for select to authenticated using(user_id = (select auth.uid()));
create policy recommendations_insert on public.recommendation_runs for insert to authenticated with check(user_id = (select auth.uid()));

create function public.exchange_offer(p_offer_id uuid, p_request_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); o public.offers%rowtype; existing public.redemptions%rowtype; redemption uuid;
begin
  if u is null then raise exception 'authentication_required'; end if;
  -- Serialize exchanges for a user, including request-key retries, before checking balance.
  perform 1 from public.profiles where id = u for update;
  select * into existing from public.redemptions where user_id = u and request_id = p_request_id;
  if found then
    if existing.offer_id <> p_offer_id then raise exception 'idempotency_conflict'; end if;
    return existing.id;
  end if;
  select * into o from public.offers where id = p_offer_id for update;
  if not found or not o.active or o.is_demo or o.stock <= 0 or o.expires_at <= now() then raise exception 'offer_unavailable'; end if;
  update public.profiles set balance = balance - o.cost where id = u and balance >= o.cost;
  if not found then raise exception 'insufficient_balance'; end if;
  update public.offers set stock = stock - 1 where id = o.id;
  insert into public.redemptions(user_id, offer_id, request_id, cost, expires_at) values(u, o.id, p_request_id, o.cost, o.expires_at) returning id into redemption;
  insert into public.point_ledger(user_id, amount, description, redemption_id) values(u, -o.cost, o.title || ' 교환', redemption);
  return redemption;
end; $$;

create function public.reserve_ai_request() returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); n integer;
begin
  if u is null then raise exception 'authentication_required'; end if;
  insert into public.ai_usage(user_id, day, count) values(u, (now() at time zone 'Asia/Seoul')::date, 1)
  on conflict(user_id, day) do update set count = public.ai_usage.count + 1 where public.ai_usage.count < 10 returning count into n;
  if n is null then raise exception 'daily_limit_reached'; end if;
end; $$;

-- A trusted merchant/operator calls this after scanning the issued barcode.
-- Members can read their code but cannot mark a coupon as used themselves.
create function public.use_coupon(p_redeem_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare redemption uuid;
begin
  update public.redemptions
  set status = 'used'
  where redeem_code = upper(trim(p_redeem_code))
    and status = 'issued'
    and expires_at > now()
  returning id into redemption;
  if redemption is null then raise exception 'coupon_unavailable'; end if;
  return redemption;
end; $$;

-- Participation approval is restricted to a trusted operator, never callable by members.
create function public.approve_participation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.participations%rowtype; reward integer;
begin
  select * into p from public.participations where id = p_id for update;
  if not found or p.status <> 'pending' then raise exception 'participation_unavailable'; end if;
  select a.reward into reward from public.activities a where a.id = p.activity_id and not a.is_demo;
  if reward is null then raise exception 'activity_unavailable'; end if;
  update public.profiles set balance = balance + reward where id = p.user_id;
  update public.participations set status = 'approved' where id = p_id;
  insert into public.point_ledger(user_id, amount, description) values(p.user_id, reward, '활동 참여 확인');
end; $$;

revoke all on function public.create_profile(), public.exchange_offer(uuid, uuid), public.reserve_ai_request(), public.use_coupon(text), public.approve_participation(uuid) from public, anon, authenticated;
grant execute on function public.exchange_offer(uuid, uuid), public.reserve_ai_request() to authenticated;
grant execute on function public.use_coupon(text) to service_role;
grant execute on function public.approve_participation(uuid) to service_role;
commit;
