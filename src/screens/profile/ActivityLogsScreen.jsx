import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearUserLogs, getUserLogs } from '../../services/activityLogService';
import useAuthStore from '../../store/useAuthStore';
import useStorageStore from '../../store/useStorageStore';
import { Theme } from '../../theme/theme';

const DATE_FILTERS = [
  { key: 'TODAY', label: 'Today' },
  { key: '7D', label: '7 Days' },
  { key: '30D', label: '30 Days' },
  { key: 'ALL', label: 'All Time' },
];

const STORAGE_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'LOCAL', label: 'Local' },
  { key: 'CLOUD', label: 'Cloud' },
];

const DEFAULT_ACTION_FILTERS = [
  'EXPENSE_ADD',
  'EXPENSE_UPDATE',
  'EXPENSE_DELETE',
  'INCOME_ADD',
  'INCOME_DELETE',
  'INVESTMENT_ADD',
  'INVESTMENT_UPDATE',
  'INVESTMENT_DELETE',
  'ACCOUNT_ADD',
  'ACCOUNT_UPDATE',
  'BUDGET_ADD',
  'PROFILE_UPDATE',
  'STORAGE_MODE_CHANGE',
];

const formatActionLabel = (action) => {
  if (!action || action === 'ALL') return 'All Operations';
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatLogTimestamp = (iso) => {
  if (!iso) return 'NA';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'NA';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatJson = (obj) => {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch (_err) {
    return '{}';
  }
};

const extractIdentifier = (item) => {
  const nextId = item?.nextState?.id;
  const prevId = item?.previousState?.id;
  return nextId || prevId || item?.id || 'NA';
};

const ActivityLogsScreen = ({ navigation }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('TODAY');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedStorage, setSelectedStorage] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);
  const [refTime, setRefTime] = useState(() => Date.now());

  const currentUserId = useAuthStore((state) => state.getUserId());
  const currentUserName = useAuthStore((state) => state.getUserName());
  const currentUserEmail = useAuthStore((state) => state.getUserEmail());
  const storageMode = useStorageStore((state) => state.storageMode);
  const isLocal = storageMode === 'local';

  const loadLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await getUserLogs(200);
    if (res.success) {
      setLogs(res.logs || []);
      setRefTime(Date.now());
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs(false);
    }, [loadLogs])
  );

  const actionFilters = useMemo(() => {
    const present = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));
    const merged = Array.from(new Set([...DEFAULT_ACTION_FILTERS, ...present]));
    return ['ALL', ...merged];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const startOfToday = new Date(refTime);
    startOfToday.setHours(0, 0, 0, 0);
    const q = searchQuery.trim().toLowerCase();

    return logs.filter((item) => {
      if (currentUserId && item.userId && item.userId !== currentUserId) {
        return false;
      }

      if (selectedAction !== 'ALL' && item.action !== selectedAction) {
        return false;
      }

      const itemIsLocal = item.isLocal === true || item.storageMode === 'local';
      if (selectedStorage === 'LOCAL' && !itemIsLocal) return false;
      if (selectedStorage === 'CLOUD' && itemIsLocal) return false;

      const ts = item.createdAtMs || new Date(item.createdAt).getTime() || 0;
      if (selectedDateRange === 'TODAY' && ts < startOfToday.getTime()) return false;
      if (selectedDateRange === '7D' && ts < refTime - 7 * 24 * 60 * 60 * 1000) return false;
      if (selectedDateRange === '30D' && ts < refTime - 30 * 24 * 60 * 60 * 1000) return false;

      if (q) {
        const haystack = [
          item.action,
          item.entity,
          item.summary,
          extractIdentifier(item),
          JSON.stringify(item.previousState || {}),
          JSON.stringify(item.nextState || {}),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    logs,
    currentUserId,
    selectedAction,
    selectedStorage,
    selectedDateRange,
    searchQuery,
    refTime,
  ]);

  const handleExport = async () => {
    if (filteredLogs.length === 0) {
      Alert.alert('Nothing to Export', 'There are no logs matching your current filters.');
      return;
    }
    try {
      const payload = JSON.stringify(filteredLogs, null, 2);
      await Share.share({
        title: 'KOSH User Log Report',
        message: payload,
      });
    } catch (_err) {
      // Ignore dismissed share sheet
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear User Logs',
      'Remove all recorded logs for your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const res = await clearUserLogs();
            if (res.success) {
              setLogs([]);
            } else {
              Alert.alert('Error', res.error || 'Failed to clear logs');
            }
          },
        },
      ]
    );
  };

  const renderLogItem = ({ item }) => {
    const itemIsLocal = item.isLocal === true || item.storageMode === 'local';
    const identifier = extractIdentifier(item);

    return (
      <TouchableOpacity
        style={styles.reportCard}
        activeOpacity={0.75}
        onPress={() => setSelectedLog(item)}
      >
        {/* Top Row: Operation Type + Storage + Timestamp */}
        <View style={styles.cardTopRow}>
          <View style={styles.opBadgesRow}>
            <Text style={styles.operationType}>{item.action || 'STATE_UPDATE'}</Text>
            <View
              style={[
                styles.storageBadge,
                {
                  backgroundColor: itemIsLocal
                    ? Theme.colors.primaryLight
                    : Theme.colors.successLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.storageBadgeText,
                  {
                    color: itemIsLocal
                      ? Theme.colors.primary
                      : Theme.colors.success,
                  },
                ]}
              >
                {itemIsLocal ? 'LOCAL' : 'CLOUD'}
              </Text>
            </View>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>200</Text>
          </View>
        </View>

        {/* Structured Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>SUB OPERATION</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {item.entity || 'App'}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>TIMESTAMP</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {formatLogTimestamp(item.createdAt)}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>IDENTIFIER</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {identifier}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>USER</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {currentUserName || currentUserEmail || 'You'}
            </Text>
          </View>
        </View>

        {/* Clickable Message / State Diff Link */}
        <View style={styles.messageRow}>
          <Text style={styles.messageLink} numberOfLines={2}>
            {item.summary}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Theme.colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={Theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>User Log Report</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isLocal ? 'Local-only' : 'Cloud-synced'} • Private to your account
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={18} color={Theme.colors.primary} />
          </TouchableOpacity>
          {logs.length > 0 && (
            <TouchableOpacity style={styles.iconBtn} onPress={handleClear}>
              <Ionicons name="trash-outline" size={18} color={Theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Theme.colors.textLight} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search operation, identifier, or state..."
          placeholderTextColor={Theme.colors.textLight}
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={Theme.colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Range & Storage Mode Filter Row */}
      <View style={styles.dualFilterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compactChipRow}
        >
          {DATE_FILTERS.map((df) => {
            const active = selectedDateRange === df.key;
            return (
              <TouchableOpacity
                key={df.key}
                style={[styles.compactChip, active && styles.compactChipActive]}
                onPress={() => setSelectedDateRange(df.key)}
              >
                <Text
                  style={[
                    styles.compactChipText,
                    active && styles.compactChipTextActive,
                  ]}
                >
                  {df.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.chipSeparator} />
          {STORAGE_FILTERS.map((sf) => {
            const active = selectedStorage === sf.key;
            return (
              <TouchableOpacity
                key={sf.key}
                style={[styles.compactChip, active && styles.compactChipActive]}
                onPress={() => setSelectedStorage(sf.key)}
              >
                <Text
                  style={[
                    styles.compactChipText,
                    active && styles.compactChipTextActive,
                  ]}
                >
                  {sf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Operation Type Filter Chips */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {actionFilters.map((action) => {
            const active = selectedAction === action;
            return (
              <TouchableOpacity
                key={action}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedAction(action)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {formatActionLabel(action)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Report List */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLogs(true)}
              tintColor={Theme.colors.primary}
            />
          }
          ListFooterComponent={
            filteredLogs.length > 0 ? (
              <View style={styles.totalFooter}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color={Theme.colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>No Matching Logs</Text>
              <Text style={styles.emptySub}>
                State updates for your account will appear here. Tap any row to view its previous and updated JSON state.
              </Text>
            </View>
          }
        />
      )}

      {/* Detailed State Diff Modal */}
      <Modal
        visible={!!selectedLog}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {selectedLog?.action || 'STATE_UPDATE'}
                </Text>
                <Text style={styles.modalSub}>
                  {formatLogTimestamp(selectedLog?.createdAt)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedLog(null)}
              >
                <Ionicons name="close" size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalMessage}>{selectedLog?.summary}</Text>

              <View style={styles.modalMetaBox}>
                <Text style={styles.modalMetaLine}>
                  User: {currentUserName || 'You'} ({currentUserEmail || 'Local'})
                </Text>
                <Text style={styles.modalMetaLine}>
                  Sub Operation: {selectedLog?.entity || 'App'}
                </Text>
                <Text style={styles.modalMetaLine}>
                  Identifier: {extractIdentifier(selectedLog)}
                </Text>
                <Text style={styles.modalMetaLine}>
                  Storage:{' '}
                  {selectedLog?.isLocal || selectedLog?.storageMode === 'local'
                    ? 'LOCAL'
                    : 'CLOUD'}
                </Text>
              </View>

              <Text style={styles.diffLabel}>PREVIOUS STATE</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} selectable>
                  {formatJson(selectedLog?.previousState)}
                </Text>
              </View>

              <View style={styles.arrowRow}>
                <Ionicons name="arrow-down" size={14} color={Theme.colors.primary} />
                <Text style={styles.arrowText}>UPDATED STATE</Text>
              </View>

              <View style={styles.codeBox}>
                <Text style={styles.codeText} selectable>
                  {formatJson(selectedLog?.nextState)}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  dualFilterRow: {
    marginBottom: 8,
  },
  compactChipRow: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  compactChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  compactChipActive: {
    backgroundColor: Theme.colors.primaryLight,
    borderColor: Theme.colors.primary,
  },
  compactChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.textMuted,
  },
  compactChipTextActive: {
    color: Theme.colors.primary,
  },
  chipSeparator: {
    width: 1,
    height: 18,
    backgroundColor: Theme.colors.border,
    marginHorizontal: 4,
  },
  filterWrap: {
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 110,
    flexGrow: 1,
  },
  reportCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  opBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  operationType: {
    fontSize: 12,
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: 0.3,
  },
  storageBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  storageBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusPill: {
    backgroundColor: Theme.colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.colors.success,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  metaCell: {
    width: '47%',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Theme.colors.textLight,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  messageLink: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
  totalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textMuted,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Theme.colors.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Theme.colors.text,
  },
  modalSub: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMessage: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginBottom: 12,
  },
  modalMetaBox: {
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 14,
    gap: 4,
  },
  modalMetaLine: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  diffLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.colors.textLight,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 8,
  },
  arrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.colors.primary,
    letterSpacing: 0.6,
  },
  codeBox: {
    backgroundColor: Theme.colors.background,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: Theme.colors.text,
    lineHeight: 16,
  },
});

export default ActivityLogsScreen;
