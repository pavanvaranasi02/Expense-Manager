import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BudgetStatusScreen = ({ navigation }) => (
  <SafeAreaView style={s.c}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={s.b}>
      <Text style={s.bt}>← Back</Text>
    </TouchableOpacity>
    <View style={s.m}><Text style={s.t}>Budget Status</Text></View>
  </SafeAreaView>
);

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#F8F9FE' },
  b: { padding: 20 },
  bt: { fontSize: 16, color: '#6C63FF', fontWeight: '600' },
  m: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  t: { fontSize: 16, color: '#9CA3AF' },
});

export default BudgetStatusScreen;
