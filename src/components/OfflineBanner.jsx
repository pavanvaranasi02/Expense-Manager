import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import useSyncStore from '../store/useSyncStore';

const OfflineBanner = () => {
  const { isOnline, isSyncing, pendingCount } = useSyncStore();
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: !isOnline || pendingCount > 0 ? 0 : -50,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, pendingCount]);

  if (isOnline && pendingCount === 0) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        !isOnline ? styles.offlineBanner : styles.pendingBanner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Ionicons
        name={isSyncing ? 'sync' : !isOnline ? 'cloud-offline-outline' : 'time-outline'}
        size={16}
        color="#FFFFFF"
      />
      <Text style={styles.bannerText}>
        {isSyncing
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
  offlineBanner: { backgroundColor: '#EF4444' },
  pendingBanner: { backgroundColor: '#F59E0B' },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default OfflineBanner;