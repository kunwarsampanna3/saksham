-- Step 3: saved location (area centroid only) and provider service radius on users.
alter table users add column if not exists area text;
alter table users add column if not exists lat double precision;
alter table users add column if not exists lng double precision;
alter table users add column if not exists radius_km int check (radius_km between 1 and 100);
