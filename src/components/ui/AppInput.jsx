import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Theme } from '../../theme/theme';

/**
 * Standardized KOSH form input / search field with Manrope typography.
 */
const AppInput = ({
  label,
  icon,
  error,
  containerStyle,
  inputStyle,
  ...props
}) => (
  <View style={[styles.wrapper, containerStyle]}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={[styles.inputRow, error && styles.inputRowError]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={Theme.colors.textMuted}
          style={styles.icon}
        />
      ) : null}
      <TextInput
        style={[styles.input, inputStyle]}
        placeholderTextColor={Theme.colors.textLight}
        {...props}
      />
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    ...Theme.typography.presets.formLabel,
    color: Theme.colors.textMuted,
    marginBottom: 6,
  },
  inputRow: {
    minHeight: Theme.layout.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
  },
  inputRowError: {
    borderColor: Theme.colors.error,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    ...Theme.typography.presets.inputValue,
    color: Theme.colors.text,
    paddingVertical: 10,
  },
  errorText: {
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.error,
    marginTop: 4,
  },
});

export default AppInput;

