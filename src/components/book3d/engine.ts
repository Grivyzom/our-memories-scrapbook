/* =========================================================================
 * Motor 3D mínimo compartido: React Native no soporta translateZ, así que cada
 * cara se proyecta manualmente. Para cada cara calculamos su centro en el
 * espacio 3D (tras aplicar yaw/pitch), lo proyectamos con la perspectiva y
 * aplicamos la misma rotación a la vista. Las caras que miran hacia atrás se
 * ocultan (back-face culling) y se sombrean según su orientación a la luz.
 *
 * Además modela "hojas" de papel con grosor y curvatura: cada hoja se divide
 * en segmentos encadenados desde el lomo; cada segmento gira un poco menos que
 * el anterior (el borde libre se retrasa), lo que dibuja una parábola en el
 * aire como el papel de alto gramaje.
 *
 * El paso de página se describe con un único progreso (0 = sin pasar, 1 =
 * pasada) que puede venir del dedo, de un muelle o de una curva temporal. Los
 * valores fuera de [0, 1] (el sobrepaso de un muelle) se reflejan: la hoja no
 * atraviesa la mesa, rebota en ella y se asienta, como el papel real.
 * ========================================================================= */

export type Vec3 = { x: number; y: number; z: number };

export const DEG = Math.PI / 180;

export const rotY = (v: Vec3, rad: number): Vec3 => {
  'worklet';
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
};

export const rotX = (v: Vec3, rad: number): Vec3 => {
  'worklet';
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};

export const normalizeAngle = (deg: number) => {
  'worklet';
  return ((((deg % 360) + 540) % 360) - 180);
};

export const makeLight = (x: number, y: number, z: number): Vec3 => {
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
};

export interface FaceGeometry {
  center: Vec3;
  faceYaw: number; // rotación propia de la cara sobre Y (grados)
  faceRotX: number; // rotación propia de la cara sobre X (grados)
}

export interface ProjectionOptions {
  perspective: number;
  light: Vec3;
  /** Lambert al que la sombra vale 0 (1 = sólo cara iluminada de frente). */
  shadeBaseline?: number;
  shadeGain?: number;
  shadeMax?: number;
}

export const projectFace = (
  geo: FaceGeometry,
  yaw: number,
  pitch: number,
  opts: ProjectionOptions
) => {
  'worklet';
  const { perspective, light } = opts;
  const baseline = opts.shadeBaseline ?? 1;
  const gain = opts.shadeGain ?? 0.55;
  const max = opts.shadeMax ?? 0.62;

  const wc = rotX(rotY(geo.center, yaw * DEG), pitch * DEG);
  const normal = rotX(
    rotY(rotX({ x: 0, y: 0, z: 1 }, geo.faceRotX * DEG), (yaw + geo.faceYaw) * DEG),
    pitch * DEG
  );
  const k = perspective / (perspective - wc.z);
  const lambert = Math.max(0, normal.x * light.x + normal.y * light.y + normal.z * light.z);
  return {
    visible: normal.z > 0.012,
    shade: Math.min(max, Math.max(0, (baseline - lambert) * gain)),
    transform: [
      { translateX: wc.x * k },
      { translateY: wc.y * k },
      { perspective },
      { scale: k },
      { rotateX: `${pitch}deg` },
      { rotateY: `${yaw + geo.faceYaw}deg` },
      { rotateX: `${geo.faceRotX}deg` },
    ],
  };
};

/* ============================ HOJAS CON VOLUMEN ============================ */

/**
 * Hoja articulada en el lomo. `theta` va de 0 (tumbada a la derecha) a 180
 * (tumbada a la izquierda). `bend` curva la hoja: con valores positivos el
 * borde libre se queda atrás respecto al lomo.
 */
export interface LeafSpec {
  hinge: Vec3; // punto del lomo (centro vertical de la hoja)
  length: number; // ancho de la hoja desde el lomo hasta el canto
  segments: number;
  thickness: number; // grosor del papel (extrusión)
}

// Solape entre segmentos para que no aparezcan rendijas al curvarse
export const SEAM_OVERLAP = 4;

export const leafSegmentAngle = (theta: number, bend: number, seg: number, segments: number) => {
  'worklet';
  const t = (seg + 0.5) / segments;
  const a = theta - bend * Math.pow(t, 1.6);
  return Math.min(180, Math.max(0, a));
};

/** Punto inicial (en el plano XZ) del segmento `seg` siguiendo la cadena desde el lomo. */
const leafChainPoint = (spec: LeafSpec, theta: number, bend: number, seg: number) => {
  'worklet';
  const segLen = spec.length / spec.segments;
  let x = spec.hinge.x;
  let z = spec.hinge.z;
  for (let k = 0; k < seg; k++) {
    const a = leafSegmentAngle(theta, bend, k, spec.segments) * DEG;
    x += segLen * Math.cos(a);
    z += segLen * Math.sin(a);
  }
  return { x, z };
};

/** Cara anverso (side = 1) o reverso (side = -1) de un segmento de la hoja. */
export const leafSegmentGeometry = (
  spec: LeafSpec,
  theta: number,
  bend: number,
  seg: number,
  side: 1 | -1
): FaceGeometry => {
  'worklet';
  const segLen = spec.length / spec.segments;
  const start = leafChainPoint(spec, theta, bend, seg);
  const aDeg = leafSegmentAngle(theta, bend, seg, spec.segments);
  const a = aDeg * DEG;
  // Cada cara se separa medio grosor a lo largo de la normal: la hoja es un bloque, no un plano
  const off = (side * spec.thickness) / 2;
  return {
    center: {
      x: start.x + (segLen / 2) * Math.cos(a) - Math.sin(a) * off,
      y: spec.hinge.y,
      z: start.z + (segLen / 2) * Math.sin(a) + Math.cos(a) * off,
    },
    faceYaw: -aDeg + (side === 1 ? 0 : 180),
    faceRotX: 0,
  };
};

/** Canto exterior de la hoja (la tira que muestra su grosor). */
export const leafEdgeGeometry = (spec: LeafSpec, theta: number, bend: number): FaceGeometry => {
  'worklet';
  const end = leafChainPoint(spec, theta, bend, spec.segments);
  const aDeg = leafSegmentAngle(theta, bend, spec.segments - 1, spec.segments);
  return {
    center: { x: end.x, y: spec.hinge.y, z: end.z },
    faceYaw: 90 - aDeg,
    faceRotX: 0,
  };
};

/**
 * Orden de pintado de hojas que giran sobre el mismo lomo (RN no tiene buffer
 * de profundidad). La hoja más cercana a la vertical queda encima; los empates
 * se resuelven con `rank` (0..ranks), mayor = más arriba.
 */
export const stackZIndex = (theta: number, rank: number, ranks: number) => {
  'worklet';
  const lift = 90 - Math.abs(theta - 90);
  return 10 + Math.round(lift) * (ranks + 1) + rank;
};

/**
 * Curva de vuelo de una hoja: despegue acelerado, sobrepaso ligero al caer
 * (peso/inercia) y asentamiento. Devuelve valores en [0, ~1.035].
 */
export const leafFlightCurve = (t: number) => {
  'worklet';
  const c = Math.min(1, Math.max(0, t));
  if (c < 0.8) {
    const u = c / 0.8;
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    return e * 1.035;
  }
  const u = (c - 0.8) / 0.2;
  return 1.035 - 0.035 * (1 - (1 - u) * (1 - u));
};

/**
 * Curvatura a partir del progreso de vuelo. Al despegar el borde libre va por
 * delante (la hoja se levanta desde el canto); pasada la vertical el aire lo
 * frena y queda rezagado formando la parábola; al sobrepasar el destino el
 * borde "rebota" hacia arriba antes de asentarse.
 */
export const leafBendFromProgress = (p: number, maxBend: number, bounceGain: number) => {
  'worklet';
  const c = Math.min(1, Math.max(0, p));
  return maxBend * Math.sin(Math.PI * c) * (2.2 * c - 0.7) + Math.max(0, p - 1) * bounceGain;
};

/* ========================== PASO DE PÁGINA FÍSICO ========================== */

/**
 * Progreso del paso de página -> fracción de giro en [0, 1]. Lo que un muelle
 * se pasa de 1 (o de 0, al cancelar) se refleja: la hoja choca con la mesa y
 * rebota hacia arriba en vez de hundirse. El rebote se limita a ~18° para que
 * un lanzamiento muy fuerte no la levante de forma exagerada.
 */
export const turnFraction = (progress: number) => {
  'worklet';
  const c = progress > 1 ? Math.max(0.9, 2 - progress) : progress < 0 ? Math.min(0.1, -progress) : progress;
  return Math.min(1, Math.max(0, c));
};

/**
 * Arrastre del dedo -> progreso. `travel` es la distancia recorrida hacia el
 * otro lado en anchos de página (0..2). Si se agarrara el canto, éste seguiría
 * al dedo con theta = acos(1 - travel): la hoja se levanta rápido al principio
 * y se tumba despacio al final, como al pasarla de verdad. Esa curva tiene
 * pendiente infinita en 0 (la hoja "salta" al primer píxel), así que se mezcla
 * a partes iguales con la lineal: arranca suave y conserva el carácter físico.
 */
export const dragTurnProgress = (travel: number) => {
  'worklet';
  const d = Math.min(2, Math.max(0, travel));
  const arc = Math.acos(1 - d) / Math.PI;
  return 0.5 * (d / 2) + 0.5 * arc;
};
