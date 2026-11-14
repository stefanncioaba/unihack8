package com.unihack8.backend.news.domain.dto;

import java.time.Instant;

/**
 * GET /news item: one Timișoara article from a local news site (PLAN 27). Only the headline, a short summary and
 * the picture are shown; the app opens `url` for the full story on the site.
 *
 * @param id       stable id built from the article link
 * @param summary  plain text, at most news.summary-chars characters
 * @param imageUrl the site's picture, or null
 */
public record NewsItemDto(String id, String sourceId, String sourceName, String title, String summary, String url,
                          String imageUrl, Instant publishedAt) {
}
