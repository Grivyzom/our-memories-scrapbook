import React, { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export interface ToastMessage {
  id: number;
  text: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

/** Aviso breve y no bloqueante (sustituye a los Alert informativos). */
export const Toast: React.FC<{ message: ToastMessage | null; onHidden: () => void }> = ({
  message,
  onHidden,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!message) return;
    progress.value = 0;
    progress.value = withSequence(
      withTiming(1, { duration: 220 }),
      withDelay(
        2200,
        withTiming(0, { duration: 260 }, (finished) => {
          if (finished) runOnJS(onHidden)();
        })
      )
    );
  }, [message?.id]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * 14 }],
  }));

  if (!message) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, style]}>
      <Ionicons name={message.icon ?? 'sparkles'} size={16} color="#F6D58E" />
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    // Bajo el encabezado: no tapa la navegación de páginas ni el dock
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 74 : 104,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 27, 46, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
  },
});
