package com.unihack8.backend.places.domain;

import java.util.Locale;
import java.util.Optional;

/** What a stored price is for (table place_prices, column item_type). */
public enum PriceItemType {
    COFFEE, PIZZA, FOOD, BEER, DRINK;

    // Finds the type for a name like "coffee", ignoring case; empty when unknown.
    public static Optional<PriceItemType> parse(String name) {
        if (name == null || name.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(valueOf(name.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
