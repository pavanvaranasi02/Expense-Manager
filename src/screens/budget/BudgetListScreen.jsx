import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { deleteBudget, getBudgets, saveBudget, updateBudget } from '../../services/budgetService';
import { DEFAULT_CATEGORIES } from '../../services/categoryService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

  const fetchBudgets = async () => {
    setLoading(true);
    const result = await getBudgets(month, year);
    if (result.success) {
      setBudgets(result.budgets);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBudgets();
  }, [month, year]);

  const changeMonth = (direction) => {
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
        setBudgets(prev =>
          prev.map(b => b.id === editingBudget.id
            ? { ...b, amount: parseFloat(budgetAmount) }
            : b
          )
        );
        setShowModal(false);
      } else {
        Alert.alert('Error', result.error);
      }
    } else {
      // Check if budget already exists for this category
      const exists = budgets.find(b => b.categoryId === selectedCategory.id);
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
        setBudgets(prev => [...prev, result.budget]);
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
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const result = await deleteBudget(budget.id);
            if (result.success) {
              setBudgets(prev => prev.filter(b => b.id !== budget.id));
            }
          },
        },
      ]
    );
  };

  const getCategoryIcon = (categoryId) => {
    if (categoryId === 'overall') return '💰';
    const cat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    return cat?.icon || '📦';
  };

  const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);

  const allCategories = [
    { id: 'overall', name: 'Overall Monthly' },
    ...DEFAULT_CATEGORIES.map(c => ({ id: c.id, name: c.name })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Budgets</Text>
        <TouchableOpacity onPress={handleAddBudget} style={styles.addHeaderBtn}>
          <Ionicons name="add" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={20} color="#6C63FF" />
        </TouchableOpacity>
        <Text style={styles.monthText}>{MONTHS[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={20} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 40 }} />
        ) : budgets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💰</Text>
            <Text style={styles.emptyTitle}>No budgets for {MONTHS[month - 1]}</Text>
            <Text style={styles.emptyText}>Set spending limits to stay on track</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={handleAddBudget}>
              <Text style={styles.emptyBtnText}>+ Set Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Total */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Budget</Text>
              <Text style={styles.totalAmount}>₹{totalBudget.toLocaleString('en-IN')}</Text>
              <Text style={styles.totalSub}>{budgets.length} categories</Text>
            </View>

            {/* Budget Items */}
            {budgets.map((budget) => (
              <TouchableOpacity
                key={budget.id}
                style={styles.budgetCard}
                onPress={() => handleEditBudget(budget)}
                onLongPress={() => handleDeleteBudget(budget)}
              >
                <View style={styles.budgetLeft}>
                  <Text style={styles.budgetIcon}>{getCategoryIcon(budget.categoryId)}</Text>
                  <View>
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

            <Text style={styles.hint}>Tap to edit • Long press to delete</Text>
          </>
        )}
      </ScrollView>

      {/* Add/Edit Budget Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Category Selection */}
            {!editingBudget && (
              <>
                <Text style={styles.modalLabel}>Category</Text>
                <ScrollView style={styles.categoryList} nestedScrollEnabled>
                  {allCategories.map((cat) => {
                    const exists = budgets.find(b => b.categoryId === cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          selectedCategory?.id === cat.id && styles.categoryOptionActive,
                          exists && styles.categoryOptionDisabled,
                        ]}
                        onPress={() => !exists && setSelectedCategory(cat)}
                        disabled={!!exists}
                      >
                        <Text style={styles.categoryOptionIcon}>
                          {getCategoryIcon(cat.id)}
                        </Text>
                        <Text style={[
                          styles.categoryOptionName,
                          exists && { color: '#D1D5DB' },
                        ]}>
                          {cat.name}
                        </Text>
                        {exists && (
                          <Text style={styles.categoryExistsText}>
                            ₹{exists.amount?.toLocaleString('en-IN')}
                          </Text>
                        )}
                        {selectedCategory?.id === cat.id && (
                          <Ionicons name="checkmark-circle" size={20} color="#6C63FF" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Amount */}
            <Text style={styles.modalLabel}>Monthly Budget Amount</Text>
            <View style={styles.modalAmountRow}>
              <Text style={styles.modalRupee}>₹</Text>
              <TextInput
                style={styles.modalAmountInput}
                placeholder="5000"
                placeholderTextColor="#D1D5DB"
                value={budgetAmount}
                onChangeText={(v) => setBudgetAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                autoFocus={!!editingBudget}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveBudget}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSaveBtnText}>
                  {editingBudget ? 'Update Budget' : 'Save Budget'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  addHeaderBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  monthArrow: { padding: 8 },
  monthText: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginHorizontal: 16 },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  totalCard: {
    backgroundColor: '#6C63FF', borderRadius: 16, padding: 20, marginTop: 16,
    marginBottom: 16, alignItems: 'center',
  },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  totalAmount: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  budgetCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  budgetIcon: { fontSize: 24, marginRight: 12 },
  budgetName: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  budgetType: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  budgetRight: { alignItems: 'flex-end' },
  budgetAmount: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  budgetPer: { fontSize: 11, color: '#9CA3AF' },

  hint: { textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 12 },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  emptyBtn: {
    backgroundColor: '#6C63FF', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 10, marginTop: 20,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  modalLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginTop: 12 },

  categoryList: { maxHeight: 200 },
  categoryOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10,
    marginBottom: 4, backgroundColor: '#F9FAFB',
  },
  categoryOptionActive: { backgroundColor: '#F0EFFF', borderWidth: 1, borderColor: '#6C63FF' },
  categoryOptionDisabled: { opacity: 0.5 },
  categoryOptionIcon: { fontSize: 18, marginRight: 10 },
  categoryOptionName: { flex: 1, fontSize: 14, color: '#1A1A2E' },
  categoryExistsText: { fontSize: 12, color: '#9CA3AF', marginRight: 8 },

  modalAmountRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  modalRupee: { fontSize: 22, fontWeight: '600', color: '#374151' },
  modalAmountInput: { flex: 1, height: 52, fontSize: 22, fontWeight: '600', color: '#1A1A2E', paddingLeft: 8 },

  modalSaveBtn: {
    backgroundColor: '#6C63FF', height: 50, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  modalSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default BudgetListScreen;