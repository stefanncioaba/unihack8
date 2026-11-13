-- PLAN 2.1, 2.2: user profiles, created automatically when someone signs up.

-- Trigram search (fuzzy username / event title search, PLAN 2.7).
create extension if not exists pg_trgm with schema extensions;

-- One row per signed-up user. id is the same as auth.users.id.
create table public.profiles (
    id                uuid primary key references auth.users (id) on delete cascade,
    username          text not null
                      check (username ~ '^[A-Za-z0-9_]{3,20}$'),
    reliability_score integer not null default 100
                      check (reliability_score >= 0),
    created_at        timestamptz not null default now()
);

-- Usernames are unique ignoring case ("Stefan" and "stefan" clash).
create unique index profiles_username_lower_key on public.profiles (lower(username));

-- Fuzzy username search (PLAN 4.3).
create index profiles_username_trgm_idx on public.profiles
    using gin (username extensions.gin_trgm_ops);

-- The app only reaches this table through the Spring API (PLAN 2.8).
alter table public.profiles enable row level security;

-- Creates the profile for a new auth user.
-- Username comes from sign-up metadata ({ "username": "..." }); if it is
-- missing, invalid or already taken, a generated "user_xxxxxxxx" is used so
-- sign-up never fails. The user can change it later (PLAN 4.2).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    wanted    text := new.raw_user_meta_data ->> 'username';
    generated text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
    if wanted is null or wanted !~ '^[A-Za-z0-9_]{3,20}$' then
        wanted := generated;
    end if;

    begin
        insert into public.profiles (id, username) values (new.id, wanted);
    exception when unique_violation then
        insert into public.profiles (id, username) values (new.id, generated);
    end;

    return new;
end;
$$;

-- Nobody calls this function directly; only the trigger below.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
