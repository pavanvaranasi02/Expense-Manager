import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto';
import OfflineBanner from './src/components/OfflineBanner';
import useNetworkSync from './src/hooks/useNetworkSync';
import AppNavigator from './src/navigation/AppNavigator';


// Inside your root component that wraps the navigator:
const SyncProvider = ({ children }) => {
  useNetworkSync(); // starts network listener + auto-sync
  return children;
};

function App() {
  return (
    <SyncProvider>
      <View style={styles.root}>
        <SafeAreaProvider>
          <OfflineBanner />
          <StatusBar style="dark" />
          <AppNavigator />
        </SafeAreaProvider>
      </View>
    </SyncProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

registerRootComponent(App);