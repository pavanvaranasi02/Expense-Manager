import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { auth } from '../config/firebase';
import { getUserProfile } from '../services/authService';
import useAuthStore from '../store/useAuthStore';
import { Theme } from '../theme/theme';

import AuthNavigator from './AuthNavigator';
import FamilyNavigator from './FamilyNavigator';
import MainTabNavigator from './MainTabNavigator';
import OnboardingNavigator from './OnboardingNavigator';

import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import AddIncomeScreen from '../screens/income/AddIncomeScreen';

// Profile / Settings Stack (opened from top-right avatar)
import BudgetListScreen from '../screens/budget/BudgetListScreen';
import BudgetStatusScreen from '../screens/budget/BudgetStatusScreen';
import SetBudgetScreen from '../screens/budget/SetBudgetScreen';
import PortfolioScreen from '../screens/investments/PortfolioScreen';
import ActivityLogsScreen from '../screens/profile/ActivityLogsScreen';
import AddAccountScreen from '../screens/profile/AddAccountScreen';
import CreditCardBillScreen from '../screens/profile/CreditCardBillScreen';
import ManageAccountsScreen from '../screens/profile/ManageAccountsScreen';
import ManageCategoriesScreen from '../screens/profile/ManageCategoriesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';

const LoadingScreen = () => (
  <View style={loadingStyles.container}>
    <ActivityIndicator size="large" color={Theme.colors.primary} />
    <Text style={loadingStyles.text}>Loading KOSH...</Text>
  </View>
);

const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },
  text: { marginTop: 12, fontSize: 14, color: Theme.colors.textMuted },
});

const Stack = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();

const ProfileStack = () => (
  <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
    <ProfileStackNav.Screen name="ManageCategories" component={ManageCategoriesScreen} />
    <ProfileStackNav.Screen name="ActivityLogs" component={ActivityLogsScreen} />
    <ProfileStackNav.Screen name="Settings" component={SettingsScreen} />
    {/* Compatibility routes in case any deep link or alert targets them via Profile */}
    <ProfileStackNav.Screen name="ManageAccounts" component={ManageAccountsScreen} />
    <ProfileStackNav.Screen name="AddAccount" component={AddAccountScreen} />
    <ProfileStackNav.Screen name="Portfolio" component={PortfolioScreen} />
    <ProfileStackNav.Screen name="CreditCardBill" component={CreditCardBillScreen} />
    <ProfileStackNav.Screen name="BudgetList" component={BudgetListScreen} />
    <ProfileStackNav.Screen name="BudgetStatus" component={BudgetStatusScreen} />
    <ProfileStackNav.Screen name="SetBudget" component={SetBudgetScreen} />
  </ProfileStackNav.Navigator>
);

const AppNavigator = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isOnboardingComplete = useAuthStore((state) => state.isOnboardingComplete);
  const setUser = useAuthStore((state) => state.setUser);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    console.log('🔄 Setting up auth listener...');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔔 Auth state changed:', firebaseUser ? firebaseUser.uid : 'null');

      if (firebaseUser) {
        const result = await getUserProfile(firebaseUser.uid);

        if (result.success) {
          console.log('✅ Profile loaded:', {
            name: result.profile.name,
            onboardingComplete: result.profile.onboardingComplete,
          });
          setUserProfile(result.profile);
        } else {
          console.log('⚠️ No profile found, will show onboarding');
          setUserProfile({ onboardingComplete: false });
        }

        setUser(firebaseUser);
      } else {
        console.log('👋 User signed out');
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !isOnboardingComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="Family"
              component={FamilyNavigator}
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileStack}
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="AddExpenseModal"
              component={AddExpenseScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="AddIncomeModal"
              component={AddIncomeScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
