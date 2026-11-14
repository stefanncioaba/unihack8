// Reliability line: the score plate must have room for its number (it used to render as ".." in a zero-width box).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ReliabilityLine } from '@/features/users/ReliabilityLine';

describe('ReliabilityLine score plate', () => {
  it('shows the full score in a plate wide enough for it, centred on the line position', () => {
    render(<ReliabilityLine score={100} />);
    // The plate is drawn only once the line has a measured width.
    fireEvent(screen.getByTestId('reliability-line').children[1] as never, 'layout', { nativeEvent: { layout: { width: 300 } } });
    const anchor = screen.getByTestId('score-plate-anchor');
    const style = StyleSheet.flatten(anchor.props.style);
    expect(style.width).toBeGreaterThanOrEqual(60);
    expect(style.marginLeft).toBe(-style.width / 2);
    expect(style.left).toBe(150);
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
  });
});
