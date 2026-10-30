-- Personal Command Center: full database setup.
-- Paste this whole file into the Supabase SQL Editor and click Run. Run it once, on a new project.
-- Generated from supabase/migrations/ (in order). Do not edit here; edit the migrations instead.

-- ===== 20261029000000_init.sql =====
-- Command center schema. Every table is owner-scoped with RLS; anon has no table access at all.

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  notes text,
  due_date date,
  priority text not null default 'med' check (priority in ('low','med','high')),
  done boolean not null default false,
  done_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_due_idx on public.tasks (user_id, done, due_date);

-- reminders
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  due_at timestamptz,
  critical boolean not null default false,
  acknowledged_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_user_open_idx on public.reminders (user_id, acknowledged_at, due_at);

-- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  kind text not null default 'note' check (kind in ('note','research','briefing','pdf','other')),
  body_md text not null default '',
  tags text[] not null default '{}',
  attachment_path text,
  source text,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_md, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_fts_idx on public.documents using gin (fts);
create index documents_user_updated_idx on public.documents (user_id, updated_at desc);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  to_name text,
  to_email text,
  subject text not null default '',
  body_md text not null default '',
  status text not null default 'draft' check (status in ('draft','sent','failed')),
  sent_at timestamptz,
  thread_ref text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_user_idx on public.messages (user_id, status, updated_at desc);

-- activity (append-only)
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null check (actor in ('assistant','scheduled-task','user')),
  action text not null,
  detail text,
  ref_table text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_user_created_idx on public.activity (user_id, created_at desc);

-- calendar_events
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  title text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  meet_url text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);
create index calendar_events_user_start_idx on public.calendar_events (user_id, starts_at);

-- triage_rules (one row per user)
create table public.triage_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  vip jsonb not null default '[]'::jsonb check (jsonb_typeof(vip) = 'array'),
  keywords text[] not null default '{}',
  muted text[] not null default '{}',
  critical_triggers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- api_tokens (only sha256 hex of the raw token is stored)
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index api_tokens_user_idx on public.api_tokens (user_id);

-- updated_at triggers, RLS, grants, owner-only policies
do $$
declare t text;
begin
  foreach t in array array['tasks','reminders','documents','messages','activity','calendar_events','triage_rules','api_tokens'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    if t <> 'activity' then
      execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
      execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
    end if;
  end loop;
end $$;

-- activity is append-only even for its owner
revoke update, delete, truncate on public.activity from authenticated;

-- Full-text search with snippets. SECURITY INVOKER: RLS still applies to signed-in callers;
-- the explicit user filter scopes service-role callers (MCP) to the owner.
create or replace function public.search_documents(p_user_id uuid, p_query text, p_limit int default 10)
returns table (id uuid, title text, kind text, snippet text, rank real, updated_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select d.id, d.title, d.kind,
         ts_headline('english', d.body_md, q, 'MaxWords=30, MinWords=10, MaxFragments=1, StartSel="", StopSel=""') as snippet,
         ts_rank(d.fts, q) as rank,
         d.updated_at
  from public.documents d, websearch_to_tsquery('english', p_query) q
  where d.user_id = p_user_id and d.fts @@ q
  order by rank desc, d.updated_at desc
  limit least(greatest(p_limit, 1), 50);
$$;
revoke execute on function public.search_documents(uuid, text, int) from public, anon;
grant execute on function public.search_documents(uuid, text, int) to authenticated, service_role;

-- Private storage bucket; objects live under "<user_id>/..."
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do update set public = false;

create policy attachments_select_own on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_update_own on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== 20261030000000_library.sql =====
-- Library: documents gain word-for-word kinds; tokens gain a scope so specialists can be read-only.
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check
  check (kind in ('note','research','briefing','pdf','other','contract','transcript','report','data'));

alter table public.api_tokens add column scope text not null default 'full'
  check (scope in ('full','read'));

-- ===== 20261030010000_grants.sql =====
-- Explicit table grants. Newer Supabase projects may not grant new public tables to the API roles
-- automatically ("Automatically expose new tables" off), which would break the app. RLS still gates every row.
do $$
declare t text;
begin
  foreach t in array array['tasks','reminders','documents','messages','activity','calendar_events','triage_rules','api_tokens'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- activity stays append-only for signed-in users.
revoke update, delete, truncate on public.activity from authenticated;

-- ===== 20261030100000_task_event_link.sql =====
-- Optional two-way link between a task and a calendar event (task -> event; event -> task via this column).
-- Additive only. Existing RLS policies are row-level on user_id and cover the new column.
alter table public.tasks
  add column calendar_event_id uuid references public.calendar_events(id) on delete set null;
create index tasks_calendar_event_idx on public.tasks (calendar_event_id) where calendar_event_id is not null;
