-- 50% advance, paid posts, withdrawal fee, recruiter credit, admin dashboard.
-- Enum values must be committed before use, so nothing below uses them.
alter type plan_kind add value if not exists 'advance';
alter type request_status add value if not exists 'expired';

alter table requests add column if not exists post jsonb;
alter table requests add column if not exists removed jsonb;
alter table bookings add column if not exists half_done_at timestamptz;

alter table payouts add column if not exists fee int not null default 0 check (fee >= 0);
alter table payouts add column if not exists fee_base int not null default 0 check (fee_base >= 0);

alter table credit_applications add column if not exists kind text not null default 'applicant'
  check (kind in ('applicant', 'recruiter'));
alter table credit_applications add column if not exists decided_at timestamptz;
alter table credit_applications add column if not exists decided_by uuid;
alter table credit_applications drop constraint if exists credit_applications_status_check;
alter table credit_applications add constraint credit_applications_status_check
  check (status in ('submitted_demo', 'approved_demo', 'declined_demo'));

alter table users add column if not exists suspended jsonb;

create table if not exists site_controls (
  id int primary key check (id = 1),
  data jsonb not null
);
create table if not exists traffic_days (
  day date primary key,
  data jsonb not null
);
create table if not exists admin_audit (
  id uuid primary key,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists admin_audit_created on admin_audit(created_at desc);
-- No policies: only the server (service role) reads or writes these.
alter table site_controls enable row level security;
alter table traffic_days enable row level security;
alter table admin_audit enable row level security;
