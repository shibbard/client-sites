-- Home for Holiday — directory unlock (£5.95 / 30 days)
-- Run in the Supabase SQL editor. Project MUST be in a UK/EU region: it holds
-- customer emails under a UK controller and the region cannot be changed later.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- members — one row per paying email address
-- ---------------------------------------------------------------------------
create table if not exists members (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique,
  stripe_customer_id  text,
  access_expires_at   timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists members_email_idx on members (lower(email));

-- ---------------------------------------------------------------------------
-- sessions — one row per signed-in device, capped at 3 per member
--
-- The cookie carries an opaque random token; only its sha256 is stored, so a
-- database leak does not hand over live sessions. Supabase Auth still issues
-- and verifies the 6-digit code (per spec, codes are not hand-rolled) — this
-- table is what the /go gate actually checks on every request.
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references members (id) on delete cascade,
  token_hash    text not null unique,
  device_label  text,
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists sessions_member_idx on sessions (member_id, created_at);
create index if not exists sessions_token_idx  on sessions (token_hash);

-- ---------------------------------------------------------------------------
-- properties — owner_url lives here and ONLY here.
-- It must never be rendered into public HTML; that is the whole paywall.
-- ---------------------------------------------------------------------------
create table if not exists properties (
  slug       text primary key,
  region     text not null,
  owner_url  text not null,
  title      text,
  sub        text
);

-- ---------------------------------------------------------------------------
-- link_events — one row per owner-link open; also powers the abuse throttle
-- ---------------------------------------------------------------------------
create table if not exists link_events (
  id         bigserial primary key,
  member_id  uuid references members (id) on delete set null,
  slug       text,
  referrer   text,
  created_at timestamptz not null default now()
);

create index if not exists link_events_throttle_idx on link_events (member_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: every table is reached only by serverless functions using the service
-- role key, which bypasses RLS. Enabling it with no policies means that if the
-- anon key is ever used against these tables by mistake, it reads nothing.
-- ---------------------------------------------------------------------------
alter table members    enable row level security;
alter table sessions   enable row level security;
alter table properties enable row level security;
alter table link_events enable row level security;

-- ---------------------------------------------------------------------------
-- Enforce the 3-device cap in the database, so it holds no matter which code
-- path creates a session.
-- ---------------------------------------------------------------------------
create or replace function enforce_session_cap() returns trigger
language plpgsql as $$
begin
  delete from sessions
  where id in (
    select id from sessions
    where member_id = new.member_id
    order by created_at desc
    offset 3
  );
  return null;
end;
$$;

drop trigger if exists sessions_cap on sessions;
create trigger sessions_cap
  after insert on sessions
  for each row execute function enforce_session_cap();

-- Housekeeping: expired sessions serve no purpose.
create or replace function purge_expired_sessions() returns void
language sql as $$
  delete from sessions where expires_at < now();
$$;
