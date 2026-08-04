-- شِبْه بيئة Supabase للاختبار المحلّي فقط (ليس للإنتاج).
-- يوفّر: أدوار anon/authenticated/service_role، مخطّط auth، auth.uid()،
-- ومُطلِق auth.users كي يعمل on_auth_user_created.

create schema if not exists extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon')          then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role')  then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login; end if;
end $$;
grant anon, authenticated, service_role to authenticator;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
grant usage on schema auth to anon, authenticated, service_role;

-- auth.uid(): يقرأ sub من مطالبات JWT المحقونة في إعداد الجلسة (كما في Supabase).
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub','')::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role','anon');
$$;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;
