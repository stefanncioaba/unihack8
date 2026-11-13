package com.unihack8.backend.transit.client;

import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import java.util.List;

/**
 * Raw calls to live.stpt.ro (endpoints listed in DOCS.md -> External data sources).
 * No caching here — the transit service caches. Any failure is thrown as a RuntimeException.
 */
public interface StptClient {

    // Every stop, from /gtfs-data/stops-index.json.
    List<StptStop> fetchStops();

    // Every line, from /gtfs-data/route-manifest.json.
    List<StptRoute> fetchRoutes();

    // Live vehicles of one line, from /gtfs-vehicles.php?route=.
    List<StptVehicle> fetchVehicles(String route);

    // Upcoming arrivals at one stop, from /proxy-smtt-cache.php?stopid=.
    List<StptArrival> fetchArrivals(String stopId);

    // Current service alerts, from /proxy-alerts.php.
    List<StptAlert> fetchAlerts();
}
