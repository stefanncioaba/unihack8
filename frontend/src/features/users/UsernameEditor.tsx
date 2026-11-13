// Inline "change username" form with local validation and the server's "already taken" error (PLAN 16.2).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import { useChangeUsername } from '@/hooks/useUsers';
import { validateUsername } from '@/lib/validation';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

type Props = { current: string; onDone: () => void };

/** Text field plus Save / Cancel. Calls `onDone` after a successful save, an unchanged name or Cancel. */
export function UsernameEditor({ current, onDone }: Props) {
  const [value, setValue] = useState(current);
  const [touched, setTouched] = useState(false);
  const change = useChangeUsername();

  const trimmed = value.trim();
  const localError = touched ? validateUsername(trimmed) : null;
  const serverError = change.isError ? friendlyError(change.error) : null;

  /** Validates, then saves; the server decides whether the name is taken. */
  function submit() {
    setTouched(true);
    if (validateUsername(trimmed)) return;
    if (trimmed === current) return onDone();
    change.mutate(trimmed, { onSuccess: onDone });
  }

  return (
    <View style={styles.wrap} testID="username-editor">
      <TextField
        label="Username"
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setTouched(true);
          if (change.isError) change.reset();
        }}
        error={localError ?? serverError}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={20}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.buttons}>
        <Button title="Save" small loading={change.isPending} onPress={submit} style={styles.flex} />
        <Button title="Cancel" small variant="secondary" disabled={change.isPending} onPress={onDone} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
