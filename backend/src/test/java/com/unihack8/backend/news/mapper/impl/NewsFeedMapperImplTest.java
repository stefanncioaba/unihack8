package com.unihack8.backend.news.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.unihack8.backend.news.config.NewsProperties;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.model.FeedItem;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** RSS parsing and the article shown in the app, with the made-up feed in test resources. */
public class NewsFeedMapperImplTest {

    private static final NewsProperties.Source SOURCE =
            new NewsProperties.Source("test", "Știri Test", "https://stiri.example.ro", "https://stiri.example.ro/feed/", false);

    private final NewsFeedMapperImpl mapper = new NewsFeedMapperImpl();

    // Items with a title and link are read in feed order, with date, categories and picture.
    @Test
    void readsItems() throws IOException {
        List<FeedItem> items = mapper.parseFeed(fixture());

        assertThat(items).extracting(FeedItem::title).containsExactly(
                "Tramvaiele noi ajung în Timișoara – primele curse sâmbătă", "Accident în parcare la Lugoj",
                "Concert în Piața Unirii", "Protest la București", "Link periculos din Timisoara",
                "Parcul Rozelor din TIMIȘOARA se redeschide");
        FeedItem tram = items.getFirst();
        assertThat(tram.publishedAt()).isEqualTo(Instant.parse("2026-11-14T16:00:00Z"));
        assertThat(tram.categories()).containsExactly("Local");
        assertThat(tram.imageUrl()).isEqualTo("https://stiri.example.ro/img/tramvai.jpg");
    }

    // Pictures: enclosure, media:thumbnail, else the first <img> of the content; none -> null.
    @Test
    void picturesFromEveryPlace() throws IOException {
        List<FeedItem> items = mapper.parseFeed(fixture());
        assertThat(items.get(2).imageUrl()).isEqualTo("https://stiri.example.ro/img/concert.jpg");
        assertThat(items.get(3).imageUrl()).isEqualTo("https://stiri.example.ro/img/protest.jpg");
        assertThat(items.get(1).imageUrl()).isNull();
    }

    // Local times keep their offset; an unreadable date is null.
    @Test
    void dates() throws IOException {
        List<FeedItem> items = mapper.parseFeed(fixture());
        assertThat(items.get(2).publishedAt()).isEqualTo(Instant.parse("2026-11-14T10:30:00Z"));
        assertThat(items.getLast().publishedAt()).isNull();
    }

    // The summary is plain text without the "apare prima dată în" footer or "[…]", entities decoded.
    @Test
    void summaryIsPlainAndShort() throws IOException {
        NewsItemDto item = mapper.toItem(mapper.parseFeed(fixture()).getFirst(), SOURCE, 220);
        assertThat(item.summary()).isEqualTo("Primele tramvaie noi circulă de sâmbătă pe linia 1 & linia 2. Biletele costă la fel.");
        assertThat(item.sourceId()).isEqualTo("test");
        assertThat(item.sourceName()).isEqualTo("Știri Test");
        assertThat(item.url()).isEqualTo("https://stiri.example.ro/tramvaie-noi/");

        NewsItemDto shortOne = mapper.toItem(mapper.parseFeed(fixture()).getFirst(), SOURCE, 30);
        assertThat(shortOne.summary()).hasSizeLessThanOrEqualTo(30).endsWith("…");
    }

    // Without a description the summary comes from the content.
    @Test
    void summaryFromContentWhenNoDescription() {
        FeedItem item = new FeedItem("T", "https://x.ro/a", "", "<p>Text din conținut.</p>", List.of(), null, null);
        assertThat(mapper.toItem(item, SOURCE, 220).summary()).isEqualTo("Text din conținut.");
    }

    // The id is stable for the same link and differs between links.
    @Test
    void stableIds() throws IOException {
        List<FeedItem> items = mapper.parseFeed(fixture());
        assertThat(mapper.toItem(items.getFirst(), SOURCE, 220).id())
                .isEqualTo(mapper.toItem(items.getFirst(), SOURCE, 220).id())
                .isNotEqualTo(mapper.toItem(items.get(1), SOURCE, 220).id());
    }

    // Broken XML and DOCTYPEs (external entity tricks) are refused.
    @Test
    void refusesBadXml() {
        assertThatThrownBy(() -> mapper.parseFeed("<html>not rss")).isInstanceOf(IllegalStateException.class);
        String xxe = """
                <?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>
                <rss><channel><item><title>&x;</title><link>https://a.ro</link></item></channel></rss>""";
        assertThatThrownBy(() -> mapper.parseFeed(xxe)).isInstanceOf(IllegalStateException.class);
    }

    // The made-up feed.
    public static String fixture() throws IOException {
        try (InputStream in = NewsFeedMapperImplTest.class.getResourceAsStream("/news/sample-feed.xml")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
