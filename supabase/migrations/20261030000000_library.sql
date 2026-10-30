-- Library: documents gain word-for-word kinds; tokens gain a scope so specialists can be read-only.
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check
  check (kind in ('note','research','briefing','pdf','other','contract','transcript','report','data'));

alter table public.api_tokens add column scope text not null default 'full'
  check (scope in ('full','read'));
