import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import ExpenseListScreen from '../screens/expenses/ExpenseListScreen';
import DashboardScreen from '../screens/home/DashboardScreen';
import PortfolioScreen from '../screens/investments/PortfolioScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Stack navigators for tabs that need inner navigation
import BudgetListScreen from '../screens/budget/BudgetListScreen';
import BudgetStatusScreen from '../screens/budget/BudgetStatusScreen';
import SetBudgetScreen from '../screens/budget/SetBudgetScreen';
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import IncomeListScreen from '../screens/income/IncomeListScreen';
import AddAccountScreen from '../screens/profile/AddAccountScreen';
import CreditCardBillScreen from '../screens/profile/CreditCardBillScreen';
import ManageAccountsScreen from '../screens/profile/ManageAccountsScreen';
import ManageCategoriesScreen from '../screens/profile/ManageCategoriesScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ===== Stack Navigators =====

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
  </Stack.Navigator>
);

const TransactionsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
    <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
    <Stack.Screen name="IncomeList" component={IncomeListScreen} />
  </Stack.Navigator>
);

const AnalyticsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
    <Stack.Screen name="BudgetStatus" component={BudgetStatusScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="ManageAccounts" component={ManageAccountsScreen} />
    <Stack.Screen name="AddAccount" component={AddAccountScreen} />
    <Stack.Screen name="Portfolio" component={PortfolioScreen} />
    <Stack.Screen name="CreditCardBill" component={CreditCardBillScreen} />
    <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
    <Stack.Screen name="BudgetList" component={BudgetListScreen} />
    <Stack.Screen name="SetBudget" component={SetBudgetScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </Stack.Navigator>
);

// ===== Custom FAB Button =====
const CustomTabBarButton = ({ children, onPress }) => (
  <TouchableOpacity
    style={styles.fabContainer}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.fab}>{children}</View>
  </TouchableOpacity>
);

// Dummy screen for the center tab
const DummyScreen = () => null;

// ===== Main Tab Navigator =====
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Transactions':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Add':
              iconName = 'add';
              break;
            case 'Analytics':
              iconName = focused ? 'pie-chart' : 'pie-chart-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Transactions" component={TransactionsStack} />
      <Tab.Screen
        name="Add"
        component={DummyScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <Ionicons name="add" size={28} color="#FFFFFF" />
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('AddExpenseModal');
          },
        })}
      />
      <Tab.Screen name="Analytics" component={AnalyticsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});

export default MainTabNavigator;