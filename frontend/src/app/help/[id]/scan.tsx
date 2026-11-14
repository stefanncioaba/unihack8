// Requester's scanner: scan the helper's QR code; the first scan closes the request and gives them +5 (PLAN 25).
import { router, useLocalSearchParams } from 'expo-router';

import { helpOutcomeFromError, helpOutcomeFromSuccess } from '@/features/help/checkInResult';
import { QrScanner } from '@/features/scan/QrScanner';
import { useHelpCheckIn, useHelpRequest } from '@/hooks/useHelp';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';

/** Camera scanner with a typed-code fallback for the helper's code. */
export default function HelpScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useHelpRequest(id);
  const checkIn = useHelpCheckIn(id);

  /** Confirms one helper's code and describes the result. */
  async function confirm(token: string) {
    try {
      return helpOutcomeFromSuccess(await checkIn.mutateAsync(token));
    } catch (error) {
      return helpOutcomeFromError(error);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Scan helper’s QR" subtitle={request.data?.title} />
      <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
        Scan the code of the neighbour who helped you. They get +5 civic trust points and the request closes.
      </Text>
      <QrScanner
        onToken={confirm}
        pending={checkIn.isPending}
        permissionMessage="Allow the camera to scan your helper’s QR code."
        manualLabel="Or enter the helper’s code"
        manualPlaceholder="Helper code"
        manualButton="Confirm help"
        nextLabel="Scan again"
        successAction={{ label: 'Back to request', onPress: () => router.back() }}
      />
    </Screen>
  );
}
