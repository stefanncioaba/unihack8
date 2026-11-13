package com.unihack8.backend.places.domain.dto;

import java.math.BigDecimal;

/**
 * One stored menu price of a place (PLAN 11.3).
 *
 * @param itemType   COFFEE, PIZZA, FOOD, BEER or DRINK
 * @param sourceType official, delivery_app (often higher than in the shop), review or article
 * @param sourceDate when the source showed the price, or null
 */
public record PriceDto(String item, String itemType, BigDecimal priceLei, String size, String sourceType,
                       String sourceUrl, String sourceDate, String note) {
}
