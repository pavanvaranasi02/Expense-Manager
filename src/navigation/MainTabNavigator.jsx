import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QuickActionSheet from '../components/ui/QuickActionSheet';
import useAuthStore from '../store/useAuthStore';
import { Theme } from '../theme/theme';

// Home Stack Screens
import NotificationsScreen from '../components/Notifications/NotificationsScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import BudgetStatusScreen from '../screens/budget/BudgetStatusScreen';
import DashboardScreen from '../screens/home/DashboardScreen';

// Activity Stack Screens
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import ExpenseListScreen from '../screens/expenses/ExpenseListScreen';
import IncomeListScreen from '../screens/income/IncomeListScreen';

// Plan Stack Screens
import BudgetListScreen from '../screens/budget/BudgetListScreen';
import SetBudgetScreen from '../screens/budget/SetBudgetScreen';
import PlanScreen from '../screens/plan/PlanScreen';
import CreditCardBillScreen from '../screens/profile/CreditCardBillScreen';

// Wealth Stack Screens
import PortfolioScreen from '../screens/investments/PortfolioScreen';
import AddAccountScreen from '../screens/profile/AddAccountScreen';
import ManageAccountsScreen from '../screens/profile/ManageAccountsScreen';
import WealthScreen from '../screens/wealth/WealthScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
    <Stack.Screen name="BudgetStatus" component={BudgetStatusScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

const ActivityStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
    <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
    <Stack.Screen name="IncomeList" component={IncomeListScreen} />
    <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
  </Stack.Navigator>
);

const PlanStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PlanMain" component={PlanScreen} />
    <Stack.Screen name="BudgetList" component={BudgetListScreen} />
    <Stack.Screen name="BudgetStatus" component={BudgetStatusScreen} />
    <Stack.Screen name="SetBudget" component={SetBudgetScreen} />
    <Stack.Screen name="CreditCardBill" component={CreditCardBillScreen} />
  </Stack.Navigator>
);

const WealthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WealthMain" component={WealthScreen} />
    <Stack.Screen name="ManageAccounts" component={ManageAccountsScreen} />
    <Stack.Screen name="AddAccount" component={AddAccountScreen} />
    <Stack.Screen name="Portfolio" component={PortfolioScreen} />
    <Stack.Screen name="CreditCardBill" component={CreditCardBillScreen} />
  </Stack.Navigator>
);

const CustomTabBarButton = ({ onPress }) => (
  <View style={styles.fabSlot}>
    <TouchableOpacity
      style={styles.fab}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel="Quick add"
    >
      <Ionicons name="add" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  </View>
);

const DummyScreen = () => null;

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Activity: ['swap-vertical', 'swap-vertical-outline'],
  Plan: ['calendar', 'calendar-outline'],
  Wealth: ['briefcase', 'briefcase-outline'],
};

const MainTabNavigator = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const showTabLabels = useAuthStore((state) => state.showTabLabels);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            const pair = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
            const iconName = focused ? pair[0] : pair[1];
            return (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={iconName} size={20} color={color} />
              </View>
            );
          },
          tabBarShowLabel: showTabLabels,
          tabBarActiveTintColor: Theme.colors.primary,
          tabBarInactiveTintColor: Theme.colors.textLight,
          tabBarItemStyle: {
            paddingHorizontal: 0,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarStyle: {
            backgroundColor: Theme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: Theme.colors.border,
            height: showTabLabels
              ? 64 + Math.max(0, insets.bottom - 6)
              : 58 + Math.max(0, insets.bottom - 6),
            paddingBottom: showTabLabels
              ? 8 + Math.max(0, insets.bottom - 6)
              : Math.max(0, insets.bottom - 6),
            paddingTop: 6,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: Theme.typography.fontFamily.semibold,
            marginTop: 2,
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Activity" component={ActivityStack} />
        <Tab.Screen
          name="Add"
          component={DummyScreen}
          options={{
            tabBarLabel: () => null,
            tabBarButton: (props) => <CustomTabBarButton onPress={props.onPress} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowQuickAdd(true);
            },
          }}
        />
        <Tab.Screen name="Plan" component={PlanStack} />
        <Tab.Screen name="Wealth" component={WealthStack} />
      </Tab.Navigator>

      <QuickActionSheet
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        navigation={navigation}
      />
    </>
  );
};

const styles = StyleSheet.create({
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#18181B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});

export default MainTabNavigator;
