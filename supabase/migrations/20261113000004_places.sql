-- PLAN 2.6: restaurants, cafés and other places imported from OpenStreetMap (PLAN 8).

create table public.places (
    id            uuid primary key default gen_random_uuid(),
    -- Id OpenStreetMap gave the place, e.g. 'node/2845091337'.
    -- Lets the import update existing rows instead of creating duplicates.
    osm_id        text not null unique,
    name          text not null,
    category      text not null,
    lat           double precision not null check (lat between -90 and 90),
    lon           double precision not null check (lon between -180 and 180),
    address       text,
    -- Raw OpenStreetMap opening_hours string, e.g. 'Mo-Fr 08:00-22:00'.
    opening_hours text,
    -- All other OpenStreetMap tags (cuisine, website, phone, ...).
    tags          jsonb not null default '{}'::jsonb
);

-- Category filter chips and map viewport queries (PLAN 8.3).
create index places_category_idx on public.places (category);
create index places_lat_lon_idx on public.places (lat, lon);

alter table public.places enable row level security;
