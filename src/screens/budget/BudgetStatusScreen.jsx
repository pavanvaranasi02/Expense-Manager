import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/ui/EmptyState';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { Theme } from '../../theme/theme';

const BudgetStatusScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container} edges={['top']}>
    <ScreenHeader title="Budget Status" showBack navigation={navigation} />
    <EmptyState
      icon="pie-chart-outline"
      title="Budget Overview"
      description="Monthly category limits and spending status are tracked in your Plan hub."
      actionLabel="View Plan"
      onAction={() => navigation.goBack()}
    />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
});

export default BudgetStatusScreen;
