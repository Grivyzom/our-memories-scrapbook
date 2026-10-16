import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PixelRatio,
  Pressable,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { captureRef as captureViewRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { CameraFocusZone, PageSide, ScrapbookSpreadData } from '../types/scrapbook';
import {
  SPREAD_WIDTH,
  SPREAD_HEIGHT,
  OPEN_BOOK_TILT,
  getFullSpreadScale,
} from '../constants/defaultData';
import { ScrapbookSpread } from './ScrapbookSpread';
import { FlipRequest, PageFlipOverlay, STAGE_HEIGHT, STAGE_WIDTH } from './PageFlipOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Petición externa de navegación (p. ej. al añadir un pliego nuevo). */
export interface SpreadNavRequest {
  id: number;
  index: number;
}

interface InteractiveBookViewportProps {
  spreads: ScrapbookSpreadData[];
  activeSpreadIndex: number;
  /** Toca un hueco de foto (sin callback el libro es de sólo lectura). */
  onPressPhoto?: (side: PageSide, blockId: string, photoIndex: number) => void;
  /** Toca una página en blanco (abre el editor). */
  onPressEmptyPage?: (side: PageSide) => void;
  onCloseBook: () => void;
  captureRef: React.RefObject<View>;
  /** Se llama cuando la hoja ya tapa el pliego viejo: cambia el pliego activo. */
  onGoToSpread: (index: number) => void;
  navRequest?: SpreadNavRequest | null;
  /**
   * false mientras la portada se abre o se cierra encima: no se precargan
   * pliegos (no compite con la animación) y no se aceptan gestos.
   */
  interactive: boolean;
  /** Se va a cerrar el libro: la cámara vuelve al encuadre de la portada. */
  closing: boolean;
  /** La cámara ya está en el encuadre de la portada: se puede cerrar la tapa. */
  onReadyToClose: () => void;
  /** En el último pliego, "siguiente" pasa a añadir uno nuevo (sólo libro editable). */
  onAddSpread?: () => void;
}

// Lo que tarda la cámara en volver a "Ambas" antes de que baje la tapa
const CLOSE_CAMERA_MS = 380;

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

// Espera máxima a que carguen las fotos del pliego de destino antes de capturarlo
const PRELOAD_MAX_WAIT_MS = 900;
// Tras un rato sin tocar nada se capturan por adelantado el pliego actual y sus vecinos
const PREFETCH_IDLE_MS = 1200;
const MAX_CACHED_CAPTURES = 6;

// Grosor visible de cada bloque de hojas según cuántos pliegos quedan a cada lado
const stackLayersFor = (sheets: number) => Math.min(8, 2 + sheets);

const MAX_DOTS = 9;

/**
 * Las capturas sólo se ven durante el giro, al tamaño en pantalla del pliego:
 * se toman a esa resolución (con margen) en vez de a la del pliego completo,
 * que en un móvil son ~2600 px de ancho y tardan mucho en codificarse.
 */
const captureResolutionFor = (scale: number) =>
  Math.min(1, Math.max(0.35, Math.abs(scale) * 1.3));

const captureSpread = async (
  ref: React.RefObject<View>,
  resolution: number
): Promise<string | null> => {
  try {
    if (!ref.current) return null;
    const px = PixelRatio.get() * resolution;
    return await captureViewRef(ref, {
      format: 'jpg',
      quality: 0.92,
      result: 'tmpfile',
      width: Math.round(STAGE_WIDTH * px),
      height: Math.round(STAGE_HEIGHT * px),
    });
  } catch {
    return null;
  }
};

const noop = () => {};

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

interface CachedCapture {
  key: string;
  uri: string;
  resolution: number;
}

const ZONES: { zone: CameraFocusZone; label: string }[] = [
  { zone: 'left', label: 'Izq.' },
  { zone: 'full', label: 'Ambas' },
  { zone: 'right', label: 'Der.' },
];

export const InteractiveBookViewport: React.FC<InteractiveBookViewportProps> = ({
  spreads,
  activeSpreadIndex,
  onPressPhoto,
  onPressEmptyPage,
  onCloseBook,
  captureRef,
  onGoToSpread,
  navRequest,
  interactive,
  closing,
  onReadyToClose,
  onAddSpread,
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
  // Escala por encima de 1: el pliego deja de cachearse como textura (se vería borroso)
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const zoomedFlag = useSharedValue(0);

  useEffect(() => {
    if (isZoomedIn) {
      // Sin textura cacheada el balanceo obligaría a repintar todo el pliego en cada frame
      cancelAnimation(idleSway);
      idleSway.value = withTiming(Math.round(idleSway.value), { duration: 400 });
      return;
    }
    idleSway.value = 0;
    idleSway.value = withRepeat(withTiming(1, { duration: 7200, easing: Easing.linear }), -1, false);
  }, [isZoomedIn]);

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
    zoomedFlag.value = targetScale > 1 ? 1 : 0;
    setIsZoomedIn(targetScale > 1);
    translateX.value = withSpring(targetX, SPRING_CONFIG);
    savedTranslateX.value = targetX;
    translateY.value = withSpring(0, SPRING_CONFIG);
    savedTranslateY.value = 0;
    rotationDeg.value = withSpring(targetRotation, SPRING_CONFIG);
  };

  /* ==================== PASO DE PÁGINA ==================== */
  const [flip, setFlip] = useState<(FlipRequest & { target: number }) | null>(null);
  // `id` distingue dos peticiones seguidas del mismo pliego
  const [preload, setPreload] = useState<{ index: number; id: number } | null>(null);
  const preloadIndex = preload ? preload.index : null;
  const preloadCounter = useRef(0);
  const preloadRef = useRef<View>(null);
  const preloadResolver = useRef<(() => void) | null>(null);
  const preloadReady = useRef<(() => void) | null>(null);
  const preloadLoaded = useRef(false);
  const preloadChain = useRef<Promise<unknown>>(Promise.resolve());
  const inflight = useRef(new Map<string, Promise<string | null>>());
  const flipBusy = useRef(false);
  const flipCounter = useRef(0);
  const queuedTarget = useRef<number | null>(null);

  // Refs con el estado más reciente: turnTo se invoca desde gestos y efectos
  const activeIndexRef = useRef(activeSpreadIndex);
  const totalRef = useRef(totalSpreads);
  const spreadsRef = useRef(spreads);
  activeIndexRef.current = activeSpreadIndex;
  totalRef.current = totalSpreads;
  spreadsRef.current = spreads;

  /* ---- Caché de capturas: girar a un pliego ya capturado empieza al instante ---- */
  const captureCache = useRef(new Map<number, CachedCapture>());
  // Clave del pliego que hay ahora en pantalla cuando todas sus fotos han cargado
  const liveLoadedKey = useRef<string | null>(null);

  // Todo lo que cambia el dibujo de un pliego (fotos, nº de hojas a cada lado)
  const keyFor = (index: number) => {
    const sp = spreadsRef.current[index];
    return sp
      ? `${sp.id}|${spreadsRef.current.length}|${JSON.stringify(sp.left)}|${JSON.stringify(sp.right)}`
      : '';
  };
  const cachedCapture = (index: number, resolution: number) => {
    const hit = captureCache.current.get(index);
    return hit && hit.key === keyFor(index) && hit.resolution >= resolution ? hit.uri : null;
  };
  const storeCapture = (index: number, key: string, uri: string | null, resolution: number) => {
    if (!uri || key !== keyFor(index)) return;
    const cache = captureCache.current;
    cache.delete(index);
    cache.set(index, { key, uri, resolution });
    // Se descartan las más antiguas
    while (cache.size > MAX_CACHED_CAPTURES) cache.delete(cache.keys().next().value!);
  };
  const currentResolution = () => captureResolutionFor(scale.value);

  // Captura el pliego de destino, renderizado oculto bajo el actual, en cuanto sus fotos cargan
  useEffect(() => {
    if (!preload) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // Dos frames para que lo cargado llegue a pintarse antes de capturarlo
      nextFrame()
        .then(nextFrame)
        .then(() => {
          const resolve = preloadResolver.current;
          preloadResolver.current = null;
          resolve?.();
        });
    };
    const timer = setTimeout(finish, PRELOAD_MAX_WAIT_MS);
    preloadReady.current = finish;
    if (preloadLoaded.current) finish();
    return () => {
      done = true;
      clearTimeout(timer);
      preloadReady.current = null;
    };
  }, [preload]);
  const handlePreloadImagesLoaded = useCallback(() => {
    preloadLoaded.current = true;
    preloadReady.current?.();
  }, []);

  /** Renderiza un pliego oculto y lo captura (en serie, uno cada vez). */
  const renderAndCapture = useCallback((index: number, resolution: number) => {
    const key = keyFor(index);
    const inflightKey = `${index}|${key}|${resolution}`;
    const pending = inflight.current.get(inflightKey);
    if (pending) return pending;

    const run = () =>
      new Promise<string | null>((resolve) => {
        preloadLoaded.current = false;
        preloadResolver.current = async () => {
          const uri = await captureSpread(preloadRef, resolution);
          storeCapture(index, key, uri, resolution);
          resolve(uri);
        };
        preloadCounter.current += 1;
        setPreload({ index, id: preloadCounter.current });
      });
    const promise = preloadChain.current.then(run);
    preloadChain.current = promise.catch(() => null);
    inflight.current.set(inflightKey, promise);
    promise.finally(() => inflight.current.delete(inflightKey));
    return promise;
  }, []);

  /** Captura del pliego visible: de la caché si sigue igual, si no en el momento. */
  const captureLive = async (resolution: number) => {
    const index = activeIndexRef.current;
    const cached = cachedCapture(index, resolution);
    if (cached) return cached;
    const key = keyFor(index);
    const uri = await captureSpread(captureRef, resolution);
    // Sólo se guarda si estaban todas las fotos (si no, se vería incompleta en el próximo giro)
    if (liveLoadedKey.current === key) storeCapture(index, key, uri, resolution);
    return uri;
  };

  const handleLiveImagesLoaded = useCallback(() => {
    liveLoadedKey.current = keyFor(activeIndexRef.current);
  }, []);

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

      const resolution = currentResolution();
      const oldUri = await captureLive(resolution);
      const newUri =
        cachedCapture(target, resolution) ?? (await renderAndCapture(target, resolution));

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

  // En reposo se preparan las capturas del pliego actual y de sus vecinos
  useEffect(() => {
    if (flip || !interactive) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const index = activeIndexRef.current;
      const resolution = currentResolution();
      const stillIdle = () => !cancelled && !flipBusy.current;
      if (!stillIdle()) return;
      if (liveLoadedKey.current === keyFor(index)) await captureLive(resolution);
      for (const neighbor of [index + 1, index - 1]) {
        if (!stillIdle()) return;
        if (neighbor < 0 || neighbor >= totalRef.current) continue;
        if (!cachedCapture(neighbor, resolution)) await renderAndCapture(neighbor, resolution);
      }
      // El pliego oculto ya no hace falta (salvo que un giro lo esté usando)
      if (!flipBusy.current) setPreload(null);
    }, PREFETCH_IDLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSpreadIndex, spreads, flip, focusZone, interactive]);

  /* ==================== CIERRE ==================== */
  // Antes de cerrar, la cámara vuelve al encuadre en el que la portada toma el relevo
  useEffect(() => {
    if (!closing) return;
    queuedTarget.current = null;
    applyCameraZone('full');
    const timer = setTimeout(onReadyToClose, CLOSE_CAMERA_MS);
    return () => clearTimeout(timer);
  }, [closing]);

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
    setPreload(null);
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
      const zoomed = scale.value > 1 ? 1 : 0;
      if (zoomed !== zoomedFlag.value) {
        zoomedFlag.value = zoomed;
        runOnJS(setIsZoomedIn)(zoomed === 1);
      }
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
  const showAdd = !canGoNext && !!onAddSpread;
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
    <View style={styles.viewportWrapper} pointerEvents={interactive ? 'auto' : 'none'}>
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
                  spread={preloadSpread}
                  onPressPhoto={onPressPhoto ? noop : undefined}
                  onPressEmptyPage={onPressEmptyPage ? noop : undefined}
                  spreadIndex={preloadIndex}
                  leftStackLayers={stackLayersFor(preloadIndex)}
                  rightStackLayers={stackLayersFor(totalSpreads - 1 - preloadIndex)}
                  onImagesLoaded={handlePreloadImagesLoaded}
                />
              </View>
            )}
            {/* Con el pliego a su tamaño o menor se cachea entero en la GPU: el balanceo,
                la inclinación y el encuadre sólo mueven una textura en vez de repintar
                fotos, SVG y sombras. Con zoom > 1 se pinta en vivo para no perder nitidez. */}
            <View
              ref={captureRef}
              collapsable={false}
              renderToHardwareTextureAndroid={!isZoomedIn}
              shouldRasterizeIOS={!isZoomedIn}
            >
              <ScrapbookSpread
                spread={currentSpread}
                onPressPhoto={onPressPhoto}
                onPressEmptyPage={onPressEmptyPage}
                spreadIndex={activeSpreadIndex}
                leftStackLayers={stackLayersFor(activeSpreadIndex)}
                rightStackLayers={stackLayersFor(totalSpreads - 1 - activeSpreadIndex)}
                onImagesLoaded={handleLiveImagesLoaded}
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
          onPress={showAdd ? onAddSpread : () => turnTo(activeSpreadIndex + 1)}
          disabled={(!canGoNext && !showAdd) || isFlipping}
          style={({ pressed }) => [
            styles.navButton,
            showAdd && styles.navButtonAdd,
            ((!canGoNext && !showAdd) || isFlipping) && styles.navButtonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityLabel={showAdd ? 'Añadir un pliego al final' : 'Pliego siguiente'}
          hitSlop={8}
        >
          <Ionicons
            name={showAdd ? 'add' : 'chevron-forward'}
            size={showAdd ? 26 : 22}
            color={showAdd ? '#2B3654' : '#FFF'}
          />
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
  navButtonAdd: {
    backgroundColor: '#FFFFFF',
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
