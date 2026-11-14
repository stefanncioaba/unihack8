// Standard screen shell: dark background, safe area, 16 px page margin, optional scrolling.
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, RefreshControlProps, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  /** With `scroll`: the content is meant to fit the screen. It fills the screen height (so a `flex: 1` child can take
   * the leftover space) and only scrolls when it is really taller than the screen (a very small phone or large text). */
  fit?: boolean;
  testID?: string;
};

/** Wrap every screen in this. */
export function Screen({ children, scroll, glow = 'night', edges = ['top'], padded = true, refreshControl, contentStyle, fit, testID }: Props) {
  const inner = [padded && { paddingHorizontal: PAGE_MARGIN }, contentStyle];
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  // In fit mode the scroll view stays still until the content is taller than the space it has.
  const canScroll = !fit || contentH > viewportH + 1;
  return (
    <View style={styles.root} testID={testID}>
      <GlowBackground kind={glow} />
      <SafeAreaView style={styles.safe} edges={edges}>
        {/* "padding" on both platforms: Android is edge-to-edge in this SDK, so the system no longer resizes the window
            for the keyboard. The content area moves up with the keyboard and drops back when it closes. */}
        <KeyboardAvoidingView style={styles.safe} behavior="padding">
          {scroll ? (
            <ScrollView
              contentContainerStyle={[{ paddingBottom: fit ? 12 : 24 }, fit && { flexGrow: 1 }, inner]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
              scrollEnabled={canScroll}
              bounces={canScroll}
              overScrollMode={canScroll ? 'auto' : 'never'}
              onLayout={fit ? (e) => setViewportH(e.nativeEvent.layout.height) : undefined}
              onContentSizeChange={fit ? (_w, h) => setContentH(h) : undefined}
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
