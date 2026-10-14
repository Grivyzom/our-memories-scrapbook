import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  CameraFocusZone,
  PhotoSlotKey,
  SpreadPhotosMap,
} from '../types/scrapbook';
import { SPREAD_WIDTH, SPREAD_HEIGHT } from '../constants/defaultData';
import { ScrapbookSpread } from './ScrapbookSpread';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InteractiveBookViewportProps {
  photos: SpreadPhotosMap;
  onSelectPhotoSlot: (slot: PhotoSlotKey) => void;
  onCloseBook: () => void;
  captureRef: React.RefObject<View>;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
  mass: 0.8,
};

export const InteractiveBookViewport: React.FC<InteractiveBookViewportProps> = ({
  photos,
  onSelectPhotoSlot,
  onCloseBook,
  captureRef,
}) => {
  const [focusZone, setFocusZone] = useState<CameraFocusZone>('left');

  // Escalas calculadas para adaptarse a cualquier pantalla de smartphone
  const singlePageScale = Math.min(
    (SCREEN_WIDTH * 0.92) / (SPREAD_WIDTH * 0.52),
    (SCREEN_HEIGHT * 0.62) / SPREAD_HEIGHT
  );
  const fullSpreadScale = (SCREEN_WIDTH * 0.95) / (SPREAD_WIDTH + 28);
  const rotatedLandscapeScale = Math.min(
    (SCREEN_HEIGHT * 0.66) / (SPREAD_WIDTH + 28),
    (SCREEN_WIDTH * 0.92) / (SPREAD_HEIGHT + 24)
  );

  const scale = useSharedValue(singlePageScale);
  const savedScale = useSharedValue(singlePageScale);
  const translateX = useSharedValue((SPREAD_WIDTH * 0.24) * singlePageScale);
  const savedTranslateX = useSharedValue((SPREAD_WIDTH * 0.24) * singlePageScale);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotationDeg = useSharedValue(0);

  const applyCameraZone = (zone: CameraFocusZone) => {
    setFocusZone(zone);
    if (zone === 'left') {
      const targetX = SPREAD_WIDTH * 0.23 * singlePageScale;
      scale.value = withSpring(singlePageScale, SPRING_CONFIG);
      savedScale.value = singlePageScale;
      translateX.value = withSpring(targetX, SPRING_CONFIG);
      savedTranslateX.value = targetX;
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedTranslateY.value = 0;
      rotationDeg.value = withSpring(0, SPRING_CONFIG);
    } else if (zone === 'center') {
      scale.value = withSpring(singlePageScale, SPRING_CONFIG);
      savedScale.value = singlePageScale;
      translateX.value = withSpring(0, SPRING_CONFIG);
      savedTranslateX.value = 0;
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedTranslateY.value = 0;
      rotationDeg.value = withSpring(0, SPRING_CONFIG);
    } else if (zone === 'right') {
      const targetX = -SPREAD_WIDTH * 0.23 * singlePageScale;
      scale.value = withSpring(singlePageScale, SPRING_CONFIG);
      savedScale.value = singlePageScale;
      translateX.value = withSpring(targetX, SPRING_CONFIG);
      savedTranslateX.value = targetX;
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedTranslateY.value = 0;
      rotationDeg.value = withSpring(0, SPRING_CONFIG);
    } else if (zone === 'full') {
      scale.value = withSpring(fullSpreadScale, SPRING_CONFIG);
      savedScale.value = fullSpreadScale;
      translateX.value = withSpring(0, SPRING_CONFIG);
      savedTranslateX.value = 0;
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedTranslateY.value = 0;
      rotationDeg.value = withSpring(0, SPRING_CONFIG);
    } else if (zone === 'landscape90') {
      scale.value = withSpring(rotatedLandscapeScale, SPRING_CONFIG);
      savedScale.value = rotatedLandscapeScale;
      translateX.value = withSpring(0, SPRING_CONFIG);
      savedTranslateX.value = 0;
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedTranslateY.value = 0;
      rotationDeg.value = withSpring(90, SPRING_CONFIG);
    }
  };

  useEffect(() => {
    applyCameraZone('left');
  }, []);

  // Gesto Pan con física para recorrer Página Izquierda -> Centro -> Página Derecha
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY * 0.6;
    })
    .onEnd(() => {
      const maxOffsetX = (SPREAD_WIDTH * 0.34) * scale.value;
      const maxOffsetY = (SPREAD_HEIGHT * 0.24) * scale.value;

      const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, translateX.value));
      const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, translateY.value));

      translateX.value = withSpring(clampedX, SPRING_CONFIG);
      translateY.value = withSpring(clampedY, SPRING_CONFIG);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  // Gesto Pinch-to-Zoom con dos dedos para acercar o ver el pliego completo
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const nextScale = savedScale.value * e.scale;
      scale.value = Math.max(fullSpreadScale * 0.9, Math.min(1.35, nextScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedViewportStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotationDeg.value}deg` },
      { scale: scale.value },
    ],
  }));

  const handleCycleViewMode = () => {
    if (focusZone === 'full') {
      applyCameraZone('landscape90');
    } else if (focusZone === 'landscape90') {
      applyCameraZone('left');
    } else {
      applyCameraZone('full');
    }
  };

  return (
    <View style={styles.viewportWrapper}>
      {/* Píldoras superiores de navegación de página + Botón de Cerrar Portada */}
      <View style={styles.cameraNavRow}>
        <Pressable onPress={onCloseBook} style={styles.closeCoverChip}>
          <Ionicons name="book-outline" size={14} color="#FFF" />
          <Text style={styles.closeCoverChipText}>Portada</Text>
        </Pressable>

        <View style={styles.pageZonePills}>
          <Pressable
            onPress={() => applyCameraZone('left')}
            style={[
              styles.zonePill,
              focusZone === 'left' && styles.zonePillActive,
            ]}
          >
            <Text
              style={[
                styles.zonePillText,
                focusZone === 'left' && styles.zonePillTextActive,
              ]}
            >
              Izquierda
            </Text>
          </Pressable>

          <Pressable
            onPress={() => applyCameraZone('center')}
            style={[
              styles.zonePill,
              focusZone === 'center' && styles.zonePillActive,
            ]}
          >
            <Text
              style={[
                styles.zonePillText,
                focusZone === 'center' && styles.zonePillTextActive,
              ]}
            >
              Centro
            </Text>
          </Pressable>

          <Pressable
            onPress={() => applyCameraZone('right')}
            style={[
              styles.zonePill,
              focusZone === 'right' && styles.zonePillActive,
            ]}
          >
            <Text
              style={[
                styles.zonePillText,
                focusZone === 'right' && styles.zonePillTextActive,
              ]}
            >
              Derecha
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Lienzo interactivo con soporte Pan + Pinch-to-Zoom */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureStage}>
          <Animated.View style={animatedViewportStyle}>
            <View ref={captureRef} collapsable={false}>
              <ScrapbookSpread
                photos={photos}
                onSelectPhotoSlot={onSelectPhotoSlot}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Botón flotante sutil de "Vista Completa / Rotar" */}
      <Pressable onPress={handleCycleViewMode} style={styles.floatingModeButton}>
        <Ionicons
          name={
            focusZone === 'full'
              ? 'phone-landscape-outline'
              : focusZone === 'landscape90'
              ? 'scan-outline'
              : 'expand-outline'
          }
          size={16}
          color="#FFF"
        />
        <Text style={styles.floatingModeButtonText}>
          {focusZone === 'full'
            ? 'Rotar Pliego 90°'
            : focusZone === 'landscape90'
            ? 'Enfocar Página'
            : 'Vista Completa / Rotar'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  viewportWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraNavRow: {
    position: 'absolute',
    top: 4,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  closeCoverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(25, 33, 52, 0.42)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  closeCoverChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pageZonePills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(25, 33, 52, 0.38)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  zonePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
  },
  zonePillActive: {
    backgroundColor: '#FFFFFF',
  },
  zonePillText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  zonePillTextActive: {
    color: '#2B3654',
    fontWeight: '700',
  },
  gestureStage: {
    flex: 1,
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  floatingModeButton: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(24, 32, 50, 0.68)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingModeButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
