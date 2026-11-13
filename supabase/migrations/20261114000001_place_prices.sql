-- PLAN 11.3 (team decision 2026-11-13): prices come from a stored, researched price list,
-- because Gemini's Google Search grounding is not in the free tier any more.
-- One row = one menu item at one place. place_name matches places.name (or the OSM "brand" tag)
-- case-insensitively, so a chain's price covers every branch.

create table public.place_prices (
    id          uuid primary key default gen_random_uuid(),
    place_name  text not null,
    item        text not null,
    item_type   text not null check (item_type in ('COFFEE', 'PIZZA', 'FOOD', 'BEER', 'DRINK')),
    price_lei   numeric(8, 2) not null check (price_lei >= 0),
    size        text,
    source_type text not null check (source_type in ('official', 'delivery_app', 'review', 'article')),
    source_url  text,
    source_date text,
    note        text,
    created_at  timestamptz not null default now()
);

create index place_prices_name_idx on public.place_prices (lower(place_name));

-- Same rule as every other table (PLAN 2.8): only the Spring API reads it.
alter table public.place_prices enable row level security;
