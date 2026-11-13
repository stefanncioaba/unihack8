package com.unihack8.backend.common.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.support.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/** Fresh/stale/unavailable behaviour of the external-source cache (PLAN 9.1, 9.7). */
class StaleCacheTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-14T18:00:00Z"));
    private final StaleCache<String, String> cache = new StaleCache<>("test", Duration.ofSeconds(10), clock);
    private final AtomicInteger calls = new AtomicInteger();

    // Within the lifetime the source is asked only once.
    @Test
    void freshValueIsServedFromCache() {
        cache.get("k", k -> "v" + calls.incrementAndGet());
        clock.advance(Duration.ofSeconds(9));
        StaleCache.Result<String> second = cache.get("k", k -> "v" + calls.incrementAndGet());

        assertThat(second.value()).isEqualTo("v1");
        assertThat(second.stale()).isFalse();
        assertThat(second.fetchedAt()).isEqualTo(Instant.parse("2026-11-14T18:00:00Z"));
        assertThat(calls).hasValue(1);
    }

    // After the lifetime the source is asked again.
    @Test
    void expiredValueIsReloaded() {
        cache.get("k", k -> "v" + calls.incrementAndGet());
        clock.advance(Duration.ofSeconds(10));
        StaleCache.Result<String> second = cache.get("k", k -> "v" + calls.incrementAndGet());

        assertThat(second.value()).isEqualTo("v2");
        assertThat(second.fetchedAt()).isEqualTo(Instant.parse("2026-11-14T18:00:10Z"));
    }

    // Source down after a success: the old value comes back flagged stale.
    @Test
    void sourceFailureServesStaleValue() {
        cache.get("k", k -> "v1");
        clock.advance(Duration.ofMinutes(1));
        StaleCache.Result<String> result = cache.get("k", k -> {
            throw new IllegalStateException("down");
        });

        assertThat(result.value()).isEqualTo("v1");
        assertThat(result.stale()).isTrue();
        assertThat(result.fetchedAt()).isEqualTo(Instant.parse("2026-11-14T18:00:00Z"));
    }

    // Source down and nothing cached: 503 SOURCE_UNAVAILABLE.
    @Test
    void sourceFailureWithoutCacheIs503() {
        assertThatThrownBy(() -> cache.get("k", k -> {
            throw new IllegalStateException("down");
        }))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.SOURCE_UNAVAILABLE);
    }

    // Our own API errors (like 404) are not treated as outages.
    @Test
    void apiExceptionsPassThrough() {
        assertThatThrownBy(() -> cache.get("k", k -> {
            throw ApiException.notFound("Stop");
        }))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    // Keys are cached separately.
    @Test
    void keysAreIndependent() {
        assertThat(cache.get("a", k -> k + "!").value()).isEqualTo("a!");
        assertThat(cache.get("b", k -> k + "!").value()).isEqualTo("b!");
    }
}
