import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CreateFamilyScreen from "../components/Family/CreateFamilyScreen";
import FamilyInviteScreen from "../components/Family/FamilyInviteScreen";
import FamilyLandingScreen from "../components/Family/FamilyLandingScreen";
import FamilyMembersScreen from "../components/Family/FamilyMembersScreen";
import FamilySettingsScreen from "../components/Family/FamilySettingsScreen";
import JoinFamilyScreen from "../components/Family/JoinFamilyScreen";
import FamilyDashboardScreen from "../screens/family/FamilyDashboardScreen";

import AddFamilyExpenseScreen from "../screens/family/AddFamilyExpenseScreen";
import AddTemplateScreen from "../screens/family/AddTemplateScreen";
import ExportExpensesScreen from "../screens/family/ExportExpensesScreen";
import FamilyAnalyticsScreen from "../screens/family/FamilyAnalyticsScreen";
import FamilyBudgetScreen from "../screens/family/FamilyBudgetScreen";
import FamilyComparisonScreen from "../screens/family/FamilyComparisonScreen";
import FamilyExpensesScreen from "../screens/family/FamilyExpensesScreen";
import FamilyTemplatesScreen from "../screens/family/FamilyTemplatesScreen";
import EditTemplateScreen from "../screens/family/EditTemplateScreen";

const Stack = createNativeStackNavigator();

const FamilyNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FamilyLanding" component={FamilyLandingScreen} />
      <Stack.Screen name="CreateFamily" component={CreateFamilyScreen} />
      <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
      <Stack.Screen name="FamilyDashboard" component={FamilyDashboardScreen} />
      <Stack.Screen name="FamilyMembers" component={FamilyMembersScreen} />
      <Stack.Screen name="FamilyInvite" component={FamilyInviteScreen} />
      <Stack.Screen name="FamilySettings" component={FamilySettingsScreen} />

      <Stack.Screen
        name="AddFamilyExpense"
        component={AddFamilyExpenseScreen}
      />
      <Stack.Screen name="FamilyExpenses" component={FamilyExpensesScreen} />
      <Stack.Screen name="FamilyBudget" component={FamilyBudgetScreen} />
      <Stack.Screen name="FamilyAnalytics" component={FamilyAnalyticsScreen} />
      <Stack.Screen
        name="FamilyComparison"
        component={FamilyComparisonScreen}
      />
      <Stack.Screen name="ExportExpenses" component={ExportExpensesScreen} />
      <Stack.Screen name="FamilyTemplates" component={FamilyTemplatesScreen} />
      <Stack.Screen name="AddTemplate" component={AddTemplateScreen} />
      <Stack.Screen name="EditTemplate" component={EditTemplateScreen} />
    </Stack.Navigator>
  );
};

export default FamilyNavigator;
