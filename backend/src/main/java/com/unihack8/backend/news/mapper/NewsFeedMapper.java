package com.unihack8.backend.news.mapper;

import com.unihack8.backend.news.config.NewsProperties;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.model.FeedItem;
import java.util.List;

/** Turns a news site's RSS feed into articles for the app (PLAN 27). */
public interface NewsFeedMapper {

    // Articles of an RSS 2.0 feed, in feed order; items without a title or link are left out. Bad XML throws.
    List<FeedItem> parseFeed(String xml);

    // The app's article: plain-text summary cut to summaryChars, footer removed, stable id from the link.
    NewsItemDto toItem(FeedItem item, NewsProperties.Source source, int summaryChars);
}
