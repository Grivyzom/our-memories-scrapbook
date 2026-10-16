import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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
  leafBendFromProgress,
  leafFlightCurve,
  makeLight,
  stackZIndex,
} from './book3d/engine';
import { LeafFace, LeafFaceKind, leafFaceWidth } from './book3d/LeafFace';

/* =========================================================================
 * Paso de página: una hoja con grosor real despega del lomo, se curva en el
 * aire y cae con un pequeño rebote al otro lado.
 *
 * El pliego de destino se captura antes de empezar, así que durante todo el
 * giro se ven sus imágenes: debajo de la hoja que se levanta y en su reverso.
 * Las capturas (react-native-view-shot) se recortan en tiras, una por segmento.
 * ========================================================================= */

export type FlipDirection = 'next' | 'prev';

export interface FlipRequest {
  id: number;
  dir: FlipDirection;
  /** Captura del pliego que se abandona (null si no se pudo capturar). */
  oldUri: string | null;
  /** Captura del pliego de destino (null si no se pudo capturar). */
  newUri: string | null;
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
const SEGMENTS = 6;
const STAGGER_MS = 80;
const FLIGHT_MS = 920;
const MAX_BEND = 54;
const BOUNCE_GAIN = 300;
const READY_TIMEOUT_MS = 450;

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
  const { dir, oldUri, newUri } = request;
  const [running, setRunning] = useState(false);
  const presence = useSharedValue(0);
  const loadedCount = useRef(0);
  const readyFired = useRef(false);

  // Imágenes que deben estar decodificadas antes de empezar: tiras del anverso y
  // del reverso de la hoja + la mitad estática que queda en el lado de llegada
  const expectedLoads = (oldUri ? SEGMENTS + 1 : 0) + (newUri ? SEGMENTS : 0);

  const markReady = useCallback(() => {
    if (readyFired.current) return;
    readyFired.current = true;
    presence.value = 1;
    setRunning(true);
    onReady();
  }, [onReady, presence]);

  useEffect(() => {
    if (expectedLoads === 0) {
      markReady();
      return;
    }
    const timer = setTimeout(markReady, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleImageLoaded = useCallback(() => {
    loadedCount.current += 1;
    if (loadedCount.current >= expectedLoads) markReady();
  }, [expectedLoads, markReady]);

  const handleLastLanded = useCallback(() => {
    presence.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) runOnJS(onFinished)();
    });
  }, [onFinished, presence]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: presence.value }));

  // La mitad del pliego viejo que sigue visible en el lado donde aterrizan las hojas
  const coverLeft = dir === 'next' ? PAGE_INSET_X : SPINE_X;

  return (
    <View pointerEvents="none" style={styles.stage}>
      {oldUri && (
        <Animated.View
          style={[
            styles.staticHalf,
            { left: coverLeft, top: PAGE_INSET_Y, width: PAGE_WIDTH, height: SPREAD_HEIGHT },
            coverStyle,
          ]}
        >
          <SnapshotSlice uri={oldUri} faceLeft={coverLeft} faceTop={PAGE_INSET_Y} onLoadEnd={handleImageLoaded} />
        </Animated.View>
      )}

      {Array.from({ length: LEAF_COUNT }, (_, i) => {
        const isFirst = i === 0;
        const isLast = i === LEAF_COUNT - 1;
        const frontUri = dir === 'next' ? (isFirst ? oldUri : null) : isLast ? newUri : null;
        const backUri = dir === 'next' ? (isLast ? newUri : null) : isFirst ? oldUri : null;
        return (
          <FlipLeaf
            key={i}
            index={i}
            dir={dir}
            running={running}
            presence={presence}
            frontUri={frontUri}
            backUri={backUri}
            onImageLoaded={handleImageLoaded}
            onLanded={isLast ? handleLastLanded : undefined}
          />
        );
      })}
    </View>
  );
};

/* ================================ HOJA ================================ */

interface FlipLeafProps {
  index: number;
  dir: FlipDirection;
  running: boolean;
  presence: SharedValue<number>;
  frontUri: string | null;
  backUri: string | null;
  onImageLoaded?: () => void;
  onLanded?: () => void;
}

const FlipLeaf: React.FC<FlipLeafProps> = ({
  index,
  dir,
  running,
  presence,
  frontUri,
  backUri,
  onImageLoaded,
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

  const sign = dir === 'next' ? 1 : -1;
  // Cada hoja es algo más rígida que la anterior: el abanico no es uniforme
  const maxBend = MAX_BEND * (1 - index * 0.08);

  const curve = useDerivedValue(() => leafFlightCurve(progress.value));
  const theta = useDerivedValue(() => {
    const c = Math.min(1, curve.value);
    return dir === 'next' ? 180 * c : 180 * (1 - c);
  });
  const bend = useDerivedValue(() => sign * leafBendFromProgress(curve.value, maxBend, BOUNCE_GAIN));
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
    const uri = kind === 'front' ? frontUri : backUri;
    const w = leafFaceWidth(LEAF_SPEC, kind);
    const segLen = LEAF_SPEC.length / SEGMENTS;
    const centerX = kind === 'front' ? SPINE_X + (seg + 0.5) * segLen : SPINE_X - (seg + 0.5) * segLen;
    const faceLeft = centerX - w / 2;
    return (
      <LeafFace
        key={`${kind}-${seg}`}
        {...faceProps}
        kind={kind}
        seg={seg}
        style={{ backgroundColor: kind === 'front' ? PAPER_FRONT : PAPER_BACK }}
      >
        {uri && (
          <SnapshotSlice
            uri={uri}
            faceLeft={faceLeft}
            faceTop={PAGE_INSET_Y}
            onLoadEnd={onImageLoaded}
          />
        )}
        {seg === 0 && (
          // Sombra del pliegue junto al lomo
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(70,45,20,0.22)', 'rgba(70,45,20,0)']}
            start={{ x: kind === 'front' ? 0 : 1, y: 0.5 }}
            end={{ x: kind === 'front' ? 1 : 0, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        )}
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

/* ======================= RECORTE DE LA CAPTURA ======================= */

const SnapshotSlice: React.FC<{
  uri: string;
  faceLeft: number;
  faceTop: number;
  onLoadEnd?: () => void;
}> = ({ uri, faceLeft, faceTop, onLoadEnd }) => (
  <Image
    source={{ uri }}
    onLoadEnd={onLoadEnd}
    fadeDuration={0}
    style={{
      position: 'absolute',
      left: -faceLeft,
      top: -faceTop,
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
    }}
  />
);

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  },
  staticHalf: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: PAPER_FRONT,
    zIndex: 1,
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
