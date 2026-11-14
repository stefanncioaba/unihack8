// Shared QR scanner: camera (with the permission prompt), the result card, and a typed-code fallback.
// Used by the event check-in scanner (PLAN 13.7) and the Help Board scanner (PLAN 25).
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ScanOutcome } from '@/features/events/checkInResult';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { EmptyState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors } from '@/ui/theme';

const OUTCOME_STYLE = {
  success: { icon: 'checkmark-circle', color: colors.signal },
  warning: { icon: 'alert-circle', color: colors.gold },
  error: { icon: 'close-circle', color: colors.danger },
} as const;

type Props = {
  /** Sends one code to the backend and turns the answer into a result card. */
  onToken: (token: string) => Promise<ScanOutcome>;
  pending?: boolean;
  /** Why the camera is needed (shown when permission is missing). */
  permissionMessage: string;
  manualLabel: string;
  manualPlaceholder: string;
  manualButton: string;
  /** Button under any result that resets the scanner. */
  nextLabel?: string;
  /** Optional button under a success instead of `nextLabel` (e.g. "Back to request"). */
  successAction?: { label: string; onPress: () => void };
};

/** Camera scanner that handles each code once until the result is dismissed. */
export function QrScanner({ onToken, pending, permissionMessage, manualLabel, manualPlaceholder, manualButton, nextLabel = 'Scan next', successAction }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [manual, setManual] = useState('');
  // The camera reports the same code many times per second; handle it once until dismissed.
  const locked = useRef(false);

  /** Sends one token and shows the result. */
  async function handleToken(token: string) {
    const value = token.trim();
    if (!value || locked.current) return;
    locked.current = true;
    setOutcome(await onToken(value));
  }

  /** Clears the result so the next code can be scanned. */
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
          message={permission.canAskAgain ? permissionMessage : 'Enable the camera for this app in your phone settings.'}
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
    <View>
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
      {outcome &&
        (outcome.kind === 'success' && successAction ? (
          <Button title={successAction.label} icon="arrow-forward" onPress={successAction.onPress} style={{ marginTop: 12 }} />
        ) : (
          <Button title={nextLabel} icon="scan-outline" onPress={scanNext} style={{ marginTop: 12 }} />
        ))}

      {!outcome && (
        <View style={styles.manual}>
          <TextField label={manualLabel} value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder={manualPlaceholder} />
          <Button title={manualButton} variant="secondary" disabled={!manual.trim()} loading={pending} onPress={() => handleToken(manual)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraBox: { aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '62%', aspectRatio: 1, borderRadius: 18, borderWidth: 2, borderColor: colors.signal },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  manual: { gap: 10, marginTop: 4 },
});
