package com.unihack8.backend.news.client;

import java.util.Map;

/** Reads the news sites (PLAN 27). Throws on network errors; the service's cache turns them into "stale". */
public interface NewsFeedClient {

    // The RSS feed as text.
    String fetchFeed(String feedUrl);

    // Main image of the site's latest posts from its WordPress API: article link -> image URL (empty when unknown).
    Map<String, String> fetchWordPressImages(String siteUrl);
}
