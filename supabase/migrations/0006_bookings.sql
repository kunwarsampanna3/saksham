-- Step 6: booking, installments (escrow), receipts, Service Guarantee disputes.

-- bookings: example providers are not users, so reference them by text
alter table bookings alter column provider_id drop not null;
alter table bookings add column if not exists provider_ref text not null default '';
alter table bookings add column if not exists provider_name text not null default '';
alter table bookings add column if not exists provider_is_example boolean not null default false;
alter table bookings add column if not exists fee_rate numeric(4,3) not null default 0.07;
alter table bookings add column if not exists method pay_method not null default 'esewa_sandbox';
alter table bookings add column if not exists status text not null default 'active' check (status in ('active', 'completed', 'disputed', 'refunded'));
alter table bookings add column if not exists updated_at timestamptz not null default now();

-- installments carry their own escrow timeline
alter table installments add column if not exists pct int not null default 100;
alter table installments add column if not exists held_at timestamptz;
alter table installments add column if not exists delivered_at timestamptz;
alter table installments add column if not exists released_at timestamptz;
alter table installments add column if not exists refunded_at timestamptz;

-- receipts (sandbox references only in this build)
alter table payments add column if not exists booking_id uuid references bookings(id) on delete cascade;
alter table payments add column if not exists fee int not null default 0;

-- Service Guarantee
alter table disputes add column if not exists role text not null default 'client' check (role in ('client', 'provider'));
alter table disputes add column if not exists wanted text not null default 'redo' check (wanted in ('redo', 'refund'));

-- Money changes only happen through server routes (service role). No client insert/update policies on purpose.
alter publication supabase_realtime add table bookings;
