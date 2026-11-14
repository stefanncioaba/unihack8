// The QR code on a light tile (it needs one to scan reliably). Holds only the token it is given.
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors } from '@/ui/theme';

/** Square QR code of `value`, used by event tickets and Help Board helper codes. */
export function QrTile({ value, label = 'Ticket QR code', testID = 'ticket-qr' }: { value: string; label?: string; testID?: string }) {
  return (
    <View style={styles.qr} accessibilityLabel={label} testID={testID}>
      <QRCode value={value} size={216} color="#000814" backgroundColor="#EEF3FA" />
    </View>
  );
}

const styles = StyleSheet.create({
  qr: { padding: 16, borderRadius: 16, backgroundColor: '#EEF3FA', borderWidth: 1, borderColor: colors.borderStrong },
});
