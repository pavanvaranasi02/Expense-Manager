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
import AppButton from '../../components/ui/AppButton';
import BalanceHero from '../../components/ui/BalanceHero';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { deleteAccount, getAccounts } from '../../services/accountService';
import useAccountStore from '../../store/useAccountStore';
import { Theme } from '../../theme/theme';

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
      case 'BANK': return { icon: 'business-outline', label: 'Bank Account', color: '#2563EB' };
      case 'CREDIT_CARD': return { icon: 'card-outline', label: 'Credit Card', color: '#D97706' };
      case 'CASH': return { icon: 'cash-outline', label: 'Cash', color: '#047857' };
      default: return { icon: 'wallet-outline', label: 'Account', color: '#0F766E' };
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
              <Ionicons name="chevron-back" size={24} color="#18181B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Accounts</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#134E4A" />
        </View>
      </View>
    );
  }

  const netWorth = totalAssets - totalDebts;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScreenHeader
        title="My Accounts"
        subtitle="Banks, cards & cash"
        showBack
        navigation={navigation}
        rightActions={
          <TouchableOpacity
            onPress={() => navigation.navigate('AddAccount')}
            style={styles.addBtn}
            accessibilityLabel="Add account"
          >
            <Ionicons name="add" size={22} color={Theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#134E4A']} />
        }
      >
        {/* Net Worth Editorial Summary */}
        {accounts.length > 0 && (
          <View style={styles.heroWrap}>
            <BalanceHero
              eyebrow="NET WORTH"
              amountText={`₹${netWorth.toLocaleString('en-IN')}`}
              leftLabel="ASSETS"
              leftValue={`₹${totalAssets.toLocaleString('en-IN')}`}
              rightLabel="LIABILITIES"
              rightValue={`₹${totalDebts.toLocaleString('en-IN')}`}
              rightHighlightError={totalDebts > 0}
            />
          </View>
        )}

        {/* Accounts List */}
        {accounts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="wallet-outline" size={48} color="#134E4A" />
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
                    <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
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
                                ? '#B91C1C'
                                : ((account.currentUsage || 0) / (account.creditLimit || 1)) > 0.5
                                ? '#F59E0B'
                                : '#047857',
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
          <AppButton
            title="Add Another Account"
            icon="add-outline"
            variant="secondary"
            onPress={() => navigation.navigate('AddAccount')}
            style={{ marginTop: 8 }}
          />
        )}

        <Text style={styles.hint}>Long press on an account to delete it</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F6F2' },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EFEA',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F7F6F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#F1EFEA',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Manrope_700Bold', color: "#18181B", letterSpacing: -0.5 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroWrap: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Account Card
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
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
  accountName: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: '#18181B' },
  accountType: { fontSize: 12, color: '#71717A', fontFamily: 'Manrope_500Medium', marginTop: 2 },
  balContainer: { alignItems: 'flex-end' },
  accountBalance: { fontSize: 17, fontFamily: 'Manrope_700Bold', color: '#18181B', letterSpacing: -0.5 },
  
  usageContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F7F6F2' },
  usageLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usagePercent: { fontSize: 11, fontFamily: 'Manrope_700Bold', color: '#18181B' },
  creditLimit: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: '#71717A' },
  usageBarBg: { height: 6, backgroundColor: '#F1EFEA', borderRadius: 3, overflow: 'hidden' },
  usageBarFill: { height: '100%', borderRadius: 3 },

  hint: { textAlign: 'center', fontSize: 11, color: '#71717A', fontFamily: 'Manrope_600SemiBold', marginTop: 16 },

  // Empty State
  emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontFamily: 'Manrope_700Bold', color: '#18181B', letterSpacing: -0.5 },
  emptyText: { fontSize: 14, color: '#71717A', textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: 'Manrope_500Medium' },
  emptyBtn: {
    backgroundColor: '#134E4A',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 28,
    elevation: 4,
    shadowColor: '#134E4A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Manrope_700Bold' },
});

export default ManageAccountsScreen;