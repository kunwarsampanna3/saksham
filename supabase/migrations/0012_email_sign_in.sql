-- Sign in with phone OR email. Phone becomes optional (email-only accounts); email is unique and lower-case.
alter table users alter column phone drop not null;
alter table users drop constraint if exists users_phone_check;
alter table users add constraint users_phone_check check (phone is null or phone ~ '^9[78][0-9]{8}$');
alter table users add column if not exists email text unique check (email is null or (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'));
alter table users add constraint users_phone_or_email check (phone is not null or email is not null);
-- OTP rows are keyed by '<purpose>:<phone or email>' (the column keeps its old name).
