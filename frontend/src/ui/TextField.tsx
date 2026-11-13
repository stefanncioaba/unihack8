// Dark text inputs: a labelled form field and a search field.
import { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { colors, radius } from './theme';

type FieldProps = TextInputProps & { label?: string; error?: string | null };

/** Labelled input with an inline error line. */
export const TextField = forwardRef<TextInput, FieldProps>(function TextField({ label, error, style, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      {label && (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor="#6F6E80"
        selectionColor={colors.orange}
        {...rest}
        style={[styles.input, error ? { borderColor: colors.danger } : null, rest.multiline && styles.multiline, style]}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

type SearchProps = Omit<TextInputProps, 'style'> & {
  /** When set the field is a read-only button (used on Home to open the search screen). */
  onPressField?: () => void;
  onClear?: () => void;
};

/** Full-width search field with a muted icon on the left. */
export const SearchField = forwardRef<TextInput, SearchProps>(function SearchField({ onPressField, onClear, value, ...rest }, ref) {
  const body = (
    <View style={styles.search}>
      <Icon name="search-outline" size={16} color={colors.textMuted} />
      <TextInput
        ref={ref}
        accessibilityLabel={rest.placeholder ?? 'Search'}
        placeholderTextColor="#6F6E80"
        selectionColor={colors.orange}
        editable={!onPressField}
        pointerEvents={onPressField ? 'none' : 'auto'}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
        value={value}
        style={styles.searchInput}
      />
      {!onPressField && !!value && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear} hitSlop={10}>
          <Icon name="close-circle" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
  if (onPressField) {
    return (
      <Pressable accessibilityRole="search" accessibilityLabel={rest.placeholder ?? 'Search'} onPress={onPressField}>
        {body}
      </Pressable>
    );
  }
  return body;
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: 46,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
  },
  multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
});
