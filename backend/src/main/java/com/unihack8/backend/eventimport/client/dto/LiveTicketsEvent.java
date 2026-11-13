package com.unihack8.backend.eventimport.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * One event as LiveTickets' public event search returns it (only the fields we use).
 *
 * @param eventId    LiveTickets id (UUID text)
 * @param url        slug of the ticket page, e.g. "albwho-at-fratelli-timisoara"
 * @param location   venue name, e.g. "Fratelli Lounge &amp; Club Timisoara"
 * @param startDate  local Romanian time without zone, e.g. "2026-11-13T23:00:00"
 * @param image      image path on the LiveTickets CDN, e.g. "slug/Background_MEDIUM.jpg"
 * @param imageToken cache-busting token appended to the image URL
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LiveTicketsEvent(
        @JsonProperty("event_id") String eventId,
        @JsonProperty("url") String url,
        @JsonProperty("name") String name,
        @JsonProperty("description") String description,
        @JsonProperty("location") String location,
        @JsonProperty("city") String city,
        @JsonProperty("start_date") String startDate,
        @JsonProperty("end_date") String endDate,
        @JsonProperty("price_min") BigDecimal priceMin,
        @JsonProperty("price_max") BigDecimal priceMax,
        @JsonProperty("image") String image,
        @JsonProperty("image_token") String imageToken) {
}
