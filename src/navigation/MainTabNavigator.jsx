import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/useAuthStore';
import useStorageStore from '../store/useStorageStore';
import { Theme } from '../theme/theme';

// ===== Existing Screens =====
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import ExpenseListScreen from '../screens/expenses/ExpenseListScreen';
import DashboardScreen from '../screens/home/DashboardScreen';
import IncomeListScreen from '../screens/income/IncomeListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Profile Stack Screens
import BudgetListScreen from '../screens/budget/BudgetListScreen';
import BudgetStatusScreen from '../screens/budget/BudgetStatusScreen';
import SetBudgetScreen from '../screens/budget/SetBudgetScreen';
import PortfolioScreen from '../screens/investments/PortfolioScreen';
import AddAccountScreen from '../screens/profile/AddAccountScreen';
import CreditCardBillScreen from '../screens/profile/CreditCardBillScreen';
import ManageAccountsScreen from '../screens/profile/ManageAccountsScreen';
import ManageCategoriesScreen from '../screens/profile/ManageCategoriesScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';

// Analytics (now accessible from Dashboard)
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';

// ===== NEW: Family Screens =====
import FamilyNavigator from './FamilyNavigator';

// ===== NEW: Notifications =====
import NotificationsScreen from '../components/Notifications/NotificationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ===== Stack Navigators =====

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    {/* Analytics now accessible from Dashboard */}
    <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
    <Stack.Screen name="BudgetStatus" component={BudgetStatusScreen} />
    {/* Notifications accessible from Dashboard header */}
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

const TransactionsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExpenseList" component={ExpenseListScreen} />
    <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
    <Stack.Screen name="IncomeList" component={IncomeListScreen} />
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
const CustomTabBarButton = ({ onPress, style }) => (
  <TouchableOpacity
    style={[style, styles.fabContainer]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityLabel="Add transaction"
  >
    <View style={styles.fab}>
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </View>
  </TouchableOpacity>
);

// Dummy screen for the center tab
const DummyScreen = () => null;

// ===== Main Tab Navigator =====
const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const showTabLabels = useAuthStore((state) => state.showTabLabels);
  const storageMode = useStorageStore((state) => state.storageMode);
  const isLocalMode = storageMode === 'local';

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
            case 'Family':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }
          
          return (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: 50,
                opacity: route.name === 'Family' && isLocalMode ? 0.35 : 1,
              }}
            >
              <Ionicons 
                name={iconName} 
                size={focused ? size + 2 : size} 
                color={color} 
              />
            </View>
          );
        },
        tabBarShowLabel: showTabLabels,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.textLight,
        tabBarStyle: {
          backgroundColor: Theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: Theme.colors.border,
          height: showTabLabels 
            ? 70 + Math.max(0, insets.bottom - 8)
            : 65 + Math.max(0, insets.bottom - 8),
          paddingBottom: showTabLabels 
            ? 10 + Math.max(0, insets.bottom - 8)
            : Math.max(0, insets.bottom - 8),
          paddingTop: 10,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.05,
          shadowRadius: 15,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.1,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Transactions" component={TransactionsStack} />
      <Tab.Screen
        name="Add"
        component={DummyScreen}
        options={{
          tabBarLabel: () => null,
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('AddExpenseModal');
          },
        })}
      />
      {/* NEW: Family Tab (disabled in Local Storage mode) */}
      <Tab.Screen
        name="Family"
        component={FamilyNavigator}
        listeners={{
          tabPress: (e) => {
            if (isLocalMode) {
              e.preventDefault();
              Alert.alert(
                'Family Disabled in Local Mode',
                'Family sharing requires Cloud Storage. Switch to Cloud Storage in Settings to use Family features.'
              );
            }
          },
        }}
      />
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});

export default MainTabNavigator;