// Standard screen shell: dark background, safe area, 16 px page margin, optional scrolling.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControlProps, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { GlowBackground, type GlowKind } from './GlowBackground';
import { PAGE_MARGIN } from './theme';

type Props = {
  children: ReactNode;
  /** Wrap the content in a vertical ScrollView. Leave off when the content is a FlatList. */
  scroll?: boolean;
  glow?: GlowKind;
  /** Safe-area edges to respect. Tab screens skip the bottom edge (the tab bar handles it). */
  edges?: Edge[];
  /** Apply the 16 px side margin (default true). */
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Wrap every screen in this. */
export function Screen({ children, scroll, glow = 'night', edges = ['top'], padded = true, refreshControl, contentStyle, testID }: Props) {
  const inner = [padded && { paddingHorizontal: PAGE_MARGIN }, contentStyle];
  return (
    <View style={styles.root} testID={testID}>
      <GlowBackground kind={glow} />
      <SafeAreaView style={styles.safe} edges={edges}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={[{ paddingBottom: 24 }, inner]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.safe, inner]}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000814' },
  safe: { flex: 1 },
});
