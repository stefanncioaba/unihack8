package com.unihack8.backend.news.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.news.domain.model.FeedItem;
import java.util.List;
import org.junit.jupiter.api.Test;

/** "Timișoara only": what counts as a Timișoara article. */
class TimisoaraFilterTest {

    // The city named in the title, text or categories, with or without diacritics (ș and the old ş), any case.
    @Test
    void keepsTimisoaraArticles() {
        assertThat(about("Lucrări în Timișoara", "", List.of())).isTrue();
        assertThat(about("Lucrări noi", "<p>în TIMISOARA azi</p>", List.of())).isTrue();
        assertThat(about("Lucrări noi", "Timişoara, cu ş vechi", List.of())).isTrue();
        assertThat(about("Lucrări noi", "", List.of("Timisoara"))).isTrue();
        assertThat(about("Lucrări noi", "Timișorenii sunt invitați", List.of())).isTrue();
        assertThat(about("Un timișorean premiat", "", List.of())).isTrue();
        assertThat(about("Poli Timișoara câștigă", "", List.of())).isTrue();
    }

    // Other towns and county-only news are left out.
    @Test
    void dropsOtherPlaces() {
        assertThat(about("Accident la Lugoj", "Trei mașini lovite.", List.of("Timiș"))).isFalse();
        assertThat(about("Protest la București", "Mii de oameni.", List.of())).isFalse();
    }

    // Links and the site's own name ("Opinia Timișoarei", "timisoarastiri.ro") never count.
    @Test
    void ignoresLinksAndTheSiteName() {
        assertThat(about("Protest la București", "Citește pe https://timisoarastiri.ro/protest", List.of())).isFalse();
        FeedItem footer = new FeedItem("Protest la București", "https://x.ro", "Text. Sursa: Opinia Timișoarei", "",
                List.of(), null, null);
        assertThat(TimisoaraFilter.isAboutTimisoara(footer, "Opinia Timișoarei")).isFalse();
        assertThat(about("Protest", "<p>Articolul <a>Protest</a> apare prima dată în <a>Știri din Timișoara</a>.</p>", List.of()))
                .isFalse();
    }

    // An article with this title, description and categories, from a site called "Test".
    private static boolean about(String title, String description, List<String> categories) {
        return TimisoaraFilter.isAboutTimisoara(new FeedItem(title, "https://x.ro/a", description, "", categories, null, null), "Test");
    }
}
