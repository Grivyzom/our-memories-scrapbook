/* eslint-disable no-console */
/**
 * Hornea el arte vectorial estático (texturas y stickers) en PNG @1x/@2x/@3x.
 *
 * Los componentes SVG de `src/components/art/TextureSVG.tsx` y
 * `src/components/StickersAndVectors.tsx` siguen siendo la fuente: este script
 * los evalúa tal cual (con un React mínimo que sólo produce marcado SVG), los
 * rasteriza con resvg y genera `src/components/art/bakedManifest.ts`.
 *
 * En el móvil cada textura pasaba de ~60–110 nodos nativos de react-native-svg
 * a unas pocas <Image>, con el mismo dibujo.
 *
 *   npm run bake-art
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'baked');
const MANIFEST = path.join(ROOT, 'src', 'components', 'art', 'bakedManifest.ts');
const SCALES = [1, 2, 3];

/* ----------------------- React mínimo → marcado SVG ----------------------- */

const Fragment = Symbol('Fragment');
const ReactShim = {
  Fragment,
  createElement: (type, props, ...children) => ({
    type,
    props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  }),
  useMemo: (fn) => fn(),
};

const svgTag = (tag) => {
  const C = (props) => ({ type: tag, props });
  C.svgTag = tag;
  return C;
};
const SvgShim = {
  __esModule: true,
  default: svgTag('svg'),
  Svg: svgTag('svg'),
  Path: svgTag('path'),
  Circle: svgTag('circle'),
  Rect: svgTag('rect'),
  G: svgTag('g'),
  Defs: svgTag('defs'),
  LinearGradient: svgTag('linearGradient'),
  RadialGradient: svgTag('radialGradient'),
  Stop: svgTag('stop'),
  Ellipse: svgTag('ellipse'),
  Line: svgTag('line'),
  Pattern: svgTag('pattern'),
};
// View sólo envuelve al <Svg> (rotación/opacidad se aplican en la app)
const RNShim = {
  View: ({ children }) => ({ type: Fragment, props: { children } }),
  StyleSheet: { create: (s) => s, absoluteFill: {}, absoluteFillObject: {} },
};

const SHIMS = { react: ReactShim, 'react-native-svg': SvgShim, 'react-native': RNShim };

const loadTsx = (file) => {
  const code = babel.transformFileSync(file, {
    babelrc: false,
    configFile: false,
    presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
    plugins: [
      ['@babel/plugin-transform-react-jsx', { runtime: 'classic' }],
      '@babel/plugin-transform-modules-commonjs',
    ],
  }).code;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.require = (id) => {
    if (SHIMS[id]) return SHIMS[id];
    throw new Error(`bake-art: import no soportado "${id}" en ${file}`);
  };
  mod._compile(code, file);
  return mod.exports;
};

const KEEP_CAMEL = new Set([
  'viewBox',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'gradientUnits',
  'gradientTransform',
  'preserveAspectRatio',
]);
const attrName = (k) => (KEEP_CAMEL.has(k) ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const render = (node) => {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (Array.isArray(node)) return node.map(render).join('');
  if (typeof node !== 'object') return esc(node);
  const { type, props } = node;
  if (type === Fragment) return render(props.children);
  if (typeof type === 'function') return render(type(props));
  const attrs = Object.entries(props)
    .filter(([k, v]) => k !== 'children' && k !== 'key' && k !== 'style' && v !== undefined && v !== null)
    .map(([k, v]) => ` ${attrName(k)}="${esc(v)}"`)
    .join('');
  const xmlns = type === 'svg' ? ' xmlns="http://www.w3.org/2000/svg"' : '';
  return `<${type}${xmlns}${attrs}>${render(props.children)}</${type}>`;
};

/** Primer <svg> del árbol, con su tamaño forzado a width × height. */
const svgMarkup = (element, width, height) => {
  const findSvg = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const f = findSvg(n);
        if (f) return f;
      }
      return null;
    }
    if (node.type === 'svg') return node;
    if (node.type === Fragment) return findSvg(node.props.children);
    if (typeof node.type === 'function') return findSvg(node.type(node.props));
    return null;
  };
  const svg = findSvg(element);
  if (!svg) throw new Error('bake-art: el componente no dibuja ningún <Svg>');
  return render({ type: 'svg', props: { ...svg.props, width, height } });
};

/* ------------------------------- Rasterizado ------------------------------- */

const written = [];
const bake = (name, markup, width, height) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const s of SCALES) {
    const png = new Resvg(markup, {
      fitTo: { mode: 'zoom', value: s },
      background: 'rgba(0,0,0,0)',
    })
      .render()
      .asPng();
    const suffix = s === 1 ? '' : `@${s}x`;
    fs.writeFileSync(path.join(OUT_DIR, `${name}${suffix}.png`), png);
  }
  written.push({ name, width, height });
};

/* ------------------------------ Qué se hornea ------------------------------ */

const textures = loadTsx(path.join(ROOT, 'src/components/art/TextureSVG.tsx'));
const stickers = loadTsx(path.join(ROOT, 'src/components/StickersAndVectors.tsx'));
const { TEXTURE_TILE, textureKey, stickerKey } = loadTsx(
  path.join(ROOT, 'src/components/art/artKeys.ts')
);

// Combinaciones de textura que usa la app (kind, seed, intensity, color)
const TEXTURES = [
  { kind: 'paper', seed: 17 },
  { kind: 'paper', seed: 31 },
  { kind: 'paper', seed: 41, color: '#9B4A50' },
  { kind: 'linen', seed: 11 },
  { kind: 'linen', seed: 12 },
  { kind: 'leather', seed: 23 },
  { kind: 'leather', seed: 24 },
  { kind: 'leather', seed: 25, intensity: 1.2 },
  { kind: 'leather', seed: 27, intensity: 1.15 },
];
const TEXTURE_COMPONENTS = {
  paper: (t) => textures.PaperTextureSVG({ seed: t.seed, intensity: t.intensity, fiberColor: t.color, vignette: false }),
  linen: (t) => textures.LinenTextureSVG({ seed: t.seed, intensity: t.intensity, threadColor: t.color }),
  leather: (t) => textures.LeatherTextureSVG({ seed: t.seed, intensity: t.intensity }),
};

for (const t of TEXTURES) {
  const tile = TEXTURE_TILE[t.kind];
  const markup = svgMarkup(TEXTURE_COMPONENTS[t.kind](t), tile, tile);
  bake(textureKey(t.kind, t.seed, t.intensity, t.color), markup, tile, tile);
}

// Viñeta del papel: el mismo degradado radial, estirado a la caja como en react-native-svg
{
  const V = 256;
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${V}" height="${V}">
    <defs><radialGradient id="v" cx="50%" cy="50%" r="72%" fx="50%" fy="45%">
      <stop offset="0.55" stop-color="#8A6A3E" stop-opacity="0"/>
      <stop offset="1" stop-color="#8A6A3E" stop-opacity="0.16"/>
    </radialGradient></defs>
    <rect x="0" y="0" width="${V}" height="${V}" fill="url(#v)"/></svg>`;
  bake('paper-vignette', markup, V, V);
}

// Stickers al tamaño exacto en que se usan (el corazón se escala: siempre <= 32)
const STICKERS = [
  { name: 'heart', el: stickers.WatercolorHeartSVG({ size: 32 }), w: 32, h: 32 },
  { name: 'cloudBadge', el: stickers.CloudBadgeSVG({ width: 236, height: 130 }), w: 236, h: 130 },
  { name: 'driedFlowers', el: stickers.DriedOrangeFlowersSVG({ width: 80, height: 100 }), w: 80, h: 100 },
  { name: 'barcode', el: stickers.VerticalBarcodeSVG({ height: 108 }), w: 24, h: 108 },
  { name: 'cherub', el: stickers.VintageCherubSVG({ size: 68 }), w: 68, h: 68 },
  { name: 'roses', el: stickers.WhiteRosesBouquetSVG({ width: 80, height: 102 }), w: 80, h: 102 },
  { name: 'spine', el: stickers.HDSpineBindingSVG({ height: 600, width: 36 }), w: 36, h: 600 },
];
for (const st of STICKERS) {
  bake(stickerKey(st.name, st.w, st.h), svgMarkup(st.el, st.w, st.h), st.w, st.h);
}

/* -------------------------------- Manifiesto -------------------------------- */

const lines = written
  .map(
    ({ name, width, height }) =>
      `  '${name}': { source: require('../../../assets/baked/${name}.png'), width: ${width}, height: ${height} },`
  )
  .join('\n');
fs.writeFileSync(
  MANIFEST,
  `// Generado por scripts/bake-art.js (npm run bake-art). No editar a mano.
import { ImageSourcePropType } from 'react-native';

export interface BakedArt {
  source: ImageSourcePropType;
  width: number;
  height: number;
}

export const BAKED_ART: Record<string, BakedArt> = {
${lines}
};
`
);
console.log(`bake-art: ${written.length} imágenes en assets/baked`);
