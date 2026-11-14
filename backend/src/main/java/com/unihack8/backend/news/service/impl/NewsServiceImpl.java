package com.unihack8.backend.news.service.impl;

import com.unihack8.backend.common.cache.StaleCache;
import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.news.client.NewsFeedClient;
import com.unihack8.backend.news.config.NewsProperties;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.dto.NewsSourceDto;
import com.unihack8.backend.news.domain.model.FeedItem;
import com.unihack8.backend.news.mapper.NewsFeedMapper;
import com.unihack8.backend.news.service.NewsService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Reads every site's feed through a StaleCache (one key per site), keeps only Timișoara articles, merges the sites
 * newest first and shows the same story once.
 */
@Service
public class NewsServiceImpl implements NewsService {

    /** Two headlines sharing this share of their words are the same story. */
    static final double SAME_STORY_SIMILARITY = 0.6;
    /** ...when they were published at most this far apart. */
    static final Duration SAME_STORY_WINDOW = Duration.ofHours(12);

    private final NewsFeedClient client;
    private final NewsFeedMapper mapper;
    private final NewsProperties props;
    private final StaleCache<String, List<NewsItemDto>> cache;

    // One cache entry per site, fresh for news.ttl.
    public NewsServiceImpl(NewsFeedClient client, NewsFeedMapper mapper, NewsProperties props, Clock clock) {
        this.client = client;
        this.mapper = mapper;
        this.props = props;
        this.cache = new StaleCache<>("news", props.ttl(), clock);
    }

    // All sites (or one), filtered by q, deduplicated, then paged; 503 only when no site has anything.
    @Override
    public PageResponse<NewsItemDto> latest(String source, String q, PageParams paging) {
        List<NewsProperties.Source> chosen = chosenSources(source);
        List<NewsItemDto> all = new ArrayList<>();
        int failed = 0;
        for (SourceRead read : readAll(chosen)) {
            if (read.result() == null) {
                failed++;
            } else {
                all.addAll(read.result().value());
            }
        }
        if (failed == chosen.size()) {
            throw new ApiException(ErrorCode.SOURCE_UNAVAILABLE, "The news sites cannot be reached right now.");
        }
        List<NewsItemDto> matching = all.stream()
                .filter(item -> q == null || q.isBlank()
                        || TextMatch.containsAnyWord(item.title() + " " + item.summary(), q))
                .sorted(Comparator.comparing(NewsItemDto::publishedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<NewsItemDto> unique = sameStoryOnce(matching);
        int from = Math.min(paging.page() * paging.size(), unique.size());
        int to = Math.min(from + paging.size(), unique.size());
        int totalPages = (unique.size() + paging.size() - 1) / paging.size();
        return new PageResponse<>(unique.subList(from, to), paging.page(), paging.size(), unique.size(), totalPages);
    }

    // Every site with its feed status (reads the sites that are not cached yet).
    @Override
    public List<NewsSourceDto> sources() {
        return readAll(props.sourcesOrDefault()).stream().map(read -> {
            NewsProperties.Source s = read.source();
            StaleCache.Result<List<NewsItemDto>> r = read.result();
            return r == null
                    ? new NewsSourceDto(s.id(), s.name(), s.siteUrl(), false, false, 0, null)
                    : new NewsSourceDto(s.id(), s.name(), s.siteUrl(), true, r.stale(), r.value().size(), r.fetchedAt());
        }).toList();
    }

    // Every site, or only the asked one; 400 for an unknown id.
    private List<NewsProperties.Source> chosenSources(String source) {
        List<NewsProperties.Source> all = props.sourcesOrDefault();
        if (source == null || source.isBlank()) {
            return all;
        }
        return all.stream().filter(s -> s.id().equalsIgnoreCase(source.trim())).findFirst().map(List::of)
                .orElseThrow(() -> new ApiException(ErrorCode.VALIDATION_FAILED, "Unknown news source: " + source.trim()
                        + ". Use one of " + all.stream().map(NewsProperties.Source::id).collect(Collectors.joining(", ")) + "."));
    }

    // Reads the sites in parallel (a slow site does not slow the others); result null = down with nothing cached.
    private List<SourceRead> readAll(List<NewsProperties.Source> sources) {
        return sources.parallelStream().map(s -> {
            try {
                return new SourceRead(s, cache.get(s.id(), k -> load(s)));
            } catch (ApiException e) {
                return new SourceRead(s, null);
            }
        }).toList();
    }

    // One site: feed -> Timișoara articles with safe links, pictures from WordPress when the feed has none.
    List<NewsItemDto> load(NewsProperties.Source source) {
        List<FeedItem> items = mapper.parseFeed(client.fetchFeed(source.feedUrl())).stream()
                .filter(item -> isWebLink(item.link()))
                .filter(item -> TimisoaraFilter.isAboutTimisoara(item, source.name()))
                .toList();
        if (source.wordpressImages() && items.stream().anyMatch(i -> i.imageUrl() == null)) {
            Map<String, String> images = new java.util.HashMap<>();
            client.fetchWordPressImages(source.siteUrl()).forEach((link, image) -> images.put(linkKey(link), image));
            items = items.stream()
                    .map(i -> i.imageUrl() == null && images.containsKey(linkKey(i.link()))
                            ? i.withImage(images.get(linkKey(i.link()))) : i)
                    .toList();
        }
        return items.stream()
                .map(i -> isWebLink(i.imageUrl()) ? i : i.withImage(null))
                .map(i -> mapper.toItem(i, source, props.summaryChars()))
                .toList();
    }

    // Keeps the newest of headlines that tell the same story (list already newest first).
    static List<NewsItemDto> sameStoryOnce(List<NewsItemDto> newestFirst) {
        List<NewsItemDto> kept = new ArrayList<>();
        List<Set<String>> keptWords = new ArrayList<>();
        for (NewsItemDto item : newestFirst) {
            Set<String> words = titleWords(item.title());
            boolean duplicate = false;
            for (int i = 0; i < kept.size() && !duplicate; i++) {
                duplicate = closeInTime(kept.get(i).publishedAt(), item.publishedAt())
                        && similarity(keptWords.get(i), words) >= SAME_STORY_SIMILARITY;
            }
            if (!duplicate) {
                kept.add(item);
                keptWords.add(words);
            }
        }
        return kept;
    }

    // Words of 3+ letters of a headline, without accents, minus words almost every headline here has.
    private static Set<String> titleWords(String title) {
        return Arrays.stream(TextMatch.normalize(title).split("[^a-z0-9]+"))
                .filter(w -> w.length() >= 3 && !COMMON_WORDS.contains(w))
                .collect(Collectors.toCollection(HashSet::new));
    }

    /** Words that say nothing about which story it is. */
    private static final Set<String> COMMON_WORDS = Set.of("din", "care", "mai", "este", "sunt", "pentru", "dupa",
            "sau", "fost", "are", "unui", "unei", "cum", "timisoara", "timisoarei", "timis", "ale", "lui", "intr", "intre");
    /** Two headlines must share at least this many words to be the same story. */
    private static final int MIN_SHARED_WORDS = 3;

    // Shared words / all words of two headlines; 0 when they share fewer than MIN_SHARED_WORDS words.
    static double similarity(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        Set<String> both = new HashSet<>(a);
        both.retainAll(b);
        if (both.size() < MIN_SHARED_WORDS) {
            return 0;
        }
        Set<String> any = new HashSet<>(a);
        any.addAll(b);
        return (double) both.size() / any.size();
    }

    // True when both times are known and within SAME_STORY_WINDOW, or when either is unknown.
    private static boolean closeInTime(Instant a, Instant b) {
        return a == null || b == null || Duration.between(a, b).abs().compareTo(SAME_STORY_WINDOW) <= 0;
    }

    // A link compared loosely: no scheme, "www.", query (?utm_…), fragment or trailing slash, lower case
    // (the feed and the WordPress API write the same article's link differently).
    static String linkKey(String url) {
        return url.trim().toLowerCase(java.util.Locale.ROOT)
                .replaceFirst("[?#].*$", "")
                .replaceFirst("^https?://", "").replaceFirst("^www\\.", "").replaceAll("/+$", "");
    }

    // Only http(s) links may reach the app (it opens them and loads the pictures).
    private static boolean isWebLink(String url) {
        return url != null && (url.startsWith("https://") || url.startsWith("http://"));
    }

    /** A site and what reading it gave. */
    private record SourceRead(NewsProperties.Source source, StaleCache.Result<List<NewsItemDto>> result) {
    }
}
