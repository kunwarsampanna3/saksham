-- Step 4: Verification center.
-- kinds become text so they match the app (phone, id, selfie, address, womenGroup).
alter table verifications alter column kind type text using kind::text;
update verifications set kind = 'id' where kind in ('citizenship', 'student_id');
update verifications set kind = 'womenGroup' where kind = 'women_group';
alter table verifications add constraint verifications_kind_chk check (kind in ('phone', 'id', 'selfie', 'address', 'womenGroup'));
alter table verifications drop column if exists storage_path;
alter table verifications add column if not exists files jsonb not null default '[]'::jsonb;      -- [{id,path,mime,size,label}]
alter table verifications add column if not exists fields jsonb not null default '{}'::jsonb;     -- docType, ward, tole, groupName…
alter table verifications add column if not exists submitted_at timestamptz;
alter table verifications add column if not exists purge_after timestamptz;                       -- documents deleted after this
drop type if exists verification_kind;

-- Denormalised badges shown across the app
alter table users add column if not exists verified boolean not null default false;
alter table users add column if not exists women_led boolean not null default false;

-- Private bucket for ID photos and selfies (service role only; no public access, no client policies)
insert into storage.buckets (id, name, public) values ('id-docs', 'id-docs', false) on conflict (id) do nothing;
