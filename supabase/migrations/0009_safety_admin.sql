-- Step 9: safety (trusted contacts, report, block), hire-from-abroad family confirmation, admin price edits.

alter table users add column if not exists trusted_contacts jsonb not null default '[]'::jsonb;  -- [{name, phone}] max 3
alter table bookings add column if not exists family jsonb;                                       -- {name, tokenHash, confirmations[]}

alter table reports rename column target_request to target_task;
alter table reports add column if not exists details text not null default '';
alter table reports add column if not exists updated_at timestamptz not null default now();
alter table reports drop constraint if exists reports_reason_check;
alter table reports add constraint reports_reason_chk check (reason in ('fraud', 'harassment', 'unsafe', 'off_platform', 'fake', 'other'));

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table blocks enable row level security;
create policy blocks_self on blocks for select using (blocker_id = auth.uid());

-- Admin price edits write straight into price_table (updated_by / updated_at already exist).
