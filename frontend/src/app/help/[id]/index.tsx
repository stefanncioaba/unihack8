// Help request page: status, details, requester, expiry, offers with civic trust, and the actions for
// the requester (scan a helper, cancel) or a neighbour (offer, withdraw, my QR code) (PLAN 25).
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import { HELP_POINTS, type HelpRequestDetail } from '@/api/types.help';
import { helpCategoryMeta } from '@/features/help/categories';
import { statusLabel, statusLine, timeAgo } from '@/features/help/format';
import { OfferList } from '@/features/help/OfferList';
import { useCancelHelpRequest, useHelpRequest, useOfferHelp, useWithdrawHelp } from '@/hooks/useHelp';
import { formatEventDate } from '@/lib/time';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { StatusChip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { ReliabilityBadge } from '@/ui/ReliabilityBadge';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** One icon + text line (status, place, expiry…). */
function InfoRow({ icon, children, testID }: { icon: React.ComponentProps<typeof Icon>['name']; children: string; testID?: string }) {
  return (
    <View style={styles.info} testID={testID}>
      <Icon name={icon} size={16} color={colors.signal} />
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

/** Tone of the status chip: blue when helped, grey when cancelled / expired. */
function statusTone(r: HelpRequestDetail): 'signal' | 'muted' {
  return r.status === 'OPEN' || r.status === 'HELPED' ? 'signal' : 'muted';
}

/** Full details of one help request. */
export default function HelpRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useHelpRequest(id);
  const offer = useOfferHelp(id);
  const withdraw = useWithdrawHelp(id);
  const cancel = useCancelHelpRequest(id);

  if (request.isPending) return <Shell><LoadingState label="Loading request…" /></Shell>;
  if (request.isError) return <Shell><ErrorState error={request.error} onRetry={() => request.refetch()} /></Shell>;

  const r = request.data;
  const meta = helpCategoryMeta(r.category);
  // The server only flips the status lazily; treat an open request past its expiry as expired here too.
  const open = r.status === 'OPEN' && Date.parse(r.expiresAt) > Date.now();
  const shown: HelpRequestDetail = r.status === 'OPEN' && !open ? { ...r, status: 'EXPIRED' } : r;
  const actionError = offer.error ?? withdraw.error ?? cancel.error;

  /** Opens the Map tab centred on the request. */
  function showOnMap() {
    router.push({ pathname: '/map', params: { lat: String(r.lat), lon: String(r.lon), title: r.title, at: String(Date.now()) } });
  }

  /** Asks before cancelling (it is free, but cannot be undone). */
  function confirmCancel() {
    Alert.alert('Cancel this request?', 'It leaves the board and nobody can offer any more. No points change.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: () => cancel.mutate() },
    ]);
  }

  /** The actions for whoever is looking, depending on the status. */
  function actions() {
    if (r.isRequester) {
      if (!open) return null;
      return (
        <View style={{ gap: 10 }}>
          <Button title="Scan helper’s QR" icon="qr-code-outline" iconLeft onPress={() => router.push(`/help/${r.id}/scan`)} />
          <Button title="Cancel request" variant="danger" loading={cancel.isPending} onPress={confirmCancel} />
        </View>
      );
    }
    if (r.myOffer === 'HELPED') {
      return <Text tone="signal">{`You helped · +${HELP_POINTS} civic trust points`}</Text>;
    }
    if (r.myOffer === 'NOT_NEEDED') {
      return <Text tone="muted">Not needed: someone else helped first. Thanks for offering!</Text>;
    }
    if (r.myOffer === 'OFFERED' && open) {
      return (
        <View style={{ gap: 10 }}>
          <Button title="My QR code" icon="qr-code-outline" iconLeft onPress={() => router.push(`/help/${r.id}/ticket`)} />
          <Button title="Withdraw offer" variant="secondary" loading={withdraw.isPending} onPress={() => withdraw.mutate()} />
          <Text variant="caption" tone="muted">
            {`Show your QR code to ${r.requester.username} when you meet. Withdrawing is free.`}
          </Text>
        </View>
      );
    }
    if (r.canOffer && open) {
      return (
        <View style={{ gap: 10 }}>
          <Button title="Offer to help" icon="hand-left-outline" iconLeft loading={offer.isPending} onPress={() => offer.mutate()} />
          <Text variant="caption" tone="muted">
            {`If ${r.requester.username} scans your code when you meet, you get +${HELP_POINTS} civic trust points.`}
          </Text>
        </View>
      );
    }
    return null;
  }

  return (
    <Shell>
      <View style={styles.chips}>
        <StatusChip label={meta.label} tone="muted" />
        <StatusChip label={statusLabel(shown)} tone={statusTone(shown)} />
      </View>
      <Text variant="title" style={{ marginTop: 10 }} accessibilityRole="header">
        {r.title}
      </Text>

      <View style={styles.infoBlock}>
        <InfoRow icon="information-circle-outline" testID="help-status">
          {statusLine(shown)}
        </InfoRow>
        <InfoRow icon="time-outline">{`Posted ${timeAgo(r.createdAt).toLowerCase()} · ${formatEventDate(r.createdAt)}`}</InfoRow>
        {open && <InfoRow icon="hourglass-outline">{`Open until ${formatEventDate(r.expiresAt)}`}</InfoRow>}
        {r.address ? <InfoRow icon="location-outline">{r.address}</InfoRow> : null}
      </View>

      {r.lat !== null && r.lon !== null && (
        <Button title="Show on map" variant="secondary" icon="map-outline" iconLeft onPress={showOnMap} style={{ marginBottom: 14 }} />
      )}

      {r.description ? (
        <Card style={{ marginBottom: 14 }}>
          <Text tone="muted">{r.description}</Text>
        </Card>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Requester ${r.requester.username}`}
        onPress={() => router.push(`/users/${r.requester.id}`)}
        style={styles.person}
      >
        <Avatar size={38} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="muted">
            {r.isRequester ? 'Asked by you' : 'Asked by'}
          </Text>
          <Text variant="cardTitle">{r.requester.username}</Text>
        </View>
        <ReliabilityBadge score={r.requester.reliabilityScore} />
      </Pressable>

      <View style={{ marginVertical: 14 }}>{actions()}</View>
      {actionError ? (
        <Text tone="danger" accessibilityRole="alert" style={{ marginBottom: 12 }}>
          {friendlyError(actionError)}
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        <Text variant="heading" accessibilityRole="header">
          Offers ({r.offers.length})
        </Text>
        {r.isRequester && open && r.offers.length > 0 ? (
          <Text variant="caption" tone="muted">
            Pick someone you trust: check their civic trust score, meet, then scan their QR code. The first scan closes the request.
          </Text>
        ) : null}
        {r.offers.length === 0 ? <Text tone="muted">Nobody has offered yet.</Text> : <OfferList offers={r.offers} />}
      </View>
    </Shell>
  );
}

/** Scrolling screen with a back header. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Help request" />
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 6 },
  infoBlock: { gap: 8, marginTop: 10, marginBottom: 16 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
