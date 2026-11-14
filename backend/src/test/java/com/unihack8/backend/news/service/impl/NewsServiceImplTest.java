package com.unihack8.backend.news.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.news.client.NewsFeedClient;
import com.unihack8.backend.news.config.NewsProperties;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.dto.NewsSourceDto;
import com.unihack8.backend.news.mapper.impl.NewsFeedMapperImpl;
import com.unihack8.backend.news.mapper.impl.NewsFeedMapperImplTest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Merging, filtering, deduplicating and paging the news of several sites, with a mocked client. */
class NewsServiceImplTest {

    private static final NewsProperties.Source A = new NewsProperties.Source("a", "Site A", "https://a.example.ro",
            "https://a.example.ro/feed/", false);
    private static final NewsProperties.Source B = new NewsProperties.Source("b", "Site B", "https://b.example.ro",
            "https://b.example.ro/feed/", true);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-14T17:00:00Z"), ZoneOffset.UTC);

    private final NewsFeedClient client = mock(NewsFeedClient.class);

    // Only Timișoara articles with web links, newest first; undated last.
    @Test
    void timisoaraOnlyNewestFirst() throws Exception {
        when(client.fetchFeed(A.feedUrl())).thenReturn(NewsFeedMapperImplTest.fixture());
        PageResponse<NewsItemDto> page = service(A).latest(null, null, PageParams.of(null, null));

        assertThat(page.items()).extracting(NewsItemDto::title).containsExactly(
                "Tramvaiele noi ajung în Timișoara – primele curse sâmbătă", "Concert în Piața Unirii",
                "Parcul Rozelor din TIMIȘOARA se redeschide");
        assertThat(page.totalItems()).isEqualTo(3);
    }

    // Two sites are merged by time; the same story on both is shown once (the newest).
    @Test
    void mergesSitesAndShowsAStoryOnce() {
        when(client.fetchFeed(A.feedUrl())).thenReturn(feed(
                item("Primăria Timișoara repară podul Decebal", "https://a.example.ro/pod", "Sat, 14 Nov 2026 10:00:00 +0000"),
                item("Festival de jazz în Timișoara", "https://a.example.ro/jazz", "Sat, 14 Nov 2026 08:00:00 +0000")));
        when(client.fetchFeed(B.feedUrl())).thenReturn(feed(
                item("Primăria Timișoara repară podul Decebal până în decembrie", "https://b.example.ro/pod",
                        "Sat, 14 Nov 2026 11:00:00 +0000"),
                item("Timișoara are o pistă nouă de biciclete", "https://b.example.ro/bici", "Sat, 14 Nov 2026 09:00:00 +0000")));

        List<NewsItemDto> items = service(A, B).latest(null, null, PageParams.of(null, null)).items();

        assertThat(items).extracting(NewsItemDto::url).containsExactly(
                "https://b.example.ro/pod", "https://b.example.ro/bici", "https://a.example.ro/jazz");
        assertThat(items).extracting(NewsItemDto::sourceName).containsExactly("Site B", "Site B", "Site A");
    }

    // One site, a word search, and paging.
    @Test
    void sourceSearchAndPaging() {
        when(client.fetchFeed(A.feedUrl())).thenReturn(feed(
                item("Concert în Timișoara", "https://a.example.ro/1", "Sat, 14 Nov 2026 10:00:00 +0000"),
                item("Tramvai nou în Timișoara", "https://a.example.ro/2", "Sat, 14 Nov 2026 09:00:00 +0000"),
                item("Alt tramvai în Timișoara, linia 9", "https://a.example.ro/3", "Sat, 14 Nov 2026 08:00:00 +0000")));
        when(client.fetchFeed(B.feedUrl())).thenReturn(feed(
                item("Tramvaie la B în Timișoara", "https://b.example.ro/1", "Sat, 14 Nov 2026 12:00:00 +0000")));
        NewsServiceImpl news = service(A, B);

        assertThat(news.latest("A", "tramvai", PageParams.of(0, 1)).items()).extracting(NewsItemDto::url)
                .containsExactly("https://a.example.ro/2");
        PageResponse<NewsItemDto> second = news.latest("a", "tramvai", PageParams.of(1, 1));
        assertThat(second.items()).extracting(NewsItemDto::url).containsExactly("https://a.example.ro/3");
        assertThat(second.totalItems()).isEqualTo(2);
        assertThat(second.totalPages()).isEqualTo(2);
        verify(client, never()).fetchFeed(B.feedUrl());
    }

    // An unknown source id is a 400 that lists the valid ones.
    @Test
    void unknownSource() {
        assertThatThrownBy(() -> service(A, B).latest("x", null, PageParams.of(null, null)))
                .isInstanceOf(ApiException.class).hasMessageContaining("a, b")
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    // One site down: the other still shows and the sources list says which one failed; all down: 503.
    @Test
    void siteDown() {
        when(client.fetchFeed(A.feedUrl())).thenThrow(new IllegalStateException("timeout"));
        when(client.fetchFeed(B.feedUrl())).thenReturn(feed(
                item("Știre din Timișoara", "https://b.example.ro/1", "Sat, 14 Nov 2026 12:00:00 +0000")));
        NewsServiceImpl news = service(A, B);

        assertThat(news.latest(null, null, PageParams.of(null, null)).items()).hasSize(1);
        List<NewsSourceDto> sources = news.sources();
        assertThat(sources).extracting(NewsSourceDto::id, NewsSourceDto::available, NewsSourceDto::articleCount)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("a", false, 0), org.assertj.core.groups.Tuple.tuple("b", true, 1));
        assertThatThrownBy(() -> news.latest("a", null, PageParams.of(null, null)))
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.SOURCE_UNAVAILABLE);
    }

    // A site is read once per TTL, not on every request.
    @Test
    void cachesEachSite() {
        when(client.fetchFeed(A.feedUrl())).thenReturn(feed(
                item("Știre din Timișoara", "https://a.example.ro/1", "Sat, 14 Nov 2026 12:00:00 +0000")));
        NewsServiceImpl news = service(A);
        news.latest(null, null, PageParams.of(null, null));
        news.latest(null, "x", PageParams.of(null, null));
        news.sources();
        verify(client, times(1)).fetchFeed(A.feedUrl());
    }

    // Pictures from WordPress match the feed link even with www., ?utm_… and a missing slash; only http(s) pictures pass.
    @Test
    void wordpressPictures() {
        when(client.fetchFeed(B.feedUrl())).thenReturn(feed(
                item("Știre din Timișoara", "https://b.example.ro/stire/?utm_source=rss&amp;utm_medium=rss", "Sat, 14 Nov 2026 12:00:00 +0000"),
                item("Altă știre din Timișoara", "https://b.example.ro/alta/", "Sat, 14 Nov 2026 11:00:00 +0000")));
        when(client.fetchWordPressImages(anyString())).thenReturn(Map.of(
                "https://www.b.example.ro/stire/", "https://b.example.ro/img/stire.jpg",
                "https://www.b.example.ro/alta", "javascript:alert(1)"));

        List<NewsItemDto> items = service(B).latest(null, null, PageParams.of(null, null)).items();

        assertThat(items.get(0).imageUrl()).isEqualTo("https://b.example.ro/img/stire.jpg");
        assertThat(items.get(1).imageUrl()).isNull();
    }

    // Headline similarity: shared words over all words.
    @Test
    void similarity() {
        assertThat(NewsServiceImpl.similarity(Set.of("pod", "decebal", "repara"), Set.of("pod", "decebal", "repara", "azi")))
                .isEqualTo(0.75);
        assertThat(NewsServiceImpl.similarity(Set.of(), Set.of("a"))).isZero();
        assertThat(NewsServiceImpl.linkKey("HTTPS://www.X.ro/a/?utm=1#top")).isEqualTo("x.ro/a");
    }

    // The service over these sources, 10 min cache.
    private NewsServiceImpl service(NewsProperties.Source... sources) {
        NewsProperties props = new NewsProperties(Duration.ofMinutes(10), Duration.ofSeconds(1), Duration.ofSeconds(1),
                "test", 220, false, List.of(sources));
        return new NewsServiceImpl(client, new NewsFeedMapperImpl(), props, CLOCK);
    }

    // A minimal RSS feed.
    private static String feed(String... items) {
        return "<rss version=\"2.0\"><channel>" + String.join("", items) + "</channel></rss>";
    }

    // One RSS item.
    private static String item(String title, String link, String date) {
        return "<item><title>" + title + "</title><link>" + link + "</link><pubDate>" + date
                + "</pubDate><description>Scurt.</description></item>";
    }
}
