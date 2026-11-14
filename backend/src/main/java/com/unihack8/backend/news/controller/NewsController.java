package com.unihack8.backend.news.controller;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.dto.NewsSourceDto;
import com.unihack8.backend.news.service.NewsService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public Timișoara news endpoints (docs/API.md -> News, PLAN 26). */
@RestController
@RequestMapping("/news")
public class NewsController {

    private final NewsService news;

    // Delegates to the news service.
    public NewsController(NewsService news) {
        this.news = news;
    }

    // GET /news?source=&q=&page=&size= — Timișoara articles, newest first.
    @GetMapping
    public PageResponse<NewsItemDto> latest(@RequestParam(required = false) String source,
                                            @RequestParam(required = false) String q,
                                            @RequestParam(required = false) Integer page,
                                            @RequestParam(required = false) Integer size) {
        return news.latest(source, q, PageParams.of(page, size));
    }

    // GET /news/sources — the news sites and their status.
    @GetMapping("/sources")
    public List<NewsSourceDto> sources() {
        return news.sources();
    }
}
