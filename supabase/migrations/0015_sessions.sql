-- Sign-out and MPIN reset end sessions on the server.
alter table users add column if not exists session_version int not null default 0;
alter table users add column if not exists revoked_sessions jsonb not null default '[]'::jsonb;
