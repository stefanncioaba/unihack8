package com.unihack8.backend.transit.mapper.impl;

import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.ShapeStopDto;
import com.unihack8.backend.transit.domain.dto.ShapeVariantDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitShapeDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import com.unihack8.backend.transit.domain.model.RouteShape;
import com.unihack8.backend.transit.domain.model.ShapePath;
import com.unihack8.backend.transit.mapper.TransitMapper;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Hand-written mapper from STPT data to API DTOs. */
@Component
public class TransitMapperImpl implements TransitMapper {

    // STPT times are local Timișoara times.
    static final ZoneId CITY_ZONE = ZoneId.of("Europe/Bucharest");

    // Splits "A - B" into from/to and adds "#" to the colour.
    @Override
    public TransitRouteDto toRoute(StptRoute route) {
        String from = null;
        String to = null;
        if (route.longName() != null) {
            String[] ends = route.longName().split(" - ", 2);
            from = ends[0].trim();
            to = ends.length > 1 ? ends[1].trim() : null;
        }
        String color = route.color() == null || route.color().isBlank() ? null : "#" + route.color();
        return new TransitRouteDto(route.shortName(), routeType(route), route.shortName(), from, to, color);
    }

    // STPT category first (it separates express and metropolitan buses), then the GTFS route_type.
    static String routeType(StptRoute route) {
        String category = route.category() == null ? "" : route.category().toLowerCase(Locale.ROOT);
        switch (category) {
            case "tram":
                return "TRAM";
            case "trolleybus":
                return "TROLLEYBUS";
            case "express":
                return "EXPRESS";
            case "metropolitan":
                return "METROPOLITAN";
            case "vaporetto":
                return "BOAT";
            case "school":
                return "SCHOOL";
            default:
                break;
        }
        String type = route.routeType() == null ? "" : route.routeType();
        return switch (type) {
            case "0" -> "TRAM";
            case "11" -> "TROLLEYBUS";
            case "4" -> "BOAT";
            default -> "BUS";
        };
    }

    // Copies the stop; routes never null.
    @Override
    public TransitStopDto toStop(StptStop stop) {
        return new TransitStopDto(stop.stopCode(), stop.stopName(), stop.lat(), stop.lon(),
                stop.routes() == null ? List.of() : List.copyOf(stop.routes()));
    }

    // Renames lng/speed/stop, turns the epoch-ms timestamp into an Instant and adds the line's facts.
    @Override
    public VehicleDto toVehicle(StptVehicle v, TransitRouteDto line) {
        Instant reportedAt = v.timestamp() == null ? null : Instant.ofEpochMilli(v.timestamp());
        String route = line != null ? line.id() : v.route();
        String routeName = line != null ? line.name() : v.route();
        return new VehicleDto(v.id(), route, routeName, line == null ? null : line.type(),
                line == null ? null : line.color(), v.lat(), v.lng(), v.bearing(), v.speed(), v.headsign(), v.stop(),
                v.isAccessible(), reportedAt);
    }

    // Encodes each path (with its direction, headsign and stops); without an STPT line the GTFS route_type and
    // colour are used.
    @Override
    public TransitShapeDto toShape(RouteShape shape, TransitRouteDto line) {
        List<ShapeVariantDto> variants = shape.paths().stream().map(TransitMapperImpl::toVariant).toList();
        List<String> polylines = variants.stream().map(ShapeVariantDto::polyline).toList();
        if (line != null) {
            return new TransitShapeDto(line.id(), line.name(), line.type(), line.color(), polylines, variants);
        }
        String color = shape.color() == null || shape.color().isBlank() ? null : "#" + shape.color();
        String type = routeType(new StptRoute(shape.routeName(), null, shape.routeType(), null, null));
        return new TransitShapeDto(shape.routeName(), shape.routeName(), type, color, polylines, variants);
    }

    // Drops every variant's stop list.
    @Override
    public TransitShapeDto withoutStops(TransitShapeDto shape) {
        List<ShapeVariantDto> variants = shape.variants() == null ? List.of() : shape.variants().stream()
                .map(v -> new ShapeVariantDto(v.polyline(), v.direction(), v.headsign(), null))
                .toList();
        return new TransitShapeDto(shape.route(), shape.routeName(), shape.type(), shape.color(), shape.polylines(),
                variants);
    }

    // One path: encoded polyline, TUR/RETUR from the GTFS direction_id, headsign and stops.
    private static ShapeVariantDto toVariant(ShapePath path) {
        List<ShapeStopDto> stops = path.stops() == null ? List.of() : path.stops().stream()
                .map(s -> new ShapeStopDto(s.id(), s.name(), s.lat(), s.lon()))
                .toList();
        return new ShapeVariantDto(PolylineEncoder.encode(path.points()), direction(path.directionId()),
                path.headsign(), stops);
    }

    // GTFS direction_id 0 -> "TUR", 1 -> "RETUR", anything else -> null.
    static String direction(Integer directionId) {
        if (directionId == null) {
            return null;
        }
        return switch (directionId) {
            case 0 -> "TUR";
            case 1 -> "RETUR";
            default -> null;
        };
    }

    // One item per distinct time, live only for the vehicle-tracked first time.
    @Override
    public List<ArrivalDto> toArrivals(StptArrival arrival, Instant now) {
        List<ArrivalDto> result = new ArrayList<>();
        if (arrival.times() == null) {
            return result;
        }
        // STPT sometimes repeats a time; keep each one once.
        Set<String> unique = new LinkedHashSet<>(arrival.times());
        boolean first = true;
        for (String raw : unique) {
            Instant at = arrivalInstant(raw, now);
            if (at == null) {
                continue;
            }
            int minutes = parseMinutes(raw);
            if (minutes < 0) {
                minutes = (int) Math.max(0, Duration.between(now, at).toMinutes());
            }
            // vehicleId belongs to the first (tracked) arrival only; later ones are timetable times.
            boolean live = first && arrival.vehicleId() != null && !arrival.vehicleId().isBlank();
            result.add(new ArrivalDto(arrival.route(), arrival.destination(), at, minutes, live));
            first = false;
        }
        return result;
    }

    // "HH:mm|m" -> the UTC instant of HH:mm Timișoara time nearest to now (handles midnight).
    static Instant arrivalInstant(String raw, Instant now) {
        String clock = raw.split("\\|", 2)[0].trim();
        LocalTime time;
        try {
            time = LocalTime.parse(clock);
        } catch (DateTimeParseException e) {
            int minutes = parseMinutes(raw);
            return minutes < 0 ? null : now.plus(minutes, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.MINUTES);
        }
        ZonedDateTime local = now.atZone(CITY_ZONE);
        ZonedDateTime candidate = local.with(time).truncatedTo(ChronoUnit.MINUTES);
        if (candidate.isBefore(local.minusHours(12))) {
            candidate = candidate.plusDays(1);
        } else if (candidate.isAfter(local.plusHours(12))) {
            candidate = candidate.minusDays(1);
        }
        return candidate.toInstant();
    }

    // Minutes part of "HH:mm|m", or -1 when missing or not a number.
    static int parseMinutes(String raw) {
        String[] parts = raw.split("\\|", 2);
        if (parts.length < 2) {
            return -1;
        }
        try {
            return Math.max(0, Integer.parseInt(parts[1].trim()));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    // headerText -> title, descriptionText -> description.
    @Override
    public AlertDto toAlert(StptAlert alert) {
        return new AlertDto(alert.id(), alert.headerText(), alert.descriptionText());
    }
}
