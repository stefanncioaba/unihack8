package com.unihack8.backend.ai.domain.dto;

/**
 * One priced line of the cost box under an AI answer (docs/API.md -> AI assistant, `cost.items`).
 * Every number comes from stored data the tools returned, never from the model's text.
 *
 * @param label      the place or event name
 * @param detail     what the price is for: the item ("Espresso"), "3 stored prices", or "Ticket"
 * @param kind       MENU (stored menu price), EVENT (event ticket price_min/price_max) or TICKET (stored transit fare)
 * @param minLei     lowest stored price of the line
 * @param maxLei     highest stored price of the line
 * @param averageLei (minLei + maxLei) / 2, rounded to 0.1 lei
 */
public record CostItemDto(String label, String detail, String kind, double minLei, double maxLei, double averageLei) {
}
