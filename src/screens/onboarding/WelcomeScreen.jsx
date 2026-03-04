import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const WelcomeScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container}>
    <View style={styles.content}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>
        Let's set up your account in just a few steps
      </Text>

      <View style={styles.steps}>
        <View style={styles.step}>
          <View style={[styles.stepIcon, { backgroundColor: '#F0EFFF' }]}>
            <Text style={styles.stepNum}>1</Text>
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Your Profile</Text>
            <Text style={styles.stepDesc}>Name & currency preference</Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={[styles.stepIcon, { backgroundColor: '#D1FAE5' }]}>
            <Text style={styles.stepNum}>2</Text>
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Your Accounts</Text>
            <Text style={styles.stepDesc}>Bank, credit card & cash</Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={[styles.stepIcon, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.stepNum}>3</Text>
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Set Budget</Text>
            <Text style={styles.stepDesc}>Monthly spending limits</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate('SetupProfile')}
      >
        <Text style={styles.btnText}>Let's Get Started →</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  emoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  steps: { marginTop: 40, marginBottom: 40 },
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepIcon: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  stepNum: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  stepText: { marginLeft: 16 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  stepDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  btn: {
    backgroundColor: '#6C63FF', height: 52, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default WelcomeScreen;