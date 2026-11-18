-- "Set up your account": chosen categories, marketing opt-in (off by default) and terms acceptance time.
alter table users add column if not exists categories text[] not null default '{}';
alter table users add column if not exists marketing_opt_in boolean not null default false;
alter table users add column if not exists terms_accepted_at timestamptz;
