import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
} from "react-native-reanimated";
import * as Haptics from 'expo-haptics';

const ModernToggle = ({ value, onValueChange, activeColor = "#134E4A" }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(
        value ? activeColor : "#E5E2DC",
        { duration: 250 }
      ),
    };
  });

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: withTiming(value ? 20 : 0, { duration: 250 }) }
      ],
      backgroundColor: "#FFFFFF",
    };
  });

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handleToggle}>
      <Animated.View style={[styles.toggleBackground, animatedStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  toggleBackground: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
  },
});

export default ModernToggle;
