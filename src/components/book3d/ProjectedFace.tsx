import React from 'react';
import { StyleSheet, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';

/**
 * Estado de una cara en un frame. `transform` sólo importa si `visible`.
 */
export interface FaceFrame {
  visible: boolean;
  /** Opacidad de la cara visible (1 si se omite). */
  opacity?: number;
  shade: number;
  zIndex: number;
  transform: any[];
}

/** Cara oculta: mismo objeto en cada frame, así no hay que actualizar nada. */
export const HIDDEN_FACE: FaceFrame = { visible: false, shade: 0, zIndex: 0, transform: [] };

/**
 * Proyecta una cara una sola vez por frame y reparte el resultado en tres
 * estilos separados. Reanimated sólo envía a nativo un estilo si alguno de sus
 * valores cambió (comparación superficial), así que:
 * - el transform sólo viaja mientras la cara se ve (oculta se congela);
 * - opacidad y zIndex sólo viajan cuando de verdad cambian (al cruzar 90°),
 *   en vez de reordenar las vistas nativas en cada frame;
 * - la sombra se redondea a centésimas para no mandar cambios imperceptibles.
 */
export const useProjectedFace = (project: () => FaceFrame) => {
  const frame = useDerivedValue(project);

  const transformStyle = useAnimatedStyle(() => {
    const f = frame.value;
    return f.visible ? { transform: f.transform } : HIDDEN_TRANSFORM;
  });
  const metaStyle = useAnimatedStyle(() => {
    const f = frame.value;
    return { opacity: f.visible ? f.opacity ?? 1 : 0, zIndex: f.zIndex };
  });
  const shadeStyle = useAnimatedStyle(() => {
    const f = frame.value;
    return { opacity: f.visible ? Math.round(f.shade * 100) / 100 : 0 };
  });

  return { transformStyle, metaStyle, shadeStyle };
};

const HIDDEN_TRANSFORM = { transform: [{ scale: 0 }] };

interface ProjectedFaceProps {
  project: () => FaceFrame;
  /** Tamaño, posición, fondo y bordes de la cara. */
  style?: StyleProp<ViewStyle>;
  /** Estilo del contenido (recortado al tamaño de la cara). */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Cachea el contenido como textura en la GPU. La sombra queda fuera de la
   * textura: así girar o sombrear la cara no obliga a volver a pintar su arte.
   */
  rasterize?: boolean;
  shadeColor: string;
  children?: React.ReactNode;
}

export const ProjectedFace: React.FC<ProjectedFaceProps> = ({
  project,
  style,
  contentStyle,
  rasterize = false,
  shadeColor,
  children,
}) => {
  const { transformStyle, metaStyle, shadeStyle } = useProjectedFace(project);

  return (
    <Animated.View pointerEvents="none" style={[styles.face, style, transformStyle, metaStyle]}>
      <View
        style={[styles.content, contentStyle]}
        renderToHardwareTextureAndroid={rasterize}
        shouldRasterizeIOS={rasterize}
      >
        {children}
      </View>
      <Animated.View style={[styles.shade, { backgroundColor: shadeColor }, shadeStyle]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
  },
});
