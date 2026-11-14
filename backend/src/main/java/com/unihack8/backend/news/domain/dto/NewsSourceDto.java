package com.unihack8.backend.news.domain.dto;

import java.time.Instant;

/**
 * GET /news/sources item: one news site and how its feed is doing (PLAN 26).
 *
 * @param available    false when the site could not be read and nothing is cached
 * @param stale        true when the last read failed and older articles are shown
 * @param articleCount Timișoara articles currently kept from this site
 * @param updatedAt    when the site was last read successfully; null when never
 */
public record NewsSourceDto(String id, String name, String siteUrl, boolean available, boolean stale,
                            int articleCount, Instant updatedAt) {
}
