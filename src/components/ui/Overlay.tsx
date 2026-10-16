import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const OPEN_MS = 240;
const CLOSE_MS = 200;

interface OverlayProps {
  visible: boolean;
  onClose: () => void;
  /** 'sheet': hoja inferior sobre un fondo oscurecido. 'screen': pantalla completa. */
  variant?: 'sheet' | 'screen';
  children: React.ReactNode;
}

/**
 * Capa que se pinta dentro de la propia ventana de la app, encima de todo.
 *
 * Sustituye a <Modal> de React Native: en Android (nueva arquitectura, RN 0.76)
 * el Modal abría su ventana aparte, oscurecía la pantalla y deslizaba algo
 * hacia arriba, pero su contenido no se pintaba ni recibía toques, así que la
 * app parecía colgada. Aquí no hay segunda ventana: es una vista más del árbol.
 * El botón atrás de Android la cierra.
 */
export const Overlay: React.FC<OverlayProps> = ({ visible, onClose, variant = 'sheet', children }) => {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [variant === 'screen' ? height * 0.25 : height, 0],
  });

  return (
    <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
      {variant === 'sheet' && (
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        </Animated.View>
      )}
      <Animated.View
        style={[
          variant === 'screen' ? styles.screen : styles.sheet,
          variant === 'screen'
            ? { opacity: progress, transform: [{ translateY }] }
            : { transform: [{ translateY }] },
        ]}
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
});
