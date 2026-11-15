import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const KOSH_APP_ICON = require('../../../assets/kosh-icon.png');

const KoshSplashScreen = () => {
  const logoScale = useSharedValue(0.92);
  const pulse = useSharedValue(1);
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 14, stiffness: 110 });
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    const makeDotAnim = (delay) =>
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.25, { duration: 420, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );

    dot1.value = makeDotAnim(0);
    dot2.value = makeDotAnim(160);
    dot3.value = makeDotAnim(320);
  }, [logoScale, pulse, dot1, dot2, dot3]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <LinearGradient
      colors={['#071F1D', '#0D3834', '#082623']}
      locations={[0, 0.52, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />

      <View style={styles.centerBlock}>
        <Animated.View style={[styles.logoStage, logoAnimStyle]}>
          <Animated.View style={[styles.haloRing, haloStyle]} />
          <View style={styles.logoCircle}>
            <Image source={KOSH_APP_ICON} style={styles.logoImg} resizeMode="cover" />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(120).duration(500)}
          style={styles.brandBlock}
        >
          <Text style={styles.wordmark}>KOSH</Text>
          <View style={styles.goldRule} />
          <Text style={styles.tagline}>PERSONAL WEALTH TREASURY</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(200).duration(450)} style={styles.footer}>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 52,
    paddingHorizontal: 28,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoStage: {
    width: 148,
    height: 148,
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloRing: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 83, 0.24)',
    backgroundColor: 'rgba(20, 184, 166, 0.05)',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#0D3834',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 28,
  },
  wordmark: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    color: '#F8FAFC',
    letterSpacing: 10,
    paddingLeft: 10, // visually center letterSpacing
  },
  goldRule: {
    width: 28,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#D4A853',
    marginVertical: 14,
  },
  tagline: {
    fontSize: 10.5,
    fontFamily: 'Manrope_600SemiBold',
    color: 'rgba(153, 246, 228, 0.78)',
    letterSpacing: 3,
    paddingLeft: 3,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4A853',
  },
});

export default KoshSplashScreen;
