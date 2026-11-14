// Line picker under the Map tab's filter bar while Transport is on, like live.stpt.ro: a light horizontal strip of
// type groups (trams, trolleybuses, buses, express, ...) with small number tiles in each line's colour. Picking a
// line turns the strip into that line's bar: its tile, a Tur / Retur toggle labelled with the headsigns
// ("→ Gara de Nord") and a clear (×) button that goes back to every vehicle.
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { TransitRoute, TransitRouteType } from '@/api/types.transit';
import { MAP_CHIP_BG } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { FAMILY_PALETTES, lineColor, lineFamily, sameLine, typeLabel, withAlpha } from './lines';
import { groupLines, type LineDirection } from './lineView';

type Props = {
  /** Every line (GET /transit/routes), or undefined while loading. */
  routes: TransitRoute[] | undefined;
  /** The vehicle type chosen in the panel (null = every type). */
  mode: TransitRouteType | null;
  onMode: (mode: TransitRouteType | null) => void;
  /** The chosen line's id, or null for the type panel. */
  lineId: string | null;
  /** The chosen line's directions (empty while its shape loads). */
  directions: LineDirection[];
  directionIndex: number;
  onPick: (lineId: string | null) => void;
  onDirection: (index: number) => void;
};

/** A number tile: dark, with the number in white over a bar in the line's colour (readable on any shade). */
function LineTile({ id, name, onPress, large = false }: { id: string; name: string; onPress?: () => void; large?: boolean }) {
  const color = lineColor(id);
  const tile = (
    <View style={[styles.tile, large && styles.tileLarge]}>
      <Text variant="chip" allowFontScaling={false} numberOfLines={1} style={styles.tileText}>
        {name}
      </Text>
      <View style={[styles.tileBar, { backgroundColor: color }]} />
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable testID={`line-tile-${id}`} accessibilityRole="button" accessibilityLabel={`Show line ${name}`} onPress={onPress} hitSlop={4} style={({ pressed }) => pressed && styles.pressed}>
      {tile}
    </Pressable>
  );
}

/** Short legend name of a vehicle type under its button. */
const MODE_LEGEND: Record<string, string> = { TRAM: 'Tram', TROLLEYBUS: 'Trolley', BUS: 'Bus', EXPRESS: 'Express', METROPOLITAN: 'Metro bus', SCHOOL: 'School', BOAT: 'Boat' };

/** The transport panel: a row of vehicle-type buttons (icon in the type's colour, its name under it as the legend) and,
 * under it, the number tiles of the chosen type. Pressing the chosen type again shows every type. */
function GroupStrip({ routes, mode, onMode, onPick }: { routes: TransitRoute[] | undefined; mode: TransitRouteType | null; onMode: (m: TransitRouteType | null) => void; onPick: (id: string) => void }) {
  const groups = useMemo(() => groupLines(routes), [routes]);
  if (!groups.length) return null;
  const chosen = groups.find((g) => g.type === mode) ?? null;
  return (
    <View style={styles.panel} testID="line-picker">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modeRow}>
        {groups.map((g) => {
          const on = g.type === mode;
          const tint = FAMILY_PALETTES[lineFamily(g.lines[0].id)][0];
          return (
            <Pressable
              key={g.type}
              testID={`line-group-${g.type}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={g.label}
              onPress={() => onMode(on ? null : g.type)}
              style={({ pressed }) => [styles.mode, pressed && styles.pressed]}
            >
              <View style={[styles.modeCircle, on && { borderColor: tint, backgroundColor: withAlpha(tint, 0.22) }]}>
                <Icon name={g.icon} size={20} color={tint} />
              </View>
              <Text variant="caption" allowFontScaling={false} numberOfLines={1} style={[styles.modeLabel, on && { color: colors.text }]}>
                {MODE_LEGEND[g.type] ?? g.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {chosen && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.lines} contentContainerStyle={styles.linesRow} testID="line-tiles">
          {chosen.lines.map((l) => (
            <LineTile key={l.id} id={l.id} name={l.name} onPress={() => onPick(l.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** The chosen line's bar: tile, type, direction toggle and clear button. */
function LineBar({ line, lineId, directions, directionIndex, onPick, onDirection }: Omit<Props, 'routes' | 'mode' | 'onMode'> & { line: TransitRoute | undefined; lineId: string }) {
  const name = line?.name ?? lineId;
  return (
    <View style={styles.bar} testID="line-view">
      <LineTile id={lineId} name={name} large />
      <Text variant="caption" tone="muted" numberOfLines={1} style={styles.barType}>
        {typeLabel(line?.type)}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dirScroll} contentContainerStyle={styles.dirRow}>
        {directions.map((d, i) => {
          const on = i === directionIndex;
          return (
            <Pressable
              key={d.key}
              testID={`line-direction-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Direction ${d.label}`}
              onPress={() => onDirection(i)}
              style={[styles.dir, on && styles.dirOn]}
            >
              <Text variant="caption" numberOfLines={1} style={{ color: on ? colors.onAccent : colors.text }}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable testID="line-clear" accessibilityRole="button" accessibilityLabel="Show all vehicles" onPress={() => onPick(null)} hitSlop={8} style={styles.clear}>
        <Icon name="close" size={16} />
      </Pressable>
    </View>
  );
}

/** The picker: the group strip, or the chosen line's bar. Memoised: vehicle refreshes and pans do not touch it. */
function LinePickerBase({ routes, mode, onMode, lineId, directions, directionIndex, onPick, onDirection }: Props) {
  if (!lineId) return <GroupStrip routes={routes} mode={mode} onMode={onMode} onPick={onPick} />;
  const line = routes?.find((r) => sameLine(r.id, lineId));
  return <LineBar line={line} lineId={lineId} directions={directions} directionIndex={directionIndex} onPick={onPick} onDirection={onDirection} />;
}

export const LinePicker = memo(LinePickerBase);

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: MAP_CHIP_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  modeRow: { gap: 12, alignItems: 'flex-start', paddingHorizontal: 2 },
  mode: { width: 52, alignItems: 'center', gap: 3 },
  modeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeLabel: { fontSize: 10, lineHeight: 12, color: colors.textMuted, textAlign: 'center' },
  lines: { flexGrow: 0, borderRadius: 16, backgroundColor: 'rgba(0,8,20,0.55)' },
  linesRow: { gap: 8, padding: 8, alignItems: 'center' },
  tile: { minWidth: 38, height: 34, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  tileLarge: { minWidth: 40, height: 30, borderRadius: 9 },
  tileBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  tileText: { fontSize: 13, lineHeight: 15, color: colors.text },
  pressed: { opacity: 0.75 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingLeft: 7,
    paddingRight: 4,
    borderRadius: 20,
    backgroundColor: MAP_CHIP_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  barType: { maxWidth: 90 },
  dirScroll: { flex: 1 },
  dirRow: { gap: 6, alignItems: 'center' },
  dir: { height: 28, maxWidth: 200, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  dirOn: { backgroundColor: colors.accent },
  clear: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
