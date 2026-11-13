import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Analytics } from '../../config/firebase';
import { FAMILY_CATEGORIES } from '../../constants/familyCategories';
import {
    deleteFamilyBudget,
    getFamilyBudget,
    setFamilyBudget,
} from '../../services/familyBudgetService';
import { getMonthlyFamilyExpenses } from '../../services/familyExpenseService';
import useFamilyStore from '../../store/useFamilyStore';

const FamilyBudgetScreen = ({ navigation }) => {
  const { family, budget, setBudget, setBudgetLoading, canManageMembers } = useFamilyStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  // Budget inputs
  const [overallBudget, setOverallBudget] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState({});

  // Spending data
  const [totalSpent, setTotalSpent] = useState(0);
  const [categorySpending, setCategorySpending] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch budget
      const budgetResult = await getFamilyBudget(family.id, month, year);
      if (budgetResult.success && budgetResult.budget) {
        setBudget(budgetResult.budget);
        setOverallBudget(budgetResult.budget.overall.toString());
        setCategoryBudgets(budgetResult.budget.categories || {});
      } else {
        setBudget(null);
        setOverallBudget('');
        setCategoryBudgets({});
      }

      // Fetch expenses for comparison
      const expensesResult = await getMonthlyFamilyExpenses(family.id, month, year);
      if (expensesResult.success) {
        const total = expensesResult.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        setTotalSpent(total);

        // Calculate category spending
        const catSpending = {};
        expensesResult.expenses.forEach((exp) => {
          const catId = exp.category || 'miscellaneous';
          catSpending[catId] = (catSpending[catId] || 0) + (exp.amount || 0);
        });
        setCategorySpending(catSpending);
      }
    } catch (error) {
      console.log('Fetch budget data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('FamilyBudget');
      if (family?.id) {
        fetchData();
      }
    }, [family?.id])
  );

  const handleSave = async () => {
    const parsedOverall = parseFloat(overallBudget) || 0;

    if (parsedOverall <= 0 && Object.keys(categoryBudgets).length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Budget Set',
        text2: 'Please set at least an overall budget or category budgets',
      });
      return;
    }

    setSaving(true);
    try {
      const budgetData = {
        overall: parsedOverall,
        categories: categoryBudgets,
      };

      const result = await setFamilyBudget(family.id, month, year, budgetData);

      if (result.success) {
        Analytics.logAnalyticsEvent('set_family_budget', {
          overall: parsedOverall,
          categories_count: Object.keys(categoryBudgets).length,
        });

        Toast.show({
          type: 'success',
          text1: 'Budget Saved',
          text2: 'Family budget has been updated',
        });

        fetchData(); // Refresh to get updated data
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to save budget',
          text2: result.error,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete the family budget for this month?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            const result = await deleteFamilyBudget(family.id, month, year);
            setSaving(false);

            if (result.success) {
              Toast.show({
                type: 'success',
                text1: 'Budget Deleted',
              });
              setOverallBudget('');
              setCategoryBudgets({});
              setBudget(null);
            } else {
              Toast.show({
                type: 'error',
                text1: 'Failed to delete',
                text2: result.error,
              });
            }
          },
        },
      ]
    );
  };

  const updateCategoryBudget = (categoryId, value) => {
    const parsed = parseFloat(value) || 0;
    if (parsed > 0) {
      setCategoryBudgets((prev) => ({ ...prev, [categoryId]: parsed }));
    } else {
      const updated = { ...categoryBudgets };
      delete updated[categoryId];
      setCategoryBudgets(updated);
    }
  };

  const calculateProgress = (spent, limit) => {
    if (!limit || limit <= 0) return 0;
    return Math.min((spent / limit) * 100, 100);
  };

  const getProgressColor = (percent) => {
    if (percent >= 100) return '#EF4444';
    if (percent >= 80) return '#F59E0B';
    return '#10B981';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Family Budget</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Family Budget</Text>
          {budget && canManageMembers() && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
          {!budget && <View style={{ width: 44 }} />}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Month Info */}
          <View style={styles.monthCard}>
            <Ionicons name="calendar" size={24} color="#6C63FF" />
            <Text style={styles.monthText}>
              {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          {/* Overall Budget */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall Budget</Text>

            <View style={styles.budgetInputCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Monthly Limit</Text>
                <View style={styles.amountInput}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="numeric"
                    value={overallBudget}
                    onChangeText={setOverallBudget}
                    editable={canManageMembers()}
                  />
                </View>
              </View>

              {overallBudget && parseFloat(overallBudget) > 0 && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Spent</Text>
                      <Text style={styles.progressValue}>
                        ₹{totalSpent.toLocaleString('en-IN')} / ₹
                        {parseFloat(overallBudget).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${calculateProgress(totalSpent, parseFloat(overallBudget))}%`,
                            backgroundColor: getProgressColor(
                              calculateProgress(totalSpent, parseFloat(overallBudget))
                            ),
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.progressPercent,
                        {
                          color: getProgressColor(
                            calculateProgress(totalSpent, parseFloat(overallBudget))
                          ),
                        },
                      ]}
                    >
                      {Math.round(calculateProgress(totalSpent, parseFloat(overallBudget)))}% used
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Category Budgets */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Category Budgets</Text>
              <Text style={styles.sectionSubtitle}>(Optional)</Text>
            </View>

            {FAMILY_CATEGORIES.map((cat) => {
              const catBudget = categoryBudgets[cat.id] || 0;
              const catSpent = categorySpending[cat.id] || 0;
              const hasValue = catBudget > 0 || catSpent > 0;

              if (!hasValue && !canManageMembers()) return null; // Hide empty categories for viewers

              return (
                <View key={cat.id} style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                        <Ionicons name={cat.icon} size={18} color={cat.color} />
                      </View>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                    </View>
                    <View style={styles.categoryInputContainer}>
                      <Text style={styles.currencySymbolSmall}>₹</Text>
                      <TextInput
                        style={styles.categoryInput}
                        placeholder="0"
                        placeholderTextColor="#CBD5E1"
                        keyboardType="numeric"
                        value={categoryBudgets[cat.id]?.toString() || ''}
                        onChangeText={(value) => updateCategoryBudget(cat.id, value)}
                        editable={canManageMembers()}
                      />
                    </View>
                  </View>

                  {catBudget > 0 && (
                    <View style={styles.categoryProgress}>
                      <View style={styles.categoryProgressBar}>
                        <View
                          style={[
                            styles.categoryProgressFill,
                            {
                              width: `${calculateProgress(catSpent, catBudget)}%`,
                              backgroundColor: getProgressColor(calculateProgress(catSpent, catBudget)),
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryProgressText,
                          { color: getProgressColor(calculateProgress(catSpent, catBudget)) },
                        ]}
                      >
                        ₹{catSpent.toLocaleString('en-IN')} / ₹{catBudget.toLocaleString('en-IN')} (
                        {Math.round(calculateProgress(catSpent, catBudget))}%)
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color="#6C63FF" />
            <Text style={styles.infoText}>
              Set budgets to track spending. You'll get alerts when reaching 80% and 100% of your limits.
            </Text>
          </View>
        </ScrollView>

        {/* Save Button */}
        {canManageMembers() && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Budget</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8F9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C63FF',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  budgetInputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6C63FF',
    marginRight: 8,
  },
  input: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  progressSection: {
    marginTop: 0,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 6,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  categoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 100,
  },
  currencySymbolSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C63FF',
    marginRight: 4,
  },
  categoryInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'right',
  },
  categoryProgress: {
    marginTop: 10,
  },
  categoryProgressBar: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  categoryProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  categoryProgressText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0EFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6C63FF',
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default FamilyBudgetScreen;