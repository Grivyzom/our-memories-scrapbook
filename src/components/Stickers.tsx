import React from 'react';
import { Image, View } from 'react-native';
import { BAKED_ART } from './art/bakedManifest';
import { stickerKey } from './art/artKeys';
import {
  CloudBadgeSVG,
  DriedOrangeFlowersSVG,
  HDSpineBindingSVG,
  VerticalBarcodeSVG,
  VintageCherubSVG,
  WatercolorHeartSVG,
  WhiteRosesBouquetSVG,
} from './StickersAndVectors';

/**
 * Stickers del cuaderno horneados en PNG (`npm run bake-art`) a partir de los
 * SVG de ./StickersAndVectors.tsx. Mismo tamaño y mismo dibujo, pero una sola
 * <Image> en vez de decenas de nodos nativos de react-native-svg.
 * Si un tamaño no está horneado se dibuja el SVG original.
 */
const Baked: React.FC<{
  name: string;
  width: number;
  height: number;
  /** Tamaño en pantalla, si difiere del horneado (sólo para reducir). */
  displayWidth?: number;
  displayHeight?: number;
  fallback: () => React.ReactElement;
}> = ({ name, width, height, displayWidth = width, displayHeight = height, fallback }) => {
  const art = BAKED_ART[stickerKey(name, width, height)];
  if (!art) return fallback();
  return (
    <Image
      source={art.source}
      fadeDuration={0}
      style={{ width: displayWidth, height: displayHeight }}
    />
  );
};

// El corazón se hornea una vez a 32 dp (su viewBox) y se reduce a cada tamaño
const HEART_BAKED_SIZE = 32;

export const WatercolorHeart: React.FC<{
  size?: number;
  rotation?: number;
  opacity?: number;
}> = ({ size = 22, rotation = 0, opacity = 0.85 }) => {
  if (size > HEART_BAKED_SIZE) {
    return <WatercolorHeartSVG size={size} rotation={rotation} opacity={opacity} />;
  }
  return (
    <View style={{ transform: [{ rotate: `${rotation}deg` }], opacity }}>
      <Baked
        name="heart"
        width={HEART_BAKED_SIZE}
        height={HEART_BAKED_SIZE}
        displayWidth={size}
        displayHeight={size}
        fallback={() => <WatercolorHeartSVG size={size} opacity={1} />}
      />
    </View>
  );
};

export const CloudBadge: React.FC<{ width?: number; height?: number }> = ({
  width = 230,
  height = 126,
}) => (
  <Baked
    name="cloudBadge"
    width={width}
    height={height}
    fallback={() => <CloudBadgeSVG width={width} height={height} />}
  />
);

export const DriedOrangeFlowers: React.FC<{ width?: number; height?: number }> = ({
  width = 88,
  height = 115,
}) => (
  <Baked
    name="driedFlowers"
    width={width}
    height={height}
    fallback={() => <DriedOrangeFlowersSVG width={width} height={height} />}
  />
);

export const VerticalBarcode: React.FC<{ height?: number }> = ({ height = 104 }) => (
  <Baked
    name="barcode"
    width={24}
    height={height}
    fallback={() => <VerticalBarcodeSVG height={height} />}
  />
);

export const VintageCherub: React.FC<{ size?: number }> = ({ size = 76 }) => (
  <Baked
    name="cherub"
    width={size}
    height={size}
    fallback={() => <VintageCherubSVG size={size} />}
  />
);

export const WhiteRosesBouquet: React.FC<{ width?: number; height?: number }> = ({
  width = 86,
  height = 110,
}) => (
  <Baked
    name="roses"
    width={width}
    height={height}
    fallback={() => <WhiteRosesBouquetSVG width={width} height={height} />}
  />
);

export const HDSpineBinding: React.FC<{ height?: number; width?: number }> = ({
  height = 600,
  width = 36,
}) => (
  <Baked
    name="spine"
    width={width}
    height={height}
    fallback={() => <HDSpineBindingSVG height={height} width={width} />}
  />
);
