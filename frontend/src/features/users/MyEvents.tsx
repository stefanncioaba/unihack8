// "My events" on the profile: upcoming events I joined, events I organise (upcoming and past), and events I attended (PLAN 16.3).
import { parseIso } from '@/lib/time';
import { StyleSheet, View } from 'react-native';

import type { EventSummary } from '@/api/types';
import type { JoinedEvent } from '@/api/types.users';
import { useMyEvents } from '@/hooks/useUsers';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';

import { EventListItem } from '../events/EventCards';

/** Everything the three sections show, derived from the endpoint answer. */
export type MyEventGroups = { upcoming: EventSummary[]; organizing: EventSummary[]; pastOrganized: EventSummary[]; attended: EventSummary[] };

/** End of an event: its end time, or 3 hours after the start (same rule as the backend). */
function endOf(e: EventSummary): number {
  return e.endsAt ? parseIso(e.endsAt) : parseIso(e.startsAt) + 3 * 3_600_000;
}

/** Splits the answer: joined and not yet over (upcoming), organised by me and not over, organised and over (newest first), and attended (newest first). */
export function groupMyEvents(joined: JoinedEvent[], organizing: EventSummary[], now: number = Date.now()): MyEventGroups {
  return {
    upcoming: joined.filter((j) => j.status === 'JOINED' && endOf(j.event) >= now).map((j) => j.event),
    organizing: organizing.filter((e) => endOf(e) >= now),
    pastOrganized: organizing.filter((e) => endOf(e) < now).sort((a, b) => parseIso(b.startsAt) - parseIso(a.startsAt)),
    attended: joined
      .filter((j) => j.status === 'ATTENDED')
      .map((j) => j.event)
      .sort((a, b) => parseIso(b.startsAt) - parseIso(a.startsAt)),
  };
}

/** One titled list; hidden when empty. */
function Section({ title, events, testID }: { title: string; events: EventSummary[]; testID: string }) {
  if (events.length === 0) return null;
  return (
    <View style={styles.section} testID={testID}>
      <Text variant="cardTitle" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {events.map((e) => (
        <EventListItem key={e.id} event={e} />
      ))}
    </View>
  );
}

/** The profile's events block; handles its own loading, empty and error states. */
export function MyEvents() {
  const mine = useMyEvents();
  if (mine.isPending) return <LoadingState label="Loading your events…" />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} />;

  const groups = groupMyEvents(mine.data.joined, mine.data.organizing);
  if (groups.upcoming.length + groups.organizing.length + groups.pastOrganized.length + groups.attended.length === 0) {
    return <EmptyState icon="calendar-outline" title="No events yet" message="Events you join or organise show up here." />;
  }
  return (
    <View style={{ gap: 18 }} testID="my-events">
      <Section title="Upcoming" events={groups.upcoming} testID="my-events-upcoming" />
      <Section title="Organising" events={groups.organizing} testID="my-events-organizing" />
      <Section title="Organised (past)" events={groups.pastOrganized} testID="my-events-past-organized" />
      <Section title="Attended" events={groups.attended} testID="my-events-attended" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
});
