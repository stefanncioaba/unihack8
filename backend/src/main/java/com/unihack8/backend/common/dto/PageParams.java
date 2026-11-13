package com.unihack8.backend.common.dto;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Paging rules from docs/API.md: page from 0, size default 20, max 100 (500 for map queries).
 * Use in controllers: {@code PageParams.of(page, size).toPageable(Sort.by("startsAt"))}.
 */
public record PageParams(int page, int size) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;
    public static final int MAX_MAP_SIZE = 500;

    // Validates normal list paging (max 100 per page); null values use the defaults.
    public static PageParams of(Integer page, Integer size) {
        return of(page, size, MAX_SIZE);
    }

    // Validates paging for map queries with a bbox (max 500 per page).
    public static PageParams forMap(Integer page, Integer size) {
        return of(page, size, MAX_MAP_SIZE);
    }

    // Shared check: page >= 0 and 1 <= size <= maxSize, otherwise 400 VALIDATION_FAILED.
    private static PageParams of(Integer page, Integer size, int maxSize) {
        int p = page == null ? 0 : page;
        int s = size == null ? DEFAULT_SIZE : size;
        if (p < 0) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "page must be 0 or more.");
        }
        if (s < 1 || s > maxSize) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "size must be between 1 and " + maxSize + ".");
        }
        return new PageParams(p, s);
    }

    // Spring Data pageable with the given sort.
    public Pageable toPageable(Sort sort) {
        return PageRequest.of(page, size, sort);
    }
}
