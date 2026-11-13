package com.unihack8.backend.common.cache;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Small in-memory cache for slow external sources (STPT, later OTP).
 * Fresh values are served for {@code ttl}; after that the source is asked again. If the source
 * fails, the last value is served and marked stale; with nothing cached the caller gets
 * 503 SOURCE_UNAVAILABLE. Only one request per key goes to the source at a time.
 */
public class StaleCache<K, V> {

    private static final Logger log = LoggerFactory.getLogger(StaleCache.class);

    private final String name;
    private final Duration ttl;
    private final Clock clock;
    private final Map<K, Slot<V>> slots = new ConcurrentHashMap<>();

    /** A cached value, when it was fetched, and whether the latest refresh failed. */
    public record Result<V>(V value, Instant fetchedAt, boolean stale) {
    }

    // Holder for one key; also used as the lock so a key is fetched by one thread at a time.
    private static final class Slot<V> {
        private V value;
        private Instant fetchedAt;
    }

    // name is only used in log lines; ttl is how long a value counts as fresh.
    public StaleCache(String name, Duration ttl, Clock clock) {
        this.name = name;
        this.ttl = ttl;
        this.clock = clock;
    }

    // Returns the fresh cached value, or loads a new one, or falls back to the stale one.
    public Result<V> get(K key, Function<K, V> loader) {
        Slot<V> slot = slots.computeIfAbsent(key, k -> new Slot<>());
        synchronized (slot) {
            Instant now = clock.instant();
            if (slot.fetchedAt != null && slot.fetchedAt.plus(ttl).isAfter(now)) {
                return new Result<>(slot.value, slot.fetchedAt, false);
            }
            try {
                V loaded = loader.apply(key);
                slot.value = loaded;
                slot.fetchedAt = now;
                return new Result<>(loaded, now, false);
            } catch (ApiException e) {
                // Our own errors (e.g. 404) are not source outages: pass them through.
                throw e;
            } catch (RuntimeException e) {
                if (slot.fetchedAt != null) {
                    log.warn("{} source failed for {}, serving stale value: {}", name, key, e.toString());
                    return new Result<>(slot.value, slot.fetchedAt, true);
                }
                log.warn("{} source failed for {} and nothing is cached: {}", name, key, e.toString());
                throw new ApiException(ErrorCode.SOURCE_UNAVAILABLE);
            }
        }
    }
}
