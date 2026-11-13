import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SetupAccountsScreen from '../screens/onboarding/SetupAccountsScreen';
import SetupBudgetScreen from '../screens/onboarding/SetupBudgetScreen';
import SetupProfileScreen from '../screens/onboarding/SetupProfileScreen';
import SetupStorageScreen from '../screens/onboarding/SetupStorageScreen';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';

const Stack = createNativeStackNavigator();

const OnboardingNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8F9FE' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SetupStorage" component={SetupStorageScreen} />
      <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
      <Stack.Screen name="SetupAccounts" component={SetupAccountsScreen} />
      <Stack.Screen name="SetupBudget" component={SetupBudgetScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;