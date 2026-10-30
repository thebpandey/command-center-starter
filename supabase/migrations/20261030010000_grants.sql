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
