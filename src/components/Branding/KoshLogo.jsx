import { Image, StyleSheet, Text, View } from 'react-native';

const KOSH_APP_ICON = require('../../../assets/kosh-icon.png');

const KoshLogo = ({ size = 60, showText = false, fontSize = 20 }) => {
  const radius = Math.round(size * 0.28);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.logoFrame,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
      >
        <Image
          source={KOSH_APP_ICON}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>

      {showText && (
        <Text style={[styles.brandName, { fontSize, marginTop: size * 0.18 }]}>
          KOSH
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFrame: {
    overflow: 'hidden',
    backgroundColor: '#0F3D3A',
    borderWidth: 1,
    borderColor: '#E5E2DC',
  },
  brandName: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    letterSpacing: 3,
  },
});

export default KoshLogo;
