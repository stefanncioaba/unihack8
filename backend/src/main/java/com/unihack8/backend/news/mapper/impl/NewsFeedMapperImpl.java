package com.unihack8.backend.news.mapper.impl;

import com.unihack8.backend.news.config.NewsProperties;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.model.FeedItem;
import com.unihack8.backend.news.mapper.NewsFeedMapper;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/**
 * Reads RSS 2.0 with the JDK's XML parser, hardened against external entities (the feeds are third-party input).
 */
@Component
public class NewsFeedMapperImpl implements NewsFeedMapper {

    private static final String CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";
    private static final String MEDIA_NS = "http://search.yahoo.com/mrss/";
    private static final Pattern IMG_SRC = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);

    // Parses the feed and reads every <item>.
    @Override
    public List<FeedItem> parseFeed(String xml) {
        Document doc = parse(xml);
        NodeList nodes = doc.getElementsByTagName("item");
        List<FeedItem> items = new ArrayList<>();
        for (int i = 0; i < nodes.getLength(); i++) {
            Element item = (Element) nodes.item(i);
            String title = NewsText.plain(text(item, "title"));
            String link = text(item, "link").trim();
            if (title.isBlank() || link.isBlank()) {
                continue;
            }
            String description = text(item, "description");
            String content = textNs(item, CONTENT_NS, "encoded");
            items.add(new FeedItem(title, link, description, content, categories(item),
                    date(text(item, "pubDate")), image(item, description, content)));
        }
        return items;
    }

    // Plain summary, shortened; id = name-based UUID of the link so the same article keeps its id.
    @Override
    public NewsItemDto toItem(FeedItem item, NewsProperties.Source source, int summaryChars) {
        String summary = NewsText.plain(item.descriptionHtml());
        if (summary.isBlank()) {
            summary = NewsText.plain(item.contentHtml());
        }
        String id = UUID.nameUUIDFromBytes(item.link().getBytes(StandardCharsets.UTF_8)).toString();
        return new NewsItemDto(id, source.id(), source.name(), item.title(), NewsText.shorten(summary, summaryChars),
                item.link(), item.imageUrl(), item.publishedAt());
    }

    // XML -> DOM with DOCTYPEs and external entities switched off.
    private static Document parse(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            builder.setErrorHandler(null);
            return builder.parse(new InputSource(new StringReader(xml.strip())));
        } catch (Exception e) {
            throw new IllegalStateException("Not a readable RSS feed: " + e.getMessage(), e);
        }
    }

    // Text of the first direct child with this (un-prefixed) name, or "".
    private static String text(Element parent, String name) {
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && e.getNamespaceURI() == null && name.equals(e.getLocalName())) {
                return e.getTextContent();
            }
        }
        return "";
    }

    // Text of the first direct child with this namespace and local name, or "".
    private static String textNs(Element parent, String ns, String name) {
        Element e = childNs(parent, ns, name);
        return e == null ? "" : e.getTextContent();
    }

    // First direct child with this namespace and local name.
    private static Element childNs(Element parent, String ns, String name) {
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && ns.equals(e.getNamespaceURI()) && name.equals(e.getLocalName())) {
                return e;
            }
        }
        return null;
    }

    // Every <category> of the item, decoded.
    private static List<String> categories(Element item) {
        List<String> result = new ArrayList<>();
        for (Node n = item.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && e.getNamespaceURI() == null && "category".equals(e.getLocalName())) {
                String c = NewsText.plain(e.getTextContent());
                if (!c.isBlank()) {
                    result.add(c);
                }
            }
        }
        return result;
    }

    // RFC 822 date ("Sat, 14 Nov 2026 16:22:43 +0000"); null when missing or unreadable.
    static Instant date(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return ZonedDateTime.parse(text.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // Picture: an image enclosure, media:content / media:thumbnail, else the first <img> in the HTML.
    private static String image(Element item, String description, String content) {
        for (Node n = item.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && e.getNamespaceURI() == null && "enclosure".equals(e.getLocalName())
                    && e.getAttribute("type").startsWith("image") && !e.getAttribute("url").isBlank()) {
                return e.getAttribute("url");
            }
        }
        for (String name : List.of("content", "thumbnail")) {
            Element media = childNs(item, MEDIA_NS, name);
            if (media != null && !media.getAttribute("url").isBlank()) {
                return media.getAttribute("url");
            }
        }
        for (String html : List.of(content, description)) {
            Matcher m = IMG_SRC.matcher(html == null ? "" : html);
            if (m.find()) {
                return NewsText.unescape(m.group(1));
            }
        }
        return null;
    }
}
