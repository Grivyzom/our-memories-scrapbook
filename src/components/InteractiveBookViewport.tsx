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
  runOnJS,
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
  ScrapbookSpreadData,
} from '../types/scrapbook';
import {
  SPREAD_WIDTH,
  SPREAD_HEIGHT,
  OPEN_BOOK_TILT,
  getFullSpreadScale,
} from '../constants/defaultData';
import { ScrapbookSpread } from './ScrapbookSpread';
import { FlipRequest, PageFlipOverlay } from './PageFlipOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Petición externa de navegación (p. ej. al añadir un pliego nuevo). */
export interface SpreadNavRequest {
  id: number;
  index: number;
}

interface InteractiveBookViewportProps {
  spreads: ScrapbookSpreadData[];
  activeSpreadIndex: number;
  onSelectPhotoSlot: (slot: PhotoSlotKey) => void;
  onCloseBook: () => void;
  captureRef: React.RefObject<View>;
  /** Se llama cuando la hoja ya tapa el pliego viejo: cambia el pliego activo. */
  onGoToSpread: (index: number) => void;
  navRequest?: SpreadNavRequest | null;
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

// Deslizar horizontalmente (en "Ambas") pasa de página
const SWIPE_MIN_DISTANCE = 60;
const SWIPE_MIN_VELOCITY = 350;

// Tiempo para que el pliego de destino se pinte antes de capturarlo
const PRELOAD_SETTLE_MS = 220;

// Grosor visible de cada bloque de hojas según cuántos pliegos quedan a cada lado
const stackLayersFor = (sheets: number) => Math.min(8, 2 + sheets);

const MAX_DOTS = 9;

const captureSpread = async (ref: React.RefObject<View>): Promise<string | null> => {
  try {
    if (!ref.current) return null;
    return await captureViewRef(ref, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
  } catch {
    return null;
  }
};

const ZONES: { zone: CameraFocusZone; label: string }[] = [
  { zone: 'left', label: 'Izq.' },
  { zone: 'full', label: 'Ambas' },
  { zone: 'right', label: 'Der.' },
];

export const InteractiveBookViewport: React.FC<InteractiveBookViewportProps> = ({
  spreads,
  activeSpreadIndex,
  onSelectPhotoSlot,
  onCloseBook,
  captureRef,
  onGoToSpread,
  navRequest,
}) => {
  // Arranca en "Ambas Páginas": es el encuadre en el que termina la apertura de la portada
  const [focusZone, setFocusZone] = useState<CameraFocusZone>('full');
  const totalSpreads = spreads.length;

  // Escalas calculadas para adaptarse a cualquier smartphone
  const singlePageScale = Math.min(
    (SCREEN_WIDTH * 0.94) / (SPREAD_WIDTH * 0.52),
    (SCREEN_HEIGHT * 0.58) / SPREAD_HEIGHT
  );
  const fullSpreadScale = getFullSpreadScale(SCREEN_WIDTH);
  const rotatedLandscapeScale = Math.min(
    (SCREEN_HEIGHT * 0.62) / (SPREAD_WIDTH + 28),
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
  const swipeEnabled = useSharedValue(1);
  // Balanceo muy sutil en reposo: el libro "respira" sobre la mesa
  const idleSway = useSharedValue(0);

  useEffect(() => {
    idleSway.value = withRepeat(withTiming(1, { duration: 7200, easing: Easing.linear }), -1, false);
  }, []);

  const applyCameraZone = (zone: CameraFocusZone) => {
    setFocusZone(zone);
    tiltDeg.value = withSpring(TILT_BY_ZONE[zone], SPRING_CONFIG);
    swipeEnabled.value = zone === 'full' || zone === 'center' ? 1 : 0;

    let targetScale = fullSpreadScale;
    let targetX = 0;
    let targetRotation = 0;
    if (zone === 'left' || zone === 'right') {
      targetScale = singlePageScale;
      targetX = (zone === 'left' ? 1 : -1) * SPREAD_WIDTH * 0.23 * singlePageScale;
    } else if (zone === 'landscape90') {
      targetScale = rotatedLandscapeScale;
      targetRotation = 90;
    }

    scale.value = withSpring(targetScale, SPRING_CONFIG);
    savedScale.value = targetScale;
    translateX.value = withSpring(targetX, SPRING_CONFIG);
    savedTranslateX.value = targetX;
    translateY.value = withSpring(0, SPRING_CONFIG);
    savedTranslateY.value = 0;
    rotationDeg.value = withSpring(targetRotation, SPRING_CONFIG);
  };

  /* ==================== PASO DE PÁGINA ==================== */
  const [flip, setFlip] = useState<(FlipRequest & { target: number }) | null>(null);
  const [preloadIndex, setPreloadIndex] = useState<number | null>(null);
  const preloadRef = useRef<View>(null);
  const preloadResolver = useRef<((uri: string | null) => void) | null>(null);
  const flipBusy = useRef(false);
  const flipCounter = useRef(0);
  const queuedTarget = useRef<number | null>(null);

  // Refs con el estado más reciente: turnTo se invoca desde gestos y efectos
  const activeIndexRef = useRef(activeSpreadIndex);
  const totalRef = useRef(totalSpreads);
  activeIndexRef.current = activeSpreadIndex;
  totalRef.current = totalSpreads;

  // Captura el pliego de destino, renderizado oculto bajo el actual
  useEffect(() => {
    if (preloadIndex === null || !preloadResolver.current) return;
    const timer = setTimeout(async () => {
      const uri = await captureSpread(preloadRef);
      preloadResolver.current?.(uri);
      preloadResolver.current = null;
    }, PRELOAD_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [preloadIndex]);

  const turnTo = useCallback(
    async (target: number) => {
      if (target < 0 || target >= totalRef.current) return;
      if (flipBusy.current) {
        queuedTarget.current = target;
        return;
      }
      const from = activeIndexRef.current;
      if (target === from) return;
      flipBusy.current = true;

      const oldUri = await captureSpread(captureRef);
      const newUri = await new Promise<string | null>((resolve) => {
        preloadResolver.current = resolve;
        setPreloadIndex(target);
      });

      flipCounter.current += 1;
      setFlip({
        id: flipCounter.current,
        dir: target > from ? 'next' : 'prev',
        oldUri,
        newUri,
        target,
      });
    },
    [captureRef]
  );

  const swipeTurn = useCallback(
    (delta: number) => turnTo(activeIndexRef.current + delta),
    [turnTo]
  );

  // La hoja ya tapa el pliego viejo: cambiamos el contenido real debajo
  const handleFlipReady = useCallback(() => {
    if (flip) onGoToSpread(flip.target);
  }, [flip, onGoToSpread]);

  const handleFlipFinished = useCallback(() => {
    flipBusy.current = false;
    setFlip(null);
    setPreloadIndex(null);
    const queued = queuedTarget.current;
    queuedTarget.current = null;
    if (queued !== null) turnTo(queued);
  }, [turnTo]);

  const lastNavId = useRef<number | null>(null);
  useEffect(() => {
    if (!navRequest || navRequest.id === lastNavId.current) return;
    lastNavId.current = navRequest.id;
    turnTo(navRequest.index);
  }, [navRequest, turnTo]);

  /* ==================== GESTOS ==================== */
  // Pan con amortiguación; en "Ambas" un deslizamiento rápido pasa de página
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY * 0.6;
    })
    .onEnd((e) => {
      const isSwipe =
        swipeEnabled.value === 1 &&
        Math.abs(e.translationX) > SWIPE_MIN_DISTANCE &&
        Math.abs(e.velocityX) > SWIPE_MIN_VELOCITY &&
        Math.abs(e.translationX) > Math.abs(e.translationY) * 1.4;
      if (isSwipe) {
        translateX.value = withSpring(savedTranslateX.value, SPRING_CONFIG);
        translateY.value = withSpring(savedTranslateY.value, SPRING_CONFIG);
        runOnJS(swipeTurn)(e.translationX < 0 ? 1 : -1);
        return;
      }

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

  /* ==================== UI ==================== */
  const isFlipping = flip !== null;
  const canGoPrev = activeSpreadIndex > 0;
  const canGoNext = activeSpreadIndex < totalSpreads - 1;
  const isLandscape = focusZone === 'landscape90';
  const activeZone = focusZone === 'center' ? 'full' : focusZone;

  const currentSpread = spreads[activeSpreadIndex] || spreads[0];
  const preloadSpread = preloadIndex !== null ? spreads[preloadIndex] : null;
  const pageA = activeSpreadIndex * 2 + 1;
  const pageB = activeSpreadIndex * 2 + 2;

  // Puntos de progreso: ventana deslizante si hay muchos pliegos
  const dotStart = Math.max(
    0,
    Math.min(activeSpreadIndex - Math.floor(MAX_DOTS / 2), totalSpreads - MAX_DOTS)
  );
  const dotCount = Math.min(MAX_DOTS, totalSpreads);

  return (
    <View style={styles.viewportWrapper}>
      {/* ==================== BARRA SUPERIOR ==================== */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onCloseBook}
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          accessibilityLabel="Cerrar el cuaderno"
          hitSlop={6}
        >
          <Ionicons name="close" size={20} color="#FFF" />
        </Pressable>

        <View style={styles.segmented}>
          {ZONES.map(({ zone, label }) => {
            const active = activeZone === zone;
            return (
              <Pressable
                key={zone}
                onPress={() => applyCameraZone(zone)}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => applyCameraZone(isLandscape ? 'full' : 'landscape90')}
          style={({ pressed }) => [
            styles.roundButton,
            isLandscape && styles.roundButtonActive,
            pressed && styles.pressed,
          ]}
          accessibilityLabel={isLandscape ? 'Volver a vista normal' : 'Girar pliego 90 grados'}
          hitSlop={6}
        >
          <Ionicons
            name="phone-landscape-outline"
            size={18}
            color={isLandscape ? '#2B3654' : '#FFF'}
          />
        </Pressable>
      </View>

      {/* ==================== LIBRO ==================== */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureStage}>
          <Animated.View style={animatedViewportStyle}>
            {/* Pliego de destino, oculto bajo el actual, para capturarlo antes de girar */}
            {preloadSpread && preloadIndex !== null && (
              <View
                ref={preloadRef}
                collapsable={false}
                pointerEvents="none"
                style={styles.preloadLayer}
              >
                <ScrapbookSpread
                  photos={preloadSpread.photos}
                  onSelectPhotoSlot={() => {}}
                  spreadIndex={preloadIndex}
                  leftStackLayers={stackLayersFor(preloadIndex)}
                  rightStackLayers={stackLayersFor(totalSpreads - 1 - preloadIndex)}
                />
              </View>
            )}
            <View ref={captureRef} collapsable={false}>
              <ScrapbookSpread
                photos={currentSpread.photos}
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
                onReady={handleFlipReady}
                onFinished={handleFlipFinished}
              />
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* ==================== NAVEGACIÓN INFERIOR ==================== */}
      <View style={styles.bottomNav}>
        <Pressable
          onPress={() => turnTo(activeSpreadIndex - 1)}
          disabled={!canGoPrev || isFlipping}
          style={({ pressed }) => [
            styles.navButton,
            (!canGoPrev || isFlipping) && styles.navButtonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Pliego anterior"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </Pressable>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorTitle}>
            Pliego {activeSpreadIndex + 1} de {totalSpreads}
          </Text>
          <Text style={styles.pageIndicatorSub}>
            Págs. {pageA}–{pageB}
          </Text>
          <View style={styles.dotsRow}>
            {Array.from({ length: dotCount }, (_, i) => {
              const index = dotStart + i;
              const active = index === activeSpreadIndex;
              return (
                <Pressable
                  key={index}
                  onPress={() => turnTo(index)}
                  hitSlop={5}
                  accessibilityLabel={`Ir al pliego ${index + 1}`}
                >
                  <View style={[styles.dot, active && styles.dotActive]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => turnTo(activeSpreadIndex + 1)}
          disabled={!canGoNext || isFlipping}
          style={({ pressed }) => [
            styles.navButton,
            (!canGoNext || isFlipping) && styles.navButtonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Pliego siguiente"
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
};

const GLASS = 'rgba(20, 27, 46, 0.55)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.18)';

const styles = StyleSheet.create({
  viewportWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* --- Barra superior --- */
  topBar: {
    position: 'absolute',
    top: 4,
    zIndex: 30,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: GLASS,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  segment: {
    minWidth: 62,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 17,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#2B3654',
    fontWeight: '700',
  },

  /* --- Escenario --- */
  gestureStage: {
    flex: 1,
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  preloadLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },

  /* --- Navegación inferior --- */
  bottomNav: {
    position: 'absolute',
    bottom: 6,
    zIndex: 30,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  pageIndicator: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  pageIndicatorTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pageIndicatorSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#FFFFFF',
  },
});
