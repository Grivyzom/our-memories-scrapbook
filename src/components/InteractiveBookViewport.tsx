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
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CameraFocusZone, PageSide, ScrapbookSpreadData } from '../types/scrapbook';
import {
  SPREAD_WIDTH,
  SPREAD_HEIGHT,
  OPEN_BOOK_TILT,
  getFullSpreadScale,
} from '../constants/defaultData';
import { ScrapbookSpread } from './ScrapbookSpread';
import { FlipRequest, PageFlipOverlay } from './PageFlipOverlay';
import { dragTurnProgress, leafFlightCurve } from './book3d/engine';

/* =========================================================================
 * Visor del libro abierto: cámara (encuadres, pinch, pan) y paso de página.
 *
 * El paso de página es interactivo: en "Ambas" un arrastre horizontal agarra
 * la hoja y ésta sigue al dedo en tiempo real (ver dragTurnProgress). Al
 * soltar decide la física: un lanzamiento rápido manda (hacia delante pasa la
 * página, hacia atrás la devuelve) y si no, basta con haber pasado la mitad.
 * Un muelle subamortiguado termina el giro con la velocidad del dedo, así un
 * gesto suave posa la hoja y uno enérgico la hace rebotar un poco en la mesa.
 *
 * Todo el arrastre y el muelle corren en el hilo de UI. Sólo hay llamadas a JS
 * en momentos sueltos —al agarrar la hoja (para montarla), al soltar (para
 * cambiar el pliego de debajo si se pasa) y al terminar—, nunca por frame.
 * ========================================================================= */
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
  /** Vista del pliego visible (para compartirlo como imagen). */
  captureRef: React.RefObject<View>;
  /** Se llama cuando la hoja ya tapa el pliego viejo: cambia el pliego activo. */
  onGoToSpread: (index: number) => void;
  navRequest?: SpreadNavRequest | null;
  /** false mientras la portada se abre o se cierra encima: no se aceptan gestos. */
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
// Sin balanceo en reposo (en ninguna plataforma): con el libro quieto no se
// anima nada, así no hay trabajo por frame ni gasto de batería sin interacción.

/* ---- Paso de página ---- */
// Con los botones: vuelo completo con despegue, caída y rebote (leafFlightCurve)
const FLIGHT_MS = 920;
// Relevo final de la hoja al pliego real de debajo
const FLIP_FADE_OUT_MS = 160;
// Velocidad (en progreso de giro por segundo) a partir de la cual un
// lanzamiento decide por sí solo, haya pasado o no la mitad (~450 px/s)
const FLING_VELOCITY = 1.2;
// Tope de la velocidad heredada del dedo: el rebote ya se limita en turnFraction
const MAX_RELEASE_VELOCITY = 6;
// Muelle al soltar, subamortiguado (ζ ≈ 0.77): sobrepasa ~2 % y la hoja rebota
// unos grados en la mesa antes de asentarse. Umbrales finos: el progreso va de 0 a 1
const TURN_SPRING = {
  damping: 20,
  stiffness: 170,
  mass: 1,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.01,
};
// Con más zoom que esto el arrastre mueve la cámara (se está mirando un detalle)
const FLIP_MAX_ZOOM = 1.1;
// Un arrastre agarra la hoja si es claramente horizontal
const FLIP_HORIZONTAL_RATIO = 1.2;

// Qué está haciendo el arrastre en curso (se decide al activarse el gesto)
const DRAG_NONE = 0;
const DRAG_CAMERA = 1;
const DRAG_FLIP = 2;

// Grosor visible de cada bloque de hojas según cuántos pliegos quedan a cada lado
const stackLayersFor = (sheets: number) => Math.min(8, 2 + sheets);

const MAX_DOTS = 9;

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
  // Escala por encima de 1: el pliego deja de cachearse como textura (se vería borroso)
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const zoomedFlag = useSharedValue(0);

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
  // La hoja que gira dibuja las páginas reales de los dos pliegos: el giro
  // empieza al instante, sin capturar nada antes (ver PageFlipOverlay)
  type ActiveFlip = FlipRequest & { target: number };
  const [flip, setFlip] = useState<ActiveFlip | null>(null);
  const flipRef = useRef<ActiveFlip | null>(null);
  const flipBusy = useRef(false);
  const flipCounter = useRef(0);
  const queuedTarget = useRef<number | null>(null);
  // Estado del giro en curso: la hoja ya se ve, se decidió pasar (null = aún
  // en el dedo) y el pliego de debajo ya es el de destino
  const flipReady = useRef(false);
  const flipCommitted = useRef<boolean | null>(null);
  const flipSwapped = useRef(false);

  // Progreso y opacidad de la hoja (hilo de UI); los mueven el dedo, el muelle o la curva
  const flipProgress = useSharedValue(0);
  const flipPresence = useSharedValue(0);
  // Copia de flipBusy legible desde el gesto sin pasar por JS
  const flipBusySV = useSharedValue(0);
  const canPrevSV = useSharedValue(activeSpreadIndex > 0 ? 1 : 0);
  const canNextSV = useSharedValue(activeSpreadIndex < totalSpreads - 1 ? 1 : 0);
  // Arrastre en curso: qué mueve (DRAG_*), hacia dónde (1 = siguiente, dedo a la
  // izquierda; -1 = anterior) y dónde estaba el dedo al activarse (el giro arranca
  // desde 0, sin salto)
  const dragMode = useSharedValue(DRAG_NONE);
  const dragDir = useSharedValue(1);
  const dragOriginX = useSharedValue(0);
  useEffect(() => {
    canPrevSV.value = activeSpreadIndex > 0 ? 1 : 0;
    canNextSV.value = activeSpreadIndex < totalSpreads - 1 ? 1 : 0;
  }, [activeSpreadIndex, totalSpreads]);

  // Refs con el estado más reciente: turnTo se invoca desde gestos y efectos
  const activeIndexRef = useRef(activeSpreadIndex);
  const spreadsRef = useRef(spreads);
  const editableRef = useRef(!!onPressPhoto);
  const onGoToSpreadRef = useRef(onGoToSpread);
  activeIndexRef.current = activeSpreadIndex;
  spreadsRef.current = spreads;
  editableRef.current = !!onPressPhoto;
  onGoToSpreadRef.current = onGoToSpread;

  // La hoja ya tapa el pliego viejo: se cambia el contenido real de debajo
  const swapUnderlying = useCallback(() => {
    const f = flipRef.current;
    if (!f || flipSwapped.current) return;
    flipSwapped.current = true;
    activeIndexRef.current = f.target;
    onGoToSpreadRef.current(f.target);
  }, []);

  const startFlip = useCallback((target: number, interactive: boolean) => {
    const all = spreadsRef.current;
    const from = activeIndexRef.current;
    if (target < 0 || target >= all.length || target === from || !all[from]) return false;
    flipBusy.current = true;
    flipBusySV.value = 1;
    flipReady.current = false;
    // Con los botones el giro se decide al empezar; con el dedo, al soltar
    flipCommitted.current = interactive ? null : true;
    flipSwapped.current = false;
    flipCounter.current += 1;
    const next: ActiveFlip = {
      id: flipCounter.current,
      dir: target > from ? 'next' : 'prev',
      from: { spread: all[from], index: from },
      to: { spread: all[target], index: target },
      editable: editableRef.current,
      interactive,
      target,
    };
    flipRef.current = next;
    setFlip(next);
    return true;
  }, []);

  const turnTo = useCallback(
    (target: number) => {
      if (flipBusy.current) {
        queuedTarget.current = target;
        return;
      }
      flipProgress.value = 0;
      flipPresence.value = 0;
      startFlip(target, false);
    },
    [startFlip]
  );

  const finishFlip = useCallback(() => {
    if (flipCommitted.current) swapUnderlying();
    flipRef.current = null;
    flipBusy.current = false;
    flipBusySV.value = 0;
    setFlip(null);
    const queued = queuedTarget.current;
    queuedTarget.current = null;
    if (queued !== null) turnTo(queued);
  }, [swapUnderlying, turnTo]);

  // La hoja ya está posada: se funde con el pliego real (idéntico) y se desmonta
  const fadeOutFlip = () => {
    'worklet';
    flipPresence.value = withTiming(0, { duration: FLIP_FADE_OUT_MS }, () => {
      runOnJS(finishFlip)();
    });
  };

  // Al soltar: el muelle continúa con la velocidad del dedo hasta 1 (pasar) o 0 (devolver)
  const settleFlip = (target: number, velocity: number) => {
    'worklet';
    const v = Math.max(-MAX_RELEASE_VELOCITY, Math.min(MAX_RELEASE_VELOCITY, velocity));
    flipProgress.value = withSpring(target, { ...TURN_SPRING, velocity: v }, () => {
      fadeOutFlip();
    });
  };

  const handleFlipReady = useCallback(() => {
    const f = flipRef.current;
    if (!f) return;
    flipReady.current = true;
    if (!f.interactive) {
      swapUnderlying();
      flipProgress.value = withTiming(1, { duration: FLIGHT_MS, easing: leafFlightCurve }, () => {
        fadeOutFlip();
      });
    } else if (flipCommitted.current) {
      // Se soltó (pasando) antes de que la hoja llegara a verse
      swapUnderlying();
    }
  }, []);

  // El dedo agarró la hoja: se monta (única llamada a JS hasta soltar)
  const beginDragFlip = useCallback(
    (delta: number) => {
      if (flipBusy.current || !startFlip(activeIndexRef.current + delta, true)) {
        // Carrera con un botón o pliego inexistente: el dedo ya no mueve nada
        dragMode.value = DRAG_NONE;
        if (!flipBusy.current) flipBusySV.value = 0;
      }
    },
    [startFlip]
  );

  // Se soltó la hoja: si pasa, el pliego de debajo cambia mientras el muelle la posa
  const settleDragFlip = useCallback(
    (commit: boolean) => {
      flipCommitted.current = commit;
      if (commit && flipReady.current) swapUnderlying();
    },
    [swapUnderlying]
  );

  /* ==================== CIERRE ==================== */
  // Antes de cerrar, la cámara vuelve al encuadre en el que la portada toma el relevo
  useEffect(() => {
    if (!closing) return;
    queuedTarget.current = null;
    applyCameraZone('full');
    const timer = setTimeout(onReadyToClose, CLOSE_CAMERA_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  const lastNavId = useRef<number | null>(null);
  useEffect(() => {
    if (!navRequest || navRequest.id === lastNavId.current) return;
    lastNavId.current = navRequest.id;
    turnTo(navRequest.index);
  }, [navRequest, turnTo]);

  /* ==================== GESTOS ==================== */
  // Un arrastre horizontal en "Ambas" agarra la hoja; cualquier otro mueve la cámara
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      const dir = e.translationX < 0 ? 1 : -1;
      const canTurn =
        swipeEnabled.value === 1 &&
        flipBusySV.value === 0 &&
        scale.value <= fullSpreadScale * FLIP_MAX_ZOOM &&
        Math.abs(e.translationX) > Math.abs(e.translationY) * FLIP_HORIZONTAL_RATIO &&
        (dir === 1 ? canNextSV.value === 1 : canPrevSV.value === 1);
      if (!canTurn) {
        dragMode.value = DRAG_CAMERA;
        return;
      }
      dragMode.value = DRAG_FLIP;
      dragDir.value = dir;
      dragOriginX.value = e.translationX;
      flipBusySV.value = 1;
      flipPresence.value = 0;
      flipProgress.value = 0;
      runOnJS(beginDragFlip)(dir);
    })
    .onUpdate((e) => {
      if (dragMode.value === DRAG_FLIP) {
        // Recorrido hacia el otro lado, en anchos de página en pantalla
        const pageW = (SPREAD_WIDTH / 2) * scale.value;
        const travel = (-(e.translationX - dragOriginX.value) * dragDir.value) / pageW;
        flipProgress.value = dragTurnProgress(travel);
        return;
      }
      if (dragMode.value !== DRAG_CAMERA) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY * 0.6;
    })
    .onEnd((e) => {
      if (dragMode.value === DRAG_FLIP) {
        dragMode.value = DRAG_NONE;
        const pageW = (SPREAD_WIDTH / 2) * scale.value;
        // Velocidad hacia el otro lado en progreso de giro por segundo
        const v = (-e.velocityX * dragDir.value) / (2 * pageW);
        const commit =
          v > FLING_VELOCITY ? true : v < -FLING_VELOCITY ? false : flipProgress.value > 0.5;
        runOnJS(settleDragFlip)(commit);
        settleFlip(commit ? 1 : 0, v);
        return;
      }
      if (dragMode.value !== DRAG_CAMERA) return;
      dragMode.value = DRAG_NONE;

      const maxOffsetX = (SPREAD_WIDTH * 0.35) * scale.value;
      const maxOffsetY = (SPREAD_HEIGHT * 0.25) * scale.value;

      const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, translateX.value));
      const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, translateY.value));

      translateX.value = withSpring(clampedX, SPRING_CONFIG);
      translateY.value = withSpring(clampedY, SPRING_CONFIG);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    })
    .onFinalize(() => {
      // Gesto interrumpido sin onEnd (lo canceló el sistema): la hoja vuelve a su sitio
      if (dragMode.value === DRAG_FLIP) {
        runOnJS(settleDragFlip)(false);
        settleFlip(0, 0);
      }
      dragMode.value = DRAG_NONE;
    });

  // Gesto Pinch-to-Zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // Con la hoja agarrada la escala no cambia: el giro depende del ancho en pantalla
      if (dragMode.value === DRAG_FLIP) return;
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

  const animatedViewportStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: CAMERA_PERSPECTIVE },
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateX: `${tiltDeg.value}deg` },
      { rotateZ: `${rotationDeg.value}deg` },
      { scale: scale.value },
    ],
  }));

  /* ==================== UI ==================== */
  const isFlipping = flip !== null;
  const canGoPrev = activeSpreadIndex > 0;
  const canGoNext = activeSpreadIndex < totalSpreads - 1;
  const showAdd = !canGoNext && !!onAddSpread;
  const isLandscape = focusZone === 'landscape90';
  const activeZone = focusZone === 'center' ? 'full' : focusZone;

  const currentSpread = spreads[activeSpreadIndex] || spreads[0];
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
            {/* Con el pliego a su tamaño o menor se cachea entero en la GPU: la
                inclinación y el encuadre sólo mueven una textura en vez de repintar
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
              />
            </View>
            {flip && (
              <PageFlipOverlay
                key={flip.id}
                request={flip}
                progress={flipProgress}
                presence={flipPresence}
                onReady={handleFlipReady}
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
