package com.unihack8.backend.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Test clock that stays still until a test moves it forward (for cache lifetimes). */
public class MutableClock extends Clock {

    private Instant now;

    // Starts at the given instant, in UTC.
    public MutableClock(Instant start) {
        this.now = start;
    }

    // Moves time forward.
    public void advance(Duration by) {
        now = now.plus(by);
    }

    // Always UTC, like the real clock bean.
    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    // Zone changes are not needed in tests.
    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    // The current test time.
    @Override
    public Instant instant() {
        return now;
    }
}
