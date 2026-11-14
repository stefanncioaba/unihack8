package com.unihack8.backend.news.service.impl;

import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.news.domain.model.FeedItem;
import com.unihack8.backend.news.mapper.impl.NewsText;
import java.util.regex.Pattern;

/**
 * "Timișoara only" (PLAN 27): an article is kept when its title, text or categories name the city ("Timișoara",
 * "timișorean", with or without diacritics). Links and the site's own name are ignored, so "timisoarastiri.ro" or
 * "Opinia Timișoarei" alone never count. County-only news (Lugoj, "județul Timiș") is left out on purpose.
 */
public final class TimisoaraFilter {

    /** "timișoara/ei/ean/eana/eni/enii/ence…" without accents. */
    private static final Pattern CITY = Pattern.compile("\\btimisoar|\\btimisore(?:an|n)");

    // Utility class.
    private TimisoaraFilter() {
    }

    // True when the article is about Timișoara.
    public static boolean isAboutTimisoara(FeedItem item, String sourceName) {
        StringBuilder text = new StringBuilder(item.title()).append(' ')
                .append(NewsText.plain(item.descriptionHtml())).append(' ')
                .append(NewsText.plain(item.contentHtml()));
        item.categories().forEach(c -> text.append(' ').append(c));
        String normalized = TextMatch.normalize(text.toString());
        if (sourceName != null && !sourceName.isBlank()) {
            normalized = normalized.replace(TextMatch.normalize(sourceName), " ");
        }
        return CITY.matcher(normalized).find();
    }
}
