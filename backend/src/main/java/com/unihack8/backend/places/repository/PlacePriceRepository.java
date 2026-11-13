package com.unihack8.backend.places.repository;

import com.unihack8.backend.places.domain.entity.PlacePrice;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Researched menu prices (PLAN 11.3), read by the AI assistant through PlaceService.explore. */
public interface PlacePriceRepository extends JpaRepository<PlacePrice, UUID> {

    // Prices whose place name is one of the given lower-case names.
    @Query("select p from PlacePrice p where lower(p.placeName) in :names order by p.priceLei")
    List<PlacePrice> findByLowerPlaceNameIn(@Param("names") Collection<String> names);
}
