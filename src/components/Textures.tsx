import React, { memo, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { BAKED_ART, BakedArt } from './art/bakedManifest';
import { TEXTURE_TILE, TextureKind, textureKey } from './art/artKeys';
import {
  LeatherTextureSVG,
  LinenTextureSVG,
  PaperTextureProps,
  PaperTextureSVG,
  TextureProps,
  makeRandom,
} from './art/TextureSVG';

/**
 * Texturas del cuaderno (papel, lino, cuero) horneadas en PNG.
 *
 * El dibujo es el mismo que el de los patrones SVG de ./art/TextureSVG.tsx
 * (se generan con `npm run bake-art`), pero en vez de ~60–110 nodos nativos de
 * react-native-svg por textura se pintan unas pocas baldosas <Image> de tamaño
 * exacto en dp. Si una combinación no está horneada se usa el SVG original.
 */

/** Rellena su caja con baldosas de `art` (tamaño fijo en dp, sin reescalar). */
const TiledImage: React.FC<{ art: BakedArt; tile: number }> = memo(({ art, tile }) => {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  };
  const cols = size ? Math.ceil(size.w / tile) : 0;
  const rows = size ? Math.ceil(size.h / tile) : 0;

  return (
    <View style={styles.clip} pointerEvents="none" onLayout={onLayout}>
      {Array.from({ length: rows * cols }, (_, i) => (
        <Image
          key={i}
          source={art.source}
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: (i % cols) * tile,
            top: Math.floor(i / cols) * tile,
            width: tile,
            height: tile,
          }}
        />
      ))}
    </View>
  );
});

const BakedTexture: React.FC<{
  kind: TextureKind;
  seed: number;
  intensity: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  fallback: () => React.ReactElement;
}> = ({ kind, seed, intensity, color, style, children, fallback }) => {
  const art = BAKED_ART[textureKey(kind, seed, intensity, color)];
  if (!art) return fallback();
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <TiledImage art={art} tile={TEXTURE_TILE[kind]} />
      {children}
    </View>
  );
};

/* ============================== PAPEL ============================== */

export const PaperTexture: React.FC<PaperTextureProps> = (props) => {
  const { style, seed = 7, intensity = 1, vignette = true, fiberColor } = props;
  const vignetteArt = BAKED_ART['paper-vignette'];
  return (
    <BakedTexture
      kind="paper"
      seed={seed}
      intensity={intensity}
      color={fiberColor}
      style={style}
      fallback={() => <PaperTextureSVG {...props} />}
    >
      {vignette && intensity === 1 && vignetteArt && (
        // Degradado radial estirado a la caja, igual que el rx/ry="72%" del SVG
        <Image
          source={vignetteArt.source}
          fadeDuration={0}
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
        />
      )}
    </BakedTexture>
  );
};

/* ============================== TELA (LINO) ============================== */

export const LinenTexture: React.FC<TextureProps & { threadColor?: string }> = (props) => (
  <BakedTexture
    kind="linen"
    seed={props.seed ?? 11}
    intensity={props.intensity ?? 1}
    color={props.threadColor}
    style={props.style}
    fallback={() => <LinenTextureSVG {...props} />}
  />
);

/* ============================== CUERO ============================== */

export const LeatherTexture: React.FC<TextureProps> = (props) => (
  <BakedTexture
    kind="leather"
    seed={props.seed ?? 23}
    intensity={props.intensity ?? 1}
    style={props.style}
    fallback={() => <LeatherTextureSVG {...props} />}
  />
);

/* ============================== CANTO DE HOJAS ============================== */

/**
 * Líneas finas paralelas que simulan el canto de muchas hojas apiladas.
 * `direction="vertical"` => líneas verticales (canto lateral); "horizontal" => canto superior/inferior.
 */
export const PageEdgeTexture: React.FC<
  TextureProps & { direction?: 'vertical' | 'horizontal'; lines?: number }
> = ({ style, seed = 5, direction = 'vertical', lines = 18 }) => {
  const strokes = useMemo(() => {
    const rnd = makeRandom(seed);
    return Array.from({ length: lines }, (_, i) => ({
      pos: ((i + 0.5 + (rnd() - 0.5) * 0.5) / lines) * 100,
      o: 0.12 + rnd() * 0.18,
      w: 0.4 + rnd() * 0.5,
    }));
  }, [seed, lines]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        {strokes.map((s, i) =>
          direction === 'vertical' ? (
            <Line key={i} x1={`${s.pos}%`} y1="0" x2={`${s.pos}%`} y2="100%" stroke="#9C8768" strokeOpacity={s.o} strokeWidth={s.w} />
          ) : (
            <Line key={i} x1="0" y1={`${s.pos}%`} x2="100%" y2={`${s.pos}%`} stroke="#9C8768" strokeOpacity={s.o} strokeWidth={s.w} />
          )
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
