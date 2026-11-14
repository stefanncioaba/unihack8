package com.unihack8.backend.news.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Feed text helpers: tags, entities, footers, shortening. */
class NewsTextTest {

    // Numeric, hex and named entities are decoded; unknown ones stay.
    @Test
    void unescape() {
        assertThat(NewsText.unescape("A &amp; B &#8211; C &#x2019;D&nbsp;E &hellip; &foo;"))
                .isEqualTo("A & B – C ’D E … &foo;");
    }

    // Tags, links, the WordPress footer (Romanian and English) and "[…]" are removed; spaces collapsed.
    @Test
    void plain() {
        assertThat(NewsText.plain("<p>Știre  scurtă\n pe https://x.ro/a azi [&#8230;]</p><p>Articolul <a>X</a> apare prima dată în <a>Y</a>.</p>"))
                .isEqualTo("Știre scurtă pe azi");
        assertThat(NewsText.plain("<p>News.</p><p>The post <a>X</a> appeared first on <a>Y</a>.</p>")).isEqualTo("News.");
        assertThat(NewsText.plain(null)).isEmpty();
    }

    // Cut at a word boundary with "…"; short text untouched.
    @Test
    void shorten() {
        assertThat(NewsText.shorten("Scurt", 10)).isEqualTo("Scurt");
        assertThat(NewsText.shorten("Primăria anunță lucrări noi, pe strada Mare", 25)).isEqualTo("Primăria anunță lucrări…");
    }
}
