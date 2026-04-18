create table public.courses (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  experience_level text,
  goal text,
  pdf_text text,
  course_title text,
  learner_goal text,
  created_at timestamptz default now()
);
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  content text not null,
  summary text,
  order_index int not null
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections(id) on delete cascade,
  question text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  order_index int default 0
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections(id) on delete cascade,
  selected_answer text,
  is_correct boolean,
  created_at timestamptz default now()
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);
alter table public.courses enable row level security;
alter table public.sections enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.chat_messages enable row level security;
create policy "public read courses" on public.courses for select using (true);
create policy "public insert courses" on public.courses for insert with check (true);
create policy "public read sections" on public.sections for select using (true);
create policy "public insert sections" on public.sections for insert with check (true);
create policy "public read quiz_questions" on public.quiz_questions for select using (true);
create policy "public insert quiz_questions" on public.quiz_questions for insert with check (true);
create policy "public read quiz_attempts" on public.quiz_attempts for select using (true);
create policy "public insert quiz_attempts" on public.quiz_attempts for insert with check (true);
create policy "public read chat_messages" on public.chat_messages for select using (true);
create policy "public insert chat_messages" on public.chat_messages for insert with check (true);