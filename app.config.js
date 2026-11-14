export default {
  expo: {
    name: "KOSH",
    slug: "kosh",
    version: "1.5.3-beta",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/kosh-icon.png",
    splash: {
      image: "./assets/kosh-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0F3D3A"
    },
    scheme: "kosh",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.pavan.kosh",
      buildNumber: "1.5.3"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/kosh-icon.png",
        backgroundColor: "#0F3D3A"
      },
      package: "com.pavan.kosh",
      versionCode: 23
    },
    plugins: [
      "expo-secure-store",
      "expo-web-browser",
      "@react-native-community/datetimepicker",
      "expo-font",
      "expo-image",
      "expo-sharing",
      "expo-splash-screen",
      "expo-status-bar"
    ],
    extra: {
      firebaseApiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
      eas: {
        projectId: "edb1744f-b861-4562-97e2-bd02e7f4a76e"
      }
    }
  }
};
