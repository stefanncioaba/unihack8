package com.unihack8.backend.transit.repository.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.transit.domain.model.ScheduledDeparture;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Reading last departures from a small GTFS file shaped like STPT's (PLAN 9.6). */
class GtfsTimetableRepositoryTest {

    // 2026-11-13 is a Friday, 2026-11-15 a Sunday, 2026-11-30 a Monday holiday (exception).
    private static final LocalDate FRIDAY = LocalDate.of(2026, 11, 13);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 11, 15);
    private static final LocalDate HOLIDAY = LocalDate.of(2026, 11, 30);

    @TempDir
    Path dir;

    private GtfsTimetableRepository repo;

    // Two tram-2 trips on weekdays (one after midnight), one on Sundays, and tram 9 ending at stop 1.
    @BeforeEach
    void setUp() throws IOException {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("stops.txt", """
                stop_id,stop_name,stop_lat,stop_lon,location_type,stop_code
                1,"Dâmbovița (Ion Barac)",45.74015,21.19611,0,1
                2,"Piața, Sfânta Maria",45.75,21.21,0,2
                3,Shopping City,45.72,21.18,0,3
                """);
        files.put("routes.txt", """
                route_id,agency_id,route_short_name,route_long_name,route_type
                R_TV_2,STPT,2,Shopping City - Ciocanul,0
                R_TV_9,STPT,9,AEM - Gara de Nord,0
                """);
        files.put("trips.txt", """
                route_id,service_id,trip_id,trip_headsign,direction_id
                R_TV_2,WD,t1,Shopping City,0
                R_TV_2,WD,t2,Shopping City,0
                R_TV_2,SU,t3,Shopping City,0
                R_TV_9,WD,t4,Dâmbovița,1
                """);
        files.put("stop_times.txt", """
                trip_id,arrival_time,departure_time,stop_id,stop_sequence
                t1,22:00:00,22:00:00,2,1
                t1,22:10:00,22:10:00,1,2
                t1,22:20:00,22:20:00,3,3
                t2,24:20:00,24:20:00,2,1
                t2,24:30:00,24:30:00,1,2
                t2,24:40:00,24:40:00,3,3
                t3,21:00:00,21:00:00,1,1
                t3,21:10:00,21:10:00,3,2
                t4,23:00:00,23:00:00,2,1
                t4,23:15:00,23:15:00,1,2
                """);
        files.put("calendar.txt", """
                service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
                WD,1,1,1,1,1,0,0,20261105,20261231
                SU,0,0,0,0,0,0,1,20261105,20261231
                """);
        files.put("calendar_dates.txt", """
                service_id,date,exception_type
                WD,20261130,2
                SU,20261130,1
                """);
        Path zip = dir.resolve("gtfs.zip");
        try (OutputStream out = Files.newOutputStream(zip); ZipOutputStream z = new ZipOutputStream(out)) {
            for (Map.Entry<String, String> f : files.entrySet()) {
                z.putNextEntry(new ZipEntry(f.getKey()));
                z.write(f.getValue().getBytes(StandardCharsets.UTF_8));
                z.closeEntry();
            }
        }
        repo = new GtfsTimetableRepository(zip);
    }

    // Weekday: the after-midnight trip (24:30) is the last tram 2; tram 9 ends here, so it has no departure.
    @Test
    void weekdayLastDepartures() {
        List<ScheduledDeparture> list = repo.lastDepartures("1", FRIDAY).orElseThrow();
        assertThat(list).containsExactly(new ScheduledDeparture("2", "Shopping City", 24 * 3600 + 30 * 60));
    }

    // Sunday uses the Sunday service only.
    @Test
    void sundayUsesItsOwnService() {
        assertThat(repo.lastDepartures("1", SUNDAY).orElseThrow())
                .containsExactly(new ScheduledDeparture("2", "Shopping City", 21 * 3600));
    }

    // calendar_dates.txt swaps the weekday service for the Sunday one on a holiday.
    @Test
    void exceptionsOverrideTheWeeklyPattern() {
        assertThat(repo.lastDepartures("1", HOLIDAY).orElseThrow())
                .containsExactly(new ScheduledDeparture("2", "Shopping City", 21 * 3600));
    }

    // Lines starting at another stop are listed for that stop.
    @Test
    void otherStop() {
        assertThat(repo.lastDepartures("2", FRIDAY).orElseThrow()).containsExactly(
                new ScheduledDeparture("2", "Shopping City", 24 * 3600 + 20 * 60),
                new ScheduledDeparture("9", "Dâmbovița", 23 * 3600));
    }

    // A stop with no departures that day gives an empty list, not "no timetable".
    @Test
    void terminusOnlyStopHasNoDepartures() {
        assertThat(repo.lastDepartures("3", FRIDAY)).hasValue(List.of());
    }

    // Outside the timetable's dates there is no answer, so the caller falls back to live data.
    @Test
    void outsideTheFeedRange() {
        assertThat(repo.lastDepartures("1", LocalDate.of(2027, 1, 5))).isEmpty();
    }

    // Stop names come from stops.txt, quoted names with commas included.
    @Test
    void stopNames() {
        assertThat(repo.stopName("1")).hasValue("Dâmbovița (Ion Barac)");
        assertThat(repo.stopName("2")).hasValue("Piața, Sfânta Maria");
        assertThat(repo.stopName("99")).isEmpty();
    }

    // No file: every answer is empty and nothing throws.
    @Test
    void missingFile() {
        GtfsTimetableRepository none = new GtfsTimetableRepository(dir.resolve("absent.zip"));
        assertThat(none.lastDepartures("1", FRIDAY)).isEmpty();
        assertThat(none.stopName("1")).isEmpty();
    }

    // CSV details: quotes, escaped quotes, empty fields; GTFS times past midnight.
    @Test
    void csvAndTimeParsing() {
        assertThat(GtfsCsv.split("a,\"b, c\",\"say \"\"hi\"\"\",")).containsExactly("a", "b, c", "say \"hi\"", "");
        assertThat(GtfsCsv.seconds("24:30:00")).isEqualTo(88_200);
        assertThat(GtfsCsv.seconds("")).isEqualTo(-1);
        assertThat(GtfsCsv.seconds("7:5")).isEqualTo(-1);
    }
}
