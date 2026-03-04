import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteAccount, getAccounts } from '../../services/accountService';
import useAccountStore from '../../store/useAccountStore';

const ManageAccountsScreen = ({ navigation }) => {
  const { accounts, setAccounts } = useAccountStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAccounts = async () => {
    const result = await getAccounts();
    if (result.success) {
      setAccounts(result.accounts);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Refresh when coming back from AddAccount
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAccounts();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAccounts();
  }, []);

  const handleDelete = (account) => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${account.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount(account.id);
            if (result.success) {
              useAccountStore.getState().removeAccountFromStore(account.id);
            } else {
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const getTypeInfo = (type) => {
    switch (type) {
      case 'BANK': return { emoji: '🏦', label: 'Bank Account', color: '#3B82F6' };
      case 'CREDIT_CARD': return { emoji: '💳', label: 'Credit Card', color: '#F59E0B' };
      case 'CASH': return { emoji: '💵', label: 'Cash', color: '#10B981' };
      default: return { emoji: '💰', label: 'Account', color: '#6B7280' };
    }
  };

  const totalAssets = accounts
    .filter(a => a.type === 'BANK' || a.type === 'CASH')
    .reduce((sum, a) => sum + (a.balance || 0), 0);

  const totalDebts = accounts
    .filter(a => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + (a.currentUsage || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Accounts</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Accounts</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddAccount')}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C63FF']} />
        }
      >
        {/* Summary Card */}
        {accounts.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Assets</Text>
                <Text style={[styles.summaryAmount, { color: '#10B981' }]}>
                  ₹{totalAssets.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Debts</Text>
                <Text style={[styles.summaryAmount, { color: '#EF4444' }]}>
                  ₹{totalDebts.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
            <View style={styles.netWorthRow}>
              <Text style={styles.netWorthLabel}>Net Worth</Text>
              <Text style={[
                styles.netWorthAmount,
                { color: (totalAssets - totalDebts) >= 0 ? '#10B981' : '#EF4444' }
              ]}>
                ₹{(totalAssets - totalDebts).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        )}

        {/* Accounts List */}
        {accounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏦</Text>
            <Text style={styles.emptyTitle}>No accounts added</Text>
            <Text style={styles.emptyText}>Add your bank accounts, credit cards & cash</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('AddAccount')}
            >
              <Text style={styles.emptyBtnText}>+ Add Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          accounts.map((account) => {
            const typeInfo = getTypeInfo(account.type);
            return (
              <TouchableOpacity
                key={account.id}
                style={styles.accountCard}
                onPress={() => navigation.navigate('AddAccount', { account, editMode: true })}
                onLongPress={() => handleDelete(account)}
              >
                <View style={styles.accountLeft}>
                  <Text style={styles.accountEmoji}>{typeInfo.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountType}>
                      {typeInfo.label}
                      {account.bankName ? ` • ${account.bankName}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.accountRight}>
                  {account.type === 'CREDIT_CARD' ? (
                    <>
                      <Text style={styles.accountBalance}>
                        ₹{(account.currentUsage || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.accountSubtext}>
                        of ₹{(account.creditLimit || 0).toLocaleString('en-IN')}
                      </Text>
                      {/* Usage Bar */}
                      <View style={styles.usageBarBg}>
                        <View
                          style={[
                            styles.usageBarFill,
                            {
                              width: `${Math.min(((account.currentUsage || 0) / (account.creditLimit || 1)) * 100, 100)}%`,
                              backgroundColor:
                                ((account.currentUsage || 0) / (account.creditLimit || 1)) > 0.8
                                  ? '#EF4444'
                                  : ((account.currentUsage || 0) / (account.creditLimit || 1)) > 0.5
                                  ? '#F59E0B'
                                  : '#10B981',
                            },
                          ]}
                        />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.accountBalance}>
                      ₹{(account.balance || 0).toLocaleString('en-IN')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {accounts.length > 0 && (
          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() => navigation.navigate('AddAccount')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#6C63FF" />
            <Text style={styles.addMoreText}>Add Another Account</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>Long press on an account to delete it</Text>
      </ScrollView>
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
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Summary
  summaryCard: {
    backgroundColor: '#6C63FF', borderRadius: 16, padding: 20, marginBottom: 20,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  summaryAmount: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  netWorthRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
  },
  netWorthLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  netWorthAmount: { fontSize: 22, fontWeight: '700' },

  // Account Card
  accountCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  accountLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  accountEmoji: { fontSize: 28, marginRight: 12 },
  accountName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  accountType: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  accountRight: { alignItems: 'flex-end' },
  accountBalance: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  accountSubtext: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  usageBarBg: {
    width: 120, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 6,
  },
  usageBarFill: { height: 4, borderRadius: 2 },

  // Add More
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, marginTop: 8,
  },
  addMoreText: { fontSize: 15, color: '#6C63FF', fontWeight: '600', marginLeft: 8 },

  hint: { textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 8 },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  emptyBtn: {
    backgroundColor: '#6C63FF', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 10, marginTop: 20,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

export default ManageAccountsScreen;