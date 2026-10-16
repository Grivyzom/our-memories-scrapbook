import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, {
  Defs,
  Pattern,
  Rect,
  Circle,
  Path,
  Line,
  Ellipse,
  RadialGradient,
  Stop,
} from 'react-native-svg';

/**
 * Fuente vectorial de las texturas. La app usa las versiones horneadas en PNG
 * (ver ../Textures.tsx y scripts/bake-art.js); éstas quedan como origen del
 * dibujo y como respaldo para combinaciones que no se hayan horneado.
 *
 * Texturas procedurales para dar materialidad al cuaderno:
 * - LinenTexture: tela entrelazada de la tapa
 * - LeatherTexture: grano de cuero del lomo / tapas burdeos
 * - PaperTexture: fibras y motas del papel de las hojas
 * Todas son deterministas (misma semilla => mismo dibujo) para que no "parpadeen" entre renders.
 */

// Generador pseudoaleatorio determinista (mulberry32)
export const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

let textureIdCounter = 0;
const useTextureId = (prefix: string) =>
  useMemo(() => `${prefix}-${++textureIdCounter}`, [prefix]);

export interface TextureProps {
  style?: StyleProp<ViewStyle>;
  seed?: number;
  /** Multiplicador de intensidad (1 = valor por defecto) */
  intensity?: number;
}

/* ============================== PAPEL ============================== */

export interface PaperTextureProps extends TextureProps {
  /** Oscurece suavemente los bordes como papel envejecido */
  vignette?: boolean;
  fiberColor?: string;
}

export const PaperTextureSVG: React.FC<PaperTextureProps> = ({
  style,
  seed = 7,
  intensity = 1,
  vignette = true,
  fiberColor = '#7A5C3A',
}) => {
  const id = useTextureId('paper');
  const TILE = 120;

  const { specks, fibers } = useMemo(() => {
    const rnd = makeRandom(seed);
    const specksArr = Array.from({ length: 70 }, () => ({
      x: rnd() * TILE,
      y: rnd() * TILE,
      r: 0.3 + rnd() * 0.75,
      o: (0.05 + rnd() * 0.11) * intensity,
    }));
    const fibersArr = Array.from({ length: 16 }, () => {
      const x = rnd() * TILE;
      const y = rnd() * TILE;
      const len = 6 + rnd() * 16;
      const ang = rnd() * Math.PI * 2;
      const bend = (rnd() - 0.5) * 8;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      const mx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * bend;
      const my = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * bend;
      return {
        d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        o: (0.05 + rnd() * 0.07) * intensity,
        w: 0.4 + rnd() * 0.5,
      };
    });
    return { specks: specksArr, fibers: fibersArr };
  }, [seed, intensity]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            {fibers.map((f, i) => (
              <Path
                key={`f${i}`}
                d={f.d}
                stroke={fiberColor}
                strokeOpacity={f.o}
                strokeWidth={f.w}
                fill="none"
                strokeLinecap="round"
              />
            ))}
            {specks.map((s, i) => (
              <Circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill={fiberColor} fillOpacity={s.o} />
            ))}
          </Pattern>
          {vignette && (
            <RadialGradient id={`${id}-v`} cx="50%" cy="50%" rx="72%" ry="72%" fx="50%" fy="45%">
              <Stop offset="0.55" stopColor="#8A6A3E" stopOpacity={0} />
              <Stop offset="1" stopColor="#8A6A3E" stopOpacity={0.16 * intensity} />
            </RadialGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        {vignette && <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-v)`} />}
      </Svg>
    </View>
  );
};

/* ============================== TELA (LINO) ============================== */

export const LinenTextureSVG: React.FC<TextureProps & { threadColor?: string }> = ({
  style,
  seed = 11,
  intensity = 1,
  threadColor = '#6B4E2E',
}) => {
  const id = useTextureId('linen');
  const TILE = 48;

  // Hilos irregulares: cada fila/columna con grosor y opacidad ligeramente distintos
  const { rows, cols, slubs } = useMemo(() => {
    const rnd = makeRandom(seed);
    const rowsArr = Array.from({ length: TILE / 2 }, (_, i) => ({
      y: i * 2 + 0.5,
      o: (0.035 + rnd() * 0.05) * intensity,
      w: 0.5 + rnd() * 0.6,
    }));
    const colsArr = Array.from({ length: TILE / 2 }, (_, i) => ({
      x: i * 2 + 0.5,
      o: (0.025 + rnd() * 0.04) * intensity,
      w: 0.5 + rnd() * 0.5,
    }));
    // "Slubs": engrosamientos típicos del lino
    const slubsArr = Array.from({ length: 9 }, () => ({
      x: rnd() * TILE,
      y: Math.floor(rnd() * (TILE / 2)) * 2 + 0.5,
      len: 3 + rnd() * 7,
      o: (0.06 + rnd() * 0.06) * intensity,
    }));
    return { rows: rowsArr, cols: colsArr, slubs: slubsArr };
  }, [seed, intensity]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            {rows.map((r, i) => (
              <Line key={`r${i}`} x1={0} y1={r.y} x2={TILE} y2={r.y} stroke={threadColor} strokeOpacity={r.o} strokeWidth={r.w} />
            ))}
            {cols.map((c, i) => (
              <Line key={`c${i}`} x1={c.x} y1={0} x2={c.x} y2={TILE} stroke={threadColor} strokeOpacity={c.o} strokeWidth={c.w} />
            ))}
            {slubs.map((s, i) => (
              <Line
                key={`s${i}`}
                x1={s.x}
                y1={s.y}
                x2={s.x + s.len}
                y2={s.y}
                stroke={threadColor}
                strokeOpacity={s.o}
                strokeWidth={1.1}
                strokeLinecap="round"
              />
            ))}
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
};

/* ============================== CUERO ============================== */

export const LeatherTextureSVG: React.FC<TextureProps> = ({ style, seed = 23, intensity = 1 }) => {
  const id = useTextureId('leather');
  const TILE = 64;

  // Grano "pebble": celdas irregulares con brillo arriba y sombra abajo
  const pebbles = useMemo(() => {
    const rnd = makeRandom(seed);
    return Array.from({ length: 110 }, () => ({
      x: rnd() * TILE,
      y: rnd() * TILE,
      rx: 1.2 + rnd() * 2.2,
      ry: 0.9 + rnd() * 1.8,
      rot: rnd() * 180,
      dark: rnd() > 0.45,
      o: (0.08 + rnd() * 0.12) * intensity,
    }));
  }, [seed, intensity]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            {pebbles.map((p, i) => (
              <Ellipse
                key={i}
                cx={p.x}
                cy={p.y}
                rx={p.rx}
                ry={p.ry}
                transform={`rotate(${p.rot.toFixed(0)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                fill={p.dark ? '#1A0204' : '#FFE3E3'}
                fillOpacity={p.dark ? p.o : p.o * 0.55}
              />
            ))}
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
};
