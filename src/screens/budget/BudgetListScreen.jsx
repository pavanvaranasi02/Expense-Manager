import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from '../../components/ui/AppButton';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { deleteBudget, getBudgets, saveBudget, updateBudget } from '../../services/budgetService';
import { DEFAULT_CATEGORIES } from '../../services/categoryService';
import { Theme } from '../../theme/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getCategoryIconName = (categoryId) => {
  if (categoryId === 'overall') return 'wallet-outline';
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
  const raw = cat?.icon || '';
  if (raw.length > 2 && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(raw)) return raw;
  return 'pricetag-outline';
};

const BudgetListScreen = ({ navigation }) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await getBudgets(month, year);
      if (mounted) {
        if (result.success) {
          setBudgets(result.budgets);
        }
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [month, year]);

  const changeMonth = (direction) => {
    setLoading(true);
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleAddBudget = () => {
    setEditingBudget(null);
    setSelectedCategory(null);
    setBudgetAmount('');
    setShowModal(true);
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setSelectedCategory({
      id: budget.categoryId,
      name: budget.categoryName,
    });
    setBudgetAmount(budget.amount?.toString() || '');
    setShowModal(true);
  };

  const handleSaveBudget = async () => {
    if (!selectedCategory) {
      Alert.alert('Required', 'Please select a category');
      return;
    }
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }

    setSaving(true);

    if (editingBudget) {
      const result = await updateBudget(editingBudget.id, { amount: budgetAmount });
      if (result.success) {
        setBudgets((prev) =>
          prev.map((b) =>
            b.id === editingBudget.id
              ? { ...b, amount: parseFloat(budgetAmount) }
              : b
          )
        );
        setShowModal(false);
      } else {
        Alert.alert('Error', result.error);
      }
    } else {
      const exists = budgets.find((b) => b.categoryId === selectedCategory.id);
      if (exists) {
        Alert.alert('Exists', 'Budget for this category already exists. Edit it instead.');
        setSaving(false);
        return;
      }

      const result = await saveBudget({
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        amount: budgetAmount,
        month,
        year,
      });

      if (result.success) {
        setBudgets((prev) => [...prev, result.budget]);
        setShowModal(false);
      } else {
        Alert.alert('Error', result.error);
      }
    }

    setSaving(false);
  };

  const handleDeleteBudget = (budget) => {
    Alert.alert(
      'Delete Budget',
      `Remove ₹${budget.amount?.toLocaleString('en-IN')} budget for ${budget.categoryName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteBudget(budget.id);
            if (result.success) {
              setBudgets((prev) => prev.filter((b) => b.id !== budget.id));
            }
          },
        },
      ]
    );
  };

  const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);

  const allCategories = [
    { id: 'overall', name: 'Overall Monthly' },
    ...DEFAULT_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Budgets"
        subtitle="Monthly spending limits"
        showBack
        navigation={navigation}
        rightActions={
          <TouchableOpacity onPress={handleAddBudget} style={styles.addHeaderBtn}>
            <Ionicons name="add" size={20} color={Theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={Theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{MONTHS[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={Theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Loading budgets..." />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {budgets.length === 0 ? (
            <EmptyState
              icon="pie-chart-outline"
              title={`No budgets for ${MONTHS[month - 1]}`}
              description="Set monthly spending limits per category to stay on track."
              actionLabel="Set Budget"
              onAction={handleAddBudget}
            />
          ) : (
            <>
              <View style={styles.heroSummary}>
                <Text style={styles.totalLabel}>TOTAL MONTHLY BUDGET</Text>
                <Text style={styles.totalAmount}>₹{totalBudget.toLocaleString('en-IN')}</Text>
                <Text style={styles.totalSub}>{budgets.length} categories configured</Text>
              </View>

              <SurfaceCard padding={0}>
                {budgets.map((budget, index) => (
                  <TouchableOpacity
                    key={budget.id}
                    style={[styles.budgetRow, index > 0 && styles.rowBorder]}
                    onPress={() => handleEditBudget(budget)}
                    onLongPress={() => handleDeleteBudget(budget)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.budgetLeft}>
                      <View style={styles.budgetIconBox}>
                        <Ionicons
                          name={getCategoryIconName(budget.categoryId)}
                          size={18}
                          color={Theme.colors.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.budgetName}>{budget.categoryName}</Text>
                        <Text style={styles.budgetType}>
                          {budget.type === 'OVERALL' ? 'Overall' : 'Category'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.budgetRight}>
                      <Text style={styles.budgetAmount}>
                        ₹{(budget.amount || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.budgetPer}>/month</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </SurfaceCard>

              <Text style={styles.hint}>Tap to edit · Long press to delete</Text>
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBudget ? 'Edit Budget' : 'New Budget'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!editingBudget && (
              <>
                <Text style={styles.modalLabel}>CATEGORY</Text>
                <ScrollView style={styles.categoryList} nestedScrollEnabled>
                  {allCategories.map((cat) => {
                    const exists = budgets.find((b) => b.categoryId === cat.id);
                    const isSelected = selectedCategory?.id === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          isSelected && styles.categoryOptionActive,
                          exists && styles.categoryOptionDisabled,
                        ]}
                        onPress={() => !exists && setSelectedCategory(cat)}
                        disabled={!!exists}
                      >
                        <Ionicons
                          name={getCategoryIconName(cat.id)}
                          size={18}
                          color={isSelected ? Theme.colors.primary : Theme.colors.textSecondary}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          style={[
                            styles.categoryOptionName,
                            exists && { color: Theme.colors.textLight },
                          ]}
                        >
                          {cat.name}
                        </Text>
                        {exists && (
                          <Text style={styles.categoryExistsText}>
                            ₹{exists.amount?.toLocaleString('en-IN')}
                          </Text>
                        )}
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={Theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <Text style={styles.modalLabel}>MONTHLY LIMIT</Text>
            <View style={styles.modalAmountRow}>
              <Text style={styles.modalRupee}>₹</Text>
              <TextInput
                style={styles.modalAmountInput}
                placeholder="5000"
                placeholderTextColor={Theme.colors.textLight}
                value={budgetAmount}
                onChangeText={(v) => setBudgetAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                autoFocus={!!editingBudget}
              />
            </View>

            <AppButton
              title={editingBudget ? 'Update Budget' : 'Save Budget'}
              onPress={handleSaveBudget}
              loading={saving}
              style={{ marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  addHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Theme.layout.screenPaddingHorizontal,
    marginBottom: 16,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  monthArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: Theme.typography.size.sm,
    color: Theme.colors.text,
  },
  content: {
    paddingHorizontal: Theme.layout.screenPaddingHorizontal,
    paddingBottom: 40,
  },
  heroSummary: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  totalLabel: {
    ...Theme.typography.presets.sectionEyebrow,
    color: Theme.colors.textMuted,
  },
  totalAmount: {
    ...Theme.typography.presets.displayNumber,
    color: Theme.colors.text,
    marginTop: 4,
  },
  totalSub: {
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  budgetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    ...Theme.typography.presets.rowTitle,
    color: Theme.colors.text,
  },
  budgetType: {
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  budgetRight: { alignItems: 'flex-end' },
  budgetAmount: {
    ...Theme.typography.presets.monoValue,
    color: Theme.colors.text,
  },
  budgetPer: {
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textMuted,
  },
  hint: {
    textAlign: 'center',
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textLight,
    marginTop: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    ...Theme.typography.presets.title,
    color: Theme.colors.text,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    ...Theme.typography.presets.formLabel,
    color: Theme.colors.textMuted,
    marginBottom: 8,
    marginTop: 12,
  },
  categoryList: { maxHeight: 210 },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Theme.radius.lg,
    marginBottom: 4,
    backgroundColor: Theme.colors.surfaceSubtle,
  },
  categoryOptionActive: {
    backgroundColor: Theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  categoryOptionDisabled: { opacity: 0.45 },
  categoryOptionName: {
    flex: 1,
    ...Theme.typography.presets.bodyMedium,
    color: Theme.colors.text,
  },
  categoryExistsText: {
    ...Theme.typography.presets.rowSubtitle,
    color: Theme.colors.textMuted,
    marginRight: 8,
  },
  modalAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalRupee: {
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 22,
    color: Theme.colors.textMuted,
  },
  modalAmountInput: {
    flex: 1,
    height: 52,
    fontFamily: Theme.typography.fontFamily.bold,
    fontSize: 22,
    color: Theme.colors.text,
    paddingLeft: 8,
  },
});

export default BudgetListScreen;
