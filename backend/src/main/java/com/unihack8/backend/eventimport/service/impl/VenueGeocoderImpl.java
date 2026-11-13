package com.unihack8.backend.eventimport.service.impl;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import com.unihack8.backend.eventimport.service.VenueGeocoder;
import java.net.URI;
import java.net.http.HttpClient;
import java.text.Normalizer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Locates a venue (PLAN 7.3), in this order: exact normalized name in our own {@code places} table;
 * the hand-curated {@code eventimport/venues.txt} (exact coordinates, or an address geocoded with
 * Nominatim); Nominatim by venue name; Nominatim by the text in brackets ("Strandul No Name (no name
 * beach)" -> "no name beach"). Nominatim is asked at most once per second. Results, hits and misses, are cached per
 * normalized venue name for the lifetime of the bean. Never throws: failures give empty.
 */
@Service
public class VenueGeocoderImpl implements VenueGeocoder {

    // Identifies the app to the Nominatim operators (no personal info), as their usage policy asks.
    public static final String USER_AGENT = "unihack8-hackathon-event-import/0.1";
    // Nominatim usage policy: at most one request per second.
    static final long MIN_REQUEST_SPACING_MILLIS = 1_000;
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    // Two places with the same name further apart than this make the name ambiguous.
    private static final double SAME_PLACE_METERS = 300;
    // Spellings of the city that are not a venue on their own ("Timișoara" alone says nothing).
    private static final String DEFAULT_CITY_WORD = "timisoara";

    private static final Logger log = LoggerFactory.getLogger(VenueGeocoderImpl.class);

    // Parses Nominatim JSON; unknown fields (place_id, osm_type, ...) are ignored.
    private static final JsonMapper JSON = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    /** Pauses the calling thread; injectable so tests never really wait. */
    @FunctionalInterface
    interface Sleeper {
        // Waits the given number of milliseconds.
        void sleep(long millis) throws InterruptedException;
    }

    // One Nominatim search hit; lat/lon come as strings.
    record NominatimResult(String lat, String lon) {
    }

    private final EventImportProperties properties;
    private final JdbcTemplate jdbc;
    private final RestClient restClient;
    private final Sleeper sleeper;
    private final LongSupplier clockMillis;
    private final BoundingBox area;
    private final Set<String> cityWords;
    private final VenueDirectory directory;
    private final Map<String, Optional<GeoPoint>> cache = new ConcurrentHashMap<>();
    // When the last Nominatim request was sent (clock millis), or null before the first one.
    private Long lastRequestAt;

    // Spring constructor: real sleep and wall clock, bundled venues.txt.
    @Autowired
    public VenueGeocoderImpl(EventImportProperties properties, JdbcTemplate jdbc) {
        this(properties, jdbc, Thread::sleep, System::currentTimeMillis,
                VenueDirectory.load(VenueGeocoderImpl::normalize));
    }

    // Test constructor with an injectable sleeper and clock and no curated venues.
    VenueGeocoderImpl(EventImportProperties properties, JdbcTemplate jdbc, Sleeper sleeper, LongSupplier clockMillis) {
        this(properties, jdbc, sleeper, clockMillis, VenueDirectory.parse("", VenueGeocoderImpl::normalize));
    }

    // Test constructor that also takes the curated venue directory.
    VenueGeocoderImpl(EventImportProperties properties, JdbcTemplate jdbc, Sleeper sleeper, LongSupplier clockMillis,
                      VenueDirectory directory) {
        this.directory = directory;
        this.properties = properties;
        this.jdbc = jdbc;
        this.sleeper = sleeper;
        this.clockMillis = clockMillis;
        this.area = parseBbox(properties.bbox());
        this.cityWords = new LinkedHashSet<>(List.of(DEFAULT_CITY_WORD, normalize(properties.city())));
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(TIMEOUT);
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .build();
    }

    /** Lookup order from the class comment; cached per normalized name; empty for blank/city-only names. */
    @Override
    public synchronized Optional<GeoPoint> locate(String venueName) {
        String key = normalize(venueName);
        if (key.isEmpty() || cityWords.contains(key)) {
            return Optional.empty();
        }
        Optional<GeoPoint> cached = cache.get(key);
        if (cached != null) {
            return cached;
        }
        Optional<GeoPoint> found = findInPlaces(key);
        if (found.isEmpty()) {
            found = findInDirectory(key);
        }
        if (found.isEmpty()) {
            found = askNominatim(venueName.trim() + ", " + properties.city() + ", Romania");
        }
        String inBrackets = textInBrackets(venueName);
        if (found.isEmpty() && inBrackets != null) {
            found = askNominatim(inBrackets + ", " + properties.city() + ", Romania");
        }
        cache.put(key, found);
        return found;
    }

    /**
     * Lowercases, strips diacritics (ă â î ș ş ț ţ ...) and turns every run of punctuation/whitespace
     * into one space, so "Fratelli Lounge & Club" becomes "fratelli lounge club".
     */
    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String noMarks = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return noMarks.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }

    // Normalized name plus the same name without a leading or trailing city word ("mina timisoara" -> "mina").
    Set<String> candidateNames(String normalized) {
        Set<String> names = new LinkedHashSet<>();
        names.add(normalized);
        for (String city : cityWords) {
            if (normalized.endsWith(" " + city)) {
                names.add(normalized.substring(0, normalized.length() - city.length() - 1).trim());
            }
            if (normalized.startsWith(city + " ")) {
                names.add(normalized.substring(city.length() + 1).trim());
            }
        }
        names.removeIf(name -> name.isEmpty() || cityWords.contains(name));
        return names;
    }

    /**
     * Exact normalized-name match against places.name (no substring or fuzzy matching). If the same
     * name belongs to places far apart (e.g. a chain), the match is ambiguous and ignored.
     */
    private Optional<GeoPoint> findInPlaces(String normalizedVenue) {
        Set<String> wanted = candidateNames(normalizedVenue);
        List<GeoPoint> matches = new ArrayList<>();
        try {
            jdbc.query("SELECT name, lat, lon FROM places", row -> {
                if (wanted.contains(normalize(row.getString("name")))) {
                    double lat = row.getDouble("lat");
                    double lon = row.getDouble("lon");
                    if (area.contains(lat, lon)) {
                        matches.add(new GeoPoint(lat, lon));
                    }
                }
            });
        } catch (RuntimeException e) {
            log.warn("Could not read places to locate venue '{}': {}", normalizedVenue, e.getMessage());
            return Optional.empty();
        }
        if (matches.isEmpty()) {
            return Optional.empty();
        }
        GeoPoint first = matches.getFirst();
        boolean sameSpot = matches.stream().allMatch(p -> p.distanceMetersTo(first) <= SAME_PLACE_METERS);
        return sameSpot ? Optional.of(first) : Optional.empty();
    }

    // Curated venues.txt: exact coordinates as given, or the address geocoded with Nominatim.
    private Optional<GeoPoint> findInDirectory(String normalizedVenue) {
        Optional<VenueDirectory.Entry> entry = directory.find(candidateNames(normalizedVenue));
        if (entry.isEmpty()) {
            return Optional.empty();
        }
        if (entry.get().point() != null) {
            GeoPoint point = entry.get().point();
            return area.contains(point.lat(), point.lon()) ? Optional.of(point) : Optional.empty();
        }
        return askNominatim(entry.get().address() + ", Romania");
    }

    // "Strandul No Name (no name beach)" -> "no name beach"; null when there are no non-empty brackets.
    static String textInBrackets(String venueName) {
        if (venueName == null) {
            return null;
        }
        int open = venueName.indexOf('(');
        int close = venueName.indexOf(')', open + 1);
        if (open < 0 || close < 0) {
            return null;
        }
        String inside = venueName.substring(open + 1, close).strip();
        return inside.isEmpty() ? null : inside;
    }

    // Asks Nominatim for a free-text query inside the import area; empty on no result, outside result or any error.
    private Optional<GeoPoint> askNominatim(String query) {
        try {
            waitForRateLimit();
            URI uri = UriComponentsBuilder.fromUriString(properties.nominatimUrl())
                    .queryParam("q", "{q}")
                    .queryParam("format", "jsonv2")
                    .queryParam("limit", "1")
                    .queryParam("countrycodes", "ro")
                    .queryParam("viewbox", "{viewbox}")
                    .queryParam("bounded", "1")
                    .encode()
                    .buildAndExpand(Map.of(
                            "q", query,
                            "viewbox", viewbox()))
                    .toUri();
            String body = restClient.get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(String.class);
            return parseFirstInside(body);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (RuntimeException e) {
            log.warn("Nominatim lookup failed for '{}': {}", query, e.getMessage());
            return Optional.empty();
        }
    }

    // Sleeps so consecutive Nominatim requests are at least one second apart, then records the send time.
    private void waitForRateLimit() throws InterruptedException {
        if (lastRequestAt != null) {
            long wait = MIN_REQUEST_SPACING_MILLIS - (clockMillis.getAsLong() - lastRequestAt);
            if (wait > 0) {
                sleeper.sleep(wait);
            }
        }
        lastRequestAt = clockMillis.getAsLong();
    }

    // First result of a Nominatim JSON array, if it lies inside the import area.
    private Optional<GeoPoint> parseFirstInside(String body) {
        if (body == null || body.isBlank()) {
            return Optional.empty();
        }
        NominatimResult[] results = JSON.readValue(body, NominatimResult[].class);
        if (results.length == 0 || results[0].lat() == null || results[0].lon() == null) {
            return Optional.empty();
        }
        double lat = Double.parseDouble(results[0].lat());
        double lon = Double.parseDouble(results[0].lon());
        if (!area.contains(lat, lon)) {
            log.warn("Nominatim placed a venue outside the import area ({}, {}); ignored", lat, lon);
            return Optional.empty();
        }
        return Optional.of(new GeoPoint(lat, lon));
    }

    // Nominatim viewbox "west,north,east,south" (x1,y1,x2,y2) from the import area.
    private String viewbox() {
        return area.minLon() + "," + area.maxLat() + "," + area.maxLon() + "," + area.minLat();
    }

    // Parses the "south,west,north,east" bbox setting into a BoundingBox (minLon,minLat,maxLon,maxLat).
    static BoundingBox parseBbox(String bbox) {
        String[] parts = bbox.split(",");
        if (parts.length != 4) {
            throw new IllegalArgumentException("events.import.bbox must be south,west,north,east: " + bbox);
        }
        double south = Double.parseDouble(parts[0].trim());
        double west = Double.parseDouble(parts[1].trim());
        double north = Double.parseDouble(parts[2].trim());
        double east = Double.parseDouble(parts[3].trim());
        return new BoundingBox(west, south, east, north);
    }
}
