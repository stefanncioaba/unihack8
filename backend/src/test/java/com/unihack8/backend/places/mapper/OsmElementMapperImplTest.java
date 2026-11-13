package com.unihack8.backend.places.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.places.client.dto.OverpassElement;
import com.unihack8.backend.places.domain.OsmPlaceData;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.mapper.impl.OsmElementMapperImpl;
import com.unihack8.backend.places.support.OverpassFixtures;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** OpenStreetMap element -> place data rules, checked on the real Overpass fixture. */
class OsmElementMapperImplTest {

    private final OsmElementMapper mapper = new OsmElementMapperImpl();
    private final List<OverpassElement> elements = OverpassFixtures.timisoaraSample().elements();

    // Maps the fixture element with this osmId (it must not be skipped).
    private OsmPlaceData mapped(String osmId) {
        return elements.stream()
                .map(mapper::toPlaceData)
                .flatMap(Optional::stream)
                .filter(p -> p.osmId().equals(osmId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("not mapped: " + osmId));
    }

    // 8 of the 9 fixture elements become places; only the unnamed park is skipped.
    @Test
    void mapsFixture() {
        List<OsmPlaceData> places = elements.stream().map(mapper::toPlaceData).flatMap(Optional::stream).toList();

        assertThat(places).hasSize(8);
        assertThat(places).extracting(OsmPlaceData::osmId).doesNotContain("way/24378130");
    }

    // Restaurant node: osmId format, position, address, opening hours and all tags copied.
    @Test
    void mapsRestaurantNode() {
        OsmPlaceData place = mapped("node/380526548");

        assertThat(place.name()).isEqualTo("Restaurant Tinecz");
        assertThat(place.category()).isEqualTo(PlaceCategory.RESTAURANT);
        assertThat(place.lat()).isEqualTo(45.7710081);
        assertThat(place.lon()).isEqualTo(21.2221875);
        assertThat(place.address()).isEqualTo("Calea Aradului 51");
        assertThat(place.openingHours()).isEqualTo("Mo-Su 11:00-23:00");
        assertThat(place.tags()).containsEntry("cuisine", "regional").containsEntry("amenity", "restaurant");
    }

    // Categories: pub -> bar, place_of_worship + tourism=attraction -> attraction, supermarket, club, cafe.
    @Test
    void picksCategories() {
        assertThat(mapped("node/1205464644").category()).isEqualTo(PlaceCategory.BAR);
        assertThat(mapped("way/191194846").category()).isEqualTo(PlaceCategory.ATTRACTION);
        assertThat(mapped("node/255740036").category()).isEqualTo(PlaceCategory.SUPERMARKET);
        assertThat(mapped("node/5140855129").category()).isEqualTo(PlaceCategory.CLUB);
        assertThat(mapped("node/1239892209").category()).isEqualTo(PlaceCategory.CAFE);
    }

    // A named park way takes its position from the centre; no address -> null.
    @Test
    void wayUsesCenter() {
        OsmPlaceData park = mapped("way/4975934");

        assertThat(park.category()).isEqualTo(PlaceCategory.PARK);
        assertThat(park.name()).isEqualTo("Parcul Central Anton von Scudier");
        assertThat(park.lat()).isEqualTo(45.751529);
        assertThat(park.lon()).isEqualTo(21.2204933);
        assertThat(park.address()).isNull();
        assertThat(park.openingHours()).isNull();
    }

    // The unnamed park is skipped.
    @Test
    void skipsUnnamedPark() {
        OverpassElement unnamedPark = elements.stream().filter(e -> e.id() == 24378130L).findFirst().orElseThrow();

        assertThat(mapper.toPlaceData(unnamedPark)).isEmpty();
    }

    // An unnamed ATM is named after its operator/brand, or just "ATM".
    @Test
    void namesUnnamedAtms() {
        OsmPlaceData atm = mapped("node/1310278904");
        assertThat(atm.name()).isEqualTo("UniCredit ATM");
        assertThat(atm.category()).isEqualTo(PlaceCategory.ATM);

        OverpassElement brandOnly = new OverpassElement("node", 1, 1.0, 2.0, null,
                Map.of("amenity", "atm", "brand", "BT"));
        assertThat(mapper.toPlaceData(brandOnly)).get().extracting(OsmPlaceData::name).isEqualTo("BT ATM");

        OverpassElement anonymous = new OverpassElement("node", 2, 1.0, 2.0, null, Map.of("amenity", "atm"));
        assertThat(mapper.toPlaceData(anonymous)).get().extracting(OsmPlaceData::name).isEqualTo("ATM");
    }

    // Street without number gives the street alone.
    @Test
    void streetWithoutNumber() {
        OverpassElement element = new OverpassElement("node", 3, 1.0, 2.0, null,
                Map.of("amenity", "cafe", "name", "C", "addr:street", "Strada Alba Iulia"));

        assertThat(mapper.toPlaceData(element)).get().extracting(OsmPlaceData::address).isEqualTo("Strada Alba Iulia");
    }

    // No position, or no app category, means skip.
    @Test
    void skipsWithoutPositionOrCategory() {
        OverpassElement noPosition = new OverpassElement("relation", 4, null, null, null,
                Map.of("amenity", "cafe", "name", "C"));
        OverpassElement otherCategory = new OverpassElement("node", 5, 1.0, 2.0, null,
                Map.of("amenity", "bench", "name", "B"));

        assertThat(mapper.toPlaceData(noPosition)).isEmpty();
        assertThat(mapper.toPlaceData(otherCategory)).isEmpty();
    }
}
