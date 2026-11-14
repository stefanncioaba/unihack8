package com.unihack8.backend.help.domain.dto;

/**
 * Body of POST /help-requests. Validated in the service (docs/API.md -> POST /help-requests).
 *
 * @param title       3-80 characters
 * @param description optional, at most 500 characters
 * @param category    one of HelpRules.CATEGORY_ORDER (BORROW ... ELDERLY, OTHER)
 * @param address     optional, at most 120 characters
 * @param lat         optional, together with lon
 * @param lon         optional, together with lat
 */
public record CreateHelpRequest(String title, String description, String category, String address, Double lat,
                                Double lon) {
}
