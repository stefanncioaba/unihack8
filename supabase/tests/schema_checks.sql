-- Schema tests for PLAN task 2. Safe to run on the real database:
-- everything runs in one DO block that always ends with an exception,
-- so every row it inserts is rolled back.
-- Result: the error message is 'SCHEMA CHECKS PASSED (n checks)' or
-- 'SCHEMA CHECK FAILED: <which one>'.

do $$
declare
    u1 uuid := gen_random_uuid();
    u2 uuid := gen_random_uuid();
    u3 uuid := gen_random_uuid();
    ev uuid;
    n  integer := 0;
    v_name  text;
    v_score integer;
    v_token uuid;
-- Each "must fail" check below is a nested block: if the bad statement is
-- accepted, the block raises SCHEMA CHECK FAILED (not caught by its handler).
begin
    -- 1. Sign-up creates a profile with the chosen username and 100 points.
    insert into auth.users (id, email, raw_user_meta_data)
        values (u1, 'schema-test-1@example.test', '{"username":"Test_User"}');
    select username, reliability_score into v_name, v_score from public.profiles where id = u1;
    if v_name is distinct from 'Test_User' or v_score is distinct from 100 then
        raise exception 'SCHEMA CHECK FAILED: profile not created on sign-up (got %, %)', v_name, v_score;
    end if;
    n := n + 1;

    -- 2. Same username in other case does not block sign-up; a generated name is used.
    insert into auth.users (id, email, raw_user_meta_data)
        values (u2, 'schema-test-2@example.test', '{"username":"test_user"}');
    select username into v_name from public.profiles where id = u2;
    if v_name is distinct from 'user_' || substr(replace(u2::text, '-', ''), 1, 8) then
        raise exception 'SCHEMA CHECK FAILED: taken username fallback (got %)', v_name;
    end if;
    n := n + 1;

    -- 3. Sign-up without a username gets a generated one.
    insert into auth.users (id, email) values (u3, 'schema-test-3@example.test');
    select username into v_name from public.profiles where id = u3;
    if v_name is null or v_name !~ '^user_[0-9a-f]{8}$' then
        raise exception 'SCHEMA CHECK FAILED: missing username fallback (got %)', v_name;
    end if;
    n := n + 1;

    -- 4. Usernames are unique ignoring case.
    begin
        update public.profiles set username = 'TEST_USER' where id = u3;
        raise exception 'SCHEMA CHECK FAILED: case-insensitive username uniqueness';
    exception when unique_violation then n := n + 1;
    end;

    -- 5. Invalid username format is rejected.
    begin
        update public.profiles set username = 'ab' where id = u3;
        raise exception 'SCHEMA CHECK FAILED: short username accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 6. Reliability score cannot go below 0.
    begin
        update public.profiles set reliability_score = -1 where id = u1;
        raise exception 'SCHEMA CHECK FAILED: negative reliability score accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 7. A USER event needs an organiser.
    begin
        insert into public.events (source, title, starts_at) values ('USER', 'No organiser', now());
        raise exception 'SCHEMA CHECK FAILED: USER event without organiser accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 8. An EXTERNAL event needs an external id.
    begin
        insert into public.events (source, title, starts_at) values ('EXTERNAL', 'No external id', now());
        raise exception 'SCHEMA CHECK FAILED: EXTERNAL event without external_id accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 9. Source must be USER or EXTERNAL.
    begin
        insert into public.events (source, title, starts_at, external_id) values ('LIVETICKETS', 'Bad source', now(), 'x:1');
        raise exception 'SCHEMA CHECK FAILED: unknown source accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 10. The same external event cannot be imported twice.
    insert into public.events (source, external_id, title, starts_at)
        values ('EXTERNAL', 'livetickets:schema-test', 'Imported', now());
    begin
        insert into public.events (source, external_id, title, starts_at)
            values ('EXTERNAL', 'livetickets:schema-test', 'Imported again', now());
        raise exception 'SCHEMA CHECK FAILED: duplicate external_id accepted';
    exception when unique_violation then n := n + 1;
    end;

    -- 11. An event cannot end before it starts.
    begin
        insert into public.events (source, organizer_id, title, starts_at, ends_at)
            values ('USER', u1, 'Backwards', now(), now() - interval '1 hour');
        raise exception 'SCHEMA CHECK FAILED: end before start accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 12. Coordinates come in pairs.
    begin
        insert into public.events (source, organizer_id, title, starts_at, lat)
            values ('USER', u1, 'Half location', now(), 45.75);
        raise exception 'SCHEMA CHECK FAILED: lat without lon accepted';
    exception when check_violation then n := n + 1;
    end;

    -- 13. Joining creates a QR token; joining twice is rejected.
    insert into public.events (source, organizer_id, title, starts_at, capacity, lat, lon)
        values ('USER', u1, 'Valid event', now() + interval '1 day', 10, 45.7537, 21.2257)
        returning id into ev;
    insert into public.event_participants (event_id, user_id) values (ev, u2)
        returning qr_token into v_token;
    if v_token is null then
        raise exception 'SCHEMA CHECK FAILED: qr_token not generated';
    end if;
    n := n + 1;
    begin
        insert into public.event_participants (event_id, user_id) values (ev, u2);
        raise exception 'SCHEMA CHECK FAILED: double join accepted';
    exception when unique_violation then n := n + 1;
    end;

    -- 14. ATTENDED requires a check-in time, and only ATTENDED has one.
    begin
        update public.event_participants set status = 'ATTENDED' where event_id = ev and user_id = u2;
        raise exception 'SCHEMA CHECK FAILED: ATTENDED without check-in time accepted';
    exception when check_violation then n := n + 1;
    end;
    update public.event_participants set status = 'ATTENDED', checked_in_at = now()
        where event_id = ev and user_id = u2;
    n := n + 1;

    -- 15. A reliability log entry must change the score.
    begin
        insert into public.reliability_log (user_id, event_id, points_change, reason) values (u2, ev, 0, 'nothing');
        raise exception 'SCHEMA CHECK FAILED: zero points_change accepted';
    exception when check_violation then n := n + 1;
    end;
    insert into public.reliability_log (user_id, event_id, points_change, reason) values (u2, ev, 5, 'attended');

    -- 16. Deleting an event keeps the log entry (event_id set to null) and removes participants.
    delete from public.events where id = ev;
    if exists (select 1 from public.event_participants where event_id = ev) then
        raise exception 'SCHEMA CHECK FAILED: participants not removed with event';
    end if;
    if not exists (select 1 from public.reliability_log where user_id = u2 and event_id is null) then
        raise exception 'SCHEMA CHECK FAILED: reliability log lost with event';
    end if;
    n := n + 1;

    -- 17. Places: osm_id is unique.
    insert into public.places (osm_id, name, category, lat, lon) values ('node/schema-test', 'Test Cafe', 'cafe', 45.75, 21.22);
    begin
        insert into public.places (osm_id, name, category, lat, lon) values ('node/schema-test', 'Duplicate', 'cafe', 45.75, 21.22);
        raise exception 'SCHEMA CHECK FAILED: duplicate osm_id accepted';
    exception when unique_violation then n := n + 1;
    end;

    -- 18. Deleting an auth user removes the profile.
    delete from auth.users where id = u3;
    if exists (select 1 from public.profiles where id = u3) then
        raise exception 'SCHEMA CHECK FAILED: profile not removed with auth user';
    end if;
    n := n + 1;

    -- 19. Row Level Security is on for every app table.
    if exists (
        select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace
        where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ) then
        raise exception 'SCHEMA CHECK FAILED: a public table has RLS off';
    end if;
    n := n + 1;

    -- Always roll back.
    raise exception 'SCHEMA CHECKS PASSED (% checks)', n;
end;
$$;
