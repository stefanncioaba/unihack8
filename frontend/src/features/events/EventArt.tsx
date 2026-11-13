// Event artwork: the event's image, or an abstract category gradient when there is none.
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/ui/Icon';
import { colors } from '@/ui/theme';

import { categoryMeta } from './categories';

type Props = {
  category: string;
  imageUrl: string | null;
  /** Width / height. 16/9 on cards, 1 for thumbnails. */
  aspectRatio?: number;
  /** Adds a soft dark gradient over the lower edge so text on top stays readable. */
  shade?: boolean;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Rounded artwork block; children are drawn on top. */
export function EventArt({ category, imageUrl, aspectRatio = 16 / 9, shade, iconSize = 44, style, children }: Props) {
  const meta = categoryMeta(category);
  return (
    <View style={[styles.box, { aspectRatio }, style]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <>
          <LinearGradient colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.glyph}>
            <Icon name={meta.icon} size={iconSize} color="rgba(255,255,255,0.16)" />
          </View>
        </>
      )}
      {shade && <LinearGradient colors={['transparent', 'rgba(9,10,24,0.92)']} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  glyph: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
