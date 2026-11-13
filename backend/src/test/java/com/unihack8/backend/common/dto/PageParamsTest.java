package com.unihack8.backend.common.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import java.util.List;

/** Paging rules from docs/API.md -> Conventions. */
class PageParamsTest {

    // Missing values fall back to page 0, size 20.
    @Test
    void defaultsWhenMissing() {
        assertThat(PageParams.of(null, null)).isEqualTo(new PageParams(0, 20));
    }

    // Normal lists allow up to 100 per page.
    @Test
    void listMaxIs100() {
        assertThat(PageParams.of(0, 100).size()).isEqualTo(100);
        assertThatThrownBy(() -> PageParams.of(0, 101))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    // Map queries allow up to 500 per page.
    @Test
    void mapMaxIs500() {
        assertThat(PageParams.forMap(0, 500).size()).isEqualTo(500);
        assertThatThrownBy(() -> PageParams.forMap(0, 501)).isInstanceOf(ApiException.class);
    }

    // Negative page and zero size are rejected.
    @Test
    void rejectsNegativePageAndZeroSize() {
        assertThatThrownBy(() -> PageParams.of(-1, 20)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> PageParams.of(0, 0)).isInstanceOf(ApiException.class);
    }

    // Converts to a Spring pageable with the sort.
    @Test
    void toPageableKeepsSort() {
        Pageable pageable = new PageParams(2, 10).toPageable(Sort.by("startsAt"));
        assertThat(pageable.getPageNumber()).isEqualTo(2);
        assertThat(pageable.getPageSize()).isEqualTo(10);
        assertThat(pageable.getSort().getOrderFor("startsAt")).isNotNull();
    }

    // PageResponse maps items and copies the counts.
    @Test
    void pageResponseMapsItems() {
        PageImpl<Integer> page = new PageImpl<>(List.of(1, 2), PageRequest.of(1, 2), 5);
        PageResponse<String> response = PageResponse.of(page, i -> "item-" + i);
        assertThat(response.items()).containsExactly("item-1", "item-2");
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.size()).isEqualTo(2);
        assertThat(response.totalItems()).isEqualTo(5);
        assertThat(response.totalPages()).isEqualTo(3);
    }
}
