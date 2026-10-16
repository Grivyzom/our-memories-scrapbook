import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  interpolate,
  Extrapolation,
  runOnJS,
  withSpring,
  withDecay,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudBadge, WatercolorHeart } from './Stickers';
import {
  LinenTexture,
  LeatherTexture,
  PaperTexture,
  PageEdgeTexture,
} from './Textures';
import {
  DEG,
  FaceGeometry,
  LeafSpec,
  ProjectionOptions,
  leafFlightCurve,
  makeLight,
  normalizeAngle,
  projectFace as projectFace3D,
  stackZIndex,
} from './book3d/engine';
import { LeafFace } from './book3d/LeafFace';
import { FaceFrame, ProjectedFace } from './book3d/ProjectedFace';
import {
  OPEN_BOOK_TILT,
  SPREAD_HEIGHT,
  getFullSpreadScale,
} from '../constants/defaultData';
import { PAGE_WIDTH } from '../constants/blockCatalog';
import { PageSide, ScrapbookSpreadData } from '../types/scrapbook';
import { BookPageView } from './blocks/BookPageView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ocupa el área central de la pantalla manteniendo relación 3:4
const MAX_COVER_HEIGHT = SCREEN_HEIGHT * 0.6;
const MAX_COVER_WIDTH = SCREEN_WIDTH * 0.74;
export const COVER_WIDTH = Math.min(MAX_COVER_WIDTH, MAX_COVER_HEIGHT * 0.75);
export const COVER_HEIGHT = COVER_WIDTH * (4 / 3);

// Grosor del cuaderno (canto de hojas) y ancho de la franja burdeos del lomo
const BOOK_DEPTH = Math.round(COVER_WIDTH * 0.085);
const SPINE_STRIP = COVER_WIDTH * 0.125;

// Parámetros de la "cámara" 3D
const PERSPECTIVE = 2200;
const DEFAULT_YAW = -24;
const DEFAULT_PITCH = 10;
const MAX_PITCH = 38;
// Luz principal desde arriba-izquierda-frente
const PROJECTION: ProjectionOptions = {
  perspective: PERSPECTIVE,
  light: makeLight(-0.38, -0.5, 0.78),
};

// Ángulo final de la tapa abierta
const COVER_OPEN_DEG = 172;

/* ---- Hojas que despegan en abanico al abrir ("efecto grimorio") ----
 * openProgress avanza de forma lineal; cada hoja vuela en su propia ventana
 * de tiempo, escalonada respecto a la anterior. Cada hoja es una sola pieza
 * (sin tiras), así no se ven juntas al girar. */
const OPEN_LEAVES = 5;
const OPEN_LEAF_SEGMENTS = 1;
const OPEN_LEAF_START = 0.16; // la primera hoja despega cuando la tapa ya está en el aire
const OPEN_LEAF_STAGGER = 0.07;
const OPEN_LEAF_FLIGHT = 0.42;
// La tapa termina de girar aquí (fracción de openProgress)
const COVER_SWING_END = 0.55;

/* ---- Relevo con el libro abierto ----
 * Mientras se abre, el libro se desliza (el lomo pasa al centro) y se escala
 * hasta coincidir con el pliego del visor en "Ambas Páginas", con la misma
 * inclinación. Así el visor aparece justo debajo y sólo hay un libro. */
const OPEN_STAGE_SCALE = (SPREAD_HEIGHT * getFullSpreadScale(SCREEN_WIDTH)) / COVER_HEIGHT;
const ALIGN_START = 0.05;
const ALIGN_END = 0.6;

// Posiciones distribuidas del patrón de corazones estilo acuarela en la portada
const HEART_PATTERN = [
  { top: '6%', left: '12%', size: 22, rot: -14 },
  { top: '8%', left: '44%', size: 19, rot: 10 },
  { top: '6%', left: '76%', size: 23, rot: -8 },
  { top: '18%', left: '26%', size: 20, rot: 16 },
  { top: '19%', left: '62%', size: 22, rot: -18 },
  { top: '30%', left: '10%', size: 21, rot: 12 },
  { top: '29%', left: '80%', size: 20, rot: -15 },
  { top: '46%', left: '8%', size: 19, rot: -10 },
  { top: '48%', left: '83%', size: 22, rot: 14 },
  { top: '64%', left: '14%', size: 22, rot: 8 },
  { top: '66%', left: '48%', size: 18, rot: -12 },
  { top: '63%', left: '78%', size: 21, rot: 18 },
  { top: '77%', left: '28%', size: 23, rot: -16 },
  { top: '78%', left: '64%', size: 20, rot: 9 },
  { top: '89%', left: '12%', size: 21, rot: 15 },
  { top: '90%', left: '45%', size: 22, rot: -9 },
  { top: '88%', left: '77%', size: 20, rot: -14 },
];

const W = COVER_WIDTH;
const H = COVER_HEIGHT;
const D = BOOK_DEPTH;

interface CoverView {
  yaw: number;
  pitch: number;
  hinge: number;
}

/** Proyecta una cara del bloque; `z` = zIndex (0 para las caras fijas). */
const frameFor = (geo: FaceGeometry, v: CoverView, z: number, shown = true): FaceFrame => {
  'worklet';
  const p = projectFace3D(geo, v.yaw, v.pitch, PROJECTION);
  return { visible: p.visible && shown, shade: p.shade, zIndex: z, transform: p.transform };
};

// Geometría fija del bloque (no depende de la tapa)
const BACK_GEO: FaceGeometry = { center: { x: 0, y: 0, z: -D / 2 }, faceYaw: 180, faceRotX: 0 };
const TOP_GEO: FaceGeometry = { center: { x: 0, y: -H / 2, z: 0 }, faceYaw: 0, faceRotX: 90 };
const BOTTOM_GEO: FaceGeometry = { center: { x: 0, y: H / 2, z: 0 }, faceYaw: 0, faceRotX: -90 };
const FORE_EDGE_GEO: FaceGeometry = { center: { x: W / 2, y: 0, z: 0 }, faceYaw: 90, faceRotX: 0 };
const SPINE_GEO: FaceGeometry = { center: { x: -W / 2, y: 0, z: 0 }, faceYaw: -90, faceRotX: 0 };
const FIRST_PAGE_GEO: FaceGeometry = { center: { x: 0, y: 0, z: D / 2 - 1 }, faceYaw: 0, faceRotX: 0 };

// Geometría de la tapa articulada sobre el lomo (x = -W/2, z = +D/2)
const coverGeometry = (hingeDeg: number, inside: boolean): FaceGeometry => {
  'worklet';
  const a = hingeDeg * DEG;
  return {
    center: {
      x: -W / 2 + (W / 2) * Math.cos(a),
      y: 0,
      z: D / 2 + (W / 2) * Math.sin(a),
    },
    faceYaw: -hingeDeg + (inside ? 180 : 0),
    faceRotX: 0,
  };
};

/* ---- Vuelo de cada hoja del abanico (función pura de openProgress) ---- */
const leafStart = (index: number) => {
  'worklet';
  return OPEN_LEAF_START + index * OPEN_LEAF_STAGGER;
};
// Cada hoja cae algo menos tumbada que la anterior: se ve el escalonado del bloque
const leafLandAngle = (index: number) => {
  'worklet';
  return COVER_OPEN_DEG - 1.5 - index * 1.4;
};
const leafCurve = (index: number, progress: number) => {
  'worklet';
  return leafFlightCurve((progress - leafStart(index)) / OPEN_LEAF_FLIGHT);
};
const leafTheta = (index: number, progress: number) => {
  'worklet';
  return Math.min(1, leafCurve(index, progress)) * leafLandAngle(index);
};

/**
 * Orden de pintado de la tapa (posición 0) y las hojas (1..OPEN_LEAVES).
 * Usa la misma clave que `stackZIndex`, pero devuelve la posición en el orden:
 * el zIndex sólo cambia cuando dos hojas se cruzan, no en cada frame.
 */
const stackOrder = (hinge: number, progress: number): number[] => {
  'worklet';
  const ranks = OPEN_LEAVES + 1;
  const keys = [stackZIndex(hinge, hinge < 90 ? OPEN_LEAVES + 1 : 0, ranks)];
  for (let i = 0; i < OPEN_LEAVES; i++) {
    const t = leafTheta(i, progress);
    keys.push(stackZIndex(t, t < 90 ? OPEN_LEAVES - i : i + 1, ranks));
  }
  return keys.map((k) => {
    let below = 0;
    for (let j = 0; j < keys.length; j++) if (keys[j] < k) below++;
    return 10 + below;
  });
};

const CLOSED_ORDER = stackOrder(0, 0);

interface BookCover3DProps {
  openProgress: SharedValue<number>;
  onOpenBook: () => void;
  /**
   * Pliego que aparece al abrir: sus páginas se dibujan en la primera hoja y
   * en el reverso de la última hoja del abanico, así al terminar de abrir ya
   * se ve el contenido real y el relevo con el visor no cambia nada.
   */
  revealSpread?: ScrapbookSpreadData;
  revealIndex?: number;
  /** Mismo aspecto que el libro editable (huecos "Elegir foto", página en blanco). */
  editable?: boolean;
}

export const BookCover3D: React.FC<BookCover3DProps> = ({
  openProgress,
  onOpenBook,
  revealSpread,
  revealIndex = 0,
  editable = false,
}) => {
  // Orientación libre del libro controlada por el usuario
  const yaw = useSharedValue(DEFAULT_YAW - 30);
  const pitch = useSharedValue(DEFAULT_PITCH);
  const startYaw = useSharedValue(0);
  const startPitch = useSharedValue(0);

  // Pequeña animación de entrada que gira el libro hasta su ángulo de reposo
  useEffect(() => {
    yaw.value = withSpring(DEFAULT_YAW, { damping: 14, stiffness: 60 });
  }, []);

  // Arrastrar = girar el libro en 3D (con inercia en el eje horizontal)
  const panToRotate = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      cancelAnimation(yaw);
      cancelAnimation(pitch);
      startYaw.value = yaw.value;
      startPitch.value = pitch.value;
    })
    .onUpdate((e) => {
      yaw.value = startYaw.value + e.translationX * 0.45;
      pitch.value = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, startPitch.value - e.translationY * 0.3)
      );
    })
    .onEnd((e) => {
      yaw.value = withDecay({ velocity: e.velocityX * 0.45, deceleration: 0.995 });
      pitch.value = withSpring(Math.max(-28, Math.min(28, pitch.value)), {
        damping: 16,
        stiffness: 90,
      });
    });

  // Tocar = abrir el cuaderno
  const tapToOpen = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(onOpenBook)();
    });

  const gesture = Gesture.Race(panToRotate, tapToOpen);

  // Al abrir, el libro vuelve a mirar de frente mientras la tapa gira sobre el lomo:
  // acelera, frena y se pasa un poco antes de asentarse por su peso.
  // Se calcula una sola vez por frame y todas las caras lo leen.
  const view = useDerivedValue<CoverView>(() => {
    const settle = interpolate(openProgress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP);
    const swing = Math.min(1, openProgress.value / COVER_SWING_END);
    return {
      yaw: normalizeAngle(yaw.value) * settle,
      pitch: pitch.value * settle + OPEN_BOOK_TILT * (1 - settle),
      hinge: leafFlightCurve(swing) * COVER_OPEN_DEG,
    };
  });
  const viewYaw = useDerivedValue(() => view.value.yaw);
  const viewPitch = useDerivedValue(() => view.value.pitch);
  // Con el libro cerrado no hay nada que ordenar: no se recalcula al girarlo
  const order = useDerivedValue(() =>
    openProgress.value > 0 ? stackOrder(view.value.hinge, openProgress.value) : CLOSED_ORDER
  );

  const projectBack = () => {
    'worklet';
    return frameFor(BACK_GEO, view.value, 0);
  };
  const projectTop = () => {
    'worklet';
    return frameFor(TOP_GEO, view.value, 0);
  };
  const projectBottom = () => {
    'worklet';
    return frameFor(BOTTOM_GEO, view.value, 0);
  };
  const projectForeEdge = () => {
    'worklet';
    return frameFor(FORE_EDGE_GEO, view.value, 0);
  };
  const projectSpine = () => {
    'worklet';
    return frameFor(SPINE_GEO, view.value, 0);
  };
  const projectFirstPage = () => {
    'worklet';
    return frameFor(FIRST_PAGE_GEO, view.value, 0);
  };
  // La guarda interior queda oculta con el libro cerrado (si no, se ve al girarlo de espaldas)
  const projectCoverInside = () => {
    'worklet';
    const v = view.value;
    return frameFor(coverGeometry(v.hinge, true), v, order.value[0], v.hinge > 0.5);
  };
  const projectCoverFront = () => {
    'worklet';
    const v = view.value;
    return frameFor(coverGeometry(v.hinge, false), v, order.value[0]);
  };

  // Encaje con el pliego abierto: desplaza el lomo al centro y ajusta la escala
  const stageStyle = useAnimatedStyle(() => {
    const t = interpolate(openProgress.value, [ALIGN_START, ALIGN_END], [0, 1], Extrapolation.CLAMP);
    const align = t * t * (3 - 2 * t);
    const s = 1 + (OPEN_STAGE_SCALE - 1) * align;
    return {
      transform: [{ translateX: (COVER_WIDTH / 2) * OPEN_STAGE_SCALE * align }, { scale: s }],
    };
  });

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 0.12], [1, 0], Extrapolation.CLAMP),
  }));

  // Sombra proyectada en el "suelo": se ensancha según el ancho visible del libro
  const groundShadowStyle = useAnimatedStyle(() => {
    const v = view.value;
    const y = v.yaw * DEG;
    const visibleWidth = Math.abs(Math.cos(y)) * W + Math.abs(Math.sin(y)) * D;
    return {
      opacity: interpolate(openProgress.value, [0, 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: H / 2 + 14 - v.pitch * 0.9 },
        { scaleX: Math.max(0.12, visibleWidth / W) },
        { scaleY: 1 + Math.abs(v.pitch) / 40 },
      ],
    };
  });

  return (
    <View style={styles.centerContainer}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.touchArea} collapsable={false}>
          <Animated.View style={[{ width: W, height: H }, stageStyle]}>
            {/* Sombra suave proyectada sobre el fondo */}
            <Animated.View style={[styles.groundShadow, { width: W, left: 0, top: H / 2 - 12 }, groundShadowStyle]}>
              <View style={[styles.shadowBlob, { opacity: 0.1, transform: [{ scale: 1.25 }] }]} />
              <View style={[styles.shadowBlob, { opacity: 0.14, transform: [{ scale: 1.08 }] }]} />
              <View style={[styles.shadowBlob, { opacity: 0.22, transform: [{ scale: 0.9 }] }]} />
            </Animated.View>

            {/* ---------- Contratapa ---------- */}
            <ProjectedFace project={projectBack} style={centered(W, H)} {...FACE}>
              <BackCoverArt />
            </ProjectedFace>

            {/* ---------- Cantos de hojas (superior, inferior y lateral) ---------- */}
            <ProjectedFace project={projectTop} style={[styles.edgeHorizontal, centered(W, D)]} {...FACE}>
              <PageEdgeTexture direction="horizontal" lines={10} seed={3} />
            </ProjectedFace>
            <ProjectedFace project={projectBottom} style={[styles.edgeHorizontal, centered(W, D)]} {...FACE}>
              <PageEdgeTexture direction="horizontal" lines={10} seed={4} />
            </ProjectedFace>
            <ProjectedFace project={projectForeEdge} style={[styles.edgeVertical, centered(D, H)]} {...FACE}>
              <PageEdgeTexture direction="vertical" lines={10} seed={5} />
            </ProjectedFace>

            {/* ---------- Primera hoja (visible al levantar la tapa) ---------- */}
            <ProjectedFace
              project={projectFirstPage}
              style={[styles.firstPage, centered(W - 4, H - 4)]}
              contentStyle={styles.firstPageContent}
              {...FACE}
            >
              <PaperTexture seed={31} />
              {revealSpread && (
                <RevealedPage
                  spread={revealSpread}
                  side="right"
                  spreadIndex={revealIndex}
                  editable={editable}
                  faceWidth={W - 4}
                  faceHeight={H - 4}
                />
              )}
            </ProjectedFace>

            {/* ---------- Hojas que despegan en abanico al abrir ---------- */}
            {Array.from({ length: OPEN_LEAVES }, (_, i) => (
              <OpeningLeaf
                key={i}
                index={i}
                openProgress={openProgress}
                order={order}
                yaw={viewYaw}
                pitch={viewPitch}
                // La última en caer queda encima del bloque izquierdo: lleva la página izquierda
                backContent={
                  i === OPEN_LEAVES - 1 && revealSpread ? (
                    <>
                      <PaperTexture seed={31} />
                      <RevealedPage
                        spread={revealSpread}
                        side="left"
                        spreadIndex={revealIndex}
                        editable={editable}
                        faceWidth={W - 4}
                        faceHeight={H - 4}
                      />
                    </>
                  ) : null
                }
              />
            ))}

            {/* ---------- Lomo ---------- */}
            <ProjectedFace project={projectSpine} style={centered(D + 1, H)} {...FACE}>
              <SpineArt />
            </ProjectedFace>

            {/* ---------- Tapa: guarda interior ---------- */}
            <ProjectedFace project={projectCoverInside} style={centered(W, H)} {...FACE}>
              <EndpaperArt />
            </ProjectedFace>

            {/* ---------- Tapa: portada exterior ---------- */}
            <ProjectedFace project={projectCoverFront} style={centered(W, H)} {...FACE}>
              <FrontCoverArt />
            </ProjectedFace>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Animated.Text style={[styles.tapHintText, hintStyle]}>
        Arrastra para girar • Toca para abrir el cuaderno ✨
      </Animated.Text>
    </View>
  );
};

// Arte de las caras cacheado en la GPU; la sombra va aparte (ver ProjectedFace)
const FACE = { rasterize: true, shadeColor: '#12060A' } as const;

const centered = (w: number, h: number) => ({
  width: w,
  height: h,
  left: (W - w) / 2,
  top: (H - h) / 2,
});

/* ======================= HOJA DEL EFECTO GRIMORIO ======================= */

const LEAF_THICKNESS = 1.6;

interface OpeningLeafProps {
  index: number;
  openProgress: SharedValue<number>;
  order: SharedValue<number[]>;
  yaw: SharedValue<number>;
  pitch: SharedValue<number>;
  backContent?: React.ReactNode;
}

const OpeningLeaf = React.memo(function OpeningLeaf({
  index,
  openProgress,
  order,
  yaw,
  pitch,
  backContent,
}: OpeningLeafProps) {
  // Hojas apiladas bajo la tapa: cada una un poco más hundida en el bloque
  const spec = useMemo<LeafSpec>(
    () => ({
      hinge: { x: -W / 2, y: 0, z: D / 2 - 1.5 - index * (LEAF_THICKNESS + 0.4) },
      length: W - 4,
      segments: OPEN_LEAF_SEGMENTS,
      thickness: LEAF_THICKNESS,
    }),
    [index]
  );
  const curve = useDerivedValue(() => leafCurve(index, openProgress.value));
  const theta = useDerivedValue(() => Math.min(1, curve.value) * leafLandAngle(index));
  // Hoja de una pieza: la curvatura la sugiere el sombreado, no la geometría
  const bend = useSharedValue(0);
  const zIndex = useDerivedValue(() => order.value[index + 1]);
  // Ocultas mientras el libro está cerrado (quedan bajo la tapa): no cuestan nada
  const presence = useDerivedValue<number>(() => (openProgress.value > 0.02 ? 1 : 0));

  const faceProps = {
    spec,
    theta,
    bend,
    zIndex,
    presence,
    yaw,
    pitch,
    projection: PROJECTION,
    stageWidth: W,
    stageHeight: H,
    faceHeight: H - 4,
  };

  return (
    <>
      {Array.from({ length: OPEN_LEAF_SEGMENTS }, (_, s) => (
        <LeafFace key={`f${s}`} {...faceProps} kind="front" seg={s} style={styles.leafFront} />
      ))}
      {Array.from({ length: OPEN_LEAF_SEGMENTS }, (_, s) => (
        <LeafFace key={`b${s}`} {...faceProps} kind="back" seg={s} style={styles.leafBack}>
          {backContent}
        </LeafFace>
      ))}
      <LeafFace {...faceProps} kind="edge" style={styles.leafEdge} />
    </>
  );
});

/* ===================== PÁGINAS REALES DURANTE LA APERTURA ===================== */

const noop = () => {};

/** Una página del pliego, escalada al tamaño de la cara de la portada. */
const RevealedPage: React.FC<{
  spread: ScrapbookSpreadData;
  side: PageSide;
  spreadIndex: number;
  editable: boolean;
  faceWidth: number;
  faceHeight: number;
}> = React.memo(({ spread, side, spreadIndex, editable, faceWidth, faceHeight }) => (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      width: PAGE_WIDTH,
      height: SPREAD_HEIGHT,
      left: (faceWidth - PAGE_WIDTH) / 2,
      top: (faceHeight - SPREAD_HEIGHT) / 2,
      transform: [{ scaleX: faceWidth / PAGE_WIDTH }, { scaleY: faceHeight / SPREAD_HEIGHT }],
    }}
  >
    <BookPageView
      page={spread[side]}
      side={side}
      pageNumber={spreadIndex * 2 + (side === 'left' ? 1 : 2)}
      onPressPhoto={editable ? noop : undefined}
      onPressEmpty={editable ? noop : undefined}
    />
  </View>
));

/* ============================== ARTE DE CADA CARA ============================== */

const FrontCoverArt: React.FC = () => (
  <View style={styles.coverBody}>
    {/* Franja de cuero burdeos junto al lomo */}
    <View style={styles.burgundySpine}>
      <LeatherTexture seed={23} />
      <View style={styles.spineHighlight} />
      <View style={styles.spineCrease} />
    </View>

    {/* Cuerpo de portada en tela de lino color crema */}
    <View style={styles.creamCover}>
      <LinenTexture seed={11} />
      <View style={styles.paperInnerBorder} />

      {HEART_PATTERN.map((item, index) => (
        <View
          key={index}
          style={[styles.heartPosition, { top: item.top as any, left: item.left as any }]}
        >
          <WatercolorHeart size={item.size} rotation={item.rot} />
        </View>
      ))}

      <View style={styles.centerBadgeWrapper}>
        <CloudBadge width={236} height={130} />
        <View style={styles.badgeTextOverlay}>
          <Text style={styles.cursiveCoverTitle}>Nuestros Recuerdos</Text>
          <Text style={styles.cursiveCoverSubtitle}>Our Memories</Text>
        </View>
      </View>
    </View>

    {/* Brillo satinado de la tela */}
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.06)']}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const BackCoverArt: React.FC = () => (
  <View style={styles.coverBody}>
    <View style={styles.creamCover}>
      <LinenTexture seed={12} />
      <View style={styles.backHeartWrapper}>
        <WatercolorHeart size={30} rotation={-6} />
        <Text style={styles.backCoverText}>hecho con amor</Text>
      </View>
    </View>
    {/* Al mirar la contratapa, la franja del lomo queda a la derecha */}
    <View style={styles.burgundySpine}>
      <LeatherTexture seed={24} />
      <View style={styles.spineCrease} />
    </View>
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(0,0,0,0.04)', 'rgba(255,255,255,0.12)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const SpineArt: React.FC = () => (
  <View style={styles.spineFace}>
    <LeatherTexture seed={25} intensity={1.2} />
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(0,0,0,0.28)', 'rgba(255,255,255,0.14)', 'rgba(0,0,0,0.3)']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={[styles.goldBand, { top: '8%' }]} />
    <View style={[styles.goldBand, { top: '9.4%' }]} />
    <View style={[styles.goldBand, { bottom: '9.4%' }]} />
    <View style={[styles.goldBand, { bottom: '8%' }]} />
    <View style={[styles.spineTitleWrapper, { width: COVER_HEIGHT * 0.7, left: (BOOK_DEPTH - COVER_HEIGHT * 0.7) / 2 }]}>
      <Text style={styles.spineTitle} numberOfLines={1}>
        Nuestros Recuerdos ♥
      </Text>
    </View>
  </View>
);

const EndpaperArt: React.FC = () => (
  <View style={styles.endpaper}>
    <PaperTexture seed={41} fiberColor="#9B4A50" />
    {HEART_PATTERN.filter((_, i) => i % 3 === 0).map((item, index) => (
      <View
        key={index}
        style={[styles.heartPosition, { top: item.top as any, left: item.left as any, opacity: 0.35 }]}
      >
        <WatercolorHeart size={item.size * 0.8} rotation={item.rot} />
      </View>
    ))}
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(0,0,0,0)', 'rgba(60,10,14,0.18)']}
      start={{ x: 0.75, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const styles = StyleSheet.create({
  // Mismo tamaño que el área táctil: el centro del libro coincide con el del escenario
  centerContainer: {
    width: SCREEN_WIDTH,
    height: COVER_HEIGHT + 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchArea: {
    width: SCREEN_WIDTH,
    height: COVER_HEIGHT + 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groundShadow: {
    position: 'absolute',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowBlob: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  edgeHorizontal: {
    backgroundColor: '#F3ECDC',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#7A1A20',
  },
  edgeVertical: {
    backgroundColor: '#F3ECDC',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#7A1A20',
  },
  leafFront: {
    backgroundColor: '#FCF9F0',
  },
  leafBack: {
    backgroundColor: '#F6F0E2',
  },
  leafEdge: {
    backgroundColor: '#EADFC8',
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderColor: '#B9A887',
  },
  firstPage: {
    backgroundColor: '#FDFBF2',
  },
  firstPageContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FDFBF0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  burgundySpine: {
    width: SPINE_STRIP,
    height: '100%',
    backgroundColor: '#8B1E24',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spineHighlight: {
    width: 5,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    marginLeft: 5,
  },
  spineCrease: {
    width: 3,
    height: '100%',
    backgroundColor: 'rgba(45, 5, 8, 0.45)',
  },
  creamCover: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FBF6E6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  paperInnerBorder: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 10,
    right: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(214, 199, 178, 0.55)',
  },
  heartPosition: {
    position: 'absolute',
  },
  centerBadgeWrapper: {
    width: 236,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cursiveCoverTitle: {
    fontSize: 23,
    color: '#6E1419',
    fontStyle: 'italic',
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      android: 'serif',
      default: 'serif',
    }),
    letterSpacing: 0.4,
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    textAlign: 'center',
  },
  cursiveCoverSubtitle: {
    fontSize: 10.5,
    color: '#8E2830',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    opacity: 0.85,
  },
  backHeartWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  backCoverText: {
    color: '#8E2830',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  spineFace: {
    flex: 1,
    backgroundColor: '#8B1E24',
  },
  goldBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: '#D9B46A',
    opacity: 0.85,
  },
  spineTitleWrapper: {
    position: 'absolute',
    top: '50%',
    height: 18,
    marginTop: -9,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  spineTitle: {
    color: '#E8C987',
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  endpaper: {
    flex: 1,
    backgroundColor: '#F6E3E1',
  },
  tapHintText: {
    position: 'absolute',
    bottom: 4,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
