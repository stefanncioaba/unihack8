// Organiser scanner: camera QR scan -> check-in result (PLAN 13.7).
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { outcomeFromError, outcomeFromSuccess, type ScanOutcome } from '@/features/events/checkInResult';
import { useCheckIn, useEvent } from '@/hooks/queries';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';

const OUTCOME_STYLE = {
  success: { icon: 'checkmark-circle', color: colors.teal },
  warning: { icon: 'alert-circle', color: colors.orangeSoft },
  error: { icon: 'close-circle', color: colors.danger },
} as const;

/** Scans participants' QR codes and checks them in. */
export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const [permission, requestPermission] = useCameraPermissions();
  const checkIn = useCheckIn(id);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [manual, setManual] = useState('');
  // The camera reports the same code many times per second; handle it once until dismissed.
  const locked = useRef(false);

  /** Sends one token to the backend and shows the result. */
  async function handleToken(token: string) {
    const value = token.trim();
    if (!value || locked.current) return;
    locked.current = true;
    try {
      setOutcome(outcomeFromSuccess(await checkIn.mutateAsync(value)));
    } catch (error) {
      setOutcome(outcomeFromError(error));
    }
  }

  /** Clears the result so the next ticket can be scanned. */
  function scanNext() {
    setOutcome(null);
    setManual('');
    locked.current = false;
  }

  /** The camera view, or the permission prompt. */
  function camera() {
    if (!permission) return <LoadingState label="Checking camera access…" />;
    if (!permission.granted) {
      return (
        <EmptyState
          icon="camera-outline"
          title="Camera access needed"
          message={permission.canAskAgain ? 'Allow the camera to scan participants’ tickets.' : 'Enable the camera for this app in your phone settings.'}
          actionLabel={permission.canAskAgain ? 'Allow camera' : undefined}
          onAction={permission.canAskAgain ? requestPermission : undefined}
        />
      );
    }
    return (
      <View style={styles.cameraBox} testID="camera-view">
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={outcome ? undefined : ({ data }) => handleToken(data)}
        />
        <View style={styles.frame} pointerEvents="none" />
      </View>
    );
  }

  const style = outcome ? OUTCOME_STYLE[outcome.kind] : null;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Scan tickets" subtitle={event.data?.title} />
      {camera()}

      {outcome && style && (
        <Card style={[styles.result, { borderColor: style.color }]} testID="scan-result">
          <Icon name={style.icon} size={32} color={style.color} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{outcome.title}</Text>
            <Text tone="muted">{outcome.message}</Text>
          </View>
        </Card>
      )}
      {outcome && <Button title="Scan next" icon="scan-outline" onPress={scanNext} style={{ marginTop: 12 }} />}

      {!outcome && (
        <View style={styles.manual}>
          <TextField label="Or enter the ticket code" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder="Ticket code" />
          <Button title="Check in" variant="secondary" disabled={!manual.trim()} loading={checkIn.isPending} onPress={() => handleToken(manual)} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraBox: { aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '62%', aspectRatio: 1, borderRadius: 18, borderWidth: 2, borderColor: colors.teal },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  manual: { gap: 10, marginTop: 4 },
});
