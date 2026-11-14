// Line picker under the Map tab's filter bar while Transport is on, like live.stpt.ro: a light horizontal strip of
// type groups (trams, trolleybuses, buses, express, ...) with small number tiles in each line's colour. Picking a
// line turns the strip into that line's bar: its tile, a Tur / Retur toggle labelled with the headsigns
// ("→ Gara de Nord") and a clear (×) button that goes back to every vehicle.
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { TransitRoute } from '@/api/types.transit';
import { MAP_CHIP_BG } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { lineColor, sameLine, textOnColor, typeLabel } from './lines';
import { groupLines, type LineDirection } from './lineView';

type Props = {
  /** Every line (GET /transit/routes), or undefined while loading. */
  routes: TransitRoute[] | undefined;
  /** The chosen line's id, or null for the group strip. */
  lineId: string | null;
  /** The chosen line's directions (empty while its shape loads). */
  directions: LineDirection[];
  directionIndex: number;
  onPick: (lineId: string | null) => void;
  onDirection: (index: number) => void;
};

/** A small number tile in the line's colour. */
function LineTile({ id, name, onPress, large = false }: { id: string; name: string; onPress?: () => void; large?: boolean }) {
  const color = lineColor(id);
  const tile = (
    <View style={[styles.tile, large && styles.tileLarge, { backgroundColor: color }]}>
      <Text variant="chip" allowFontScaling={false} numberOfLines={1} style={[styles.tileText, { color: textOnColor(color) }]}>
        {name}
      </Text>
    </View>
  );
  if (!onPress) return tile;
  return (
    <Pressable testID={`line-tile-${id}`} accessibilityRole="button" accessibilityLabel={`Show line ${name}`} onPress={onPress} hitSlop={4} style={({ pressed }) => pressed && styles.pressed}>
      {tile}
    </Pressable>
  );
}

/** The strip of type groups and their lines. */
function GroupStrip({ routes, onPick }: { routes: TransitRoute[] | undefined; onPick: (id: string) => void }) {
  const groups = useMemo(() => groupLines(routes), [routes]);
  if (!groups.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.strip}
      contentContainerStyle={styles.stripRow}
      testID="line-picker"
    >
      {groups.map((g) => (
        <View key={g.type} style={styles.group} testID={`line-group-${g.type}`}>
          <View style={styles.groupLabel} accessibilityLabel={g.label}>
            <Icon name={g.icon} size={12} color={colors.textMuted} />
            <Text variant="caption" tone="muted">
              {g.label}
            </Text>
          </View>
          {g.lines.map((l) => (
            <LineTile key={l.id} id={l.id} name={l.name} onPress={() => onPick(l.id)} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/** The chosen line's bar: tile, type, direction toggle and clear button. */
function LineBar({ line, lineId, directions, directionIndex, onPick, onDirection }: Omit<Props, 'routes'> & { line: TransitRoute | undefined; lineId: string }) {
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
function LinePickerBase({ routes, lineId, directions, directionIndex, onPick, onDirection }: Props) {
  if (!lineId) return <GroupStrip routes={routes} onPick={onPick} />;
  const line = routes?.find((r) => sameLine(r.id, lineId));
  return <LineBar line={line} lineId={lineId} directions={directions} directionIndex={directionIndex} onPick={onPick} onDirection={onDirection} />;
}

export const LinePicker = memo(LinePickerBase);

const styles = StyleSheet.create({
  strip: { flexGrow: 0, flexShrink: 0, marginHorizontal: -16 },
  stripRow: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: MAP_CHIP_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  groupLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 2 },
  tile: { minWidth: 26, height: 22, paddingHorizontal: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tileLarge: { minWidth: 32, height: 26, borderRadius: 7 },
  tileText: { fontSize: 11, lineHeight: 13 },
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
