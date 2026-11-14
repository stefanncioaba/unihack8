// Transit layer inside the MapView (PLAN 14.4): stop dots for the visible area and live vehicles of the chosen line.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { TransitRoute, TransitStop, TransitVehicle } from '@/api/types.transit';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

type Props = {
  /** Stops in the visible area (already loaded by the map screen), or undefined while zoomed out. */
  stops: TransitStop[] | undefined;
  /** The chosen line, if any: only its stops are shown, plus its vehicles. */
  line: TransitRoute | null;
  vehicles: TransitVehicle[] | undefined;
  selectedStopId?: string;
  onSelectStop: (id: string) => void;
};

/** Small teal dot for a stop; bigger and ringed when selected. */
function StopDot({ selected }: { selected: boolean }) {
  return <View style={[styles.stop, selected && styles.stopSelected]} />;
}

/** Round badge with the vehicle icon and the line number, in the line's colour. */
function VehicleBadge({ line }: { line: TransitRoute }) {
  const color = line.color ?? colors.accent;
  const icon = line.type === 'TRAM' ? 'train' : 'bus';
  return (
    <View style={[styles.vehicle, { backgroundColor: color }]}>
      <Icon name={icon} size={12} color="#fff" />
      <Text variant="chip" style={styles.vehicleText}>
        {line.name}
      </Text>
    </View>
  );
}

/** Stops and vehicles. `tracksViewChanges` is off so many custom markers stay smooth. */
export function TransitLayer({ stops, line, vehicles, selectedStopId, onSelectStop }: Props) {
  const shown = useMemo(() => (stops && line ? stops.filter((s) => s.routes.includes(line.id)) : stops ?? []), [stops, line]);
  return (
    <>
      {shown.map((s) => (
        <Marker
          key={`stop-${s.id}`}
          testID={`stop-marker-${s.id}`}
          coordinate={{ latitude: s.lat, longitude: s.lon }}
          onPress={() => onSelectStop(s.id)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <StopDot selected={s.id === selectedStopId} />
        </Marker>
      ))}
      {line &&
        vehicles?.map((v) => (
          <Marker
            key={`vehicle-${v.id}`}
            testID={`vehicle-marker-${v.id}`}
            coordinate={{ latitude: v.lat, longitude: v.lon }}
            title={`Line ${line.name}${v.headsign ? ` → ${v.headsign}` : ''}`}
            description={v.nextStop ? `Next stop: ${v.nextStop}` : undefined}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <VehicleBadge line={line} />
          </Marker>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  stop: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.bg },
  stopSelected: { width: 18, height: 18, borderRadius: 9, borderColor: '#fff' },
  vehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  vehicleText: { color: '#fff' },
});
