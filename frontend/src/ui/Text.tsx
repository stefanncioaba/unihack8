// App text with the design's type scale and colour tones.
import { Text as RNText, type TextProps } from 'react-native';

import { toneColor, type Tone, type TypeVariant, type } from './theme';

type Props = TextProps & { variant?: TypeVariant; tone?: Tone };

/** Use instead of react-native's Text so every screen shares one type scale. */
export function Text({ variant = 'body', tone = 'primary', style, ...rest }: Props) {
  return <RNText {...rest} style={[type[variant], { color: toneColor[tone] }, style]} />;
}
