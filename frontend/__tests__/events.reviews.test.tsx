// Review helpers (summary, compact card label, window hint), the star picker and the rating line on event rows.
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EventSummary } from '@/api/types';
import { friendlyError, ApiError } from '@/api/errors';
import { EventListItem } from '@/features/events/EventCards';
import { compactRating, ratingSummary, reviewsHint } from '@/features/events/reviews';
import { StarRating } from '@/features/events/StarRating';

const event: EventSummary = {
  id: 'e1',
  source: 'USER',
  title: 'Chess',
  category: 'GAMES',
  venueName: 'Park',
  lat: null,
  lon: null,
  startsAt: '2026-11-10T18:00:00Z',
  endsAt: null,
  imageUrl: null,
  priceMin: null,
  priceMax: null,
  capacity: null,
  spotsLeft: null,
  averageRating: 4.3,
  reviewCount: 12,
};

describe('review labels', () => {
  it('summarises the average and count', () => {
    expect(ratingSummary(4.3, 12)).toBe('4.3 · 12 reviews');
    expect(ratingSummary(5, 1)).toBe('5.0 · 1 review');
    expect(ratingSummary(null, 0)).toBe('No reviews yet');
  });

  it('gives the compact card label only when there are reviews', () => {
    expect(compactRating(event)).toBe('4.3 (12)');
    expect(compactRating({ averageRating: null, reviewCount: 0 })).toBeNull();
  });

  it('says when reviews close, that they closed, or that ratings are settled', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(reviewsHint({ reviewsCloseAt: '2026-11-15T10:00:00Z', settled: false }, now)).toBe('Reviews close Sun, 15 Nov · 12:00');
    expect(reviewsHint({ reviewsCloseAt: '2026-11-14T10:00:00Z', settled: false }, now)).toBe('Reviews closed');
    expect(reviewsHint({ reviewsCloseAt: '2026-11-14T10:00:00Z', settled: true }, now)).toBe('Ratings settled');
    expect(reviewsHint({ reviewsCloseAt: null, settled: false }, now)).toBeNull();
  });

  it('has friendly messages for the review errors', () => {
    expect(friendlyError(new ApiError(403, 'NOT_ATTENDED', 'x'))).toBe('Only checked-in participants can review this event.');
    expect(friendlyError(new ApiError(409, 'REVIEWS_CLOSED', 'x'))).toBe('Reviews for this event are closed.');
  });
});

describe('StarRating', () => {
  it('reads out the value in display mode, with half stars', () => {
    render(<StarRating value={3.5} testID="stars" />);
    expect(screen.getByLabelText('Rated 3.5 out of 5')).toBeTruthy();
    expect(screen.getAllByTestId('icon-star')).toHaveLength(3);
    expect(screen.getAllByTestId('icon-star-half')).toHaveLength(1);
    expect(screen.getAllByTestId('icon-star-outline')).toHaveLength(1);
  });

  it('picks a rating when a star is pressed', () => {
    const onChange = jest.fn();
    render(<StarRating value={2} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '2 stars' }).props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByRole('radio', { name: '1 star' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('EventListItem rating', () => {
  it('shows "★ 4.3 (12)" when the event has reviews and nothing otherwise', () => {
    const { rerender } = render(<EventListItem event={event} />);
    expect(screen.getByText('4.3 (12)')).toBeTruthy();
    expect(screen.getByLabelText('Rated 4.3 · 12 reviews')).toBeTruthy();
    rerender(<EventListItem event={{ ...event, averageRating: null, reviewCount: 0 }} />);
    expect(screen.queryByTestId('event-rating-e1')).toBeNull();
  });
});
