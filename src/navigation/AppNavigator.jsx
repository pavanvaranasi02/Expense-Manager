import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { auth } from '../config/firebase';
import { getUserProfile } from '../services/authService';
import useAuthStore from '../store/useAuthStore';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import OnboardingNavigator from './OnboardingNavigator';

import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import AddIncomeScreen from '../screens/income/AddIncomeScreen';

const LoadingScreen = () => (
  <View style={loadingStyles.container}>
    <ActivityIndicator size="large" color="#6C63FF" />
    <Text style={loadingStyles.text}>Loading...</Text>
  </View>
);

const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FE' },
  text: { marginTop: 12, fontSize: 14, color: '#6B7280' },
});

const Stack = createNativeStackNavigator();

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
        // Fetch their profile from Firestore
        const result = await getUserProfile(firebaseUser.uid);

        if (result.success) {
          console.log('✅ Profile loaded:', {
            name: result.profile.name,
            onboardingComplete: result.profile.onboardingComplete,
          });
          setUserProfile(result.profile);
        } else {
          console.log('⚠️ No profile found, will show onboarding');
          // User exists in Auth but no Firestore profile
          // This means they need onboarding
          setUserProfile({ onboardingComplete: false });
        }
        
        // Set user only after profile logic to avoid flashing Onboarding navigator
        setUser(firebaseUser);
      } else {
        // User is signed out
        console.log('👋 User signed out');
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Debug log
  useEffect(() => {
    console.log('📱 Navigation state:', {
      isAuthenticated,
      isOnboardingComplete,
      isLoading,
    });
  }, [isAuthenticated, isOnboardingComplete, isLoading]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // ===== NOT LOGGED IN =====
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !isOnboardingComplete ? (
          // ===== NEEDS ONBOARDING =====
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          // ===== FULLY READY =====
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
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