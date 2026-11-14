import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const IncomeListScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
      <Text style={styles.backText}>← Back</Text>
    </TouchableOpacity>
    <View style={styles.content}>
      <Text style={styles.text}>Income List</Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F6F2' },
  back: { padding: 20 },
  backText: { fontSize: 16, color: '#134E4A', fontFamily: 'Manrope_600SemiBold' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 14, color: '#71717A' },
});

export default IncomeListScreen;
