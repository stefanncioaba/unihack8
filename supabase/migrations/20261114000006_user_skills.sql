-- PLAN 28: user skills and more Help Board categories.
-- Every user can list up to 10 skills (e.g. "Carpentry" in CARPENTRY) on their profile. A skill's
-- category is one of the Help Board categories, so a requester sees which helpers fit the request.

-- More kinds of help (the first six are unchanged).
alter table public.help_requests drop constraint help_requests_category_check;
alter table public.help_requests add constraint help_requests_category_check check (category in (
    'BORROW', 'CARRY', 'PETS', 'ERRANDS', 'REPAIRS', 'CARPENTRY', 'PLUMBING', 'ELECTRICAL', 'PAINTING',
    'GARDENING', 'CLEANING', 'TECH', 'TUTORING', 'COOKING', 'BIKES', 'CARS', 'ELDERLY', 'OTHER'));

create table public.user_skills (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles (id) on delete cascade,
    name       text not null check (length(name) between 2 and 40),
    category   text not null check (category in (
        'BORROW', 'CARRY', 'PETS', 'ERRANDS', 'REPAIRS', 'CARPENTRY', 'PLUMBING', 'ELECTRICAL', 'PAINTING',
        'GARDENING', 'CLEANING', 'TECH', 'TUTORING', 'COOKING', 'BIKES', 'CARS', 'ELDERLY', 'OTHER')),
    created_at timestamptz not null default now()
);

-- The same skill name only once per person (ignoring case); also serves "skills of a user".
create unique index user_skills_user_name_idx on public.user_skills (user_id, lower(name));

alter table public.user_skills enable row level security;
