-- Saksham — initial schema
-- ----------------------------------------------------------------------------
-- Auth model
--   Sign-in (phone + MPIN, OTP, passkeys) runs in Next.js server routes using the
--   service-role key, which bypasses RLS. For browser realtime/storage access the
--   server mints a short-lived Supabase JWT whose `sub` = users.id, so auth.uid()
--   below resolves to the Saksham user. RLS is ON for every table; anything not
--   granted by a policy is denied.
-- Amounts are integer NPR (paisa not needed for this market).
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ============================================================ enums
create type role as enum ('client', 'provider');
create type verification_kind as enum ('phone', 'citizenship', 'student_id', 'selfie', 'address', 'women_group');
create type verification_status as enum ('not_started', 'pending', 'verified', 'rejected');
create type request_status as enum ('draft', 'open', 'assigned', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed');
create type bid_status as enum ('active', 'countered', 'accepted', 'declined', 'withdrawn');
create type counter_status as enum ('pending', 'accepted', 'declined', 'expired');
create type plan_kind as enum ('full', 'two', 'milestones');
create type escrow_state as enum ('scheduled', 'held', 'delivered', 'released', 'refunded');
create type pay_method as enum ('esewa_sandbox', 'khalti_sandbox', 'wallet');
create type report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type dispute_status as enum ('open', 'redo_arranged', 'refunded', 'resolved', 'rejected');

-- ============================================================ helpers
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================ users & auth
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^9[78][0-9]{8}$'),
  name text not null check (char_length(name) between 2 and 60),
  city text not null,
  roles role[] not null default '{client}',
  active_role role not null default 'client',
  mpin_hash text not null,                         -- bcrypt, cost 12
  failed_attempts int not null default 0,
  locked_until timestamptz,
  lang text not null default 'en' check (lang in ('en', 'ne')),
  gender text check (gender in ('female', 'male', 'other')),  -- self-declared; women-only visibility
  is_demo boolean not null default false,
  is_admin boolean not null default false,
  headline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger users_touch before update on users for each row execute function touch_updated_at();

create table passkeys (
  credential_id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  label text not null default 'This device',
  created_at timestamptz not null default now()
);
create index on passkeys(user_id);

create table otp_codes (
  key text primary key,                            -- '<purpose>:<phone>'
  phone text not null,
  purpose text not null check (purpose in ('signup', 'reset')),
  code_hash text not null,                         -- sha256(secret:phone:code)
  expires_at timestamptz not null,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now()
);

-- ============================================================ providers & trust
create table providers (
  user_id uuid primary key references users(id) on delete cascade,
  bio text check (char_length(bio) <= 1000),
  categories text[] not null default '{}',
  price_min int, price_max int,
  service_radius_km int not null default 10 check (service_radius_km between 1 and 100),
  lat double precision, lng double precision,       -- area centroid, never an exact home address
  area text,
  online_ok boolean not null default false,
  women_led boolean not null default false,          -- set only via a verified women_group proof
  level int not null default 1,
  rating numeric(2,1) not null default 0,
  rating_count int not null default 0,
  jobs_done int not null default 0,
  response_minutes int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger providers_touch before update on providers for each row execute function touch_updated_at();

create table verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind verification_kind not null,
  status verification_status not null default 'not_started',
  storage_path text,                                 -- private bucket 'id-docs'
  simulated boolean not null default false,          -- selfie match is simulated in demo
  reviewer_id uuid references users(id),
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (user_id, kind)
);

-- ============================================================ price table (admin-editable)
create table price_table (
  category text primary key,
  label_en text not null, label_ne text not null,
  unit text not null,
  low int not null check (low > 0),
  high int not null check (high >= low),
  per_day int not null,
  online boolean not null default false,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

-- ============================================================ requests (tasks)
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  category text not null references price_table(category),
  title text not null check (char_length(title) between 3 and 80),
  details text not null check (char_length(details) <= 2000),
  days int not null default 1 check (days between 1 and 60),
  city text, area text, lat double precision, lng double precision,
  online boolean not null default false,
  women_only boolean not null default false,
  budget int,
  fair_low int not null, fair_high int not null,     -- from price_table, never from the AI
  due_date date,
  status request_status not null default 'open',
  ai_source text check (ai_source in ('ai', 'fallback', 'manual')),
  for_family_abroad boolean not null default false,
  family_contact_name text,
  is_example boolean not null default false,         -- seed data shown as "Example"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on requests(status, city);
create index on requests(client_id);
create trigger requests_touch before update on requests for each row execute function touch_updated_at();

create table photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  request_id uuid references requests(id) on delete cascade,
  portfolio boolean not null default false,
  storage_path text not null,
  alt text not null check (char_length(alt) between 3 and 200),
  width int, height int,
  created_at timestamptz not null default now()
);

-- ============================================================ bidding
create table bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  provider_id uuid not null references users(id) on delete cascade,
  amount int not null check (amount > 0),
  days int not null default 1,
  message text check (char_length(message) <= 1000),
  status bid_status not null default 'active',
  score numeric(4,3),                                 -- computed by server code
  reason text,
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create table counters (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references bids(id) on delete cascade,
  from_user uuid not null references users(id),
  amount int not null check (amount > 0),
  status counter_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  asker_id uuid not null references users(id) on delete cascade,
  body text not null check (char_length(body) between 2 and 500),
  answer text check (char_length(answer) <= 1000),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================ money
create table bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references requests(id) on delete restrict,
  bid_id uuid not null references bids(id),
  client_id uuid not null references users(id),
  provider_id uuid not null references users(id),
  total int not null check (total > 0),
  fee int not null check (fee >= 0),
  plan plan_kind not null,
  created_at timestamptz not null default now()
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  seq int not null,
  label text not null,
  amount int not null check (amount > 0),
  due_date date,
  state escrow_state not null default 'scheduled',
  updated_at timestamptz not null default now(),
  unique (booking_id, seq)
);
create trigger installments_touch before update on installments for each row execute function touch_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references installments(id) on delete restrict,
  method pay_method not null,
  amount int not null,
  direction text not null check (direction in ('hold', 'release', 'refund', 'payout')),
  provider_ref text,                                  -- sandbox reference
  receipt_no text unique,
  created_at timestamptz not null default now()
);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  rater_id uuid not null references users(id),
  ratee_id uuid not null references users(id),
  stars int not null check (stars between 1 and 5),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  unique (booking_id, rater_id)
);

create table passport (
  user_id uuid primary key references users(id) on delete cascade,
  verified_earnings int not null default 0,
  completed_jobs int not null default 0,
  avg_rating numeric(2,1) not null default 0,
  public_slug text unique,                            -- QR code target
  updated_at timestamptz not null default now()
);

create table credit_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  limit_npr int not null check (limit_npr between 0 and 100000),
  basis jsonb not null,
  partner text not null default 'Demo partner',       -- mock; no real partnership
  status text not null default 'offered' check (status in ('offered', 'applied', 'declined', 'expired')),
  created_at timestamptz not null default now()
);

-- ============================================================ messaging
create table conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) on delete set null,
  a_id uuid not null references users(id) on delete cascade,
  b_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (a_id <> b_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references users(id),                -- null = system message
  kind text not null default 'text' check (kind in ('text', 'voice', 'photo', 'system')),
  body text check (char_length(body) <= 2000),
  storage_path text,
  created_at timestamptz not null default now()
);
create index on messages(conversation_id, created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('bid', 'counter', 'payment', 'message', 'verification', 'system')),
  title text not null, body text, href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, created_at desc);

-- ============================================================ trust & safety
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  target_user uuid references users(id),
  target_request uuid references requests(id),
  reason text not null check (char_length(reason) between 3 and 1000),
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  opened_by uuid not null references users(id),
  reason text not null check (char_length(reason) between 3 and 2000),
  status dispute_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================ RLS
alter table users enable row level security;
alter table passkeys enable row level security;
alter table otp_codes enable row level security;
alter table providers enable row level security;
alter table verifications enable row level security;
alter table price_table enable row level security;
alter table requests enable row level security;
alter table photos enable row level security;
alter table bids enable row level security;
alter table counters enable row level security;
alter table questions enable row level security;
alter table bookings enable row level security;
alter table installments enable row level security;
alter table payments enable row level security;
alter table ratings enable row level security;
alter table passport enable row level security;
alter table credit_offers enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table disputes enable row level security;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from users where id = auth.uid()), false)
$$;
create or replace function is_woman() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select gender = 'female' from users where id = auth.uid()), false)
$$;

-- users: read own row only (public profile fields are served through a view below)
create policy users_self_read on users for select using (id = auth.uid() or is_admin());
-- passkeys, otp_codes: server only (no policies → denied to clients)

-- providers: public directory
create policy providers_read on providers for select using (true);
create policy providers_self_write on providers for update using (user_id = auth.uid());

-- verifications: own + admin
create policy verif_self on verifications for select using (user_id = auth.uid() or is_admin());

-- price_table: anyone reads; admin writes through the server
create policy price_read on price_table for select using (true);

-- requests: open ones are public, except women-only which only women providers (and the owner) see
create policy requests_read on requests for select using (
  client_id = auth.uid() or is_admin()
  or (status in ('open', 'assigned', 'in_progress', 'completed') and (not women_only or is_woman()))
);
create policy requests_owner_write on requests for update using (client_id = auth.uid());

create policy photos_read on photos for select using (
  owner_id = auth.uid() or portfolio
  or exists (select 1 from requests r where r.id = photos.request_id and (not r.women_only or is_woman()))
);

-- bids: request owner, the bidding provider, admin
create policy bids_read on bids for select using (
  provider_id = auth.uid() or is_admin()
  or exists (select 1 from requests r where r.id = bids.request_id and r.client_id = auth.uid())
);
create policy counters_read on counters for select using (
  exists (select 1 from bids b join requests r on r.id = b.request_id
          where b.id = counters.bid_id and (b.provider_id = auth.uid() or r.client_id = auth.uid()))
  or is_admin()
);

-- Q&A is public on visible requests
create policy questions_read on questions for select using (
  exists (select 1 from requests r where r.id = questions.request_id)
);

-- money: only the two parties and admin
create policy bookings_read on bookings for select using (client_id = auth.uid() or provider_id = auth.uid() or is_admin());
create policy installments_read on installments for select using (
  exists (select 1 from bookings b where b.id = installments.booking_id and (b.client_id = auth.uid() or b.provider_id = auth.uid()))
  or is_admin()
);
create policy payments_read on payments for select using (
  exists (select 1 from installments i join bookings b on b.id = i.booking_id
          where i.id = payments.installment_id and (b.client_id = auth.uid() or b.provider_id = auth.uid()))
  or is_admin()
);

create policy ratings_read on ratings for select using (true);
create policy passport_read on passport for select using (true);
create policy credit_self on credit_offers for select using (user_id = auth.uid());

create policy conv_read on conversations for select using (a_id = auth.uid() or b_id = auth.uid());
create policy msg_read on messages for select using (
  exists (select 1 from conversations c where c.id = messages.conversation_id and (c.a_id = auth.uid() or c.b_id = auth.uid()))
);
create policy notif_self on notifications for select using (user_id = auth.uid());
create policy notif_mark_read on notifications for update using (user_id = auth.uid());

create policy reports_self on reports for select using (reporter_id = auth.uid() or is_admin());
create policy disputes_read on disputes for select using (
  opened_by = auth.uid() or is_admin()
  or exists (select 1 from bookings b where b.id = disputes.booking_id and (b.client_id = auth.uid() or b.provider_id = auth.uid()))
);

-- Public profile view: safe columns only (no phone, no hashes)
create view public_profiles with (security_invoker = false) as
  select u.id, u.name, u.city, u.headline, p.categories, p.level, p.rating, p.rating_count, p.jobs_done,
         p.response_minutes, p.price_min, p.price_max, p.women_led, p.online_ok, p.area
  from users u join providers p on p.user_id = u.id;
grant select on public_profiles to anon, authenticated;

-- ============================================================ realtime
alter publication supabase_realtime add table bids, counters, installments, payments, messages, notifications;

-- ============================================================ storage (run once)
-- insert into storage.buckets (id, name, public) values ('id-docs', 'id-docs', false);   -- private: ID photos
-- insert into storage.buckets (id, name, public) values ('task-photos', 'task-photos', false);
-- insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true);
