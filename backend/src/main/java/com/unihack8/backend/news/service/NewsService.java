package com.unihack8.backend.news.service;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.dto.NewsSourceDto;
import java.util.List;

/**
 * Timișoara news from local news sites (PLAN 26). Each site is read at most once per news.ttl; when a site is down
 * its last articles are kept, and the other sites still show.
 */
public interface NewsService {

    // Timișoara articles of every site (or of one, by source id), newest first, the same story once; q filters words.
    PageResponse<NewsItemDto> latest(String source, String q, PageParams paging);

    // The sites and how their feeds are doing.
    List<NewsSourceDto> sources();
}
