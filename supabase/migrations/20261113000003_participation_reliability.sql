-- PLAN 2.4, 2.5: who joined which event, and the history behind each reliability score.

create table public.event_participants (
    event_id      uuid not null references public.events (id) on delete cascade,
    user_id       uuid not null references public.profiles (id) on delete cascade,
    status        text not null default 'JOINED'
                  check (status in ('JOINED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'BANNED')),
    -- Shown as a QR code by the participant, scanned by the organiser (PLAN 6).
    qr_token      uuid not null unique default gen_random_uuid(),
    joined_at     timestamptz not null default now(),
    checked_in_at timestamptz,
    primary key (event_id, user_id),
    -- Only attended participants have a check-in time.
    constraint event_participants_checkin check ((status = 'ATTENDED') = (checked_in_at is not null))
);

-- "Events I joined" and the user foreign key.
create index event_participants_user_id_idx on public.event_participants (user_id);

alter table public.event_participants enable row level security;

create table public.reliability_log (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references public.profiles (id) on delete cascade,
    -- Kept when the event is deleted, so the score history stays explainable.
    event_id      uuid references public.events (id) on delete set null,
    -- Points added or removed by this entry, e.g. +5 or -10.
    points_change integer not null check (points_change <> 0),
    reason        text not null,
    created_at    timestamptz not null default now()
);

-- Recent entries for a profile (PLAN 6.4).
create index reliability_log_user_created_idx on public.reliability_log (user_id, created_at desc);
create index reliability_log_event_id_idx on public.reliability_log (event_id);

alter table public.reliability_log enable row level security;
