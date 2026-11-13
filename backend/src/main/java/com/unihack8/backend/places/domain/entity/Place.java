package com.unihack8.backend.places.domain.entity;

import com.unihack8.backend.places.domain.PlaceCategory;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A restaurant, café, park... imported from OpenStreetMap (table public.places, migration
 * 20261113000004_places.sql).
 */
@Entity
@Table(name = "places")
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Id OpenStreetMap gave the place, e.g. "node/2845091337"; how the import recognises it.
    @Column(name = "osm_id", nullable = false, unique = true)
    private String osmId;

    @Column(nullable = false)
    private String name;

    @Convert(converter = PlaceCategoryConverter.class)
    @Column(nullable = false)
    private PlaceCategory category;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lon;

    private String address;

    // Raw OpenStreetMap opening_hours text, e.g. "Mo-Fr 08:00-22:00".
    @Column(name = "opening_hours")
    private String openingHours;

    // Every other OpenStreetMap tag (cuisine, website, phone, ...), stored as jsonb.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, String> tags = new HashMap<>();

    // Required by JPA.
    protected Place() {
    }

    // New place with its OpenStreetMap id; other fields are set by update(...).
    public Place(String osmId) {
        this.osmId = osmId;
    }

    // Copies the latest OpenStreetMap values onto this row (used for inserts and re-imports).
    public void update(String name, PlaceCategory category, double lat, double lon,
                       String address, String openingHours, Map<String, String> tags) {
        this.name = name;
        this.category = category;
        this.lat = lat;
        this.lon = lon;
        this.address = address;
        this.openingHours = openingHours;
        this.tags = tags == null ? new HashMap<>() : new HashMap<>(tags);
    }

    // Database id (UUID).
    public UUID getId() {
        return id;
    }

    // OpenStreetMap id, e.g. "node/2845091337".
    public String getOsmId() {
        return osmId;
    }

    // Display name.
    public String getName() {
        return name;
    }

    // One of the 10 app categories.
    public PlaceCategory getCategory() {
        return category;
    }

    // Latitude.
    public double getLat() {
        return lat;
    }

    // Longitude.
    public double getLon() {
        return lon;
    }

    // "Street number" when OpenStreetMap has it, else null.
    public String getAddress() {
        return address;
    }

    // OpenStreetMap opening hours text, or null.
    public String getOpeningHours() {
        return openingHours;
    }

    // All OpenStreetMap tags.
    public Map<String, String> getTags() {
        return tags;
    }
}
