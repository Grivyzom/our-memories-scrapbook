import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import {
  LeafSpec,
  ProjectionOptions,
  SEAM_OVERLAP,
  leafEdgeGeometry,
  leafSegmentGeometry,
  projectFace,
} from './engine';
import { FaceFrame, HIDDEN_FACE, ProjectedFace } from './ProjectedFace';

export type LeafFaceKind = 'front' | 'back' | 'edge';

interface LeafFaceProps {
  spec: LeafSpec;
  kind: LeafFaceKind;
  seg?: number;
  theta: SharedValue<number>;
  bend: SharedValue<number>;
  zIndex: SharedValue<number>;
  /** Multiplicador de opacidad; 0 = hoja oculta (no se calcula ni se actualiza nada). */
  presence?: SharedValue<number>;
  yaw?: SharedValue<number>;
  pitch?: SharedValue<number>;
  /** Distancia de la cámara por frame (si se omite, la de `projection`). */
  perspective?: SharedValue<number>;
  projection: ProjectionOptions;
  stageWidth: number;
  stageHeight: number;
  faceHeight: number;
  /** Cachea el contenido de la cara como textura en la GPU (ver ProjectedFace). */
  rasterize?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Capa animada fuera de la textura cacheada (ver ProjectedFace). */
  overlay?: React.ReactNode;
}

/** Ancho en pantalla de una cara de hoja (segmento con solape, hoja entera o canto). */
export const leafFaceWidth = (spec: LeafSpec, kind: LeafFaceKind) =>
  kind === 'edge'
    ? Math.max(1.5, spec.thickness)
    : spec.length / spec.segments + (spec.segments > 1 ? SEAM_OVERLAP : 0);

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
  perspective,
  projection,
  stageWidth,
  stageHeight,
  faceHeight,
  rasterize,
  style,
  children,
  overlay,
}) => {
  const width = leafFaceWidth(spec, kind);

  const project = (): FaceFrame => {
    'worklet';
    if (presence && presence.value === 0) return HIDDEN_FACE;
    const geo =
      kind === 'edge'
        ? leafEdgeGeometry(spec, theta.value, bend.value)
        : leafSegmentGeometry(spec, theta.value, bend.value, seg, kind === 'front' ? 1 : -1);
    const opts = perspective ? { ...projection, perspective: perspective.value } : projection;
    const p = projectFace(geo, yaw ? yaw.value : 0, pitch ? pitch.value : 0, opts);
    return {
      visible: p.visible,
      opacity: presence ? presence.value : 1,
      shade: p.shade,
      zIndex: zIndex.value,
      transform: p.transform,
    };
  };

  return (
    <ProjectedFace
      project={project}
      shadeColor="#1A0F08"
      rasterize={rasterize}
      overlay={overlay}
      style={[
        {
          width,
          height: faceHeight,
          left: (stageWidth - width) / 2,
          top: (stageHeight - faceHeight) / 2,
        },
        style,
      ]}
    >
      {children}
    </ProjectedFace>
  );
};
