import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import useStorageStore from '../store/useStorageStore';
import useSyncStore from '../store/useSyncStore';
import { Theme } from '../theme/theme';

const OfflineBanner = () => {
  const { isOnline, isSyncing, pendingCount } = useSyncStore();
  const storageMode = useStorageStore((s) => s.storageMode);
  const migrationStatus = useStorageStore((s) => s.migrationStatus);
  const migrationProgress = useStorageStore((s) => s.migrationProgress);
  const [slideAnim] = useState(() => new Animated.Value(-50));

  const isMigrating =
    migrationStatus === 'downloading' || migrationStatus === 'uploading';
  const showOfflineOrPending =
    storageMode !== 'local' && (!isOnline || pendingCount > 0);
  const shouldShow = isMigrating || showOfflineOrPending;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -50,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, slideAnim]);

  if (!shouldShow) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        isMigrating
          ? styles.migratingBanner
          : !isOnline
          ? styles.offlineBanner
          : styles.pendingBanner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Ionicons
        name={
          isMigrating
            ? 'cloud-download-outline'
            : isSyncing
            ? 'sync'
            : !isOnline
            ? 'cloud-offline-outline'
            : 'time-outline'
        }
        size={16}
        color="#FFFFFF"
      />
      <Text style={styles.bannerText}>
        {isMigrating
          ? `${migrationProgress.label || 'Syncing storage...'} (${migrationProgress.current}/${migrationProgress.total})`
          : isSyncing
          ? 'Syncing...'
          : !isOnline
          ? `Offline${pendingCount > 0 ? ` • ${pendingCount} pending` : ''}`
          : `${pendingCount} item(s) pending sync`}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  migratingBanner: { backgroundColor: Theme.colors.primary },
  offlineBanner: { backgroundColor: Theme.colors.error },
  pendingBanner: { backgroundColor: Theme.colors.warning },
  bannerText: {
    color: Theme.colors.surface,
    fontSize: 13,
    fontWeight: Theme.typography.weight.semibold,
  },
});

export default OfflineBanner;