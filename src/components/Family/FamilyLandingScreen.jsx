import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Analytics } from '../../config/firebase';
import { getFamily } from '../../services/familyService';
import useAuthStore from '../../store/useAuthStore';
import useFamilyStore from '../../store/useFamilyStore';

const FamilyLandingScreen = ({ navigation }) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { setFamily, setMembers, family, clearFamily } = useFamilyStore();
  const [checking, setChecking] = useState(true);

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const checkFamilyStatus = async () => {
    try {
      setChecking(true);
      
      // Check both userProfile and existing family store
      const familyId = userProfile?.familyId || family?.id;

      if (familyId) {
        // If we already have family data in store, navigate directly
        if (family && family.id === familyId) {
          console.log('Family already in store, navigating to dashboard');
          navigation.replace('FamilyDashboard');
          return;
        }

        // Otherwise fetch family data
        const result = await getFamily(familyId);
        if (result.success) {
          setFamily(result.family);
          setMembers(result.family.members || []);
          navigation.replace('FamilyDashboard');
        } else {
          // Family not found — clear state and show landing
          console.log('Family not found, showing landing');
          clearFamily();
        }
      } else {
        // No family — clear any stale data and show landing
        if (family) {
          clearFamily();
        }
      }
    } catch (error) {
      console.log('Check family status error:', error);
    } finally {
      setChecking(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView('FamilyLanding');
      checkFamilyStatus();
    }, [userProfile?.familyId, family?.id])
  );

  if (checking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#134E4A" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#18181B" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={64} color="#134E4A" />
          </View>
        </View>

        {/* Text */}
        <Text style={styles.title}>Family Budgeting</Text>
        <Text style={styles.subtitle}>
          Track shared expenses, set family budgets, and manage finances together 
          with up to 6 family members.
        </Text>

        {/* Features */}
        <View style={styles.features}>
          {[
            { icon: 'wallet-outline', text: 'Shared expense tracking' },
            { icon: 'pie-chart-outline', text: 'Family budget management' },
            { icon: 'bar-chart-outline', text: 'Combined analytics' },
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={18} color="#134E4A" />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CreateFamily')}
          >
            <View style={{ width: '100%', borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 2, height: 56 }}>
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={{ width: 800, height: 800, transform: [{ rotate: spin }] }}>
                  <LinearGradient colors={['#a43e3e', 'rgba(255,0,255,0)', 'rgba(255,0,255,0)', '#bb4646']} start={{x:0, y:0}} end={{x:1, y:1}} style={{ flex: 1 }} />
                </Animated.View>
              </View>
              <View style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#134E4A', borderRadius: 14, gap: 10 }}>
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Create a Family</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('JoinFamily')}
          >
            <View style={{ width: '100%', borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 2, height: 56 }}>
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={{ width: 800, height: 800, transform: [{ rotate: spin }] }}>
                  <LinearGradient colors={['#134E4A', 'rgba(108,99,255,0)', 'rgba(108,99,255,0)', '#134E4A']} start={{x:0, y:0}} end={{x:1, y:1}} style={{ flex: 1 }} />
                </Animated.View>
              </View>
              <View style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, gap: 10 }}>
                <Ionicons name="enter-outline" size={22} color="#134E4A" />
                <Text style={styles.secondaryBtnText}>Join with Code</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#71717A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2E0FF',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: '#18181B',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  features: {
    marginTop: 32,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E6F2F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: '#18181B',
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#134E4A',
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#134E4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: '#134E4A',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#134E4A',
  },
});

export default FamilyLandingScreen;