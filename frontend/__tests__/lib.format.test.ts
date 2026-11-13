// Display formatters.
import { formatDistance } from '@/lib/format';

describe('formatDistance', () => {
  it('uses metres under a kilometre and kilometres above', () => {
    expect(formatDistance(420)).toBe('420 m');
    expect(formatDistance(999.6)).toBe('1000 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1449)).toBe('1.4 km');
  });
});
