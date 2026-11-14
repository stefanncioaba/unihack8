package com.unihack8.backend.news.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.news.domain.dto.NewsItemDto;
import com.unihack8.backend.news.domain.dto.NewsSourceDto;
import com.unihack8.backend.news.service.NewsService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** GET /news and /news/sources end to end (public access, JSON shape, errors), with the service mocked. */
@SpringBootTest
@AutoConfigureMockMvc
class NewsControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private NewsService news;

    // No token needed; documented shape (docs/API.md -> News).
    @Test
    void latestIsPublic() throws Exception {
        NewsItemDto item = new NewsItemDto("id-1", "tion", "TION", "Tramvaie noi în Timișoara", "Scurt.",
                "https://www.tion.ro/a/", "https://www.tion.ro/a.jpg", Instant.parse("2026-11-14T16:00:00Z"));
        when(news.latest(eq("tion"), isNull(), eq(new PageParams(0, 5))))
                .thenReturn(new PageResponse<>(List.of(item), 0, 5, 1, 1));

        mvc.perform(get("/news").param("source", "tion").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value("id-1"))
                .andExpect(jsonPath("$.items[0].sourceId").value("tion"))
                .andExpect(jsonPath("$.items[0].sourceName").value("TION"))
                .andExpect(jsonPath("$.items[0].title").value("Tramvaie noi în Timișoara"))
                .andExpect(jsonPath("$.items[0].summary").value("Scurt."))
                .andExpect(jsonPath("$.items[0].url").value("https://www.tion.ro/a/"))
                .andExpect(jsonPath("$.items[0].imageUrl").value("https://www.tion.ro/a.jpg"))
                .andExpect(jsonPath("$.items[0].publishedAt").value("2026-11-14T16:00:00Z"))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    // The sites and their status, public.
    @Test
    void sourcesArePublic() throws Exception {
        when(news.sources()).thenReturn(List.of(
                new NewsSourceDto("tion", "TION", "https://www.tion.ro", true, false, 5, Instant.parse("2026-11-14T16:00:00Z"))));
        mvc.perform(get("/news/sources"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("tion"))
                .andExpect(jsonPath("$[0].available").value(true))
                .andExpect(jsonPath("$[0].stale").value(false))
                .andExpect(jsonPath("$[0].articleCount").value(5));
    }

    // Bad paging and an unknown source are 400; every site down is 503.
    @Test
    void errors() throws Exception {
        mvc.perform(get("/news").param("size", "500")).andExpect(status().isBadRequest());
        when(news.latest(eq("x"), any(), any())).thenThrow(new ApiException(ErrorCode.VALIDATION_FAILED, "Unknown news source: x."));
        mvc.perform(get("/news").param("source", "x")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        when(news.latest(isNull(), any(), any())).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        mvc.perform(get("/news")).andExpect(status().isServiceUnavailable());
    }
}
