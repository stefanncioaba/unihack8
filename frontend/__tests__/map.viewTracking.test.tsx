// useBriefViewTracking: custom markers redraw for a moment after mounting or a look change, then stop (Android fix).
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MARKER_TRACK_MS, useBriefViewTracking } from '@/features/map/ClusterMarker';

/** Prints the hook's value for a signature. */
function Probe({ signature }: { signature: string }) {
  const tracking = useBriefViewTracking(signature);
  return <Text testID="tracking">{String(tracking)}</Text>;
}

const value = () => screen.getByTestId('tracking').props.children;

describe('useBriefViewTracking', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is on after mount, off after MARKER_TRACK_MS, and on again when the signature changes', () => {
    const { rerender } = render(<Probe signature="a" />);
    expect(value()).toBe('true');
    act(() => jest.advanceTimersByTime(MARKER_TRACK_MS - 1));
    expect(value()).toBe('true');
    act(() => jest.advanceTimersByTime(1));
    expect(value()).toBe('false');

    rerender(<Probe signature="a" />);
    expect(value()).toBe('false'); // same look: no redraw

    rerender(<Probe signature="b" />);
    expect(value()).toBe('true');
    act(() => jest.advanceTimersByTime(MARKER_TRACK_MS));
    expect(value()).toBe('false');
  });
});
