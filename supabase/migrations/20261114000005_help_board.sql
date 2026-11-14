-- PLAN 25: Neighbour Help Board. A user asks for small help; other users offer; the requester scans the
-- first helper's QR code, which closes the request and gives that helper +5 (reliability_log reason
-- HELPED, event_id null). An open request is hidden 24 hours after it was posted (expires_at).

create table public.help_requests (
    id           uuid primary key default gen_random_uuid(),
    requester_id uuid not null references public.profiles (id) on delete cascade,
    title        text not null check (length(title) between 3 and 80),
    description  text check (description is null or length(description) <= 500),
    category     text not null check (category in ('BORROW', 'CARRY', 'PETS', 'ERRANDS', 'REPAIRS', 'OTHER')),
    address      text check (address is null or length(address) <= 120),
    lat          double precision check (lat is null or lat between -90 and 90),
    lon          double precision check (lon is null or lon between -180 and 180),
    -- EXPIRED is never stored: an OPEN request past expires_at is shown as EXPIRED.
    status       text not null default 'OPEN' check (status in ('OPEN', 'HELPED', 'CANCELLED')),
    created_at   timestamptz not null default now(),
    expires_at   timestamptz not null,
    closed_at    timestamptz,
    -- The helper whose QR code was scanned (kept null if that profile is deleted).
    helper_id    uuid references public.profiles (id) on delete set null,
    constraint help_requests_location check ((lat is null) = (lon is null)),
    constraint help_requests_closed check ((status = 'OPEN') = (closed_at is null)),
    constraint help_requests_lifetime check (expires_at > created_at)
);

-- The board: open requests, newest first.
create index help_requests_open_idx on public.help_requests (created_at desc) where status = 'OPEN';
-- "My requests" and the foreign keys.
create index help_requests_requester_idx on public.help_requests (requester_id, created_at desc);
create index help_requests_helper_idx on public.help_requests (helper_id);

alter table public.help_requests enable row level security;

create table public.help_offers (
    request_id    uuid not null references public.help_requests (id) on delete cascade,
    helper_id     uuid not null references public.profiles (id) on delete cascade,
    status        text not null default 'OFFERED'
                  check (status in ('OFFERED', 'WITHDRAWN', 'HELPED', 'NOT_NEEDED')),
    -- Shown as a QR code by the helper, scanned by the requester.
    qr_token      uuid not null unique default gen_random_uuid(),
    offered_at    timestamptz not null default now(),
    checked_in_at timestamptz,
    primary key (request_id, helper_id),
    -- Only the scanned helper has a check-in time.
    constraint help_offers_checkin check ((status = 'HELPED') = (checked_in_at is not null))
);

-- At most one scanned helper per request (the first scan closes it).
create unique index help_offers_one_helper_idx on public.help_offers (request_id) where status = 'HELPED';
-- "Requests I offered on" and the helper foreign key.
create index help_offers_helper_idx on public.help_offers (helper_id);

alter table public.help_offers enable row level security;
