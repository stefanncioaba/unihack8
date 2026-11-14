// Bottom panel for a tapped live vehicle: line and type, direction, next stop, speed, accessibility, when it last
// reported, and a warning when the position may be old. Follows the vehicle as its line's positions refresh (10 s).
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TransitVehicle } from '@/api/types.transit';
import { useMapContext, type Destination } from '@/features/map/MapContext';
import { useVehicles } from '@/hooks/useTransit';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Icon, type IconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { isReportOld, relativeAge, typeLabel, vehicleLineName } from './lines';
import { VehicleBadge } from './VehicleMarker';

/** `Stopped`, `23 km/h`, or `Unknown`. */
export function speedLabel(kmh: number | null): string {
  if (kmh === null || !Number.isFinite(kmh)) return 'Unknown';
  return kmh < 1 ? 'Stopped' : `${Math.round(kmh)} km/h`;
}

/** The current time, ticking every few seconds so "12 s ago" keeps counting. */
function useNow(everyMs = 5000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** One "icon · label · value" row. */
function InfoRow({ icon, label, value, testID }: { icon: IconName; label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text tone="muted" style={styles.label}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

type Props = {
  /** The vehicle id and its line id (null when STPT gave no line: only the tapped snapshot is shown). */
  id: string;
  route: string | null;
  /** What the vehicle looked like when tapped, shown until (or if no longer in) the live data. */
  snapshot: TransitVehicle;
  /** The directions this vehicle was tapped on, if any (offers a way back). */
  returnTo?: Destination;
};

/** Live details of one vehicle. */
export function VehiclePanel({ id, route, snapshot, returnTo }: Props) {
  const { setDestination } = useMapContext();
  const live = useVehicles(route);
  const now = useNow();
  const current = live.data?.vehicles.find((v) => v.id === id);
  const v = current ?? snapshot;
  // Gone = the line's live answer arrived and this vehicle is no longer in it (end of the run, or it stopped reporting).
  const gone = !!live.data && !current;
  const stale = !!live.data?.stale;
  const old = isReportOld(v.reportedAt, now);
  const kind = typeLabel(v.type);

  return (
    <View style={{ gap: 10 }} testID="vehicle-panel">
      <View style={styles.header}>
        <VehicleBadge vehicle={v} />
        <StatusChip label={kind.toUpperCase()} tone="signal" />
        {!stale && !old && !gone && <StatusChip label="LIVE" tone="accent" />}
      </View>
      <Text variant="heading" numberOfLines={2} style={{ paddingRight: 24 }}>
        {kind} {vehicleLineName(v)}
        {v.headsign ? ` → ${v.headsign}` : ''}
      </Text>
      <View style={{ gap: 6 }}>
        <InfoRow icon="navigate-outline" label="Direction" value={v.headsign ?? 'Unknown'} testID="vehicle-direction" />
        <InfoRow icon="location-outline" label="Next stop" value={v.nextStop ?? 'Unknown'} testID="vehicle-next-stop" />
        <InfoRow icon="speedometer-outline" label="Speed" value={speedLabel(v.speedKmh)} testID="vehicle-speed" />
        <InfoRow icon="accessibility-outline" label="Accessible" value={v.accessible ? 'Yes, low floor' : 'No'} testID="vehicle-accessible" />
        <InfoRow icon="time-outline" label="Last report" value={relativeAge(v.reportedAt, now)} testID="vehicle-reported" />
      </View>
      {(stale || old || gone) && (
        <View style={styles.warning} testID="vehicle-stale">
          <Icon name="warning-outline" size={15} color={colors.accent} />
          <Text variant="caption" tone="accent" style={{ flex: 1 }}>
            {gone
              ? 'This vehicle is no longer reporting its position. It may have finished its run.'
              : stale
                ? 'Live positions are delayed: STPT is not answering, this is the last known position.'
                : 'This position may be out of date.'}
          </Text>
        </View>
      )}
      {returnTo && (
        <Button title="Back to directions" icon="arrow-back" iconLeft small variant="secondary" onPress={() => setDestination(returnTo)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 84 },
  warning: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
});
