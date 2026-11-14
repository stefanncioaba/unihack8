package com.unihack8.backend.ai.domain.dto;

import java.util.List;

/**
 * The cost box under an AI answer (docs/API.md -> AI assistant, `cost`), built only from stored prices.
 *
 * @param currency        always "RON" (amounts are in lei)
 * @param basis           TOTAL: the items are parts of one plan, so the totals are sums;
 *                        OPTIONS: the answer offers alternatives (two or more places, or two or more events),
 *                        so averageTotalLei is the average across the options and min/max are the cheapest
 *                        and dearest option
 * @param items           the priced lines, in reply order
 * @param averageTotalLei TOTAL: sum of item averages; OPTIONS: mean of item averages (rounded to 0.1 lei)
 * @param minTotalLei     TOTAL: sum of item minimums; OPTIONS: lowest item minimum
 * @param maxTotalLei     TOTAL: sum of item maximums; OPTIONS: highest item maximum
 * @param note            short remark for the user (saved prices may have changed; names without a stored price)
 */
public record ChatCostDto(String currency, String basis, List<CostItemDto> items, double averageTotalLei,
                          double minTotalLei, double maxTotalLei, String note) {
}
