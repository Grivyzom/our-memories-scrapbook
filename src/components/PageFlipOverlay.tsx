import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SPREAD_HEIGHT, SPREAD_WIDTH } from '../constants/defaultData';
import {
  LeafSpec,
  ProjectionOptions,
  leafFlightCurve,
  makeLight,
  stackZIndex,
} from './book3d/engine';
import { LeafFace, LeafFaceKind, leafFaceWidth } from './book3d/LeafFace';
import { SpreadPaper } from './ScrapbookSpread';
import { PageSide, ScrapbookSpreadData } from '../types/scrapbook';

/* =========================================================================
 * Paso de página: una hoja con grosor real despega del lomo, gira en el aire
 * y cae con un pequeño rebote al otro lado.
 *
 * La hoja es una sola pieza: antes se dividía en tiras con su propio ángulo y
 * sombra, y en pleno giro se veían líneas entre ellas (una hoja "cuarteada").
 * La curvatura del papel se sugiere con un degradado de luz continuo que se
 * intensifica mientras la hoja está en el aire.
 *
 * Las caras de la hoja y las mitades fijas dibujan las páginas reales (el
 * mismo papel que el pliego de debajo, ver SpreadPaper). Antes se capturaban
 * en imagen los dos pliegos antes de girar: en Android cada captura tardaba
 * cientos de milisegundos y el giro arrancaba con retraso.
 * ========================================================================= */

export type FlipDirection = 'next' | 'prev';

/** Un pliego tal como se ve en el libro (contenido e índice para los nº de página). */
export interface FlipSpread {
  spread: ScrapbookSpreadData;
  index: number;
}

export interface FlipRequest {
  id: number;
  dir: FlipDirection;
  /** Pliego que se abandona. */
  from: FlipSpread;
  /** Pliego de destino. */
  to: FlipSpread;
  /** Libro editable: los huecos vacíos se dibujan con su invitación ("Elegir foto"). */
  editable: boolean;
}

// Escenario = tapa exterior del pliego (ver ScrapbookSpread.outerBookCoverBase)
export const STAGE_WIDTH = SPREAD_WIDTH + 28;
export const STAGE_HEIGHT = SPREAD_HEIGHT + 24;
const PAGE_INSET_X = (STAGE_WIDTH - SPREAD_WIDTH) / 2;
const PAGE_INSET_Y = (STAGE_HEIGHT - SPREAD_HEIGHT) / 2;
const PAGE_WIDTH = SPREAD_WIDTH / 2;
const SPINE_X = STAGE_WIDTH / 2;

// Coreografía
const LEAF_COUNT = 1;
// Una sola cara por lado: sin juntas visibles
const SEGMENTS = 1;
const STAGGER_MS = 80;
const FLIGHT_MS = 920;
// Espera máxima a las fotos del pliego que se abandona (ya están en memoria: suele ser 1–2 frames)
const READY_TIMEOUT_MS = 250;

const LEAF_SPEC: LeafSpec = {
  hinge: { x: 0, y: 0, z: 0 },
  length: PAGE_WIDTH - 2,
  segments: SEGMENTS,
  thickness: 4,
};

const LIGHT = makeLight(-0.3, -0.45, 0.84);
const PROJECTION: ProjectionOptions = {
  perspective: 3000,
  light: LIGHT,
  // Una hoja tumbada no se sombrea: así encaja exactamente con el pliego de debajo
  shadeBaseline: LIGHT.z,
  shadeGain: 0.55,
  shadeMax: 0.3,
};

const PAPER_FRONT = '#FCF8EE';
const PAPER_BACK = '#F7F1E3';

interface PageFlipOverlayProps {
  request: FlipRequest;
  /** La animación cubre ya el pliego viejo: se puede cambiar el contenido de debajo. */
  onReady: () => void;
  onFinished: () => void;
}

export const PageFlipOverlay: React.FC<PageFlipOverlayProps> = ({
  request,
  onReady,
  onFinished,
}) => {
  const { dir, from, to, editable } = request;
  const [running, setRunning] = useState(false);
  const presence = useSharedValue(0);
  const loaded = useRef(new Set<string>());
  const readyFired = useRef(false);

  const markReady = useCallback(() => {
    if (readyFired.current) return;
    readyFired.current = true;
    presence.value = 1;
    setRunning(true);
    onReady();
  }, [onReady, presence]);

  useEffect(() => {
    const timer = setTimeout(markReady, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  /*
   * Sólo se espera a lo que tapa el pliego viejo cuando debajo se cambia al
   * nuevo: la mitad fija y la cara de la hoja con la página que se abandona.
   * Las páginas nuevas sólo asoman ya en pleno giro, así que cargan mientras.
   */
  const handleOldLoaded = useCallback(
    (key: string) => {
      loaded.current.add(key);
      if (loaded.current.size >= 2) markReady();
    },
    [markReady]
  );
  const staticLoaded = useCallback(() => handleOldLoaded('static'), [handleOldLoaded]);
  const leafLoaded = useCallback(() => handleOldLoaded('leaf'), [handleOldLoaded]);

  const handleLastLanded = useCallback(() => {
    presence.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) runOnJS(onFinished)();
    });
  }, [onFinished, presence]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: presence.value }));

  // La página vieja que sigue visible en el lado donde aterriza la hoja, y la
  // nueva que queda al descubierto en el lado del que despega
  const landingSide: PageSide = dir === 'next' ? 'left' : 'right';
  const liftSide: PageSide = dir === 'next' ? 'right' : 'left';
  const leftOf = (side: PageSide) => (side === 'left' ? PAGE_INSET_X : SPINE_X);

  return (
    <View pointerEvents="none" style={styles.stage}>
      {/* Bajo la hoja: la página nueva que va apareciendo (tapa el cambio de debajo) */}
      <Animated.View style={[styles.half, styles.revealHalf, halfFrame(leftOf(liftSide)), coverStyle]}>
        <PageSlice page={to} side={liftSide} editable={editable} faceLeft={leftOf(liftSide)} />
      </Animated.View>

      <Animated.View style={[styles.half, styles.staticHalf, halfFrame(leftOf(landingSide)), coverStyle]}>
        <PageSlice
          page={from}
          side={landingSide}
          editable={editable}
          faceLeft={leftOf(landingSide)}
          onLoaded={staticLoaded}
        />
      </Animated.View>

      <FlipLeaf
        index={0}
        dir={dir}
        running={running}
        presence={presence}
        // Anverso = página derecha del lomo, reverso = izquierda
        front={dir === 'next' ? from : to}
        back={dir === 'next' ? to : from}
        editable={editable}
        onFrontLoaded={dir === 'next' ? leafLoaded : undefined}
        onBackLoaded={dir === 'next' ? undefined : leafLoaded}
        onLanded={handleLastLanded}
      />
    </View>
  );
};

const halfFrame = (left: number) => ({
  left,
  top: PAGE_INSET_Y,
  width: PAGE_WIDTH,
  height: SPREAD_HEIGHT,
});

/* ================================ HOJA ================================ */

interface FlipLeafProps {
  index: number;
  dir: FlipDirection;
  running: boolean;
  presence: SharedValue<number>;
  front: FlipSpread;
  back: FlipSpread;
  editable: boolean;
  onFrontLoaded?: () => void;
  onBackLoaded?: () => void;
  onLanded?: () => void;
}

const FlipLeaf: React.FC<FlipLeafProps> = ({
  index,
  dir,
  running,
  presence,
  front,
  back,
  editable,
  onFrontLoaded,
  onBackLoaded,
  onLanded,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!running) return;
    progress.value = withDelay(
      index * STAGGER_MS,
      withTiming(1, { duration: FLIGHT_MS, easing: Easing.linear }, (finished) => {
        if (finished && onLanded) runOnJS(onLanded)();
      })
    );
  }, [running]);

  const curve = useDerivedValue(() => leafFlightCurve(progress.value));
  const theta = useDerivedValue(() => {
    const c = Math.min(1, curve.value);
    return dir === 'next' ? 180 * c : 180 * (1 - c);
  });
  // Hoja rígida: la curvatura la pone el degradado de luz (LeafCurlShade)
  const bend = useSharedValue(0);
  const zIndex = useDerivedValue(() => {
    // En el lado de salida manda la primera hoja; en el de llegada, la última en caer
    const onStartSide = dir === 'next' ? theta.value < 90 : theta.value > 90;
    const rank = onStartSide ? LEAF_COUNT - 1 - index : index;
    const z = stackZIndex(theta.value, rank, LEAF_COUNT);
    // Con una sola hoja basta saber si está tumbada (bajo la sombra) o en el aire:
    // así el zIndex no cambia en cada frame y no se reordenan las vistas nativas
    if (LEAF_COUNT === 1) return z < 10 + LEAF_COUNT + 1 ? z : 10 + LEAF_COUNT + 1;
    return z;
  });

  const faceProps = {
    spec: LEAF_SPEC,
    theta,
    bend,
    zIndex,
    presence,
    projection: PROJECTION,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
    faceHeight: SPREAD_HEIGHT,
  };

  const renderSegment = (kind: Exclude<LeafFaceKind, 'edge'>, seg: number) => {
    const isFront = kind === 'front';
    const w = leafFaceWidth(LEAF_SPEC, kind);
    const segLen = LEAF_SPEC.length / SEGMENTS;
    const centerX = isFront ? SPINE_X + (seg + 0.5) * segLen : SPINE_X - (seg + 0.5) * segLen;
    return (
      <LeafFace
        key={`${kind}-${seg}`}
        {...faceProps}
        kind={kind}
        seg={seg}
        // La página no cambia durante el giro: se mueve como una textura
        rasterize
        style={{ backgroundColor: isFront ? PAPER_FRONT : PAPER_BACK }}
      >
        <PageSlice
          page={isFront ? front : back}
          side={isFront ? 'right' : 'left'}
          editable={editable}
          faceLeft={centerX - w / 2}
          onLoaded={isFront ? onFrontLoaded : onBackLoaded}
        />
        <LeafCurlShade theta={theta} fromSpineLeft={isFront} />
      </LeafFace>
    );
  };

  return (
    <>
      <LeafCastShadow theta={theta} presence={presence} />
      {Array.from({ length: SEGMENTS }, (_, s) => renderSegment('front', s))}
      {Array.from({ length: SEGMENTS }, (_, s) => renderSegment('back', s))}
      <LeafFace {...faceProps} kind="edge" style={styles.leafEdge} />
    </>
  );
};

/* ======================= CURVATURA DEL PAPEL ======================= */

/**
 * Luz continua sobre toda la cara: sombra junto al lomo, brillo en el centro
 * (donde el papel se abomba) y un leve oscurecido en el canto. Su intensidad
 * crece con la altura de la hoja, así tumbada encaja con el pliego de debajo.
 */
const LeafCurlShade: React.FC<{ theta: SharedValue<number>; fromSpineLeft: boolean }> = ({
  theta,
  fromSpineLeft,
}) => {
  const style = useAnimatedStyle(() => ({
    opacity: Math.round(Math.sin((theta.value * Math.PI) / 180) * 100) / 100,
  }));
  return (
    <>
      {/* Sombra del pliegue junto al lomo: siempre presente, como en el pliego */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(70,45,20,0.22)', 'rgba(70,45,20,0)']}
        start={{ x: fromSpineLeft ? 0 : 1, y: 0.5 }}
        end={{ x: fromSpineLeft ? 0.16 : 0.84, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
        <LinearGradient
          colors={[
            'rgba(60,38,16,0.30)',
            'rgba(60,38,16,0.06)',
            'rgba(255,255,255,0.16)',
            'rgba(255,255,255,0.04)',
            'rgba(60,38,16,0.14)',
          ]}
          locations={[0, 0.18, 0.5, 0.78, 1]}
          start={{ x: fromSpineLeft ? 0 : 1, y: 0.5 }}
          end={{ x: fromSpineLeft ? 1 : 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
};

/* ========================= SOMBRA PROYECTADA ========================= */

// Una hoja en el aire oscurece la página sobre la que vuela: deja ver el "aire" entre hojas
const LeafCastShadow: React.FC<{ theta: SharedValue<number>; presence: SharedValue<number> }> = ({
  theta,
  presence,
}) => {
  const style = useAnimatedStyle(() => {
    const t = theta.value;
    const rad = (t * Math.PI) / 180;
    const right = t < 90;
    const f = 0.18 + 0.82 * Math.abs(Math.cos(rad));
    return {
      opacity: 0.2 * Math.sin(rad) * presence.value,
      transform: [
        { translateX: right ? (f * PAGE_WIDTH) / 2 - PAGE_WIDTH / 2 : (-f * PAGE_WIDTH) / 2 - PAGE_WIDTH / 2 },
        { scaleX: right ? f : -f },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.castShadow,
        { left: SPINE_X, top: PAGE_INSET_Y, width: PAGE_WIDTH, height: SPREAD_HEIGHT },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(30,18,8,0.9)', 'rgba(30,18,8,0.35)', 'rgba(30,18,8,0)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

/* ========================= PÁGINA DE LA HOJA ========================= */

const noop = () => {};

/**
 * Una página del pliego recortada a la cara que la muestra: se dibuja el papel
 * entero del pliego (sólo con los componentes de esa página) desplazado para
 * que coincida al píxel con el pliego de debajo. `faceLeft` es la x de la cara
 * en el escenario; la cara empieza a la altura del papel.
 */
const PageSlice: React.FC<{
  page: FlipSpread;
  side: PageSide;
  editable: boolean;
  faceLeft: number;
  onLoaded?: () => void;
}> = React.memo(({ page, side, editable, faceLeft, onLoaded }) => (
  <View style={[styles.slice, { left: PAGE_INSET_X - faceLeft }]}>
    <SpreadPaper
      spread={page.spread}
      spreadIndex={page.index}
      only={side}
      // Mismo aspecto que el libro editable (huecos "Elegir foto", página en blanco)
      onPressPhoto={editable ? noop : undefined}
      onPressEmptyPage={editable ? noop : undefined}
      onImagesLoaded={onLoaded}
    />
  </View>
));

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  },
  half: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: PAPER_FRONT,
  },
  revealHalf: {
    zIndex: 0,
  },
  staticHalf: {
    zIndex: 1,
  },
  slice: {
    position: 'absolute',
    top: 0,
    width: SPREAD_WIDTH,
    height: SPREAD_HEIGHT,
  },
  castShadow: {
    position: 'absolute',
    // Por encima de las hojas tumbadas (zIndex 10..10+LEAF_COUNT-1) y por debajo de las que vuelan
    zIndex: 10 + LEAF_COUNT,
  },
  leafEdge: {
    backgroundColor: '#E9DFC9',
    borderLeftWidth: 0.8,
    borderRightWidth: 0.8,
    borderColor: '#B9A887',
  },
});
