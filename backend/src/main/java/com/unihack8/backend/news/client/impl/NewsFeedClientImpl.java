package com.unihack8.backend.news.client.impl;

import com.unihack8.backend.news.client.NewsFeedClient;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Calls the news sites with the news RestClient (timeouts and our User-Agent). */
@Component
public class NewsFeedClientImpl implements NewsFeedClient {

    private static final Logger log = LoggerFactory.getLogger(NewsFeedClientImpl.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    /** WordPress API: the latest posts, only their link, featured image and Yoast's main image. */
    private static final String WP_POSTS = "/wp-json/wp/v2/posts?per_page=30&_embed=wp:featuredmedia"
            + "&_fields=link,yoast_head_json.og_image,_links,_embedded";

    private final RestClient http;

    // Uses the RestClient from NewsClientConfig.
    public NewsFeedClientImpl(@Qualifier("newsRestClient") RestClient http) {
        this.http = http;
    }

    // Plain GET of the feed.
    @Override
    public String fetchFeed(String feedUrl) {
        String body = http.get().uri(feedUrl).retrieve().body(String.class);
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("Empty news feed: " + feedUrl);
        }
        return body;
    }

    // Images are a nice-to-have: any error gives an empty map instead of failing the source.
    @Override
    public Map<String, String> fetchWordPressImages(String siteUrl) {
        Map<String, String> images = new HashMap<>();
        try {
            String body = http.get().uri(siteUrl.replaceAll("/+$", "") + WP_POSTS).retrieve().body(String.class);
            JsonNode posts = JSON.readTree(body == null ? "[]" : body);
            for (JsonNode post : posts) {
                String link = post.path("link").asString("");
                String image = post.path("_embedded").path("wp:featuredmedia").path(0).path("source_url").asString("");
                if (image.isBlank()) {
                    image = post.path("yoast_head_json").path("og_image").path(0).path("url").asString("");
                }
                if (!link.isBlank() && !image.isBlank()) {
                    images.put(link, image);
                }
            }
        } catch (RuntimeException e) {
            log.info("No WordPress images from {}: {}", siteUrl, e.getMessage());
        }
        return images;
    }
}
