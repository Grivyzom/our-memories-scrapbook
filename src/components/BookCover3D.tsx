import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { CloudBadgeSVG, WatercolorHeartSVG } from './StickersAndVectors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ocupa el 75% central de la pantalla manteniendo relación 3:4
const MAX_COVER_HEIGHT = SCREEN_HEIGHT * 0.64;
const MAX_COVER_WIDTH = SCREEN_WIDTH * 0.82;
export const COVER_WIDTH = Math.min(MAX_COVER_WIDTH, MAX_COVER_HEIGHT * 0.75);
export const COVER_HEIGHT = COVER_WIDTH * (4 / 3);

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

interface BookCover3DProps {
  openProgress: SharedValue<number>;
  onOpenBook: () => void;
}

export const BookCover3D: React.FC<BookCover3DProps> = ({
  openProgress,
  onOpenBook,
}) => {
  // Gesto de deslizar hacia la izquierda para abrir la portada en 3D
  const panToOpen = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX < 0) {
        const progress = Math.min(1, Math.abs(event.translationX) / (COVER_WIDTH * 0.65));
        openProgress.value = progress * 0.45;
      }
    })
    .onEnd((event) => {
      if (event.translationX < -45 || event.velocityX < -300) {
        runOnJS(onOpenBook)();
      } else {
        openProgress.value = 0;
      }
    });

  // Transformación 3D sobre el eje Y anclada al lomo izquierdo (efecto page-flip con perspectiva)
  const animatedCoverStyle = useAnimatedStyle(() => {
    const rotateYDeg = interpolate(
      openProgress.value,
      [0, 1],
      [0, -115],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      openProgress.value,
      [0, 0.5, 1],
      [1, 1.04, 0.92],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      openProgress.value,
      [0, 0.72, 1],
      [1, 0.85, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        { perspective: 1400 },
        { scale },
        { translateX: -COVER_WIDTH / 2 },
        { rotateY: `${rotateYDeg}deg` },
        { translateX: COVER_WIDTH / 2 },
      ],
    };
  });

  // Sombra dinámica que se expande al girar la portada
  const animatedShadowStyle = useAnimatedStyle(() => {
    const shadowScale = interpolate(openProgress.value, [0, 1], [1, 1.18]);
    const shadowOpacity = interpolate(openProgress.value, [0, 0.8, 1], [0.42, 0.2, 0]);
    return {
      opacity: shadowOpacity,
      transform: [{ scale: shadowScale }],
    };
  });

  return (
    <View style={styles.centerContainer}>
      <GestureDetector gesture={panToOpen}>
        <Pressable onPress={onOpenBook} style={styles.pressableArea}>
          {/* Sombra realista proyectada sobre el fondo azul */}
          <Animated.View style={[styles.bookDropShadow, animatedShadowStyle]} />

          {/* Canto de hojas blancas apiladas debajo de la portada (volumen de 5 páginas) */}
          <View style={styles.stackedPagesEdge}>
            <View style={styles.pageLayerLine} />
            <View style={styles.pageLayerLine} />
            <View style={styles.pageLayerLine} />
            <View style={styles.pageLayerLine} />
          </View>

          {/* Portada 3D articulada sobre el lomo izquierdo */}
          <Animated.View style={[styles.bookContainer, animatedCoverStyle]}>
            {/* Lomo izquierdo vertical en color rojo vino / burdeos (#8B1E24) */}
            <View style={styles.burgundySpine}>
              <View style={styles.spineHighlight} />
              <View style={styles.spineCrease} />
            </View>

            {/* Cuerpo de portada en color crema cálido (#FDFBF0) */}
            <View style={styles.creamCover}>
              {/* Textura sutil de papel */}
              <View style={styles.paperInnerBorder} />

              {/* Patrón distribuido de corazones rojos estilo acuarela */}
              {HEART_PATTERN.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.heartPosition,
                    { top: item.top as any, left: item.left as any },
                  ]}
                >
                  <WatercolorHeartSVG size={item.size} rotation={item.rot} />
                </View>
              ))}

              {/* Etiqueta central rosa pálido con borde ondulado y texto cursivo "Our Memories" */}
              <View style={styles.centerBadgeWrapper}>
                <CloudBadgeSVG width={236} height={130} />
                <View style={styles.badgeTextOverlay}>
                  <Text style={styles.cursiveCoverTitle}>Our Memories</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </GestureDetector>

      <Text style={styles.tapHintText}>
        Toca o desliza la portada para abrir el cuaderno ✨
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressableArea: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDropShadow: {
    position: 'absolute',
    width: COVER_WIDTH * 0.96,
    height: COVER_HEIGHT * 0.97,
    top: 16,
    left: 14,
    backgroundColor: '#1E273B',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
  },
  stackedPagesEdge: {
    position: 'absolute',
    right: -7,
    top: 6,
    bottom: 6,
    width: 14,
    backgroundColor: '#F5F0E1',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: '#D8CEBE',
    justifyContent: 'space-evenly',
    paddingVertical: 4,
  },
  pageLayerLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#DFD5C5',
  },
  bookContainer: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    flexDirection: 'row',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#FDFBF0',
    borderWidth: 1,
    borderColor: 'rgba(139, 30, 36, 0.22)',
  },
  burgundySpine: {
    width: COVER_WIDTH * 0.125,
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
    backgroundColor: '#FDFBF0',
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
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(214, 199, 178, 0.45)',
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
    fontSize: 27,
    color: '#6E1419',
    fontStyle: 'italic',
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      android: 'serif',
      default: 'serif',
    }),
    letterSpacing: 0.6,
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  tapHintText: {
    marginTop: 18,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
