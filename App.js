import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto';
import OfflineBanner from './src/components/OfflineBanner';
import UpdateModal from './src/components/UpdateModal';
import useNetworkSync from './src/hooks/useNetworkSync';
import AppNavigator from './src/navigation/AppNavigator';
import { initStateLoggers } from './src/services/activityLogService';
import { checkForGitHubUpdates } from './src/services/updateService';


// Inside your root component that wraps the navigator:
const SyncProvider = ({ children }) => {
  useNetworkSync(); // starts network listener + auto-sync
  return children;
};

function App() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    const stopLoggers = initStateLoggers();

    let mounted = true;
    (async () => {
      const result = await checkForGitHubUpdates();
      if (mounted && result?.success && result?.hasUpdate) {
        setUpdateInfo(result);
        setShowUpdateModal(true);
      }
    })();

    return () => {
      mounted = false;
      stopLoggers();
    };
  }, []);

  return (
    <SyncProvider>
      <View style={styles.root}>
        <SafeAreaProvider>
          <OfflineBanner />
          <StatusBar style="dark" />
          <AppNavigator />
          <UpdateModal
            visible={showUpdateModal}
            updateInfo={updateInfo}
            onClose={() => setShowUpdateModal(false)}
          />
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