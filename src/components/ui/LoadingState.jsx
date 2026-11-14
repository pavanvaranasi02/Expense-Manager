import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme/theme';

/**
 * Standardized KOSH loading indicator screen.
 */
const LoadingState = ({ message = 'Loading...' }) => (
  <SafeAreaView style={styles.container} edges={['top']}>
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  text: {
    ...Theme.typography.presets.body,
    color: Theme.colors.textMuted,
    marginTop: 12,
  },
});

export default LoadingState;

