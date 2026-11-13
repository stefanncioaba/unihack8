// Bottom panel for a tapped transit stop (PLAN 14.4): next arrivals (live or timetable) and today's last departures.
import { StyleSheet, View } from 'react-native';

import type { TransitArrival, TransitDeparture } from '@/api/types.transit';
import { useLastDepartures, useStopArrivals } from '@/hooks/useTransit';
import { StatusChip } from '@/ui/Chip';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';
import { formatTime, parseIso } from '@/lib/time';

/** How many arrivals fit in the panel. */
const MAX_ARRIVALS = 6;

/** `now` for 0 minutes or less, otherwise `4 min`. */
export function arrivalLabel(minutes: number): string {
  return minutes <= 0 ? 'now' : `${minutes} min`;
}

/** One "line → direction ... time" row. */
function LineRow({ route, headsign, right, muted, testID }: { route: string; headsign: string; right: string; muted?: boolean; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.line}>
        <Text variant="chip">{route}</Text>
      </View>
      <Text numberOfLines={1} tone={muted ? 'muted' : 'primary'} style={{ flex: 1 }}>
        {headsign}
      </Text>
      <Text tone={muted ? 'muted' : 'teal'} variant="cardTitle">
        {right}
      </Text>
    </View>
  );
}

/** Next arrivals; a dot marks the ones based on a vehicle's live position. */
function Arrivals({ arrivals }: { arrivals: TransitArrival[] }) {
  if (arrivals.length === 0) return <Text tone="muted">No arrivals expected soon.</Text>;
  return (
    <View style={{ gap: 6 }}>
      {arrivals.slice(0, MAX_ARRIVALS).map((a, i) => (
        <LineRow key={`${a.route}-${i}`} route={a.route} headsign={a.headsign} right={`${a.live ? '● ' : ''}${arrivalLabel(a.minutes)}`} testID="arrival-row" />
      ))}
      <Text variant="caption" tone="muted">
        ● live position · others from the timetable
      </Text>
    </View>
  );
}

/** Last departure of each line today; lines that already left are greyed out. */
function LastDepartureRows({ departures, now }: { departures: TransitDeparture[]; now: number }) {
  if (departures.length === 0) return <Text tone="muted">No departures known for today.</Text>;
  const sorted = [...departures].sort((a, b) => parseIso(a.lastDepartureAt) - parseIso(b.lastDepartureAt));
  return (
    <View style={{ gap: 6 }}>
      {sorted.map((d) => {
        const gone = parseIso(d.lastDepartureAt) < now;
        return (
          <LineRow
            key={`${d.route}-${d.headsign}`}
            route={d.route}
            headsign={d.headsign}
            right={gone ? `left ${formatTime(d.lastDepartureAt)}` : formatTime(d.lastDepartureAt)}
            muted={gone}
            testID="last-departure-row"
          />
        );
      })}
    </View>
  );
}

/** Arrivals and last departures of one stop. Each part loads and fails on its own. */
export function StopPanel({ stopId }: { stopId: string }) {
  const arrivals = useStopArrivals(stopId);
  const last = useLastDepartures(stopId);
  const name = arrivals.data?.stopName ?? last.data?.stopName ?? 'Stop';

  return (
    <View style={{ gap: 10 }} testID="stop-panel">
      <View style={styles.header}>
        <StatusChip label="STOP" tone="teal" />
        {arrivals.data?.stale && <StatusChip label="DELAYED DATA" tone="muted" />}
      </View>
      <Text variant="heading" numberOfLines={2} style={{ paddingRight: 24 }}>
        {name}
      </Text>

      <Text variant="cardTitle">Next arrivals</Text>
      {arrivals.isPending ? (
        <LoadingState />
      ) : arrivals.isError ? (
        <ErrorState error={arrivals.error} onRetry={() => arrivals.refetch()} />
      ) : (
        <Arrivals arrivals={arrivals.data.arrivals} />
      )}

      <Text variant="cardTitle">Last departures today</Text>
      {last.isPending ? (
        <LoadingState />
      ) : last.isError ? (
        <ErrorState error={last.error} onRetry={() => last.refetch()} />
      ) : (
        <>
          <LastDepartureRows departures={last.data.departures} now={Date.now()} />
          {last.data.source === 'LIVE_ESTIMATE' && (
            <Text variant="caption" tone="muted">
              Estimated from live data: the timetable is not available, so these may not be the real last departures.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: {
    minWidth: 30,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
});
