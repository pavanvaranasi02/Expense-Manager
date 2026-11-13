import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SetBudgetScreen = ({ navigation }) => (
  <SafeAreaView style={s.c}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.b}>
          <Text style={s.bt}>← Back</Text>
        </TouchableOpacity>
        <View style={s.m}>
          <Text style={s.t}>Set Budget</Text>
          <Text style={s.desc}>This screen is under development. You'll be able to set your monthly budgets here soon!</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#F8F9FE' },
  content: { flexGrow: 1 },
  b: { padding: 20 },
  bt: { fontSize: 16, color: '#6C63FF', fontWeight: '600' },
  m: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  t: { fontSize: 20, color: '#1A1A2E', fontWeight: '700', marginBottom: 12 },
  desc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});

export default SetBudgetScreen;
