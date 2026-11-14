package com.unihack8.backend.news.domain.model;

import java.time.Instant;
import java.util.List;

/**
 * One article as read from an RSS feed, before it is filtered and shortened.
 *
 * @param descriptionHtml the feed's short description (may hold HTML and the WordPress "appeared first on" footer)
 * @param contentHtml     the full text when the feed carries it (used only to decide if it is about Timișoara)
 * @param imageUrl        picture from the feed (enclosure, media tag or first image), or null
 */
public record FeedItem(String title, String link, String descriptionHtml, String contentHtml,
                       List<String> categories, Instant publishedAt, String imageUrl) {

    // The same article with another picture.
    public FeedItem withImage(String image) {
        return new FeedItem(title, link, descriptionHtml, contentHtml, categories, publishedAt, image);
    }
}
