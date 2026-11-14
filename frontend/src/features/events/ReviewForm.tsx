// Review form for a checked-in attendee: pick 1–5 stars, add an optional comment, save (creates or replaces).
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { REVIEW_COMMENT_MAX, type Review, type ReviewInput } from '@/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { StarRating } from './StarRating';

type Props = {
  /** My saved review; the form starts from it and says "Edit your review". */
  initial: Review | null;
  saving?: boolean;
  /** Friendly error of the last save, if it failed. */
  error?: string | null;
  saved?: boolean;
  onSave: (input: ReviewInput) => void;
};

/** Star picker + comment field + save button. */
export function ReviewForm({ initial, saving, error, saved, onSave }: Props) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [touched, setTouched] = useState(false);

  /** Sends the review; an empty comment is sent as null. */
  function submit() {
    if (rating < 1) return;
    setTouched(false);
    onSave({ rating, comment: comment.trim() ? comment.trim() : null });
  }

  return (
    <Card style={styles.card} testID="review-form">
      <Text variant="cardTitle" accessibilityRole="header">
        {initial ? 'Edit your review' : 'Rate this event'}
      </Text>
      <StarRating
        value={rating}
        size={28}
        onChange={(n) => {
          setRating(n);
          setTouched(true);
        }}
        testID="review-stars"
      />
      <TextField
        label="Comment (optional)"
        placeholder="What was it like?"
        value={comment}
        onChangeText={(t) => {
          setComment(t);
          setTouched(true);
        }}
        maxLength={REVIEW_COMMENT_MAX}
        multiline
      />
      <Text variant="caption" tone="muted" style={styles.counter}>
        {comment.length}/{REVIEW_COMMENT_MAX}
      </Text>
      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : saved && !touched ? (
        <Text tone="signal" accessibilityLiveRegion="polite">
          Review saved
        </Text>
      ) : null}
      <Button title={initial ? 'Update review' : 'Save review'} loading={saving} disabled={rating < 1} onPress={submit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  counter: { alignSelf: 'flex-end', marginTop: -6 },
});
