package com.unihack8.backend.common.text;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Accent- and case-insensitive matching used by the AI tools. */
class TextMatchTest {

    // Romanian letters lose their accents, case and extra spaces go.
    @Test
    void normalize() {
        assertThat(TextMatch.normalize("  Piața   Victoriei ")).isEqualTo("piata victoriei");
        assertThat(TextMatch.normalize("Cafă To Go ȘȚĂÎÂ")).isEqualTo("cafa to go staia");
        assertThat(TextMatch.normalize(null)).isEmpty();
    }

    // Any keyword word of 3+ letters is enough; short words alone must match as a whole.
    @Test
    void containsAnyWord() {
        assertThat(TextMatch.containsAnyWord("Pizzeria Napoli pizza;italian", "pizza")).isTrue();
        assertThat(TextMatch.containsAnyWord("Starbucks coffee shop", "cheap coffee")).isTrue();
        assertThat(TextMatch.containsAnyWord("Ted's Coffee Co.", "sushi")).isFalse();
        assertThat(TextMatch.containsAnyWord("Cafă To Go", "cafa")).isTrue();
        assertThat(TextMatch.containsAnyWord("5 to go", "5")).isTrue();
        assertThat(TextMatch.containsAnyWord("Bar", "of a")).isFalse();
    }
}
