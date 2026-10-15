import React, { useEffect } from 'react';
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
  interpolate,
  Extrapolation,
  runOnJS,
  withSpring,
  withDecay,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CloudBadgeSVG, WatercolorHeartSVG } from './StickersAndVectors';
import {
  LinenTexture,
  LeatherTexture,
  PaperTexture,
  PageEdgeTexture,
} from './Textures';

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
const DEG = Math.PI / 180;
const DEFAULT_YAW = -24;
const DEFAULT_PITCH = 10;
const MAX_PITCH = 38;
// Luz principal desde arriba-izquierda-frente (normalizada)
const LIGHT = (() => {
  const l = { x: -0.38, y: -0.5, z: 0.78 };
  const len = Math.hypot(l.x, l.y, l.z);
  return { x: l.x / len, y: l.y / len, z: l.z / len };
})();

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

/* =========================================================================
 * Motor 3D mínimo: React Native no soporta translateZ, así que cada cara del
 * libro se proyecta manualmente. Para cada cara calculamos su centro en el
 * espacio 3D (tras aplicar yaw/pitch), lo proyectamos con la perspectiva y
 * aplicamos la misma rotación a la vista. Las caras que miran hacia atrás se
 * ocultan (back-face culling) y se sombrean según su orientación a la luz.
 * ========================================================================= */

type Vec3 = { x: number; y: number; z: number };

const rotY = (v: Vec3, rad: number): Vec3 => {
  'worklet';
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
};

const rotX = (v: Vec3, rad: number): Vec3 => {
  'worklet';
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};

const normalizeAngle = (deg: number) => {
  'worklet';
  return ((((deg % 360) + 540) % 360) - 180);
};

interface FaceGeometry {
  center: Vec3;
  faceYaw: number; // rotación propia de la cara sobre Y (grados)
  faceRotX: number; // rotación propia de la cara sobre X (grados)
}

const projectFace = (geo: FaceGeometry, yaw: number, pitch: number) => {
  'worklet';
  const wc = rotX(rotY(geo.center, yaw * DEG), pitch * DEG);
  const normal = rotX(
    rotY(rotX({ x: 0, y: 0, z: 1 }, geo.faceRotX * DEG), (yaw + geo.faceYaw) * DEG),
    pitch * DEG
  );
  const k = PERSPECTIVE / (PERSPECTIVE - wc.z);
  const lambert = Math.max(0, normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z);
  return {
    visible: normal.z > 0.012,
    shade: Math.min(0.62, (1 - lambert) * 0.55),
    transform: [
      { translateX: wc.x * k },
      { translateY: wc.y * k },
      { perspective: PERSPECTIVE },
      { scale: k },
      { rotateX: `${pitch}deg` },
      { rotateY: `${yaw + geo.faceYaw}deg` },
      { rotateX: `${geo.faceRotX}deg` },
    ],
  };
};

interface BookCover3DProps {
  openProgress: SharedValue<number>;
  onOpenBook: () => void;
}

export const BookCover3D: React.FC<BookCover3DProps> = ({
  openProgress,
  onOpenBook,
}) => {
  const W = COVER_WIDTH;
  const H = COVER_HEIGHT;
  const D = BOOK_DEPTH;

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

  // Al abrir, el libro vuelve a mirar de frente mientras la tapa gira sobre el lomo
  const getView = () => {
    'worklet';
    const settle = interpolate(openProgress.value, [0, 0.55], [1, 0], Extrapolation.CLAMP);
    return {
      yaw: normalizeAngle(yaw.value) * settle,
      pitch: pitch.value * settle,
      hinge: interpolate(openProgress.value, [0, 1], [0, 172], Extrapolation.CLAMP),
    };
  };

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

  const useFace = (geometry: (hinge: number) => FaceGeometry) => {
    const faceStyle = useAnimatedStyle(() => {
      const v = getView();
      const p = projectFace(geometry(v.hinge), v.yaw, v.pitch);
      return { opacity: p.visible ? 1 : 0, transform: p.transform as any };
    });
    const shadeStyle = useAnimatedStyle(() => {
      const v = getView();
      return { opacity: projectFace(geometry(v.hinge), v.yaw, v.pitch).shade };
    });
    return [faceStyle, shadeStyle] as const;
  };

  const [backStyle, backShade] = useFace(() => {
    'worklet';
    return { center: { x: 0, y: 0, z: -D / 2 }, faceYaw: 180, faceRotX: 0 };
  });
  const [topStyle, topShade] = useFace(() => {
    'worklet';
    return { center: { x: 0, y: -H / 2, z: 0 }, faceYaw: 0, faceRotX: 90 };
  });
  const [bottomStyle, bottomShade] = useFace(() => {
    'worklet';
    return { center: { x: 0, y: H / 2, z: 0 }, faceYaw: 0, faceRotX: -90 };
  });
  const [foreEdgeStyle, foreEdgeShade] = useFace(() => {
    'worklet';
    return { center: { x: W / 2, y: 0, z: 0 }, faceYaw: 90, faceRotX: 0 };
  });
  const [spineStyle, spineShade] = useFace(() => {
    'worklet';
    return { center: { x: -W / 2, y: 0, z: 0 }, faceYaw: -90, faceRotX: 0 };
  });
  const [firstPageStyle, firstPageShade] = useFace(() => {
    'worklet';
    return { center: { x: 0, y: 0, z: D / 2 - 1 }, faceYaw: 0, faceRotX: 0 };
  });
  const [coverInsideStyle, coverInsideShade] = useFace((hinge) => {
    'worklet';
    return coverGeometry(hinge, true);
  });
  const [coverFrontStyle, coverFrontShade] = useFace((hinge) => {
    'worklet';
    return coverGeometry(hinge, false);
  });

  // Desvanecimiento final al terminar de abrir
  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 0.8, 1], [1, 1, 0], Extrapolation.CLAMP),
  }));

  // Sombra proyectada en el "suelo": se ensancha según el ancho visible del libro
  const groundShadowStyle = useAnimatedStyle(() => {
    const v = getView();
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

  const centered = (w: number, h: number) => ({
    width: w,
    height: h,
    left: (W - w) / 2,
    top: (H - h) / 2,
  });

  const rasterize = {
    renderToHardwareTextureAndroid: true,
    shouldRasterizeIOS: true,
  };

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
            <Animated.View style={[styles.face, centered(W, H), backStyle]} {...rasterize}>
              <BackCoverArt />
              <Animated.View style={[styles.shade, backShade]} />
            </Animated.View>

            {/* ---------- Cantos de hojas (superior, inferior y lateral) ---------- */}
            <Animated.View style={[styles.face, styles.edgeHorizontal, centered(W, D), topStyle]} {...rasterize}>
              <PageEdgeTexture direction="horizontal" lines={10} seed={3} />
              <Animated.View style={[styles.shade, topShade]} />
            </Animated.View>
            <Animated.View style={[styles.face, styles.edgeHorizontal, centered(W, D), bottomStyle]} {...rasterize}>
              <PageEdgeTexture direction="horizontal" lines={10} seed={4} />
              <Animated.View style={[styles.shade, bottomShade]} />
            </Animated.View>
            <Animated.View style={[styles.face, styles.edgeVertical, centered(D, H), foreEdgeStyle]} {...rasterize}>
              <PageEdgeTexture direction="vertical" lines={10} seed={5} />
              <Animated.View style={[styles.shade, foreEdgeShade]} />
            </Animated.View>

            {/* ---------- Primera hoja (visible al levantar la tapa) ---------- */}
            <Animated.View style={[styles.face, styles.firstPage, centered(W - 4, H - 4), firstPageStyle]} {...rasterize}>
              <PaperTexture seed={31} />
              <Text style={styles.firstPageTitle}>Nuestra Historia ❤️</Text>
              <Animated.View style={[styles.shade, firstPageShade]} />
            </Animated.View>

            {/* ---------- Lomo ---------- */}
            <Animated.View style={[styles.face, centered(D + 1, H), spineStyle]} {...rasterize}>
              <SpineArt />
              <Animated.View style={[styles.shade, spineShade]} />
            </Animated.View>

            {/* ---------- Tapa: guarda interior ---------- */}
            <Animated.View style={[styles.face, centered(W, H), coverInsideStyle]} {...rasterize}>
              <EndpaperArt />
              <Animated.View style={[styles.shade, coverInsideShade]} />
            </Animated.View>

            {/* ---------- Tapa: portada exterior ---------- */}
            <Animated.View style={[styles.face, centered(W, H), coverFrontStyle]} {...rasterize}>
              <FrontCoverArt />
              <Animated.View style={[styles.shade, coverFrontShade]} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <Text style={styles.tapHintText}>
        Arrastra para girar • Toca para abrir el cuaderno ✨
      </Text>
    </View>
  );
};

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
          <WatercolorHeartSVG size={item.size} rotation={item.rot} />
        </View>
      ))}

      <View style={styles.centerBadgeWrapper}>
        <CloudBadgeSVG width={236} height={130} />
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
        <WatercolorHeartSVG size={30} rotation={-6} />
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
        <WatercolorHeartSVG size={item.size * 0.8} rotation={item.rot} />
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
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchArea: {
    width: SCREEN_WIDTH,
    height: COVER_HEIGHT + 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    position: 'absolute',
    overflow: 'hidden',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#12060A',
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
  firstPage: {
    backgroundColor: '#FDFBF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstPageTitle: {
    color: '#8C6E4A',
    fontSize: 18,
    fontStyle: 'italic',
    fontWeight: '700',
    opacity: 0.75,
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
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
