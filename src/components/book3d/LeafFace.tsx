import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import {
  LeafSpec,
  ProjectionOptions,
  SEAM_OVERLAP,
  leafEdgeGeometry,
  leafSegmentGeometry,
  projectFace,
} from './engine';

export type LeafFaceKind = 'front' | 'back' | 'edge';

interface LeafFaceProps {
  spec: LeafSpec;
  kind: LeafFaceKind;
  seg?: number;
  theta: SharedValue<number>;
  bend: SharedValue<number>;
  zIndex: SharedValue<number>;
  /** Multiplicador de opacidad (0 = hoja oculta). */
  presence?: SharedValue<number>;
  yaw?: SharedValue<number>;
  pitch?: SharedValue<number>;
  projection: ProjectionOptions;
  stageWidth: number;
  stageHeight: number;
  faceHeight: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Ancho en pantalla de una cara de hoja (segmento con solape o canto). */
export const leafFaceWidth = (spec: LeafSpec, kind: LeafFaceKind) =>
  kind === 'edge' ? Math.max(1.5, spec.thickness) : spec.length / spec.segments + SEAM_OVERLAP;

/**
 * Una cara proyectada de una hoja con volumen: un segmento de su anverso o
 * reverso, o la tira del canto que muestra el grosor del papel.
 */
export const LeafFace: React.FC<LeafFaceProps> = ({
  spec,
  kind,
  seg = 0,
  theta,
  bend,
  zIndex,
  presence,
  yaw,
  pitch,
  projection,
  stageWidth,
  stageHeight,
  faceHeight,
  style,
  children,
}) => {
  const width = leafFaceWidth(spec, kind);

  const project = () => {
    'worklet';
    const geo =
      kind === 'edge'
        ? leafEdgeGeometry(spec, theta.value, bend.value)
        : leafSegmentGeometry(spec, theta.value, bend.value, seg, kind === 'front' ? 1 : -1);
    return projectFace(geo, yaw ? yaw.value : 0, pitch ? pitch.value : 0, projection);
  };

  const faceStyle = useAnimatedStyle(() => {
    const p = project();
    const on = presence ? presence.value : 1;
    return {
      opacity: p.visible ? on : 0,
      zIndex: zIndex.value,
      transform: p.transform as any,
    };
  });

  const shadeStyle = useAnimatedStyle(() => ({ opacity: project().shade }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.face,
        {
          width,
          height: faceHeight,
          left: (stageWidth - width) / 2,
          top: (stageHeight - faceHeight) / 2,
        },
        style,
        faceStyle,
      ]}
    >
      {children}
      <Animated.View style={[styles.shade, shadeStyle]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    overflow: 'hidden',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A0F08',
  },
});
