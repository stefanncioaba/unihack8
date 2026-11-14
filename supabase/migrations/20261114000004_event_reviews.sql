-- Event reviews: checked-in attendees rate a user event 1-5 stars with an optional comment.
-- 24 hours after the event ends the average is settled once into the organiser's reliability score.

create table public.event_reviews (
    event_id    uuid not null references public.events (id) on delete cascade,
    reviewer_id uuid not null references public.profiles (id) on delete cascade,
    rating      smallint not null check (rating between 1 and 5),
    -- Optional short reason for the rating.
    comment     text check (comment is null or length(comment) <= 300),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    -- One review per attendee per event; saving again replaces it.
    primary key (event_id, reviewer_id)
);

-- "Reviews written by this user" and the reviewer foreign key.
create index event_reviews_reviewer_id_idx on public.event_reviews (reviewer_id);

alter table public.event_reviews enable row level security;

-- Set when the organiser's rating points were applied; reviews close at the same moment.
alter table public.events add column review_settled_at timestamptz;
