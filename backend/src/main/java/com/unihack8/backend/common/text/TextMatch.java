package com.unihack8.backend.common.text;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Accent- and case-insensitive text matching ("Cafă" matches "cafa", "Piața" matches "piata"). */
public final class TextMatch {

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");

    // Utility class.
    private TextMatch() {
    }

    // Lower case without accents (ș -> s, ă -> a), with runs of spaces collapsed.
    public static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(text, Normalizer.Form.NFD);
        return MARKS.matcher(decomposed).replaceAll("")
                .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    // True when the text contains any of the keyword's words (words shorter than 3 letters are ignored).
    public static boolean containsAnyWord(String text, String keyword) {
        String haystack = normalize(text);
        String needle = normalize(keyword);
        boolean anyLongWord = false;
        for (String word : needle.split("[\\s,;]+")) {
            if (word.length() >= 3) {
                anyLongWord = true;
                if (haystack.contains(word)) {
                    return true;
                }
            }
        }
        return !anyLongWord && !needle.isEmpty() && haystack.contains(needle);
    }
}
