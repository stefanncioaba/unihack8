package com.unihack8.backend.news.mapper.impl;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Text helpers for feed HTML: tags out, entities decoded, the WordPress "appeared first on" footer removed. */
public final class NewsText {

    private static final Pattern TAGS = Pattern.compile("<[^>]*>");
    private static final Pattern ENTITY = Pattern.compile("&(#x?[0-9a-fA-F]+|[a-zA-Z]+);");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern URLS = Pattern.compile("https?://\\S+");
    /** "Articolul <title> apare prima dată în <site>." / "The post <title> appeared first on <site>." */
    private static final Pattern FOOTER = Pattern.compile(
            "(?is)\\s*(?:(?:the post|articolul|postarea)\\s.*?)?"
                    + "(?:apare prima dat[aă] [iî]n|appeared first on|first appeared on)\\b.*$");
    /** WordPress's "[…]" at the end of an excerpt. */
    private static final Pattern READ_MORE = Pattern.compile("\\s*\\[(?:…|\\.\\.\\.)]\\s*$");
    private static final Map<String, String> NAMED = Map.ofEntries(
            Map.entry("amp", "&"), Map.entry("lt", "<"), Map.entry("gt", ">"), Map.entry("quot", "\""),
            Map.entry("apos", "'"), Map.entry("nbsp", " "), Map.entry("hellip", "…"), Map.entry("ndash", "–"),
            Map.entry("mdash", "—"), Map.entry("laquo", "«"), Map.entry("raquo", "»"), Map.entry("lsquo", "‘"),
            Map.entry("rsquo", "’"), Map.entry("ldquo", "“"), Map.entry("rdquo", "”"), Map.entry("bdquo", "„"));

    // Utility class.
    private NewsText() {
    }

    // HTML -> one line of plain text: footer, tags and links removed, entities decoded, spaces collapsed.
    public static String plain(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String text = unescape(TAGS.matcher(html).replaceAll(" "));
        text = FOOTER.matcher(text).replaceAll("");
        text = URLS.matcher(text).replaceAll(" ");
        text = READ_MORE.matcher(SPACES.matcher(text).replaceAll(" ").trim()).replaceAll("");
        return text.trim();
    }

    // Decodes &amp; &#8211; &#x2019; and the common named entities; unknown ones stay as they are.
    public static String unescape(String text) {
        if (text == null || text.indexOf('&') < 0) {
            return text;
        }
        Matcher m = ENTITY.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String code = m.group(1);
            String value;
            if (code.startsWith("#x") || code.startsWith("#X")) {
                value = codePoint(code.substring(2), 16);
            } else if (code.startsWith("#")) {
                value = codePoint(code.substring(1), 10);
            } else {
                value = NAMED.get(code.toLowerCase());
            }
            m.appendReplacement(out, Matcher.quoteReplacement(value == null ? m.group() : value));
        }
        m.appendTail(out);
        return out.toString();
    }

    // Shortens to at most max characters at a word boundary, adding "…" when cut.
    public static String shorten(String text, int max) {
        if (text.length() <= max) {
            return text;
        }
        int cut = text.lastIndexOf(' ', max - 1);
        String head = text.substring(0, cut > max / 2 ? cut : max - 1).replaceAll("[\\s,.;:–—-]+$", "");
        return head + "…";
    }

    // A numeric entity's character, or null when it is not a valid code point.
    private static String codePoint(String digits, int radix) {
        try {
            int cp = Integer.parseInt(digits, radix);
            return Character.isValidCodePoint(cp) ? new String(Character.toChars(cp)) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
