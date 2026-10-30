-- Optional two-way link between a task and a calendar event (task -> event; event -> task via this column).
-- Additive only. Existing RLS policies are row-level on user_id and cover the new column.
alter table public.tasks
  add column calendar_event_id uuid references public.calendar_events(id) on delete set null;
create index tasks_calendar_event_idx on public.tasks (calendar_event_id) where calendar_event_id is not null;
