-- Step 7: dashboard, messages (text / voice / photo / system), notifications.

alter table conversations rename column a_id to client_id;
alter table conversations rename column b_id to provider_id;
alter table conversations add column if not exists last_at timestamptz not null default now();
create unique index if not exists conversations_unique on conversations(client_id, provider_id, coalesce(request_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table messages drop column if exists storage_path;
alter table messages add column if not exists system jsonb;                         -- {code, params}
alter table messages add column if not exists file jsonb;                           -- {id,path,mime,size,label,durationSec}
alter table messages add column if not exists read_by uuid[] not null default '{}';

-- notifications are rendered from a code + params in the reader's language
alter table notifications add column if not exists code text not null default '';
alter table notifications add column if not exists params jsonb not null default '{}'::jsonb;
alter table notifications alter column title drop not null;

-- message policies were defined in 0001 (participants only); realtime already on messages + notifications
alter publication supabase_realtime add table conversations;
