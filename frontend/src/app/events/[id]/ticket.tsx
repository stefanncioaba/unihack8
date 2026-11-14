// My ticket: the participant's QR code for an event (PLAN 13.6). The QR holds only the `qrToken`.
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QrTile } from '@/features/scan/QrTile';
import { useEvent, useMyTicket } from '@/hooks/queries';
import { formatEventDate } from '@/lib/time';
import { StatusChip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';

/** Shows the QR code the organiser scans at the venue. */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useMyTicket(id);
  const event = useEvent(id);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="My ticket" />
      {ticket.isPending ? (
        <LoadingState label="Loading ticket…" />
      ) : ticket.isError ? (
        <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
      ) : (
        <View style={styles.wrap}>
          <QrTile value={ticket.data.qrToken} />
          <StatusChip
            label={ticket.data.status === 'ATTENDED' ? 'CHECKED IN' : 'READY TO SCAN'}
            tone={ticket.data.status === 'ATTENDED' ? 'signal' : 'accent'}
          />
          {event.data && (
            <View style={styles.details}>
              <Text variant="heading" style={styles.center}>
                {event.data.title}
              </Text>
              <Text tone="accent" style={styles.center}>
                {formatEventDate(event.data.startsAt)}
              </Text>
              {event.data.venueName ? (
                <Text tone="muted" style={styles.center}>
                  {event.data.venueName}
                </Text>
              ) : null}
            </View>
          )}
          <Text variant="caption" tone="muted" style={styles.center}>
            Show this code to the organiser when you arrive. Attending earns civic trust points; missing the event costs them.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16, paddingTop: 12 },
  details: { gap: 4, alignItems: 'center' },
  center: { textAlign: 'center' },
});
