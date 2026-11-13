package com.unihack8.backend.places.repository;

import com.unihack8.backend.places.domain.entity.Place;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** Database access for places. Search filters are built as Specifications in the service. */
public interface PlaceRepository extends JpaRepository<Place, UUID>, JpaSpecificationExecutor<Place> {

    // Existing rows for these OpenStreetMap ids (used by the import to update instead of insert).
    List<Place> findByOsmIdIn(Collection<String> osmIds);

    // Rows whose OpenStreetMap id is not in the given set (places that disappeared from OSM).
    List<Place> findByOsmIdNotIn(Collection<String> osmIds);
}
