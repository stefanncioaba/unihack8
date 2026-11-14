// "Reviews" block of a user event: average stars and count, the review window hint, my review form
// (checked-in attendees only) and every review. Refreshes live while the page is open.
import { StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import { useEventReviews, useSaveReview } from '@/hooks/queries';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';

import { ReviewForm } from './ReviewForm';
import { ReviewList } from './ReviewList';
import { ratingSummary, reviewsHint } from './reviews';
import { StarRating } from './StarRating';

/** The whole reviews section; handles its own loading and error states. */
export function EventReviews({ eventId }: { eventId: string }) {
  const reviews = useEventReviews(eventId);
  const save = useSaveReview(eventId);

  return (
    <View style={styles.section} testID="event-reviews">
      <Text variant="heading" accessibilityRole="header">
        Reviews
      </Text>
      {reviews.isPending ? (
        <LoadingState />
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : (
        <>
          <View style={styles.summary} testID="review-summary">
            {reviews.data.averageRating !== null && <StarRating value={reviews.data.averageRating} size={18} />}
            <Text variant="cardTitle">{ratingSummary(reviews.data.averageRating, reviews.data.reviewCount)}</Text>
          </View>
          {reviewsHint(reviews.data) ? (
            <Text variant="caption" tone="muted" testID="review-hint">
              {reviewsHint(reviews.data)}
            </Text>
          ) : null}
          {reviews.data.canReview && (
            <ReviewForm
              key={reviews.data.myReview ? 'edit' : 'new'}
              initial={reviews.data.myReview}
              saving={save.isPending}
              saved={save.isSuccess}
              error={save.error ? friendlyError(save.error) : null}
              onSave={(input) => save.mutate(input)}
            />
          )}
          {reviews.data.reviews.length > 0 && <ReviewList reviews={reviews.data.reviews} />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 18 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
