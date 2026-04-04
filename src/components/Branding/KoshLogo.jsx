import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../../theme/theme';

const KoshLogo = ({ size = 60, showText = false, fontSize = 20 }) => {
  const iconSize = size;
  const radius = size * 0.3;

  return (
    <View style={[styles.container, { width: iconSize, height: iconSize }]}>
      {/* Glass Layer */}
      <View style={[
        styles.glass, 
        { 
          width: iconSize, 
          height: iconSize, 
          borderRadius: radius,
          backgroundColor: Theme.colors.glass,
          borderColor: Theme.colors.glassBorder,
        }
      ]} />
      
      {/* Content Layer (Gold) */}
      <View style={styles.content}>
        <LinearGradient
          colors={[Theme.colors.goldLight, Theme.colors.gold, Theme.colors.goldDark]}
          style={[styles.logoBox, { width: iconSize * 0.7, height: iconSize * 0.7, borderRadius: radius * 0.8 }]}
        >
          <Text style={[styles.logoText, { fontSize: iconSize * 0.35 }]}>K</Text>
        </LinearGradient>
      </View>

      {showText && (
        <Text style={[styles.brandName, { fontSize, marginTop: size * 0.2 }]}>
          KOSH
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glass: {
    position: 'absolute',
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Theme.colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  logoText: {
    color: '#FFF',
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandName: {
    fontWeight: '800',
    color: Theme.colors.text,
    letterSpacing: 2,
  },
});

export default KoshLogo;
