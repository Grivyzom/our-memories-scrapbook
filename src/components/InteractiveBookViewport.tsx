import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { captureRef as captureViewRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import {
  CameraFocusZone,
  PhotoSlotKey,
  SpreadPhotosMap,
} from '../types/scrapbook';
import {
  SPREAD_WIDTH,
  SPREAD_HEIGHT,
  OPEN_BOOK_TILT,
  getFullSpreadScale,
} from '../constants/defaultData';
import { ScrapbookSpread } from './ScrapbookSpread';
import { FlipDirection, FlipRequest, PageFlipOverlay } from './PageFlipOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InteractiveBookViewportProps {
  photos: SpreadPhotosMap;
  onSelectPhotoSlot: (slot: PhotoSlotKey) => void;
  onCloseBook: () => void;
  captureRef: React.RefObject<View>;
  activeSpreadIndex: number;
  totalSpreads: number;
  onPrevSpread: () => void;
  onNextSpread: () => void;
  onGoToSpread?: (index: number) => void;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
  mass: 0.8,
};

// Inclinación del libro abierto sobre la "mesa" (grados) según el encuadre
const TILT_BY_ZONE: Record<CameraFocusZone, number> = {
  left: 9,
  right: 9,
  center: OPEN_BOOK_TILT,
  full: OPEN_BOOK_TILT,
  landscape90: 0,
};
const CAMERA_PERSPECTIVE = 1500;

// Grosor visible de cada bloque de hojas según cuántos pliegos quedan a cada lado
const stackLayersFor = (sheets: number) => Math.min(8, 2 + sheets);

const captureSpread = async (ref: React.RefObject<View>): Promise<string | null> => {
  try {
    if (!ref.current) return null;
    return await captureViewRef(ref, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
  } catch {
    return null;
  }
};

export const InteractiveBookViewport: React.FC<InteractiveBookViewportProps> = ({
  photos,
  onSelectPhotoSlot,
  onCloseBook,
  captureRef,
  activeSpreadIndex,
  totalSpreads,
  onPrevSpread,
  onNextSpread,
}) => {
  // Arranca en "Ambas Páginas": es el encuadre en el que termina la apertura de la portada
  const [focusZone, setFocusZone] = useState<CameraFocusZone>('full');

  // Escalas calculadas para adaptarse a cualquier smartphone
  const singlePageScale = Math.min(
    (SCREEN_WIDTH * 0.94) / (SPREAD_WIDTH * 0.52),
    (SCREEN_HEIGHT * 0.58) / SPREAD_HEIGHT
  );
  const fullSpreadScale = getFullSpreadScale(SCREEN_WIDTH);
  const rotatedLandscapeScale = Math.min(
    (SCREEN_HEIGHT * 0.66) / (SPREAD_WIDTH + 28),
    (SCREEN_WIDTH * 0.92) / (SPREAD_HEIGHT + 24)
  );

  const scale = useSharedValue(fullSpreadScale);
  const savedScale = useSharedValue(fullSpreadScale);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotationDeg = useSharedValue(0);
  const tiltDeg = useSharedValue(TILT_BY_ZONE.full);
  // Balanceo muy sutil en reposo: el libro "respira" sobre la mesa
  const idleSway = useSharedValue(0);

  useEffect(() => {
    idleSway.value = withRepeat(withTiming(1, { duration: 7200, easing: Easing.linear }), -1, false);
  }, []);

  const applyCameraZone = (zone: CameraFocusZone) => {
    setFocusZone(zone);
    tiltDeg.value = withSpring(TILT_BY_ZONE[zone], SPRING_CONFIG);
    if (zone === 'left') {
      const targetX = SPREAD_WIDTH * 0.23 * singlePageScale;
      scale.value = withSpring(singlePageScale, SPRING_CONFIG);
      savedScale.value = singlePageScale;
      translateX.value = withSpring(targetX, SPRING_CONFIG);
      savedTranslateX.value = targetX;
      translateY.value = withSpring(0, SPRING_CONFIG);
      savedTranslateY.value = 0;
      rotationDeg.value = withSpring(0, SPRING_CONFIG);
    } else if (zone === 'center' || zone === 'full') {
      scale.value = withSpring(fullSpreadScale, SPRING_CONFIG);
      savedScale.value = fullSpreadScale;
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

  // Gesto Pan con amortiguación
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY * 0.6;
    })
    .onEnd(() => {
      const maxOffsetX = (SPREAD_WIDTH * 0.35) * scale.value;
      const maxOffsetY = (SPREAD_HEIGHT * 0.25) * scale.value;

      const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, translateX.value));
      const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, translateY.value));

      translateX.value = withSpring(clampedX, SPRING_CONFIG);
      translateY.value = withSpring(clampedY, SPRING_CONFIG);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  // Gesto Pinch-to-Zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const nextScale = savedScale.value * e.scale;
      scale.value = Math.max(fullSpreadScale * 0.85, Math.min(1.4, nextScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedViewportStyle = useAnimatedStyle(() => {
    // El balanceo se apaga en vista apaisada (libro sin inclinación)
    const swayAmount = Math.min(1, tiltDeg.value / 9);
    // Empieza en 0 para que el relevo desde la portada no dé un salto
    const sway = Math.sin(idleSway.value * 2 * Math.PI) * 0.5 * swayAmount;
    return {
      transform: [
        { perspective: CAMERA_PERSPECTIVE },
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateX: `${tiltDeg.value + sway * 1.2}deg` },
        { rotateY: `${sway * 1.6}deg` },
        { rotateZ: `${rotationDeg.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  /* ==================== HOJEADO EN CASCADA ==================== */
  const [flip, setFlip] = useState<FlipRequest | null>(null);
  const [flipNewUri, setFlipNewUri] = useState<string | null>(null);
  const flipBusy = useRef(false);
  const flipCounter = useRef(0);

  const canGoPrev = activeSpreadIndex > 0;
  const canGoNext = activeSpreadIndex < totalSpreads - 1;

  const turnPage = useCallback(
    async (dir: FlipDirection) => {
      if (flipBusy.current) return;
      if (dir === 'next' ? !canGoNext : !canGoPrev) return;
      flipBusy.current = true;
      const oldUri = await captureSpread(captureRef);
      flipCounter.current += 1;
      setFlipNewUri(null);
      setFlip({ id: flipCounter.current, dir, oldUri });
    },
    [canGoNext, canGoPrev, captureRef]
  );

  // La animación ya tapa el pliego viejo: cambiamos el contenido real debajo y
  // capturamos el nuevo para que la última hoja aterrice mostrándolo
  const handleFlipReady = useCallback(() => {
    if (!flip) return;
    if (flip.dir === 'next') onNextSpread();
    else onPrevSpread();
    const flipId = flip.id;
    setTimeout(async () => {
      const uri = await captureSpread(captureRef);
      if (flipCounter.current === flipId) setFlipNewUri(uri);
    }, 120);
  }, [flip, onNextSpread, onPrevSpread, captureRef]);

  const handleFlipFinished = useCallback(() => {
    flipBusy.current = false;
    setFlip(null);
    setFlipNewUri(null);
  }, []);

  const isFlipping = flip !== null;
  const prevDisabled = !canGoPrev || isFlipping;
  const nextDisabled = !canGoNext || isFlipping;

  const handleCycleViewMode = () => {
    if (focusZone === 'full' || focusZone === 'center') {
      applyCameraZone('landscape90');
    } else if (focusZone === 'landscape90') {
      applyCameraZone('left');
    } else {
      applyCameraZone('full');
    }
  };

  const pageAStart = activeSpreadIndex * 2 + 1;
  const pageBEnd = activeSpreadIndex * 2 + 2;

  return (
    <View style={styles.viewportWrapper}>
      {/* ==================== PANEL DE CONTROL SUPERIOR ==================== */}
      <View style={styles.topControlPanel}>
        {/* Fila 1: Botón Portada + Selector de Pliego y Páginas */}
        <View style={styles.topRow}>
          <Pressable onPress={onCloseBook} style={styles.closeCoverChip}>
            <Ionicons name="book-outline" size={13} color="#FFF" />
            <Text style={styles.closeCoverChipText}>Portada</Text>
          </Pressable>

          <View style={styles.spreadNavChip}>
            <Pressable
              onPress={() => turnPage('prev')}
              disabled={prevDisabled}
              style={[
                styles.miniNavBtn,
                prevDisabled && styles.miniNavBtnDisabled,
              ]}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-back"
                size={14}
                color={prevDisabled ? 'rgba(255,255,255,0.3)' : '#FFF'}
              />
            </Pressable>

            <Text style={styles.spreadNavText}>
              Pliego {activeSpreadIndex + 1}/{totalSpreads} (Págs. {pageAStart}-{pageBEnd})
            </Text>

            <Pressable
              onPress={() => turnPage('next')}
              disabled={nextDisabled}
              style={[
                styles.miniNavBtn,
                nextDisabled && styles.miniNavBtnDisabled,
              ]}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-forward"
                size={14}
                color={nextDisabled ? 'rgba(255,255,255,0.3)' : '#FFF'}
              />
            </Pressable>
          </View>
        </View>

        {/* Fila 2: Píldoras de Enfoque de Página (Página A, Ambas, Página B) */}
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
              Pág. A (Izq.)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => applyCameraZone('full')}
            style={[
              styles.zonePill,
              (focusZone === 'full' || focusZone === 'center') && styles.zonePillActive,
            ]}
          >
            <Text
              style={[
                styles.zonePillText,
                (focusZone === 'full' || focusZone === 'center') && styles.zonePillTextActive,
              ]}
            >
              Ambas Páginas
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
              Pág. B (Der.)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ==================== BOTONES LATERALES DE CAMBIO DE PÁGINA ==================== */}
      {/* Botón flotante para ir a la página/pliego anterior */}
      {canGoPrev && (
        <Pressable
          onPress={() => turnPage('prev')}
          disabled={isFlipping}
          style={styles.floatingPageTurnBtnLeft}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color="#FFF" />
          <Text style={styles.floatingPageTurnText}>Ant.</Text>
        </Pressable>
      )}

      {/* Botón flotante para ir a la página/pliego siguiente */}
      {canGoNext && (
        <Pressable
          onPress={() => turnPage('next')}
          disabled={isFlipping}
          style={styles.floatingPageTurnBtnRight}
          hitSlop={10}
        >
          <Ionicons name="chevron-forward" size={24} color="#FFF" />
          <Text style={styles.floatingPageTurnText}>Sig.</Text>
        </Pressable>
      )}

      {/* ==================== ÁREA INTERACTIVA CON GESTOS ==================== */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureStage}>
          <Animated.View style={animatedViewportStyle}>
            <View ref={captureRef} collapsable={false}>
              <ScrapbookSpread
                photos={photos}
                onSelectPhotoSlot={onSelectPhotoSlot}
                spreadIndex={activeSpreadIndex}
                leftStackLayers={stackLayersFor(activeSpreadIndex)}
                rightStackLayers={stackLayersFor(totalSpreads - 1 - activeSpreadIndex)}
              />
            </View>
            {flip && (
              <PageFlipOverlay
                key={flip.id}
                request={flip}
                newUri={flipNewUri}
                onReady={handleFlipReady}
                onFinished={handleFlipFinished}
              />
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Botón flotante inferior: Vista Completa / Rotar Pliego */}
      <Pressable onPress={handleCycleViewMode} style={styles.floatingModeButton}>
        <Ionicons
          name={
            focusZone === 'full' || focusZone === 'center'
              ? 'phone-landscape-outline'
              : focusZone === 'landscape90'
              ? 'scan-outline'
              : 'expand-outline'
          }
          size={15}
          color="#FFF"
        />
        <Text style={styles.floatingModeButtonText}>
          {focusZone === 'full' || focusZone === 'center'
            ? 'Rotar Pliego 90°'
            : focusZone === 'landscape90'
            ? 'Enfocar Página A'
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
  topControlPanel: {
    position: 'absolute',
    top: 2,
    zIndex: 30,
    width: '100%',
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    gap: 8,
  },
  closeCoverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(25, 33, 52, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  closeCoverChipText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  spreadNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(25, 33, 52, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  miniNavBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniNavBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  spreadNavText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pageZonePills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(25, 33, 52, 0.45)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  zonePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  zonePillActive: {
    backgroundColor: '#FFFFFF',
  },
  zonePillText: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 11.5,
    fontWeight: '600',
  },
  zonePillTextActive: {
    color: '#2B3654',
    fontWeight: '700',
  },

  /* --- Botones Flotantes Laterales para Cambiar Páginas --- */
  floatingPageTurnBtnLeft: {
    position: 'absolute',
    left: 8,
    top: '48%',
    zIndex: 40,
    backgroundColor: 'rgba(20, 28, 45, 0.78)',
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingPageTurnBtnRight: {
    position: 'absolute',
    right: 8,
    top: '48%',
    zIndex: 40,
    backgroundColor: 'rgba(20, 28, 45, 0.78)',
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingPageTurnText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 1,
  },

  /* --- Stage --- */
  gestureStage: {
    flex: 1,
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  floatingModeButton: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(24, 32, 50, 0.75)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingModeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
