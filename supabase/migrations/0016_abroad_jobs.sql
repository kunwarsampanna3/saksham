-- Hire Nepalis abroad: jobs with several workers. Each hire is a normal request + booking.
create table if not exists abroad_jobs (
  id uuid primary key,
  client_id uuid not null references users(id) on delete cascade,
  is_demo boolean not null default false,
  data jsonb not null
);
create index if not exists abroad_jobs_client on abroad_jobs(client_id);
-- No policies: only the server (service role) reads or writes these.
alter table abroad_jobs enable row level security;

alter table requests add column if not exists abroad jsonb;
