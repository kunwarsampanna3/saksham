-- Step 8: wallet payouts, ratings, Saksham Credit applications (demo partner).

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  amount int not null check (amount >= 100),
  method pay_method not null,
  ref text not null,                                    -- sandbox reference
  status text not null default 'sent_sandbox' check (status in ('sent_sandbox')),
  created_at timestamptz not null default now()
);
alter table payouts enable row level security;
create policy payouts_self on payouts for select using (user_id = auth.uid());

-- ratings: one per booking per rater; add the task for the public Passport
alter table ratings add column if not exists task_id uuid references requests(id) on delete set null;

create table if not exists credit_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  amount int not null check (amount between 1000 and 100000),
  months int not null check (months in (3, 6, 12)),
  purpose text not null check (char_length(purpose) between 3 and 300),
  limit_at_apply int not null,
  status text not null default 'submitted_demo' check (status in ('submitted_demo')),
  created_at timestamptz not null default now()
);
alter table credit_applications enable row level security;
create policy credit_apps_self on credit_applications for select using (user_id = auth.uid());
