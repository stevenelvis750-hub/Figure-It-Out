create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('student', 'teacher')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  school_id uuid not null references public.schools(id) on delete restrict,
  stream text,
  class_name text,
  created_at timestamptz not null default now(),
  check (
    (role = 'teacher' and stream is null and class_name is null)
    or (role = 'student' and stream is not null and class_name is not null)
  )
);

create index if not exists profiles_school_role_class_idx
  on public.profiles (school_id, role, class_name, stream);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question_count integer not null check (question_count between 1 and 250),
  due_date date not null,
  stream text,
  class_name text,
  created_at timestamptz not null default now()
);

create index if not exists assignments_school_due_idx
  on public.assignments (school_id, due_date, created_at desc);

create table if not exists public.learning_activity (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  course text not null check (char_length(btrim(course)) between 1 and 120),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  correct_answers integer not null check (correct_answers >= 0),
  total_questions integer not null check (total_questions between 1 and 250),
  completed_at timestamptz not null default now(),
  check (correct_answers <= total_questions)
);

create index if not exists learning_activity_school_recent_idx
  on public.learning_activity (school_id, completed_at desc);
create index if not exists learning_activity_student_assignment_idx
  on public.learning_activity (student_id, assignment_id, completed_at desc);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.learning_activity enable row level security;

revoke all on public.schools, public.profiles, public.assignments, public.learning_activity
  from anon, authenticated;

grant all on public.schools, public.profiles, public.assignments, public.learning_activity
  to service_role;
grant usage, select on sequence public.learning_activity_id_seq to service_role;
