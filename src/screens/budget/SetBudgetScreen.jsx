import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/ui/EmptyState';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { Theme } from '../../theme/theme';

const SetBudgetScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container} edges={['top']}>
    <ScreenHeader title="Set Budget" showBack navigation={navigation} />
    <EmptyState
      icon="options-outline"
      title="Configure Monthly Limits"
      description="Create and manage category spending limits from the Budgets screen."
      actionLabel="Open Budgets"
      onAction={() => navigation.replace('BudgetList')}
    />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
});

export default SetBudgetScreen;
