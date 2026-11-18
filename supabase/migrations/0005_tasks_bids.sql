-- Step 5: post wizard, task detail, offers, counters, Q&A.

-- requests (tasks)
alter table requests alter column client_id drop not null;               -- seeded example tasks have no client
alter table requests add column if not exists client_name text not null default '';
alter table requests add column if not exists title_ne text;
alter table requests add column if not exists quantity int not null default 1 check (quantity between 1 and 500);
alter table requests add column if not exists flexible boolean not null default true;
alter table requests add column if not exists family_country text;
alter table requests add column if not exists photos jsonb not null default '[]'::jsonb;   -- [{id,path,mime,size,label}]
alter table requests add column if not exists accepted_bid_id uuid;
alter table requests add column if not exists agreed_price int;
alter table requests drop column if exists for_family_abroad;
alter table requests rename column family_contact_name to family_name;

-- bids: example providers are not users, so the provider is referenced by text
alter table bids drop constraint if exists bids_request_id_provider_id_key;
alter table bids alter column provider_id drop not null;
alter table bids add column if not exists provider_ref text not null default '';      -- user uuid or "ex:<slug>"
alter table bids add column if not exists provider_name text not null default '';
alter table bids add column if not exists is_example boolean not null default false;
alter table bids add column if not exists counter jsonb;                              -- {amount,status,at,by}
alter table bids add column if not exists appear_at timestamptz not null default now();
alter table bids add column if not exists updated_at timestamptz not null default now();
create unique index if not exists bids_request_provider_ref on bids(request_id, provider_ref);

-- questions
alter table questions add column if not exists asker_name text not null default '';

-- Providers may insert their own bid; clients may update their own requests (server routes use the service role)
create policy bids_insert_own on bids for insert with check (provider_id = auth.uid());
create policy questions_insert_own on questions for insert with check (asker_id = auth.uid());
