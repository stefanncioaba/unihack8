package com.unihack8.backend.common.dto;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * Paged answer shape from docs/API.md -> Paging.
 *
 * @param items      the items on this page
 * @param page       page number, starting at 0
 * @param size       requested page size
 * @param totalItems number of items across all pages
 * @param totalPages number of pages
 */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    // Converts a Spring Data page, mapping each entity to its DTO.
    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
