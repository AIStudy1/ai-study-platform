-- Per-course entry quiz, XP/level, and user energy (Duolingo-style hearts).
-- Apply after course_suggestions migration.

alter table public.ai_courses add column if not exists entry_quiz jsonb;
alter table public.ai_courses add column if not exists entry_quiz_passed boolean not null default false;
alter table public.ai_courses add column if not exists entry_quiz_score int;
alter table public.ai_courses add column if not exists course_xp int not null default 0;
alter table public.ai_courses add column if not exists course_level int not null default 1;

alter table public.users add column if not exists energy int not null default 5;
alter table public.users add column if not exists max_energy int not null default 5;
alter table public.users add column if not exists last_energy_refill_at timestamptz default now();

comment on column public.ai_courses.entry_quiz is 'Placement quiz JSON: { title, questions: [{ question, options[], answer }] }';
comment on column public.users.energy is 'Current energy/hearts; refills over time up to max_energy';
