create table if not exists public.course_jobs (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'pending'
                check (status in ('pending', 'running', 'complete', 'error')),
  course_id   uuid references public.courses(id) on delete set null,
  error       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.course_jobs enable row level security;
create policy "public_all" on public.course_jobs for all using (true) with check (true);
