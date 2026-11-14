// Thin-line icons (Ionicons ship with Expo Go).
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = { name: IconName; size?: number; color?: string };

/** One icon, default size 18. */
export function Icon({ name, size = 18, color = '#EEF3FA' }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}
