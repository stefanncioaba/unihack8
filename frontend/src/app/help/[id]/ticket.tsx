// Helper's QR code for a help request (PLAN 25). The QR holds only the `qrToken`; it refreshes until scanned.
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { HelpTicket } from '@/api/types.help';
import { ticketState } from '@/features/help/format';
import { QrTile } from '@/features/scan/QrTile';
import { useHelpRequest, useHelpTicket } from '@/hooks/useHelp';
import { StatusChip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Shows the QR code the requester scans, or the result once the request is closed. */
export default function HelpTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useHelpTicket(id);
  const request = useHelpRequest(id);
  const r = request.data;
  const closed = !!r && (r.status === 'CANCELLED' || r.status === 'EXPIRED' || (r.status === 'OPEN' && Date.parse(r.expiresAt) <= Date.now()));

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="My QR code" subtitle={r?.title} />
      {ticket.isPending ? (
        <LoadingState label="Loading your code…" />
      ) : ticket.isError ? (
        <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
      ) : (
        <TicketBody ticket={ticket.data} requester={r?.requester.username ?? 'the requester'} closed={closed} />
      )}
    </Screen>
  );
}

/** The QR (only while it can still be scanned), the status chip and what it means. */
function TicketBody({ ticket, requester, closed }: { ticket: HelpTicket; requester: string; closed: boolean }) {
  const state = ticketState(ticket.status, requester, closed);
  const scannable = ticket.status === 'OFFERED' && !closed;
  return (
    <View style={styles.wrap}>
      {scannable ? (
        <QrTile value={ticket.qrToken} label="Helper QR code" />
      ) : (
        <View style={styles.done}>
          <Icon name={ticket.status === 'HELPED' ? 'checkmark-circle' : 'information-circle-outline'} size={56} color={ticket.status === 'HELPED' ? colors.signal : colors.textMuted} />
        </View>
      )}
      <StatusChip label={state.chip} tone={state.tone} />
      <Text tone="muted" style={styles.center}>
        {state.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16, paddingTop: 12 },
  done: { width: 248, height: 160, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
