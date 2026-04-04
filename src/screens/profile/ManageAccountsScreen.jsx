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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Accounts</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </View>
    );
  }

  const netWorth = totalAssets - totalDebts;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Accounts</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddAccount')}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={24} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }
      >
        {/* Modern Net Worth Summary Card */}
        {accounts.length > 0 && (
          <LinearGradient
            colors={['#6366F1', '#4338CA']}
            style={styles.summaryCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>ESTIMATED NET WORTH</Text>
              <View style={styles.trendingBadge}>
                <Ionicons name="trending-up" size={12} color="#FFFFFF" />
                <Text style={styles.trendingText}>+2.4%</Text>
              </View>
            </View>
            <Text style={styles.netWorthAmount}>
              ₹{netWorth.toLocaleString('en-IN')}
            </Text>
            
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.gridLabel}>ASSETS</Text>
                <Text style={styles.gridVal}>₹{totalAssets.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.gridDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.gridLabel}>LIABILITIES</Text>
                <Text style={styles.gridVal}>₹{totalDebts.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Accounts List */}
        {accounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="wallet-outline" size={48} color="#6366F1" />
            </View>
            <Text style={styles.emptyTitle}>Secure Your Accounts</Text>
            <Text style={styles.emptyText}>Add your bank accounts, credit cards & cash to get the full picture of your wealth.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('AddAccount')}
            >
              <Text style={styles.emptyBtnText}>Link My First Account</Text>
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
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: typeInfo.color + '15' }]}>
                    <Text style={styles.accountEmoji}>{typeInfo.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.accountName} numberOfLines={1}>{account.name}</Text>
                    <Text style={styles.accountType}>
                      {typeInfo.label}
                      {account.bankName ? ` • ${account.bankName}` : ''}
                    </Text>
                  </View>
                  <View style={styles.balContainer}>
                    <Text style={styles.accountBalance}>
                      ₹{(account.type === 'CREDIT_CARD' ? (account.currentUsage || 0) : (account.balance || 0)).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {account.type === 'CREDIT_CARD' && (
                  <View style={styles.usageContainer}>
                    <View style={styles.usageLabels}>
                      <Text style={styles.usagePercent}>
                        {Math.round(((account.currentUsage || 0) / (account.creditLimit || 1)) * 100)}% Utilized
                      </Text>
                      <Text style={styles.creditLimit}>
                        of ₹{(account.creditLimit || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
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
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {accounts.length > 0 && (
          <TouchableOpacity
            style={styles.addMoreBtn}
            onPress={() => navigation.navigate('AddAccount')}
          >
            <LinearGradient
              colors={['#EEF2FF', '#E0E7FF']}
              style={styles.addMoreGradient}
            >
              <Ionicons name="add" size={20} color="#6366F1" />
              <Text style={styles.addMoreText}>Add Another Account</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>Long press on an account to delete it</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Summary Card
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    marginTop: 20,
    marginBottom: 28,
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  netWorthAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  summaryGrid: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  gridDivider: { width: 1, height: '60%', backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginHorizontal: 20 },
  gridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  gridVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Account Card
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountEmoji: { fontSize: 24 },
  accountName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  accountType: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  balContainer: { alignItems: 'flex-end' },
  accountBalance: { fontSize: 17, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  
  usageContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  usageLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usagePercent: { fontSize: 11, fontWeight: '800', color: '#111827' },
  creditLimit: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  usageBarBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  usageBarFill: { height: '100%', borderRadius: 3 },

  // Buttons
  addMoreBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  addMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  addMoreText: { fontSize: 15, color: '#6366F1', fontWeight: '800', marginLeft: 8 },

  hint: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 16 },

  // Empty State
  emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20, fontWeight: '500' },
  emptyBtn: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 28,
    elevation: 4,
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

export default ManageAccountsScreen;