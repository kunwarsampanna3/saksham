-- Super Admin dashboard: withdrawal review, finance holds and an append-only finance log.
-- Nothing here changes how job money is split (50% in → 30% paid, 20% held; 50% in → 30% paid, 40% held; 40% on approval).

-- A booking the Super Admin put on hold: no money leaves escrow for the applicant until it is lifted.
alter table bookings add column if not exists finance_hold jsonb;

-- Withdrawals can wait for the Super Admin. Old rows are all 'sent_sandbox' and stay valid.
alter table payouts drop constraint if exists payouts_status_check;
alter table payouts add constraint payouts_status_check
  check (status in ('requested', 'on_hold', 'sent_sandbox', 'rejected'));
alter table payouts add column if not exists review jsonb;  -- {at, by, byName, reason}

-- Every finance action by the Super Admin. Append-only: the triggers refuse updates and deletes,
-- so history can't be rewritten, even with the service role.
create table if not exists finance_events (
  id uuid primary key,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists finance_events_created on finance_events(created_at);
alter table finance_events enable row level security;  -- no policies: only the server reads or writes it

create or replace function finance_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'finance_events is append-only';
end;
$$;
drop trigger if exists finance_events_no_update on finance_events;
create trigger finance_events_no_update before update or delete on finance_events
  for each row execute function finance_events_append_only();
