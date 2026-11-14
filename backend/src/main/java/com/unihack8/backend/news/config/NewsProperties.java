package com.unihack8.backend.news.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Timișoara news settings (prefix "news", PLAN 26). Defaults work as-is; a source list in the properties
 * replaces the default one.
 *
 * @param ttl            how long a site's articles stay fresh in our cache (the sites are asked at most this often)
 * @param connectTimeout max wait to open a connection
 * @param readTimeout    max wait for a feed, so a slow site never hangs our API
 * @param userAgent      identifies our app to the news sites
 * @param summaryChars   longest summary shown for an article (we never copy whole articles)
 * @param warmUp         read every site once in the background when the app starts (some sites take ~10 s);
 *                       off in tests
 * @param sources        news sites to read; empty = DEFAULT_SOURCES
 */
@ConfigurationProperties(prefix = "news")
public record NewsProperties(
        @DefaultValue("10m") Duration ttl,
        @DefaultValue("4s") Duration connectTimeout,
        @DefaultValue("15s") Duration readTimeout,
        @DefaultValue("unihack8-timisoara-app (hackathon demo)") String userAgent,
        @DefaultValue("220") int summaryChars,
        @DefaultValue("true") boolean warmUp,
        List<Source> sources) {

    /** Local news sites whose RSS feeds were checked on 2026-11-14 (all WordPress). */
    public static final List<Source> DEFAULT_SOURCES = List.of(
            new Source("tion", "TION", "https://www.tion.ro", "https://www.tion.ro/feed/", false),
            new Source("opinia", "Opinia Timișoarei", "https://www.opiniatimisoarei.ro",
                    "https://www.opiniatimisoarei.ro/feed/", true),
            new Source("timisoarastiri", "Timișoara Știri", "https://timisoarastiri.ro",
                    "https://timisoarastiri.ro/feed/", true),
            new Source("banatulazi", "Banatul Azi", "https://www.banatulazi.ro", "https://www.banatulazi.ro/feed/", true));

    /**
     * One news site.
     *
     * @param id              short id used in the API (?source=tion)
     * @param name            name shown in the app
     * @param siteUrl         home page; also the base of its WordPress API
     * @param feedUrl         RSS feed
     * @param wordpressImages the feed has few pictures: take each article's main image from the site's WordPress API
     */
    public record Source(String id, String name, String siteUrl, String feedUrl,
                         @DefaultValue("false") boolean wordpressImages) {
    }

    // The configured sources, or the default ones.
    public List<Source> sourcesOrDefault() {
        return sources == null || sources.isEmpty() ? DEFAULT_SOURCES : sources;
    }
}
