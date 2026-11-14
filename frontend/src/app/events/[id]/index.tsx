// Event details: description, place, organiser, participants with reliability, join / leave (PLAN 13.4), and attendee reviews.
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import { categoryMeta, VOLUNTEER_BONUS } from '@/features/events/categories';
import { EventArt } from '@/features/events/EventArt';
import { EventReviews } from '@/features/events/EventReviews';
import { isFull, priceLabel, spotsLabel } from '@/features/events/format';
import { ParticipantList } from '@/features/events/ParticipantList';
import { useBanParticipant, useEvent, useJoinEvent, useLeaveEvent, useMe, useParticipants } from '@/hooks/queries';
import { formatEventDate, minutesUntil } from '@/lib/time';
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

/** One icon + text line (date, place…). */
function InfoRow({ icon, children }: { icon: React.ComponentProps<typeof Icon>['name']; children: string }) {
  return (
    <View style={styles.info}>
      <Icon name={icon} size={16} color={colors.signal} />
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

/** Full details of one event. */
export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const me = useMe();
  const data = event.data;
  const isOrganizer = !!data?.organizer && data.organizer.id === me.data?.id;
  const participants = useParticipants(id, data?.source === 'USER');
  const join = useJoinEvent(id);
  const leave = useLeaveEvent(id);
  const ban = useBanParticipant(id);

  if (event.isPending) return <Shell><LoadingState label="Loading event…" /></Shell>;
  if (event.isError) return <Shell><ErrorState error={event.error} onRetry={() => event.refetch()} /></Shell>;

  const e = event.data;
  const meta = categoryMeta(e.category);
  const joined = e.myStatus === 'JOINED' || e.myStatus === 'ATTENDED';
  const actionError = join.error ?? leave.error ?? ban.error;

  /** Opens the Map tab centred on this event. */
  function showOnMap() {
    router.push({ pathname: '/map', params: { lat: String(e.lat), lon: String(e.lon), title: e.title, eventId: e.id, at: String(Date.now()) } });
  }

  /** Warns about the late-cancel penalty before leaving. */
  function confirmLeave() {
    const late = minutesUntil(e.startsAt) < 120;
    Alert.alert('Leave this event?', late ? 'Leaving less than 2 hours before the start costs 2 civic trust points.' : 'You can join again later if there is space.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leave.mutate() },
    ]);
  }

  /** The main participation control, depending on who is looking. */
  function action() {
    if (e.source === 'EXTERNAL') {
      return e.externalUrl ? <Button title="Get tickets" icon="open-outline" onPress={() => Linking.openURL(e.externalUrl!)} /> : null;
    }
    if (isOrganizer) {
      return <Button title="Scan tickets" icon="qr-code-outline" iconLeft onPress={() => router.push(`/events/${e.id}/scan`)} />;
    }
    if (e.myStatus === 'BANNED') {
      return <Text tone="danger">The organiser banned you from this event.</Text>;
    }
    if (joined) {
      return (
        <View style={{ gap: 10 }}>
          <Button title="My ticket" icon="qr-code-outline" iconLeft onPress={() => router.push(`/events/${e.id}/ticket`)} />
          {e.myStatus === 'JOINED' && <Button title="Leave event" variant="danger" loading={leave.isPending} onPress={confirmLeave} />}
        </View>
      );
    }
    if (isFull(e)) return <Button title="Event full" disabled variant="secondary" />;
    return <Button title="Join event" icon="arrow-forward" loading={join.isPending} onPress={() => join.mutate()} />;
  }

  const price = e.source === 'EXTERNAL' ? priceLabel(e) : null;
  const spots = spotsLabel(e);

  return (
    <Shell>
      <EventArt category={e.category} imageUrl={e.imageUrl} shade style={styles.hero}>
        <View style={styles.heroChips}>
          <StatusChip label={meta.label} tone="accent" />
          {e.source === 'EXTERNAL' && <StatusChip label="TICKETED" tone="muted" />}
        </View>
      </EventArt>

      <Text variant="title" style={{ marginTop: 14 }} accessibilityRole="header">
        {e.title}
      </Text>

      <View style={styles.infoBlock}>
        <InfoRow icon="calendar-outline">{formatEventDate(e.startsAt)}</InfoRow>
        {(e.venueName || e.address) && <InfoRow icon="location-outline">{[e.venueName, e.address].filter(Boolean).join(' · ')}</InfoRow>}
        {price && <InfoRow icon="pricetag-outline">{price}</InfoRow>}
        {spots && <InfoRow icon="people-outline">{spots}</InfoRow>}
        {e.category === 'VOLUNTEER' && (
          <InfoRow icon="leaf-outline">{`Volunteer action · +${VOLUNTEER_BONUS} bonus civic trust points on check-in`}</InfoRow>
        )}
      </View>

      {e.lat !== null && e.lon !== null && (
        <Button title="Show on map" variant="secondary" icon="map-outline" iconLeft onPress={showOnMap} style={{ marginBottom: 14 }} />
      )}

      {e.description ? (
        <Card style={{ marginBottom: 14 }}>
          <Text tone="muted">{e.description}</Text>
        </Card>
      ) : null}

      {e.organizer && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Organiser ${e.organizer.username}`}
          onPress={() => router.push(`/users/${e.organizer!.id}`)}
          style={styles.organizer}
        >
          <Avatar size={38} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              Organiser
            </Text>
            <Text variant="cardTitle">{e.organizer.username}</Text>
          </View>
          <ReliabilityBadge score={e.organizer.reliabilityScore} />
        </Pressable>
      )}

      <View style={{ marginVertical: 14 }}>{action()}</View>
      {actionError ? (
        <Text tone="danger" accessibilityRole="alert" style={{ marginBottom: 12 }}>
          {friendlyError(actionError)}
        </Text>
      ) : null}

      {e.source === 'USER' && (
        <View style={{ gap: 10 }}>
          <Text variant="heading" accessibilityRole="header">
            Participants ({e.participantCount})
          </Text>
          {participants.isPending ? (
            <LoadingState />
          ) : participants.isError ? (
            <ErrorState error={participants.error} onRetry={() => participants.refetch()} />
          ) : participants.data.length === 0 ? (
            <Text tone="muted">Nobody has joined yet.</Text>
          ) : (
            <ParticipantList participants={participants.data} canBan={isOrganizer} banning={ban.isPending} onBan={(userId) => ban.mutate(userId)} />
          )}
        </View>
      )}

      {e.source === 'USER' && <EventReviews eventId={e.id} />}
    </Shell>
  );
}

/** Scrolling screen with a back header. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Event" />
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16 },
  heroChips: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 6 },
  infoBlock: { gap: 8, marginTop: 10, marginBottom: 16 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  organizer: {
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
