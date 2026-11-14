// Organiser scanner: camera QR scan -> check-in result (PLAN 13.7). The camera and result UI are the shared QrScanner.
import { useLocalSearchParams } from 'expo-router';

import { outcomeFromError, outcomeFromSuccess } from '@/features/events/checkInResult';
import { QrScanner } from '@/features/scan/QrScanner';
import { useCheckIn, useEvent } from '@/hooks/queries';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';

/** Scans participants' QR codes and checks them in. */
export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const checkIn = useCheckIn(id);

  /** Checks one token in and describes the result. */
  async function check(token: string) {
    try {
      return outcomeFromSuccess(await checkIn.mutateAsync(token));
    } catch (error) {
      return outcomeFromError(error);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Scan tickets" subtitle={event.data?.title} />
      <QrScanner
        onToken={check}
        pending={checkIn.isPending}
        permissionMessage="Allow the camera to scan participants’ tickets."
        manualLabel="Or enter the ticket code"
        manualPlaceholder="Ticket code"
        manualButton="Check in"
      />
    </Screen>
  );
}
