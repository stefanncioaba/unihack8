package com.unihack8.backend.places.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * One researched menu price (table public.place_prices, migration 20261114000001_place_prices.sql).
 * placeName matches a place's name or brand case-insensitively, so chain prices cover every branch.
 */
@Entity
@Table(name = "place_prices")
public class PlacePrice {

    @Id
    private UUID id;

    @Column(name = "place_name", nullable = false)
    private String placeName;

    @Column(nullable = false)
    private String item;

    // COFFEE, PIZZA, FOOD, BEER or DRINK (see PriceItemType).
    @Column(name = "item_type", nullable = false)
    private String itemType;

    @Column(name = "price_lei", nullable = false)
    private BigDecimal priceLei;

    private String size;

    // official, delivery_app, review or article.
    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "source_url")
    private String sourceUrl;

    // When the source showed this price, e.g. "2026-05" (free text, may be null).
    @Column(name = "source_date")
    private String sourceDate;

    private String note;

    // Required by JPA.
    protected PlacePrice() {
    }

    // Full row; used by tests and by code that adds prices.
    public PlacePrice(UUID id, String placeName, String item, String itemType, BigDecimal priceLei, String size,
                      String sourceType, String sourceUrl, String sourceDate, String note) {
        this.id = id;
        this.placeName = placeName;
        this.item = item;
        this.itemType = itemType;
        this.priceLei = priceLei;
        this.size = size;
        this.sourceType = sourceType;
        this.sourceUrl = sourceUrl;
        this.sourceDate = sourceDate;
        this.note = note;
    }

    // Row id.
    public UUID getId() {
        return id;
    }

    // Place (or chain) name this price belongs to.
    public String getPlaceName() {
        return placeName;
    }

    // Menu item, e.g. "Espresso".
    public String getItem() {
        return item;
    }

    // COFFEE, PIZZA, FOOD, BEER or DRINK.
    public String getItemType() {
        return itemType;
    }

    // Price in lei.
    public BigDecimal getPriceLei() {
        return priceLei;
    }

    // Portion or size, or null.
    public String getSize() {
        return size;
    }

    // Kind of source the price came from.
    public String getSourceType() {
        return sourceType;
    }

    // Page the price was read from, or null.
    public String getSourceUrl() {
        return sourceUrl;
    }

    // When the source showed this price, or null.
    public String getSourceDate() {
        return sourceDate;
    }

    // Extra remark (e.g. "national chain price"), or null.
    public String getNote() {
        return note;
    }
}
