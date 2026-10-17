import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SPREAD_HEIGHT, SPREAD_WIDTH } from '../constants/defaultData';
import {
  LeafSpec,
  ProjectionOptions,
  makeLight,
  stackZIndex,
  turnFraction,
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
 *
 * La hoja no se anima a sí misma: dibuja un progreso compartido (`progress`)
 * que mueve quien la pidió — el dedo mientras se arrastra, un muelle al
 * soltar o una curva temporal al usar los botones (ver InteractiveBookViewport).
 * Así un mismo giro puede empezar con el dedo, cancelarse a medias o terminar
 * con la inercia del lanzamiento, todo en el hilo de UI y sin pasar por React.
 *
 * Las luces que cambian con el giro (curvatura y brillo especular) van fuera
 * de la textura cacheada de cada cara: si no, Android repintaría la página
 * entera en cada frame del giro.
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
  /** Lo guía el dedo (puede cancelarse) en vez de una animación de principio a fin. */
  interactive: boolean;
}

// Escenario = tapa exterior del pliego (ver ScrapbookSpread.outerBookCoverBase)
export const STAGE_WIDTH = SPREAD_WIDTH + 28;
export const STAGE_HEIGHT = SPREAD_HEIGHT + 24;
const PAGE_INSET_X = (STAGE_WIDTH - SPREAD_WIDTH) / 2;
const PAGE_INSET_Y = (STAGE_HEIGHT - SPREAD_HEIGHT) / 2;
const PAGE_WIDTH = SPREAD_WIDTH / 2;
const SPINE_X = STAGE_WIDTH / 2;

const LEAF_COUNT = 1;
// Una sola cara por lado: sin juntas visibles
const SEGMENTS = 1;
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
  /** Progreso del paso de página (0 = sin pasar, 1 = pasada; ver turnFraction). */
  progress: SharedValue<number>;
  /** Opacidad del conjunto; 0 = oculto (no se proyecta nada). */
  presence: SharedValue<number>;
  /** El giro ya se ve y cubre el pliego viejo: se puede cambiar el de debajo. */
  onReady: () => void;
}

export const PageFlipOverlay: React.FC<PageFlipOverlayProps> = ({
  request,
  progress,
  presence,
  onReady,
}) => {
  const { dir, from, to, editable } = request;
  const loaded = useRef(new Set<string>());
  const readyFired = useRef(false);

  const markReady = useCallback(() => {
    if (readyFired.current) return;
    readyFired.current = true;
    presence.value = 1;
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
        progress={progress}
        presence={presence}
        // Anverso = página derecha del lomo, reverso = izquierda
        front={dir === 'next' ? from : to}
        back={dir === 'next' ? to : from}
        editable={editable}
        onFrontLoaded={dir === 'next' ? leafLoaded : undefined}
        onBackLoaded={dir === 'next' ? undefined : leafLoaded}
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
  progress: SharedValue<number>;
  presence: SharedValue<number>;
  front: FlipSpread;
  back: FlipSpread;
  editable: boolean;
  onFrontLoaded?: () => void;
  onBackLoaded?: () => void;
}

const FlipLeaf: React.FC<FlipLeafProps> = ({
  index,
  dir,
  progress,
  presence,
  front,
  back,
  editable,
  onFrontLoaded,
  onBackLoaded,
}) => {
  // El sobrepaso del muelle se refleja: la hoja rebota en la mesa (ver turnFraction)
  const theta = useDerivedValue(() => {
    const c = turnFraction(progress.value);
    return dir === 'next' ? 180 * c : 180 * (1 - c);
  });
  // Hoja rígida: la curvatura la ponen la luz y el brillo que la recorren (LeafLight)
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
        overlay={<LeafLight theta={theta} fromSpineLeft={isFront} faceWidth={w} />}
      >
        <PageSlice
          page={isFront ? front : back}
          side={isFront ? 'right' : 'left'}
          editable={editable}
          faceLeft={centerX - w / 2}
          onLoaded={isFront ? onFrontLoaded : onBackLoaded}
        />
        <SpineFoldShade fromSpineLeft={isFront} />
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

/** Sombra del pliegue junto al lomo: fija, como en el pliego (va dentro de la textura). */
const SpineFoldShade: React.FC<{ fromSpineLeft: boolean }> = ({ fromSpineLeft }) => (
  <LinearGradient
    pointerEvents="none"
    colors={['rgba(70,45,20,0.22)', 'rgba(70,45,20,0)']}
    start={{ x: fromSpineLeft ? 0 : 1, y: 0.5 }}
    end={{ x: fromSpineLeft ? 0.16 : 0.84, y: 0.5 }}
    style={StyleSheet.absoluteFill}
  />
);

// Ancho del brillo especular respecto a la cara
const GLINT_WIDTH = 0.42;

/**
 * Luz de la hoja en el aire (fuera de la textura cacheada):
 * - Curvatura: sombra junto al lomo, brillo donde el papel se abomba y un leve
 *   oscurecido en el canto. Crece con la altura de la hoja, así tumbada encaja
 *   al píxel con el pliego de debajo.
 * - Brillo especular: una franja de luz que recorre la hoja mientras gira.
 *   Al levantarse, el canto libre se retrasa por el aire y el abombamiento (y
 *   con él el reflejo) se desplaza del lomo hacia el canto; al caer, vuelve.
 *   Es lo que hace que el ojo lea una superficie curva y no un cartón plano.
 */
const LeafLight: React.FC<{
  theta: SharedValue<number>;
  fromSpineLeft: boolean;
  faceWidth: number;
}> = ({ theta, fromSpineLeft, faceWidth }) => {
  const glintW = faceWidth * GLINT_WIDTH;
  const curlStyle = useAnimatedStyle(() => ({
    opacity: Math.round(Math.sin((theta.value * Math.PI) / 180) * 100) / 100,
  }));
  const glintStyle = useAnimatedStyle(() => {
    const rad = (theta.value * Math.PI) / 180;
    const lift = Math.sin(rad);
    // Distancia del centro del brillo al lomo (fracción de la cara)
    const fromSpine = 0.3 + 0.42 * lift * lift;
    const center = fromSpineLeft ? fromSpine * faceWidth : (1 - fromSpine) * faceWidth;
    return {
      opacity: Math.round(lift * 100) / 100,
      transform: [{ translateX: Math.round((center - glintW / 2) * 2) / 2 }],
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, curlStyle]}>
        <LinearGradient
          colors={[
            'rgba(60,38,16,0.30)',
            'rgba(60,38,16,0.06)',
            'rgba(255,255,255,0.10)',
            'rgba(255,255,255,0.02)',
            'rgba(60,38,16,0.16)',
          ]}
          locations={[0, 0.18, 0.5, 0.8, 1]}
          start={{ x: fromSpineLeft ? 0 : 1, y: 0.5 }}
          end={{ x: fromSpineLeft ? 1 : 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.glint, { width: glintW }, glintStyle]}
      >
        <LinearGradient
          colors={['rgba(255,252,240,0)', 'rgba(255,252,240,0.2)', 'rgba(255,252,240,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
};

/* ========================= SOMBRA PROYECTADA ========================= */

/*
 * Una hoja en el aire oscurece la página sobre la que vuela: deja ver el "aire"
 * entre hojas. Su ancho sigue a la proyección de la hoja sobre la mesa y es más
 * densa cerca de la mesa (sombra de contacto) que con la hoja en vertical,
 * donde la luz la difumina.
 */
const LeafCastShadow: React.FC<{ theta: SharedValue<number>; presence: SharedValue<number> }> = ({
  theta,
  presence,
}) => {
  const style = useAnimatedStyle(() => {
    const t = theta.value;
    const rad = (t * Math.PI) / 180;
    const right = t < 90;
    const lift = Math.sin(rad);
    const f = 0.18 + 0.82 * Math.abs(Math.cos(rad));
    // Pico de densidad hacia los 35° de altura y difuminado en vertical
    const density = lift * (1.25 - 0.45 * lift);
    return {
      opacity: Math.round(0.22 * density * presence.value * 100) / 100,
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
  glint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  leafEdge: {
    backgroundColor: '#E9DFC9',
    borderLeftWidth: 0.8,
    borderRightWidth: 0.8,
    borderColor: '#B9A887',
  },
});
