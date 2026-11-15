import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const KOSH_APP_ICON = require('../../../assets/kosh-icon.png');

const KoshSplashScreen = () => {
  const pulse = useSharedValue(1);
  const progress = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    progress.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, [pulse, progress]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -72 + progress.value * 180 }],
  }));

  return (
    <LinearGradient
      colors={['#0B2E2B', '#0F3D3A', '#134E4A']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.container}
    >
      {/* Subtle ambient top-right glow */}
      <View style={styles.ambientTop} pointerEvents="none" />
      <View style={styles.ambientBottom} pointerEvents="none" />

      <View style={styles.centerBlock}>
        <Animated.View entering={FadeIn.duration(450)} style={styles.logoStage}>
          <Animated.View style={[styles.outerRing, haloStyle]} />
          <View style={styles.logoFrame}>
            <Image source={KOSH_APP_ICON} style={styles.logoImg} resizeMode="cover" />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(140).duration(500)}
          style={styles.brandBlock}
        >
          <Text style={styles.wordmark}>KOSH</Text>
          <View style={styles.goldRule} />
          <Text style={styles.tagline}>PERSONAL WEALTH TREASURY</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(220).duration(500)} style={styles.footer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressThumb, shimmerStyle]} />
        </View>
        <Text style={styles.footerText}>Securing your ledger</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  ambientTop: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  ambientBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoStage: {
    width: 144,
    height: 144,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 138,
    height: 138,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  logoFrame: {
    width: 112,
    height: 112,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: '#0F3D3A',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 26,
  },
  wordmark: {
    fontSize: 30,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    letterSpacing: 7,
  },
  goldRule: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#F59E0B',
    marginVertical: 12,
    opacity: 0.9,
  },
  tagline: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: '#99F6E4',
    letterSpacing: 2.4,
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    width: 108,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  progressThumb: {
    width: 56,
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#F59E0B',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: 'rgba(204, 251, 241, 0.72)',
    letterSpacing: 0.4,
  },
});

export default KoshSplashScreen;
