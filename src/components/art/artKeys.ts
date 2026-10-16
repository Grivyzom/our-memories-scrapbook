/**
 * Claves compartidas entre la app y scripts/bake-art.js para encontrar el PNG
 * horneado de cada textura o sticker. Sin dependencias de React Native.
 */

export type TextureKind = 'paper' | 'linen' | 'leather';

/**
 * Lado (en dp) de cada baldosa horneada: un múltiplo exacto del patrón SVG
 * (papel 120, lino 48, cuero 64) para que se repita sin costuras.
 */
export const TEXTURE_TILE: Record<TextureKind, number> = {
  paper: 240,
  linen: 240,
  leather: 256,
};

export const textureKey = (kind: TextureKind, seed: number, intensity = 1, color?: string) =>
  [
    kind,
    seed,
    intensity !== 1 ? `i${Math.round(intensity * 100)}` : null,
    color ? color.replace('#', '').toLowerCase() : null,
  ]
    .filter((part) => part !== null)
    .join('-');

export const stickerKey = (name: string, width: number, height: number) =>
  `${name}-${width}x${height}`;
