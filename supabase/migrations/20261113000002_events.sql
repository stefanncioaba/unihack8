-- PLAN 2.3: events, both user-created (USER) and imported from other platforms (EXTERNAL).

create table public.events (
    id           uuid primary key default gen_random_uuid(),
    source       text not null check (source in ('USER', 'EXTERNAL')),
    -- Id on the source platform, prefixed with its name, e.g. 'livetickets:<id>'.
    external_id  text unique,
    title        text not null check (length(trim(title)) > 0),
    description  text,
    category     text,
    venue_name   text,
    address      text,
    lat          double precision check (lat between -90 and 90),
    lon          double precision check (lon between -180 and 180),
    starts_at    timestamptz not null,
    ends_at      timestamptz,
    -- null = unlimited spots.
    capacity     integer check (capacity > 0),
    -- null for imported events.
    organizer_id uuid references public.profiles (id) on delete cascade,
    image_url    text,
    -- Prices in lei (LiveTickets); null for free or user events.
    price_min    numeric(10, 2) check (price_min >= 0),
    price_max    numeric(10, 2) check (price_max >= 0),
    external_url text,
    created_at   timestamptz not null default now(),

    -- User events have an organiser and no external id; imported events have an external id.
    constraint events_source_fields check (
        (source = 'USER' and organizer_id is not null and external_id is null)
        or (source = 'EXTERNAL' and external_id is not null)
    ),
    -- Coordinates are both set or both missing (imports that could not be located).
    constraint events_coordinates_pair check ((lat is null) = (lon is null)),
    constraint events_end_after_start check (ends_at is null or ends_at > starts_at),
    constraint events_price_range check (price_min is null or price_max is null or price_max >= price_min)
);

-- Upcoming-events lists and date filters (PLAN 5.1).
create index events_starts_at_idx on public.events (starts_at);
-- Map viewport (bbox) queries.
create index events_lat_lon_idx on public.events (lat, lon);
-- "Events I organise" and the organiser foreign key.
create index events_organizer_id_idx on public.events (organizer_id);
-- Fuzzy title search.
create index events_title_trgm_idx on public.events
    using gin (title extensions.gin_trgm_ops);

alter table public.events enable row level security;
